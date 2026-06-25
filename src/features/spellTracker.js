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
 * Parse a time string into minutes-since-midnight for comparison.
 * Handles "HH:MM AM/PM", "HH:MM", and 24-hour formats.
 * @returns {number} Minutes since midnight, or -1 if unparseable
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return -1;
    const m = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!m) return -1;
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const period = m[4]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

/**
 * Insert manual entries into a chronologically-ordered scanned array at the
 * correct position based on their date and time fields.
 * Entries with the same date are ordered by time; entries with the same
 * date+time are placed after the last scanned entry at that point.
 * @param {Array} scanned - Chronologically ordered entries from scanChatForSpells (mutated)
 * @param {Array} manual - Manual entries to interleave
 */
function interleaveManualEntries(scanned, manual) {
    if (!manual.length) return;

    for (const entry of manual) {
        const entryDateNorm = normalizeDate(entry.date);
        const entryTime = timeToMinutes(entry.time);
        let insertAt = scanned.length;

        for (let i = scanned.length - 1; i >= 0; i--) {
            const sDateNorm = normalizeDate(scanned[i].date);
            if (sDateNorm !== entryDateNorm) {
                if (insertAt < scanned.length) break;
                continue;
            }
            const sTime = timeToMinutes(scanned[i].time);
            if (entryTime >= 0 && sTime >= 0 && sTime <= entryTime) {
                insertAt = i + 1;
                break;
            }
            insertAt = i;
        }

        scanned.splice(insertAt, 0, entry);
    }
}

/**
 * Scan ALL chat messages and return an array of parsed spell/rest entries.
 * Includes hidden messages (is_system) so casts survive ST summarization.
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
            if (!chat[i].is_user) {
                lastAssistantIdx = i;
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

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
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

        let useTime = lastTime;
        let useDate = lastDate;
        for (let j = i + 1; j < chat.length; j++) {
            if (skipLastAssistant && j === lastAssistantIdx) continue;
            const nextMsg = chat[j];
            if (nextMsg.is_user) continue;
            const nextHeader = parseHeader(nextMsg.mes);
            if (nextHeader?.time) useTime = nextHeader.time;
            if (nextHeader?.date) useDate = nextHeader.date;
            break;
        }

        const casts = extractSpellCasts(msg.mes);
        for (const { spell, details, action } of casts) {
            parsed.push({
                type: 'cast',
                spell,
                action,
                details: details || '',
                time: useTime,
                date: useDate,
                msgIndex: i,
            });
        }

        if (SHORT_REST_REGEX.test(msg.mes)) {
            parsed.push({
                type: 'short-rest',
                time: useTime,
                date: useDate,
                text: `${userName} has short rested here for 1 hour.`,
                msgIndex: i,
            });
        }
    }

    return parsed;
}

/**
 * Rebuild the spell log from the full chat history.
 * Preserves manually added entries (_manual flag).
 * Used by automated events (MESSAGE_RECEIVED, swipes, etc.) and UI refresh.
 * @param {object} [options]
 * @param {boolean} [options.skipLastAssistant] - Exclude the last assistant message from the scan
 */
export function refreshSpellLog({ skipLastAssistant = false } = {}) {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) {
        const manualOnly = spellLog.filter(e => e._manual);
        setSpellLog(manualOnly);
        saveSpellLog(manualOnly);
        return;
    }

    const manualEntries = spellLog.filter(e => e._manual);
    const parsed = scanChatForSpells({ skipLastAssistant });
    interleaveManualEntries(parsed, manualEntries);

    const trimmed = trimToTwoLongRests(parsed);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}

/**
 * Hard refresh: rebuild spell log from the full chat history.
 * Preserves manually added entries (_manual flag).
 * Used by the spell log's own refresh button.
 */
export function hardRefreshSpellLog() {
    refreshSpellLog();
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
