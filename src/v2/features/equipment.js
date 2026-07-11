/**
 * V1 Character System - Equipment
 * Fetch and parse equipment data from CDN.
 * Armor AC calculation, weapon attack/damage computation.
 */

import { fetchEquipment, fetchMagicItems } from '../data/sources.js';

let _parsedArmor = null;
let _parsedWeapons = null;
let _parsedShields = null;

/**
 * Load and parse all equipment from CDN.
 */
async function ensureEquipmentParsed() {
    if (_parsedArmor) return;

    const data = await fetchEquipment();
    if (!data?.baseitem && !data?.itemEntry) {
        _parsedArmor = [];
        _parsedWeapons = [];
        _parsedShields = [];
        return;
    }

    const items = data.baseitem || data.itemEntry || [];
    _parsedArmor = [];
    _parsedWeapons = [];
    _parsedShields = [];

    for (const item of items) {
        if (item.armor) {
            if (item.name?.toLowerCase().includes('shield')) {
                _parsedShields.push(parseShield(item));
            } else {
                _parsedArmor.push(parseArmor(item));
            }
        } else if (item.weapon || item.weaponCategory) {
            _parsedWeapons.push(parseWeapon(item));
        }
    }
}

/**
 * Get all available armor items.
 */
export async function getAvailableArmor() {
    await ensureEquipmentParsed();
    return _parsedArmor;
}

/**
 * Get all available weapons.
 */
export async function getAvailableWeapons() {
    await ensureEquipmentParsed();
    return _parsedWeapons;
}

/**
 * Get shields.
 */
export async function getAvailableShields() {
    await ensureEquipmentParsed();
    return _parsedShields;
}

// ─── Magic Item Support ────────────────────────────────────

let _magicWeapons = null;
let _magicArmor = null;

async function ensureMagicParsed() {
    if (_magicWeapons) return;
    await ensureEquipmentParsed();
    const data = await fetchMagicItems();
    _magicWeapons = [];
    _magicArmor = [];

    const ARMOR_TYPES = new Set(['LA', 'MA', 'HA']);

    // Phase 1: Direct magic items from items.json
    for (const item of (data.items || [])) {
        if (item.weaponCategory && (item.dmg1 || item.dmgType)) {
            _magicWeapons.push({ ...parseWeapon(item), _magic: true, rarity: item.rarity || 'unknown' });
        } else if (item.type && (ARMOR_TYPES.has(item.type) || item.type === 'S')) {
            if (item.type === 'S') continue;
            _magicArmor.push({ ...parseArmor(item), _magic: true, rarity: item.rarity || 'unknown' });
        }
    }

    // Phase 2: Generate +1/+2/+3 variants from magicvariants.json
    for (const variant of (data.variants || [])) {
        const inherits = variant.inherits;
        if (!inherits) continue;
        const prefix = inherits.namePrefix || '';
        const suffix = inherits.nameSuffix || '';
        const bonusW = inherits.bonusWeapon ? parseInt(String(inherits.bonusWeapon).replace(/[^-\d]/g, '')) || 0 : 0;
        const bonusA = inherits.bonusAc ? parseInt(String(inherits.bonusAc).replace(/[^-\d]/g, '')) || 0 : 0;
        const rarity = inherits.rarity || variant.rarity || 'uncommon';

        if (variant.requires) {
            for (const req of variant.requires) {
                if (req.weapon && _parsedWeapons) {
                    for (const base of _parsedWeapons) {
                        _magicWeapons.push({
                            ...base,
                            name: `${prefix}${base.name}${suffix}`.trim(),
                            bonus: bonusW || base.bonus,
                            _magic: true,
                            rarity,
                        });
                    }
                } else if (req.armor && _parsedArmor) {
                    for (const base of _parsedArmor) {
                        _magicArmor.push({
                            ...base,
                            name: `${prefix}${base.name}${suffix}`.trim(),
                            bonusAc: bonusA || base.bonusAc,
                            _magic: true,
                            rarity,
                        });
                    }
                }
            }
        }
    }
}

/**
 * Search equipment with optional magic items.
 * @param {string} query - Search query (min 2 chars)
 * @param {'weapon'|'armor'} kind
 * @param {boolean} includeMagic
 * @returns {Promise<object[]>}
 */
export async function searchEquipment(query, kind, includeMagic = false) {
    await ensureEquipmentParsed();
    if (includeMagic) await ensureMagicParsed();

    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    let pool;
    if (kind === 'weapon') {
        pool = [..._parsedWeapons];
        if (includeMagic && _magicWeapons) pool.push(..._magicWeapons);
    } else {
        pool = [..._parsedArmor];
        if (includeMagic && _magicArmor) pool.push(..._magicArmor);
    }

    const seen = new Set();
    const results = [];
    for (const item of pool) {
        if (!item.name.toLowerCase().includes(q)) continue;
        const key = item.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
        if (results.length >= 25) break;
    }
    return results;
}

function parseArmor(item) {
    let type = 'LA'; // light
    if (item.type === 'HA') type = 'HA';
    else if (item.type === 'MA') type = 'MA';
    else if (item.stealth) type = 'MA'; // medium typically has stealth disadvantage
    else if (item.ac && item.ac >= 14 && !item.dexCap && item.dexCap !== 0) type = 'HA';

    return {
        name: item.name,
        source: item.source,
        type,
        ac: item.ac || 10,
        dexCap: type === 'MA' ? 2 : (type === 'HA' ? 0 : null),
        strReq: item.strength || 0,
        stealthDis: !!item.stealth,
        cost: item.value || 0,
        weight: item.weight || 0,
        bonusAc: item.bonusAc ? parseInt(String(item.bonusAc).replace(/[^-\d]/g, '')) || 0 : 0,
    };
}

