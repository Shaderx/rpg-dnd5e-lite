/**
 * D&D 5e Lite - Dice Module
 * Crypto-secure d20 rolling with inline display
 */

import { extensionSettings, pendingDiceRoll, setPendingDiceRoll, setLastNonCombatRoll, sidekicks } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { MODIFIER_DEFS } from './modifiers.js';
import { computeSidekickStats, getSidekickLevel, lookupSpellByName } from './sidekick.js';
import {
    allocateUniqueCreatureKeys,
    buildCompanionRollSpec,
    buildSidekickRollSpec,
    COMPANION_DIE_SIDES,
} from './companionDice.js';
import { v2Companions } from '../v2/core/state.js';
import { getComputedStats as getV2CompanionStats } from '../v2/features/companion.js';
import { characterV1 } from '../v1/core/state.js';
import { computeCharacterStats as computeV1CharacterStats } from '../v1/features/character.js';
import { characterV2 } from '../v2/core/characterState.js';
import { computeV2CharacterStats } from '../v2/features/character.js';

/**
 * Secure random roll using crypto.getRandomValues() with rejection sampling.
 */
export function secureRoll(sides) {
    const array = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / sides) * sides;
    let val;
    do {
        crypto.getRandomValues(array);
        val = array[0];
    } while (val >= limit);
    return (val % sides) + 1;
}

/**
 * Execute a dice roll.
 * @returns {{ total: number, rolls: number[] }}
 */
export function executeRoll(count, sides) {
    const rolls = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const roll = secureRoll(sides);
        rolls.push(roll);
        total += roll;
    }
    return { total, rolls };
}

export const COMBAT_DAMAGE_SIDES = [4, 6, 8, 10, 12];

export function formatDiceSetTooltip(diceSet) {
    if (!diceSet) return '';
    return COMBAT_DAMAGE_SIDES.map(s => `d${s}:${diceSet[`d${s}`]}`).join(' ');
}

export function formatCompanionDiceTooltip(diceSet) {
    if (!diceSet) return '';
    return COMPANION_DIE_SIDES.flatMap(side => {
        const values = diceSet[`d${side}`];
        if (!Array.isArray(values) || values.length === 0) return [];
        return [`d${side}:${values.join(',')}`];
    }).join(' ');
}

