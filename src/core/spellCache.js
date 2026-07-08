/**
 * D&D 5e Lite - Local Spell Database Cache
 * IndexedDB-backed persistent cache for CDN spell data.
 * Only re-fetches when the remote file has changed (via Last-Modified / ETag)
 * or when the user forces a refresh from Settings.
 */

const DB_NAME = 'dnd5e-lite-spell-cache';
const DB_VERSION = 1;
const STORE_NAME = 'sources';

let _db = null;
let _dbInflight = null;

function openDB() {
    if (_db) return Promise.resolve(_db);
    if (_dbInflight) return _dbInflight;

    _dbInflight = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    }).catch(err => {
        console.warn('[D&D 5e Lite] IndexedDB unavailable, spell cache disabled:', err);
        _dbInflight = null;
        return null;
    });

    return _dbInflight;
}

function idbGet(key) {
    return openDB().then(db => {
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    });
}

function idbPut(record) {
    return openDB().then(db => {
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    });
}

function idbClear() {
    return openDB().then(db => {
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    });
}

/**
 * Fetch a spell source JSON with local caching.
 * On first load: fetches fully, stores in IndexedDB with Last-Modified/ETag.
 * On subsequent loads: sends conditional request; uses cached data if 304.
 *
 * @param {string} url - Full CDN URL for the spell source file
 * @param {string} cacheKey - Unique key for this source (e.g. "spells-xphb")
 * @param {number} [timeout=20000] - Fetch timeout in ms
 * @returns {Promise<object|null>} Parsed JSON or null on failure
 */
export async function fetchWithCache(url, cacheKey, timeout = 20000) {
    const cached = await idbGet(cacheKey);

    const headers = {};
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    else if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

    try {
        const resp = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });

        if (resp.status === 304 && cached?.data) {
            return cached.data;
        }

        if (!resp.ok) {
            if (cached?.data) return cached.data;
            console.warn(`[D&D 5e Lite] Spell cache fetch failed (${resp.status}): ${url}`);
            return null;
        }

        const data = await resp.json();
        const etag = resp.headers.get('ETag') || '';
        const lastModified = resp.headers.get('Last-Modified') || '';

        await idbPut({
            key: cacheKey,
            data,
            etag,
            lastModified,
            fetchedAt: Date.now(),
        });

        return data;
    } catch (err) {
        if (cached?.data) {
            console.warn(`[D&D 5e Lite] Network error for ${cacheKey}, using cached data`);
            return cached.data;
        }
        console.warn(`[D&D 5e Lite] Spell cache fetch error for ${url}:`, err.message || err);
        return null;
    }
}

/**
 * Load spell source from local cache only (no network).
 * Returns null if not cached.
 * @param {string} cacheKey
 * @returns {Promise<object|null>}
 */
export async function getFromCacheOnly(cacheKey) {
    const cached = await idbGet(cacheKey);
    return cached?.data || null;
}

/**
 * Clear all cached spell data. Used by the Force Refresh button.
 */
export async function clearSpellCache() {
    await idbClear();
}

/**
 * Get cache metadata (for UI display).
 * @returns {Promise<{ entries: number, totalSize: string, lastFetched: number|null }>}
 */
export async function getCacheInfo() {
    const db = await openDB();
    if (!db) return { entries: 0, totalSize: '0 KB', lastFetched: null };

    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const records = req.result || [];
            let latest = null;
            for (const r of records) {
                if (r.fetchedAt && (!latest || r.fetchedAt > latest)) latest = r.fetchedAt;
            }
            resolve({
                entries: records.length,
                lastFetched: latest,
            });
        };
        req.onerror = () => resolve({ entries: 0, totalSize: '0 KB', lastFetched: null });
    });
}
