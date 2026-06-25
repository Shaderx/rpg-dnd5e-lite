/**
 * V2 Inventory Renderer
 * Master list for all items including character equipment.
 * Features: unified item info modal, type icons, magic glow, fuzzy DB search,
 * drag-reorder, rarity cycle, qty edit, equip/store, tooltips.
 */

import { v2Inventory, createDefaultItem, isItemEquipped, MAX_ATTUNEMENT } from '../core/state.js';
import { saveV2Inventory } from '../core/persistence.js';
import { RARITY_LABELS, cycleRarity, normalizeRarity } from '../../features/inventoryRarity.js';
import { bindTooltipEvents, showEquipmentTooltip, hideTooltip } from '../../rendering/tooltip.js';
import { fuzzyLookupItem, searchEquipment, searchMagicItems } from '../../features/sidekick.js';
import { renderV2CharacterPanel } from './character.js';

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
    renderV2CharacterPanel();
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
    const attuned = v2Inventory.filter(item => item.location === 'attuned');
    const equipped = v2Inventory.filter(item => item.location === 'equipped');
    const stored = v2Inventory.filter(item => item.location === 'stored');
    v2Inventory.length = 0;
    v2Inventory.push(...attuned, ...equipped, ...stored);
}

function getAttunedCount() {
    return v2Inventory.filter(item => item.location === 'attuned').length;
}


function enforceSingleArmor(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'armor' || !isItemEquipped(item)) return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'armor' && isItemEquipped(v2Inventory[i])) {
            v2Inventory[i].location = 'stored';
        }
    }
}

function enforceSingleShield(equippingIdx) {
    const item = v2Inventory[equippingIdx];
    if (!item || item.type !== 'shield' || !isItemEquipped(item)) return;
    for (let i = 0; i < v2Inventory.length; i++) {
        if (i === equippingIdx) continue;
        if (v2Inventory[i].type === 'shield' && isItemEquipped(v2Inventory[i])) {
            v2Inventory[i].location = 'stored';
        }
    }
}

function getMoveButtonState(item) {
    const loc = item.location;
    if (loc === 'attuned') {
        return { icon: 'fa-sun', cls: ' dnd-move-attuned', title: 'Attuned — click to unattune & store' };
    }
    if (loc === 'equipped') {
        if (item.magic) {
            return { icon: 'fa-shield-halved', cls: '', title: 'Equipped — click to attune' };
        }
        return { icon: 'fa-shield-halved', cls: '', title: 'Equipped — click to store' };
    }
    return { icon: 'fa-box-archive', cls: '', title: 'Stored — click to equip' };
}

