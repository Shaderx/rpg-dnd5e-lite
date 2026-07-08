/**
 * V2 Tool Calling - Sidekick Inventory Tool Handler
 * Processes LLM tool calls for sidekick inventory management
 * (add/update/remove/equip/unequip). Routes items to the correct
 * storage field on the sidekick object based on type.
 */

import { sidekicks } from '../../core/state.js';
import { saveSidekicks } from '../../core/persistence.js';
import { renderSidekickCards, renderSidekickDetail } from '../../rendering/sidekick.js';
import { RARITY_LABELS, normalizeRarity } from '../../features/inventoryRarity.js';
import {
    searchEquipment, fuzzyLookupItem, lookupItemByName,
    weaponFromItem, armorFromItem, shieldFromItem,
    getSidekickAttunedCount, SIDEKICK_MAX_ATTUNEMENT,
} from '../../features/sidekick.js';

const VALID_TYPES = new Set(['none', 'armor', 'shield', 'weapon']);

function normalizeType(val) {
    if (!val) return 'none';
    const t = String(val).toLowerCase().trim();
    return VALID_TYPES.has(t) ? t : 'none';
}

function findSidekickByName(name) {
    if (!name || !sidekicks?.length) return null;
    const lower = name.toLowerCase().trim();
    const enabled = sidekicks.filter(sk => sk.enabled);
    // Exact match
    const exact = enabled.find(sk => sk.name?.toLowerCase().trim() === lower);
    if (exact) return exact;
    // Partial: LLM sent first name only (e.g. "Lyra" matches "Lyra Ashwood")
    return enabled.find(sk => sk.name?.toLowerCase().trim().startsWith(lower + ' ')) || null;
}

/**
 * Build an ordered gear list across all sidekick storage fields.
 * Each entry: { source: 'armor'|'shield'|'weapons'|'items', sourceIndex: number, item: object }
 * sourceIndex is the array index for weapons/items, or -1 for singular slots.
 */
function buildUnifiedGearList(sk) {
    const list = [];
    if (sk.equippedArmor) {
        list.push({ source: 'armor', sourceIndex: -1, item: sk.equippedArmor });
    }
    if (sk.equippedShield) {
        list.push({ source: 'shield', sourceIndex: -1, item: sk.equippedShield });
    }
    for (let i = 0; i < (sk.weapons || []).length; i++) {
        list.push({ source: 'weapons', sourceIndex: i, item: sk.weapons[i] });
    }
    for (let i = 0; i < (sk.items || []).length; i++) {
        list.push({ source: 'items', sourceIndex: i, item: sk.items[i] });
    }
    return list;
}

function resolveGearByIndex(sk, index) {
    if (typeof index !== 'number' || index < 1) return null;
    const list = buildUnifiedGearList(sk);
    const idx = index - 1;
    return idx >= 0 && idx < list.length ? list[idx] : null;
}

function autoAttuneSidekickItem(item) {
    const cdnItem = lookupItemByName(item.name);
    return cdnItem?.reqAttune || false;
}

function persist() {
    saveSidekicks(sidekicks);
    renderSidekickCards();
    const openDetailId = document.querySelector('#dnd-sidekick-detail-popup.dnd-popup-visible')
        ?.querySelector('[data-sidekick-id]')?.dataset?.sidekickId;
    if (openDetailId) renderSidekickDetail(openDetailId);
}

/**
 * Handle a sidekick inventory tool call from the LLM.
 * @param {object} args - Tool call arguments (must include `sidekick` name)
 * @returns {string} Confirmation or error message
 */
export function handleSidekickInventoryAction(args) {
    const { action } = args;

    switch (action) {
        case 'add': return handleAdd(args);
        case 'update': return handleUpdate(args);
        case 'remove': return handleRemove(args);
        case 'equip': return handleEquip(args);
        case 'unequip': return handleUnequip(args);
        default: return `Unknown sidekick_inventory action: ${action}`;
    }
}

