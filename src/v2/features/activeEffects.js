/**
 * Active spell effects — duration-aware status from the spell log.
 * Independent of optional spell_reference injection.
 */

import { spellLog, headerInfo, spellDataCache } from '../../core/state.js';
import { lookupSpellByName } from '../../features/sidekick.js';
import { parseCastLevelFromTokens } from '../../features/spellTracker.js';
import { lookupSpellSync } from './spells.js';

/** @typedef {'active'|'expired'|'instant'|'unknown'} EffectStatus */
const ROUND_SECONDS = 6;
const MINUTE_SECONDS = 60;

/**
 * Curated AC effects for long-duration buffs (not round/reaction spells).
 * @type {Record<string, { type: 'bonus'|'override'|'floor', value?: number, formula?: (dex: number) => number, requiresNoArmor?: boolean }>}
 */
const SPELL_AC_EFFECTS = {
    'mage armor': { type: 'override', formula: (dex) => 13 + dex, requiresNoArmor: true },
    'shield of faith': { type: 'bonus', value: 2 },
    'barkskin': { type: 'floor', value: 16 },
    'haste': { type: 'bonus', value: 2 },
    'warding bond': { type: 'bonus', value: 1 },
};

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

const NO_CONC_SUFFIX_RE = /\s*\(No Conc\)\s*$/i;

function resolveSpell(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    for (const [, spell] of spellDataCache) {
        if (spell.name?.toLowerCase() === lower && !spell._fallback) return spell;
    }
    const fromSk = lookupSpellByName(name);
    if (fromSk) return fromSk;
    const direct = lookupSpellSync(name);
    if (direct) return direct;

    if (NO_CONC_SUFFIX_RE.test(name)) {
        const baseName = name.replace(NO_CONC_SUFFIX_RE, '');
        return resolveSpell(baseName);
    }
    return null;
}

/**
 * Duration overrides for variant spell names.
 * Keyed by lowercase spell name → forced duration object.
 */
const DURATION_OVERRIDES = {
    'summon dragon no conc': { type: 'timed', concentration: false, duration: { amount: 1, type: 'minute' } },
};

/**
 * Hardcoded durations for non-spell abilities commonly logged via [Ability Name].
 * Keyed by normalized name. These do not come from spell databases.
 */
const NON_SPELL_DURATION_OVERRIDES = {
    'innate sorcery': { type: 'timed', concentration: false, duration: { amount: 10, type: 'round' } }, // 1 minute
    'rage': { type: 'timed', concentration: false, duration: { amount: 10, type: 'round' } }, // 1 minute
    'bladesong': { type: 'timed', concentration: false, duration: { amount: 1, type: 'minute' } },
    'giants might': { type: 'timed', concentration: false, duration: { amount: 1, type: 'minute' } },
    'starry form': { type: 'timed', concentration: false, duration: { amount: 10, type: 'minute' } },
    'twilight sanctuary': { type: 'timed', concentration: false, duration: { amount: 1, type: 'minute' } },
};

function normalizeEffectName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getLogSliceStart() {
    if (!spellLog?.length) return 0;
    let restStart = 0;
    for (let i = spellLog.length - 1; i >= 0; i--) {
        if (spellLog[i].type === 'rest') {
            restStart = i + 1;
            break;
        }
    }
    let startIdx = restStart;
    for (let i = restStart; i < spellLog.length; i++) {
        if (spellLog[i].type === 'dispel') startIdx = i + 1;
    }
    return startIdx;
}

/**
 * @param {object} [options]
 * @param {number} [options.excludeMsgIndex] - Skip log entries from this chat message index.
 *   Used during pre-reply injection so spells cast in the current user message
 *   are not treated as already active before the LLM narrates them.
 * @returns {Array<{ logIndex: number, logEntry: object, status: EffectStatus, remainingMinutes: number|null, concentration: boolean, spell: object|null, castLevel: number|null, reason?: string }>}
 */
export function computeActiveEffects({ excludeMsgIndex } = {}) {
    if (!spellLog?.length) return [];

    const startIdx = getLogSliceStart();
    const entries = spellLog.slice(startIdx);

    const shouldExclude = excludeMsgIndex != null && excludeMsgIndex >= 0;
    const contextEntries = shouldExclude
        ? entries.filter(e => e.msgIndex !== excludeMsgIndex)
        : entries;
    const ctx = buildContext(contextEntries);
    const results = [];

    for (let i = startIdx; i < spellLog.length; i++) {
        const entry = spellLog[i];
        if (entry.type !== 'cast') continue;
        if (shouldExclude && entry.msgIndex === excludeMsgIndex) continue;

        const resolved = resolveCastStatus(entry, ctx);
        results.push({
            logIndex: i,
            logEntry: entry,
            ...resolved,
        });
    }

    return results;
}

