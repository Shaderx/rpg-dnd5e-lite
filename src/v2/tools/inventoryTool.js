/**
 * V2 Tool Calling - Inventory Tool Handler
 * Processes LLM tool calls for inventory management (add/update/remove/equip/unequip).
 * Supports type (armor/shield/weapon) and magic fields for character equipment.
 */

import { v2Inventory, createDefaultItem } from '../core/state.js';
import { saveV2Inventory } from '../core/persistence.js';
import { renderV2Inventory } from '../rendering/inventory.js';
import { normalizeRarity } from '../../features/inventoryRarity.js';
import { searchEquipment } from '../../features/sidekick.js';

const VALID_TYPES = new Set(['none', 'armor', 'shield', 'weapon']);

function persist() {
    saveV2Inventory(v2Inventory);
    renderV2Inventory();
}

function normalizeType(val) {
    if (!val) return 'none';
    const t = String(val).toLowerCase().trim();
    return VALID_TYPES.has(t) ? t : 'none';
}

function enforceSingleArmor(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'armor' || item.location !== 'equipped') return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'armor' && v2Inventory[i].location === 'equipped') {
            v2Inventory[i].location = 'stored';
        }
    }
}

function enforceSingleShield(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'shield' || item.location !== 'equipped') return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'shield' && v2Inventory[i].location === 'equipped') {
            v2Inventory[i].location = 'stored';
        }
    }
}

function resolveEquipmentData(name, type, magic) {
    if (type === 'none' || !name) return null;
    const kind = type === 'shield' ? 'armor' : type;
    const matches = searchEquipment(name, kind, magic);
    if (matches.length === 0) return null;

    const match = matches.find(m => m.name.toLowerCase() === name.toLowerCase()) || matches[0];

    if (type === 'armor') {
        return {
            name: match.name,
            type: match._armorType || match.type || 'LA',
            ac: match.ac || 10,
            dexCap: match._armorType === 'MA' ? 2 : (match._armorType === 'HA' ? 0 : null),
            strReq: match.strength || match.strReq || 0,
            stealthDis: !!match.stealth || !!match.stealthDis,
            bonusAc: match.bonusAc || 0,
            _magic: !!match._magic,
        };
    } else if (type === 'shield') {
        return { name: match.name, ac: match.ac || 2, _magic: !!match._magic };
    } else if (type === 'weapon') {
        return {
            name: match.name,
            damageDice: match.dmg1 || match.damageDice || '1d6',
            damageType: match.dmgType || match.damageType || 'slashing',
            properties: match.property || match.properties || [],
            isRanged: !!(match.range || (match.property || []).some(p => typeof p === 'string' && (p === 'A' || p === 'AF'))),
            bonus: match.bonusWeapon ? parseInt(String(match.bonusWeapon).replace(/[^-\d]/g, '')) || 0 : 0,
            _magic: !!match._magic,
        };
    }
    return null;
}

/**
 * Handle an inventory management tool call from the LLM.
 * @param {object} args - Tool call arguments
 * @returns {string} Confirmation message
 */
export function handleInventoryAction(args) {
    const { action } = args;

    switch (action) {
        case 'add': return handleAdd(args);
        case 'update': return handleUpdate(args);
        case 'remove': return handleRemove(args);
        case 'equip': return handleEquip(args, 'equipped');
        case 'unequip': return handleEquip(args, 'stored');
        case 'charges': return handleCharges(args);
        default: return `Unknown inventory action: ${action}`;
    }
}

