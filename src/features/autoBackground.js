/**
 * D&D 5e Lite - Auto Background Switching
 * Switches ST backgrounds based on parsed RP time (day/night) and location from headers.
 */

import { getContext } from '../../../../../extensions.js';
import { headerInfo, autoBackgrounds } from '../core/state.js';
import { saveAutoBackgrounds } from '../core/persistence.js';
import { inferTimeOfDay } from './weatherVisuals.js';

let lastAppliedBackground = null;

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
 * Uses case-insensitive substring matching against entry names.
 * Falls back to the Default entry (index 0) if no match.
 */
function findMatchingEntry(entries, location) {
    if (!location || entries.length <= 1) return entries[0] || null;

    const locLower = location.toLowerCase();
    for (let i = 1; i < entries.length; i++) {
        const entryName = entries[i].name;
        if (!entryName) continue;
        if (locLower.includes(entryName.toLowerCase())) {
            return entries[i];
        }
    }
    return entries[0];
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
    let targetBg = night ? (entry.night || entry.day) : entry.day;
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