export function formatCompanionDiceSummary(diceSet) {
    if (!diceSet) return '';
    return COMPANION_DIE_SIDES.flatMap(side => {
        const values = diceSet[`d${side}`];
        if (!Array.isArray(values) || values.length === 0) return [];
        return [`${values.length}d${side}`];
    }).join(' + ');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderCompanionDiceInline(diceSet, maxVisibleValues = 4) {
    if (!diceSet) return '';
    return COMPANION_DIE_SIDES.flatMap(side => {
        const values = diceSet[`d${side}`];
        if (!Array.isArray(values) || values.length === 0) return [];
        const visible = values.slice(0, maxVisibleValues).map(escapeHtml).join('·');
        const remainder = values.length - maxVisibleValues;
        return ['<span class="dnd-companion-die">'
            + `<span class="dnd-companion-die-label">d${side}</span>`
            + `<span class="dnd-companion-die-values">${visible}${remainder > 0 ? `<span class="dnd-companion-die-more">+${remainder}</span>` : ''}</span>`
            + '</span>'];
    }).join('');
}

function rollCombatDamageDice() {
    const dice = {};
    for (const s of COMBAT_DAMAGE_SIDES) dice[`d${s}`] = secureRoll(s);
    return dice;
}

function rollProfile(profile) {
    const rolled = {};
    for (const side of COMPANION_DIE_SIDES) {
        const key = `d${side}`;
        const count = Math.max(0, Number(profile?.[key]) || 0);
        if (count > 0) rolled[key] = Array.from({ length: count }, () => secureRoll(side));
    }
    return rolled;
}

function resolveCharacterBoundCompanion(enabledCards = []) {
    const mode = extensionSettings.mode;
    const char = mode === 'v2' ? characterV2 : mode === 'v1' ? characterV1 : null;
    if (!char) return null;
    const stats = mode === 'v2' ? computeV2CharacterStats(char) : computeV1CharacterStats(char);
    const selected = stats?.companionData?.type === 'familiar' ? stats.familiarStats
        : stats?.companionData?.type === 'primal' ? stats.companion
            : null;
    if (!selected) return null;
    const name = stats.companionData?.name || selected.customName || selected.name || selected.label || 'Companion';
    const normalizedName = name.trim().toLowerCase();
    const boundType = stats.companionData?.type;
    const boundForm = stats.companionData?.form;
    const represented = enabledCards.some(card => !card.owner && (
        String(card.name || '').trim().toLowerCase() === normalizedName
        || (card.category === boundType && card.creatureSource === boundForm)
    ));
    if (represented) return null;
    return buildCompanionRollSpec(
        { ...selected, id: `character-${mode}-companion`, name, actions: selected.actions, traits: selected.traits },
        selected,
        {
            entityId: `character-${mode}-companion`,
            source: 'character-companion',
            bestialFury: stats.companionData?.type === 'primal' && Number(char.level) >= 11,
        },
    );
}

/** Resolve the active roster at button-press time. */
export function resolveActiveCompanionRollSpecs() {
    const specs = [];
    const sidekickLevel = getSidekickLevel();
    for (const sidekick of sidekicks || []) {
        if (!sidekick?.enabled) continue;
        specs.push(buildSidekickRollSpec(
            sidekick,
            computeSidekickStats(sidekick, sidekickLevel),
            sidekickLevel,
            lookupSpellByName,
        ));
    }

    // V2 companion cards are a shared active roster and are loaded/injected in
    // every mode, even though their editor is part of the V2 companion system.
    const enabledCards = (v2Companions || []).filter(companion => companion?.enabled);
    for (const companion of enabledCards) {
        specs.push(buildCompanionRollSpec(companion, getV2CompanionStats(companion), {
            source: 'v2-companion',
            bestialFury: companion.category === 'primal' && Number(companion.scalingLevel) >= 11,
        }));
    }

    const bound = resolveCharacterBoundCompanion(enabledCards);
    if (bound) specs.push(bound);
    return allocateUniqueCreatureKeys(specs);
}

function rollCompanionSpec(spec) {
    const { setProfiles, ...snapshot } = spec;
    return {
        ...snapshot,
        sets: setProfiles.map((profile, index) => ({
            index: index + 1,
            roll1: secureRoll(20),
            roll2: secureRoll(20),
            dice: rollProfile(profile),
        })),
        spellDice: (spec.spellDice || []).map(spell => ({ ...spell, dice: rollProfile(spell.dice) })),
    };
}

/**
 * Roll d20 sets: 2×N player + 2×N ally + 2×N enemy for advantage/disadvantage checks.
 * Each ally/enemy also gets a pre-rolled d4-d12 set for combat damage/skill use.
 * Player count is driven by extensionSettings.playerCount (default 1).
 * Ally count is driven by extensionSettings.allyCount (default 1).
 * Once rolled, the roll button is locked until cleared (by user or LLM reply).
 */
export function rollD20() {
    if (extensionSettings.lastDiceRoll) return null;

    const playerCount = Math.min(4, Math.max(1, extensionSettings.playerCount ?? 1));
    const allyCount = Math.min(8, Math.max(0, extensionSettings.allyCount ?? 1));
    const enemyCount = Math.min(16, Math.max(0, extensionSettings.enemyCount ?? 1));
    const userRolls = [];
    for (let i = 0; i < playerCount; i++) {
        userRolls.push({ roll1: secureRoll(20), roll2: secureRoll(20) });
    }
    const allyRolls = [];
    for (let i = 0; i < allyCount; i++) {
        allyRolls.push({ roll1: secureRoll(20), roll2: secureRoll(20), dmg: rollCombatDamageDice() });
    }
    const enemyRolls = [];
    for (let i = 0; i < enemyCount; i++) {
        enemyRolls.push({ roll1: secureRoll(20), roll2: secureRoll(20), dmg: rollCombatDamageDice() });
    }

    const companionRolls = resolveActiveCompanionRollSpecs().map(rollCompanionSpec);

    const companionD20Count = companionRolls.reduce((sum, companion) => sum + companion.sets.length * 2, 0);
    const totalDice = playerCount * 2 + allyCount * 2 + enemyCount * 2 + companionD20Count;
    const allRolls = [
        ...userRolls.flatMap(u => [u.roll1, u.roll2]),
        ...allyRolls.flatMap(a => [a.roll1, a.roll2]),
        ...companionRolls.flatMap(companion => companion.sets.flatMap(set => [set.roll1, set.roll2])),
        ...enemyRolls.flatMap(e => [e.roll1, e.roll2]),
    ];
    const rollData = {
        formula: `${totalDice}d20`,
        userRolls,
        roll1: userRolls[0]?.roll1 ?? null,
        roll2: userRolls[0]?.roll2 ?? null,
        allyRolls,
        allyRoll1: allyRolls[0]?.roll1 ?? null,
        allyRoll2: allyRolls[0]?.roll2 ?? null,
        companionRolls,
        enemyRolls,
        npcRoll1: enemyRolls[0]?.roll1 ?? null,
        npcRoll2: enemyRolls[0]?.roll2 ?? null,
        rolls: allRolls,
        timestamp: Date.now(),
    };
    setPendingDiceRoll(rollData);
    extensionSettings.lastDiceRoll = { ...rollData };
    setLastNonCombatRoll(null);

    saveSettings();
    updateDiceDisplay();
    return rollData;
}

/**
 * Save the pending dice roll to settings.
 */
export function saveDiceRoll() {
    if (pendingDiceRoll) {
        extensionSettings.lastDiceRoll = { ...pendingDiceRoll };
        saveSettings();
        updateDiceDisplay();
    }
}

/**
 * Update the inline dice display in the expanded panel (player + N allies + enemy rolls).
 * Ally groups are built dynamically from roll.allyRolls[].
 * Also locks/unlocks the roll button based on whether a roll is active.
 */
export function updateDiceDisplay() {
    const roll = extensionSettings.lastDiceRoll;
    const $result = $('#dnd-roll-result');
    const $userContainer = $('#dnd-roll-user-groups');
    const $allyContainer = $('#dnd-roll-ally-groups');
    const $companionSection = $('#dnd-companion-roll-section');
    const $companionContainer = $('#dnd-roll-companion-groups');
    const $companionCount = $('#dnd-companion-roll-count');
    const $enemyContainer = $('#dnd-roll-enemy-groups');
    const $rollBtn = $('#dnd-roll-btn');

    if (roll) {
        const users = roll.userRolls ?? (roll.roll1 != null
            ? [{ roll1: roll.roll1, roll2: roll.roll2 }] : []);
        const userCols = users.length <= 1 ? 1 : 2;
        $userContainer.css('--dnd-user-roll-cols', String(userCols));
        $userContainer.show();
        let userHtml = '';
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            const label = users.length === 1 ? 'You' : `U${i + 1}`;
            userHtml += `<div class="dnd-roll-chip dnd-roll-chip-user" title="${label}: d20 ${u.roll1} / ${u.roll2}">`
                + `<span class="dnd-roll-chip-val">${u.roll1}</span>`
                + '<span class="dnd-roll-chip-sep">/</span>'
                + `<span class="dnd-roll-chip-val">${u.roll2}</span>`
                + '</div>';
        }
        $userContainer.html(userHtml);

        const allies = roll.allyRolls ?? (roll.allyRoll1 != null
            ? [{ roll1: roll.allyRoll1, roll2: roll.allyRoll2 }] : []);
        const allyCols = Math.max(1, Math.min(2, allies.length || 1));
        $allyContainer.css('--dnd-ally-roll-cols', String(allyCols));
        let allyHtml = '';
        for (let i = 0; i < allies.length; i++) {
            const a = allies[i];
            const label = allies.length === 1 ? 'Ally' : `Ally ${i + 1}`;
            const diceTip = a.dmg ? `\nDice: ${formatDiceSetTooltip(a.dmg)}` : '';
            allyHtml += `<div class="dnd-roll-chip dnd-roll-chip-ally" title="${label}: d20 ${a.roll1} / ${a.roll2}${diceTip}">`
                + `<span class="dnd-roll-chip-val">${a.roll1}</span>`
                + '<span class="dnd-roll-chip-sep">/</span>'
                + `<span class="dnd-roll-chip-val">${a.roll2}</span>`
                + '</div>';
        }
        $allyContainer.html(allyHtml);
        $allyContainer.toggle(allies.length > 0);

        const companions = Array.isArray(roll.companionRolls) ? roll.companionRolls : [];
        let companionHtml = '';
        let companionResultCount = 0;
        const companionColumns = ['', ''];
        const companionColumnWeights = [0, 0];
        for (const companion of companions) {
            const setCount = companion.sets?.length || 0;
            const spells = companion.spellDice || [];
            if (setCount === 0 && spells.length === 0) continue;

            companionResultCount += setCount + spells.length;
            let companionCardHtml = '<div class="dnd-companion-party">'
                + `<div class="dnd-companion-identity" aria-label="${escapeHtml(companion.name)}">`
                + `<span class="dnd-companion-avatar" aria-hidden="true" title="${escapeHtml(companion.name)}">`
                + escapeHtml(companion.name?.trim()?.charAt(0)?.toUpperCase() || '?')
                + '</span>'
                + '</div>'
                + '<div class="dnd-companion-results">';

            for (let i = 0; i < setCount; i++) {
                const set = companion.sets[i];
                const label = setCount === 1 ? companion.name : `${companion.name} ${i + 1}/${setCount}`;
                const diceTip = formatCompanionDiceTooltip(set.dice);
                const diceInline = renderCompanionDiceInline(set.dice);
                const roll1Class = set.roll1 === 20 ? ' is-natural-20' : set.roll1 === 1 ? ' is-natural-1' : '';
                const roll2Class = set.roll2 === 20 ? ' is-natural-20' : set.roll2 === 1 ? ' is-natural-1' : '';
                companionCardHtml += `<div class="dnd-companion-result" title="${escapeHtml(label)}: d20 ${set.roll1} / ${set.roll2}${diceTip ? `&#10;Dice: ${escapeHtml(diceTip)}` : ''}">`
                    + '<span class="dnd-companion-d20">'
                    + (setCount > 1 ? `<span class="dnd-companion-set">${i + 1}</span>` : '')
                    + `<span class="dnd-roll-chip-val${roll1Class}">${set.roll1}</span>`
                    + '<span class="dnd-roll-chip-sep">/</span>'
                    + `<span class="dnd-roll-chip-val${roll2Class}">${set.roll2}</span>`
                    + '</span>'
                    + (diceInline ? `<span class="dnd-companion-side-dice">${diceInline}</span>` : '')
                    + '</div>';
            }
            for (const spell of spells) {
                const diceTip = formatCompanionDiceTooltip(spell.dice);
                const diceSummary = formatCompanionDiceSummary(spell.dice);
                const diceInline = renderCompanionDiceInline(spell.dice, 3);
                companionCardHtml += `<div class="dnd-companion-result dnd-companion-spell" title="${escapeHtml(companion.name)} — ${escapeHtml(spell.name)}${diceTip ? `&#10;Dice: ${escapeHtml(diceTip)}` : ''}">`
                    + `<span class="dnd-companion-spell-name">${escapeHtml(spell.name)}</span>`
                    + `<span class="dnd-roll-chip-dice">${escapeHtml(diceSummary)}</span>`
                    + (diceInline ? `<span class="dnd-companion-side-dice">${diceInline}</span>` : '')
                    + '</div>';
            }
            companionCardHtml += '</div></div>';
            const columnIndex = companionColumnWeights[0] <= companionColumnWeights[1] ? 0 : 1;
            companionColumns[columnIndex] += companionCardHtml;
            companionColumnWeights[columnIndex] += Math.max(1, setCount + spells.length);
        }
        companionHtml = companionColumns
            .filter(Boolean)
            .map(columnHtml => `<div class="dnd-companion-column">${columnHtml}</div>`)
            .join('');
        $companionContainer.html(companionHtml);
        $companionCount.text(companionResultCount === 1 ? '1 result' : `${companionResultCount} results`);
        $companionSection.toggle(companionHtml.length > 0);

        const enemies = roll.enemyRolls ?? (roll.npcRoll1 != null
            ? [{ roll1: roll.npcRoll1, roll2: roll.npcRoll2 }] : []);
        const enemyCols = Math.max(1, Math.min(4, enemies.length || 1));
        $enemyContainer.css('--dnd-enemy-roll-cols', String(enemyCols));
        let enemyHtml = '';
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const label = enemies.length === 1 ? 'Foe' : `F${i + 1}`;
            const diceTip = e.dmg ? `\nDice: ${formatDiceSetTooltip(e.dmg)}` : '';
            enemyHtml += `<div class="dnd-roll-chip dnd-roll-chip-enemy" title="${label}: d20 ${e.roll1} / ${e.roll2}${diceTip}">`
                + `<span class="dnd-roll-chip-val">${e.roll1}</span>`
                + '<span class="dnd-roll-chip-sep">/</span>'
                + `<span class="dnd-roll-chip-val">${e.roll2}</span>`
                + '</div>';
        }
        $enemyContainer.html(enemyHtml);
        $enemyContainer.toggle(enemies.length > 0);

        $result.show();
        $rollBtn.addClass('dnd-roll-locked');
    } else {
        $result.hide();
        $userContainer.css('--dnd-user-roll-cols', '1');
        $userContainer.hide();
        $userContainer.empty();
        $allyContainer.hide();
        $allyContainer.empty();
        $companionSection.hide();
        $companionContainer.empty();
        $enemyContainer.hide();
        $enemyContainer.empty();
        $rollBtn.removeClass('dnd-roll-locked');
    }

    updatePlayerCountLabel();
    updateAllyCountLabel();
    updateEnemyCountLabel();
    updateModifierDisplay();
}

