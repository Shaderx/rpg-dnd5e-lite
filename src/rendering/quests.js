/**
 * D&D 5e Lite - Quest Renderer
 * Renders quest list with drag-to-reorder, 3-tier star priority, and completed section
 */

import { quests } from '../core/state.js';
import { saveQuests } from '../core/persistence.js';

let dragSrcIdx = null;

function persist() {
    saveQuests(quests);
}

/**
 * Ensure active quests come before completed quests in the array.
 * Preserves user ordering within each group.
 */
function normalizeOrder() {
    const active = quests.filter(q => !q.completed);
    const done = quests.filter(q => q.completed);
    quests.length = 0;
    quests.push(...active, ...done);
}

const PRIORITY_LABELS = ['none', 'minor', 'important', 'critical'];

function starHtml(priority) {
    const p = Math.max(0, Math.min(3, priority || 0));
    if (p === 0) return '<i class="fa-regular fa-star"></i>';
    return '<i class="fa-solid fa-star"></i>';
}

/**
 * Render the quest list inside #dnd-quests-list.
 */
export function renderQuests() {
    const container = document.getElementById('dnd-quests-list');
    if (!container) return;

    normalizeOrder();

    const activeQuests = [];
    const completedQuests = [];
    quests.forEach((q, i) => {
        (q.completed ? completedQuests : activeQuests).push({ q, i });
    });

    if (activeQuests.length === 0 && completedQuests.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No quests yet</div>';
        return;
    }

    let html = '';

    for (const { q, i } of activeQuests) {
        const pClass = q.priority >= 1 ? ` dnd-priority-${q.priority}` : '';
        html += `<div class="dnd-quest-item${pClass}" data-idx="${i}">
            <span class="dnd-quest-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
            <button class="dnd-quest-star-btn" data-idx="${i}" title="${PRIORITY_LABELS[q.priority || 0]} — click to cycle">
                ${starHtml(q.priority)}
            </button>
            <span class="dnd-quest-text" contenteditable="true" data-idx="${i}">${escapeHtml(q.text)}</span>
            <button class="dnd-quest-check" data-idx="${i}" title="Mark completed">
                <i class="fa-solid fa-square"></i>
            </button>
            <button class="dnd-quest-delete" data-idx="${i}" title="Delete quest">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }

    if (completedQuests.length > 0) {
        html += '<div class="dnd-quests-completed-divider"><span>Completed</span></div>';
        for (const { q, i } of completedQuests) {
            html += `<div class="dnd-quest-item dnd-quest-completed" data-idx="${i}">
                <button class="dnd-quest-check dnd-checked" data-idx="${i}" title="Restore quest">
                    <i class="fa-solid fa-square-check"></i>
                </button>
                <span class="dnd-quest-text dnd-quest-done-text" contenteditable="true" data-idx="${i}">${escapeHtml(q.text)}</span>
                <button class="dnd-quest-delete" data-idx="${i}" title="Delete quest">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        }
    }

    container.innerHTML = html;
    bindQuestEvents(container);
}

function bindQuestEvents(container) {
    // Priority cycle: 0(none)→1(minor ★)→2(important ★★★)→3(critical ★★★★★)→0
    container.querySelectorAll('.dnd-quest-star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!quests[idx]) return;
            quests[idx].priority = ((quests[idx].priority || 0) + 1) % 4;
            persist();
            renderQuests();
        });
    });

    // Complete / restore
    container.querySelectorAll('.dnd-quest-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!quests[idx]) return;
            quests[idx].completed = !quests[idx].completed;
            persist();
            renderQuests();
        });
    });

    // Delete
    container.querySelectorAll('.dnd-quest-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            quests.splice(idx, 1);
            persist();
            renderQuests();
        });
    });

    // Inline text editing
    container.querySelectorAll('.dnd-quest-text').forEach(el => {
        el.addEventListener('blur', () => {
            const idx = parseInt(el.dataset.idx);
            const newText = el.textContent.trim();
            if (quests[idx] && newText) {
                quests[idx].text = newText;
                persist();
            } else if (quests[idx] && !newText) {
                quests.splice(idx, 1);
                persist();
                renderQuests();
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    // Drag-and-drop reorder (active quests only, initiated from handle)
    container.querySelectorAll('.dnd-quest-drag-handle').forEach(handle => {
        handle.addEventListener('mousedown', () => {
            const item = handle.closest('.dnd-quest-item');
            if (item) item.setAttribute('draggable', 'true');
        });
    });

    const items = container.querySelectorAll('.dnd-quest-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            if (item.getAttribute('draggable') !== 'true') {
                e.preventDefault();
                return;
            }
            dragSrcIdx = parseInt(item.dataset.idx);
            item.classList.add('dnd-quest-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dnd-quest-dragging');
            item.removeAttribute('draggable');
            container.querySelectorAll('.dnd-quest-drag-over')
                .forEach(el => el.classList.remove('dnd-quest-drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('dnd-quest-drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('dnd-quest-drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('dnd-quest-drag-over');
            const targetIdx = parseInt(item.dataset.idx);
            if (dragSrcIdx === null || dragSrcIdx === targetIdx) {
                dragSrcIdx = null;
                return;
            }
            const [moved] = quests.splice(dragSrcIdx, 1);
            const insertAt = dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            quests.splice(insertAt, 0, moved);
            dragSrcIdx = null;
            persist();
            renderQuests();
        });
    });
}

/**
 * Add a new quest from the inline input.
 */
export function addQuestFromInput() {
    const input = document.getElementById('dnd-add-quest-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    quests.push({ text, priority: 0, completed: false });
    input.value = '';
    persist();
    renderQuests();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
