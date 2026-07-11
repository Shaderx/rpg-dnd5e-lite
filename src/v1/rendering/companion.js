/**
 * V1 Character System - Companion Panel
 * Reactive companion tab for Find Familiar, Pact of the Chain, and Beast Master.
 * Shows form selector, naming, creature type, and full stat display.
 */

import { characterV1 } from '../core/state.js';
import { saveCharacterV1 } from '../core/persistence.js';
import { computeCharacterStats } from '../features/character.js';
import { FAMILIAR_CREATURES, PRIMAL_COMPANIONS } from '../features/levelFeatures.js';
import { ABILITY_KEYS, ABILITY_LABELS } from '../core/constants.js';
import { bindTooltipEvents } from '../../rendering/tooltip.js';

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Check whether the current character has companion access.
 * @returns {{ hasAccess: boolean, isPrimal: boolean, isFamiliar: boolean, isPactChain: boolean }}
 */
export function getCompanionAccess() {
    if (!characterV1) return { hasAccess: false };

    const stats = computeCharacterStats(characterV1);
    if (!stats) return { hasAccess: false };

    return {
        hasAccess: stats.hasCompanionAccess,
        isPrimal: !!(stats.companion),
        isFamiliar: !!(stats.hasCompanionAccess && !stats.companion),
        isPactChain: stats.isPactChain,
    };
}

/**
 * Build the form selector options based on companion access type.
 */
function buildFormOptions(stats) {
    const options = [];

    if (stats.companion) {
        for (const [key, data] of Object.entries(PRIMAL_COMPANIONS)) {
            options.push({ value: `primal:${key}`, label: data.label, group: 'Primal Companion' });
        }
    }

    if (stats.hasFindFamiliar || stats.isPactChain) {
        for (const [key, data] of Object.entries(FAMILIAR_CREATURES)) {
            if (data.chainOnly && !stats.isPactChain) continue;
            const group = data.chainOnly ? 'Pact of the Chain' : 'Familiar';
            options.push({ value: `familiar:${key}`, label: data.label, group });
        }
    }

    return options;
}

/**
 * Build the stat block HTML for a familiar creature.
 */
