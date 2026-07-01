/**
 * Shared spell scaling utilities: dice math, upcast tables, cantrip range/beams.
 */

export const CANTRIP_BREAKPOINTS = [1, 5, 11, 17];

/**
 * Parse NdM from a dice string (ignores flat modifiers after dice).
 * @returns {{ count: number, sides: number }|null}
 */
export function parseDiceExpr(diceStr) {
    if (!diceStr) return null;
    const m = String(diceStr).trim().match(/(\d+)d(\d+)/i);
    if (!m) return null;
    return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10) };
}

/** Format dice object as NdM */
export function formatDiceExpr({ count, sides }) {
    return `${count}d${sides}`;
}

/** Add increment dice to base (same sides only). */
export function addDiceToBase(baseDice, incrementDice, levelsAbove) {
    const base = parseDiceExpr(baseDice);
    const inc = parseDiceExpr(incrementDice);
    if (!base || !inc || base.sides !== inc.sides) return baseDice;
    return formatDiceExpr({ count: base.count + inc.count * levelsAbove, sides: base.sides });
}

/**
 * Build precalculated damage/heal per slot level (base .. 9).
 * @param {string|null} baseDice
 * @param {string|null} healDice
 * @param {{ dice: string, aboveLevel: number, perLevel?: number }|null} upcastInfo
 * @param {number} spellLevel - native spell level
 * @param {number} [maxSlot=9]
 */
export function buildUpcastTable(baseDice, healDice, upcastInfo, spellLevel, maxSlot = 9) {
    const table = {};
    const diceKey = baseDice || healDice;
    if (!diceKey) return table;

    const start = Math.max(1, spellLevel);
    for (let slot = start; slot <= maxSlot; slot++) {
        const levelsAbove = Math.max(0, slot - (upcastInfo?.aboveLevel ?? spellLevel));
        if (levelsAbove === 0 || !upcastInfo?.dice) {
            if (baseDice) table[slot] = { dice: baseDice, healDice: healDice || null };
            else if (healDice) table[slot] = { dice: null, healDice };
        } else {
            const scaled = addDiceToBase(diceKey, upcastInfo.dice, levelsAbove);
            if (baseDice && healDice) {
                table[slot] = { dice: scaled, healDice: scaled };
            } else if (healDice) {
                table[slot] = { dice: null, healDice: scaled };
            } else {
                table[slot] = { dice: scaled, healDice: null };
            }
        }
    }
    return table;
}

/**
 * Parse upcast dice scaling from entriesHigherLevel.
 * Handles {@damage}, {@dice}, {@scaledice}, and {@scaledamage} tags.
 */
export function parseUpcastInfo(entries, spellLevel = 1) {
    if (!entries || !Array.isArray(entries)) return null;

    for (const entry of entries) {
        const text = entryToPlain(entry);

        // {@scaledice NdM|range|NdM} or {@scaledamage NdM|range|NdM} — extract increment dice
        const scaledMatch = text.match(/\{@scale(?:dice|damage)\s+(\d+d\d+)\|[^}]*\}.*?(?:each|every|per)\s+(?:(?:spell\s+)?slot\s+)?level\s+above\s+(\d+)/i);
        if (scaledMatch) {
            return { dice: scaledMatch[1], aboveLevel: parseInt(scaledMatch[2], 10) || spellLevel };
        }

        // {@scaledice NdM|range|NdM} with "increases by" phrasing (no "above N" anchor)
        const scaledIncMatch = text.match(/increases?\s+by\s+\{@scale(?:dice|damage)\s+(\d+d\d+)\|[^}]*\}/i);
        if (scaledIncMatch) {
            return { dice: scaledIncMatch[1], aboveLevel: spellLevel };
        }

        // {@damage NdM} or {@dice NdM} ... each/every level above N
        const diceMatch = text.match(/\{@(?:damage|dice)\s+(\d+d\d+)\}.*?(?:each|every)\s+(?:(?:spell\s+)?slot\s+)?level\s+above\s+(\d+)/i);
        if (diceMatch) {
            return { dice: diceMatch[1], aboveLevel: parseInt(diceMatch[2], 10) || spellLevel };
        }

        // "increases by {@damage NdM}" or "increases by {@dice NdM}"
        const incMatch = text.match(/increases?\s+by\s+\{@(?:damage|dice)\s+(\d+d\d+)\}/i);
        if (incMatch) {
            return { dice: incMatch[1], aboveLevel: spellLevel };
        }

        // Plain text: "NdM damage/hit points ... per/for each level"
        const perLevelMatch = text.match(/(\d+d\d+)\s+(?:damage|hit points).*?(?:per|for)\s+(?:each|every)\s+(?:slot\s+)?level/i);
        if (perLevelMatch) {
            return { dice: perLevelMatch[1], aboveLevel: spellLevel };
        }
    }
    return null;
}

