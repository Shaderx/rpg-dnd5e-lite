/**
 * V2 Companion Module - Card & Detail Rendering
 * Sidekick-style card grid, detail modal populator, and edit modal logic.
 */

import { v2Companions } from '../core/state.js';
import { characterV2 } from '../core/characterState.js';
import {
    CATEGORY_META,
    CREATURE_TYPE_OPTIONS,
    FAMILIAR_CREATURES,
    PRIMAL_COMPANIONS,
    STEED_TEMPLATE,
    getComputedStats,
    buildFamiliarCompanion,
    buildPrimalCompanion,
    buildSteedCompanion,
    addCompanion,
    updateCompanion,
} from '../features/companion.js';
import { character } from '../../core/state.js';
import { bindTooltipEvents } from '../../rendering/tooltip.js';

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function modStr(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ============================================================
// CARD GRID RENDERER
// ============================================================

export function renderCompanionCards() {
    const container = document.getElementById('dnd-v2-companion-cards');
    if (!container) return;

    if (!v2Companions || v2Companions.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No companions</div>';
        return;
    }

    const cards = v2Companions.map(comp => {
        const meta = CATEGORY_META[comp.category] || CATEGORY_META.familiar;
        const enabledClass = comp.enabled ? 'dnd-comp-card-enabled' : 'dnd-comp-card-disabled';
        const computed = getComputedStats(comp);

        const abilRow = ABILITY_KEYS
            .map(a => `<span class="dnd-comp-card-ab"><b>${a[0].toUpperCase()}</b>${comp[a] ?? 10}</span>`)
            .join('');

        const creatureTypeLabel = comp.creatureType
            ? comp.creatureType.charAt(0).toUpperCase() + comp.creatureType.slice(1)
            : '';

        return `<div class="dnd-comp-card ${enabledClass}" data-comp-id="${comp.id}" title="Click for details, Shift+click to toggle injection">
            <div class="dnd-comp-card-top">
                <div class="dnd-comp-card-identity">
                    <div class="dnd-comp-card-name">${esc(comp.name || 'Unnamed')}</div>
                    <div class="dnd-comp-card-subtitle">${esc(comp.creatureName || '')}${creatureTypeLabel ? ' &mdash; ' + esc(creatureTypeLabel) : ''}</div>
                </div>
                <div class="dnd-comp-card-badge" title="${esc(meta.label)}" style="--badge-color:${meta.color}">
                    <i class="fa-solid ${meta.icon}"></i>
                    <span>${esc(meta.label)}</span>
                </div>
            </div>
            <div class="dnd-comp-card-stats">
                <span class="dnd-comp-pill dnd-comp-pill-hp">HP ${computed.hp}</span>
                <span class="dnd-comp-pill">AC ${computed.ac}</span>
                <span class="dnd-comp-pill">${esc(comp.size || 'M')}</span>
            </div>
            <div class="dnd-comp-card-abilities">${abilRow}</div>
            ${comp.enabled ? '' : '<div class="dnd-comp-card-off"><i class="fa-solid fa-eye-slash"></i></div>'}
        </div>`;
    });

    container.innerHTML = cards.join('');
}

// ============================================================
// DETAIL MODAL POPULATOR
// ============================================================

export function renderCompanionDetail(compId) {
    const comp = v2Companions.find(c => c.id === compId);
    if (!comp) return;

    const body = document.getElementById('dnd-v2-comp-detail-body');
    const title = document.getElementById('dnd-v2-comp-detail-title');
    if (!body || !title) return;

    const meta = CATEGORY_META[comp.category] || CATEGORY_META.familiar;
    const computed = getComputedStats(comp);

    title.textContent = comp.name || 'Companion Details';

    const sections = [];

    const creatureTypeLabel = comp.creatureType
        ? comp.creatureType.charAt(0).toUpperCase() + comp.creatureType.slice(1)
        : '';

    sections.push(`<div class="dnd-comp-det-header">
        <div class="dnd-comp-det-name">${esc(comp.name || 'Unnamed')}</div>
        <div class="dnd-comp-det-meta">${esc(comp.creatureName)} &mdash; ${esc(creatureTypeLabel)} ${esc(meta.label)}</div>
    </div>`);

    let speedDisplay = computed.speed || comp.speed || '';
    sections.push(`<div class="dnd-comp-det-row dnd-comp-det-combat">
        <span>HP <strong>${computed.hp}</strong></span>
        <span>AC <strong>${computed.ac}</strong></span>
        <span>Speed <strong>${esc(speedDisplay)}</strong></span>
        <span>Size <strong>${esc(comp.size || 'M')}</strong></span>
    </div>`);

    if (comp.category !== 'familiar') {
        const levelLabel = comp.category === 'primal' ? 'Ranger Level' : 'Spell Slot Level';
        sections.push(`<div class="dnd-comp-det-row"><span>${levelLabel}: <strong>${comp.scalingLevel || '?'}</strong></span></div>`);
    }

    const abilityRow = ABILITY_KEYS
        .map(a => `<span class="dnd-comp-det-ability"><strong>${a.toUpperCase()}</strong> ${comp[a] ?? 10}(${modStr(comp[a] ?? 10)})</span>`)
        .join('');
    sections.push(`<div class="dnd-comp-det-row dnd-comp-det-abilities">${abilityRow}</div>`);

    if (comp.senses) {
        sections.push(`<div class="dnd-comp-det-section"><div class="dnd-comp-det-label">Senses</div><div>${esc(comp.senses)}</div></div>`);
    }
    if (comp.skills) {
        sections.push(`<div class="dnd-comp-det-section"><div class="dnd-comp-det-label">Skills</div><div>${esc(comp.skills)}</div></div>`);
    }

    const traits = computed.traits || comp.traits || [];
    if (traits.length > 0) {
        const tLines = traits.map(t =>
            `<div class="dnd-comp-det-entry"><strong>${esc(t.name)}.</strong> ${esc(t.desc)}</div>`
        );
        sections.push(`<div class="dnd-comp-det-section"><div class="dnd-comp-det-label">Traits</div>${tLines.join('')}</div>`);
    }

    const actions = computed.actions || comp.actions || [];
    if (actions.length > 0) {
        const aLines = actions.map(a =>
            `<div class="dnd-comp-det-entry"><strong>${esc(a.name)}.</strong> ${esc(a.desc)}</div>`
        );
        sections.push(`<div class="dnd-comp-det-section"><div class="dnd-comp-det-label">Actions</div>${aLines.join('')}</div>`);
    }

    if (comp.description) {
        sections.push(`<div class="dnd-comp-det-section"><div class="dnd-comp-det-label">Notes</div><div>${esc(comp.description)}</div></div>`);
    }

    body.innerHTML = sections.join('');
    body.dataset.companionId = compId;

    bindTooltipEvents(body);
}

// ============================================================
// EDIT MODAL
// ============================================================

export function openCompanionEditModal(compId) {
    const comp = v2Companions.find(c => c.id === compId);
    if (!comp) return;

    const $popup = $('#dnd-v2-comp-edit-popup');
    if (!$popup.length) return;

    $popup.find('#dnd-v2-comp-edit-id').val(comp.id);
    $popup.find('#dnd-v2-comp-edit-name').val(comp.name || '');
    $popup.find('#dnd-v2-comp-edit-desc').val(comp.description || '');

    const $ctypeRow = $popup.find('#dnd-v2-comp-edit-ctype-row');
    const $ctypeSelect = $popup.find('#dnd-v2-comp-edit-ctype');
    if (comp.category === 'familiar' && !FAMILIAR_CREATURES[comp.creatureSource]?.chainOnly) {
        $ctypeRow.show();
        $ctypeSelect.val(comp.creatureType || 'fey');
    } else if (comp.category === 'steed') {
        $ctypeRow.show();
        $ctypeSelect.val(comp.creatureType || 'celestial');
    } else {
        $ctypeRow.hide();
    }

    const $levelRow = $popup.find('#dnd-v2-comp-edit-level-row');
    const $levelInput = $popup.find('#dnd-v2-comp-edit-level');
    const $levelLabel = $popup.find('#dnd-v2-comp-edit-level-label');
    if (comp.category === 'primal') {
        $levelRow.show();
        $levelLabel.text('Ranger Level:');
        $levelInput.val(comp.scalingLevel || 3);
    } else if (comp.category === 'steed') {
        $levelRow.show();
        $levelLabel.text('Spell Slot Level:');
        $levelInput.val(comp.scalingLevel || 2);
    } else {
        $levelRow.hide();
    }

    $popup.find('#dnd-v2-comp-edit-title').text(`Edit ${comp.name || 'Companion'}`);

    $popup.css('display', 'flex');
}

export function saveCompanionFromEditModal() {
    const $popup = $('#dnd-v2-comp-edit-popup');
    const id = $popup.find('#dnd-v2-comp-edit-id').val();
    if (!id) return;

    const comp = v2Companions.find(c => c.id === id);
    if (!comp) return;

    const updates = {
        name: $popup.find('#dnd-v2-comp-edit-name').val().trim() || comp.name,
        description: $popup.find('#dnd-v2-comp-edit-desc').val().trim(),
    };

    const $ctypeRow = $popup.find('#dnd-v2-comp-edit-ctype-row');
    if ($ctypeRow.is(':visible')) {
        updates.creatureType = $popup.find('#dnd-v2-comp-edit-ctype').val();
    }

    const $levelRow = $popup.find('#dnd-v2-comp-edit-level-row');
    if ($levelRow.is(':visible')) {
        const val = parseInt($popup.find('#dnd-v2-comp-edit-level').val(), 10);
        if (!isNaN(val) && val > 0) {
            updates.scalingLevel = val;
        }
    }

    updateCompanion(id, updates);
    $popup.css('display', 'none');
    renderCompanionCards();
}

// ============================================================
// CREATION WIZARD
// ============================================================

let _wizardState = { step: 'category', category: null };

export function openCompanionWizard() {
    _wizardState = { step: 'category', category: null };
    renderWizardStep();
    $('#dnd-v2-comp-wizard-popup').css('display', 'flex');
}

function renderWizardStep() {
    const body = document.getElementById('dnd-v2-comp-wizard-body');
    const titleEl = document.getElementById('dnd-v2-comp-wizard-title');
    if (!body || !titleEl) return;

    if (_wizardState.step === 'category') {
        titleEl.textContent = 'Add Companion — Choose Type';
        body.innerHTML = buildCategoryPicker();
        body.querySelectorAll('.dnd-comp-wiz-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _wizardState.category = btn.dataset.category;
                _wizardState.step = 'configure';
                renderWizardStep();
            });
        });
    } else if (_wizardState.step === 'configure') {
        const meta = CATEGORY_META[_wizardState.category];
        titleEl.textContent = `Add ${meta?.label || 'Companion'}`;

        if (_wizardState.category === 'familiar') {
            body.innerHTML = buildFamiliarForm();
            bindFamiliarFormEvents(body);
        } else if (_wizardState.category === 'primal') {
            body.innerHTML = buildPrimalForm();
            bindPrimalFormEvents(body);
        } else if (_wizardState.category === 'steed') {
            body.innerHTML = buildSteedForm();
            bindSteedFormEvents(body);
        }
    }
}

