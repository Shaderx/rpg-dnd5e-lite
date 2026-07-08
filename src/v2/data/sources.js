/**
 * V1 Character System - CDN Data Sources
 * Fetch helpers for species, backgrounds, feats, and other data from 5e.tools CDN.
 */

import { CDN_DATA, V1_SOURCES } from '../core/constants.js';
import { fetchWithCache } from '../../core/spellCache.js';

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
    _racesInflight = fetchWithCache(`${CDN_DATA}/races.json`, 'v2-races', FETCH_TIMEOUT)
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
    _backgroundsInflight = fetchWithCache(`${CDN_DATA}/backgrounds.json`, 'v2-backgrounds', FETCH_TIMEOUT)
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
    _featsInflight = fetchWithCache(`${CDN_DATA}/feats.json`, 'v2-feats', FETCH_TIMEOUT)
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
    _classIndexInflight = fetchWithCache(`${CDN_DATA}/class/index.json`, 'v2-class-index', FETCH_TIMEOUT)
        .then(data => { _classIndex = data; return data; })
        .catch(() => null)
        .finally(() => { _classIndexInflight = null; });
    return _classIndexInflight;
}

const _classFileCache = new Map();

export async function fetchClassFile(filename) {
    if (_classFileCache.has(filename)) return _classFileCache.get(filename);
    const data = await fetchWithCache(`${CDN_DATA}/class/${filename}`, `v2-class-${filename}`, FETCH_TIMEOUT);
    if (data) _classFileCache.set(filename, data);
    return data;
}

/** Synchronous access to a previously fetched class file (for prompt building). */
export function getCachedClassFile(filename) {
    if (!filename) return null;
    return _classFileCache.get(filename) || null;
}

// --- Spells ---

const _spellSourceCache = new Map();

export async function fetchSpellSource(source) {
    const key = source.toLowerCase();
    if (_spellSourceCache.has(key)) return _spellSourceCache.get(key);
    const url = `${CDN_DATA}/spells/spells-${key}.json`;
    const cacheKey = `v2-spells-${key}`;
    const data = await fetchWithCache(url, cacheKey, FETCH_TIMEOUT);
    const spells = data?.spell || [];
    _spellSourceCache.set(key, spells);
    return spells;
}

export function clearSpellSourceMemory() {
    _spellSourceCache.clear();
}

let _spellClassLookup = null;
let _spellClassLookupInflight = null;

export async function fetchSpellClassLookup() {
    if (_spellClassLookup) return _spellClassLookup;
    if (_spellClassLookupInflight) return _spellClassLookupInflight;
    _spellClassLookupInflight = fetchWithCache(
        `${CDN_DATA}/generated/gendata-spell-source-lookup.json`,
        'v2-spell-class-lookup',
        FETCH_TIMEOUT,
    )
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
    _equipInflight = fetchWithCache(`${CDN_DATA}/items-base.json`, 'v2-items-base', FETCH_TIMEOUT)
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
        fetchWithCache(`${CDN_DATA}/items.json`, 'v2-items', FETCH_TIMEOUT),
        fetchWithCache(`${CDN_DATA}/magicvariants.json`, 'v2-magicvariants', FETCH_TIMEOUT),
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
    _optFeatInflight = fetchWithCache(`${CDN_DATA}/optionalfeatures.json`, 'v2-optionalfeatures', FETCH_TIMEOUT)
        .then(data => {
            _optFeatCache = data?.optionalfeature ? data.optionalfeature.filter(f => V1_SOURCES.includes(f.source)) : [];
            return _optFeatCache;
        })
        .catch(() => { _optFeatCache = []; return []; })
        .finally(() => { _optFeatInflight = null; });
    return _optFeatInflight;
}
