/**
 * D&D 5e Lite - Auto Background Switching
 * Switches ST backgrounds based on parsed RP time (day/night) and location from headers.
 */

import { getContext } from '../../../../../extensions.js';
import { headerInfo, autoBackgrounds, setAutoBackgrounds } from '../core/state.js';
import { saveAutoBackgrounds } from '../core/persistence.js';
import { inferTimeOfDay } from './weatherVisuals.js';

let lastAppliedBackground = null;
const NIGHT_SUFFIX_RE = /(?:[_\-\s]+(?:n|night))$/i;

/**
 * Fetch the list of available ST backgrounds from the server.
 * @returns {Promise<string[]>} Array of background filenames
 */
export async function fetchAvailableBackgrounds() {
    try {
        const { getRequestHeaders } = getContext();
        const response = await fetch('/api/backgrounds/all', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });
        if (!response.ok) return [];
        const { images } = await response.json();
        return images.map(img => img.filename);
    } catch (e) {
        console.warn('[D&D 5e Lite] Failed to fetch backgrounds:', e);
        return [];
    }
}

/**
 * Returns an empty default auto-background config structure.
 */
export function getDefaultAutoBackgroundData() {
    return {
        enabled: true,
        entries: [
            { name: 'Default', day: '', night: '' },
        ],
    };
}

/**
 * Determine whether the current time-of-day counts as "night".
 * Morning, day, and evening all map to the "day" background variant.
 */
function isNightTime() {
    const tod = inferTimeOfDay(headerInfo.time, headerInfo.weather);
    return tod === 'night';
}

/**
 * Find the best matching entry for the current location.
 * Uses tokenized matching against entry names and selected background filenames.
 * Trailing night suffixes (_n / _night) in filenames are ignored for matching.
 * Falls back to the Default entry (index 0) if no match.
 */
function findMatchingEntry(entries, location) {
    const defaultEntry = entries[0] || null;
    if (!location || entries.length <= 1) return defaultEntry;

    const locationTokens = collectLocationTokens(location);
    if (locationTokens.length === 0) return defaultEntry;

    let bestEntry = null;
    let bestScore = null;

    for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        const score = getEntryMatchScore(entry, locationTokens);
        if (!score) continue;

        if (isBetterMatch(score, bestScore)) {
            bestEntry = entry;
            bestScore = score;
        }
    }

    return bestEntry || defaultEntry;
}

function normalizeBackgroundNameForMatch(value) {
    if (!value) return '';
    const noExt = String(value).replace(/\.[^./\\]+$/, '');
    return noExt.replace(NIGHT_SUFFIX_RE, '');
}

