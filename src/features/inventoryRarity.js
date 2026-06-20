/**
 * Inventory item rarity tiers (0–5).
 * Common → Uncommon → Rare → Very Rare → Legendary → Artifact
 */

export const RARITY_LABELS = [
    'common',
    'uncommon',
    'rare',
    'very rare',
    'legendary',
    'artifact',
];

export const RARITY_COUNT = RARITY_LABELS.length;

/** Metadata version after 6-tier rarity (was 4-tier: common/uncommon/rare/legendary). */
export const INVENTORY_RARITY_VERSION = 2;

export function normalizeRarity(rarity) {
    const n = Number(rarity);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(RARITY_COUNT - 1, Math.floor(n)));
}

export function cycleRarity(rarity) {
    return (normalizeRarity(rarity) + 1) % RARITY_COUNT;
}

/**
 * One-time migration: old tier 3 was "legendary" → new tier 4.
 * @param {object[]} items
 */
export function migrateInventoryRarity(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (item.rarity === 3) item.rarity = 4;
        item.rarity = normalizeRarity(item.rarity);
    }
}
