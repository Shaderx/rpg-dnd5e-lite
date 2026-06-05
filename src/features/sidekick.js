/**
 * D&D 5e Lite - Sidekick
 * Bestiary fetch, creature action parsing, weapon cross-ref,
 * stat scaling engine, and sidekick class constants.
 */

import { character, bestiaryCache, weaponItemCache, setWeaponItemCache } from '../core/state.js';

const CDN_DATA = 'https://cdn.jsdelivr.net/gh/5etools-mirror-3/5etools-src@main/data';

// ─── Constants ──────────────────────────────────────────────

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

    const promise = fetch(`${CDN_DATA}/bestiary/${filename}`, { signal: AbortSignal.timeout(30000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const monsters = data?.monster || [];
            bestiaryCache.set(sourceKey, monsters);
            return monsters;
        })
        .catch(err => { console.warn(`[D&D 5e Lite] Bestiary fetch failed for "${sourceKey}":`, err); return null; })
        .finally(() => { _bestiaryInflight.delete(sourceKey); });

    _bestiaryInflight.set(sourceKey, promise);
    return promise;
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
            type: typeof m.type === 'string' ? m.type : m.type?.type || '?',
            size: Array.isArray(m.size) ? m.size[0] : m.size || '?',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchCreatures(query, sourceKeys) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    for (const key of sourceKeys) {
        const monsters = bestiaryCache.get(key);
        if (!monsters) continue;
        for (const m of monsters) {
            if (m._copy || !m.name) continue;
            if (m.name.toLowerCase().includes(q)) {
                results.push({
                    name: m.name,
                    source: m.source || key,
                    cr: m.cr ?? '?',
                    type: typeof m.type === 'string' ? m.type : m.type?.type || '?',
                    size: Array.isArray(m.size) ? m.size[0] : m.size || '?',
                });
            }
        }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
}

export function getCreatureStats(name, source) {
    for (const [, monsters] of bestiaryCache) {
        const found = monsters.find(m => m.name === name && m.source === source);
        if (found) return found;
    }
    return null;
}

// ─── Weapon Items ───────────────────────────────────────────

let _weaponItemInflight = null;

export async function fetchWeaponItems() {
    if (weaponItemCache) return weaponItemCache;
    if (_weaponItemInflight) return _weaponItemInflight;
    _weaponItemInflight = fetch(`${CDN_DATA}/items-base.json`, { signal: AbortSignal.timeout(20000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            const items = data?.baseitem || [];
            const cache = new Map();
            for (const item of items) {
                if (!item.weapon && !item.weaponCategory) continue;
                const key = item.name.toLowerCase();
                if (!cache.has(key)) cache.set(key, item);
            }
            setWeaponItemCache(cache);
            return cache;
        })
        .catch(err => { console.warn('[D&D 5e Lite] Weapon items fetch failed:', err); return null; })
        .finally(() => { _weaponItemInflight = null; });
    return _weaponItemInflight;
}

export function enrichWeaponFromItems(weapon) {
    if (!weaponItemCache) return weapon;
    const item = weaponItemCache.get(weapon.name.toLowerCase());
    if (!item) return weapon;
    const props = (item.property || []).map(p => p.split('|')[0]);
    weapon.properties = props;
    weapon.finesse = props.includes('F');
    if (props.includes('V') && item.dmg2) {
        weapon.versatileDice = item.dmg2;
    }
    if (item.range) weapon.range = item.range;
    return weapon;
}

// ─── Creature Action Parsing ────────────────────────────────

const RE_ATK_TYPE  = /{@atk\s+([\w,]+)}/;
const RE_DAMAGE    = /{@damage\s+([^}]+)}/;
const RE_DMG_TYPE  = /(\w+)\s+damage/;
const RE_RANGE     = /range\s+([\d/]+)\s*ft/i;
const RE_VERSATILE = /(\d+d\d+(?:\s*\+\s*\d+)?)\)\s*\w+\s+damage\s+if\s+used\s+with\s+two\s+hands/i;

function stripDamageMod(diceStr) {
    return diceStr.replace(/\s*[+\-]\s*\d+\s*$/, '').trim();
}

