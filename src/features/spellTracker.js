/**
 * D&D 5e Lite - Spell Tracker
 * Parses chat messages for "cast [Spell Name]" patterns and builds a chronological
 * spell log. Scans the last 50 LLM messages and retains entries from the last 2
 * long-rest periods.
 */

import { getContext } from '../../../../../extensions.js';
import { spellLog, setSpellLog, autoLongRestEnabled } from '../core/state.js';
import { saveSpellLog, loadSpellLog } from '../core/persistence.js';
import { parseHeader } from './headerParser.js';

// Any bracketed content: [Fireball, 3rd], [Shield], [Charm Person, 1st, Subtle, target]
const BRACKET_REGEX = /\[([^\[\]]+)\]/g;
// Short rest: "short rest", "takes a short rest", "short rested", "short resting"
const SHORT_REST_REGEX = /\bshort\s+rest(?:s|ed|ing)?\b/i;

/**
 * Maps conjugated forms of action keywords back to their base verb.
 * Only keywords rare enough to avoid false positives on normal "cast [Spell]" usage.
 */
const ACTION_KEYWORD_MAP = new Map([
    ['activate', 'activate'], ['activates', 'activate'], ['activated', 'activate'], ['activating', 'activate'],
    ['invoke', 'invoke'],     ['invokes', 'invoke'],     ['invoked', 'invoke'],     ['invoking', 'invoke'],
    ['channel', 'channel'],   ['channels', 'channel'],   ['channeled', 'channel'],  ['channeling', 'channel'],
    ['use', 'use'],           ['uses', 'use'],           ['used', 'use'],           ['using', 'use'],
    ['drink', 'drink'],       ['drinks', 'drink'],       ['drank', 'drink'],        ['drinking', 'drink'],
    ['consume', 'consume'],   ['consumes', 'consume'],   ['consumed', 'consume'],   ['consuming', 'consume'],
    ['trigger', 'trigger'],   ['triggers', 'trigger'],   ['triggered', 'trigger'],  ['triggering', 'trigger'],
    ['maintain', 'maintain'], ['maintains', 'maintain'], ['maintained', 'maintain'], ['maintaining', 'maintain'],
]);

const ACTION_LABELS = {
    cast:     { present: 'Cast',     past: 'Casted' },
    activate: { present: 'Activate', past: 'Activated' },
    invoke:   { present: 'Invoke',   past: 'Invoked' },
    channel:  { present: 'Channel',  past: 'Channeled' },
    use:      { present: 'Use',      past: 'Used' },
    drink:    { present: 'Drink',    past: 'Drank' },
    consume:  { present: 'Consume',  past: 'Consumed' },
    trigger:  { present: 'Trigger',  past: 'Triggered' },
    maintain: { present: 'Maintain', past: 'Maintained' },
};

/**
 * Get display labels (present/past tense) for an action keyword.
 * Falls back to 'cast' for unknown or missing actions (backward compat).
 */
export function actionLabels(action) {
    return ACTION_LABELS[action] || ACTION_LABELS.cast;
}

/**
 * Look at the word immediately before the bracket opening and return
 * the base action keyword if it matches, otherwise 'cast'.
 */
function detectActionKeyword(text, bracketIndex) {
    const before = text.slice(0, bracketIndex).trimEnd();
    const wordMatch = before.match(/(\w+)$/);
    if (!wordMatch) return 'cast';
    const word = wordMatch[1].toLowerCase();
    return ACTION_KEYWORD_MAP.get(word) || 'cast';
}

