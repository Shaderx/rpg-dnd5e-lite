/**
 * V1 Character System - CDN Data Sources
 * Fetch helpers for species, backgrounds, feats, and other data from 5e.tools CDN.
 */

import { CDN_DATA, V1_SOURCES } from '../core/constants.js';

const FETCH_TIMEOUT = 20000;

async function fetchJson(url) {
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
        if (!r.ok) {
            console.warn(`[D&D V1] Fetch failed (${r.status}): ${url}`);
            return null;
        }
        return await r.json();
    } catch (err) {
        console.warn(`[D&D V1] Fetch error for ${url}:`, err.message || err);
        return null;
    }
}

// --- Species (Races) ---

let _racesCache = null;
let _racesInflight = null;

export async function fetchRaces() {
    if (_racesCache) return _racesCache;
    if (_racesInflight) return _racesInflight;
    _racesInflight = fetchJson(`${CDN_DATA}/races.json`)
        .then(data => { _racesCache = data; return data; })
        .catch(() => null)
        .finally(() => { _racesInflight = null; });
    return _racesInflight;
}

// --- Backgrounds ---

let _backgroundsCache = null;
let _backgroundsInflight = null;

export async function fetchBackgrounds() {
    if (_backgroundsCache) return _backgroundsCache;
    if (_backgroundsInflight) return _backgroundsInflight;
    _backgroundsInflight = fetchJson(`${CDN_DATA}/backgrounds.json`)
        .then(data => { _backgroundsCache = data; return data; })
        .catch(() => null)
        .finally(() => { _backgroundsInflight = null; });
    return _backgroundsInflight;
}

// --- Feats ---

let _featsCache = null;
let _featsInflight = null;

export async function fetchFeats() {
    if (_featsCache) return _featsCache;
    if (_featsInflight) return _featsInflight;
    _featsInflight = fetchJson(`${CDN_DATA}/feats.json`)
        .then(data => {
            _featsCache = data?.feat ? data.feat.filter(f => V1_SOURCES.includes(f.source)) : [];
            return _featsCache;
        })
        .catch(() => { _featsCache = []; return []; })
        .finally(() => { _featsInflight = null; });
    return _featsInflight;
}

// --- Class Index & Class Data ---

let _classIndex = null;
let _classIndexInflight = null;

export async function fetchClassIndex() {
    if (_classIndex) return _classIndex;
    if (_classIndexInflight) return _classIndexInflight;
    _classIndexInflight = fetchJson(`${CDN_DATA}/class/index.json`)
        .then(data => { _classIndex = data; return data; })
        .catch(() => null)
        .finally(() => { _classIndexInflight = null; });
    return _classIndexInflight;
}

const _classFileCache = new Map();

export async function fetchClassFile(filename) {
    if (_classFileCache.has(filename)) return _classFileCache.get(filename);
    const data = await fetchJson(`${CDN_DATA}/class/${filename}`);
    if (data) _classFileCache.set(filename, data);
    return data;
}

// --- Spells ---

const _spellSourceCache = new Map();

export async function fetchSpellSource(source) {
    const key = source.toLowerCase();
    if (_spellSourceCache.has(key)) return _spellSourceCache.get(key);
    const data = await fetchJson(`${CDN_DATA}/spells/spells-${key}.json`);
    const spells = data?.spell || [];
    _spellSourceCache.set(key, spells);
    return spells;
}

let _spellClassLookup = null;
let _spellClassLookupInflight = null;

export async function fetchSpellClassLookup() {
    if (_spellClassLookup) return _spellClassLookup;
    if (_spellClassLookupInflight) return _spellClassLookupInflight;
    _spellClassLookupInflight = fetchJson(`${CDN_DATA}/generated/gendata-spell-source-lookup.json`)
        .then(data => { _spellClassLookup = data; return data; })
        .catch(() => null)
        .finally(() => { _spellClassLookupInflight = null; });
    return _spellClassLookupInflight;
}

// --- Equipment ---

let _equipCache = null;
let _equipInflight = null;

export async function fetchEquipment() {
    if (_equipCache) return _equipCache;
    if (_equipInflight) return _equipInflight;
    _equipInflight = fetchJson(`${CDN_DATA}/items-base.json`)
        .then(data => { _equipCache = data; return data; })
        .catch(() => null)
        .finally(() => { _equipInflight = null; });
    return _equipInflight;
}

// --- Magic Items ---

let _magicItemsCache = null;
let _magicItemsInflight = null;

export async function fetchMagicItems() {
    if (_magicItemsCache) return _magicItemsCache;
    if (_magicItemsInflight) return _magicItemsInflight;
    _magicItemsInflight = Promise.all([
        fetchJson(`${CDN_DATA}/items.json`),
        fetchJson(`${CDN_DATA}/magicvariants.json`),
    ])
        .then(([items, variants]) => {
            _magicItemsCache = { items: items?.item || [], variants: variants?.magicvariant || [] };
            return _magicItemsCache;
        })
        .catch(() => { _magicItemsCache = { items: [], variants: [] }; return _magicItemsCache; })
        .finally(() => { _magicItemsInflight = null; });
    return _magicItemsInflight;
}

// --- Optional Features (Metamagic, Invocations, etc.) ---

let _optFeatCache = null;
let _optFeatInflight = null;

export async function fetchOptionalFeatures() {
    if (_optFeatCache) return _optFeatCache;
    if (_optFeatInflight) return _optFeatInflight;
    _optFeatInflight = fetchJson(`${CDN_DATA}/optionalfeatures.json`)
        .then(data => {
            _optFeatCache = data?.optionalfeature ? data.optionalfeature.filter(f => V1_SOURCES.includes(f.source)) : [];
            return _optFeatCache;
        })
        .catch(() => { _optFeatCache = []; return []; })
        .finally(() => { _optFeatInflight = null; });
    return _optFeatInflight;
}
