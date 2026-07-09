/**
 * V2 Tool Calling - Inventory Tool Handler
 * Processes LLM tool calls for inventory management (add/update/remove/equip/unequip).
 * Supports type (armor/shield/weapon) and magic fields for character equipment.
 */

import { v2Inventory, createDefaultItem, isItemEquipped } from '../core/state.js';
import { saveV2Inventory } from '../core/persistence.js';
import { renderV2Inventory } from '../rendering/inventory.js';
import { renderV2CharacterPanel } from '../rendering/character.js';
import { normalizeRarity } from '../../features/inventoryRarity.js';
import { searchEquipment, fuzzyLookupItem, searchMagicItems, lookupSpellByName, lookupItemByName } from '../../features/sidekick.js';

const VALID_TYPES = new Set(['none', 'armor', 'shield', 'weapon']);

/**
 * Attempt to resolve LLM-generated item names to canonical D&D names.
 * Tries direct lookup, then common reorderings.
 *
 * DB naming patterns (5etools / 5.5e):
 *   Potions:       "Potion of Greater Healing", "Potion of Speed"
 *   Scrolls:       "Spell Scroll (3rd Level)" — NOT "Scroll of Fireball"
 *                  (spell scrolls in 5etools are generic by level, spell name is in attachedSpells)
 *   Wondrous:      "Cloak of Protection", "Bag of Holding", "Ring of Spell Storing"
 *   +N variants:   "+1 Shortsword", "+2 Chain Mail" (generated from magicvariants.json)
 *   Named unique:  "Flame Tongue", "Vorpal Sword", "Staff of Power"
 *
 * LLM commonly generates:
 *   "Greater Healing Potion" → should be "Potion of Greater Healing"
 *   "Healing Potion" → "Potion of Healing"
 *   "Scroll of Lesser Restoration" → no DB match (keep as-is, it's descriptive)
 *   "Protection Cloak" → "Cloak of Protection"
 */
function normalizeItemName(name) {
    if (!name) return name;

    const direct = fuzzyLookupItem(name);
    if (direct) return direct.name;

    // Phase 1: Reorder "[Adj] [Noun] [ItemType]" → "[ItemType] of [Adj] [Noun]"
    // e.g. "Greater Healing Potion" → "Potion of Greater Healing"
    const typeWords = /^(.+?)\s+(potion|elixir|oil|philter|perfume)$/i;
    const typeMatch = name.match(typeWords);
    if (typeMatch) {
        const found = fuzzyLookupItem(`${typeMatch[2]} of ${typeMatch[1]}`);
        if (found) return found.name;
    }

    // Phase 2: "[Adj] [WondrousType]" → "[WondrousType] of [Adj]"
    // e.g. "Protection Cloak" → "Cloak of Protection"
    const wondrousTypes = /^(.+?)\s+(cloak|ring|amulet|staff|rod|wand|boots|helm|belt|bracers|gauntlets|cape|mantle|orb|crystal|circlet|crown|pendant|necklace|periapt|tome|manual|robe|gloves|goggles|lantern|horn|bag|carpet|mirror|hat|headband|ioun stone)$/i;
    const wondrousMatch = name.match(wondrousTypes);
    if (wondrousMatch) {
        const found = fuzzyLookupItem(`${wondrousMatch[2]} of ${wondrousMatch[1]}`);
        if (found) return found.name;
    }

    // Phase 3: Qualifier prefix reordering
    // "Greater Healing Potion" → "Potion of Greater Healing"
    // "Supreme Healing Potion" → "Potion of Supreme Healing"
    const qualifierMatch = name.match(/^(Greater|Lesser|Supreme|Superior|Minor|Major)\s+(.+?)\s+(Potion|Elixir|Oil)$/i);
    if (qualifierMatch) {
        const found = fuzzyLookupItem(`${qualifierMatch[3]} of ${qualifierMatch[1]} ${qualifierMatch[2]}`);
        if (found) return found.name;
    }

    // Phase 4: Spell Scrolls — "Scroll of X" or "X Scroll" patterns
    // DB stores "Spell Scroll (Nth Level)" — no per-spell entries.
    // Keep the descriptive name the LLM generated (it's better for display).
    // Just normalize format: "X Scroll" → "Scroll of X"
    const scrollSuffix = name.match(/^(.+?)\s+scroll$/i);
    if (scrollSuffix) {
        return `Scroll of ${scrollSuffix[1]}`;
    }

    // Phase 5: "Potion of X" already correct form — try stripping "Potion of" for partial match
    const potionOf = name.match(/^potion\s+of\s+(.+)$/i);
    if (potionOf) {
        // Try the full name again with capitalization fixes
        const variants = [
            `Potion of ${potionOf[1].charAt(0).toUpperCase()}${potionOf[1].slice(1)}`,
            `Potion of ${potionOf[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}`,
        ];
        for (const v of variants) {
            const found = fuzzyLookupItem(v);
            if (found) return found.name;
        }
    }

    // Phase 6: Weapon/armor with trailing "+N" → "+N Weapon"
    // "Longsword +1" → "+1 Longsword"
    const bonusTrailing = name.match(/^(.+?)\s*\+(\d)$/);
    if (bonusTrailing) {
        const rewritten = `+${bonusTrailing[2]} ${bonusTrailing[1]}`;
        const found = fuzzyLookupItem(rewritten);
        if (found) return found.name;
    }

    return name;
}

