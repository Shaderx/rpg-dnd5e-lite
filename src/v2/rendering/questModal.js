/**
 * V2 Tool Calling - Quest Detail & Edit Modals
 * Detail modal: read-only overview (Sidekick-style). Edit modal: full-field editing.
 */

import { v2Quests, createDefaultQuest } from '../core/state.js';
import { extensionSettings } from '../../core/state.js';
import { saveV2Quests } from '../core/persistence.js';
import { renderV2Quests } from './quests.js';
import { parseHeader } from '../../features/headerParser.js';
import { getContext } from '../../../../../../extensions.js';

const QUEST_TYPES = { 1: 'Reminder', 2: 'Side Quest', 3: 'Main Quest' };
const QUEST_EMOJIS = { 1: '📌', 2: '🛡️', 3: '👑' };
const STATUS_LABELS = {
    not_started: 'Active',
    in_progress: 'Active',
    completed: 'Completed',
    failed: 'Failed',
};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function persist() {
    saveV2Quests(v2Quests);
}

function normalizePriority(priority) {
    const p = priority || 1;
    if (p < 1 || p > 3) return 1;
    return p;
}

let currentEditIdx = -1;
let currentDetailIdx = -1;
let objectivesDraft = [];
let detailEventsBound = false;

/**
 * Build read-only HTML for the quest detail modal body.
 * @param {number} idx - Quest index in v2Quests
 */
export function renderQuestDetail(idx) {
    const quest = v2Quests[idx];
    const body = document.getElementById('dnd-v2-quest-detail-body');
    const titleEl = document.getElementById('dnd-v2-quest-detail-title');
    if (!quest || !body) return;

    const p = normalizePriority(quest.priority);
    const status = quest.status || 'not_started';
    const statusLabel = STATUS_LABELS[status] || status;
    const sections = [];

    if (titleEl) titleEl.textContent = quest.title || 'Quest Details';

    sections.push(`<div class="dnd-v2-quest-det-header">
        <div class="dnd-v2-quest-det-name">${escapeHtml(quest.title || 'Untitled Quest')}</div>
        <div class="dnd-v2-quest-det-badges">
            <span class="dnd-v2-quest-det-badge dnd-v2-quest-det-priority" title="${QUEST_TYPES[p]}">${QUEST_EMOJIS[p]} ${QUEST_TYPES[p]}</span>
            <span class="dnd-v2-quest-det-badge dnd-v2-quest-det-status dnd-v2-quest-det-status-${status}">${escapeHtml(statusLabel)}</span>
        </div>
    </div>`);

    const meta = [];
    if (quest.giver) meta.push(`<span><strong>Giver:</strong> ${escapeHtml(quest.giver)}</span>`);
    if (quest.location) meta.push(`<span><strong>Location:</strong> ${escapeHtml(quest.location)}</span>`);
    if (quest.dateCreated) meta.push(`<span><strong>Date:</strong> ${escapeHtml(quest.dateCreated)}</span>`);
    if (quest.duration) meta.push(`<span><strong>Duration:</strong> ${escapeHtml(quest.duration)}</span>`);
    if (meta.length > 0) {
        sections.push(`<div class="dnd-v2-quest-det-meta">${meta.join(' &middot; ')}</div>`);
    }

    if (quest.description?.trim()) {
        sections.push(`<div class="dnd-v2-quest-det-section">
            <div class="dnd-v2-quest-det-label">Description</div>
            <div class="dnd-v2-quest-det-text">${escapeHtml(quest.description)}</div>
        </div>`);
    }

    if (quest.notes?.trim()) {
        sections.push(`<div class="dnd-v2-quest-det-section">
            <div class="dnd-v2-quest-det-label">Notes</div>
            <div class="dnd-v2-quest-det-text">${escapeHtml(quest.notes)}</div>
        </div>`);
    }

    const objectives = quest.objectives || [];
    if (objectives.length > 0) {
        const done = objectives.filter(o => o.completed).length;
        const objLines = objectives.map(obj => {
            const icon = obj.completed ? 'fa-circle-check' : 'fa-circle';
            const cls = obj.completed ? 'dnd-v2-quest-det-obj-done' : '';
            return `<div class="dnd-v2-quest-det-objective ${cls}">
                <i class="fa-solid ${icon}"></i>
                <span>${escapeHtml(obj.text || '')}</span>
            </div>`;
        });
        sections.push(`<div class="dnd-v2-quest-det-section">
            <div class="dnd-v2-quest-det-label">Objectives (${done}/${objectives.length})</div>
            <div class="dnd-v2-quest-det-objectives">${objLines.join('')}</div>
        </div>`);
    }

    const rewards = quest.rewards || {};
    const rewardParts = [];
    if (!extensionSettings.milestoneXP && rewards.xp) rewardParts.push(`${rewards.xp} XP`);
    if (rewards.gold) rewardParts.push(`${rewards.gold} GP`);
    if (rewards.items?.length > 0) {
        rewardParts.push(...rewards.items.map(item => escapeHtml(item)));
    }
    if (rewardParts.length > 0) {
        sections.push(`<div class="dnd-v2-quest-det-section">
            <div class="dnd-v2-quest-det-label">Rewards</div>
            <div class="dnd-v2-quest-det-text">${rewardParts.join(' · ')}</div>
        </div>`);
    }

    body.innerHTML = sections.join('');
    body.setAttribute('data-quest-idx', String(idx));
}

