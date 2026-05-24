/**
 * D&D 5e Lite - Header Parser
 * Parses the status header from LLM messages:
 * [ 🕰️ Time HH:MM AM/PM | 🗓️ Date | 📍 Location | [WeatherEmoji] Weather | 🪄 Spell Slot (X/X) | ⚡ Sorcery Points (X/X) | 💰 150 gp / 12🟡45⚪30🟤 / etc. ]
 * [ Additional tracker lines parsed as omni/extras ]
 *
 * Weather emoji is detected dynamically. Sections after known leaders become omni extras.
 * Additional [...] blocks following the main header are also captured as extras.
 */

import { getContext } from '../../../../../extensions.js';
import { setHeaderInfo } from '../core/state.js';
import { parseCurrencySection } from './currencyParser.js';

const KNOWN_LEADERS = /^(?:🕰️|🗓️|📍|🪄|⚡|💰)/u;

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
        sorceryPoints: null,
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
        const firstSection = content.split('|')[0].trim();
        if (!extractLeadingEmoji(firstSection)) continue;
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
    // Time: LLM may output transitional ranges like "🕰️ 02:58 PM → 07:47 PM".
    // We always take the last time token since it represents the final/current time.
    if (/^🕰️/.test(section)) {
        const timeTokens = [...section.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi)];
        if (timeTokens.length > 0) {
            result.time = timeTokens[timeTokens.length - 1][1].trim();
            return true;
        }
    }

    // Date
    const dateMatch = section.match(/🗓️\s*(.*)/);
    if (dateMatch) { result.date = dateMatch[1].trim(); return true; }

    // Location
    const locationMatch = section.match(/📍\s*(.*)/);
    if (locationMatch) { result.location = locationMatch[1].trim(); return true; }

    // Spell slots: per-level "🪄 1️⃣4/4 2️⃣3/3 ... ⚡12/12" or legacy "🪄 Spell Slot (X/X)"
    if (/^🪄/.test(section)) {
        const slots = [];
        const levelRe = /([1-9])\uFE0F?\u20E3\s*(\d+)\/(\d+)/g;
        let lm;
        while ((lm = levelRe.exec(section)) !== null) {
            slots.push({ level: parseInt(lm[1]), current: parseInt(lm[2]), max: parseInt(lm[3]) });
        }
        // Sorcery points: ⚡XX/XX
        const sorceryMatch = section.match(/⚡\s*(\d+)\s*\/\s*(\d+)/);
        if (sorceryMatch) {
            result.sorceryPoints = { current: parseInt(sorceryMatch[1]), max: parseInt(sorceryMatch[2]) };
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

    // Sorcery points: standalone ⚡ section "⚡ 12/12"
    if (/^⚡/.test(section)) {
        const sorceryMatch = section.match(/⚡\s*(\d+)\s*\/\s*(\d+)/);
        if (sorceryMatch) {
            result.sorceryPoints = { current: parseInt(sorceryMatch[1]), max: parseInt(sorceryMatch[2]) };
            return true;
        }
        return true;
    }

    // Currency: gp/sp/cp, emoji coins, platinum/electrum, bare amounts — see currencyParser.js
    if (/^💰/.test(section)) {
        const currency = parseCurrencySection(section);
        if (currency) {
            result.currency = currency;
            return true;
        }
        return true; // 💰 section present but unparseable — still a known leader
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
 * @param {object} [options]
 * @param {boolean} [options.skipLastAssistant] - Skip the last assistant message
 *        (used during swipe so the header reverts to the state before the reply being regenerated).
 */
export function refreshHeaderFromChat({ skipLastAssistant = false } = {}) {
    const context = getContext();
    const chat = context.chat;
    if (!chat || chat.length === 0) return null;

    let skippedOne = false;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (msg.is_user) continue;

        if (skipLastAssistant && !skippedOne) {
            skippedOne = true;
            continue;
        }

        const parsed = parseHeader(msg.mes);
        if (parsed && (parsed.time || parsed.date || parsed.location || parsed.weather || parsed.spellSlots || parsed.sorceryPoints || parsed.currency)) {
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
    if (parsed && (parsed.time || parsed.date || parsed.location || parsed.weather || parsed.spellSlots || parsed.sorceryPoints || parsed.currency)) {
        setHeaderInfo(parsed);
        return parsed;
    }
    return null;
}