function handleAdd(args) {
    const sk = findSidekickByName(args.sidekick);
    if (!sk) return `Error: sidekick "${args.sidekick}" not found`;

    const rawName = args.name?.trim();
    if (!rawName) return 'Error: item name is required for add action';

    const type = normalizeType(args.type);
    const magic = !!args.magic;
    const rarityIdx = args.rarity !== undefined ? normalizeRarity(args.rarity) : -1;
    const rarityStr = rarityIdx >= 1 ? (RARITY_LABELS[rarityIdx] || null) : null;
    const notes = (args.notes || '').trim();

    if (type === 'armor') {
        const cdnMatches = searchEquipment(rawName, 'armor', magic);
        const cdnItem = cdnMatches.find(m => m.name.toLowerCase() === rawName.toLowerCase()) || cdnMatches[0];
        if (cdnItem) {
            const armor = armorFromItem(cdnItem);
            armor.attuned = false;
            if (magic && autoAttuneSidekickItem({ name: armor.name }) && getSidekickAttunedCount(sk) < SIDEKICK_MAX_ATTUNEMENT) {
                armor.attuned = true;
            }
            sk.equippedArmor = armor;
        } else {
            sk.equippedArmor = { name: rawName, type: 'LA', ac: 10, stealthDisadv: false, strReq: 0, attuned: false };
        }
        persist();
        return `Armor equipped on ${sk.name}: "${sk.equippedArmor.name}"`;
    }

    if (type === 'shield') {
        const cdnMatches = searchEquipment(rawName, 'armor', magic);
        const cdnItem = cdnMatches.find(m => m.name.toLowerCase() === rawName.toLowerCase()) || cdnMatches[0];
        if (cdnItem) {
            const shield = shieldFromItem(cdnItem);
            shield.attuned = false;
            if (magic && autoAttuneSidekickItem({ name: shield.name }) && getSidekickAttunedCount(sk) < SIDEKICK_MAX_ATTUNEMENT) {
                shield.attuned = true;
            }
            sk.equippedShield = shield;
        } else {
            sk.equippedShield = { name: rawName, ac: 2, rarity: null, attuned: false };
        }
        persist();
        return `Shield equipped on ${sk.name}: "${sk.equippedShield.name}"`;
    }

    if (type === 'weapon') {
        const cdnMatches = searchEquipment(rawName, 'weapon', magic);
        const cdnItem = cdnMatches.find(m => m.name.toLowerCase() === rawName.toLowerCase()) || cdnMatches[0];
        let weapon;
        if (cdnItem) {
            weapon = weaponFromItem(cdnItem);
            weapon.attuned = false;
            weapon.customNotes = notes;
            if (magic && autoAttuneSidekickItem({ name: weapon.name }) && getSidekickAttunedCount(sk) < SIDEKICK_MAX_ATTUNEMENT) {
                weapon.attuned = true;
            }
        } else {
            weapon = { name: rawName, attackType: 'mw', damageDice: '1d6', damageType: 'slashing', properties: [], versatileDice: null, range: null, finesse: false, bonus: null, rarity: null, attuned: false, customNotes: notes };
        }
        if (!sk.weapons) sk.weapons = [];
        sk.weapons.push(weapon);
        persist();
        return `Weapon added to ${sk.name}: "${weapon.name}"`;
    }

    // type === 'none' (general item)
    const canonicalName = fuzzyLookupItem(rawName)?.name || rawName;
    if (!sk.items) sk.items = [];
    const attuned = magic && autoAttuneSidekickItem({ name: canonicalName }) && getSidekickAttunedCount(sk) < SIDEKICK_MAX_ATTUNEMENT;
    sk.items.push({
        name: canonicalName,
        quantity: Math.max(1, parseInt(args.quantity) || 1),
        rarity: rarityStr,
        source: null,
        attuned,
        customNotes: notes,
    });
    const qty = sk.items[sk.items.length - 1].quantity;
    persist();
    return `Item added to ${sk.name}: "${canonicalName}" x${qty}`;
}

function handleUpdate(args) {
    const sk = findSidekickByName(args.sidekick);
    if (!sk) return `Error: sidekick "${args.sidekick}" not found`;

    const entry = resolveGearByIndex(sk, args.index);
    if (!entry) return `Error: gear not found at index ${args.index} on ${sk.name}`;

    const item = entry.item;

    if (args.name !== undefined) item.name = args.name.trim();
    if (args.rarity !== undefined) {
        const ri = normalizeRarity(args.rarity);
        item.rarity = ri >= 1 ? (RARITY_LABELS[ri] || null) : null;
    }

    if (args.notes !== undefined) {
        const newNotes = args.notes.trim();
        if (entry.source === 'items') {
            item.customNotes = newNotes;
        } else if (entry.source === 'weapons') {
            item.customNotes = newNotes;
        }
    }

    // Quantity only applies to general items
    if (entry.source === 'items') {
        if (args.quantity_change !== undefined) {
            const change = parseInt(args.quantity_change) || 0;
            item.quantity = Math.max(0, (item.quantity || 1) + change);
        } else if (args.quantity !== undefined) {
            item.quantity = Math.max(0, parseInt(args.quantity) || 0);
        }

        if (item.quantity <= 0) {
            const name = item.name;
            sk.items.splice(entry.sourceIndex, 1);
            persist();
            return `Item removed from ${sk.name} (quantity 0): "${name}"`;
        }
    }

    persist();
    const qtyStr = entry.source === 'items' ? ` x${item.quantity || 1}` : '';
    return `Gear updated on ${sk.name}: "${item.name}"${qtyStr}`;
}

