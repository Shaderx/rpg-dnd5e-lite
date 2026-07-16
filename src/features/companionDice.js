/**
 * Pure companion/sidekick combat-roll specification helpers.
 *
 * This module deliberately does not read runtime state or roll random values.
 * Callers provide already-computed stat blocks and the synchronous spell lookup.
 */

export const COMPANION_DIE_SIDES = [4, 6, 8, 10, 12];
const MAX_ATTACK_SETS = 8;

const NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8,
};

function clampAttackCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(MAX_ATTACK_SETS, Math.max(1, Math.trunc(parsed)));
}

function numberToken(token) {
    if (!token) return null;
    const normalized = String(token).toLowerCase();
    if (/^\d+$/.test(normalized)) return Number(normalized);
    return NUMBER_WORDS[normalized] ?? null;
}

function recordText(record) {
    if (!record) return '';
    return [record.name, record.text, record.desc, record.computedText, record.origDamage,
        record.computedDamage, record.damageDice, record.damage, record.special]
        .filter(Boolean).join(' ');
}

function recordAttackCountText(record) {
    if (!record) return '';
    // computedText is normally a rewritten copy of text. Reading both makes
    // enumerated Multiattack clauses appear twice on older saved sidekicks.
    const primary = record.text || record.desc || record.computedText || record.special || '';
    return [record.name, primary].filter(Boolean).join(' ');
}

function recordDiceText(record) {
    if (!record) return '';
    // Computed text retains secondary dice (poison, healing, riders) without
    // counting the same primary expression again from orig/computed fields.
    return record.computedText || record.text || record.desc
        || record.computedDamage || record.damage || record.damageDice || record.origDamage || '';
}

/** Parse common 5e Multiattack count wording. */
export function parseMultiattackCount(input) {
    const text = typeof input === 'string' ? input : recordAttackCountText(input);
    if (!text || !/multiattack|makes?\s+.+attacks?|attacks?\s+(?:twice|thrice)/i.test(text)) return 1;

    const tokenPattern = '(\\d+|one|two|three|four|five|six|seven|eight)';
    const explicitTotal = text.match(new RegExp(
        `makes?\\s+(?:up\\s+to\\s+)?${tokenPattern}\\s+(?:(?:melee|ranged|weapon|spell)\\s+)*attacks?`,
        'i',
    ));
    if (explicitTotal) return clampAttackCount(numberToken(explicitTotal[1]));

    // Some stat blocks enumerate the sequence instead of stating its total,
    // e.g. "makes two Claw attacks and one Bite attack." Sum those clauses.
    const makesIndex = text.search(/makes?\s+/i);
    if (makesIndex >= 0) {
        const clauseText = text.slice(makesIndex);
        const clausePattern = new RegExp(
            `${tokenPattern}\\s+(?:(?:with\\s+its?\\s+)?[a-z][a-z'’-]*\\s+){1,4}attacks?\\b`,
            'gi',
        );
        let total = 0;
        let clause;
        while ((clause = clausePattern.exec(clauseText)) !== null) {
            total += numberToken(clause[1]) || 0;
        }
        if (total > 0) return clampAttackCount(total);
    }

    const patterns = [
        new RegExp(`(?:can\\s+)?attacks?\\s+${tokenPattern}\\s+times?`, 'i'),
        /attacks?\s+(twice|thrice)/i,
        new RegExp(`multiattack[^.]*?${tokenPattern}\\s+attacks?`, 'i'),
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const value = match[1]?.toLowerCase() === 'twice' ? 2
            : match[1]?.toLowerCase() === 'thrice' ? 3
                : numberToken(match[1]);
        if (value != null) return clampAttackCount(value);
    }
    return 1;
}

export function emptyDiceProfile() {
    return {};
}

/** Parse every supported NdS term in one simultaneously-resolved option. */
export function parseDiceProfile(text) {
    const profile = {};
    if (!text) return profile;
    const regex = /\b(\d+)\s*d\s*(4|6|8|10|12)\b/gi;
    let match;
    while ((match = regex.exec(String(text))) !== null) {
        const key = `d${match[2]}`;
        profile[key] = (profile[key] || 0) + Number(match[1]);
    }
    return profile;
}