export function updatePlayerCountLabel() {
    const count = Math.min(4, Math.max(1, extensionSettings.playerCount ?? 1));
    $('#dnd-player-count-val').text(count);
}

/**
 * Update the ally count label text to reflect current setting.
 */
export function updateAllyCountLabel() {
    const count = Math.min(8, Math.max(0, extensionSettings.allyCount ?? 1));
    $('#dnd-ally-count-val').text(count);
}

export function updateEnemyCountLabel() {
    const count = Math.min(16, Math.max(0, extensionSettings.enemyCount ?? 1));
    $('#dnd-enemy-count-val').text(count);
}

/**
 * Clear the last dice roll.
 */
export function clearDiceRoll() {
    extensionSettings.lastDiceRoll = null;
    extensionSettings.lastModifierRolls = {};
    setPendingDiceRoll(null);
    saveSettings();
    updateDiceDisplay();
    updateModifierDisplay();
}

/**
 * Build a formula string from an array of individual dice, e.g. "2d8 + 1d6".
 */
function buildDamageFormula(dice) {
    const counts = {};
    for (const d of dice) {
        counts[d.sides] = (counts[d.sides] || 0) + 1;
    }
    return Object.entries(counts)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([sides, count]) => `${count}d${sides}`)
        .join(' + ');
}