function tokenizeMatchValue(value) {
    if (!value) return [];
    const cleaned = String(value)
        .replace(/[’']/g, '')
        .replace(/[^A-Za-z0-9_\-\s]/g, ' ')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .toLowerCase();
    if (!cleaned) return [];
    return cleaned.split(/\s+/).filter(t => t.length >= 2);
}

function dedupeTokens(tokens) {
    const out = [];
    const seen = new Set();
    for (const t of tokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

function collectLocationTokens(location) {
    const raw = String(location || '');
    const capitalized = raw.match(/\b[A-Z][A-Za-z0-9']*\b/g) || [];
    const capitalizedTokens = capitalized
        .map(t => t.replace(/[’']/g, '').toLowerCase())
        .filter(t => t.length >= 2);
    const genericTokens = tokenizeMatchValue(raw);
    return dedupeTokens([...capitalizedTokens, ...genericTokens]);
}

function collectEntryTokens(entry) {
    const sources = [];
    const name = String(entry?.name || '').trim();
    if (name && !/^default$/i.test(name)) sources.push(name);

    const day = normalizeBackgroundNameForMatch(entry?.day);
    const night = normalizeBackgroundNameForMatch(entry?.night);
    if (day) sources.push(day);
    if (night) sources.push(night);

    const allTokens = [];
    for (const s of sources) {
        allTokens.push(...tokenizeMatchValue(s));
    }
    return dedupeTokens(allTokens);
}

function getEntryMatchScore(entry, locationTokens) {
    const entryTokens = collectEntryTokens(entry);
    if (entryTokens.length === 0) return null;

    let exactCount = 0;
    let fuzzyCount = 0;
    let bestTokenIndex = Number.POSITIVE_INFINITY;

    for (const locToken of locationTokens) {
        let foundExact = false;
        for (let i = 0; i < entryTokens.length; i++) {
            if (entryTokens[i] === locToken) {
                exactCount++;
                bestTokenIndex = Math.min(bestTokenIndex, i);
                foundExact = true;
                break;
            }
        }
        if (foundExact) continue;

        for (let i = 0; i < entryTokens.length; i++) {
            const token = entryTokens[i];
            if (token.includes(locToken) || locToken.includes(token)) {
                fuzzyCount++;
                bestTokenIndex = Math.min(bestTokenIndex, i);
                break;
            }
        }
    }

    if (exactCount === 0 && fuzzyCount === 0) return null;
    return { exactCount, fuzzyCount, bestTokenIndex, tokenCount: entryTokens.length };
}

function isBetterMatch(next, current) {
    if (!current) return true;
    if (next.exactCount !== current.exactCount) return next.exactCount > current.exactCount;
    if (next.fuzzyCount !== current.fuzzyCount) return next.fuzzyCount > current.fuzzyCount;
    if (next.bestTokenIndex !== current.bestTokenIndex) return next.bestTokenIndex < current.bestTokenIndex;
    if (next.tokenCount !== current.tokenCount) return next.tokenCount < current.tokenCount;
    return false;
}

/**
 * Main evaluation: check current header state and switch background if needed.
 * Called after every header parse.
 */
export async function evaluateAutoBackground() {
    if (!autoBackgrounds || !autoBackgrounds.enabled) return;
    if (!autoBackgrounds.entries || autoBackgrounds.entries.length === 0) return;

    const entry = findMatchingEntry(autoBackgrounds.entries, headerInfo.location);
    if (!entry) return;

    const night = isNightTime();
    let targetBg = night ? (entry.night || entry.day) : (entry.day || entry.night);
    if (!targetBg) return;

    if (targetBg === lastAppliedBackground) return;

    lastAppliedBackground = targetBg;
    try {
        const { executeSlashCommandsWithOptions } = getContext();
        await executeSlashCommandsWithOptions(`/bg ${targetBg}`);
    } catch (e) {
        console.warn('[D&D 5e Lite] Failed to switch background:', e);
    }
}

/**
 * Reset the last applied background tracker (call on chat change).
 */
export function resetAutoBackgroundState() {
    lastAppliedBackground = null;
}

/**
 * Render the auto-background modal content dynamically.
 * Fetches available backgrounds and populates the dropdown selectors.
 */
export async function openAutoBackgroundModal() {
    const data = autoBackgrounds || getDefaultAutoBackgroundData();

    const backgrounds = await fetchAvailableBackgrounds();

    const $modal = $('#dnd-auto-bg-modal');
    const $toggle = $modal.find('#dnd-auto-bg-enabled');
    const $list = $modal.find('#dnd-auto-bg-entries');

    $toggle.prop('checked', data.enabled);

    renderEntries($list, data.entries, backgrounds);

    $modal.show();
}

function buildOptionHtml(backgrounds, selected) {
    let html = '<option value="">(none)</option>';
    for (const bg of backgrounds) {
        const sel = bg === selected ? ' selected' : '';
        const label = bg.replace(/\.[^.]+$/, '');
        html += `<option value="${bg}"${sel}>${label}</option>`;
    }
    return html;
}

function renderEntries($list, entries, backgrounds) {
    $list.empty();

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isDefault = i === 0;
        const nameHtml = isDefault
            ? `<span class="dnd-auto-bg-entry-name">Default (fallback)</span>`
            : `<input type="text" class="dnd-auto-bg-name-input" value="${entry.name || ''}" placeholder="Location name" data-idx="${i}" />`;

        const deleteBtn = isDefault
            ? ''
            : `<button class="dnd-auto-bg-delete" data-idx="${i}" title="Remove"><i class="fa-solid fa-trash"></i></button>`;

        const $row = $(`
            <div class="dnd-auto-bg-entry" data-idx="${i}">
                <div class="dnd-auto-bg-entry-header">
                    ${nameHtml}
                    ${deleteBtn}
                </div>
                <div class="dnd-auto-bg-selectors">
                    <label>
                        <span>Day:</span>
                        <select class="dnd-auto-bg-day" data-idx="${i}">
                            ${buildOptionHtml(backgrounds, entry.day)}
                        </select>
                    </label>
                    <label>
                        <span>Night:</span>
                        <select class="dnd-auto-bg-night" data-idx="${i}">
                            ${buildOptionHtml(backgrounds, entry.night)}
                        </select>
                    </label>
                </div>
            </div>
        `);

        $list.append($row);
    }
}

/**
 * Collect current modal state into a data object and save it.
 */
export function saveAutoBackgroundModal() {
    const $modal = $('#dnd-auto-bg-modal');
    const enabled = $modal.find('#dnd-auto-bg-enabled').prop('checked');

    const entries = [];
    $modal.find('.dnd-auto-bg-entry').each(function () {
        const idx = parseInt($(this).data('idx'), 10);
        const isDefault = idx === 0;
        const name = isDefault ? 'Default' : $(this).find('.dnd-auto-bg-name-input').val() || '';
        const day = $(this).find('.dnd-auto-bg-day').val() || '';
        const night = $(this).find('.dnd-auto-bg-night').val() || '';
        entries.push({ name, day, night });
    });

    const data = { enabled, entries };
    saveAutoBackgrounds(data);
    setAutoBackgrounds(data);
    return data;
}

/**
 * Add a new location entry to the modal list.
 */
export async function addAutoBackgroundEntry() {
    const $list = $('#dnd-auto-bg-entries');
    const backgrounds = await fetchAvailableBackgrounds();
    const newIdx = $list.find('.dnd-auto-bg-entry').length;

    const $row = $(`
        <div class="dnd-auto-bg-entry" data-idx="${newIdx}">
            <div class="dnd-auto-bg-entry-header">
                <input type="text" class="dnd-auto-bg-name-input" value="" placeholder="Location name" data-idx="${newIdx}" />
                <button class="dnd-auto-bg-delete" data-idx="${newIdx}" title="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="dnd-auto-bg-selectors">
                <label>
                    <span>Day:</span>
                    <select class="dnd-auto-bg-day" data-idx="${newIdx}">
                        ${buildOptionHtml(backgrounds, '')}
                    </select>
                </label>
                <label>
                    <span>Night:</span>
                    <select class="dnd-auto-bg-night" data-idx="${newIdx}">
                        ${buildOptionHtml(backgrounds, '')}
                    </select>
                </label>
            </div>
        </div>
    `);

    $list.append($row);
}

/**
 * Remove an entry by index and re-render.
 */
export async function removeAutoBackgroundEntry(idx) {
    const $modal = $('#dnd-auto-bg-modal');
    $modal.find(`.dnd-auto-bg-entry[data-idx="${idx}"]`).remove();

    // Re-index remaining entries
    $modal.find('.dnd-auto-bg-entry').each(function (i) {
        $(this).attr('data-idx', i);
        $(this).find('[data-idx]').attr('data-idx', i);
    });
}
