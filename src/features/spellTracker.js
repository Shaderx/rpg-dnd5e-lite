/**
 * D&D 5e Lite - Spell Tracker
 * Parses chat messages for "cast [Spell Name]" patterns and builds a chronological
 * spell log. Scans the last 50 LLM messages and retains entries from the last 2
 * long-rest periods.
 */

import { getContext } from '../../../../../extensions.js';
import { spellLog, setSpellLog } from '../core/state.js';
import { saveSpellLog, loadSpellLog } from '../core/persistence.js';
import { parseHeader } from './headerParser.js';

// Bracketed form: "cast [Fireball]", "casts [Healing Word, Shield]" — captures full bracket content
const CAST_BRACKET_REGEX = /cast(?:s|ed|ing)?\s*\[([^\]]+)\]/gi;
// Unbracketed form: "cast Fireball", "casts Shield" — captures the first word after cast
const CAST_BARE_REGEX = /cast(?:s|ed|ing)?\s+([A-Z][a-zA-Z''-]*)/g;

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

/**
 * Extract all spell names from a message body.
 * Bracketed [...] captures everything inside. Bare (no brackets) captures the first word.
 * @returns {string[]} Array of spell names found
 */
function extractSpellCasts(text) {
    if (!text) return [];
    const spells = [];
    const usedRanges = [];

    // Pass 1: bracketed casts (higher priority, captures full content)
    CAST_BRACKET_REGEX.lastIndex = 0;
    let m;
    while ((m = CAST_BRACKET_REGEX.exec(text)) !== null) {
        const name = m[1].trim();
        if (name) {
            spells.push(name);
            usedRanges.push([m.index, m.index + m[0].length]);
        }
    }

    // Pass 2: bare casts — skip any that overlap with a bracketed match
    CAST_BARE_REGEX.lastIndex = 0;
    while ((m = CAST_BARE_REGEX.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        const overlaps = usedRanges.some(([rs, re]) => start < re && end > rs);
        if (overlaps) continue;
        const name = m[1].trim();
        if (name) spells.push(name);
    }

    return spells;
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
        return `cast|${entry.spell}|${entry.time || ''}|${entry.date || ''}|${entry.msgIndex ?? ''}`;
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
                if (dateChanged) {
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

        const spells = extractSpellCasts(msg.mes);
        for (const spell of spells) {
            parsed.push({
                type: 'cast',
                spell,
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
    const userName = context.name1 || 'User';

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
 * Manually add a short rest entry at the current header date.
 */
export function addManualShortRest() {
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
        type: 'short-rest',
        date: currentDate,
        text: `${userName} short rested here restoring half of sorcery points.`,
        _edited: true,
        _manual: true,
    });

    const trimmed = trimToTwoLongRests(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}
