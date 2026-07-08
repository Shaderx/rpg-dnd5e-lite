/**
 * D&D 5e Lite - Random Events Module
 * Rolls a d100 when cooldown is inactive to determine if a random event fires.
 * Skips rolling while cooldown is active.
 * Always produces a result object (event or no-event) for <Random_Event> injection.
 */

import { secureRoll } from './dice.js';
import { EVENT_TABLE, EVENT_CATEGORIES } from '../data/eventTable.js';
import { extensionSettings, eventCooldown, setEventCooldown, lastEventRoll, setLastEventRoll } from '../core/state.js';
import { saveRandomEventState } from '../core/persistence.js';

export const DEFAULT_SEVERITY_TIERS = [
    { id: 'minor',    label: 'Minor',    min: 71, max: 80 },
    { id: 'moderate', label: 'Moderate', min: 81, max: 90 },
    { id: 'major',    label: 'Major',    min: 91, max: 97 },
    { id: 'critical', label: 'Critical', min: 98, max: 100 },
];

/**
 * Get the active severity tiers, merging user overrides with defaults.
 */
export function getSeverityTiers() {
    const overrides = extensionSettings.eventThresholds;
    if (!overrides) return DEFAULT_SEVERITY_TIERS;
    return DEFAULT_SEVERITY_TIERS.map(tier => {
        const o = overrides[tier.id];
        if (!o) return tier;
        return { ...tier, min: o.min ?? tier.min, max: o.max ?? tier.max };
    });
}

const CATEGORY_KEYS = Object.keys(EVENT_CATEGORIES);
const DEFAULT_COOLDOWN = 2;

/**
 * Determine severity tier from a d100 roll.
 * @returns {object|null} The matching severity tier, or null if no event.
 */
function getSeverity(roll) {
    for (const tier of getSeverityTiers()) {
        if (roll >= tier.min && roll <= tier.max) return tier;
    }
    return null;
}

/**
 * Pick a random category key using secure randomness.
 */
function pickCategory() {
    const idx = secureRoll(CATEGORY_KEYS.length) - 1;
    return CATEGORY_KEYS[idx];
}

/**
 * Sample N unique random entries from an event pool.
 * Falls back gracefully if the pool is smaller than requested.
 */
export function sampleExamples(categoryKey, severityId, count = 3) {
    const pool = EVENT_TABLE[categoryKey]?.[severityId];
    if (!pool || pool.length === 0) return [];

    const n = Math.min(count, pool.length);
    const indices = new Set();
    while (indices.size < n) {
        indices.add(secureRoll(pool.length) - 1);
    }
    return [...indices].map(i => pool[i]);
}

/**
 * Roll d100 and produce an event result object.
 * Always returns a result — either an event or a no-event marker.
 * Respects and manages cooldown state.
 *
 * @returns {{ roll: number|null, severity: object|null, category: string|null, categoryMeta: object|null, examples: string[], cooldownActive: boolean }}
 */
export function rollRandomEvent() {
    const cd = eventCooldown;

    if (cd > 0) {
        const result = {
            roll: null,
            severity: null,
            category: null,
            categoryMeta: null,
            examples: [],
            cooldownActive: true,
            cooldownRemaining: cd,
        };
        setEventCooldown(cd - 1);
        setLastEventRoll(result);
        saveRandomEventState();
        return result;
    }

    const roll = secureRoll(100);
    const severity = getSeverity(roll);

    if (!severity) {
        const result = {
            roll,
            severity: null,
            category: null,
            categoryMeta: null,
            examples: [],
            cooldownActive: false,
        };
        setEventCooldown(DEFAULT_COOLDOWN);
        setLastEventRoll(result);
        saveRandomEventState();
        return result;
    }

    const categoryKey = pickCategory();
    const categoryMeta = EVENT_CATEGORIES[categoryKey];
    const examples = sampleExamples(categoryKey, severity.id, 3);

    const result = {
        roll,
        severity,
        category: categoryKey,
        categoryMeta,
        examples,
        cooldownActive: false,
    };

    setEventCooldown(DEFAULT_COOLDOWN);
    setLastEventRoll(result);
    saveRandomEventState();
    return result;
}

/**
 * Get the last event roll result (for swipe/regenerate reuse).
 */
export function getLastEventRoll() {
    return lastEventRoll;
}
