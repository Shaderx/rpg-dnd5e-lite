/**
 * D&D 5e Lite - Sidekick
 * Bestiary fetch, creature action parsing, weapon cross-ref,
 * stat scaling engine, and sidekick class constants.
 */

import { character, bestiaryCache, equipmentItemCache, setEquipmentItemCache, extensionSettings } from '../core/state.js';
import { collectFeatEffects } from './featEffects.js';
import { characterV1 } from '../v1/core/state.js';
import { characterV2 } from '../v2/core/characterState.js';
import {
    buildUpcastTable,
    parseUpcastInfo,
    parseUpcastExtra,
    formatSpellRange,
    parseCantripRangeScaling,
    parseBeamCount,
    getStatsAtCastLevel,
    ordinal as spellOrdinal,
    collectSpellScalingText,
    isPlayerChosenDamageType,
} from './spellScaling.js';

const CDN_DATA = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

// ─── Constants ──────────────────────────────────────────────

export const SIDEKICK_MAX_ATTUNEMENT = 3;

/**
 * Count total attuned items across armor, weapons, and gear for a sidekick.
 */
export function getSidekickAttunedCount(sk) {
    let count = 0;
    if (sk.equippedArmor?.attuned) count++;
    count += (sk.weapons || []).filter(w => w.attuned).length;
    count += (sk.items || []).filter(it => it.attuned).length;
    return count;
}

export const ASI_LEVELS = {
    expert:      [4, 8, 10, 12, 16, 19],
    spellcaster: [4, 8, 12, 16, 18],
    warrior:     [4, 8, 12, 14, 16, 19],
};

export const ALL_SKILLS = [
    'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception',
    'history', 'insight', 'intimidation', 'investigation', 'medicine',
    'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleightOfHand', 'stealth', 'survival',
];

const SKILL_ABILITIES = {
    acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str',
    deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
    investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
    performance: 'cha', persuasion: 'cha', religion: 'int', sleightOfHand: 'dex',
    stealth: 'dex', survival: 'wis',
};

export const SKILL_LABELS = {
    acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
    athletics: 'Athletics', deception: 'Deception', history: 'History',
    insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
    medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
    performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
    sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival',
};