/**
 * Add a single pool die, accumulating with any previous dice.
 * Supports mixing different die types (e.g. d8 + d8 + d6).
 */
export function addDamageDie(sides) {
    const result = secureRoll(sides);
    let roll = extensionSettings.lastDamageRoll;
    if (!roll || !Array.isArray(roll.dice)) {
        roll = { dice: [], total: 0, timestamp: Date.now() };
    }
    roll.dice.push({ sides, result });
    roll.total += result;
    roll.timestamp = Date.now();
    roll.formula = buildDamageFormula(roll.dice);
    roll.rolls = roll.dice.map(d => d.result);
    extensionSettings.lastDamageRoll = roll;
    saveSettings();
    updateDamageDisplay();
    return roll;
}

/**
 * Compute opacity for a die result: dim at min (1), vivid at max.
 */
function rollBrightness(result, sides) {
    if (sides <= 1) return 1;
    const ratio = (result - 1) / (sides - 1);
    return 0.4 + ratio * 0.6;
}


function dieChipHtml(sides, result, index) {
    const opacity = rollBrightness(result, sides).toFixed(2);
    return `<span class="dnd-pool-dice-chip" data-sides="${sides}" data-index="${index}" title="d${sides} — click to remove" role="button" tabindex="0">`
        + `<span class="dnd-pool-dice-chip-val" style="opacity:${opacity}">${result}</span>`
        + `<span class="dnd-pool-dice-chip-die">d${sides}</span>`
        + '</span>';
}