function buildCategoryPicker() {
    const cats = ['familiar', 'primal', 'steed'];
    const cards = cats.map(cat => {
        const m = CATEGORY_META[cat];
        const desc = {
            familiar: 'Find Familiar — static stat block',
            primal: 'Beast Master Ranger — scales with level',
            steed: 'Find Steed — scales with spell slot',
        };
        return `<button class="dnd-comp-wiz-cat-btn" data-category="${cat}">
            <i class="fa-solid ${m.icon}"></i>
            <div class="dnd-comp-wiz-cat-label">${esc(m.label)}</div>
            <div class="dnd-comp-wiz-cat-desc">${esc(desc[cat])}</div>
        </button>`;
    });
    return `<div class="dnd-comp-wiz-cats">${cards.join('')}</div>`;
}

// ---- Familiar Form ----

function buildFamiliarForm() {
    const isPactChain = _hasPactChain();

    const standardKeys = Object.keys(FAMILIAR_CREATURES).filter(k => !FAMILIAR_CREATURES[k].chainOnly);
    const chainKeys = isPactChain ? Object.keys(FAMILIAR_CREATURES).filter(k => FAMILIAR_CREATURES[k].chainOnly) : [];

    let optionsHtml = '<optgroup label="Standard Familiars">';
    for (const k of standardKeys) {
        optionsHtml += `<option value="${k}">${esc(FAMILIAR_CREATURES[k].label)}</option>`;
    }
    optionsHtml += '</optgroup>';

    if (chainKeys.length > 0) {
        optionsHtml += '<optgroup label="Pact of the Chain">';
        for (const k of chainKeys) {
            optionsHtml += `<option value="${k}">${esc(FAMILIAR_CREATURES[k].label)}</option>`;
        }
        optionsHtml += '</optgroup>';
    }

    const ctypeOpts = CREATURE_TYPE_OPTIONS.map(ct =>
        `<option value="${ct}"${ct === 'fey' ? ' selected' : ''}>${ct.charAt(0).toUpperCase() + ct.slice(1)}</option>`
    ).join('');

    return `<div class="dnd-comp-wiz-form">
        <div class="dnd-setting-row">
            <label>Creature Form:</label>
            <select id="dnd-comp-wiz-fam-form">${optionsHtml}</select>
        </div>
        <div class="dnd-setting-row" id="dnd-comp-wiz-fam-ctype-row">
            <label>Creature Type:</label>
            <select id="dnd-comp-wiz-fam-ctype">${ctypeOpts}</select>
        </div>
        <div class="dnd-setting-row">
            <label>Custom Name:</label>
            <input type="text" id="dnd-comp-wiz-fam-name" placeholder="Leave blank for creature name" />
        </div>
        <div id="dnd-comp-wiz-fam-preview" class="dnd-comp-wiz-preview"></div>
        <div class="dnd-comp-wiz-actions">
            <button id="dnd-comp-wiz-back" class="dnd-btn">Back</button>
            <button id="dnd-comp-wiz-fam-save" class="dnd-btn dnd-btn-primary">Add Familiar</button>
        </div>
    </div>`;
}