function handleRemove(args) {
    const sk = findSidekickByName(args.sidekick);
    if (!sk) return `Error: sidekick "${args.sidekick}" not found`;

    const entry = resolveGearByIndex(sk, args.index);
    if (!entry) return `Error: gear not found at index ${args.index} on ${sk.name}`;

    const name = entry.item.name;

    switch (entry.source) {
        case 'armor':
            sk.equippedArmor = null;
            break;
        case 'shield':
            sk.equippedShield = null;
            break;
        case 'weapons':
            sk.weapons.splice(entry.sourceIndex, 1);
            break;
        case 'items':
            sk.items.splice(entry.sourceIndex, 1);
            break;
    }

    persist();
    return `Gear removed from ${sk.name}: "${name}"`;
}

function handleEquip(args) {
    const sk = findSidekickByName(args.sidekick);
    if (!sk) return `Error: sidekick "${args.sidekick}" not found`;

    const entry = resolveGearByIndex(sk, args.index);
    if (!entry) return `Error: gear not found at index ${args.index} on ${sk.name}`;

    if (entry.source === 'armor' || entry.source === 'shield') {
        return `"${entry.item.name}" is already equipped on ${sk.name}`;
    }

    if (entry.source === 'weapons') {
        return `"${entry.item.name}" is already in ${sk.name}'s weapon slots`;
    }

    // General item -> try to promote to equipment slot
    const item = entry.item;
    const cdnMatches = searchEquipment(item.name, 'weapon', false) || [];
    const weaponMatch = cdnMatches.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    if (weaponMatch) {
        const weapon = weaponFromItem(weaponMatch);
        weapon.attuned = !!item.attuned;
        weapon.customNotes = item.customNotes || '';
        if (!sk.weapons) sk.weapons = [];
        sk.weapons.push(weapon);
        sk.items.splice(entry.sourceIndex, 1);
        persist();
        return `Item promoted to weapon on ${sk.name}: "${weapon.name}"`;
    }

    const armorMatches = searchEquipment(item.name, 'armor', false) || [];
    const armorMatch = armorMatches.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    if (armorMatch) {
        if (armorMatch.type === 'S' || armorMatch._armorType === 'S' || item.name.toLowerCase().includes('shield')) {
            const shield = shieldFromItem(armorMatch);
            shield.attuned = !!item.attuned;
            sk.equippedShield = shield;
        } else {
            const armor = armorFromItem(armorMatch);
            armor.attuned = !!item.attuned;
            sk.equippedArmor = armor;
        }
        sk.items.splice(entry.sourceIndex, 1);
        persist();
        return `Item equipped on ${sk.name}: "${item.name}"`;
    }

    return `Error: "${item.name}" cannot be equipped (not recognized as weapon/armor/shield)`;
}

function handleUnequip(args) {
    const sk = findSidekickByName(args.sidekick);
    if (!sk) return `Error: sidekick "${args.sidekick}" not found`;

    const entry = resolveGearByIndex(sk, args.index);
    if (!entry) return `Error: gear not found at index ${args.index} on ${sk.name}`;

    if (entry.source === 'items') {
        return `"${entry.item.name}" is already stored (not equipped) on ${sk.name}`;
    }

    if (!sk.items) sk.items = [];
    const demoted = {
        name: entry.item.name,
        quantity: 1,
        rarity: entry.item.rarity || null,
        source: null,
        attuned: false,
        customNotes: entry.item.customNotes || '',
    };

    switch (entry.source) {
        case 'armor':
            sk.equippedArmor = null;
            break;
        case 'shield':
            sk.equippedShield = null;
            break;
        case 'weapons':
            sk.weapons.splice(entry.sourceIndex, 1);
            break;
    }

    sk.items.push(demoted);
    persist();
    return `Gear unequipped on ${sk.name}: "${demoted.name}" moved to items`;
}
