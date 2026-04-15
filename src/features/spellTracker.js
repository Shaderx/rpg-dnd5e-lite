/**
 * D&D 5e Lite - Spell Tracker
 * Parses chat messages for "cast [Spell Name]" patterns and builds a chronological
 * spell log retained for the current RPG day + 1 day prior.
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
 * Given an array of all entries, trim to only the last 2 unique dates.
 */
function trimToTwoDays(entries) {
    const uniqueDates = [];
    for (const e of entries) {
        if (e.date && !uniqueDates.includes(e.date)) {
            uniqueDates.push(e.date);
        }
    }
    if (uniqueDates.length <= 2) return entries;
    const keep = new Set(uniqueDates.slice(-2));
    return entries.filter(e => keep.has(e.date));
}

/**
 * Build a unique key for a cast entry to support deduplication against manual edits.
 */
function castKey(entry) {
    return `${entry.spell}|${entry.time || ''}|${entry.date || ''}|${entry.msgIndex ?? ''}`;
}

/**
 * Full chat scan: rebuild the spell log from all messages, preserving manual edits.
 * AI messages provide the running date/time via header parsing.
 * User messages are scanned for "cast [Spell Name]" patterns.
 */
export function refreshSpellLog() {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) {
        setSpellLog([]);
        saveSpellLog([]);
        return;
    }

    const userName = context.name1 || 'User';
    const parsed = [];
    let lastDate = null;
    let lastTime = null;

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        if (msg.is_system) continue;

        // AI messages: update the running date/time from header, check for day change
        if (!msg.is_user) {
            const header = parseHeader(msg.mes);
            if (header?.date) {
                const newDate = header.date;
                if (lastDate && newDate !== lastDate) {
                    parsed.push({
                        type: 'rest',
                        date: newDate,
                        text: `${userName} full rested here recovering all spell slots.`,
                    });
                }
                lastDate = newDate;
            }
            if (header?.time) lastTime = header.time;
            continue;
        }

        // User messages: scan for spell casts, tagged with the most recent AI date/time
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

    const trimmed = trimToTwoDays(parsed);

    // Preserve manual edits: match existing entries by key and keep edited text
    const oldByKey = new Map();
    for (const entry of spellLog) {
        if (entry.type === 'cast') {
            oldByKey.set(castKey(entry), entry);
        }
    }

    for (const entry of trimmed) {
        if (entry.type === 'cast') {
            const old = oldByKey.get(castKey(entry));
            if (old && old._edited) {
                entry.spell = old.spell;
                entry._edited = true;
            }
        }
    }

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
    });

    const trimmed = trimToTwoDays(spellLog);
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
    });

    const trimmed = trimToTwoDays(spellLog);
    setSpellLog(trimmed);
    saveSpellLog(trimmed);
}