function buildItemRowHtml(item, i) {
    const r = normalizeRarity(item.rarity);
    const isStored = item.location === 'stored';
    const isAttuned = item.location === 'attuned';
    const storedCls = isStored ? ' dnd-inventory-stored' : '';
    const attunedCls = isAttuned ? ' dnd-inventory-attuned' : '';
    const rClass = ` dnd-rarity-${r}${storedCls}${attunedCls}`;

    const baseItemName = item.equipmentData?.name || null;
    const ttName = baseItemName || resolveItemTooltipName(item.name);
    const ttCls = ttName ? ' dnd-tt-hover' : '';
    const ttData = ttName ? ` data-tt-type="equipment" data-tt-name="${escapeHtml(ttName)}"` : '';
    const magicNotesAttr = (item.magic && item.magicNotes) ? ` data-magic-notes="${escapeHtml(item.magicNotes)}"` : '';

    const typeInfo = TYPE_ICONS[item.type] || TYPE_ICONS.none;
    const typeCls = typeInfo.cls ? ` ${typeInfo.cls}` : '';
    const magicGlow = item.magic ? ' dnd-magic-glow' : '';

    const moveState = getMoveButtonState(item);

    const basePrefix = baseItemName ? `<span class="dnd-inventory-base-tag">[${escapeHtml(baseItemName)}]</span> ` : '';
    const displayName = item.name === baseItemName ? '' : escapeHtml(item.name);

    return `<div class="dnd-inventory-item${rClass}" data-idx="${i}"${magicNotesAttr}${ttData}>
        <span class="dnd-inventory-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
        <button class="dnd-inventory-type-btn${typeCls}${magicGlow}" data-idx="${i}" title="Item properties">
            ${typeIconHtml(item.type)}
        </button>
        <button class="dnd-inventory-rarity-btn" data-idx="${i}" title="${RARITY_LABELS[r]} — click to cycle">
            ${rarityIconHtml(r)}
        </button>
        ${basePrefix}<span class="dnd-inventory-text${ttCls}" contenteditable="true" data-idx="${i}">${displayName}</span>
        ${item.charges !== null && item.charges !== undefined ? `<span class="dnd-inventory-charges" data-idx="${i}" title="Charges remaining">⚡${item.charges}</span>` : ''}
        <span class="dnd-inventory-qty" data-idx="${i}" title="Click to edit quantity">x${item.quantity || 1}</span>
        <button class="dnd-inventory-move-btn${moveState.cls}" data-idx="${i}" title="${moveState.title}">
            <i class="fa-solid ${moveState.icon}"></i>
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

    const attunedItems = [];
    const equippedItems = [];
    const storedItems = [];
    v2Inventory.forEach((item, i) => {
        if (item.location === 'attuned') {
            attunedItems.push({ item, i });
        } else if (item.location === 'equipped') {
            equippedItems.push({ item, i });
        } else {
            storedItems.push({ item, i });
        }
    });

    if (attunedItems.length === 0 && equippedItems.length === 0 && storedItems.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No items yet</div>';
        return;
    }

    let html = '';

    if (attunedItems.length > 0) {
        html += `<div class="dnd-inventory-section-divider dnd-inventory-attuned-divider"><span>Attuned (${attunedItems.length}/${MAX_ATTUNEMENT})</span></div>`;
        for (const { item, i } of attunedItems) {
            html += buildItemRowHtml(item, i);
        }
    }

    html += '<div class="dnd-inventory-section-divider"><span>Equipped</span></div>';

    if (equippedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No equipped items</div>';
    }

    for (const { item, i } of equippedItems) {
        html += buildItemRowHtml(item, i);
    }

    html += '<div class="dnd-inventory-section-divider dnd-inventory-stored-divider"><span>Stored</span></div>';

    if (storedItems.length === 0) {
        html += '<div class="dnd-inventory-empty-sub">No stored items</div>';
    }

    for (const { item, i } of storedItems) {
        html += buildItemRowHtml(item, i);
    }

    container.innerHTML = html;
    bindV2InventoryEvents(container);
    bindTooltipEvents(container);
}

// ─── Item Info Modal (unified) ───────────────────────────────

function closeSearchPopup() {
    hideTooltip();
    if (_activeSearchPopup) {
        _activeSearchPopup.remove();
        _activeSearchPopup = null;
    }
}

function openItemInfoModal(idx) {
    closeSearchPopup();

    const item = v2Inventory[idx];
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'dnd-equip-search-overlay';

    const currentType = item.type || 'none';
    const chargesVal = item.charges !== null && item.charges !== undefined ? item.charges : '';
    const baseItemName = item.equipmentData?.name || '';

    overlay.innerHTML = `
        <div class="dnd-equip-search-modal dnd-item-info-modal">
            <div class="dnd-equip-search-header">
                <span>${typeIconHtml(currentType)} ${escapeHtml(item.name || 'New Item')}</span>
                <button class="dnd-equip-search-close-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="dnd-item-info-tabs">
                <button class="dnd-item-info-tab active" data-tab="equipment">⚔️ Equipment</button>
                <button class="dnd-item-info-tab" data-tab="magic">✨ Magic</button>
            </div>

            <!-- Equipment Tab -->
            <div class="dnd-item-info-panel" data-panel="equipment">
                <div class="dnd-item-info-type-row">
                    <label>Type:</label>
                    <div class="dnd-item-info-type-btns">
                        <button class="dnd-item-type-opt${currentType === 'none' ? ' active' : ''}" data-type="none">📦 None</button>
                        <button class="dnd-item-type-opt${currentType === 'armor' ? ' active' : ''}" data-type="armor">🛡️ Armor</button>
                        <button class="dnd-item-type-opt${currentType === 'shield' ? ' active' : ''}" data-type="shield">🛡️ Shield</button>
                        <button class="dnd-item-type-opt${currentType === 'weapon' ? ' active' : ''}" data-type="weapon">⚔️ Weapon</button>
                    </div>
                </div>
                <div class="dnd-item-info-search-section">
                    <div class="dnd-equip-search-input-row">
                        <input type="text" class="dnd-equip-search-input" placeholder="Search base item..." value="${escapeHtml(baseItemName || item.name)}">
                    </div>
                    <div class="dnd-equip-search-results"></div>
                </div>
                <div class="dnd-item-info-base-display"${baseItemName ? '' : ' style="display:none"'}>
                    <span class="dnd-item-info-base-label">Base item:</span>
                    <span class="dnd-item-info-base-name">${escapeHtml(baseItemName)}</span>
                    <button class="dnd-item-info-base-clear" title="Clear base item">✕</button>
                </div>
            </div>

            <!-- Magic Tab -->
            <div class="dnd-item-info-panel" data-panel="magic" style="display:none">
                <label class="dnd-magic-props-toggle">
                    <input type="checkbox" class="dnd-magic-props-check"${item.magic ? ' checked' : ''}>
                    <span>Magic Item</span>
                </label>
                <div class="dnd-magic-props-fields"${item.magic ? '' : ' style="display:none"'}>
                    <div class="dnd-equip-search-charges-row">
                        <label>Charges:</label>
                        <input type="number" class="dnd-equip-search-charges" min="0" placeholder="∞ (leave empty)" value="${chargesVal}">
                    </div>
                    <label class="dnd-item-info-field-label">Descriptor (spells, abilities, effects):</label>
                    <textarea class="dnd-equip-search-notes" placeholder="e.g. Contains Fireball (3rd level), Repels fey within 30ft...">${escapeHtml(item.magicNotes || '')}</textarea>
                </div>
            </div>

            <div class="dnd-equip-search-actions">
                <button class="dnd-item-info-save">Save</button>
                <button class="dnd-equip-search-close">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    _activeSearchPopup = overlay;

    // State
    let selectedType = currentType;
    let pendingMatch = null;

    // Elements
    const tabs = overlay.querySelectorAll('.dnd-item-info-tab');
    const panels = overlay.querySelectorAll('.dnd-item-info-panel');
    const typeBtns = overlay.querySelectorAll('.dnd-item-type-opt');
    const searchInput = overlay.querySelector('.dnd-equip-search-input');
    const resultsDiv = overlay.querySelector('.dnd-equip-search-results');
    const baseDisplay = overlay.querySelector('.dnd-item-info-base-display');
    const baseName = overlay.querySelector('.dnd-item-info-base-name');
    const magicCheck = overlay.querySelector('.dnd-magic-props-check');
    const magicFields = overlay.querySelector('.dnd-magic-props-fields');
    const chargesInput = overlay.querySelector('.dnd-equip-search-charges');
    const notesInput = overlay.querySelector('.dnd-equip-search-notes');

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panels.forEach(p => { p.style.display = p.dataset.panel === tab.dataset.tab ? '' : 'none'; });
        });
    });

    // Type selection
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedType = btn.dataset.type;
            searchInput.placeholder = selectedType === 'none'
                ? 'Search items (potions, scrolls, wondrous)...'
                : 'Search base item...';
            doSearch();
        });
    });

    // Search: equipment DB for armor/shield/weapon; magic item DB for "none"
    function doSearch() {
        const query = searchInput.value.trim();
        if (query.length < 2) {
            resultsDiv.innerHTML = '<div class="dnd-equip-search-empty">Type to search...</div>';
            return;
        }

        let matches;
        if (selectedType === 'none') {
            matches = searchMagicItems(query);
        } else {
            const useMagic = magicCheck.checked;
            matches = searchEquipment(query, selectedType, useMagic);
        }

        if (!matches || matches.length === 0) {
            resultsDiv.innerHTML = '<div class="dnd-equip-search-empty">No matches</div>';
            return;
        }

        resultsDiv.innerHTML = matches.slice(0, 20).map(m => {
            let stat = '';
            if (selectedType === 'armor') stat = m.ac ? ` — AC ${m.ac}` : '';
            else if (selectedType === 'shield') {
                const shieldBonusAc = m.bonusAc ? (parseInt(String(m.bonusAc).replace(/[^-\d]/g, '')) || 0) : 0;
                stat = ` — +${(m.ac || 2) + shieldBonusAc} AC`;
            }
            else if (selectedType === 'weapon') {
                const dmg = m.dmg1 || m.damageDice || '';
                const dtype = m.dmgType || m.damageType || '';
                stat = dmg ? ` — ${dmg} ${dtype}`.trim() : '';
            } else {
                const rarity = m.rarity && m.rarity !== 'none' ? ` — ${m.rarity}` : '';
                const mType = (m.type || '').split('|')[0];
                const typeLabel = mType === 'P' ? ' [Potion]' : mType === 'SC' ? ' [Scroll]' : mType === 'RG' ? ' [Ring]' : mType === 'WD' ? ' [Wand]' : mType === 'RD' ? ' [Rod]' : '';
                stat = `${typeLabel}${rarity}`;
            }
            const magicBadge = m._magic ? ' <span class="dnd-equip-search-magic-badge">✨</span>' : '';
            return `<div class="dnd-equip-search-result" data-name="${escapeHtml(m.name)}">${escapeHtml(m.name)}${stat}${magicBadge}</div>`;
        }).join('');

        resultsDiv.querySelectorAll('.dnd-equip-search-result').forEach(el => {
            el.addEventListener('click', () => {
                const matchObj = matches.find(m => m.name === el.dataset.name);
                if (matchObj) {
                    pendingMatch = matchObj;
                    baseName.textContent = matchObj.name;
                    baseDisplay.style.display = '';
                    searchInput.value = matchObj.name;
                    resultsDiv.innerHTML = '';
                }
            });
            el.addEventListener('mouseenter', () => { showEquipmentTooltip(el, el.dataset.name); });
            el.addEventListener('mouseleave', () => { hideTooltip(); });
        });
    }

    searchInput.addEventListener('input', doSearch);

    // Base item display tooltip
    baseDisplay.addEventListener('mouseenter', () => {
        const name = baseName.textContent;
        if (name) showEquipmentTooltip(baseDisplay, name);
    });
    baseDisplay.addEventListener('mouseleave', () => { hideTooltip(); });

    // Clear base item
    overlay.querySelector('.dnd-item-info-base-clear').addEventListener('click', () => {
        pendingMatch = null;
        baseDisplay.style.display = 'none';
        baseName.textContent = '';
    });

    // Magic toggle
    magicCheck.addEventListener('change', () => {
        magicFields.style.display = magicCheck.checked ? '' : 'none';
    });

    // Save
    overlay.querySelector('.dnd-item-info-save').addEventListener('click', () => {
        item.type = selectedType;

        // Apply base item from search
        if (pendingMatch && selectedType !== 'none') {
            applyEquipmentMatch(item, selectedType, pendingMatch);
            item.name = pendingMatch.name;
            invalidateTooltipCache(item.name);
        } else if (pendingMatch && selectedType === 'none') {
            // Base item for non-equipment (scroll, potion, wondrous)
            const rawType = (pendingMatch.type || '').split('|')[0];
            item.equipmentData = { name: pendingMatch.name, type: rawType, _magic: !!pendingMatch._magic };
            if (pendingMatch._magic && !magicCheck.checked) {
                magicCheck.checked = true;
            }
        } else if (!pendingMatch && selectedType === 'none') {
            item.equipmentData = null;
        }

        // Apply magic
        item.magic = magicCheck.checked;
        if (item.magic) {
            const cv = chargesInput.value.trim();
            item.charges = cv === '' ? null : Math.max(0, parseInt(cv) || 0);
            item.magicNotes = notesInput.value.trim();
        } else {
            item.magicNotes = '';
            item.charges = null;
            if (item.location === 'attuned') item.location = 'equipped';
        }

        // Enforce single armor/shield
        if (isItemEquipped(item)) {
            if (item.type === 'armor') enforceSingleArmor(idx);
            if (item.type === 'shield') enforceSingleShield(idx);
        }

        persist();
        closeSearchPopup();
        renderV2Inventory();
    });

    // Close
    const closeModal = () => closeSearchPopup();
    overlay.querySelector('.dnd-equip-search-close').addEventListener('click', closeModal);
    overlay.querySelector('.dnd-equip-search-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Init search if item already has equipment type
    if (currentType !== 'none') doSearch();
}

