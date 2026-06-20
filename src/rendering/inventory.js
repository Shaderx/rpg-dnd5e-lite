/**
 * D&D 5e Lite - Inventory Renderer
 * Renders inventory list with Equipped/Stored sections, drag-to-reorder, rarity tiers, and quantity
 */

import { inventory } from '../core/state.js';
import { saveInventory } from '../core/persistence.js';
import { RARITY_LABELS, cycleRarity, normalizeRarity } from '../features/inventoryRarity.js';

let dragSrcIdx = null;

function persist() {
    saveInventory(inventory);
}

const RARITY_COUNT = RARITY_LABELS.length;

function rarityIconHtml(rarity) {
    const r = normalizeRarity(rarity);
    if (r === 0) return '<i class="fa-regular fa-gem"></i>';
    if (r === RARITY_COUNT - 1) return '<i class="fa-solid fa-certificate"></i>';
    return '<i class="fa-solid fa-gem"></i>';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Normalize order: equipped items first, stored items second.
 * Preserves user ordering within each group.
 */
function normalizeOrder() {
    const equipped = inventory.filter(item => item.location === 'equipped');
    const stored = inventory.filter(item => item.location !== 'equipped');
    inventory.length = 0;
    inventory.push(...equipped, ...stored);
}

/**
 * Render the inventory list inside #dnd-inventory-list.
 */
export function renderInventory() {
    const container = document.getElementById('dnd-inventory-list');
    if (!container) return;

    normalizeOrder();

    const equippedItems = [];
    const storedItems = [];
    inventory.forEach((item, i) => {
        if (item.location === 'equipped') {
            equippedItems.push({ item, i });
        } else {
            storedItems.push({ item, i });
        }
    });

    if (equippedItems.length === 0 && storedItems.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No items yet</div>';
        return;
    }

    let html = '';

    if (equippedItems.length > 0 || storedItems.length > 0) {
        html += '<div class="dnd-inventory-section-divider"><span>Equipped</span></div>';
    }

    if (equippedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No equipped items</div>';
    }

    for (const { item, i } of equippedItems) {
        const r = normalizeRarity(item.rarity);
        const rClass = ` dnd-rarity-${r}`;
        html += `<div class="dnd-inventory-item${rClass}" data-idx="${i}">
            <span class="dnd-inventory-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
            <button class="dnd-inventory-rarity-btn" data-idx="${i}" title="${RARITY_LABELS[r]} — click to cycle">
                ${rarityIconHtml(r)}
            </button>
            <span class="dnd-inventory-text" contenteditable="true" data-idx="${i}">${escapeHtml(item.text)}</span>
            <span class="dnd-inventory-qty" data-idx="${i}" title="Click to edit quantity">x${item.quantity || 1}</span>
            <button class="dnd-inventory-move-btn" data-idx="${i}" title="Move to stored">
                <i class="fa-solid fa-box-archive"></i>
            </button>
            <button class="dnd-inventory-delete" data-idx="${i}" title="Delete item">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }

    html += '<div class="dnd-inventory-section-divider dnd-inventory-stored-divider"><span>Stored</span></div>';

    if (storedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No stored items</div>';
    }

    for (const { item, i } of storedItems) {
        const r = normalizeRarity(item.rarity);
        const rClass = ` dnd-rarity-${r}`;
        html += `<div class="dnd-inventory-item${rClass}" data-idx="${i}">
            <span class="dnd-inventory-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
            <button class="dnd-inventory-rarity-btn" data-idx="${i}" title="${RARITY_LABELS[r]} — click to cycle">
                ${rarityIconHtml(r)}
            </button>
            <span class="dnd-inventory-text" contenteditable="true" data-idx="${i}">${escapeHtml(item.text)}</span>
            <span class="dnd-inventory-qty" data-idx="${i}" title="Click to edit quantity">x${item.quantity || 1}</span>
            <button class="dnd-inventory-move-btn" data-idx="${i}" title="Move to equipped">
                <i class="fa-solid fa-shield-halved"></i>
            </button>
            <button class="dnd-inventory-delete" data-idx="${i}" title="Delete item">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }

    container.innerHTML = html;
    bindInventoryEvents(container);
}

function bindInventoryEvents(container) {
    // Rarity cycle: common → uncommon → rare → very rare → legendary → artifact → common
    container.querySelectorAll('.dnd-inventory-rarity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!inventory[idx]) return;
            inventory[idx].rarity = cycleRarity(inventory[idx].rarity);
            persist();
            renderInventory();
        });
    });

    // Move between equipped/stored
    container.querySelectorAll('.dnd-inventory-move-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!inventory[idx]) return;
            inventory[idx].location = inventory[idx].location === 'equipped' ? 'stored' : 'equipped';
            persist();
            renderInventory();
        });
    });

    // Delete
    container.querySelectorAll('.dnd-inventory-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            inventory.splice(idx, 1);
            persist();
            renderInventory();
        });
    });

    // Inline text editing
    container.querySelectorAll('.dnd-inventory-text').forEach(el => {
        el.addEventListener('blur', () => {
            const idx = parseInt(el.dataset.idx);
            const newText = el.textContent.trim();
            if (inventory[idx] && newText) {
                inventory[idx].text = newText;
                persist();
            } else if (inventory[idx] && !newText) {
                inventory.splice(idx, 1);
                persist();
                renderInventory();
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    // Quantity editing
    container.querySelectorAll('.dnd-inventory-qty').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            if (!inventory[idx]) return;

            const current = inventory[idx].quantity || 1;
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'dnd-inventory-qty-input';
            input.value = current;
            input.min = 1;
            input.max = 9999;

            el.textContent = '';
            el.appendChild(input);
            input.focus();
            input.select();

            const commit = () => {
                const val = parseInt(input.value) || 1;
                inventory[idx].quantity = Math.max(1, val);
                persist();
                el.textContent = `x${inventory[idx].quantity}`;
            };

            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                }
                if (e.key === 'Escape') {
                    el.textContent = `x${current}`;
                }
            });
        });
    });

    // Drag-and-drop reorder (within same location group, initiated from handle)
    container.querySelectorAll('.dnd-inventory-drag-handle').forEach(handle => {
        handle.addEventListener('mousedown', () => {
            const item = handle.closest('.dnd-inventory-item');
            if (item) item.setAttribute('draggable', 'true');
        });
    });

    const items = container.querySelectorAll('.dnd-inventory-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            if (item.getAttribute('draggable') !== 'true') {
                e.preventDefault();
                return;
            }
            dragSrcIdx = parseInt(item.dataset.idx);
            item.classList.add('dnd-inventory-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dnd-inventory-dragging');
            item.removeAttribute('draggable');
            container.querySelectorAll('.dnd-inventory-drag-over')
                .forEach(el => el.classList.remove('dnd-inventory-drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetIdx = parseInt(item.dataset.idx);
            if (dragSrcIdx !== null && inventory[dragSrcIdx] && inventory[targetIdx] &&
                inventory[dragSrcIdx].location === inventory[targetIdx].location) {
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('dnd-inventory-drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('dnd-inventory-drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('dnd-inventory-drag-over');
            const targetIdx = parseInt(item.dataset.idx);
            if (dragSrcIdx === null || dragSrcIdx === targetIdx) {
                dragSrcIdx = null;
                return;
            }
            if (!inventory[dragSrcIdx] || !inventory[targetIdx] ||
                inventory[dragSrcIdx].location !== inventory[targetIdx].location) {
                dragSrcIdx = null;
                return;
            }
            const [moved] = inventory.splice(dragSrcIdx, 1);
            const insertAt = dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            inventory.splice(insertAt, 0, moved);
            dragSrcIdx = null;
            persist();
            renderInventory();
        });
    });
}

/**
 * Add a new inventory item from the inline input.
 */
export function addInventoryItemFromInput() {
    const input = document.getElementById('dnd-add-inventory-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    inventory.push({ text, quantity: 1, rarity: 0, location: 'stored' });
    input.value = '';
    persist();
    renderInventory();
}