function normalizeDamageRoll(roll) {
    if (!roll) return roll;
    if (!Array.isArray(roll.dice) && Array.isArray(roll.rolls)) {
        const sides = roll.sides || 6;
        roll.dice = roll.rolls.map(r => ({ sides, result: r }));
    }
    return roll;
}

/**
 * Remove a single pool die by index from the accumulated pool.
 */
export function removeDamageDie(index) {
    const roll = extensionSettings.lastDamageRoll;
    if (!roll) return null;

    normalizeDamageRoll(roll);
    if (!Array.isArray(roll.dice) || index < 0 || index >= roll.dice.length) return null;

    const removed = roll.dice.splice(index, 1)[0];
    if (roll.dice.length === 0) {
        extensionSettings.lastDamageRoll = null;
    } else {
        roll.total = roll.dice.reduce((sum, d) => sum + d.result, 0);
        roll.formula = buildDamageFormula(roll.dice);
        roll.rolls = roll.dice.map(d => d.result);
        roll.timestamp = Date.now();
        extensionSettings.lastDamageRoll = roll;
    }

    saveSettings();
    updateDamageDisplay();
    return removed;
}

/**
 * Update the inline pool dice display in the expanded panel.
 * Renders individual dice as compact chips — no sum, since each die may
 * serve a different purpose (damage, healing, save penalty, etc.).
 */