/**
 * Spell level ordinal mapping for scroll lookup.
 */
const SPELL_LEVEL_ORDINALS = ['Cantrip', '1st Level', '2nd Level', '3rd Level', '4th Level', '5th Level', '6th Level', '7th Level', '8th Level', '9th Level'];

/**
 * Auto-resolve patterned magic items (scrolls, enspelled items, etc.)
 * Returns enriched fields { magic, magicNotes, equipmentData } or null if no pattern detected.
 *
 * Patterns:
 *   "Scroll of Fireball" → magic=true, magicNotes="Fireball", equipmentData={name:"Spell Scroll (3rd Level)", ...}
 *   "Scroll of Cure Wounds" → looks up spell level → assigns correct base
 *   "Enspelled Staff" → looks up base item
 */
function resolvePatternedMagicItem(name) {
    // Pattern 1: "Scroll of X" → Spell Scroll base + spell as descriptor
    const scrollMatch = name.match(/^scroll\s+of\s+(.+)$/i);
    if (scrollMatch) {
        const spellName = scrollMatch[1].trim();
        const spell = lookupSpellByName(spellName);
        const level = spell?.level ?? null;

        let baseItem = null;
        if (level !== null) {
            const ordinal = SPELL_LEVEL_ORDINALS[level] || `${level}th Level`;
            const baseSearchName = `Spell Scroll (${ordinal})`;
            const results = searchMagicItems(baseSearchName);
            baseItem = results.find(r => r.name.toLowerCase() === baseSearchName.toLowerCase()) || results[0] || null;
        }

        return {
            magic: true,
            magicNotes: spellName,
            equipmentData: baseItem ? { name: baseItem.name, type: 'SC', _magic: true, spellLevel: level } : null,
        };
    }

    // Pattern 2: "Potion of X" — mark as magic if found in DB
    const potionMatch = name.match(/^potion\s+of\s+(.+)$/i);
    if (potionMatch) {
        const found = fuzzyLookupItem(name);
        if (found) {
            return {
                magic: true,
                magicNotes: '',
                equipmentData: { name: found.name, type: 'P', _magic: true },
            };
        }
    }

    return null;
}

function persist() {
    saveV2Inventory(v2Inventory);
    renderV2Inventory();
    renderV2CharacterPanel();
}

function normalizeType(val) {
    if (!val) return 'none';
    const t = String(val).toLowerCase().trim();
    return VALID_TYPES.has(t) ? t : 'none';
}

function enforceSingleArmor(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'armor' || !isItemEquipped(item)) return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'armor' && isItemEquipped(v2Inventory[i])) {
            v2Inventory[i].location = 'stored';
        }
    }
}