export function mergeDiceProfilesMax(...profiles) {
    const merged = {};
    for (const profile of profiles) {
        for (const side of COMPANION_DIE_SIDES) {
            const key = `d${side}`;
            const count = Number(profile?.[key]) || 0;
            if (count > (merged[key] || 0)) merged[key] = count;
        }
    }
    return merged;
}

export function multiplyDiceProfile(profile, multiplier) {
    const result = {};
    const n = Math.max(1, Number(multiplier) || 1);
    for (const side of COMPANION_DIE_SIDES) {
        const key = `d${side}`;
        const count = Number(profile?.[key]) || 0;
        if (count) result[key] = count * n;
    }
    return result;
}

function optionDiceProfile(records) {
    let result = {};
    for (const record of records || []) {
        if (record?.enabled === false || /^multiattack$/i.test(record?.name || '')) continue;
        result = mergeDiceProfilesMax(result, parseDiceProfile(recordDiceText(record)));
    }
    return result;
}

export function deriveCreatureKey(name) {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    return (first.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'comp');
}

export function allocateUniqueCreatureKeys(specs) {
    // These bases can produce existing player/manual roll prefixes. Keep the
    // companion naming scheme, but suffix them before prompt formatting.
    const used = new Set(['user', 'ally']);
    return (specs || []).map(spec => {
        const base = deriveCreatureKey(spec.name);
        let key = base;
        let suffixIndex = 1;
        while (used.has(key)) {
            suffixIndex += 1;
            let value = suffixIndex;
            let suffix = '';
            while (value > 0) {
                value -= 1;
                suffix = String.fromCharCode(97 + (value % 26)) + suffix;
                value = Math.floor(value / 26);
            }
            key = `${base}${suffix}`;
        }
        used.add(key);
        return { ...spec, key };
    });
}

function spellPrimaryText(spell) {
    return spell?.entries ? JSON.stringify(spell.entries) : '';
}

function spellDiceProfile(spell, sidekickLevel) {
    const primary = spellPrimaryText(spell);
    // CDN entries sometimes repeat the same tagged formula in explanatory
    // prose. Count an identical formula once while retaining distinct dice
    // expressions that can be required by the spell.
    const uniqueFormulas = [...new Set(
        [...primary.matchAll(/\b\d+\s*d\s*(?:4|6|8|10|12)\b/gi)]
            .map(match => match[0].replace(/\s+/g, '').toLowerCase()),
    )];
    let profile = {};
    for (const formula of uniqueFormulas) {
        const parsed = parseDiceProfile(formula);
        for (const side of COMPANION_DIE_SIDES) {
            const key = `d${side}`;
            if (parsed[key]) profile[key] = (profile[key] || 0) + parsed[key];
        }
    }

    if (spell?.level === 0 && spell.scalingLevelDice?.scaling) {
        let scaledFormula = spell.scalingLevelDice.scaling['1'] || null;
        for (const breakpoint of [1, 5, 11, 17]) {
            if (sidekickLevel >= breakpoint && spell.scalingLevelDice.scaling[String(breakpoint)]) {
                scaledFormula = spell.scalingLevelDice.scaling[String(breakpoint)];
            }
        }
        if (scaledFormula) {
            const baseFormula = spell.scalingLevelDice.scaling['1'];
            const baseProfile = parseDiceProfile(baseFormula);
            const scaledProfile = parseDiceProfile(scaledFormula);
            // Replace the primary baseline roll while retaining unrelated dice tags.
            for (const side of COMPANION_DIE_SIDES) {
                const key = `d${side}`;
                const remaining = Math.max(0, (profile[key] || 0) - (baseProfile[key] || 0));
                const total = remaining + (scaledProfile[key] || 0);
                if (total) profile[key] = total;
                else delete profile[key];
            }
        }
    }
    return profile;
}