export function updateDamageDisplay() {
    const roll = extensionSettings.lastDamageRoll;
    const $result = $('#dnd-pool-dice-result');
    if (!$result.length) return;

    normalizeDamageRoll(roll);
    const dice = roll?.dice;
    if (dice && dice.length > 0) {
        $('#dnd-pool-dice-chips').html(dice.map((d, i) => dieChipHtml(d.sides, d.result, i)).join(''));
        $result.show();
    } else {
        $result.hide();
    }
}

/**
 * Clear the pool dice roll.
 */
export function clearDamageRoll() {
    extensionSettings.lastDamageRoll = null;
    saveSettings();
    updateDamageDisplay();
}

/**
 * Toggle a modifier on/off. Toggling on rolls immediately; toggling off clears it.
 */
export function toggleModifier(modId) {
    const mods = extensionSettings.lastModifierRolls || {};
    if (mods[modId]) {
        delete mods[modId];
    } else {
        const def = MODIFIER_DEFS.find(m => m.id === modId);
        if (!def) return;
        const { rolls, total } = executeRoll(def.count, def.sides);
        mods[modId] = { rolls, total, formula: `${def.count}d${def.sides}` };
    }
    extensionSettings.lastModifierRolls = mods;
    saveSettings();
    updateModifierDisplay();
}

/**
 * Clear all modifier rolls.
 */
export function clearModifiers() {
    extensionSettings.lastModifierRolls = {};
    saveSettings();
    updateModifierDisplay();
}

/**
 * Build modifier toggle buttons from MODIFIER_DEFS into the container.
 * Call once at init; buttons are then updated via updateModifierDisplay().
 */
export function renderModifierButtons() {
    const $container = $('#dnd-modifier-toggles');
    if (!$container.length) return;
    const html = MODIFIER_DEFS.map(def => {
        const tooltip = def.prompt.replace(/\{user\}/g, 'You');
        return `<button class="dnd-mod-btn" data-mod="${def.id}" title="${tooltip}">`
            + `<i class="fa-solid ${def.icon}"></i> ${def.label}</button>`;
    }).join('');
    $container.html(html);
}

/**
 * Update modifier toggle button states and the results chip display.
 */
export function updateModifierDisplay() {
    const mods = extensionSettings.lastModifierRolls || {};

    $('.dnd-mod-btn').each(function () {
        const id = $(this).data('mod');
        $(this).toggleClass('dnd-mod-active', !!mods[id]);
    });

    const $results = $('#dnd-modifier-results');
    const activeIds = Object.keys(mods);

    if (activeIds.length > 0) {
        let html = '';
        for (const id of activeIds) {
            const def = MODIFIER_DEFS.find(m => m.id === id);
            const roll = mods[id];
            if (!def || !roll) continue;
            const valStr = roll.rolls.join('+');
            const totalStr = roll.rolls.length > 1 ? `=${roll.total}` : '';
            html += `<span class="dnd-mod-chip" data-mod="${id}" title="${def.prompt.replace(/\{user\}/g, 'You')}">`
                + `<span class="dnd-mod-chip-label">${def.label}</span>`
                + `<span class="dnd-mod-chip-val">${valStr}${totalStr}</span>`
                + '</span>';
        }
        $results.html(html).show();
    } else {
        $results.empty().hide();
    }
}