function bindFamiliarFormEvents(container) {
    const formSelect = container.querySelector('#dnd-comp-wiz-fam-form');
    const ctypeSelect = container.querySelector('#dnd-comp-wiz-fam-ctype');
    const ctypeRow = container.querySelector('#dnd-comp-wiz-fam-ctype-row');
    const preview = container.querySelector('#dnd-comp-wiz-fam-preview');

    function updatePreview() {
        const key = formSelect.value;
        const creature = FAMILIAR_CREATURES[key];
        if (!creature) { preview.innerHTML = ''; return; }

        if (creature.chainOnly) {
            ctypeRow.style.display = 'none';
        } else {
            ctypeRow.style.display = '';
        }

        preview.innerHTML = `<div class="dnd-comp-wiz-stat-line">
            <strong>${esc(creature.label)}</strong> — ${esc(creature.size)} ${esc(creature.type)}
            | HP: ${creature.hp} | AC: ${creature.ac} | Speed: ${esc(creature.speed)}
        </div>`;
    }

    formSelect.addEventListener('change', updatePreview);
    updatePreview();

    container.querySelector('#dnd-comp-wiz-back').addEventListener('click', () => {
        _wizardState.step = 'category';
        renderWizardStep();
    });

    container.querySelector('#dnd-comp-wiz-fam-save').addEventListener('click', () => {
        const key = formSelect.value;
        const customName = container.querySelector('#dnd-comp-wiz-fam-name').value.trim();
        const creature = FAMILIAR_CREATURES[key];
        const ctype = creature?.chainOnly ? creature.type.toLowerCase() : ctypeSelect.value;

        const comp = buildFamiliarCompanion(key, customName, ctype);
        if (comp) {
            addCompanion(comp);
            renderCompanionCards();
            $('#dnd-v2-comp-wizard-popup').css('display', 'none');
        }
    });
}