export function parseCreatureActions(creature) {
    const weapons = [];
    const specialActions = [];
    if (!creature?.action) return { weapons, specialActions };

    for (const action of creature.action) {
        const text = Array.isArray(action.entries) ? action.entries.join(' ') : '';
        const atkMatch = text.match(RE_ATK_TYPE);

        if (atkMatch) {
            const damageMatch = text.match(RE_DAMAGE);
            const dmgTypeMatch = text.match(RE_DMG_TYPE);
            const rangeMatch = text.match(RE_RANGE);
            const versMatch = text.match(RE_VERSATILE);

            const weapon = {
                name: action.name,
                attackType: atkMatch[1],
                damageDice: damageMatch ? stripDamageMod(damageMatch[1]) : '?',
                damageType: dmgTypeMatch ? dmgTypeMatch[1] : 'unknown',
                properties: [],
                versatileDice: versMatch ? stripDamageMod(versMatch[1]) : null,
                range: rangeMatch ? rangeMatch[1] : null,
                finesse: false,
            };
            weapons.push(weapon);
        } else if (action.name?.toLowerCase() !== 'multiattack') {
            const condensed = text
                .replace(/{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')
                .replace(/\s+/g, ' ')
                .trim();
            if (condensed) {
                specialActions.push({
                    name: action.name,
                    text: condensed.length > 200 ? condensed.slice(0, 197) + '...' : condensed,
                });
            }
        }
    }
    return { weapons, specialActions };
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
    for (const asiLvl of asiLevels) {
        if (asiLvl > level) break;
        const choice = asiChoices[asiLvl];
        if (!choice || !Array.isArray(choice) || choice.length < 2) continue;
        const [a1, a2] = choice;
        if (a1 && scores[a1] !== undefined) scores[a1] = Math.min(20, scores[a1] + 1);
        if (a2 && scores[a2] !== undefined) scores[a2] = Math.min(20, scores[a2] + 1);
    }

    const mods = {};
    for (const a of abilities) mods[a] = abilityMod(scores[a]);

    const proficiency = Math.ceil(level / 4) + 1;

    const hitDice = parseHitDice(sidekick.baseHp?.formula);
    const totalHitDice = hitDice.count + (level - 1);
    const avgPerDie = Math.floor(hitDice.faces / 2) + 1;
    const hp = Math.max(1, totalHitDice * (avgPerDie + mods.con));

    const saves = {};
    for (const a of abilities) {
        const isProficient = sidekick.saveProficiency === a;
        saves[a] = { mod: mods[a] + (isProficient ? proficiency : 0), proficient: isProficient };
    }

    const skills = {};
    const profSkills = sidekick.skillProficiencies || [];
    const expertise = sidekick.skillExpertise || [];
    for (const sk of ALL_SKILLS) {
        const ab = SKILL_ABILITIES[sk];
        const isProf = profSkills.includes(sk);
        const isExpert = expertise.includes(sk);
        let bonus = mods[ab] || 0;
        if (isExpert) bonus += proficiency * 2;
        else if (isProf) bonus += proficiency;
        skills[sk] = { mod: bonus, proficient: isProf, expertise: isExpert };
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

    const features = buildFeatureSummary(sidekick, level, { proficiency, mods, scores, spellcasting, extraAttack });

    return {
        scores, mods, proficiency, hp, saves, skills,
        spellcasting, extraAttack, features,
        hitDieFaces: hitDice.faces,
        totalHitDice,
    };
}

// ─── Feature Summary ────────────────────────────────────────

function buildFeatureSummary(sidekick, level, ctx) {
    const feats = [];
    const type = sidekick.type;

    if (type === 'warrior') {
        const sub = sidekick.subtype;
        if (sub === 'attacker') feats.push('Martial Role (Attacker, +2 attack)');
        else if (sub === 'defender') feats.push('Martial Role (Defender, reaction: impose disadvantage)');
        if (level >= 2) feats.push(`Second Wind (1d10+${level})`);
        if (level >= 3) feats.push('Improved Critical (19-20)');
        if (ctx.extraAttack >= 2) feats.push(`Extra Attack (${ctx.extraAttack})`);
        if (level >= 7) feats.push('Battle Readiness (adv. on initiative)');
        if (level >= 10) feats.push('Improved Defense (+1 AC)');
        if (level >= 11) feats.push('Indomitable (1 reroll/LR)');
        if (level >= 18) feats.push('Indomitable (2 rerolls/LR)');
    } else if (type === 'expert') {
        feats.push('Helpful (Help as bonus action)');
        if (level >= 3) feats.push('Expertise (2 skills)');
        if (level >= 6) feats.push('Coordinated Strike (+2d6 on Help-aided attack)');
        if (level >= 7) feats.push('Evasion');
        if (level >= 9) feats.push('Inspiring Help (+1d6 to helped ally)');
        if (level >= 11) feats.push('Reliable Talent (min 10 on proficient checks)');
        if (level >= 14) feats.push('Cunning Action');
        if (level >= 15) feats.push('Expertise (4 skills total)');
        if (level >= 18) feats.push('Sharp Mind (+1 save prof)');
        if (level >= 20) feats.push('Inspiring Help (+2d6)');
    } else if (type === 'spellcaster') {
        if (level >= 6) feats.push('Potent Cantrips (add ability mod to cantrip dmg)');
        if (level >= 14) feats.push('Empowered Spells (add ability mod to spell dmg/heal)');
        if (level >= 18) feats.push('Focused Casting (adv. on concentration saves)');
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

// ─── Spell Search ───────────────────────────────────────────

const _spellSourceCache = new Map();
let _spellSourceInflight = new Map();

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

function spellMatchesClassList(spell, classList) {
    if (!spell?.classes?.fromClassList) return false;
    const lists = classList.split('|');
    return spell.classes.fromClassList.some(c => lists.includes(c.name));
}

export async function searchSpellsForSidekick(query, classList, maxSpellLevel, isCantrip) {
    const sources = ['phb', 'xge', 'tce'];
    const allSpells = [];
    for (const src of sources) {
        const spells = await fetchSpellSource(src);
        if (spells) allSpells.push(...spells);
    }

    const q = query.toLowerCase();
    const targetLevel = isCantrip ? 0 : null;

    return allSpells
        .filter(s => {
            if (!s.name?.toLowerCase().includes(q)) return false;
            if (!spellMatchesClassList(s, classList)) return false;
            if (targetLevel !== null) return s.level === targetLevel;
            return s.level >= 1 && s.level <= maxSpellLevel;
        })
        .map(s => ({ name: s.name, level: s.level, school: s.school, source: s.source }))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
        .slice(0, 30);
}

// ─── Sidekick CRUD Helpers ──────────────────────────────────

export function createSidekickFromCreature(creature, config) {
    const hd = parseHitDice(creature.hp?.formula);
    const { weapons, specialActions } = parseCreatureActions(creature);
    for (const w of weapons) enrichWeaponFromItems(w);

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
        baseSpeed: creature.speed?.walk ?? 30,
        baseSize: Array.isArray(creature.size) ? creature.size[0] : creature.size || 'M',
        baseStr: creature.str ?? 10,
        baseDex: creature.dex ?? 10,
        baseCon: creature.con ?? 10,
        baseInt: creature.int ?? 10,
        baseWis: creature.wis ?? 10,
        baseCha: creature.cha ?? 10,
        hitDieFaces: hd.faces,
        hitDiceCount: hd.count,
        weapons,
        specialActions,
        saveProficiency: config.saveProficiency || null,
        skillProficiencies: config.skillProficiencies || [],
        skillExpertise: config.skillExpertise || [],
        creatureSkills: creature.skill || {},
        creatureSaves: creature.save || {},
        asiChoices: {},
        knownCantrips: [],
        knownSpells: [],
        hireGoldPerDay: config.hireGoldPerDay ?? 0,
        hireDate: config.hireDate || null,
        enabled: true,
    };
}

export function getSidekickLevel() {
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
 * Calculate the gold owed to a sidekick based on hire date, current date, and rate.
 * Returns { daysElapsed, goldOwed } or null if dates can't be compared.
 */
export function calculateHireCost(hireDate, currentDate, goldPerDay) {
    if (!hireDate || !currentDate || !goldPerDay) return null;

    const hd = parseDndDate(hireDate);
    const cd = parseDndDate(currentDate);
    if (!hd || !cd) return null;
    if (hd.format !== cd.format) return null;

    const daysElapsed = Math.max(0, cd.dayNumber - hd.dayNumber);
    return { daysElapsed, goldOwed: daysElapsed * goldPerDay };
}