function hideQuestDetailModal() {
    const overlay = document.getElementById('dnd-v2-quest-detail-popup');
    if (overlay) overlay.style.display = 'none';
    currentDetailIdx = -1;
}

function deleteQuestAtIdx(idx) {
    const quest = v2Quests[idx];
    if (!quest) return false;

    const name = quest.title || 'this quest';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return false;

    v2Quests.splice(idx, 1);
    persist();
    renderV2Quests();
    return true;
}

function bindDetailModalEvents() {
    if (detailEventsBound) return;
    detailEventsBound = true;

    const overlay = document.getElementById('dnd-v2-quest-detail-popup');
    const closeBtn = document.getElementById('dnd-v2-quest-detail-close');
    const editBtn = document.getElementById('dnd-v2-quest-detail-edit');
    const deleteBtn = document.getElementById('dnd-v2-quest-detail-delete');

    closeBtn?.addEventListener('click', () => hideQuestDetailModal());

    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) hideQuestDetailModal();
    });

    editBtn?.addEventListener('click', () => {
        const body = document.getElementById('dnd-v2-quest-detail-body');
        const idx = parseInt(body?.getAttribute('data-quest-idx') ?? currentDetailIdx);
        if (Number.isNaN(idx) || !v2Quests[idx]) return;
        hideQuestDetailModal();
        openQuestEditModal(idx);
    });

    deleteBtn?.addEventListener('click', () => {
        const body = document.getElementById('dnd-v2-quest-detail-body');
        const idx = parseInt(body?.getAttribute('data-quest-idx') ?? currentDetailIdx);
        if (Number.isNaN(idx) || !v2Quests[idx]) return;
        if (deleteQuestAtIdx(idx)) hideQuestDetailModal();
    });
}

/**
 * Open the read-only quest detail modal.
 * @param {number} idx - Quest index in v2Quests array
 */
export function openQuestDetailModal(idx) {
    if (!v2Quests[idx]) return;

    bindDetailModalEvents();
    currentDetailIdx = idx;
    renderQuestDetail(idx);

    const overlay = document.getElementById('dnd-v2-quest-detail-popup');
    if (overlay) overlay.style.display = 'flex';
}

