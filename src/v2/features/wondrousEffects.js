/**
 * Wondrous Item Effects
 * Resolves AC and saving throw bonuses from equipped/attuned magic items
 * that aren't armor, shields, or weapons (e.g. Cloak of Protection, Ring of Protection,
 * Bracers of Defense, Ioun Stone of Protection, Stone of Good Luck).
 *
 * Resolution order per item:
 *   1. Structured CDN fields (bonusAc, bonusSavingThrow) — reliable
 *   2. Text parsing of item entries — fallback for items without structured fields
 *
 * Attunement: items with reqAttune must have location === 'attuned' for bonuses to apply.
 * Items without reqAttune apply bonuses when equipped or attuned.
 */

import { v2Inventory, isItemEquipped } from '../core/state.js';
import { lookupItemByName } from '../../features/sidekick.js';

/**
 * Strip 5etools markup to plain text (no HTML).
 * Simplified version of tooltip.js strip5eMarkupLight, returns plain text not HTML.
 */
function stripMarkup(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Flatten 5etools entries array to a single plain-text string.
 */
function flattenToText(entries) {
    if (!Array.isArray(entries)) return '';
    const parts = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            parts.push(stripMarkup(e));
        } else if (e?.entries) {
            const heading = e.name ? `${e.name}. ` : '';
            parts.push(heading + flattenToText(e.entries));
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            parts.push(e.items.map(li =>
                typeof li === 'string' ? stripMarkup(li) : flattenToText(li.entries || [])
            ).join(' '));
        }
    }
    return parts.join(' ');
}

function parseBonus(val) {
    if (val == null) return 0;
    return parseInt(String(val).replace(/[^-\d]/g, '')) || 0;
}

const AC_PATTERN = /\+(\d+)\s+bonus\s+to\s+(?:your\s+)?(?:AC|Armor Class)/i;
const SAVE_PATTERN = /\+(\d+)\s+bonus\s+to\s+(?:your\s+)?(?:all\s+)?saving\s+throws?/i;
const COMBINED_PATTERN = /\+(\d+)\s+bonus\s+to\s+(?:your\s+)?AC\s+and\s+(?:your\s+)?saving\s+throws?/i;
const NO_ARMOR_CONDITION = /wearing\s+no\s+armor|not\s+wearing\s+armor/i;
const NO_SHIELD_CONDITION = /using\s+no\s+shield|not\s+using\s+a?\s*shield/i;

/**
 * Extract bonuses from a CDN item object.
 * @returns {{ acBonus: number, saveBonus: number, conditions: { noArmor: boolean, noShield: boolean } }}
 */
function extractBonuses(cdnItem) {
    let acBonus = 0;
    let saveBonus = 0;
    let conditions = { noArmor: false, noShield: false };

    // Phase 1: structured fields
    if (cdnItem.bonusAc) acBonus = parseBonus(cdnItem.bonusAc);
    if (cdnItem.bonusSavingThrow) saveBonus = parseBonus(cdnItem.bonusSavingThrow);

    // Phase 2: text fallback (only if no structured fields found)
    if (!acBonus && !saveBonus && cdnItem.entries) {
        const text = flattenToText(cdnItem.entries);

        const combined = text.match(COMBINED_PATTERN);
        if (combined) {
            acBonus = parseInt(combined[1]) || 0;
            saveBonus = acBonus;
        } else {
            const acMatch = text.match(AC_PATTERN);
            if (acMatch) acBonus = parseInt(acMatch[1]) || 0;
            const saveMatch = text.match(SAVE_PATTERN);
            if (saveMatch) saveBonus = parseInt(saveMatch[1]) || 0;
        }

        if (NO_ARMOR_CONDITION.test(text)) conditions.noArmor = true;
        if (NO_SHIELD_CONDITION.test(text)) conditions.noShield = true;
    }

    return { acBonus, saveBonus, conditions };
}

/**
 * Collect aggregate wondrous item bonuses from equipped/attuned inventory.
 * @param {{ hasArmor: boolean, hasShield: boolean }} context
 * @returns {{ acBonus: number, saveBonus: number, items: Array<{ name: string, acBonus: number, saveBonus: number }> }}
 */
export function collectWondrousEffects(context) {
    let totalAcBonus = 0;
    let totalSaveBonus = 0;
    const items = [];

    for (const item of v2Inventory) {
        if (item.type !== 'none' || !item.magic || !isItemEquipped(item)) continue;

        const cdnItem = lookupItemByName(item.name);
        if (!cdnItem) continue;

        const requiresAttunement = !!cdnItem.reqAttune;
        if (requiresAttunement && item.location !== 'attuned') continue;

        const { acBonus, saveBonus, conditions } = extractBonuses(cdnItem);
        if (!acBonus && !saveBonus) continue;

        let effectiveAc = acBonus;
        if (conditions.noArmor && context.hasArmor) effectiveAc = 0;
        if (conditions.noShield && context.hasShield) effectiveAc = 0;

        totalAcBonus += effectiveAc;
        totalSaveBonus += saveBonus;
        items.push({ name: item.name, acBonus: effectiveAc, saveBonus });
    }

    return { acBonus: totalAcBonus, saveBonus: totalSaveBonus, items };
}