// ---- Primal Companion Form ----

function buildPrimalForm() {
    const templates = Object.entries(PRIMAL_COMPANIONS).map(([key, base]) =>
        `<button class="dnd-comp-wiz-template-btn" data-template="${key}">
            <i class="fa-solid ${key === 'land' ? 'fa-mountain' : key === 'sea' ? 'fa-water' : 'fa-feather'}"></i>
            <div class="dnd-comp-wiz-cat-label">${esc(base.label)}</div>
            <div class="dnd-comp-wiz-cat-desc">HP ${base.baseHP}+${base.hpPerLevel}/lv | AC 13+PB | ${esc(base.speed)}</div>
        </button>`
    ).join('');

    const charLevel = character?.level || 3;

    return `<div class="dnd-comp-wiz-form">
        <div class="dnd-comp-wiz-cats">${templates}</div>
        <div id="dnd-comp-wiz-primal-config" style="display:none;">
            <div class="dnd-setting-row">
                <label>Custom Name:</label>
                <input type="text" id="dnd-comp-wiz-primal-name" placeholder="Leave blank for template name" />
            </div>
            <div class="dnd-setting-row">
                <label>Ranger Level:</label>
                <input type="number" id="dnd-comp-wiz-primal-level" value="${charLevel}" min="3" max="20" />
            </div>
            <div class="dnd-comp-wiz-actions">
                <button id="dnd-comp-wiz-back" class="dnd-btn">Back</button>
                <button id="dnd-comp-wiz-primal-save" class="dnd-btn dnd-btn-primary">Add Companion</button>
            </div>
        </div>
    </div>`;
}