/**
 * @param {object} dur - spell.duration[0]
 * @returns {number|null} Minutes, null = indefinite, 0 = instantaneous/round-scale
 */
export function durationToMinutes(dur) {
    if (!dur) return null;
    if (dur.type === 'instant') return 0;
    if (dur.type === 'permanent' || dur.type === 'special') return null;
    if (dur.type !== 'timed' || !dur.duration) return null;

    const amount = dur.duration.amount || 1;
    switch (dur.duration.type) {
        case 'round': return (amount * ROUND_SECONDS) / MINUTE_SECONDS;
        case 'minute': return amount;
        case 'hour': return amount * 60;
        case 'day': return amount * 24 * 60;
        default: return null;
    }
}

export function formatDurationLabel(dur) {
    if (!dur) return 'unknown duration';
    if (dur.type === 'instant') return 'Instantaneous';
    if (dur.type === 'permanent') return 'Until dispelled';
    if (dur.type === 'special') return 'Special duration';
    if (dur.type === 'timed') {
        const conc = dur.concentration ? 'Concentration, up to ' : '';
        const { amount, type } = dur.duration;
        const unit = `${type}${amount > 1 ? 's' : ''}`;
        return `${conc}${amount} ${unit}`;
    }
    return 'unknown duration';
}

function elapsedMinutes(castDate, castTime, currentDate, currentTime) {
    const castM = timeToMinutes(castTime);
    const currM = timeToMinutes(currentTime);
    if (castM < 0 || currM < 0) return null;

    let dayDiff = 0;
    if (castDate && currentDate && normalizeDate(castDate) !== normalizeDate(currentDate)) {
        dayDiff = 1;
    }
    let delta = dayDiff * 1440 + (currM - castM);
    if (delta < 0) delta += 1440;
    return delta;
}

export function formatRemainingMinutes(minutes) {
    if (minutes == null || minutes <= 0) return null;
    if (minutes < 1) return '<1m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function parseCastLevelFromDetails(details) {
    if (!details) return null;
    const tokens = details.split(',').map(t => t.trim());
    const { castLevel } = parseCastLevelFromTokens(tokens);
    return castLevel;
}

/**
 * Check if this log entry represents a concentration spell.
 * Uses the `conc` flag from bracket parsing as the authoritative source.
 * Falls back to CDN spell data only when no flag was provided (e.g. manual entries).
 */
function isConcentrationCast(entry) {
    if (entry.conc === true) return true;
    if (entry.conc === false) return false;
    const spell = resolveSpell(entry.spell);
    return !!spell?.duration?.[0]?.concentration;
}

function buildContext(entries) {
    const casts = entries.filter(e => e.type === 'cast');
    const drops = entries.filter(e => e.type === 'drop-concentration');
    const latestCastBySpell = new Map();
    for (const entry of casts) {
        latestCastBySpell.set(entry.spell.toLowerCase(), entry);
    }

    const droppedSpells = new Set();
    let droppedAllAfterIdx = -1;
    for (const drop of drops) {
        if (drop.spell) {
            droppedSpells.add(drop.spell.toLowerCase());
        } else {
            const dropIdx = entries.indexOf(drop);
            if (dropIdx > droppedAllAfterIdx) droppedAllAfterIdx = dropIdx;
        }
    }

    let activeConcEntry = null;
    for (const entry of casts) {
        if (!isConcentrationCast(entry)) continue;
        const entryIdx = entries.indexOf(entry);

        if (droppedAllAfterIdx >= 0 && entryIdx < droppedAllAfterIdx) continue;

        if (droppedSpells.has(entry.spell.toLowerCase())) {
            const lastDrop = [...drops]
                .reverse()
                .find(d => d.spell?.toLowerCase() === entry.spell.toLowerCase());
            if (lastDrop && entries.indexOf(lastDrop) > entryIdx) continue;
        }

        activeConcEntry = entry;
    }

    const currentTime = headerInfo?.time || null;
    const currentDate = headerInfo?.date || null;

    return { casts, latestCastBySpell, activeConcEntry, droppedSpells, droppedAllAfterIdx, drops, currentTime, currentDate };
}

/**
 * @param {object} entry - spell log cast entry
 * @param {object} ctx
 * @returns {{ status: EffectStatus, remainingMinutes: number|null, concentration: boolean, spell: object|null, castLevel: number|null, reason?: string }}
 */