/**
 * Non-dice upcast effects (extra targets, duration, etc.)
 * Excludes entries that are purely about dice scaling per level.
 */
export function parseUpcastExtra(entries) {
    if (!entries || !Array.isArray(entries)) return null;
    const parts = [];
    for (const entry of entries) {
        const rawText = entryToPlain(entry);
        if (!rawText) continue;
        // Check for dice scaling patterns BEFORE stripping tags
        if (/\{@(?:damage|dice|scale(?:dice|damage))/i.test(rawText) && /level\s+above/i.test(rawText)) continue;
        if (/increases?\s+by\s+\{@(?:damage|dice|scale(?:dice|damage))/i.test(rawText)) continue;
        const text = stripTags(rawText);
        if (!text) continue;
        parts.push(text);
    }
    return parts.length > 0 ? parts.join(' ') : null;
}

function entryToPlain(entry) {
    if (typeof entry === 'string') return entry;
    if (entry?.entries) return entry.entries.map(e => typeof e === 'string' ? e : entryToPlain(e)).join(' ');
    return '';
}

/** Flatten spell entries + cantrip upgrade / higher-level text for scaling parsers. */
export function collectSpellScalingText(spell) {
    if (!spell) return '';
    const parts = [];
    for (const block of [spell.entries, spell.entriesHigherLevel]) {
        if (!block) continue;
        for (const entry of block) {
            const text = entryToPlain(entry);
            if (text) parts.push(text);
        }
    }
    return parts.join(' ');
}

/**
 * Whether the spell's {@damage} tag represents primary damage dealt by casting,
 * as opposed to secondary/environmental damage (e.g. Web's "burn webs" clause).
 * Primary damage appears in the first entries; secondary appears only late.
 */
export function hasPrimaryDamage(spell) {
    const entries = spell?.entries;
    if (!entries?.length) return false;
    const threshold = Math.max(2, Math.ceil(entries.length / 2));
    for (let i = 0; i < threshold; i++) {
        const text = entryToPlain(entries[i]);
        if (text && /\{@damage\s+[^}]+\}/.test(text)) return true;
    }
    return false;
}

/**
 * Spells where the caster picks damage type (e.g. Sorcerous Burst).
 * Do not annotate a default element from damageInflict[0].
 */
export function isPlayerChosenDamageType(spell, entriesStr) {
    const types = spell?.damageInflict || [];
    if (types.length > 1) return true;
    return /type\s+you\s+choose|damage\s+type\s+of\s+your\s+choice|choose\s+(?:a|one)\s+damage\s+type/i.test(entriesStr || '');
}

/** One-line combat stats at character level (for tooltips). */
export function formatAtLevelStats(info) {
    if (!info) return '';
    const parts = [];
    const dice = info.atCastLevel?.dice ?? info.dice;
    const healDice = info.atCastLevel?.healDice ?? info.healDice;

    if (info.isHealing && healDice) parts.push(`Heal ${healDice}`);
    else if (dice) parts.push(`Damage: ${dice}${!info.omitDamageType && info.type ? ' ' + info.type : ''}`);

    if (info.savingThrow) parts.push(`${info.savingThrow.substring(0, 3).toUpperCase()} save`);
    else if (info.spellAttack) parts.push(info.spellAttack === 'R' ? 'ranged atk' : 'melee atk');

    if (info.range && info.baseRange && info.range !== info.baseRange) {
        parts.push(`Range: ${info.range} (base ${info.baseRange})`);
    }
    if (info.beamCount > 1) parts.push(`Beams: ${info.beamCount}`);
    if (info.upcastInfo && !info.castLevel) {
        parts.push(`+${info.upcastInfo.dice}/slot above ${ordinal(info.upcastInfo.aboveLevel)}`);
    }

    return parts.length > 0 ? `At your level: ${parts.join(' | ')}` : '';
}

function stripTags(str) {
    if (!str) return '';
    return str.replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

/** Format spell.range from 5etools JSON */
export function formatSpellRange(range) {
    if (!range) return null;
    if (range.type === 'point') {
        const d = range.distance;
        if (!d || d.type === 'self') return 'Self';
        if (d.type === 'touch') return 'Touch';
        return `${d.amount} ${d.type}`;
    }
    if (range.type === 'special') return 'Special';
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'cone' || range.type === 'line') {
        const d = range.distance;
        if (d?.amount) return `${d.amount} ${d.type} ${range.type}`;
    }
    return null;
}

/**
 * Cantrip range scaling from entries text (e.g. Spare the Dying).
 * Patterns: "range increases to 30 feet when you reach 5th level"
 */
export function parseCantripRangeScaling(entriesStr, characterLevel, baseRange) {
    if (!entriesStr) return baseRange;

    const breakpoints = [];
    const re = /(?:range\s+(?:increases?|becomes?|is)\s+)(\d+)\s*(?:feet|ft)[^.]*?(?:reach|at)\s+(\d+)(?:st|nd|rd|th)?\s+level/gi;
    let m;
    while ((m = re.exec(entriesStr)) !== null) {
        breakpoints.push({ level: parseInt(m[2], 10), range: `${m[1]} feet` });
    }

    const slashRe = /range\s+(?:increases?|becomes?)\s+to\s+(\d+)\s*\/\s*(\d+)\s*feet\s+when\s+you\s+reach\s+(\d+)(?:st|nd|rd|th)?\s+and\s+(\d+)(?:st|nd|rd|th)?\s+level/i;
    const slash = entriesStr.match(slashRe);
    if (slash) {
        breakpoints.push({ level: parseInt(slash[3], 10), range: `${slash[1]} feet` });
        breakpoints.push({ level: parseInt(slash[4], 10), range: `${slash[2]} feet` });
    }

    // "range doubles when you reach levels 5 (30 feet), 11 (60 feet), and 17 (120 feet)"
    if (/range\s+doubles?/i.test(entriesStr)) {
        for (const m of entriesStr.matchAll(/(\d+)\s*\((\d+)\s*feet\)/gi)) {
            breakpoints.push({ level: parseInt(m[1], 10), range: `${m[2]} feet` });
        }
    }

    breakpoints.sort((a, b) => a.level - b.level);
    let result = baseRange;
    for (const bp of breakpoints) {
        if (characterLevel >= bp.level) result = bp.range;
    }
    return result;
}

/**
 * Multi-beam cantrips (Eldritch Blast): beams at 1/5/11/17.
 */
export function parseBeamCount(entriesStr, characterLevel) {
    if (!entriesStr) return 1;
    if (!/beam/i.test(entriesStr)) return 1;

    const table = [{ level: 1, beams: 1 }];
    const re = /(\d+)\s+beams?\s+at\s+(\d+)(?:st|nd|rd|th)?\s+level/gi;
    let m;
    while ((m = re.exec(entriesStr)) !== null) {
        table.push({ level: parseInt(m[2], 10), beams: parseInt(m[1], 10) });
    }

    const createsRe = /creates?\s+(\d+)\s+beams?.*?(\d+)(?:st|nd|rd|th)?\s+level.*?(\d+)\s+beams?.*?(\d+)(?:st|nd|rd|th)?\s+level.*?(\d+)\s+beams?.*?(\d+)(?:st|nd|rd|th)?/i;
    const creates = entriesStr.match(createsRe);
    if (creates) {
        table.push({ level: parseInt(creates[2], 10), beams: parseInt(creates[1], 10) });
        table.push({ level: parseInt(creates[4], 10), beams: parseInt(creates[3], 10) });
        table.push({ level: parseInt(creates[6], 10), beams: parseInt(creates[5], 10) });
    }

    table.sort((a, b) => a.level - b.level);
    let beams = 1;
    for (const row of table) {
        if (characterLevel >= row.level) beams = row.beams;
    }
    return beams;
}

/**
 * Resolve damage/heal at a specific cast level from upcast table.
 */
export function getStatsAtCastLevel(info, castLevel) {
    if (!info?.upcastTable || castLevel == null) {
        return { dice: info?.dice, healDice: info?.healDice };
    }
    const row = info.upcastTable[castLevel];
    if (!row) return { dice: info.dice, healDice: info.healDice };
    return { dice: row.dice || info.dice, healDice: row.healDice || info.healDice };
}

export function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
