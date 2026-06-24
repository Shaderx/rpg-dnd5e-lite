/**
 * V2 Inventory Renderer
 * Master list for all items including character equipment.
 * Features: type icons (armor/shield/weapon), magic toggle, fuzzy DB search,
 * drag-reorder, rarity cycle, qty edit, equip/store, tooltips.
 */

import { v2Inventory, createDefaultItem } from '../core/state.js';
import { saveV2Inventory } from '../core/persistence.js';
import { RARITY_LABELS, cycleRarity, normalizeRarity } from '../../features/inventoryRarity.js';
import { bindTooltipEvents } from '../../rendering/tooltip.js';
import { fuzzyLookupItem, searchEquipment } from '../../features/sidekick.js';

let dragSrcIdx = null;
let _activeSearchPopup = null;

const _tooltipCache = new Map();

function resolveItemTooltipName(name) {
    if (!name) return null;
    if (_tooltipCache.has(name)) return _tooltipCache.get(name);
    const item = fuzzyLookupItem(name);
    const resolved = item ? item.name : null;
    _tooltipCache.set(name, resolved);
    return resolved;
}

function invalidateTooltipCache(oldName) {
    _tooltipCache.delete(oldName);
}

function persist() {
    saveV2Inventory(v2Inventory);
}

const RARITY_COUNT = RARITY_LABELS.length;

function rarityIconHtml(rarity) {
    const r = normalizeRarity(rarity);
    if (r === 0) return '<i class="fa-regular fa-gem"></i>';
    if (r === RARITY_COUNT - 1) return '<i class="fa-solid fa-certificate"></i>';
    return '<i class="fa-solid fa-gem"></i>';
}

const TYPE_ICONS = {
    none: { icon: '', emoji: '📦', cls: '' },
    armor: { icon: 'fa-solid fa-shield', emoji: '🛡️', cls: 'dnd-type-armor' },
    shield: { icon: 'fa-solid fa-shield-halved', emoji: '🛡️', cls: 'dnd-type-shield' },
    weapon: { icon: 'fa-solid fa-crosshairs', emoji: '⚔️', cls: 'dnd-type-weapon' },
};

function typeIconHtml(type) {
    const t = TYPE_ICONS[type] || TYPE_ICONS.none;
    if (type === 'none') return `<span class="dnd-type-emoji">${t.emoji}</span>`;
    return `<i class="${t.icon}"></i>`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function normalizeOrder() {
    const equipped = v2Inventory.filter(item => item.location === 'equipped');
    const stored = v2Inventory.filter(item => item.location !== 'equipped');
    v2Inventory.length = 0;
    v2Inventory.push(...equipped, ...stored);
}


function enforceSingleArmor(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'armor' || item.location !== 'equipped') return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'armor' && v2Inventory[i].location === 'equipped') {
            v2Inventory[i].location = 'stored';
        }
    }
}

function enforceSingleShield(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'shield' || item.location !== 'equipped') return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'shield' && v2Inventory[i].location === 'equipped') {
            v2Inventory[i].location = 'stored';
        }
    }
}