/**
 * Aggressively normalize a date string for comparison.
 * Strips all punctuation, ordinal suffixes, articles, and extra whitespace
 * so that minor LLM formatting differences don't cause false day-changes.
 * e.g. "Day 3, 15th of Mirtul — Year 1492" → "day 3 15 of mirtul year 1492"
 */
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    return dateStr
        .toLowerCase()
        .replace(/(\d+)(?:st|nd|rd|th)\b/g, '$1')
        .replace(/\b(?:the|a|an)\b/g, '')
        .replace(/[,.\-—–:;!?'"()[\]{}]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract day-significant tokens from a date string (numbers and key nouns).
 * Used as a secondary check: if the sorted token sets differ, the date changed.
 */
function dateDayTokens(dateStr) {
    if (!dateStr) return '';
    const norm = normalizeDate(dateStr);
    const tokens = norm.split(' ').filter(t => t.length > 0);
    return tokens.sort().join(' ');
}

const ORDINAL_WORDS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9,
};

/**
 * Parse a cast level from a bracket detail token.
 * Handles: "5th level", "level 5", "lv5", "3rd", "at 5th level", "third order", etc.
 * @returns {number|null} Spell slot level 1-9, or null if not a level token
 */
export function parseCastLevel(token) {
    if (!token || typeof token !== 'string') return null;
    let t = token.trim().toLowerCase();
    if (!t) return null;

    // Strip leading "at "
    t = t.replace(/^at\s+/, '');

    // "level 5", "lvl 5", "lv 5", "lv5"
    let m = t.match(/^(?:level|lvl|lv)\s*(\d{1,2})$/);
    if (m) {
        const n = parseInt(m[1], 10);
        return n >= 1 && n <= 9 ? n : null;
    }

    // "5th level", "5th", "3rd", "1st"
    m = t.match(/^(\d{1,2})(?:st|nd|rd|th)(?:\s+(?:level|order|slot))?$/);
    if (m) {
        const n = parseInt(m[1], 10);
        return n >= 1 && n <= 9 ? n : null;
    }

    // "fifth level", "third order"
    m = t.match(/^(\w+)(?:\s+(?:level|order|slot))?$/);
    if (m && ORDINAL_WORDS[m[1]] != null) {
        return ORDINAL_WORDS[m[1]];
    }

    return null;
}

/**
 * Scan detail tokens for cast level; return level and remaining extras.
 * @param {string[]} detailTokens - tokens after spell name
 * @returns {{ castLevel: number|null, extras: string }}
 */
export function parseCastLevelFromTokens(detailTokens) {
    const extras = [];
    let castLevel = null;
    for (const raw of detailTokens) {
        const token = raw.trim();
        if (!token) continue;
        if (castLevel == null) {
            const lvl = parseCastLevel(token);
            if (lvl != null) {
                castLevel = lvl;
                continue;
            }
        }
        extras.push(token);
    }
    return { castLevel, extras: extras.join(', ') };
}

/**
 * Extract spell casts from a user message.
 * Finds any [...] brackets. Format: [SpellName, Level, ...extras]
 * @returns {{ spell: string, details: string, castLevel: number|null, extras: string, action: string }[]}
 */
export function extractSpellCasts(text) {
    if (!text) return [];
    const results = [];
    BRACKET_REGEX.lastIndex = 0;
    let m;
    while ((m = BRACKET_REGEX.exec(text)) !== null) {
        const tokens = m[1].split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tokens.length === 0 || tokens[0].length < 2) continue;
        const spell = tokens[0];
        const detailTokens = tokens.slice(1);
        const { castLevel, extras } = parseCastLevelFromTokens(detailTokens);
        const details = detailTokens.join(', ');
        const action = detectActionKeyword(text, m.index);
        results.push({ spell, details, castLevel, extras, action });
    }
    return results;
}

/**
 * Trim entries to only those after the 2nd-to-last long rest.
 * Keeps everything from the current rest period plus one prior rest period,
 * regardless of date string formatting. Much more robust than date comparison.
 */
function trimToTwoLongRests(entries) {
    const restIndices = [];
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'rest') restIndices.push(i);
    }
    if (restIndices.length <= 1) return entries;
    const cutoff = restIndices[restIndices.length - 2];
    return entries.slice(cutoff);
}