const ABILITY_LABELS = {
    str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

export const SIDEKICK_TYPES = {
    expert: {
        label: 'Expert',
        subtypes: [],
        saveOptions: ['dex', 'int', 'cha'],
        skillCount: 5,
        skillOptions: null,
    },
    spellcaster: {
        label: 'Spellcaster',
        subtypes: [
            { key: 'mage',    label: 'Mage',    ability: 'int', list: 'Wizard' },
            { key: 'healer',  label: 'Healer',  ability: 'wis', list: 'Cleric|Druid' },
            { key: 'prodigy', label: 'Prodigy', ability: 'cha', list: 'Bard|Warlock' },
        ],
        saveOptions: ['wis', 'int', 'cha'],
        skillCount: 2,
        skillOptions: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'performance', 'persuasion', 'religion'],
    },
    warrior: {
        label: 'Warrior',
        subtypes: [
            { key: 'attacker', label: 'Attacker', effect: '+2 to attack rolls' },
            { key: 'defender', label: 'Defender', effect: 'Reaction: impose disadvantage on attack vs ally' },
        ],
        saveOptions: ['str', 'dex', 'con'],
        skillCount: 2,
        skillOptions: ['acrobatics', 'animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    },
};

export const CANTRIP_PROGRESSION    = [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
export const SPELLS_KNOWN_PROGRESSION = [1,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11];
export const SPELL_SLOT_TABLE = [
    [2,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],
    [4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],
    [4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],
    [4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],
    [4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2],
];

// ─── Bestiary ───────────────────────────────────────────────

let _bestiaryIndex = null;
let _bestiaryIndexInflight = null;

export async function fetchBestiaryIndex() {
    if (_bestiaryIndex) return _bestiaryIndex;
    if (_bestiaryIndexInflight) return _bestiaryIndexInflight;
    _bestiaryIndexInflight = fetch(`${CDN_DATA}/bestiary/index.json`, { signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => { _bestiaryIndex = data; return data; })
        .catch(err => { console.warn('[D&D 5e Lite] Bestiary index fetch failed:', err); return null; })
        .finally(() => { _bestiaryIndexInflight = null; });
    return _bestiaryIndexInflight;
}

const _bestiaryInflight = new Map();

export async function fetchBestiarySource(sourceKey) {
    if (bestiaryCache.has(sourceKey)) return bestiaryCache.get(sourceKey);
    if (_bestiaryInflight.has(sourceKey)) return _bestiaryInflight.get(sourceKey);

    const index = await fetchBestiaryIndex();
    if (!index) return null;

    const filename = index[sourceKey];
    if (!filename) return null;

    const promise = Promise.all([
        fetch(`${CDN_DATA}/bestiary/${filename}`, { signal: AbortSignal.timeout(30000) }).then(r => r.ok ? r.json() : null),
        fetchTemplateData(),
    ])
        .then(([data]) => {
            const monsters = data?.monster || [];
            bestiaryCache.set(sourceKey, monsters);
            resolveBestiaryCopies(sourceKey);
            return bestiaryCache.get(sourceKey);
        })
        .catch(err => { console.warn(`[D&D 5e Lite] Bestiary fetch failed for "${sourceKey}":`, err); return null; })
        .finally(() => { _bestiaryInflight.delete(sourceKey); });

    _bestiaryInflight.set(sourceKey, promise);
    return promise;
}

function findBaseCreature(name, source) {
    for (const [, monsters] of bestiaryCache) {
        const found = monsters.find(m => m.name === name && m.source === source && !m._copy);
        if (found) return found;
    }
    return null;
}

// ─── Creature Template Engine ───────────────────────────────

let _templateData = null;
let _templateInflight = null;

async function fetchTemplateData() {
    if (_templateData) return _templateData;
    if (_templateInflight) return _templateInflight;
    _templateInflight = fetch(`${CDN_DATA}/bestiary/template.json`, { signal: AbortSignal.timeout(15000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => { _templateData = data; return data; })
        .catch(err => { console.warn('[D&D 5e Lite] Template fetch failed:', err); return null; })
        .finally(() => { _templateInflight = null; });
    return _templateInflight;
}

function findTemplate(name, source) {
    if (!_templateData?.monsterTemplate) return null;
    return _templateData.monsterTemplate.find(t => t.name === name && t.source === source) || null;
}

function replaceTemplatePlaceholders(obj, creatureName) {
    if (typeof obj !== 'string') {
        if (Array.isArray(obj)) return obj.map(item => replaceTemplatePlaceholders(item, creatureName));
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(obj)) {
                result[k] = replaceTemplatePlaceholders(v, creatureName);
            }
            return result;
        }
        return obj;
    }
    const titleName = creatureName.replace(/\b\w/g, c => c.toUpperCase());
    return obj
        .replace(/<\$title_short_name\$>/g, titleName)
        .replace(/<\$short_name\$>/g, creatureName.toLowerCase())
        .replace(/<\$title_name\$>/g, titleName)
        .replace(/<\$name\$>/g, creatureName);
}

function applyModOperation(target, field, op) {
    if (!op || !op.mode) return;

    switch (op.mode) {
        case 'appendArr': {
            const items = Array.isArray(op.items) ? op.items : [op.items];
            if (!Array.isArray(target[field])) target[field] = [];
            target[field].push(...items);
            break;
        }
        case 'appendIfNotExistsArr': {
            const items = Array.isArray(op.items) ? op.items : [op.items];
            if (!Array.isArray(target[field])) target[field] = [];
            for (const item of items) {
                if (!target[field].includes(item)) target[field].push(item);
            }
            break;
        }
        case 'prependArr': {
            const items = Array.isArray(op.items) ? op.items : [op.items];
            if (!Array.isArray(target[field])) target[field] = [];
            target[field].unshift(...items);
            break;
        }
        case 'replaceArr': {
            const { replace, items } = op;
            if (Array.isArray(target[field]) && replace) {
                const idx = target[field].findIndex(e =>
                    (typeof e === 'object' && e?.name === replace) || e === replace,
                );
                if (idx >= 0) {
                    const arr = Array.isArray(items) ? items : [items];
                    target[field].splice(idx, 1, ...arr);
                }
            }
            break;
        }
        case 'replaceTxt': {
            if (op.replace && op.with) {
                target[field] = applyTextReplace(target[field], op.replace, op.with);
            }
            break;
        }
    }
}

function applySpecialMods(target, mods) {
    if (!Array.isArray(mods)) return;
    for (const mod of mods) {
        if (!mod?.mode) continue;
        if (mod.mode === 'addSenses') {
            const s = mod.senses;
            if (!s) continue;
            if (!Array.isArray(target.senses)) target.senses = [];
            const entry = typeof s === 'string' ? s : `${s.type} ${s.range} ft.`;
            if (!target.senses.some(e => e.includes?.(s.type || s))) {
                target.senses.push(entry);
            }
        } else if (mod.mode === 'addSkills') {
            if (!mod.skills) continue;
            if (!target.skill) target.skill = {};
            for (const [sk, bonus] of Object.entries(mod.skills)) {
                const existing = parseInt(target.skill[sk]) || 0;
                target.skill[sk] = `+${existing + bonus}`;
            }
        }
    }
}

function applyTemplate(creature, template) {
    if (!template?.apply) return;

    const { _root, _mod } = template.apply;

    if (_root) {
        for (const [key, val] of Object.entries(_root)) {
            if (key === 'speed' && creature.speed && typeof creature.speed === 'object' && typeof val === 'object') {
                Object.assign(creature.speed, val);
            } else {
                creature[key] = JSON.parse(JSON.stringify(val));
            }
        }
    }

    if (_mod) {
        for (const [field, op] of Object.entries(_mod)) {
            if (field === '_') {
                applySpecialMods(creature, op);
            } else {
                applyModOperation(creature, field, op);
            }
        }
    }

    replaceTemplatePlaceholdersInPlace(creature);
}

function replaceTemplatePlaceholdersInPlace(creature) {
    const name = creature.name;
    if (!name) return;
    for (const field of ['trait', 'action', 'reaction', 'legendary', 'spellcasting']) {
        if (Array.isArray(creature[field])) {
            creature[field] = replaceTemplatePlaceholders(creature[field], name);
        }
    }
}

function applyTextReplace(obj, replace, withStr) {
    if (typeof obj === 'string') {
        return obj.replace(new RegExp(replace, 'gi'), withStr);
    }
    if (Array.isArray(obj)) return obj.map(item => applyTextReplace(item, replace, withStr));
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = applyTextReplace(v, replace, withStr);
        }
        return result;
    }
    return obj;
}

function resolveBestiaryCopies(sourceKey) {
    const monsters = bestiaryCache.get(sourceKey);
    if (!monsters) return;

    let resolvedCount = 0;
    let failedCount = 0;

    const resolved = monsters.map(m => {
        if (!m._copy) return m;

        const base = findBaseCreature(m._copy.name, m._copy.source);
        if (!base) { failedCount++; return m; }

        let merged = JSON.parse(JSON.stringify(base));

        const mod = m._copy._mod;
        if (mod) {
            for (const [field, op] of Object.entries(mod)) {
                if (field === '*' && op.mode === 'replaceTxt' && op.replace && op.with) {
                    merged = applyTextReplace(merged, op.replace, op.with);
                } else if (field !== '*') {
                    applyModOperation(merged, field, op);
                }
            }
        }

        if (Array.isArray(m._copy._templates)) {
            if (!_templateData) {
                console.warn(`[D&D 5e Lite] Template data not loaded — racial traits for "${m.name}" will be missing`);
            }
            for (const tRef of m._copy._templates) {
                const tmpl = findTemplate(tRef.name, tRef.source);
                if (tmpl) {
                    applyTemplate(merged, tmpl);
                } else {
                    console.warn(`[D&D 5e Lite] Template "${tRef.name}" (${tRef.source}) not found for "${m.name}"`);
                }
            }
        }

        for (const [key, val] of Object.entries(m)) {
            if (key === '_copy') continue;
            merged[key] = val;
        }

        delete merged._copy;
        merged._resolved = true;
        resolvedCount++;
        return merged;
    });

    if (resolvedCount > 0 || failedCount > 0) {
        console.log(`[D&D 5e Lite] ${sourceKey}: resolved ${resolvedCount} _copy creatures` +
            (failedCount > 0 ? `, ${failedCount} failed (base not cached)` : '') +
            (!_templateData ? ' [WARNING: templates not loaded]' : ''));
    }
    bestiaryCache.set(sourceKey, resolved);
}

const DEFAULT_BESTIARY_SOURCES = ['ESK', 'MM', 'XMM'];

export async function preloadBestiarySources() {
    const [index] = await Promise.all([fetchBestiaryIndex(), fetchTemplateData()]);
    if (!index) return;
    await Promise.all(
        DEFAULT_BESTIARY_SOURCES
            .filter(k => index[k])
            .map(k => fetchBestiarySource(k)),
    );
    for (const key of DEFAULT_BESTIARY_SOURCES) {
        if (bestiaryCache.has(key)) resolveBestiaryCopies(key);
    }
}

export function getLoadedSourceKeys() {
    return [...bestiaryCache.keys()];
}

export function getAvailableSourceKeys() {
    return _bestiaryIndex ? Object.keys(_bestiaryIndex).sort() : [];
}

function getCreatureTypeStr(m) {
    const t = m.type;
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object') {
        const inner = t.type;
        if (typeof inner === 'string') return inner;
        if (inner && typeof inner === 'object' && Array.isArray(inner.choose)) return inner.choose[0] || '?';
    }
    return '?';
}

export function getCreatureList(sourceKey) {
    const monsters = bestiaryCache.get(sourceKey);
    if (!monsters) return [];
    return monsters
        .filter(m => m.name && !m._copy)
        .map(m => ({
            name: m.name,
            source: m.source || sourceKey,
            cr: m.cr ?? '?',
            type: getCreatureTypeStr(m),
            size: Array.isArray(m.size) ? m.size[0] : m.size || '?',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export const CREATURE_TYPES = [
    'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
    'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
];

/**
 * Search creatures across all cached bestiary sources.
 * Deduplicates by name. Filters by creature type and/or name query.
 * If typeFilter is set but query is empty, lists all creatures of that type.
 */
export function searchCreatures(query, typeFilter) {
    const hasQuery = query && query.length >= 2;
    if (!hasQuery && !typeFilter) return [];
    const q = hasQuery ? query.toLowerCase() : null;
    const tf = typeFilter ? typeFilter.toLowerCase() : null;
    const seen = new Set();
    const results = [];
    for (const [, monsters] of bestiaryCache) {
        for (const m of monsters) {
            if (m._copy || !m.name) continue;
            if (seen.has(m.name)) continue;
            const mType = getCreatureTypeStr(m).toLowerCase();
            if (tf && mType !== tf) continue;
            if (q && !m.name.toLowerCase().includes(q)) continue;
            seen.add(m.name);
            const hp = m.hp?.average ?? '?';
            const ac = typeof m.ac?.[0] === 'number' ? m.ac[0] : m.ac?.[0]?.ac ?? '?';
            results.push({
                name: m.name,
                source: m.source,
                cr: m.cr ?? '?',
                type: getCreatureTypeStr(m),
                size: Array.isArray(m.size) ? m.size[0] : m.size || '?',
                hp, ac,
            });
        }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
}

/**
 * Find all source versions of a creature by name across all cached sources.
 */
export function findCreatureVersions(name) {
    const versions = [];
    for (const [, monsters] of bestiaryCache) {
        for (const m of monsters) {
            if (m._copy || m.name !== name) continue;
            versions.push({
                name: m.name,
                source: m.source,
                cr: m.cr ?? '?',
                hp: m.hp?.average ?? '?',
                ac: typeof m.ac?.[0] === 'number' ? m.ac[0] : m.ac?.[0]?.ac ?? '?',
            });
        }
    }
    return versions;
}

export function getCreatureStats(name, source) {
    for (const [, monsters] of bestiaryCache) {
        const found = monsters.find(m => m.name === name && m.source === source);
        if (found) return found;
    }
    return null;
}

// ─── Equipment Items (Weapons + Armor + Shields + Mundane Gear) ────────────

const ARMOR_TYPES = new Set(['LA', 'MA', 'HA']);
let _mundaneItemCache = null;

let _equipItemInflight = null;

export async function fetchEquipmentItems() {
    if (equipmentItemCache) return equipmentItemCache;
    if (_equipItemInflight) return _equipItemInflight;
    _equipItemInflight = fetch(`${CDN_DATA}/items-base.json`, { signal: AbortSignal.timeout(20000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const items = data?.baseitem || [];
            const cache = new Map();
            const mundane = new Map();
            for (const item of items) {
                const rawType = (item.type || '').split('|')[0];
                const isWeapon = !!(item.weapon || item.weaponCategory);
                const isArmor = ARMOR_TYPES.has(rawType);
                const isShield = rawType === 'S';
                const key = item.name.toLowerCase();
                if (isWeapon || isArmor || isShield) {
                    if (cache.has(key)) continue;
                    cache.set(key, {
                        ...item,
                        _kind: isWeapon ? 'weapon' : isArmor ? 'armor' : 'shield',
                        _armorType: isArmor ? rawType : isShield ? 'S' : null,
                    });
                } else {
                    if (mundane.has(key)) continue;
                    mundane.set(key, { ...item, _kind: 'gear' });
                }
            }
            _mundaneItemCache = mundane;
            setEquipmentItemCache(cache);
            return cache;
        })
        .catch(err => { console.warn('[D&D 5e Lite] Equipment items fetch failed:', err); return null; })
        .finally(() => { _equipItemInflight = null; });
    return _equipItemInflight;
}

let _magicWeaponCache = null;
let _magicArmorCache = null;
let _magicItemCache = null;
let _magicItemInflight = null;

export async function fetchMagicItems() {
    if (_magicWeaponCache && _magicItemCache) return;
    if (_magicItemInflight) return _magicItemInflight;
    _magicItemInflight = (async () => {
        try {
            const [itemsResp, variantsResp] = await Promise.all([
                fetch(`${CDN_DATA}/items.json`, { signal: AbortSignal.timeout(25000) }),
                fetch(`${CDN_DATA}/magicvariants.json`, { signal: AbortSignal.timeout(20000) }),
            ]);
            const itemsData = itemsResp.ok ? await itemsResp.json() : {};
            const variantsData = variantsResp.ok ? await variantsResp.json() : {};

            const weaponCache = new Map();
            const armorCache = new Map();
            const itemCache = new Map();

            for (const item of (itemsData.item || [])) {
                const key = `${item.name}|${item.source}`.toLowerCase();
                const rawType = (item.type || '').split('|')[0];
                const isWeapon = !!(item.weaponCategory && (item.dmg1 || item.dmgType));
                const isArmor = ARMOR_TYPES.has(rawType);
                const isShield = rawType === 'S';

                if (isWeapon) {
                    if (!weaponCache.has(key)) weaponCache.set(key, { ...item, _kind: 'weapon', _magic: true });
                } else if (isArmor || isShield) {
                    if (!armorCache.has(key)) armorCache.set(key, {
                        ...item,
                        _kind: isArmor ? 'armor' : 'shield',
                        _armorType: isArmor ? rawType : 'S',
                        _magic: true,
                    });
                } else {
                    if (!itemCache.has(key)) itemCache.set(key, { ...item, _magic: true });
                }
            }

            const baseWeapons = [];
            const baseArmors = [];
            if (equipmentItemCache) {
                for (const [, item] of equipmentItemCache) {
                    if (item._kind === 'weapon') baseWeapons.push(item);
                    else if (item._kind === 'armor') baseArmors.push(item);
                }
            }

            for (const variant of (variantsData.magicvariant || [])) {
                const reqs = variant.requires || [];
                const inh = variant.inherits || {};
                const prefix = inh.namePrefix || '';
                if (!prefix) continue;

                if (reqs.some(r => r.weapon)) {
                    for (const base of baseWeapons) {
                        const vName = `${prefix}${base.name}`;
                        const vKey = `${vName}|${inh.source || ''}`.toLowerCase();
                        if (weaponCache.has(vKey)) continue;
                        weaponCache.set(vKey, {
                            ...base, name: vName,
                            source: inh.source || base.source,
                            bonusWeapon: inh.bonusWeapon || null,
                            rarity: inh.rarity || null,
                            _kind: 'weapon', _magic: true, _variant: true,
                        });
                    }
                }
                if (reqs.some(r => r.armor)) {
                    for (const base of baseArmors) {
                        const vName = `${prefix}${base.name}`;
                        const vKey = `${vName}|${inh.source || ''}`.toLowerCase();
                        if (armorCache.has(vKey)) continue;
                        armorCache.set(vKey, {
                            ...base, name: vName,
                            source: inh.source || base.source,
                            bonusAc: inh.bonusAc || null,
                            rarity: inh.rarity || null,
                            _magic: true, _variant: true,
                        });
                    }
                }
            }

            _magicWeaponCache = weaponCache;
            _magicArmorCache = armorCache;
            _magicItemCache = itemCache;
        } catch (err) {
            console.warn('[D&D 5e Lite] Magic items fetch failed:', err);
            _magicWeaponCache = _magicWeaponCache || new Map();
            _magicArmorCache = _magicArmorCache || new Map();
            _magicItemCache = _magicItemCache || new Map();
        } finally {
            _magicItemInflight = null;
        }
    })();
    return _magicItemInflight;
}

export const fetchMagicWeapons = fetchMagicItems;

export function isMagicWeaponsLoaded() {
    return !!_magicWeaponCache;
}

export function lookupItemByName(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    for (const cache of [_magicItemCache, _magicWeaponCache, _magicArmorCache]) {
        if (!cache) continue;
        for (const [k, item] of cache) {
            if (k.startsWith(key + '|') || k === key) return item;
        }
    }
    if (equipmentItemCache) {
        const base = equipmentItemCache.get(key);
        if (base) return base;
    }
    if (_mundaneItemCache) {
        const mundane = _mundaneItemCache.get(key);
        if (mundane) return mundane;
    }
    return null;
}

/**
 * Fuzzy item lookup for inventory entries.
 * Rules:
 *   - Magic items require EXACT name match (ignoring case and trailing parenthetical).
 *   - Mundane/base items allow fuzzy: strips parenthetical, normalizes "+N" prefixes.
 * Search priority: magic items (exact) > mundane gear > base equipment
 * "shortsword +1" resolves to "+1 Shortsword" in magic weapons.
 * "sword" does NOT match "Sword of Answering" — no partial matching for magic.
 */
export function fuzzyLookupItem(text) {
    if (!text) return null;
    // Strip trailing parenthetical (e.g. "Diamond (300gp)" → "Diamond")
    const cleaned = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!cleaned) return null;
    const key = cleaned.toLowerCase();

    // --- Phase 1: Exact match in magic caches (name must match exactly) ---
    const magicCaches = [_magicItemCache, _magicArmorCache, _magicWeaponCache];
    for (const cache of magicCaches) {
        if (!cache) continue;
        for (const [k, item] of cache) {
            const namePart = k.includes('|') ? k.split('|')[0] : k;
            if (namePart === key) return item;
        }
    }

    // --- Phase 2: Try "+N item" rewrite for magic weapon/armor variants ---
    // "shortsword +1" or "shortsword+1" → try "+1 shortsword"
    const bonusMatch = key.match(/^(.+?)\s*\+(\d)$/);
    if (bonusMatch) {
        const rewritten = `+${bonusMatch[2]} ${bonusMatch[1]}`.toLowerCase();
        for (const cache of [_magicWeaponCache, _magicArmorCache]) {
            if (!cache) continue;
            for (const [k, item] of cache) {
                const namePart = k.includes('|') ? k.split('|')[0] : k;
                if (namePart === rewritten) return item;
            }
        }
    }

    // --- Phase 3: Mundane/base items (exact match on name) ---
    if (_mundaneItemCache) {
        const mundane = _mundaneItemCache.get(key);
        if (mundane) return mundane;
    }
    if (equipmentItemCache) {
        const base = equipmentItemCache.get(key);
        if (base) return base;
    }

    // --- Phase 4: Mundane with bonus stripped (e.g. "shortsword +1" → base "shortsword") ---
    if (bonusMatch) {
        const baseName = bonusMatch[1].trim();
        if (equipmentItemCache) {
            const base = equipmentItemCache.get(baseName);
            if (base) return base;
        }
        if (_mundaneItemCache) {
            const mundane = _mundaneItemCache.get(baseName);
            if (mundane) return mundane;
        }
    }

    return null;
}

export function lookupSpellByName(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    for (const src of SPELL_SOURCES) {
        const spells = _spellSourceCache.get(src) || [];
        for (const s of spells) {
            if (s.name.toLowerCase() === key) return s;
        }
    }
    return null;
}

export function lookupCreatureByName(name) {
    if (!name) return null;
    for (const [, monsters] of bestiaryCache) {
        for (const m of monsters) {
            if (m.name === name && !m._copy) return m;
        }
    }
    return null;
}

export function searchMagicItems(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    const seen = new Set();
    if (_magicItemCache) {
        for (const [key, item] of _magicItemCache) {
            if (!key.includes(q)) continue;
            if (seen.has(item.name.toLowerCase())) continue;
            seen.add(item.name.toLowerCase());
            results.push(item);
        }
    }
    if (_mundaneItemCache) {
        for (const [key, item] of _mundaneItemCache) {
            if (!key.includes(q)) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(item);
        }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);
}

/**
 * Search equipment items by name, filtered by kind ('weapon', 'armor', 'shield', or 'all').
 * Set includeMagic=true to also search cached magic weapons.
 */
export function searchEquipment(query, kind, includeMagic) {
    if (!equipmentItemCache) return [];
    if (!query || query.length < 2) {
        if (kind === 'armor' || kind === 'shield') return getAllByKind(kind);
        return [];
    }
    const q = query.toLowerCase();
    const results = [];
    const seen = new Set();
    for (const [key, item] of equipmentItemCache) {
        if (kind && kind !== 'all' && item._kind !== kind) continue;
        if (!key.includes(q)) continue;
        results.push(item);
        seen.add(item.name.toLowerCase());
    }
    if (includeMagic) {
        if (_magicWeaponCache && kind === 'weapon') {
            for (const [key, item] of _magicWeaponCache) {
                if (!key.includes(q)) continue;
                if (seen.has(item.name.toLowerCase())) continue;
                seen.add(item.name.toLowerCase());
                results.push(item);
            }
        }
        if (_magicArmorCache && (kind === 'armor' || kind === 'shield' || kind === 'all')) {
            for (const [key, item] of _magicArmorCache) {
                if (kind !== 'all' && item._kind !== kind) continue;
                if (!key.includes(q)) continue;
                if (seen.has(item.name.toLowerCase())) continue;
                seen.add(item.name.toLowerCase());
                results.push(item);
            }
        }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 30);
}

function getAllByKind(kind) {
    if (!equipmentItemCache) return [];
    const results = [];
    for (const [, item] of equipmentItemCache) {
        if (item._kind === kind) results.push(item);
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
}

const WEAPON_PROP_LABELS = {
    '2H': 'Two-Handed', A: 'Ammunition', AF: 'Ammunition', BF: 'Burst Fire',
    F: 'Finesse', H: 'Heavy', L: 'Light', LD: 'Loading',
    R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown',
    V: 'Versatile', Vst: 'Vestige',
};

function expandPropertyCodes(rawProps) {
    if (!rawProps?.length) return [];
    const seen = new Set();
    const result = [];
    for (const raw of rawProps) {
        const code = typeof raw === 'string' ? raw.split('|')[0] : raw?.uid?.split('|')[0] || '';
        if (!code || seen.has(code)) continue;
        seen.add(code);
        result.push(WEAPON_PROP_LABELS[code] || code);
    }
    return result;
}

/**
 * Build a compact weapon descriptor from a CDN item entry.
 */
export function weaponFromItem(item) {
    const codes = (item.property || []).map(p =>
        typeof p === 'string' ? p.split('|')[0] : p?.uid?.split('|')[0] || '',
    );
    const labels = expandPropertyCodes(item.property || []);
    const dmgTypes = { B: 'bludgeoning', P: 'piercing', S: 'slashing', N: 'necrotic', R: 'radiant', F: 'fire', C: 'cold', L: 'lightning' };
    const rawBonus = item.bonusWeapon || null;
    const bonus = rawBonus ? (String(rawBonus).startsWith('+') ? rawBonus : `+${rawBonus}`) : null;
    return {
        name: item.name,
        attackType: item.range ? 'rw' : 'mw',
        damageDice: item.dmg1 || '?',
        damageType: dmgTypes[item.dmgType] || item.dmgType || 'unknown',
        properties: labels,
        versatileDice: codes.includes('V') && item.dmg2 ? item.dmg2 : null,
        range: item.range || null,
        finesse: codes.includes('F'),
        bonus,
        rarity: item.rarity || null,
    };
}

/**
 * Build a compact armor descriptor from a CDN item entry.
 */
export function armorFromItem(item) {
    const rawType = (item._armorType || item.type || '').split('|')[0];
    let ac = item.ac ?? 10;
    if (item.bonusAc) ac += parseInt(item.bonusAc) || 0;
    return {
        name: item.name,
        type: rawType,
        ac,
        stealthDisadv: !!item.stealth,
        strReq: item.strength ? parseInt(item.strength) : 0,
    };
}

// ─── AC Calculation ─────────────────────────────────────────

/**
 * Compute AC from equipped armor, shield, and DEX modifier.
 * Falls back to baseAc if no armor is configured.
 */
export function computeEquippedAC(equippedArmor, hasShield, dexMod, baseAc, warriorDefBonus) {
    let ac;
    if (!equippedArmor) {
        ac = baseAc ?? (10 + dexMod);
    } else {
        const type = equippedArmor.type;
        if (type === 'LA') {
            ac = equippedArmor.ac + dexMod;
        } else if (type === 'MA') {
            ac = equippedArmor.ac + Math.min(dexMod, 2);
        } else {
            ac = equippedArmor.ac;
        }
    }
    if (hasShield) ac += 2;
    if (warriorDefBonus) ac += warriorDefBonus;
    return ac;
}

// ─── Creature Action Extraction ─────────────────────────────

const ATK_LABELS = {
    mw: 'Melee Weapon Attack:',
    rw: 'Ranged Weapon Attack:',
    ms: 'Melee Spell Attack:',
    rs: 'Ranged Spell Attack:',
    'mw,rw': 'Melee or Ranged Weapon Attack:',
    'rw,mw': 'Melee or Ranged Weapon Attack:',
    'ms,rs': 'Melee or Ranged Spell Attack:',
};

export function strip5eMarkup(text) {
    return text
        .replace(/{@atk\s+([^}]+)}/g, (_, k) => ATK_LABELS[k.trim()] || `${k.trim()} Attack:`)
        .replace(/{@h}/g, 'Hit: ')
        .replace(/{@hit\s+([^}]+)}/g, (_, n) => `+${n.trim()}`)
        .replace(/{@dc\s+([^}]+)}/g, (_, n) => `DC ${n.trim()}`)
        .replace(/{@damage\s+([^}]+)}/g, (_, d) => d.trim())
        .replace(/{@dice\s+([^}]+)}/g, (_, d) => d.trim())
        .replace(/{@recharge\s*([^}]*)}/g, (_, n) => n ? `(Recharge ${n.trim()})` : '(Recharge)')
        .replace(/{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract creature actions with parsed combat data for scaling.
 * Stores original hit/damage/DC values so they can be recalculated at higher levels.
 */
export function extractCreatureActions(creature) {
    if (!creature?.action) return [];
    const prof = crProfBonus(creature.cr);
    const actions = [];
    for (const action of creature.action) {
        const rawText = Array.isArray(action.entries) ? action.entries.join(' ') : '';
        const text = strip5eMarkup(rawText);
        if (!text) continue;

        const hitMatch = rawText.match(/{@hit\s+(\d+)}/);
        const dmgMatch = rawText.match(/{@damage\s+([^}]+)}/);
        const dcMatch = rawText.match(/{@dc\s+(\d+)}/);
        const atkMatch = rawText.match(/{@atk\s+([^}]+)}/);

        let abilityMod = null;
        if (hitMatch) {
            abilityMod = parseInt(hitMatch[1]) - prof;
        }

        actions.push({
            name: action.name || 'Action',
            text: text.length > 300 ? text.slice(0, 297) + '...' : text,
            enabled: true,
            origHit: hitMatch ? parseInt(hitMatch[1]) : null,
            origDamage: dmgMatch ? dmgMatch[1].trim() : null,
            origDc: dcMatch ? parseInt(dcMatch[1]) : null,
            origAbilityMod: abilityMod,
            origProf: prof,
            atkType: atkMatch ? atkMatch[1].trim() : null,
        });
    }
    return actions;
}

function crProfBonus(cr) {
    if (!cr) return 2;
    const val = typeof cr === 'object' ? parseFloat(cr.cr || cr) : parseFloat(cr);
    if (isNaN(val) || val < 5) return 2;
    if (val < 9) return 3;
    if (val < 13) return 4;
    if (val < 17) return 5;
    if (val < 21) return 6;
    if (val < 25) return 7;
    if (val < 29) return 8;
    return 9;
}

/**
 * Extract creature traits as toggleable items (e.g. Feline Agility, Pack Tactics).
 */
export function extractCreatureTraits(creature) {
    if (!creature?.trait) return [];
    const traits = [];
    for (const t of creature.trait) {
        const rawText = Array.isArray(t.entries) ? t.entries.join(' ') : '';
        const text = strip5eMarkup(rawText);
        if (!text) continue;
        traits.push({
            name: t.name || 'Trait',
            text,
            enabled: true,
        });
    }
    return traits;
}

// ─── Creature Skill Proficiency Detection ───────────────────

/**
 * Determine which skills the creature has proficiency in by comparing
 * the skill total in creature.skill to the raw ability modifier.
 * Any skill whose total > ability mod is considered proficient.
 */
export function extractCreatureSkillProficiencies(creature) {
    if (!creature?.skill) return [];
    const profSkills = [];
    for (const [rawKey, valStr] of Object.entries(creature.skill)) {
        const sk = rawKey.replace(/\s+/g, '');
        const camel = sk.charAt(0).toLowerCase() + sk.slice(1);
        const ab = SKILL_ABILITIES[camel];
        if (!ab) continue;
        const total = parseInt(valStr);
        if (isNaN(total)) continue;
        const baseScore = creature[ab] ?? 10;
        const baseMod = Math.floor((baseScore - 10) / 2);
        if (total > baseMod) profSkills.push(camel);
    }
    return profSkills;
}

// ─── Language Parsing ───────────────────────────────────────

const DND_LANGUAGES = [
    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
    'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial',
    'Sylvan', 'Undercommon', 'Aquan', 'Auran', 'Ignan', 'Terran',
    'Druidic', 'Thieves\' Cant', 'Aarakocra', 'Gith', 'Modron', 'Slaad',
    'Sphinx', 'Kraul', 'Loxodon', 'Minotaur', 'Vedalken',
];

export { DND_LANGUAGES };

/**
 * Parse a creature language string and return fixed languages + how many are player-chosen.
 * E.g. "Common plus any one language" → { fixed: ['Common'], choiceCount: 1 }
 */
export function parseCreatureLanguages(langStr) {
    if (!langStr) return { fixed: [], choiceCount: 0 };
    const fixed = [];
    let choiceCount = 0;

    const anyMatch = langStr.match(/any\s+(\w+)\s+language/i);
    if (anyMatch) {
        const numWords = { one: 1, two: 2, three: 3, four: 4, five: 5 };
        choiceCount = numWords[anyMatch[1].toLowerCase()] || parseInt(anyMatch[1]) || 1;
    }

    for (const lang of DND_LANGUAGES) {
        if (langStr.toLowerCase().includes(lang.toLowerCase())) {
            fixed.push(lang);
        }
    }

    return { fixed, choiceCount };
}

// ─── Hit Dice Parsing ───────────────────────────────────────

export function parseHitDice(formula) {
    if (!formula || typeof formula !== 'string') return { count: 1, faces: 8 };
    const m = formula.match(/(\d+)d(\d+)/);
    if (!m) return { count: 1, faces: 8 };
    return { count: parseInt(m[1]), faces: parseInt(m[2]) };
}

// ─── Stat Scaling Engine ────────────────────────────────────

function abilityMod(score) {
    return Math.floor((score - 10) / 2);
}

export function getModStr(score) {
    const m = abilityMod(score);
    return m >= 0 ? `+${m}` : `${m}`;
}

export function computeSidekickStats(sidekick, level) {
    if (!level || level < 1) level = 1;
    if (level > 20) level = 20;

    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const scores = {};
    for (const a of abilities) {
        const baseKey = 'base' + a.charAt(0).toUpperCase() + a.slice(1);
        scores[a] = sidekick[baseKey] ?? 10;
    }

    const asiLevels = ASI_LEVELS[sidekick.type] || [];
    const asiChoices = sidekick.asiChoices || {};
    const chosenFeats = [];
    for (const asiLvl of asiLevels) {
        if (asiLvl > level) break;
        const choice = asiChoices[asiLvl];
        if (!choice) continue;
        if (choice.feat) {
            if (choice.feat) chosenFeats.push(choice.feat);
            const feat = lookupFeatByName(choice.feat);
            if (feat) {
                const abInfo = parseFeatAbility(feat);
                if (abInfo) {
                    for (const [ab, val] of Object.entries(abInfo.fixed)) {
                        if (scores[ab] !== undefined) scores[ab] = Math.min(20, scores[ab] + val);
                    }
                    if (abInfo.choose && choice.featAbility && scores[choice.featAbility] !== undefined) {
                        scores[choice.featAbility] = Math.min(20, scores[choice.featAbility] + 1);
                    }
                }
            }
        } else if (Array.isArray(choice) && choice.length >= 2) {
            const [a1, a2] = choice;
            if (a1 && scores[a1] !== undefined) scores[a1] = Math.min(20, scores[a1] + 1);
            if (a2 && scores[a2] !== undefined) scores[a2] = Math.min(20, scores[a2] + 1);
        }
    }

    const mods = {};
    for (const a of abilities) mods[a] = abilityMod(scores[a]);

    const proficiency = Math.ceil(level / 4) + 1;

    const hitDice = parseHitDice(sidekick.baseHp?.formula);
    const totalHitDice = hitDice.count + (level - 1);
    const avgPerDie = Math.floor(hitDice.faces / 2) + 1;

    const featEffects = collectFeatEffects(chosenFeats, sidekick.featData || {}, {
        level, scores, mods, proficiency,
        featAbilityMod: 0,
    });

    const baseAvgHp = sidekick.baseHp?.average ?? (hitDice.count * avgPerDie);
    const baseCon = sidekick.baseCon ?? 10;
    const baseConMod = Math.floor((baseCon - 10) / 2);
    const conModDelta = mods.con - baseConMod;
    const extraLevelDice = level - 1;
    const hp = Math.max(1,
        baseAvgHp
        + (conModDelta * hitDice.count)
        + (extraLevelDice * (avgPerDie + mods.con))
        + featEffects.hpBonus,
    );

    const saves = {};
    const sharpMindSave = (sidekick.type === 'expert' && level >= 18) ? sidekick.sharpMindSave : null;
    for (const a of abilities) {
        const isProficient = sidekick.saveProficiency === a || sharpMindSave === a;
        saves[a] = { mod: mods[a] + (isProficient ? proficiency : 0), proficient: isProficient };
    }

    const skills = {};
    const profSkills = sidekick.skillProficiencies || [];
    const creatureProf = sidekick.creatureSkillProficiencies || [];
    const expertise = (sidekick.type === 'expert' && level >= 3) ? (sidekick.skillExpertise || []) : [];
    const expertise15 = (sidekick.type === 'expert' && level >= 15) ? (sidekick.expertise15 || []) : [];
    const featSkills = featEffects.extraSkills || [];
    const featExpertise = featEffects.extraExpertise || [];
    for (const sk of ALL_SKILLS) {
        const ab = SKILL_ABILITIES[sk];
        const isProf = profSkills.includes(sk) || creatureProf.includes(sk) || featSkills.includes(sk);
        const isExpert = expertise.includes(sk) || expertise15.includes(sk) || featExpertise.includes(sk);
        let bonus = mods[ab] || 0;
        if (isExpert) bonus += proficiency * 2;
        else if (isProf) bonus += proficiency;
        skills[sk] = { mod: bonus, proficient: isProf || isExpert, expertise: isExpert };
    }

    let spellcasting = null;
    if (sidekick.type === 'spellcaster' && sidekick.subtype) {
        const subInfo = SIDEKICK_TYPES.spellcaster.subtypes.find(s => s.key === sidekick.subtype);
        if (subInfo) {
            const ab = subInfo.ability;
            const abMod = mods[ab] || 0;
            const idx = level - 1;
            const slots = SPELL_SLOT_TABLE[idx] || [0,0,0,0,0];
            const nonZeroSlots = slots.filter(s => s > 0);
            spellcasting = {
                ability: ab,
                abilityLabel: ABILITY_LABELS[ab] || ab.toUpperCase(),
                attackMod: proficiency + abMod,
                saveDC: 8 + proficiency + abMod,
                cantripsKnown: CANTRIP_PROGRESSION[idx] || 2,
                spellsKnown: SPELLS_KNOWN_PROGRESSION[idx] || 1,
                slots,
                slotsStr: nonZeroSlots.join('/'),
                spellList: subInfo.list,
            };
        }
    }

    let extraAttack = 0;
    if (sidekick.type === 'warrior') {
        if (level >= 15) extraAttack = 3;
        else if (level >= 6) extraAttack = 2;
    }

    const warriorDefBonus = (sidekick.type === 'warrior' && level >= 10) ? 1 : 0;
    const ac = computeEquippedAC(
        sidekick.equippedArmor || null,
        !!sidekick.hasShield,
        mods.dex,
        sidekick.baseAc,
        warriorDefBonus,
    );

    const features = buildFeatureSummary(sidekick, level, { proficiency, mods, scores, spellcasting, extraAttack });

    const attackerBonus = (sidekick.type === 'warrior' && sidekick.subtype === 'attacker') ? 2 : 0;

    const computedActions = computeActionStats(sidekick.creatureActions || [], proficiency, mods, attackerBonus);
    const computedWeapons = computeWeaponStats(sidekick.weapons || [], proficiency, mods, attackerBonus);

    let potentCantripMod = 0;
    let empoweredSchool = null;
    let empoweredMod = 0;
    if (sidekick.type === 'spellcaster' && spellcasting) {
        const spAbMod = mods[spellcasting.ability] || 0;
        if (level >= 6) potentCantripMod = spAbMod;
        if (level >= 14 && sidekick.empoweredSchool) {
            empoweredSchool = sidekick.empoweredSchool;
            empoweredMod = spAbMod;
        }
    }

    return {
        scores, mods, proficiency, hp, ac, saves, skills,
        spellcasting, extraAttack, features,
        hitDieFaces: hitDice.faces,
        totalHitDice,
        computedActions,
        computedWeapons,
        potentCantripMod,
        empoweredSchool,
        empoweredMod,
        chosenFeats,
        featEffects,
    };
}

// ─── Combat Stat Computation ────────────────────────────────

function scaleDamageString(dmgStr, origMod, newMod) {
    if (!dmgStr || origMod === newMod) return dmgStr;
    const m = dmgStr.match(/^(\d+d\d+)\s*([+-]\s*\d+)?$/);
    if (!m) return dmgStr;
    const dice = m[1];
    const oldBonus = m[2] ? parseInt(m[2].replace(/\s/g, '')) : 0;
    const newBonus = oldBonus + (newMod - origMod);
    if (newBonus === 0) return dice;
    return newBonus > 0 ? `${dice} + ${newBonus}` : `${dice} - ${Math.abs(newBonus)}`;
}

function averageDiceDamage(dmgStr) {
    if (!dmgStr) return 0;
    const m = dmgStr.match(/^(\d+)d(\d+)(?:\s*([+-]\s*\d+))?$/);
    if (!m) return 0;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    const bonus = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    return Math.floor(count * (sides + 1) / 2) + bonus;
}

function formatActionHit(hit) {
    return hit >= 0 ? `+${hit}` : `${hit}`;
}

/**
 * Rewrite stored action text with recomputed hit, damage average, and DC.
 * Original text is preserved on the action object; this is display-only.
 */
function buildComputedActionText(text, { hit, damage, dc }) {
    if (!text) return text;
    let result = text;
    let changed = false;

    if (hit != null) {
        const hitStr = formatActionHit(hit);
        const next = result.replace(/([+-]?\d+)\s+to hit/i, `${hitStr} to hit`);
        if (next !== result) {
            result = next;
            changed = true;
        }
    }

    if (damage) {
        const avg = averageDiceDamage(damage);
        const next = result.replace(/(\d+)\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/, `${avg} (${damage})`);
        if (next !== result) {
            result = next;
            changed = true;
        }
    }

    if (dc != null) {
        const next = result.replace(/DC\s+(\d+)/i, `DC ${dc}`);
        if (next !== result) {
            result = next;
            changed = true;
        }
    }

    return changed ? result : text;
}

/**
 * Recalculate creature action to-hit and DCs based on sidekick prof bonus.
 * The delta between sidekick prof and creature original prof is applied.
 */
function computeActionStats(actions, sidekickProf, mods, attackerBonus) {
    return actions.map(a => {
        if (!a.enabled) {
            return { ...a, computedHit: null, computedDamage: null, computedDc: null, computedText: a.text };
        }
        const origProf = a.origProf ?? 2;
        const profDelta = sidekickProf - origProf;
        let hit = null;
        let damage = a.origDamage || null;
        let dc = null;

        if (a.origHit != null) {
            hit = a.origHit + profDelta + attackerBonus;
        }
        if (a.origDc != null) {
            dc = a.origDc + profDelta;
        }

        if (a.origAbilityMod != null && a.origDamage) {
            const origMod = a.origAbilityMod;
            const atkType = a.atkType || '';
            let relevantMod = origMod;
            if (atkType.includes('mw')) relevantMod = Math.max(mods.str, mods.dex);
            else if (atkType.includes('rw')) relevantMod = mods.dex;
            else relevantMod = Math.max(mods.str, mods.dex);

            const modDelta = relevantMod - origMod;
            if (modDelta !== 0 && hit != null) hit += modDelta;

            damage = scaleDamageString(a.origDamage, origMod, relevantMod);
        }

        const computedText = buildComputedActionText(a.text, { hit, damage, dc });

        return { ...a, computedHit: hit, computedDamage: damage, computedDc: dc, computedText };
    });
}

/**
 * Compute to-hit and damage for extra weapons based on sidekick ability mods + prof.
 */
function computeWeaponStats(weapons, prof, mods, attackerBonus) {
    return weapons.map(w => {
        const isFinesse = w.finesse || (w.properties || []).some(p => p === 'Finesse');
        const isRanged = w.attackType === 'rw';
        let abilityMod;
        if (isFinesse) abilityMod = Math.max(mods.str, mods.dex);
        else if (isRanged) abilityMod = mods.dex;
        else abilityMod = mods.str;

        const bonusNum = w.bonus ? parseInt(String(w.bonus).replace(/[^-\d]/g, '')) || 0 : 0;
        const hit = abilityMod + prof + bonusNum + attackerBonus;
        const totalDmgMod = abilityMod + bonusNum;
        const dmgStr = totalDmgMod >= 0 ? `${w.damageDice} + ${totalDmgMod}` : `${w.damageDice} - ${Math.abs(totalDmgMod)}`;
        const versatileDmg = w.versatileDice
            ? (totalDmgMod >= 0 ? `${w.versatileDice} + ${totalDmgMod}` : `${w.versatileDice} - ${Math.abs(totalDmgMod)}`)
            : null;

        return {
            ...w,
            computedHit: hit,
            computedDamage: dmgStr,
            computedVersatile: versatileDmg,
            computedAbilityMod: abilityMod,
        };
    });
}

// ─── Feature Summary ────────────────────────────────────────

export const SPELL_SCHOOLS = {
    A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
    I: 'Illusion', N: 'Necromancy', T: 'Transmutation', V: 'Evocation',
};

function buildFeatureSummary(sidekick, level, ctx) {
    const feats = [];
    const type = sidekick.type;

    if (type === 'warrior') {
        const sub = sidekick.subtype;
        if (sub === 'attacker') feats.push({ name: 'Martial Role (Attacker)', text: '1st-level Warrior feature. The sidekick gains a +2 bonus to its attack rolls.' });
        else if (sub === 'defender') feats.push({ name: 'Martial Role (Defender)', text: '1st-level Warrior feature. The sidekick can use its reaction to impose disadvantage on the attack roll of a creature within 5 feet of it whose target isn\'t the sidekick, provided the sidekick can see the attacker.' });
        if (level >= 2) {
            const swUses = level >= 20 ? 2 : 1;
            feats.push({ name: `Second Wind (1d10+${level}, ${swUses}/SR)`, text: `2nd-level Warrior feature. The sidekick can use a bonus action to regain 1d10 + ${level} hit points. It can use this feature ${swUses === 2 ? 'twice' : 'once'} per short or long rest.` });
        }
        if (level >= 3) feats.push({ name: 'Improved Critical (19-20)', text: '3rd-level Warrior feature. The sidekick\'s weapon attacks score a critical hit on a roll of 19 or 20 on the d20.' });
        if (ctx.extraAttack >= 2) feats.push({ name: `Extra Attack (${ctx.extraAttack})`, text: `6th-level Warrior feature. The sidekick can attack ${ctx.extraAttack} times whenever it takes the Attack action on its turn.` });
        if (level >= 7) feats.push({ name: 'Battle Readiness', text: '7th-level Warrior feature. The sidekick has advantage on initiative rolls.' });
        if (level >= 10) feats.push({ name: 'Improved Defense (+1 AC)', text: '10th-level Warrior feature. The sidekick\'s AC increases by 1.' });
        if (level >= 11 && level < 18) feats.push({ name: 'Indomitable (1/LR)', text: '11th-level Warrior feature. The sidekick can reroll a saving throw that it fails, but it must use the new roll. It can use this feature once per long rest.' });
        if (level >= 18) feats.push({ name: 'Indomitable (2/LR)', text: '18th-level Warrior feature. The sidekick can reroll a saving throw that it fails, but it must use the new roll. It can use this feature twice per long rest.' });
    } else if (type === 'expert') {
        feats.push({ name: 'Helpful', text: '1st-level Expert feature. The sidekick can take the Help action as a bonus action.' });
        if (level >= 3) {
            const exp3 = (sidekick.skillExpertise || []).map(s => SKILL_LABELS[s] || s).join(', ');
            feats.push({ name: 'Expertise (2 skills)', text: `3rd-level Expert feature. Choose two of the sidekick's skill proficiencies. The sidekick's proficiency bonus is doubled for any ability check it makes that uses either of the chosen proficiencies.${exp3 ? ' Chosen: ' + exp3 : ' (not yet selected)'}`, needsChoice: !exp3 });
        }
        if (level >= 6) feats.push({ name: 'Coordinated Strike', text: '6th-level Expert feature. When the sidekick uses its Helpful feature, the creature who receives the help also gains a 2d6 bonus to the damage roll of its next successful attack before the start of the sidekick\'s next turn.' });
        if (level >= 7) feats.push({ name: 'Evasion', text: '7th-level Expert feature. When the sidekick is subjected to an effect that allows it to make a Dexterity saving throw to take only half damage, it instead takes no damage on a success, and half damage on a failure.' });
        if (level >= 9) feats.push({ name: 'Inspiring Help', text: '9th-level Expert feature. When the sidekick takes the Help action, the creature who receives the help gains 1d6 temporary hit points.' });
        if (level >= 11) feats.push({ name: 'Reliable Talent', text: '11th-level Expert feature. Whenever the sidekick makes an ability check that lets it add its proficiency bonus, it can treat a d20 roll of 9 or lower as a 10.' });
        if (level >= 14) feats.push({ name: 'Cunning Action', text: '14th-level Expert feature. On each of its turns, the sidekick can use a bonus action to take the Dash, Disengage, or Hide action.' });
        if (level >= 15) {
            const exp15 = (sidekick.expertise15 || []).map(s => SKILL_LABELS[s] || s).join(', ');
            feats.push({ name: 'Expertise (15th)', text: `15th-level Expert feature. Choose two of the sidekick's skill proficiencies. The sidekick's proficiency bonus is doubled for ability checks using those skills.${exp15 ? ' Chosen: ' + exp15 : ' (not yet selected)'}`, needsChoice: !exp15 });
        }
        if (level >= 18) {
            const save18 = sidekick.sharpMindSave || null;
            feats.push({ name: 'Sharp Mind', text: `18th-level Expert feature. The sidekick gains proficiency in one saving throw: Intelligence, Wisdom, or Charisma.${save18 ? ' Chosen: ' + save18.toUpperCase() : ' (not yet selected)'}`, needsChoice: !save18 });
        }
        if (level >= 20) feats.push({ name: 'Inspiring Help (+2d6)', text: '20th-level Expert feature. The temporary hit points from Inspiring Help increase to 2d6.' });
    } else if (type === 'spellcaster') {
        const abMod = ctx.spellcasting ? ctx.mods[ctx.spellcasting.ability] || 0 : 0;
        if (level >= 6) feats.push({ name: `Potent Cantrips (+${abMod} dmg)`, text: `6th-level Spellcaster feature. The sidekick can add its spellcasting ability modifier (+${abMod}) to the damage it deals with any cantrip.` });
        if (level >= 14) {
            const school14 = sidekick.empoweredSchool || null;
            const schoolLabel = school14 ? (SPELL_SCHOOLS[school14] || school14) : null;
            feats.push({ name: `Empowered Spells${schoolLabel ? ' (' + schoolLabel + ')' : ''}`, text: `14th-level Spellcaster feature. Choose one school of magic. Whenever the sidekick casts a spell of that school by expending a spell slot, the sidekick can add its spellcasting ability modifier (+${abMod}) to the spell's damage roll or healing roll, if any.${schoolLabel ? ' Chosen school: ' + schoolLabel : ' (not yet selected)'}`, needsChoice: !schoolLabel });
        }
        if (level >= 18) feats.push({ name: 'Focused Casting', text: '18th-level Spellcaster feature. The sidekick has advantage on Constitution saving throws that it makes to maintain concentration on a spell.' });
    }

    return feats;
}

// ─── Max Spell Level ────────────────────────────────────────

export function getMaxSpellLevel(sidekickLevel) {
    if (!sidekickLevel || sidekickLevel < 1) return 0;
    const idx = Math.min(sidekickLevel, 20) - 1;
    const slots = SPELL_SLOT_TABLE[idx] || [0,0,0,0,0];
    for (let i = slots.length - 1; i >= 0; i--) {
        if (slots[i] > 0) return i + 1;
    }
    return 0;
}

// ─── Feat Data ──────────────────────────────────────────────

let _featCache = null;
let _featInflight = null;

export async function fetchFeats() {
    if (_featCache) return _featCache;
    if (_featInflight) return _featInflight;
    _featInflight = fetch(`${CDN_DATA}/feats.json`, { signal: AbortSignal.timeout(20000) })
        .then(r => r.ok ? r.json() : {})
        .then(data => {
            _featCache = (data.feat || []).filter(f => f.source === 'XPHB');
            return _featCache;
        })
        .catch(() => { _featCache = []; return []; })
        .finally(() => { _featInflight = null; });
    return _featInflight;
}

export function getLoadedFeats() { return _featCache || []; }

/**
 * Parse a feat's ability boost configuration into a normalized form.
 * Returns { fixed: {str:1,...}, choose: {from:[...], count:N} } or null.
 */
export function parseFeatAbility(feat) {
    if (!feat?.ability?.length) return null;
    const fixed = {};
    let choose = null;
    for (const entry of feat.ability) {
        if (entry.hidden) continue;
        if (entry.choose) {
            choose = { from: entry.choose.from || [], count: entry.choose.count || entry.choose.amount || 1 };
        } else {
            for (const [ab, val] of Object.entries(entry)) {
                if (['str','dex','con','int','wis','cha'].includes(ab)) {
                    fixed[ab] = (fixed[ab] || 0) + val;
                }
            }
        }
    }
    if (Object.keys(fixed).length === 0 && !choose) return null;
    return { fixed, choose };
}

/**
 * Check if a sidekick meets a feat's prerequisites.
 */
export function checkFeatPrereqs(feat, sidekick, level, stats) {
    if (!feat.prerequisite?.length) return { met: true, reasons: [] };
    const reasons = [];
    let anyMet = false;
    for (const p of feat.prerequisite) {
        let thisOk = true;
        if (p.level && level < p.level) { thisOk = false; reasons.push(`Level ${p.level}+`); }
        if (p.ability) {
            const abOk = p.ability.some(abReq => {
                return Object.entries(abReq).every(([ab, min]) => (stats?.scores?.[ab] ?? 10) >= min);
            });
            if (!abOk) { thisOk = false; reasons.push('Ability score too low'); }
        }
        if (p.spellcasting2020 && sidekick.type !== 'spellcaster') { thisOk = false; reasons.push('Requires spellcasting'); }
        if (p.proficiency) {
            for (const prof of p.proficiency) {
                if (prof.armor === 'light' || prof.armor === 'medium' || prof.armor === 'heavy') {
                    reasons.push(`Requires ${prof.armor} armor proficiency`);
                    thisOk = false;
                }
                if (prof.armor === 'shield') {
                    reasons.push('Requires shield proficiency');
                    thisOk = false;
                }
            }
        }
        if (thisOk) anyMet = true;
    }
    return { met: anyMet, reasons: [...new Set(reasons)] };
}

export function lookupFeatByName(name) {
    if (!_featCache || !name) return null;
    const key = name.toLowerCase();
    return _featCache.find(f => f.name.toLowerCase() === key) || null;
}

// ─── Spell Search ───────────────────────────────────────────

const SPELL_SOURCES = ['xphb', 'tce', 'xge'];

const _spellSourceCache = new Map();
let _spellSourceInflight = new Map();
let _spellClassLookup = null;
let _spellClassLookupInflight = null;

export async function fetchSpellSource(source) {
    if (_spellSourceCache.has(source)) return _spellSourceCache.get(source);
    if (_spellSourceInflight.has(source)) return _spellSourceInflight.get(source);
    const filename = `spells-${source.toLowerCase()}.json`;
    const promise = fetch(`${CDN_DATA}/spells/${filename}`, { signal: AbortSignal.timeout(20000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const spells = data?.spell || [];
            _spellSourceCache.set(source, spells);
            return spells;
        })
        .catch(() => { _spellSourceCache.set(source, []); return []; })
        .finally(() => { _spellSourceInflight.delete(source); });
    _spellSourceInflight.set(source, promise);
    return promise;
}

async function fetchSpellClassLookup() {
    if (_spellClassLookup) return _spellClassLookup;
    if (_spellClassLookupInflight) return _spellClassLookupInflight;
    _spellClassLookupInflight = fetch(
        `${CDN_DATA}/generated/gendata-spell-source-lookup.json`,
        { signal: AbortSignal.timeout(25000) },
    )
        .then(r => r.ok ? r.json() : {})
        .then(data => { _spellClassLookup = data; return data; })
        .catch(() => { _spellClassLookup = {}; return {}; })
        .finally(() => { _spellClassLookupInflight = null; });
    return _spellClassLookupInflight;
}

function spellBelongsToClasses(spellName, spellSource, classList) {
    if (!_spellClassLookup) return false;
    const srcKey = spellSource.toLowerCase();
    const nameKey = spellName.toLowerCase();
    const entry = _spellClassLookup[srcKey]?.[nameKey];
    if (!entry) return false;
    const targets = classList.split('|');
    for (const section of [entry.class, entry.classVariant]) {
        if (!section) continue;
        for (const classSrc of Object.values(section)) {
            for (const className of Object.keys(classSrc)) {
                if (targets.includes(className)) return true;
            }
        }
    }
    return false;
}

export async function preloadSpellData() {
    await Promise.all([
        fetchSpellClassLookup(),
        ...SPELL_SOURCES.map(s => fetchSpellSource(s)),
    ]);
}

export function getAllLoadedSpells() {
    const allSpells = [];
    const seen = new Set();
    for (const src of SPELL_SOURCES) {
        const spells = _spellSourceCache.get(src) || [];
        for (const s of spells) {
            const key = s.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            allSpells.push(s);
        }
    }
    return allSpells;
}

export function getSpellsForClass(classList, maxSpellLevel, isCantrip) {
    const allSpells = [];
    const seen = new Set();
    for (const src of SPELL_SOURCES) {
        const spells = _spellSourceCache.get(src) || [];
        for (const s of spells) {
            const key = s.name.toLowerCase();
            if (seen.has(key)) continue;
            if (!spellBelongsToClasses(s.name, s.source, classList)) continue;
            if (isCantrip && s.level !== 0) continue;
            if (!isCantrip && (s.level < 1 || s.level > maxSpellLevel)) continue;
            seen.add(key);
            allSpells.push({ name: s.name, level: s.level, school: s.school, source: s.source });
        }
    }
    return allSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

const SCHOOL_LABELS = {
    A: 'Abjur', C: 'Conj', D: 'Div', E: 'Ench',
    V: 'Evoc', I: 'Illus', N: 'Necro', T: 'Trans',
};
export function spellSchoolLabel(code) {
    return SCHOOL_LABELS[code] || code || '';
}

// ─── Spell Damage Extraction ────────────────────────────────

const CANTRIP_BREAKPOINTS = [1, 5, 11, 17];

/**
 * Extract spell damage/healing info from a cached spell object.
 * @param {number|null} [castLevel] - Slot level used when casting (for upcast resolution)
 */
export function getSpellDamageInfo(spellName, characterLevel, potentMod, empoweredSchool, empoweredMod, castLevel = null) {
    const spell = lookupSpellByName(spellName);
    if (!spell) return null;

    const dmgTypes = spell.damageInflict || [];
    const dmgType = dmgTypes[0] || '';
    const isCantrip = spell.level === 0;
    const school = spell.school || '';
    const miscTags = spell.miscTags || [];
    const isHealing = miscTags.includes('HL');
    const savingThrow = (spell.savingThrow || [])[0] || null;
    const spellAttack = (spell.spellAttack || [])[0] || null;
    const conditionInflict = spell.conditionInflict || [];

    const entriesStr = collectSpellScalingText(spell);
    const omitDamageType = isPlayerChosenDamageType(spell, entriesStr);

    let baseDice = null;
    const dmgMatch = entriesStr.match(/{@damage\s+([^}]+)}/);
    if (dmgMatch) baseDice = dmgMatch[1].trim().split('+')[0].trim();

    let healDice = null;
    if (isHealing && !baseDice) {
        const healMatch = entriesStr.match(/{@dice\s+([^}]+)}/);
        if (healMatch) healDice = healMatch[1].trim().split('+')[0].trim();
    }
    if (isHealing && !healDice && baseDice) healDice = baseDice;

    let bonusMod = 0;
    if (isCantrip && potentMod) bonusMod = potentMod;
    else if (!isCantrip && empoweredSchool && school === empoweredSchool && empoweredMod) bonusMod = empoweredMod;

    let dice = baseDice;
    let scaling = null;
    if (isCantrip && spell.scalingLevelDice?.scaling) {
        scaling = spell.scalingLevelDice.scaling;
        dice = baseDice || scaling['1'] || null;
        for (const bp of CANTRIP_BREAKPOINTS) {
            if (characterLevel >= bp && scaling[String(bp)]) dice = scaling[String(bp)];
        }
    }

    if (dice && bonusMod) dice = `${dice} + ${bonusMod}`;
    if (healDice && bonusMod) healDice = `${healDice} + ${bonusMod}`;

    const baseRange = formatSpellRange(spell.range);
    const range = isCantrip
        ? parseCantripRangeScaling(entriesStr, characterLevel, baseRange)
        : baseRange;
    const beamCount = isCantrip ? parseBeamCount(entriesStr, characterLevel) : 1;

    let upcastInfo = null;
    let upcastExtra = null;
    let upcastTable = null;
    if (!isCantrip && spell.entriesHigherLevel) {
        upcastInfo = parseUpcastInfo(spell.entriesHigherLevel, spell.level);
        upcastExtra = parseUpcastExtra(spell.entriesHigherLevel);
        const rawBase = baseDice || healDice;
        if (rawBase && upcastInfo) {
            upcastTable = buildUpcastTable(baseDice, healDice, upcastInfo, spell.level);
            if (bonusMod) {
                for (const slot of Object.keys(upcastTable)) {
                    if (upcastTable[slot].dice) upcastTable[slot].dice = `${upcastTable[slot].dice} + ${bonusMod}`;
                    if (upcastTable[slot].healDice) upcastTable[slot].healDice = `${upcastTable[slot].healDice} + ${bonusMod}`;
                }
            }
        }
    }

    const atCast = castLevel != null ? getStatsAtCastLevel({ dice, healDice, upcastTable }, castLevel) : null;

    return {
        dice,
        type: omitDamageType ? '' : dmgType,
        omitDamageType,
        isCantrip,
        scaling,
        school,
        isHealing,
        healDice,
        savingThrow,
        spellAttack,
        conditionInflict,
        spellLevel: spell.level,
        upcastInfo,
        upcastExtra,
        upcastTable,
        range,
        baseRange,
        beamCount,
        castLevel,
        atCastLevel: atCast,
        hasDamageAndHeal: !!(baseDice && isHealing),
    };
}

const SCHOOL_NAMES = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', I: 'Illusion', N: 'Necromancy', T: 'Transmutation', V: 'Evocation' };

/**
 * Build a compact spell annotation for the prompt.
 * E.g. "Cure Wounds (heal 2d8+mod, touch)" or "Thunderwave (2d8 thunder, CON save)"
 */
export function buildSpellAnnotation(spellName, info) {
    if (!info) return spellName;
    const parts = [];
    const dice = info.atCastLevel?.dice ?? info.dice;
    const healDice = info.atCastLevel?.healDice ?? info.healDice;

    if (info.isHealing && healDice) parts.push(`heal ${healDice}+mod`);
    else if (dice) parts.push(`${dice}${!info.omitDamageType && info.type ? ' ' + info.type : ''}`);

    if (info.savingThrow) parts.push(`${info.savingThrow.substring(0, 3).toUpperCase()} save`);
    else if (info.spellAttack) parts.push(info.spellAttack === 'R' ? 'ranged atk' : 'melee atk');
    if (info.conditionInflict?.length > 0) parts.push(info.conditionInflict.join('/'));

    if (info.range && info.baseRange && info.range !== info.baseRange) parts.push(`range ${info.range}`);
    if (info.beamCount > 1) parts.push(`${info.beamCount} beams`);
    if (info.upcastInfo && !info.castLevel) {
        parts.push(`+${info.upcastInfo.dice}/slot above ${spellOrdinal(info.upcastInfo.aboveLevel)}`);
    }

    if (parts.length === 0) {
        const spell = lookupSpellByName(spellName);
        if (spell) {
            const schoolName = SCHOOL_NAMES[spell.school] || '';
            if (schoolName) parts.push(schoolName.toLowerCase());
        }
    }
    return parts.length > 0 ? `${spellName} (${parts.join(', ')})` : spellName;
}

// ─── Sidekick CRUD Helpers ──────────────────────────────────

export function createSidekickFromCreature(creature, config) {
    const hd = parseHitDice(creature.hp?.formula);
    const creatureActions = extractCreatureActions(creature);
    const creatureTraits = extractCreatureTraits(creature);
    const creatureSkillProf = extractCreatureSkillProficiencies(creature);
    const senses = Array.isArray(creature.senses) ? creature.senses.join(', ') : (creature.senses || '');
    const langRaw = Array.isArray(creature.languages) ? creature.languages.join(', ') : (creature.languages || '');
    const langParsed = parseCreatureLanguages(langRaw);
    const speedParts = [];
    if (creature.speed) {
        for (const [k, v] of Object.entries(creature.speed)) {
            if (typeof v === 'number') speedParts.push(`${k} ${v} ft.`);
            else if (v && typeof v === 'object' && typeof v.number === 'number') speedParts.push(`${k} ${v.number} ft.`);
        }
    }
    const walkRaw = creature.speed?.walk;
    const walkSpeed = typeof walkRaw === 'number' ? walkRaw : (walkRaw?.number ?? 30);

    return {
        id: `sk_${Date.now()}`,
        name: config.name || '',
        race: config.race || '',
        type: config.type || 'warrior',
        subtype: config.subtype || null,
        creatureName: creature.name,
        creatureSource: creature.source,
        baseHp: creature.hp || { average: 10, formula: '2d8' },
        baseAc: typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? 10,
        baseSpeed: walkSpeed,
        speedFull: speedParts.join(', ') || '30 ft.',
        baseSize: Array.isArray(creature.size) ? creature.size[0] : creature.size || 'M',
        baseStr: creature.str ?? 10,
        baseDex: creature.dex ?? 10,
        baseCon: creature.con ?? 10,
        baseInt: creature.int ?? 10,
        baseWis: creature.wis ?? 10,
        baseCha: creature.cha ?? 10,
        hitDieFaces: hd.faces,
        hitDiceCount: hd.count,
        creatureActions,
        creatureTraits,
        creatureSkillProficiencies: creatureSkillProf,
        senses,
        languages: langRaw,
        languagesFixed: langParsed.fixed,
        languageChoiceCount: langParsed.choiceCount,
        chosenLanguages: [],
        weapons: [],
        equippedArmor: null,
        hasShield: false,
        saveProficiency: config.saveProficiency || null,
        skillProficiencies: config.skillProficiencies || [],
        skillExpertise: config.skillExpertise || [],
        creatureSkills: creature.skill || {},
        creatureSaves: creature.save || {},
        asiChoices: {},
        knownCantrips: [],
        knownSpells: [],
        items: [],
        hireGoldPerDay: config.hireGoldPerDay ?? 0,
        hireDate: config.hireDate || null,
        hirePayMode: config.hirePayMode || 'owed',
        hirePaidAmount: config.hirePaidAmount ?? 0,
        hireQuestAmount: config.hireQuestAmount ?? 0,
        hireQuestPaid: config.hireQuestPaid ?? false,
        enabled: true,
    };
}

export function getSidekickLevel() {
    if (extensionSettings.v2Enabled && characterV2?.level) {
        return characterV2.level;
    }
    if (extensionSettings.v1Enabled && characterV1?.level) {
        return characterV1.level;
    }
    return character?.level ?? 1;
}

// ─── Date Helpers & Hire Cost Calculation ────────────────────

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const DAYS_PER_SEASON = 30;
const DAYS_PER_SEASON_YEAR = SEASON_ORDER.length * DAYS_PER_SEASON; // 120

// FR calendar: canonical name, unique 4-char prefix for fuzzy matching, month number.
// Every FR month has a unique 4-char prefix, so even with LLM-mangled suffixes
// (Eleasias, Kythorne, Hammertide, etc.) the prefix anchors the match.
const FR_MONTHS_LOCAL = [
    { name: 'hammer',    prefix: 'hamm', num: 1,  daysPerMonth: 30 },
    { name: 'alturiak',  prefix: 'altu', num: 2,  daysPerMonth: 30 },
    { name: 'ches',      prefix: 'ches', num: 3,  daysPerMonth: 30 },
    { name: 'tarsakh',   prefix: 'tars', num: 4,  daysPerMonth: 30 },
    { name: 'mirtul',    prefix: 'mirt', num: 5,  daysPerMonth: 30 },
    { name: 'kythorn',   prefix: 'kyth', num: 6,  daysPerMonth: 30 },
    { name: 'flamerule', prefix: 'flam', num: 7,  daysPerMonth: 30 },
    { name: 'eleasis',   prefix: 'elea', num: 8,  daysPerMonth: 30 },
    { name: 'eleint',    prefix: 'elei', num: 9,  daysPerMonth: 30 },
    { name: 'marpenoth', prefix: 'marp', num: 10, daysPerMonth: 30 },
    { name: 'uktar',     prefix: 'ukta', num: 11, daysPerMonth: 30 },
    { name: 'nightal',   prefix: 'nigh', num: 12, daysPerMonth: 30 },
];
const FR_DAYS_PER_YEAR = 365;

/**
 * Levenshtein edit distance (for short strings only -- FR month names are ≤9 chars).
 */
function editDist(a, b) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (!la) return lb;
    if (!lb) return la;
    const dp = Array.from({ length: la + 1 }, (_, i) => i);
    for (let j = 1; j <= lb; j++) {
        let prev = dp[0];
        dp[0] = j;
        for (let i = 1; i <= la; i++) {
            const tmp = dp[i];
            dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
            prev = tmp;
        }
    }
    return dp[la];
}

/**
 * Match an FR month from a date string using a 3-tier strategy:
 *  1. Exact substring match (canonical name found in the string)
 *  2. 4-char prefix match on word tokens (handles arbitrary suffixes / extra letters)
 *  3. Levenshtein ≤ 2 on word tokens (catches typos like Hammar, Mirthul)
 * Returns the matched month info or null.
 */
function matchFrMonth(dateStr) {
    const lower = dateStr.toLowerCase();

    // Tier 1: exact substring -- fastest path for well-spelled months
    for (const info of FR_MONTHS_LOCAL) {
        if (lower.includes(info.name)) return info;
    }

    // Extract alphabetic word tokens ≥ 3 chars (skip "of", "DR", day numbers)
    const words = lower.match(/[a-z]{3,}/g);
    if (!words) return null;

    // Tier 2: 4-char prefix match -- handles variant suffixes
    // "eleasias" → prefix "elea" → month 8; "kythorne" → "kyth" → month 6
    for (const word of words) {
        if (word.length < 4) continue;
        const wordPfx = word.slice(0, 4);
        for (const info of FR_MONTHS_LOCAL) {
            if (wordPfx === info.prefix) return info;
        }
    }

    // Tier 3: fuzzy match (edit distance ≤ 2) -- catches typos
    // "hammar" → hammer (dist 1); "tarsak" → tarsakh (dist 1)
    for (const word of words) {
        if (word.length < 4) continue;
        let best = null, bestDist = 3;
        for (const info of FR_MONTHS_LOCAL) {
            const d = editDist(word, info.name);
            if (d < bestDist) { bestDist = d; best = info; }
        }
        if (best) return best;
    }

    return null;
}

/**
 * Parse a DnD date string into an abstract day number for comparison.
 * Supports:
 *  - Season dates: "Day 16 of Spring", "Day 16 of Spring, 1247 AE"
 *  - FR months: "3rd of Hammer, 1492 DR", "Eleasias 7, 1492 DR" (fuzzy-matched)
 *  - Real dates: "June 5, 2024", "2024-06-05"
 *
 * Returns { dayNumber, format } or null if unparseable.
 * dayNumber is an abstract integer allowing subtraction for elapsed days.
 */
export function parseDndDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const d = dateStr.trim();

    // 1) Season-based: "Day X of <Season>" with optional year suffix
    const seasonMatch = d.match(/day\s+(\d+)\s+of\s+(spring|summer|autumn|fall|winter)/i);
    if (seasonMatch) {
        const dayNum = parseInt(seasonMatch[1]);
        let seasonName = seasonMatch[2].toLowerCase();
        if (seasonName === 'fall') seasonName = 'autumn';
        const seasonIdx = SEASON_ORDER.indexOf(seasonName);
        const yearMatch = d.match(/,?\s*(\d{3,})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : 0;
        const absDays = (year * DAYS_PER_SEASON_YEAR) + (seasonIdx * DAYS_PER_SEASON) + dayNum;
        return { dayNumber: absDays, format: 'season' };
    }

    // 2) Forgotten Realms month (fuzzy 3-tier match)
    const frMonth = matchFrMonth(d);
    if (frMonth) {
        const dayMatch = d.match(/(\d+)/);
        if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            const yearMatch = d.match(/(\d{3,})/g);
            const year = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 0;
            const absDays = (year * FR_DAYS_PER_YEAR) + ((frMonth.num - 1) * frMonth.daysPerMonth) + day;
            return { dayNumber: absDays, format: 'fr' };
        }
    }

    // 3) Standard date fallback
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) {
        const daysSinceEpoch = Math.floor(parsed / 86400000);
        return { dayNumber: daysSinceEpoch, format: 'real' };
    }

    return null;
}

/**
 * Calculate the gold owed to a sidekick based on hire date, current date, rate, and payments.
 * payMode: 'owed' (accumulates debt), 'daily' (paid each day, no debt tracked)
 * paidAmount: gold already paid as a lump sum (reduces owed in 'owed' mode)
 * Returns { daysElapsed, totalCost, goldOwed } or null if dates can't be compared.
 */
export function calculateHireCost(hireDate, currentDate, goldPerDay, payMode, paidAmount) {
    if (payMode === 'free') return { daysElapsed: 0, totalCost: 0, goldOwed: 0 };
    if (!hireDate || !currentDate || !goldPerDay) return null;

    const hd = parseDndDate(hireDate);
    const cd = parseDndDate(currentDate);
    if (!hd || !cd) return null;
    if (hd.format !== cd.format) return null;

    const daysElapsed = Math.max(0, cd.dayNumber - hd.dayNumber);
    const totalCost = daysElapsed * goldPerDay;

    if (payMode === 'daily') {
        return { daysElapsed, totalCost, goldOwed: 0 };
    }

    const paid = paidAmount || 0;
    return { daysElapsed, totalCost, goldOwed: Math.max(0, totalCost - paid) };
}