/** Resolve direct spell attacks made by one native/current casting. */
export function parseNativeSpellAttackCount(spell, sidekickLevel) {
    if (!spell) return 1;
    const text = spellPrimaryText(spell);
    const name = String(spell.name || '').toLowerCase();

    if (name === 'eldritch blast') {
        if (!/separate\s+attack\s+roll\s+for\s+each\s+beam/i.test(text)) return 1;
        const combined = `${text} ${spell.entriesHigherLevel ? JSON.stringify(spell.entriesHigherLevel) : ''}`;
        let count = 1;
        const tokenPattern = '(\\d+|one|two|three|four|five|six|seven|eight)';
        const patterns = [
            new RegExp(`${tokenPattern}\\s+beams?[^.]{0,80}?at\\s+(?:character\\s+)?level\\s+(\\d+)`, 'gi'),
            new RegExp(`${tokenPattern}\\s+beams?[^.]{0,80}?at\\s+(\\d+)(?:st|nd|rd|th)?\\s+level`, 'gi'),
        ];
        let foundCountFirst = false;
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(combined)) !== null) {
                const level = Number(match[2]);
                const beams = numberToken(match[1]);
                if (beams && sidekickLevel >= level) count = Math.max(count, beams);
                foundCountFirst = true;
            }
        }
        if (!foundCountFirst) {
            const levelFirst = new RegExp(`at\\s+(?:character\\s+)?level\\s+(\\d+)[^.]{0,80}?${tokenPattern}\\s+beams?`, 'gi');
            let match;
            while ((match = levelFirst.exec(combined)) !== null) {
                const level = Number(match[1]);
                const beams = numberToken(match[2]);
                if (beams && sidekickLevel >= level) count = Math.max(count, beams);
            }
        }
        // Stable PHB 2024 fallback after validating the explicit separate-roll wording.
        if (count === 1) count = sidekickLevel >= 17 ? 4 : sidekickLevel >= 11 ? 3 : sidekickLevel >= 5 ? 2 : 1;
        return clampAttackCount(count);
    }

    if (!Array.isArray(spell.spellAttack) || spell.spellAttack.length === 0) return 1;
    const tokenPattern = '(\\d+|one|two|three|four|five|six|seven|eight)';
    const ray = text.match(new RegExp(`${tokenPattern}\\s+(?:fiery\\s+)?rays?`, 'i'));
    if (ray && /(?:spell\s+)?attack(?:\s+roll)?\s+for\s+each\s+ray/i.test(text)) {
        return clampAttackCount(numberToken(ray[1]));
    }
    const targets = text.match(new RegExp(`(?:choose|target)\\s+up\\s+to\\s+${tokenPattern}\\s+creatures?`, 'i'));
    if (targets && /(?:spell\s+)?attack(?:\s+roll)?\s+against\s+each\s+target/i.test(text)) {
        return clampAttackCount(numberToken(targets[1]));
    }
    return 1;
}

function compatibleArrowBoltWeaponProfile(stats) {
    const candidates = [...(stats?.computedWeapons || []), ...(stats?.computedActions || [])];
    let result = {};
    for (const candidate of candidates) {
        if (candidate?.enabled === false) continue;
        const text = recordText(candidate);
        const isCompatible = /shortbow|longbow|crossbow|fires?\s+(?:an?\s+)?(?:arrow|bolt)|ammunition[^.]{0,60}(?:arrow|bolt)/i.test(text);
        if (!isCompatible) continue;
        result = mergeDiceProfilesMax(result, parseDiceProfile(
            candidate.damageDice || candidate.computedDamage || candidate.origDamage || text,
        ));
    }
    return result;
}

function hasDice(profile) {
    return Object.values(profile || {}).some(value => Number(value) > 0);
}