function bindPrimalFormEvents(container) {
    let selectedTemplate = null;
    const configDiv = container.querySelector('#dnd-comp-wiz-primal-config');

    container.querySelectorAll('.dnd-comp-wiz-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedTemplate = btn.dataset.template;
            container.querySelectorAll('.dnd-comp-wiz-template-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            configDiv.style.display = '';
        });
    });

    container.querySelector('#dnd-comp-wiz-back')?.addEventListener('click', () => {
        _wizardState.step = 'category';
        renderWizardStep();
    });

    container.querySelector('#dnd-comp-wiz-primal-save')?.addEventListener('click', () => {
        if (!selectedTemplate) return;
        const customName = container.querySelector('#dnd-comp-wiz-primal-name').value.trim();
        const level = parseInt(container.querySelector('#dnd-comp-wiz-primal-level').value, 10) || 3;

        const comp = buildPrimalCompanion(selectedTemplate, customName, level);
        if (comp) {
            addCompanion(comp);
            renderCompanionCards();
            $('#dnd-v2-comp-wizard-popup').css('display', 'none');
        }
    });
}

// ---- Steed Form ----

function buildSteedForm() {
    const ctypeOpts = CREATURE_TYPE_OPTIONS.map(ct => {
        const traitName = STEED_TEMPLATE.traits[ct]?.name || '';
        return `<option value="${ct}">${ct.charAt(0).toUpperCase() + ct.slice(1)} — ${esc(traitName)}</option>`;
    }).join('');

    return `<div class="dnd-comp-wiz-form">
        <div class="dnd-setting-row">
            <label>Creature Type:</label>
            <select id="dnd-comp-wiz-steed-ctype">${ctypeOpts}</select>
        </div>
        <div class="dnd-setting-row">
            <label>Custom Name:</label>
            <input type="text" id="dnd-comp-wiz-steed-name" placeholder="e.g. Shadowmere" />
        </div>
        <div class="dnd-setting-row">
            <label>Spell Slot Level:</label>
            <input type="number" id="dnd-comp-wiz-steed-slot" value="2" min="2" max="9" />
        </div>
        <div class="dnd-comp-wiz-actions">
            <button id="dnd-comp-wiz-back" class="dnd-btn">Back</button>
            <button id="dnd-comp-wiz-steed-save" class="dnd-btn dnd-btn-primary">Add Steed</button>
        </div>
    </div>`;
}

function bindSteedFormEvents(container) {
    container.querySelector('#dnd-comp-wiz-back').addEventListener('click', () => {
        _wizardState.step = 'category';
        renderWizardStep();
    });

    container.querySelector('#dnd-comp-wiz-steed-save').addEventListener('click', () => {
        const ctype = container.querySelector('#dnd-comp-wiz-steed-ctype').value;
        const customName = container.querySelector('#dnd-comp-wiz-steed-name').value.trim();
        const slotLevel = parseInt(container.querySelector('#dnd-comp-wiz-steed-slot').value, 10) || 2;

        const comp = buildSteedCompanion(customName, ctype, slotLevel);
        if (comp) {
            addCompanion(comp);
            renderCompanionCards();
            $('#dnd-v2-comp-wizard-popup').css('display', 'none');
        }
    });
}

// ---- Helpers ----

function _hasPactChain() {
    if (characterV2?.levelChoices) {
        for (const choices of Object.values(characterV2.levelChoices)) {
            if (choices?.['pact-boon']?.selected === 'chain') return true;
        }
    }
    if (character?.className?.toLowerCase().includes('warlock')) return true;
    return false;
}