/**
 * Build a unique key for an entry to support deduplication during merge.
 */
function entryKey(entry) {
    if (entry.type === 'cast') {
        const action = entry.action || 'cast';
        return `${action}|${entry.spell}|${entry.details || ''}|${entry.time || ''}|${entry.date || ''}|${entry.msgIndex ?? ''}`;
    }
    if (entry.type === 'short-rest' && entry.msgIndex != null) {
        return `short-rest|${entry.date || ''}|${entry.msgIndex}`;
    }
    return `${entry.type}|${entry.date || ''}`;
}

/** Max number of LLM (assistant) messages to look back through when scanning for spells. */
const SPELL_LOG_LOOKBACK = 50;

/**
 * Scan chat messages and return an array of parsed spell/rest entries.
 * Does NOT modify state or persist — purely a read operation.
 * @param {object} [options]
 * @param {boolean} [options.skipLastAssistant] - Exclude the last assistant message from the scan
 */
function scanChatForSpells({ skipLastAssistant = false } = {}) {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) return [];

    let lastAssistantIdx = -1;
    if (skipLastAssistant) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_user && !chat[i].is_system) {
                lastAssistantIdx = i;
                break;
            }
        }
    }

    let scanStart = 0;
    let llmCount = 0;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user && !chat[i].is_system) {
            llmCount++;
            if (llmCount >= SPELL_LOG_LOOKBACK) {
                scanStart = i;
                break;
            }
        }
    }

    const userName = context.name1 || 'User';
    const parsed = [];
    let lastDate = null;
    let lastDateNorm = null;
    let lastDateTokens = null;
    let lastTime = null;

    for (let i = 0; i < scanStart; i++) {
        const msg = chat[i];
        if (msg.is_system || msg.is_user) continue;
        const header = parseHeader(msg.mes);
        if (header?.date) {
            lastDate = header.date;
            lastDateNorm = normalizeDate(header.date);
            lastDateTokens = dateDayTokens(header.date);
        }
        if (header?.time) lastTime = header.time;
    }

    for (let i = scanStart; i < chat.length; i++) {
        const msg = chat[i];
        if (msg.is_system) continue;
        if (skipLastAssistant && i === lastAssistantIdx) continue;

        if (!msg.is_user) {
            const header = parseHeader(msg.mes);
            if (header?.date) {
                const newDate = header.date;
                const newDateNorm = normalizeDate(newDate);
                const newDateTokens = dateDayTokens(newDate);
                const dateChanged = lastDateNorm
                    && newDateNorm !== lastDateNorm
                    && newDateTokens !== lastDateTokens;
                if (dateChanged && autoLongRestEnabled) {
                    parsed.push({
                        type: 'rest',
                        date: newDate,
                        text: `${userName} full rested here recovering all spell slots.`,
                    });
                }
                lastDate = newDate;
                lastDateNorm = newDateNorm;
                lastDateTokens = newDateTokens;
            }
            if (header?.time) lastTime = header.time;
            continue;
        }

        if (SHORT_REST_REGEX.test(msg.mes)) {
            parsed.push({
                type: 'short-rest',
                time: lastTime,
                date: lastDate,
                text: `${userName} has short rested here for 1 hour.`,
                msgIndex: i,
            });
        }

        const casts = extractSpellCasts(msg.mes);
        for (const { spell, details, action } of casts) {
            parsed.push({
                type: 'cast',
                spell,
                action,
                details: details || '',
                time: lastTime,
                date: lastDate,
                msgIndex: i,
            });
        }
    }

    return parsed;
}

/**
 * Merge mode: scan chat and add only NEW entries not already in the stored spell log.
 * Existing entries (including those from truncated/older chat) are preserved.
 * Used by the top refresh button and automated events (MESSAGE_RECEIVED, etc.).
 * @param {object} [options]
 * @param {boolean} [options.skipLastAssistant] - Exclude the last assistant message from the scan
 */