function buildItemRowHtml(item, i, isStored) {
    const r = normalizeRarity(item.rarity);
    const storedCls = isStored ? ' dnd-inventory-stored' : '';
    const rClass = ` dnd-rarity-${r}${storedCls}`;
    const ttName = resolveItemTooltipName(item.name);
    const ttCls = ttName ? ' dnd-tt-hover' : '';
    const ttData = ttName ? ` data-tt-type="equipment" data-tt-name="${escapeHtml(ttName)}"` : '';

    const typeInfo = TYPE_ICONS[item.type] || TYPE_ICONS.none;
    const typeCls = typeInfo.cls ? ` ${typeInfo.cls}` : '';
    const magicGlow = (item.type !== 'none' && item.magic) ? ' dnd-magic-glow' : '';
    const isEquip = item.type !== 'none';
    const typeTitle = isEquip ? `${item.type} — click to clear` : 'Mark as equipment';

    const moveIcon = isStored ? 'fa-shield-halved' : 'fa-box-archive';
    const moveTitle = isStored ? 'Move to equipped' : 'Move to stored';

    // Equipment items: text is NOT editable, clicking opens search modal
    const editableAttr = isEquip ? '' : ' contenteditable="true"';
    const equipTextCls = isEquip ? ' dnd-inventory-text-equip' : '';

    return `<div class="dnd-inventory-item${rClass}" data-idx="${i}">
        <span class="dnd-inventory-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
        <button class="dnd-inventory-type-btn${typeCls}${magicGlow}" data-idx="${i}" title="${typeTitle}">
            ${typeIconHtml(item.type)}
        </button>
        <button class="dnd-inventory-rarity-btn" data-idx="${i}" title="${RARITY_LABELS[r]} — click to cycle">
            ${rarityIconHtml(r)}
        </button>
        <span class="dnd-inventory-text${ttCls}${equipTextCls}"${editableAttr} data-idx="${i}"${ttData}>${escapeHtml(item.name)}</span>
        ${item.charges !== null && item.charges !== undefined ? `<span class="dnd-inventory-charges" data-idx="${i}" title="Charges remaining">⚡${item.charges}</span>` : ''}
        <span class="dnd-inventory-qty" data-idx="${i}" title="Click to edit quantity">x${item.quantity || 1}</span>
        <button class="dnd-inventory-move-btn" data-idx="${i}" title="${moveTitle}">
            <i class="fa-solid ${moveIcon}"></i>
        </button>
        <button class="dnd-inventory-delete" data-idx="${i}" title="Delete item">
            <i class="fa-solid fa-trash"></i>
        </button>
    </div>`;
}

/**
 * Render the V2 inventory list inside #dnd-inventory-list.
 */