function resolveCastStatus(entry, ctx) {
    const spell = resolveSpell(entry.spell);
    const effectKey = normalizeEffectName(entry.spell);
    const overrideDur = DURATION_OVERRIDES[effectKey];
    const hardcodedAbilityDur = NON_SPELL_DURATION_OVERRIDES[effectKey];

    if (!spell && !overrideDur && !hardcodedAbilityDur) {
        return { status: 'instant', remainingMinutes: null, concentration: false, spell: null, castLevel: null };
    }

    const dur = overrideDur || spell?.duration?.[0] || hardcodedAbilityDur;
    const spellForUi = spell || { name: entry.spell, duration: dur ? [dur] : [] };
    const concentration = isConcentrationCast(entry);
    const castLevel = parseCastLevelFromDetails(entry.details);

    if (dur?.type === 'instant') {
        return { status: 'instant', remainingMinutes: null, concentration, spell: spellForUi, castLevel };
    }

    const latest = ctx.latestCastBySpell.get(entry.spell.toLowerCase());
    if (latest !== entry) {
        return { status: 'expired', remainingMinutes: null, concentration, spell: spellForUi, castLevel, reason: 'superseded' };
    }

    if (concentration && ctx.activeConcEntry !== entry) {
        return { status: 'expired', remainingMinutes: null, concentration, spell: spellForUi, castLevel, reason: 'concentration' };
    }

    const durationMin = durationToMinutes(dur);
    if (durationMin != null && durationMin <= 0.15) {
        return { status: 'expired', remainingMinutes: null, concentration, spell: spellForUi, castLevel, reason: 'round' };
    }

    if (durationMin != null) {
        const elapsed = elapsedMinutes(entry.date, entry.time, ctx.currentDate, ctx.currentTime);
        if (elapsed == null) {
            return { status: 'unknown', remainingMinutes: null, concentration, spell: spellForUi, castLevel };
        }
        if (elapsed >= durationMin) {
            return { status: 'expired', remainingMinutes: 0, concentration, spell: spellForUi, castLevel, reason: 'duration' };
        }
        return {
            status: 'active',
            remainingMinutes: durationMin - elapsed,
            concentration,
            spell: spellForUi,
            castLevel,
        };
    }

    return { status: 'active', remainingMinutes: null, concentration, spell: spellForUi, castLevel };
}

export function getActiveEffectsList(options) {
    return computeActiveEffects(options).filter(e => e.status === 'active' || e.status === 'unknown');
}

export function hasActiveConcentration(options) {
    return computeActiveEffects(options).some(e => (e.status === 'active' || e.status === 'unknown') && e.concentration);
}

/**
 * Return the currently concentrated spell effect, or null.
 */
export function getActiveConcentrationSpell(options) {
    return computeActiveEffects(options).find(e => (e.status === 'active' || e.status === 'unknown') && e.concentration) || null;
}

export function formatEffectStatusTag(resolved) {
    if (!resolved || resolved.status === 'instant') return '';
    if (resolved.status === 'active') {
        const rem = formatRemainingMinutes(resolved.remainingMinutes);
        if (rem) return `[ACTIVE — ${rem} remaining]`;
        if (resolved.concentration) return '[ACTIVE — concentration]';
        return '[ACTIVE]';
    }
    if (resolved.status === 'unknown') return '[ACTIVE — duration unknown]';
    if (resolved.status === 'expired') return '[EXPIRED]';
    return '';
}

/**
 * Active spell AC contributions for computeV2CharacterStats.
 * @param {object} mods - ability modifiers
 * @param {boolean} hasArmor
 * @returns {{ unarmoredFormula: number|null, bonus: number, floor: number|null, breakdown: Array<{label: string, value: number}> }}
 */
export function getActiveSpellAcEffects(mods, hasArmor) {
    const result = {
        unarmoredFormula: null,
        bonus: 0,
        floor: null,
        breakdown: [],
    };

    const active = getActiveEffectsList();
    for (const effect of active) {
        const key = effect.logEntry.spell.toLowerCase();
        const def = SPELL_AC_EFFECTS[key];
        if (!def) continue;

        if (def.type === 'override' && def.requiresNoArmor && hasArmor) continue;

        if (def.type === 'override' && def.formula) {
            const formula = def.formula(mods.dex || 0);
            result.unarmoredFormula = result.unarmoredFormula != null
                ? Math.max(result.unarmoredFormula, formula)
                : formula;
            result.breakdown.push({ label: effect.logEntry.spell, value: formula, isOverride: true });
        } else if (def.type === 'bonus' && def.value) {
            result.bonus += def.value;
            result.breakdown.push({ label: effect.logEntry.spell, value: def.value });
        } else if (def.type === 'floor' && def.value) {
            result.floor = result.floor != null ? Math.max(result.floor, def.value) : def.value;
            result.breakdown.push({ label: effect.logEntry.spell, value: def.value, isFloor: true });
        }
    }

    return result;
}

/**
 * Map log index → resolved effect for UI / spell log rendering.
 * @returns {Map<number, object>}
 */
export function getEffectStatusByLogIndex() {
    const map = new Map();
    for (const effect of computeActiveEffects()) {
        map.set(effect.logIndex, effect);
    }
    return map;
}