function spellNamesForSidekick(sidekick, stats) {
    const names = [
        ...(sidekick?.knownCantrips || []),
        ...(sidekick?.knownSpells || []),
        ...((stats?.featEffects?.bonusCantrips || []).map(entry => entry?.name || entry)),
        ...((stats?.featEffects?.bonusSpells || []).map(entry => entry?.name || entry)),
    ];
    const seen = new Set();
    return names.filter(name => {
        const key = String(name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function addSpellKeys(spells) {
    return allocateUniqueCreatureKeys(spells);
}

export function buildSidekickRollSpec(sidekick, stats, level, spellLookup) {
    const enabledActions = (stats?.computedActions || []).filter(action => action?.enabled !== false);
    const enabledTraits = (sidekick?.creatureTraits || []).filter(trait => trait?.enabled !== false);
    const multiattackCount = enabledActions.reduce((max, action) => {
        if (!/^multiattack$/i.test(action?.name || '')) return max;
        return Math.max(max, action.multiattackCount || parseMultiattackCount(action));
    }, 1);
    const physicalAttackCount = clampAttackCount(Math.max(1, multiattackCount, stats?.extraAttack || 0));
    const actionDice = mergeDiceProfilesMax(
        optionDiceProfile(enabledActions),
        optionDiceProfile(stats?.computedWeapons || []),
        optionDiceProfile(enabledTraits),
    );

    let maxSpellAttackCount = 1;
    let bonusWeaponAttackCount = 0;
    let bonusWeaponDice = {};
    const spellDice = [];
    if (stats?.spellcasting && typeof spellLookup === 'function') {
        for (const name of spellNamesForSidekick(sidekick, stats)) {
            const spell = spellLookup(name);
            if (!spell) continue;
            const attackCount = parseNativeSpellAttackCount(spell, level);
            maxSpellAttackCount = Math.max(maxSpellAttackCount, attackCount);
            const primaryText = spellPrimaryText(spell);
            if (String(spell.name || name).toLowerCase() === 'swift quiver'
                    && /make\s+two\s+attacks?/i.test(primaryText)
                    && /arrows?|bolts?/i.test(primaryText)) {
                const weaponDice = compatibleArrowBoltWeaponProfile(stats);
                if (hasDice(weaponDice)) {
                    bonusWeaponAttackCount = Math.max(bonusWeaponAttackCount, 2);
                    bonusWeaponDice = mergeDiceProfilesMax(bonusWeaponDice, weaponDice);
                }
                continue;
            }
            let dice = spellDiceProfile(spell, level);
            if (attackCount > 1 && !(spell.level === 0 && spell.scalingLevelDice?.scaling)) {
                dice = multiplyDiceProfile(dice, attackCount);
            }
            if (!hasDice(dice)) continue;
            spellDice.push({ name: spell.name || name, dice });
        }
    }

    const mainSetCount = clampAttackCount(Math.max(physicalAttackCount, maxSpellAttackCount));
    const additionalSetCount = Math.min(MAX_ATTACK_SETS, bonusWeaponAttackCount);
    const setProfiles = [
        ...Array.from({ length: mainSetCount }, () => actionDice),
        ...Array.from({ length: additionalSetCount }, () => bonusWeaponDice),
    ];
    return {
        entityId: sidekick?.id || `sidekick:${sidekick?.name || 'companion'}`,
        name: sidekick?.name || sidekick?.creatureName || 'Companion',
        source: 'sidekick',
        physicalAttackCount,
        maxSpellAttackCount,
        maxBonusWeaponAttackCount: additionalSetCount,
        mainSetCount,
        additionalSetCount,
        rollSetCount: setProfiles.length,
        setProfiles,
        spellDice: addSpellKeys(spellDice),
    };
}

export function buildCompanionRollSpec(companion, stats, options = {}) {
    const actions = stats?.actions || companion?.actions || [];
    const traits = stats?.traits || companion?.traits || [];
    const multiattackCount = actions.reduce((max, action) => Math.max(max, parseMultiattackCount(action)), 1);
    const bestialFuryCount = options.bestialFury ? 2 : 1;
    const mainSetCount = clampAttackCount(Math.max(1, multiattackCount, bestialFuryCount));
    const actionDice = mergeDiceProfilesMax(optionDiceProfile(actions), optionDiceProfile(traits));
    return {
        entityId: companion?.id || options.entityId || `companion:${companion?.name || stats?.name || 'companion'}`,
        name: companion?.name || stats?.customName || companion?.customName || stats?.name || companion?.creatureName || 'Companion',
        source: options.source || 'companion',
        physicalAttackCount: mainSetCount,
        maxSpellAttackCount: 1,
        maxBonusWeaponAttackCount: 0,
        mainSetCount,
        additionalSetCount: 0,
        rollSetCount: mainSetCount,
        setProfiles: Array.from({ length: mainSetCount }, () => actionDice),
        spellDice: [],
    };
}