function applyEquipmentMatch(item, kind, match) {
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
        const shieldBonusAc = match.bonusAc ? (parseInt(String(match.bonusAc).replace(/[^-\d]/g, '')) || 0) : 0;
        item.equipmentData = { name: match.name, ac: (match.ac || 2) + shieldBonusAc, _magic: !!match._magic };
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
    if (match._magic && !item.magic) {
        item.magic = true;
    }
}

// ─── Event Binding ───────────────────────────────────────────

function bindV2InventoryEvents(container) {
    // Type icon button — always opens the Item Info Modal
    container.querySelectorAll('.dnd-inventory-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            if (!v2Inventory[idx]) return;
            openItemInfoModal(idx);
        });
    });

    // Tooltip on hover: base item tooltip + magic notes + charges appended
    container.querySelectorAll('.dnd-inventory-item[data-tt-name]').forEach(row => {
        row.addEventListener('mouseenter', () => {
            const name = row.dataset.ttName;
            if (!name) return;
            const idx = parseInt(row.dataset.idx);
            const item = v2Inventory[idx];
            let extra = '';
            if (item?.magic) {
                const parts = [];
                if (item.magicNotes) parts.push(item.magicNotes);
                if (item.charges !== null && item.charges !== undefined) parts.push(`Charges: ${item.charges}`);
                extra = parts.join(' | ');
            }
            showEquipmentTooltip(row, name, extra);
        });
        row.addEventListener('mouseleave', () => { hideTooltip(); });
    });

    // Inline magic notes tooltip for items that have notes but no base item in DB
    container.querySelectorAll('.dnd-inventory-item[data-magic-notes]:not([data-tt-name])').forEach(row => {
        row.addEventListener('mouseenter', () => {
            const notes = row.dataset.magicNotes;
            if (!notes) return;
            let tip = row.querySelector('.dnd-magic-tooltip');
            if (!tip) {
                tip = document.createElement('div');
                tip.className = 'dnd-magic-tooltip';
                row.appendChild(tip);
            }
            tip.textContent = `✨ ${notes}`;
            tip.style.display = '';
        });
        row.addEventListener('mouseleave', () => {
            const tip = row.querySelector('.dnd-magic-tooltip');
            if (tip) tip.style.display = 'none';
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

    // Move (stored → equipped → attuned → stored for magic; stored ↔ equipped for non-magic)
    container.querySelectorAll('.dnd-inventory-move-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            if (!v2Inventory[idx]) return;
            const item = v2Inventory[idx];

            if (item.location === 'stored') {
                item.location = 'equipped';
                if (item.type === 'armor') enforceSingleArmor(idx);
                if (item.type === 'shield') enforceSingleShield(idx);
            } else if (item.location === 'equipped') {
                if (item.magic && getAttunedCount() < MAX_ATTUNEMENT) {
                    item.location = 'attuned';
                } else {
                    item.location = 'stored';
                }
            } else if (item.location === 'attuned') {
                item.location = 'stored';
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

    // Name edit (user edits the custom suffix; base item prefix is separate)
    container.querySelectorAll('.dnd-inventory-text[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', () => {
            const idx = parseInt(el.dataset.idx);
            if (!v2Inventory[idx]) return;
            const item = v2Inventory[idx];
            const newName = el.textContent.trim();
            const baseName = item.equipmentData?.name || '';

            if (newName) {
                const oldName = item.name;
                if (oldName !== newName) {
                    invalidateTooltipCache(oldName);
                    item.name = newName;
                    if (item.type !== 'none') refreshEquipmentData(idx);
                    persist();
                    renderV2Inventory();
                }
            } else if (baseName) {
                // Empty custom name with base item → name defaults to base item name
                if (item.name !== baseName) {
                    item.name = baseName;
                    persist();
                    renderV2Inventory();
                }
            } else {
                // No name and no base item → delete the item
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
        const shieldBonusAc = match.bonusAc ? (parseInt(String(match.bonusAc).replace(/[^-\d]/g, '')) || 0) : 0;
        item.equipmentData = { name: match.name, ac: (match.ac || 2) + shieldBonusAc, _magic: !!match._magic };
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
