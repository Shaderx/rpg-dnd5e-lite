/**
 * V2 Tool Calling - Quest Renderer
 * Renders V2 quest list with all V1 features plus status badges,
 * objective progress, giver/location subtitle, and click-to-view detail modal.
 */

import { v2Quests } from '../core/state.js';
import { saveV2Quests } from '../core/persistence.js';
import { openQuestDetailModal } from './questModal.js';

let dragSrcIdx = null;

function persist() {
    saveV2Quests(v2Quests);
}

const QUEST_TYPES = { 1: 'Reminder', 2: 'Side Quest', 3: 'Main Quest' };
const QUEST_EMOJIS = { 1: '📌', 2: '🛡️', 3: '👑' };
const STATUS_LABELS = {
    not_started: 'Active',
    in_progress: 'Active',
    completed: 'Completed',
    failed: 'Failed',
};
const STATUS_ICONS = {
    not_started: 'fa-square',
    in_progress: 'fa-square',
    completed: 'fa-square-check',
    failed: 'fa-square-xmark',
};

function normalizePriority(priority) {
    const p = priority || 1;
    if (p < 1 || p > 3) return 1;
    return p;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Ensure active quests come before completed/failed quests.
 * Preserves user ordering within each group.
 */
function normalizeOrder() {
    const active = v2Quests.filter(q => q.status !== 'completed' && q.status !== 'failed');
    const done = v2Quests.filter(q => q.status === 'completed' || q.status === 'failed');
    v2Quests.length = 0;
    v2Quests.push(...active, ...done);
}

function toggleStatus(status) {
    if (status === 'completed' || status === 'failed') return 'not_started';
    return 'completed';
}

function objectiveProgress(quest) {
    if (!quest.objectives || quest.objectives.length === 0) return '';
    const done = quest.objectives.filter(o => o.completed).length;
    return `${done}/${quest.objectives.length}`;
}

/**
 * Render the V2 quest list inside #dnd-quests-list.
 */
export function renderV2Quests() {
    const container = document.getElementById('dnd-quests-list');
    if (!container) return;

    normalizeOrder();

    const activeQuests = [];
    const completedQuests = [];
    v2Quests.forEach((q, i) => {
        const isDone = q.status === 'completed' || q.status === 'failed';
        (isDone ? completedQuests : activeQuests).push({ q, i });
    });

    if (activeQuests.length === 0 && completedQuests.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No quests yet</div>';
        return;
    }

    let html = '';

    for (const { q, i } of activeQuests) {
        const p = normalizePriority(q.priority);
        const statusIcon = STATUS_ICONS[q.status] || STATUS_ICONS.not_started;
        const progress = objectiveProgress(q);
        const subtitle = [q.giver, q.location].filter(Boolean).join(' · ');
        html += `<div class="dnd-quest-item dnd-quest-type-${p} dnd-v2-quest-item" data-idx="${i}">
            <span class="dnd-quest-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
            <button class="dnd-quest-type-btn" data-idx="${i}" title="${QUEST_TYPES[p]} — click to cycle">
                <span class="dnd-quest-type-emoji">${QUEST_EMOJIS[p]}</span>
            </button>
            <div class="dnd-v2-quest-content" data-idx="${i}" title="Click to view quest">
                <span class="dnd-quest-text">${escapeHtml(q.title || 'Untitled Quest')}</span>
                ${subtitle ? `<span class="dnd-v2-quest-subtitle">${escapeHtml(subtitle)}</span>` : ''}
            </div>
            <span class="dnd-v2-quest-badges">
                ${progress ? `<span class="dnd-v2-quest-progress" title="Objectives">${progress}</span>` : ''}
                <button class="dnd-v2-quest-status-btn" data-idx="${i}" title="Mark complete">
                    <i class="fa-regular ${statusIcon}"></i>
                </button>
            </span>
            <button class="dnd-quest-delete" data-idx="${i}" title="Delete quest">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }

    if (completedQuests.length > 0) {
        html += '<div class="dnd-quests-completed-divider"><span>Completed / Failed</span></div>';
        for (const { q, i } of completedQuests) {
            const p = normalizePriority(q.priority);
            const statusIcon = STATUS_ICONS[q.status] || STATUS_ICONS.completed;
            const statusClass = q.status === 'failed' ? 'dnd-v2-quest-failed' : 'dnd-quest-completed';
            html += `<div class="dnd-quest-item ${statusClass} dnd-quest-type-${p} dnd-v2-quest-item" data-idx="${i}">
                <span class="dnd-quest-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
                <span class="dnd-quest-type-badge" title="${QUEST_TYPES[p]}">${QUEST_EMOJIS[p]}</span>
                <div class="dnd-v2-quest-content" data-idx="${i}" title="Click to view quest">
                    <span class="dnd-quest-text dnd-quest-done-text">${escapeHtml(q.title || 'Untitled Quest')}</span>
                </div>
                <button class="dnd-v2-quest-status-btn" data-idx="${i}" title="Restore to active">
                    <i class="fa-solid ${statusIcon}"></i>
                </button>
                <button class="dnd-quest-delete" data-idx="${i}" title="Delete quest">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        }
    }

    container.innerHTML = html;
    bindV2QuestEvents(container);
}

function bindV2QuestEvents(container) {
    // Priority cycle
    container.querySelectorAll('.dnd-quest-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            if (!v2Quests[idx]) return;
            const p = normalizePriority(v2Quests[idx].priority);
            v2Quests[idx].priority = (p % 3) + 1;
            persist();
            renderV2Quests();
        });
    });

    // Status cycle
    container.querySelectorAll('.dnd-v2-quest-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            if (!v2Quests[idx]) return;
            v2Quests[idx].status = toggleStatus(v2Quests[idx].status);
            persist();
            renderV2Quests();
        });
    });

    // Click quest content to open detail modal
    container.querySelectorAll('.dnd-v2-quest-content').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            if (!v2Quests[idx]) return;
            openQuestDetailModal(idx);
        });
    });

    // Delete
    container.querySelectorAll('.dnd-quest-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            v2Quests.splice(idx, 1);
            persist();
            renderV2Quests();
        });
    });

    // Drag-and-drop reorder
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
            const [moved] = v2Quests.splice(dragSrcIdx, 1);
            const insertAt = dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            v2Quests.splice(insertAt, 0, moved);
            dragSrcIdx = null;
            persist();
            renderV2Quests();
        });
    });
}

