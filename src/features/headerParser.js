/**
 * D&D 5e Lite - Header Parser
 * Parses the status header from LLM messages:
 * [ 🕰️ Time HH:MM AM/PM | 🗓️ Date | 📍 Location | [WeatherEmoji] Weather | 🪄 1️⃣4/4 2️⃣3/3 | ⚡ 12/12 | 🔥 2/2 | 💰 150 gp / etc. ]
 * [ Additional tracker lines parsed as omni/extras ]
 *
 * Spell slots (🪄), sorcery points (⚡), and secondary class resources (🔥 — Innate Sorcery, Rage, etc.)
 * are parsed independently from the full header text, so section order does not matter.
 * Weather emoji is detected dynamically. Sections after known leaders become omni extras.
 * Additional [...] blocks following the main header are also captured as extras.
 */

import { getContext } from '../../../../../extensions.js';
import { setHeaderInfo } from '../core/state.js';
import { parseCurrencySection, extractCurrency, hasCurrencySignal, hasCurrency } from './currencyParser.js';

const KNOWN_LEADERS = /^(?:🕰️|🗓️|📍|🪄|⚡|🔥|💰|🪙)/u;

/**
 * Scan arbitrary text for per-level spell slot tokens (location-independent).
 * @param {string|null|undefined} text
 * @returns {Array<{ level: number, current: number, max: number }>|null}
 */
export function parseSpellSlotsFromText(text) {
    if (!text) return null;

    const slots = [];
    const levelRe = /([1-9])\uFE0F?\u20E3\s*(\d+)\/(\d+)/g;
    let lm;
    while ((lm = levelRe.exec(text)) !== null) {
        slots.push({
            level: parseInt(lm[1], 10),
            current: parseInt(lm[2], 10),
            max: parseInt(lm[3], 10),
        });
    }
    if (slots.length > 0) {
        slots.sort((a, b) => a.level - b.level);
        return slots;
    }

    const oldMatch = text.match(/Spell\s*Slots?\s*\((\d+)\/(\d+)\)/i);
    if (oldMatch) {
        return [{ level: 0, current: parseInt(oldMatch[1], 10), max: parseInt(oldMatch[2], 10) }];
    }

    return null;
}

/**
 * Scan arbitrary text for sorcery points ⚡ X/X (location-independent).
 * @param {string|null|undefined} text
 * @returns {{ current: number, max: number }|null}
 */
export function parseSorceryPointsFromText(text) {
    if (!text) return null;
    const m = text.match(/⚡\s*(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
}

/**
 * Scan arbitrary text for secondary class resources 🔥 X/X (Innate Sorcery, Rage, etc.).
 * @param {string|null|undefined} text
 * @returns {{ current: number, max: number }|null}
 */
export function parseSecondaryResourceFromText(text) {
    if (!text) return null;
    const m = text.match(/🔥\s*(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
}

/**
 * Extract the leading emoji from a string.
 */
function extractLeadingEmoji(str) {
    const m = str.match(/^(\p{Emoji_Presentation}(?:\uFE0F?\u200D\p{Emoji_Presentation})*\uFE0F?|\p{Extended_Pictographic}\uFE0F?)/u);
    return m ? m[0] : null;
}

/**
 * Collect all scannable header text (main block + trailing tracker blocks).
 */
function collectScannableHeaderText(text, headerMatch) {
    const parts = [];
    const raw = headerMatch[0].replace(/^\[\s*/, '').replace(/\s*\]$/, '');
    parts.push(raw);

    const afterIdx = headerMatch.index + headerMatch[0].length;
    const rest = text.substring(afterIdx, afterIdx + 500);
    const addRegex = /\[\s*([^\]]+)\]/g;
    let addMatch;
    while ((addMatch = addRegex.exec(rest)) !== null) {
        const content = addMatch[1].trim();
        if (/^🕰️/.test(content)) break;
        parts.push(content);
    }

    return parts.join(' | ');
}

function headerHasTrackableData(parsed) {
    return !!(
        parsed.time ||
        parsed.date ||
        parsed.location ||
        parsed.weather ||
        parsed.spellSlots ||
        parsed.sorceryPoints ||
        parsed.secondaryResource ||
        parsed.currency
    );
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
        secondaryResource: null,
        currency: null,
        extras: [],
    };

    // Parse main header sections (time, date, location, weather, currency leaders)
    const header = headerMatch[0];
    const raw = header.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
    const sections = raw.split('|').map(s => s.trim());

    for (const section of sections) {
        if (parseKnownSection(section, result)) continue;
        parseUnknownSection(section, result);
    }

    // Location-independent resource parsing across the full header + trailing blocks
    const scanText = collectScannableHeaderText(text, headerMatch);
    result.spellSlots = parseSpellSlotsFromText(scanText);
    result.sorceryPoints = parseSorceryPointsFromText(scanText);
    result.secondaryResource = parseSecondaryResourceFromText(scanText);

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

    delete result._weatherConfirmed;
    return result;
}

function parseKnownSection(section, result) {
    // Time: LLM may output transitional ranges like "🕰️ 02:58 PM → 07:47 PM"
    // or combat times with seconds like "🕰️ 02:58:18 PM".
    // We always take the last time token since it represents the final/current time.
    if (/^🕰️/.test(section)) {
        const timeTokens = [...section.matchAll(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/gi)];
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

    // Spell slots, sorcery points, and secondary resources are parsed globally — only mark section as known.
    if (/^🪄/.test(section)) return true;
    if (/^⚡/.test(section)) return true;
    if (/^🔥/.test(section)) return true;

    // Currency: 💰 or 🪙 leader — see currencyParser.js
    if (/^(?:💰|🪙)/u.test(section)) {
        const currency = parseCurrencySection(section);
        if (currency) {
            result.currency = currency;
            return true;
        }
        return true;
    }

    return false;
}

const TEMP_PATTERN = /°[CF]\b/i;

function parseUnknownSection(section, result) {
    if (KNOWN_LEADERS.test(section)) return;

    // Signal-based currency detection — no emoji leader required
    if (!result.currency && hasCurrencySignal(section)) {
        const currency = extractCurrency(section);
        if (hasCurrency(currency)) {
            result.currency = currency;
            return;
        }
    }

    const emoji = extractLeadingEmoji(section);
    const hasTemp = TEMP_PATTERN.test(section);

    if (hasTemp) {
        if (result.weather && !result._weatherConfirmed) {
            result.extras.push({ emoji: result.weatherEmoji || null, text: result.weather });
        }
        result.weatherEmoji = emoji || null;
        result.weather = emoji ? section.substring(emoji.length).trim() : section;
        result._weatherConfirmed = true;
        return;
    }

    if (emoji) {
        if (!result.weather) {
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
        if (parsed && headerHasTrackableData(parsed)) {
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
    if (parsed && headerHasTrackableData(parsed)) {
        setHeaderInfo(parsed);
        return parsed;
    }
    return null;
}
