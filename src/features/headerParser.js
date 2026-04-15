/**
 * D&D 5e Lite - Header Parser
 * Parses the status header from LLM messages:
 * [ 🕰️ Time HH:MM AM/PM | 🗓️ Date | 📍 Location | [WeatherEmoji] Weather | 🪄 Spell Slot (X/X) | 💰 G🟡S⚪C🟤 ]
 * [ Additional tracker lines parsed as omni/extras ]
 *
 * Weather emoji is detected dynamically. Sections after known leaders become omni extras.
 * Additional [...] blocks following the main header are also captured as extras.
 */

import { getContext } from '../../../../../extensions.js';
import { setHeaderInfo } from '../core/state.js';

const KNOWN_LEADERS = /^(?:🕰️|🗓️|📍|🪄|💰)/u;

/**
 * Extract the leading emoji from a string.
 */
function extractLeadingEmoji(str) {
    const m = str.match(/^(\p{Emoji_Presentation}(?:\uFE0F?\u200D\p{Emoji_Presentation})*\uFE0F?|\p{Extended_Pictographic}\uFE0F?)/u);
    return m ? m[0] : null;
}

/**
 * Parse header info from a message string.
 */
export function parseHeader(text) {
    if (!text) return null;

    const headerMatch = text.match(/\[\s*🕰️[^\]]+\]/s);
    if (!headerMatch) return null;

    const result = {
        time: null,
        date: null,
        location: null,
        weather: null,
        weatherEmoji: null,
        spellSlots: null,
        currency: null,
        extras: []
    };

    // Parse main header sections
    const header = headerMatch[0];
    const raw = header.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
    const sections = raw.split('|').map(s => s.trim());

    for (const section of sections) {
        if (parseKnownSection(section, result)) continue;
        parseUnknownSection(section, result);
    }

    // Look for additional [...] blocks immediately after the main header
    const afterIdx = headerMatch.index + headerMatch[0].length;
    const rest = text.substring(afterIdx, afterIdx + 500);
    const addRegex = /\[\s*([^\]]+)\]/g;
    let addMatch;
    while ((addMatch = addRegex.exec(rest)) !== null) {
        const content = addMatch[1].trim();
        if (/^🕰️/.test(content)) break;
        const addSections = content.split('|').map(s => s.trim());
        for (const section of addSections) {
            const emoji = extractLeadingEmoji(section);
            if (emoji) {
                result.extras.push({ emoji, text: section.substring(emoji.length).trim() });
            } else if (section.length > 0) {
                result.extras.push({ emoji: null, text: section });
            }
        }
    }

    return result;
}

function parseKnownSection(section, result) {
    // Time: handles both "🕰️ Time 10:30 AM" and "🕰️ 10:30 AM"
    const timeMatch = section.match(/🕰️\s*(?:Time\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (timeMatch) { result.time = timeMatch[1].trim(); return true; }

    // Date
    const dateMatch = section.match(/🗓️\s*(.*)/);
    if (dateMatch) { result.date = dateMatch[1].trim(); return true; }

    // Location
    const locationMatch = section.match(/📍\s*(.*)/);
    if (locationMatch) { result.location = locationMatch[1].trim(); return true; }

    // Spell slots: per-level "🪄 1️⃣4/4 2️⃣3/3 ..." or legacy "🪄 Spell Slot (X/X)"
    if (/^🪄/.test(section)) {
        const slots = [];
        const levelRe = /([1-9])\uFE0F?\u20E3\s*(\d+)\/(\d+)/g;
        let lm;
        while ((lm = levelRe.exec(section)) !== null) {
            slots.push({ level: parseInt(lm[1]), current: parseInt(lm[2]), max: parseInt(lm[3]) });
        }
        if (slots.length > 0) {
            slots.sort((a, b) => a.level - b.level);
            result.spellSlots = slots;
            return true;
        }
        const oldMatch = section.match(/Spell\s*Slots?\s*\((\d+)\/(\d+)\)/i);
        if (oldMatch) {
            result.spellSlots = [{ level: 0, current: parseInt(oldMatch[1]), max: parseInt(oldMatch[2]) }];
            return true;
        }
        return true;
    }

    // Currency: handles "💰 12 Gold🟡45 Silver⚪30 Copper🟤", "💰 12🟡45⚪30🟤", etc.
    const currencyMatch = section.match(/💰\D*?(\d+)\D*?🟡\D*?(\d+)\D*?⚪\D*?(\d+)\D*?🟤/);
    if (currencyMatch) {
        result.currency = {
            gold: parseInt(currencyMatch[1]),
            silver: parseInt(currencyMatch[2]),
            copper: parseInt(currencyMatch[3])
        };
        return true;
    }

    return false;
}

function parseUnknownSection(section, result) {
    if (KNOWN_LEADERS.test(section)) return;

    const emoji = extractLeadingEmoji(section);
    if (emoji) {
        if (!result.weather && !result.weatherEmoji) {
            result.weatherEmoji = emoji;
            result.weather = section.substring(emoji.length).trim();
        } else {
            result.extras.push({ emoji, text: section.substring(emoji.length).trim() });
        }
    } else if (section.length > 0) {
        if (!result.weather) {
            result.weather = section;
        } else {
            result.extras.push({ emoji: null, text: section });
        }
    }
}

/**
 * Scan chat for the latest header and update state.
 */
export function refreshHeaderFromChat() {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) return null;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (msg.is_user) continue;

        const parsed = parseHeader(msg.mes);
        if (parsed && (parsed.time || parsed.date || parsed.location || parsed.weather || parsed.spellSlots || parsed.currency)) {
            setHeaderInfo(parsed);
            return parsed;
        }
    }

    return null;
}

/**
 * Parse header from the latest assistant message (for auto-update).
 */
export function updateHeaderFromMessage(messageText) {
    const parsed = parseHeader(messageText);
    if (parsed && (parsed.time || parsed.date || parsed.location || parsed.weather || parsed.spellSlots || parsed.currency)) {
        setHeaderInfo(parsed);
        return parsed;
    }
    return null;
}