export function renderV2Inventory() {
    const container = document.getElementById('dnd-inventory-list');
    if (!container) return;

    closeSearchPopup();
    normalizeOrder();

    const equippedItems = [];
    const storedItems = [];
    v2Inventory.forEach((item, i) => {
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

    html += '<div class="dnd-inventory-section-divider"><span>Equipped</span></div>';

    if (equippedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No equipped items</div>';
    }

    for (const { item, i } of equippedItems) {
        html += buildItemRowHtml(item, i, false);
    }

    html += '<div class="dnd-inventory-section-divider dnd-inventory-stored-divider"><span>Stored</span></div>';

    if (storedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No stored items</div>';
    }

    for (const { item, i } of storedItems) {
        html += buildItemRowHtml(item, i, true);
    }

    container.innerHTML = html;
    bindV2InventoryEvents(container);
    bindTooltipEvents(container);
}

// ─── Equipment Search Modal ──────────────────────────────────

function closeSearchPopup() {
    if (_activeSearchPopup) {
        _activeSearchPopup.remove();
        _activeSearchPopup = null;
    }
}

function openEquipmentSearchModal(idx) {
    closeSearchPopup();

    const item = v2Inventory[idx];
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'dnd-equip-search-overlay';

    const currentType = item.type === 'none' ? null : item.type;

    const magicFieldsVisible = item.magic ? '' : ' style="display:none"';
    const chargesVal = item.charges !== null && item.charges !== undefined ? item.charges : '';

    overlay.innerHTML = `
        <div class="dnd-equip-search-modal">
            <div class="dnd-equip-search-header">
                <span>Equipment Search</span>
                <button class="dnd-equip-search-close-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="dnd-equip-search-tabs">
                <button class="dnd-equip-search-tab${!currentType || currentType === 'armor' ? ' active' : ''}" data-kind="armor">🛡️ Armor</button>
                <button class="dnd-equip-search-tab${currentType === 'shield' ? ' active' : ''}" data-kind="shield">🛡️ Shield</button>
                <button class="dnd-equip-search-tab${currentType === 'weapon' ? ' active' : ''}" data-kind="weapon">⚔️ Weapon</button>
            </div>
            <div class="dnd-equip-search-input-row">
                <input type="text" class="dnd-equip-search-input" placeholder="Search equipment..." value="${escapeHtml(item.name)}">
                <label class="dnd-equip-search-magic-label" title="Mark as magic item">
                    <input type="checkbox" class="dnd-equip-search-magic-check"${item.magic ? ' checked' : ''}> ✨ Magic
                </label>
            </div>
            <div class="dnd-equip-search-magic-fields"${magicFieldsVisible}>
                <div class="dnd-equip-search-charges-row">
                    <label>Charges:</label>
                    <input type="number" class="dnd-equip-search-charges" min="0" placeholder="∞" value="${chargesVal}">
                </div>
                <textarea class="dnd-equip-search-notes" placeholder="Magic properties, attached spells, abilities...">${escapeHtml(item.magicNotes || '')}</textarea>
            </div>
            <div class="dnd-equip-search-results"></div>
            <div class="dnd-equip-search-actions">
                <button class="dnd-equip-search-clear">Clear Type</button>
                <button class="dnd-equip-search-close">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    _activeSearchPopup = overlay;

    const modal = overlay.querySelector('.dnd-equip-search-modal');
    const input = overlay.querySelector('.dnd-equip-search-input');
    const results = overlay.querySelector('.dnd-equip-search-results');
    const magicCheck = overlay.querySelector('.dnd-equip-search-magic-check');
    const magicFields = overlay.querySelector('.dnd-equip-search-magic-fields');
    const chargesInput = overlay.querySelector('.dnd-equip-search-charges');
    const notesInput = overlay.querySelector('.dnd-equip-search-notes');
    const tabs = overlay.querySelectorAll('.dnd-equip-search-tab');

    let activeKind = currentType || 'armor';

    // Toggle magic fields visibility, persist, and re-search
    magicCheck.addEventListener('change', () => {
        const isMagic = magicCheck.checked;
        magicFields.style.display = isMagic ? '' : 'none';
        v2Inventory[idx].magic = isMagic;
        if (!isMagic) {
            v2Inventory[idx].magicNotes = '';
            v2Inventory[idx].charges = null;
        }
        persist();
        doSearch();
    });

    // Persist charges on change
    chargesInput.addEventListener('change', () => {
        const val = chargesInput.value.trim();
        v2Inventory[idx].charges = val === '' ? null : Math.max(0, parseInt(val) || 0);
        persist();
    });

    // Persist notes on blur
    notesInput.addEventListener('blur', () => {
        v2Inventory[idx].magicNotes = notesInput.value.trim();
        persist();
    });

    function doSearch() {
        const query = input.value.trim();
        const useMagic = magicCheck.checked;
        const matches = searchEquipment(query, activeKind, useMagic);

        if (matches.length === 0) {
            results.innerHTML = query.length >= 2
                ? '<div class="dnd-equip-search-empty">No matches found</div>'
                : '<div class="dnd-equip-search-empty">Type to search...</div>';
            return;
        }

        results.innerHTML = matches.slice(0, 20).map(m => {
            let stat = '';
            if (activeKind === 'armor') {
                stat = m.ac ? ` — AC ${m.ac}` : '';
            } else if (activeKind === 'shield') {
                stat = ' — +2 AC';
            } else if (activeKind === 'weapon') {
                const dmg = m.dmg1 || m.damageDice || '';
                const dtype = m.dmgType || m.damageType || '';
                stat = dmg ? ` — ${dmg} ${dtype}`.trim() : '';
            }
            const magicBadge = m._magic ? ' <span class="dnd-equip-search-magic-badge">✨</span>' : '';
            return `<div class="dnd-equip-search-result" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}${stat}${magicBadge}</div>`;
        }).join('');

        results.querySelectorAll('.dnd-equip-search-result').forEach(el => {
            el.addEventListener('click', () => {
                const selectedName = el.dataset.name;
                const match = matches.find(m => m.name === selectedName);
                if (match) {
                    selectEquipmentMatch(idx, activeKind, match);
                }
            });
        });
    }

    input.addEventListener('input', doSearch);
    input.focus();
    input.select();

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeKind = tab.dataset.kind;
            doSearch();
        });
    });

    overlay.querySelector('.dnd-equip-search-clear').addEventListener('click', () => {
        v2Inventory[idx].type = 'none';
        v2Inventory[idx].magic = false;
        v2Inventory[idx].equipmentData = null;
        persist();
        closeSearchPopup();
        renderV2Inventory();
    });

    const closeModal = () => closeSearchPopup();
    overlay.querySelector('.dnd-equip-search-close').addEventListener('click', closeModal);
    overlay.querySelector('.dnd-equip-search-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    doSearch();
}

function selectEquipmentMatch(idx, kind, match) {
    const item = v2Inventory[idx];
    if (!item) return;

    item.type = kind;
    item.magic = !!match._magic;
    item.name = match.name;
    invalidateTooltipCache(item.name);

    if (kind === 'armor') {
        item.equipmentData = {
            name: match.name,
            type: match._armorType || match.type || 'LA',
            ac: match.ac || 10,
            dexCap: match._armorType === 'MA' ? 2 : (match._armorType === 'HA' ? 0 : null),
            strReq: match.strength || match.strReq || 0,
            stealthDis: !!match.stealth || !!match.stealthDis,
            bonusAc: match.bonusAc || (match.bonusWeapon ? parseInt(String(match.bonusWeapon).replace(/[^-\d]/g, '')) : 0) || 0,
            _magic: !!match._magic,
        };
    } else if (kind === 'shield') {
        item.equipmentData = {
            name: match.name,
            ac: match.ac || 2,
            _magic: !!match._magic,
        };
    } else if (kind === 'weapon') {
        item.equipmentData = {
            name: match.name,
            damageDice: match.dmg1 || match.damageDice || '1d6',
            damageType: match.dmgType || match.damageType || 'slashing',
            properties: match.property || match.properties || [],
            isRanged: !!(match.range || (match.property || []).some(p => typeof p === 'string' && (p === 'A' || p === 'AF'))),
            bonus: match.bonusWeapon ? parseInt(String(match.bonusWeapon).replace(/[^-\d]/g, '')) || 0 : 0,
            _magic: !!match._magic,
        };
    }

    if (item.location === 'equipped') {
        if (kind === 'armor') enforceSingleArmor(idx);
        if (kind === 'shield') enforceSingleShield(idx);
    }

    persist();
    closeSearchPopup();
    renderV2Inventory();
}

// ─── Event Binding ───────────────────────────────────────────

function bindV2InventoryEvents(container) {
    // Type icon button — TOGGLE: if none -> set to equipment (opens search modal)
    //                             if already equipment -> clear type back to none
    container.querySelectorAll('.dnd-inventory-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            if (!v2Inventory[idx]) return;
            if (v2Inventory[idx].type !== 'none') {
                // Already equipment: clear it
                v2Inventory[idx].type = 'none';
                v2Inventory[idx].magic = false;
                v2Inventory[idx].equipmentData = null;
                persist();
                renderV2Inventory();
            } else {
                // Not equipment: open search modal to designate type
                openEquipmentSearchModal(idx);
            }
        });
    });

    // Equipment text click — opens search modal (text is not editable for equipment)
    container.querySelectorAll('.dnd-inventory-text-equip').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.idx);
            if (!v2Inventory[idx]) return;
            openEquipmentSearchModal(idx);
        });
    });

    // Rarity cycle
    container.querySelectorAll('.dnd-inventory-rarity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!v2Inventory[idx]) return;
            v2Inventory[idx].rarity = cycleRarity(v2Inventory[idx].rarity);
            persist();
            renderV2Inventory();
        });
    });

    // Move (equip/store toggle)
    container.querySelectorAll('.dnd-inventory-move-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!v2Inventory[idx]) return;
            const item = v2Inventory[idx];
            item.location = item.location === 'equipped' ? 'stored' : 'equipped';
            if (item.location === 'equipped') {
                if (item.type === 'armor') enforceSingleArmor(idx);
                if (item.type === 'shield') enforceSingleShield(idx);
            }
            persist();
            renderV2Inventory();
        });
    });

    // Delete
    container.querySelectorAll('.dnd-inventory-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            v2Inventory.splice(idx, 1);
            persist();
            renderV2Inventory();
        });
    });

    // Name edit
    container.querySelectorAll('.dnd-inventory-text[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', () => {
            const idx = parseInt(el.dataset.idx);
            const newName = el.textContent.trim();
            if (v2Inventory[idx] && newName) {
                const oldName = v2Inventory[idx].name;
                if (oldName !== newName) {
                    invalidateTooltipCache(oldName);
                    v2Inventory[idx].name = newName;
                    refreshEquipmentData(idx);
                    persist();
                    renderV2Inventory();
                }
            } else if (v2Inventory[idx] && !newName) {
                v2Inventory.splice(idx, 1);
                persist();
                renderV2Inventory();
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    // Quantity edit
    container.querySelectorAll('.dnd-inventory-qty').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            if (!v2Inventory[idx]) return;

            const current = v2Inventory[idx].quantity || 1;
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
                v2Inventory[idx].quantity = Math.max(1, val);
                persist();
                el.textContent = `x${v2Inventory[idx].quantity}`;
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

    // Drag-and-drop reorder
    container.querySelectorAll('.dnd-inventory-drag-handle').forEach(handle => {
        handle.addEventListener('mousedown', () => {
            const item = handle.closest('.dnd-inventory-item');
            if (item) item.setAttribute('draggable', 'true');
        });
    });

    const items = container.querySelectorAll('.dnd-inventory-item[data-idx]');
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
            if (dragSrcIdx !== null && v2Inventory[dragSrcIdx] && v2Inventory[targetIdx] &&
                v2Inventory[dragSrcIdx].location === v2Inventory[targetIdx].location) {
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
            if (!v2Inventory[dragSrcIdx] || !v2Inventory[targetIdx] ||
                v2Inventory[dragSrcIdx].location !== v2Inventory[targetIdx].location) {
                dragSrcIdx = null;
                return;
            }
            const [moved] = v2Inventory.splice(dragSrcIdx, 1);
            const insertAt = dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            v2Inventory.splice(insertAt, 0, moved);
            dragSrcIdx = null;
            persist();
            renderV2Inventory();
        });
    });

}

// ─── Equipment Data Refresh ──────────────────────────────────

function refreshEquipmentData(idx) {
    const item = v2Inventory[idx];
    if (!item || item.type === 'none') return;

    const matches = searchEquipment(item.name, item.type, item.magic);
    if (matches.length > 0 && matches[0].name.toLowerCase() === item.name.toLowerCase()) {
        selectEquipmentDataOnly(idx, item.type, matches[0]);
    } else {
        item.equipmentData = null;
    }
}

function selectEquipmentDataOnly(idx, kind, match) {
    const item = v2Inventory[idx];
    if (!item) return;

    item.magic = !!match._magic;

    if (kind === 'armor') {
        item.equipmentData = {
            name: match.name,
            type: match._armorType || match.type || 'LA',
            ac: match.ac || 10,
            dexCap: match._armorType === 'MA' ? 2 : (match._armorType === 'HA' ? 0 : null),
            strReq: match.strength || match.strReq || 0,
            stealthDis: !!match.stealth || !!match.stealthDis,
            bonusAc: match.bonusAc || (match.bonusWeapon ? parseInt(String(match.bonusWeapon).replace(/[^-\d]/g, '')) : 0) || 0,
            _magic: !!match._magic,
        };
    } else if (kind === 'shield') {
        item.equipmentData = { name: match.name, ac: match.ac || 2, _magic: !!match._magic };
    } else if (kind === 'weapon') {
        item.equipmentData = {
            name: match.name,
            damageDice: match.dmg1 || match.damageDice || '1d6',
            damageType: match.dmgType || match.damageType || 'slashing',
            properties: match.property || match.properties || [],
            isRanged: !!(match.range || (match.property || []).some(p => typeof p === 'string' && (p === 'A' || p === 'AF'))),
            bonus: match.bonusWeapon ? parseInt(String(match.bonusWeapon).replace(/[^-\d]/g, '')) || 0 : 0,
            _magic: !!match._magic,
        };
    }
}

/**
 * Add a new V2 inventory item from the inline input.
 */
export function addV2InventoryItemFromInput() {
    const input = document.getElementById('dnd-add-inventory-input');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    v2Inventory.push(createDefaultItem({ name }));
    input.value = '';
    persist();
    renderV2Inventory();
}