function handleAdd(args) {
    const name = args.name?.trim();
    if (!name) return 'Error: item name is required for add action';

    const type = normalizeType(args.type);
    const magic = !!args.magic;
    const equipData = (type !== 'none') ? resolveEquipmentData(name, type, magic) : null;

    const item = createDefaultItem({
        name: equipData?.name || name,
        quantity: Math.max(1, parseInt(args.quantity) || 1),
        rarity: normalizeRarity(args.rarity ?? 0),
        location: args.location === 'equipped' ? 'equipped' : 'stored',
        type,
        magic: equipData ? !!equipData._magic : magic,
        magicNotes: args.magic_notes || '',
        charges: args.charges !== undefined && args.charges !== null ? Math.max(0, parseInt(args.charges) || 0) : null,
        equipmentData: equipData,
    });

    v2Inventory.push(item);
    const idx = v2Inventory.length - 1;
    if (item.location === 'equipped') {
        if (type === 'armor') enforceSingleArmor(idx);
        if (type === 'shield') enforceSingleShield(idx);
    }

    persist();
    return `Item added: "${item.name}" x${item.quantity}${type !== 'none' ? ` [${type}]` : ''}`;
}

function handleUpdate(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const item = v2Inventory[idx];

    if (args.name !== undefined) item.name = args.name.trim();
    if (args.rarity !== undefined) item.rarity = normalizeRarity(args.rarity);
    if (args.type !== undefined) {
        item.type = normalizeType(args.type);
        if (item.type !== 'none' && item.name) {
            item.equipmentData = resolveEquipmentData(item.name, item.type, item.magic);
        } else if (item.type === 'none') {
            item.equipmentData = null;
        }
    }
    if (args.magic !== undefined) item.magic = !!args.magic;
    if (args.magic_notes !== undefined) item.magicNotes = String(args.magic_notes);
    if (args.charges !== undefined) {
        item.charges = args.charges === null ? null : Math.max(0, parseInt(args.charges) || 0);
    }
    if (args.location !== undefined) {
        item.location = args.location === 'equipped' ? 'equipped' : 'stored';
        if (item.location === 'equipped') {
            if (item.type === 'armor') enforceSingleArmor(idx);
            if (item.type === 'shield') enforceSingleShield(idx);
        }
    }

    if (args.quantity_change !== undefined) {
        const change = parseInt(args.quantity_change) || 0;
        item.quantity = Math.max(0, (item.quantity || 1) + change);
    } else if (args.quantity !== undefined) {
        item.quantity = Math.max(0, parseInt(args.quantity) || 0);
    }

    if (item.quantity <= 0) {
        const name = item.name;
        v2Inventory.splice(idx, 1);
        persist();
        return `Item removed (quantity 0): "${name}"`;
    }

    persist();
    return `Item updated: "${item.name}" x${item.quantity}`;
}

function handleEquip(args, location) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const item = v2Inventory[idx];
    item.location = location;
    if (location === 'equipped') {
        if (item.type === 'armor') enforceSingleArmor(idx);
        if (item.type === 'shield') enforceSingleShield(idx);
    }
    persist();
    return `Item ${location === 'equipped' ? 'equipped' : 'unequipped'}: "${item.name}"`;
}

function handleRemove(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const name = v2Inventory[idx].name;
    v2Inventory.splice(idx, 1);
    persist();
    return `Item removed: "${name}"`;
}

function handleCharges(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const item = v2Inventory[idx];
    const op = args.op || 'set';
    const value = parseInt(args.value) || 0;

    switch (op) {
        case 'set':
            item.charges = Math.max(0, value);
            break;
        case 'reduce':
            item.charges = item.charges !== null ? Math.max(0, item.charges - Math.abs(value)) : null;
            break;
        case 'increase':
            item.charges = item.charges !== null ? item.charges + Math.abs(value) : Math.abs(value);
            break;
        case 'reset':
            item.charges = value > 0 ? value : (item.charges !== null ? item.charges : 0);
            break;
        default:
            return `Unknown charges op: ${op}`;
    }

    persist();
    return `Charges ${op}: "${item.name}" → ${item.charges !== null ? item.charges : '∞'}`;
}

function resolveIndex(index) {
    if (typeof index !== 'number' || index < 1) return -1;
    return index - 1;
}