export function refreshSpellLog({ skipLastAssistant = false } = {}) {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) return;

    const parsed = scanChatForSpells({ skipLastAssistant });

    const existingKeys = new Set();
    for (const entry of spellLog) {
        if (!entry._manual) {
            existingKeys.add(entryKey(entry));
        }
    }

    const newEntries = parsed.filter(e => !existingKeys.has(entryKey(e)));

    if (newEntries.length > 0) {
        const merged = [...spellLog, ...newEntries];
        const trimmed = trimToTwoLongRests(merged);
        setSpellLog(trimmed);
        saveSpellLog(trimmed);
    }
}

/**
 * Hard refresh: wipe the spell log and rebuild entirely from visible chat.
 * Preserves manually added entries (_manual flag).
 * Used by the spell log's own refresh button.
 */
export function hardRefreshSpellLog() {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) {
        const manualOnly = spellLog.filter(e => e._manual);
        setSpellLog(manualOnly);
        saveSpellLog(manualOnly);
        return;
    }

    const manualEntries = spellLog.filter(e => e._manual);
    const parsed = scanChatForSpells();
    parsed.push(...manualEntries);

    const trimmed = trimToTwoLongRests(parsed);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}

/**
 * Manually add a spell cast entry at the current header date/time.
 * @param {string} spellName
 */
export function addManualSpellCast(spellName) {
    if (!spellName) return;
    const context = getContext();

    let currentDate = null;
    let currentTime = null;
    const chat = context.chat;
    if (chat) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) continue;
            const header = parseHeader(chat[i].mes);
            if (header?.date) { currentDate = header.date; currentTime = header.time; break; }
        }
    }

    spellLog.push({
        type: 'cast',
        spell: spellName,
        time: currentTime,
        date: currentDate,
        msgIndex: null,
        _edited: true,
        _manual: true,
    });

    const trimmed = trimToTwoLongRests(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}

/**
 * Manually add a long rest entry at the current header date.
 */
export function addManualRest() {
    const context = getContext();
    const userName = context.name1 || 'User';

    let currentDate = null;
    const chat = context.chat;
    if (chat) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) continue;
            const header = parseHeader(chat[i].mes);
            if (header?.date) { currentDate = header.date; break; }
        }
    }

    spellLog.push({
        type: 'rest',
        date: currentDate,
        text: `${userName} full rested here recovering all spell slots.`,
        _edited: true,
        _manual: true,
    });

    const trimmed = trimToTwoLongRests(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}

/**
 * Manually add a short rest entry at the current header date/time.
 */
export function addManualShortRest() {
    const context = getContext();
    const userName = context.name1 || 'User';

    let currentDate = null;
    let currentTime = null;
    const chat = context.chat;
    if (chat) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) continue;
            const header = parseHeader(chat[i].mes);
            if (header?.date) {
                currentDate = header.date;
                currentTime = header.time;
                break;
            }
        }
    }

    spellLog.push({
        type: 'short-rest',
        time: currentTime,
        date: currentDate,
        text: `${userName} has short rested here for 1 hour.`,
        _edited: true,
        _manual: true,
    });

    const trimmed = trimToTwoLongRests(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}

/**
 * Manually add a dispel entry at the current header date/time.
 */
export function addManualDispel() {
    const context = getContext();
    const userName = context.name1 || 'User';

    let currentDate = null;
    let currentTime = null;
    const chat = context.chat;
    if (chat) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) continue;
            const header = parseHeader(chat[i].mes);
            if (header?.date) {
                currentDate = header.date;
                currentTime = header.time;
                break;
            }
        }
    }

    spellLog.push({
        type: 'dispel',
        time: currentTime,
        date: currentDate,
        text: `${userName} cleared and dispelled all own effects here.`,
        _edited: true,
        _manual: true,
    });

    const trimmed = trimToTwoLongRests(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}