function enforceSingleShield(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'shield' || !isItemEquipped(item)) return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'shield' && isItemEquipped(v2Inventory[i])) {
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
        const shieldBonusAc = match.bonusAc ? (parseInt(String(match.bonusAc).replace(/[^-\d]/g, '')) || 0) : 0;
        return { name: match.name, ac: (match.ac || 2) + shieldBonusAc, _magic: !!match._magic };
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
        case 'attune': return handleAttune(args);
        case 'unattune': return handleUnattune(args);
        case 'charges': return handleCharges(args);
        default: return `Unknown inventory action: ${action}`;
    }
}

function handleAdd(args) {
    const rawName = args.name?.trim();
    if (!rawName) return 'Error: item name is required for add action';

    const type = normalizeType(args.type);
    const magic = !!args.magic;
    const canonicalName = (type === 'none') ? normalizeItemName(rawName) : rawName;
    const equipData = (type !== 'none') ? resolveEquipmentData(canonicalName, type, magic) : null;

    // For non-equipment items, attempt pattern resolution (scrolls, potions, etc.)
    const pattern = (type === 'none') ? resolvePatternedMagicItem(canonicalName) : null;

    const item = createDefaultItem({
        name: equipData?.name || canonicalName,
        quantity: Math.max(1, parseInt(args.quantity) || 1),
        rarity: normalizeRarity(args.rarity ?? 0),
        location: args.location === 'equipped' ? 'equipped' : 'stored',
        type,
        magic: equipData ? !!equipData._magic : (pattern?.magic || magic),
        magicNotes: args.notes || args.magic_notes || pattern?.magicNotes || '',
        charges: args.charges !== undefined && args.charges !== null ? Math.max(0, parseInt(args.charges) || 0) : null,
        equipmentData: equipData || pattern?.equipmentData || null,
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
    if (args.notes !== undefined || args.magic_notes !== undefined) {
        const newNotes = (args.notes || args.magic_notes || '').trim();
        if (newNotes !== (item.magicNotes || '')) {
            item.magicNotes = newNotes;
        }
    }
    if (args.magic !== undefined) item.magic = !!args.magic;
    if (args.charges !== undefined) {
        item.charges = args.charges === null ? null : Math.max(0, parseInt(args.charges) || 0);
    }
    if (args.location !== undefined) {
        if (args.location === 'stored') {
            item.location = 'stored';
        } else if (item.location !== 'attuned') {
            item.location = 'equipped';
            if (item.type === 'armor') enforceSingleArmor(idx);
            if (item.type === 'shield') enforceSingleShield(idx);
        }
    }
    if (args.magic === false && item.location === 'attuned') {
        item.location = 'equipped';
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
    if (location === 'stored') {
        item.location = 'stored';
    } else if (item.location === 'attuned') {
        // Already attuned (superset of equipped) -- preserve attunement
    } else {
        item.location = location;
    }
    if (isItemEquipped(item)) {
        if (item.type === 'armor') enforceSingleArmor(idx);
        if (item.type === 'shield') enforceSingleShield(idx);
    }
    persist();
    return `Item ${isItemEquipped(item) ? 'equipped' : 'unequipped'}: "${item.name}"`;
}

function handleAttune(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const item = v2Inventory[idx];
    if (item.location === 'attuned') return `"${item.name}" is already attuned`;
    if (!isItemEquipped(item)) {
        item.location = 'equipped';
        if (item.type === 'armor') enforceSingleArmor(idx);
        if (item.type === 'shield') enforceSingleShield(idx);
    }
    item.location = 'attuned';
    persist();
    return `Item attuned: "${item.name}"`;
}

function handleUnattune(args) {
    const idx = resolveIndex(args.index);
    if (idx < 0 || idx >= v2Inventory.length) return `Error: item not found at index ${args.index}`;

    const item = v2Inventory[idx];
    if (item.location !== 'attuned') return `"${item.name}" is not attuned`;
    item.location = 'equipped';
    persist();
    return `Item unattuned: "${item.name}" (still equipped)`;
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