function buildFamiliarStatBlock(familiar, customName, creatureType) {
    const displayName = customName || familiar.label;
    const typeLabel = creatureType
        ? `${familiar.size} ${creatureType.charAt(0).toUpperCase() + creatureType.slice(1)}`
        : `${familiar.size} ${familiar.type}`;

    const lines = [];
    lines.push('<div class="v1-companion-stat-block">');
    lines.push(`<div class="v1-companion-header"><b><span class="dnd-tt-hover" data-tt-type="creature" data-tt-name="${esc(familiar.label)}">${esc(displayName)}</span></b></div>`);
    lines.push(`<div class="v1-companion-subheader">${esc(typeLabel)}</div>`);
    lines.push('<hr class="v1-divider" />');
    lines.push(`<div class="v1-row"><span>HP: <b>${familiar.hp}</b></span><span>AC: <b>${familiar.ac}</b></span></div>`);
    lines.push(`<div class="v1-row"><span>Speed: ${esc(familiar.speed)}</span></div>`);

    lines.push('<hr class="v1-divider" />');
    lines.push('<div class="v1-abilities">');
    for (const ab of ABILITY_KEYS) {
        const score = familiar[ab];
        if (score == null) continue;
        const mod = Math.floor((score - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        lines.push(`<div class="v1-ability"><div class="v1-ability-label">${ABILITY_LABELS[ab]}</div><div class="v1-ability-score">${score}</div><div class="v1-ability-mod">${modStr}</div></div>`);
    }
    lines.push('</div>');

    if (familiar.senses) {
        lines.push(`<div class="v1-row"><span class="v1-label">Senses:</span><span>${esc(familiar.senses)}</span></div>`);
    }
    if (familiar.skills) {
        lines.push(`<div class="v1-row"><span class="v1-label">Skills:</span><span>${esc(familiar.skills)}</span></div>`);
    }

    const traits = familiar.traits || [];
    if (traits.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-companion-section-header">Traits</div>');
        for (const t of traits) {
            lines.push(`<div class="v1-companion-trait"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(t.name)}" data-tt-text="${esc(t.desc)}"><b>${esc(t.name)}.</b></span> <span class="v1-companion-trait-desc">${esc(t.desc)}</span></div>`);
        }
    }

    const actions = familiar.actions || [];
    if (actions.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-companion-section-header">Actions</div>');
        for (const a of actions) {
            lines.push(`<div class="v1-companion-action"><b>${esc(a.name)}.</b> ${esc(a.desc)}</div>`);
        }
    }

    lines.push('</div>');
    return lines.join('\n');
}

/**
 * Build the stat block HTML for a primal companion.
 */
function buildPrimalStatBlock(companion) {
    const displayName = companion.customName || companion.name;
    const lines = [];
    lines.push('<div class="v1-companion-stat-block">');
    lines.push(`<div class="v1-companion-header"><b>${esc(displayName)}</b></div>`);
    lines.push(`<div class="v1-companion-subheader">${esc(companion.size)} ${esc(companion.type)}</div>`);
    lines.push('<hr class="v1-divider" />');
    lines.push(`<div class="v1-row"><span>HP: <b>${companion.hp}</b></span><span>AC: <b>${companion.ac}</b></span></div>`);
    lines.push(`<div class="v1-row"><span>Speed: ${esc(companion.speed)}</span></div>`);

    lines.push('<hr class="v1-divider" />');
    lines.push('<div class="v1-abilities">');
    for (const ab of ABILITY_KEYS) {
        const score = companion[ab];
        if (score == null) continue;
        const mod = Math.floor((score - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        lines.push(`<div class="v1-ability"><div class="v1-ability-label">${ABILITY_LABELS[ab]}</div><div class="v1-ability-score">${score}</div><div class="v1-ability-mod">${modStr}</div></div>`);
    }
    lines.push('</div>');

    const traits = companion.traits || [];
    if (traits.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-companion-section-header">Traits</div>');
        for (const t of traits) {
            lines.push(`<div class="v1-companion-trait"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(t.name)}" data-tt-text="${esc(t.desc)}"><b>${esc(t.name)}.</b></span> <span class="v1-companion-trait-desc">${esc(t.desc)}</span></div>`);
        }
    }

    const actions = companion.actions || [];
    if (actions.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-companion-section-header">Actions</div>');
        for (const a of actions) {
            lines.push(`<div class="v1-companion-action"><b>${esc(a.name)}.</b> ${esc(a.desc)}</div>`);
        }
    }

    lines.push('</div>');
    return lines.join('\n');
}

/**
 * Render the companion panel content.
 * Called reactively whenever the character changes.
 */
export function renderV1CompanionPanel() {
    const container = document.getElementById('dnd-v1-companion-container');
    if (!container) return;

    if (!characterV1) {
        container.style.display = 'none';
        return;
    }

    const stats = computeCharacterStats(characterV1);
    if (!stats) {
        container.style.display = 'none';
        return;
    }

    container.style.display = '';

    // Update title
    const titleEl = document.getElementById('dnd-v1-companion-title');
    const cd = characterV1.companionData || {};
    if (titleEl) {
        const name = cd.name || 'Companion';
        titleEl.textContent = name;
    }

    // Populate form dropdown
    const formSelect = document.getElementById('dnd-v1-companion-form');
    if (formSelect) {
        const options = buildFormOptions(stats);
        const currentVal = cd.type && cd.form ? `${cd.type}:${cd.form}` : '';

        let html = '<option value="">-- Select Form --</option>';
        let lastGroup = '';
        for (const opt of options) {
            if (opt.group !== lastGroup) {
                if (lastGroup) html += '</optgroup>';
                html += `<optgroup label="${esc(opt.group)}">`;
                lastGroup = opt.group;
            }
            const sel = opt.value === currentVal ? ' selected' : '';
            html += `<option value="${esc(opt.value)}"${sel}>${esc(opt.label)}</option>`;
        }
        if (lastGroup) html += '</optgroup>';
        formSelect.innerHTML = html;
    }

    // Set name input
    const nameInput = document.getElementById('dnd-v1-companion-name');
    if (nameInput && nameInput !== document.activeElement) {
        nameInput.value = cd.name || '';
    }

    // Show/hide creature type row (only for familiars)
    const ctypeRow = document.getElementById('dnd-v1-companion-creature-type-row');
    if (ctypeRow) {
        ctypeRow.style.display = cd.type === 'familiar' ? '' : 'none';
    }

    // Set creature type radio
    if (cd.creatureType) {
        const radio = document.querySelector(`input[name="dnd-v1-companion-ctype"][value="${cd.creatureType}"]`);
        if (radio) radio.checked = true;
    }

    // Render stat block
    const statsEl = document.getElementById('dnd-v1-companion-stats');
    if (statsEl) {
        if (cd.type === 'familiar' && cd.form && FAMILIAR_CREATURES[cd.form]) {
            statsEl.innerHTML = buildFamiliarStatBlock(
                FAMILIAR_CREATURES[cd.form],
                cd.name,
                cd.creatureType,
            );
        } else if (cd.type === 'primal' && stats.companion) {
            statsEl.innerHTML = buildPrimalStatBlock(stats.companion);
        } else {
            statsEl.innerHTML = '<div class="dnd-empty-state">Select a companion form above</div>';
        }
    }

    bindTooltipEvents(container);
}

/**
 * Initialize companion panel event handlers.
 * Should be called once during extension setup.
 */
export function initCompanionPanel() {
    const formSelect = document.getElementById('dnd-v1-companion-form');
    if (formSelect) {
        formSelect.addEventListener('change', () => {
            if (!characterV1) return;
            const val = formSelect.value;
            if (!val) {
                characterV1.companionData = { type: null, form: null, name: characterV1.companionData?.name || '', creatureType: null };
            } else {
                const [type, form] = val.split(':');
                characterV1.companionData = {
                    ...(characterV1.companionData || {}),
                    type,
                    form,
                };
                if (type === 'primal') {
                    characterV1.companionData.creatureType = null;
                }
            }
            saveCharacterV1(characterV1);
            renderV1CompanionPanel();
        });
    }

    const nameInput = document.getElementById('dnd-v1-companion-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            if (!characterV1) return;
            if (!characterV1.companionData) characterV1.companionData = { type: null, form: null, name: '', creatureType: null };
            characterV1.companionData.name = nameInput.value;
            saveCharacterV1(characterV1);

            const titleEl = document.getElementById('dnd-v1-companion-title');
            if (titleEl) titleEl.textContent = nameInput.value || 'Companion';
        });
    }

    const ctypeRadios = document.querySelectorAll('input[name="dnd-v1-companion-ctype"]');
    for (const radio of ctypeRadios) {
        radio.addEventListener('change', () => {
            if (!characterV1) return;
            if (!characterV1.companionData) characterV1.companionData = { type: null, form: null, name: '', creatureType: null };
            characterV1.companionData.creatureType = radio.value;
            saveCharacterV1(characterV1);
            renderV1CompanionPanel();
        });
    }
}