function renderObjectivesEditor() {
    const container = document.getElementById('dnd-v2-quest-objectives');
    if (!container) return;

    if (objectivesDraft.length === 0) {
        container.innerHTML = '<div class="dnd-v2-quest-no-objectives">No objectives</div>';
        return;
    }

    let html = '';
    objectivesDraft.forEach((obj, i) => {
        const checked = obj.completed ? 'checked' : '';
        html += `<div class="dnd-v2-quest-objective-row" data-obj-idx="${i}">
            <input type="checkbox" class="dnd-v2-obj-check" data-obj-idx="${i}" ${checked} />
            <input type="text" class="dnd-v2-obj-text" data-obj-idx="${i}" value="${escapeHtml(obj.text)}" placeholder="Objective..." />
            <button class="dnd-v2-obj-delete" data-obj-idx="${i}" title="Remove objective">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.dnd-v2-obj-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const objIdx = parseInt(cb.dataset.objIdx);
            if (objectivesDraft[objIdx]) objectivesDraft[objIdx].completed = cb.checked;
        });
    });

    container.querySelectorAll('.dnd-v2-obj-text').forEach(input => {
        input.addEventListener('input', () => {
            const objIdx = parseInt(input.dataset.objIdx);
            if (objectivesDraft[objIdx]) objectivesDraft[objIdx].text = input.value;
        });
    });

    container.querySelectorAll('.dnd-v2-obj-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const objIdx = parseInt(btn.dataset.objIdx);
            objectivesDraft.splice(objIdx, 1);
            renderObjectivesEditor();
        });
    });
}

/**
 * Open the quest edit modal for a given quest index, or -1 for new quest.
 * @param {number} idx - Quest index in v2Quests array, or -1 to create new
 */
export function openQuestEditModal(idx) {
    const overlay = document.getElementById('dnd-v2-quest-edit-popup');
    if (!overlay) return;

    currentEditIdx = idx;
    const isNew = idx < 0 || !v2Quests[idx];
    const quest = isNew ? createDefaultQuest() : v2Quests[idx];

    const titleEl = document.getElementById('dnd-v2-quest-edit-title');
    if (titleEl) titleEl.textContent = isNew ? 'New Quest' : 'Edit Quest';

    document.getElementById('dnd-v2-quest-edit-id').value = quest.id;
    document.getElementById('dnd-v2-quest-title').value = quest.title;
    document.getElementById('dnd-v2-quest-description').value = quest.description;
    document.getElementById('dnd-v2-quest-notes').value = quest.notes || '';
    document.getElementById('dnd-v2-quest-status').value = quest.status;
    document.getElementById('dnd-v2-quest-priority').value = quest.priority;
    document.getElementById('dnd-v2-quest-giver').value = quest.giver;
    document.getElementById('dnd-v2-quest-location').value = quest.location;
    document.getElementById('dnd-v2-quest-date').value = quest.dateCreated || '';
    document.getElementById('dnd-v2-quest-duration').value = quest.duration || '';
    const xpHidden = extensionSettings.milestoneXP;
    const xpLabel = document.getElementById('dnd-v2-reward-xp-label');
    const xpInput = document.getElementById('dnd-v2-quest-reward-xp');
    if (xpLabel) xpLabel.style.display = xpHidden ? 'none' : '';
    if (xpInput) xpInput.style.display = xpHidden ? 'none' : '';
    xpInput.value = quest.rewards?.xp || 0;
    document.getElementById('dnd-v2-quest-reward-gold').value = quest.rewards?.gold || 0;
    document.getElementById('dnd-v2-quest-reward-items').value = (quest.rewards?.items || []).join(', ');

    objectivesDraft = (quest.objectives || []).map(o => ({ ...o }));
    renderObjectivesEditor();

    const deleteBtn = document.getElementById('dnd-v2-quest-edit-delete');
    if (deleteBtn) deleteBtn.style.display = isNew ? 'none' : '';

    const saveBtn = document.getElementById('dnd-v2-quest-edit-save');
    if (saveBtn) saveBtn.textContent = isNew ? 'Add' : 'Save';

    overlay.style.display = 'flex';
    bindEditModalEvents();
}

function bindEditModalEvents() {
    const overlay = document.getElementById('dnd-v2-quest-edit-popup');
    const saveBtn = document.getElementById('dnd-v2-quest-edit-save');
    const deleteBtn = document.getElementById('dnd-v2-quest-edit-delete');
    const cancelBtn = document.getElementById('dnd-v2-quest-edit-cancel');
    const closeBtn = document.getElementById('dnd-v2-quest-edit-close');
    const addObjBtn = document.getElementById('dnd-v2-quest-add-objective');
    const dateAutoBtn = document.getElementById('dnd-v2-quest-date-auto');

    function cleanup() {
        overlay.style.display = 'none';
        saveBtn?.removeEventListener('click', handleSave);
        deleteBtn?.removeEventListener('click', handleDelete);
        cancelBtn?.removeEventListener('click', handleCancel);
        closeBtn?.removeEventListener('click', handleCancel);
        addObjBtn?.removeEventListener('click', handleAddObjective);
        dateAutoBtn?.removeEventListener('click', handleDateAuto);
    }

    function handleSave() {
        const title = document.getElementById('dnd-v2-quest-title').value.trim();
        if (!title) return;

        const rewardItemsRaw = document.getElementById('dnd-v2-quest-reward-items').value;
        const rewardItems = rewardItemsRaw.split(',').map(s => s.trim()).filter(Boolean);

        const questData = {
            id: document.getElementById('dnd-v2-quest-edit-id').value || crypto.randomUUID(),
            title,
            description: document.getElementById('dnd-v2-quest-description').value.trim(),
            notes: document.getElementById('dnd-v2-quest-notes').value.trim(),
            status: document.getElementById('dnd-v2-quest-status').value,
            priority: parseInt(document.getElementById('dnd-v2-quest-priority').value) || 1,
            giver: document.getElementById('dnd-v2-quest-giver').value.trim(),
            location: document.getElementById('dnd-v2-quest-location').value.trim(),
            dateCreated: document.getElementById('dnd-v2-quest-date').value.trim(),
            duration: document.getElementById('dnd-v2-quest-duration').value.trim(),
            objectives: objectivesDraft.filter(o => o.text.trim()),
            rewards: {
                xp: parseInt(document.getElementById('dnd-v2-quest-reward-xp').value) || 0,
                gold: parseInt(document.getElementById('dnd-v2-quest-reward-gold').value) || 0,
                items: rewardItems,
            },
        };

        if (currentEditIdx >= 0 && v2Quests[currentEditIdx]) {
            v2Quests[currentEditIdx] = questData;
        } else {
            v2Quests.push(questData);
        }

        persist();
        cleanup();
        renderV2Quests();
    }

    function handleDelete() {
        if (currentEditIdx >= 0 && v2Quests[currentEditIdx]) {
            if (!deleteQuestAtIdx(currentEditIdx)) return;
        }
        cleanup();
    }

    function handleCancel() {
        cleanup();
    }

    function handleAddObjective() {
        objectivesDraft.push({ text: '', completed: false });
        renderObjectivesEditor();
    }

    function handleDateAuto() {
        const context = getContext();
        const chat = context?.chat;
        if (!chat) return;
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user) continue;
            const header = parseHeader(chat[i].mes);
            if (header?.date) {
                const dateInput = document.getElementById('dnd-v2-quest-date');
                if (dateInput) dateInput.value = header.date;
                return;
            }
        }
    }

    saveBtn?.addEventListener('click', handleSave);
    deleteBtn?.addEventListener('click', handleDelete);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);
    addObjBtn?.addEventListener('click', handleAddObjective);
    dateAutoBtn?.addEventListener('click', handleDateAuto);
}