function parseShield(item) {
    return {
        name: item.name,
        source: item.source,
        ac: item.ac || 2,
        cost: item.value || 0,
        weight: item.weight || 0,
    };
}

function parseWeapon(item) {
    const properties = (item.property || []).map(p => {
        if (typeof p === 'string') return p;
        return p.abbreviation || p;
    });

    let damageDice = '';
    let damageType = '';
    if (item.dmg1) {
        damageDice = item.dmg1;
    }
    if (item.dmgType) {
        const typeMap = { B: 'bludgeoning', P: 'piercing', S: 'slashing' };
        damageType = typeMap[item.dmgType] || item.dmgType;
    }

    const isFinesse = properties.some(p =>
        typeof p === 'string' && p.toLowerCase().includes('f') || p === 'F',
    );
    const isRanged = item.type === 'R' || properties.some(p => p === 'A' || p === 'AF');
    const isTwoHanded = properties.some(p => p === '2H');
    const isHeavy = properties.some(p => p === 'H');
    const isLight = properties.some(p => p === 'L');

    let versatileDice = '';
    if (item.dmg2) versatileDice = item.dmg2;

    const bonus = item.bonusWeapon
        ? parseInt(String(item.bonusWeapon).replace(/[^-\d]/g, '')) || 0
        : 0;

    return {
        name: item.name,
        source: item.source,
        damageDice,
        versatileDice,
        damageType,
        properties,
        isFinesse,
        isRanged,
        isTwoHanded,
        isHeavy,
        isLight,
        attackType: isRanged ? 'rw' : 'mw',
        bonus,
        cost: item.value || 0,
        weight: item.weight || 0,
        weaponCategory: item.weaponCategory || 'simple',
    };
}

/**
 * Compute AC from equipped armor, shield, DEX mod, and class features.
 * @param {object|null} armor - Parsed armor object
 * @param {number} shieldAc - Shield AC value (0 if no shield; typically 2 for mundane, 3 for +1, etc.)
 * @param {number} dexMod
 * @param {object} [overrides] - { unarmoredFormula, defenseBonus, wondrousAcBonus, mediumArmorMaster }
 * @returns {number}
 */
export function computeAC(armor, shieldAc, dexMod, overrides = {}) {
    const {
        unarmoredFormula,
        defenseBonus = 0,
        wondrousAcBonus = 0,
        spellAcBonus = 0,
        acFloor = null,
        mediumArmorMaster = false,
    } = overrides;

    let ac;
    if (!armor) {
        ac = unarmoredFormula ?? (10 + dexMod);
    } else {
        const type = armor.type;
        if (type === 'LA') {
            ac = armor.ac + dexMod;
        } else if (type === 'MA') {
            const cap = mediumArmorMaster ? 3 : 2;
            ac = armor.ac + Math.min(dexMod, cap);
        } else {
            ac = armor.ac;
        }
        ac += armor.bonusAc || 0;
    }

    ac += defenseBonus;
    ac += wondrousAcBonus;
    ac += spellAcBonus;
    if (shieldAc) ac += shieldAc;
    if (acFloor != null) ac = Math.max(ac, acFloor);
    return ac;
}

/**
 * Compute weapon attack and damage stats.
 * @param {object} weapon - Parsed weapon object
 * @param {object} mods - { str, dex, cha, ... } ability modifiers
 * @param {number} proficiency
 * @param {object} [bonuses] - { attackBonus, damageBonus, overrideAbility, martialArtsDie }
 * @returns {object}
 */
export function computeWeaponStats(weapon, mods, proficiency, bonuses = {}) {
    const { attackBonus = 0, damageBonus = 0, overrideAbility, martialArtsDie } = bonuses;

    let abilityMod;
    if (overrideAbility) {
        abilityMod = mods[overrideAbility] || 0;
    } else if (weapon.isFinesse) {
        abilityMod = Math.max(mods.str || 0, mods.dex || 0);
    } else if (weapon.isRanged) {
        abilityMod = mods.dex || 0;
    } else {
        abilityMod = mods.str || 0;
    }

    const magicBonus = weapon.bonus || 0;
    const hit = abilityMod + proficiency + magicBonus + attackBonus;
    const totalDmgMod = abilityMod + magicBonus + damageBonus;

    let damageDice = weapon.damageDice;
    if (martialArtsDie) {
        const weaponDieVal = parseDieMax(damageDice);
        if (martialArtsDie > weaponDieVal) {
            damageDice = `1d${martialArtsDie}`;
        }
    }

    const dmgStr = totalDmgMod >= 0
        ? `${damageDice} + ${totalDmgMod}`
        : `${damageDice} - ${Math.abs(totalDmgMod)}`;

    let versatileStr = null;
    if (weapon.versatileDice) {
        versatileStr = totalDmgMod >= 0
            ? `${weapon.versatileDice} + ${totalDmgMod}`
            : `${weapon.versatileDice} - ${Math.abs(totalDmgMod)}`;
    }

    return {
        name: weapon.name,
        computedHit: hit,
        computedDamage: dmgStr,
        computedVersatile: versatileStr,
        damageType: weapon.damageType,
        properties: weapon.properties,
        isRanged: weapon.isRanged,
        isFinesse: weapon.isFinesse,
        isTwoHanded: weapon.isTwoHanded,
        isHeavy: weapon.isHeavy,
        isLight: weapon.isLight,
        customNotes: weapon.customNotes || null,
    };
}

function parseDieMax(diceStr) {
    if (!diceStr) return 0;
    const m = diceStr.match(/d(\d+)/);
    return m ? parseInt(m[1]) : 0;
}
