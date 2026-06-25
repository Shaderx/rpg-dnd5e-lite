/**
 * D&D 5e Lite - Spell Log Renderer
 * Renders the spell log with drag-to-reorder, inline editing, and rest dividers.
 * Two-line layout: spell/rest name on line 1, date/time on line 2.
 */

import { spellLog, extensionSettings } from '../core/state.js';
import { saveSpellLog } from '../core/persistence.js';
import { addManualSpellCast, addManualRest, addManualShortRest, addManualDispel, hardRefreshSpellLog, actionLabels } from '../features/spellTracker.js';
import { renderV2Spellbook } from '../v2/rendering/spellbook.js';

let dragSrcIdx = null;

function persist() {
    saveSpellLog(spellLog);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTimestamp(entry) {
    const parts = [];
    if (entry.time) parts.push(entry.time);
    if (entry.date) parts.push(entry.date);
    return parts.length > 0 ? parts.join(' \u2014 ') : '';
}

/**
 * Render the spell log inside #dnd-spell-log-list.
 */
export function renderSpellLog() {
    const container = document.getElementById('dnd-spell-log-list');
    if (!container) return;

    if (spellLog.length === 0) {
        container.innerHTML = '<div class="dnd-spell-log-empty">No spells tracked</div>';
        if (extensionSettings.v2Enabled) renderV2Spellbook();
        return;
    }

    let html = '';

    // Display newest first; data-idx still maps to the original spellLog index
    for (let di = spellLog.length - 1; di >= 0; di--) {
        const i = di;
        const entry = spellLog[i];
        const isRest = entry.type === 'rest';
        const isShortRest = entry.type === 'short-rest';
        const isDispel = entry.type === 'dispel';
        const isAnyRest = isRest || isShortRest;
        let typeClass, icon, iconClass, label;
        if (isDispel) {
            typeClass = 'dnd-spell-log-dispel';
            icon = 'fa-ban';
            iconClass = 'dnd-spell-log-icon-dispel';
            label = escapeHtml(entry.text);
        } else if (isShortRest) {
            typeClass = 'dnd-spell-log-short-rest';
            icon = 'fa-mug-hot';
            iconClass = 'dnd-spell-log-icon-short-rest';
            label = escapeHtml(entry.text);
        } else if (isRest) {
            typeClass = 'dnd-spell-log-rest';
            icon = 'fa-bed';
            iconClass = 'dnd-spell-log-icon-rest';
            label = escapeHtml(entry.text);
        } else {
            const action = entry.action || 'cast';
            typeClass = 'dnd-spell-log-cast';
            icon = action === 'cast' ? 'fa-wand-sparkles' : 'fa-bolt';
            iconClass = 'dnd-spell-log-icon-cast';
            const { present } = actionLabels(action);
            const detailStr = entry.details ? ` <span class="dnd-spell-log-details">(${escapeHtml(entry.details)})</span>` : '';
            label = `${present} <strong>${escapeHtml(entry.spell)}</strong>${detailStr}`;
        }
        const timestamp = formatTimestamp(entry);
        const manualTag = entry._manual ? '<span class="dnd-spell-log-manual-tag">manual</span>' : '';

        html += `<div class="dnd-spell-log-item ${typeClass}" data-idx="${i}" draggable="true">
            <span class="dnd-spell-log-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
            <div class="dnd-spell-log-icon ${iconClass}"><i class="fa-solid ${icon}"></i></div>
            <div class="dnd-spell-log-body">
                <span class="dnd-spell-log-name" contenteditable="true" data-idx="${i}">${label}</span>
                <span class="dnd-spell-log-timestamp">${timestamp ? escapeHtml(timestamp) : ''}${manualTag}</span>
            </div>
            <button class="dnd-spell-log-delete" data-idx="${i}" title="Delete entry">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
    }

    container.innerHTML = html;
    bindSpellLogEvents(container);
    if (extensionSettings.v2Enabled) renderV2Spellbook();
}

function bindSpellLogEvents(container) {
    container.querySelectorAll('.dnd-spell-log-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            spellLog.splice(idx, 1);
            persist();
            renderSpellLog();
        });
    });

    container.querySelectorAll('.dnd-spell-log-name').forEach(el => {
        el.addEventListener('blur', () => {
            const idx = parseInt(el.dataset.idx);
            const newText = el.textContent.trim();
            if (spellLog[idx] && newText) {
                if (spellLog[idx].type === 'cast') {
                    spellLog[idx].spell = newText;
                    spellLog[idx]._edited = true;
                } else {
                    spellLog[idx].text = newText;
                    spellLog[idx]._edited = true;
                }
                persist();
            } else if (spellLog[idx] && !newText) {
                spellLog.splice(idx, 1);
                persist();
                renderSpellLog();
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    const draggables = container.querySelectorAll('.dnd-spell-log-item[draggable="true"]');
    draggables.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragSrcIdx = parseInt(item.dataset.idx);
            item.classList.add('dnd-spell-log-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dnd-spell-log-dragging');
            container.querySelectorAll('.dnd-spell-log-drag-over')
                .forEach(el => el.classList.remove('dnd-spell-log-drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('dnd-spell-log-drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('dnd-spell-log-drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('dnd-spell-log-drag-over');
            const targetIdx = parseInt(item.dataset.idx);
            if (dragSrcIdx === null || dragSrcIdx === targetIdx) {
                dragSrcIdx = null;
                return;
            }
            const [moved] = spellLog.splice(dragSrcIdx, 1);
            const insertAt = dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            spellLog.splice(insertAt, 0, moved);
            dragSrcIdx = null;
            persist();
            renderSpellLog();
        });
    });
}

/**
 * Add a spell from the inline input field.
 */
export function addSpellFromInput() {
    const input = /** @type {HTMLInputElement} */ (document.getElementById('dnd-add-spell-input'));
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    addManualSpellCast(text);
    input.value = '';
    renderSpellLog();
}

/**
 * Add a rest entry from the UI button.
 */
export function addRestFromButton() {
    addManualRest();
    renderSpellLog();
}

/**
 * Add a short rest entry from the UI button.
 */
export function addShortRestFromButton() {
    addManualShortRest();
    renderSpellLog();
}

/**
 * Add a dispel entry from the UI button.
 */
export function addDispelFromButton() {
    addManualDispel();
    renderSpellLog();
}

/**
 * Hard-refresh the spell log: wipe stored entries and rebuild from visible chat.
 */
export function hardRefreshSpellLogFromButton() {
    hardRefreshSpellLog();
    renderSpellLog();
}
