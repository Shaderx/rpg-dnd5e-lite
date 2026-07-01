/**
 * D&D 5e Lite - Dice Module
 * Crypto-secure d20 rolling with inline display
 */

import { extensionSettings, pendingDiceRoll, setPendingDiceRoll, setLastNonCombatRoll } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { MODIFIER_DEFS } from './modifiers.js';

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

function rollCombatDamageDice() {
    const dice = {};
    for (const s of COMBAT_DAMAGE_SIDES) dice[`d${s}`] = secureRoll(s);
    return dice;
}

/**
 * Roll d20 sets: 2 player + 2×N ally + 2×N enemy for advantage/disadvantage checks.
 * Each ally/enemy also gets a pre-rolled d4-d12 set for combat damage/skill use.
 * Ally count is driven by extensionSettings.allyCount (default 1).
 * Once rolled, the roll button is locked until cleared (by user or LLM reply).
 */
export function rollD20() {
    if (extensionSettings.lastDiceRoll) return null;

    const allyCount = Math.max(0, extensionSettings.allyCount ?? 1);
    const enemyCount = Math.max(0, extensionSettings.enemyCount ?? 1);
    const r1 = secureRoll(20);
    const r2 = secureRoll(20);
    const allyRolls = [];
    for (let i = 0; i < allyCount; i++) {
        allyRolls.push({ roll1: secureRoll(20), roll2: secureRoll(20), dmg: rollCombatDamageDice() });
    }
    const enemyRolls = [];
    for (let i = 0; i < enemyCount; i++) {
        enemyRolls.push({ roll1: secureRoll(20), roll2: secureRoll(20), dmg: rollCombatDamageDice() });
    }

    const totalDice = 2 + allyCount * 2 + enemyCount * 2;
    const allRolls = [r1, r2, ...allyRolls.flatMap(a => [a.roll1, a.roll2]), ...enemyRolls.flatMap(e => [e.roll1, e.roll2])];
    const rollData = {
        formula: `${totalDice}d20`,
        roll1: r1,
        roll2: r2,
        allyRolls,
        allyRoll1: allyRolls[0]?.roll1 ?? null,
        allyRoll2: allyRolls[0]?.roll2 ?? null,
        enemyRolls,
        npcRoll1: enemyRolls[0]?.roll1 ?? null,
        npcRoll2: enemyRolls[0]?.roll2 ?? null,
        rolls: allRolls,
        timestamp: Date.now()
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
    const $val1 = $('#dnd-roll-value-1');
    const $val2 = $('#dnd-roll-value-2');
    const $allyContainer = $('#dnd-roll-ally-groups');
    const $enemyContainer = $('#dnd-roll-enemy-groups');
    const $rollBtn = $('#dnd-roll-btn');

    if (roll) {
        $val1.text(`${roll.roll1}`).attr('title', `Player 1st: ${roll.roll1}`);
        $val2.text(`${roll.roll2}`).attr('title', `Player 2nd: ${roll.roll2}`);

        const allies = roll.allyRolls ?? (roll.allyRoll1 != null
            ? [{ roll1: roll.allyRoll1, roll2: roll.allyRoll2 }] : []);
        let allyHtml = '';
        for (let i = 0; i < allies.length; i++) {
            const a = allies[i];
            const label = allies.length === 1 ? 'Ally' : `A${i + 1}`;
            const diceTip = a.dmg ? `\nDice: ${formatDiceSetTooltip(a.dmg)}` : '';
            allyHtml += `<div class="dnd-roll-chip dnd-roll-chip-ally" title="${label}: d20 ${a.roll1} / ${a.roll2}${diceTip}">`
                + `<span class="dnd-roll-chip-label">${label}</span>`
                + `<span class="dnd-roll-chip-val">${a.roll1}</span>`
                + `<span class="dnd-roll-chip-sep">/</span>`
                + `<span class="dnd-roll-chip-val">${a.roll2}</span>`
                + `</div>`;
        }
        $allyContainer.html(allyHtml);

        const enemies = roll.enemyRolls ?? (roll.npcRoll1 != null
            ? [{ roll1: roll.npcRoll1, roll2: roll.npcRoll2 }] : []);
        let enemyHtml = '';
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const label = enemies.length === 1 ? 'Foe' : `F${i + 1}`;
            const diceTip = e.dmg ? `\nDice: ${formatDiceSetTooltip(e.dmg)}` : '';
            enemyHtml += `<div class="dnd-roll-chip dnd-roll-chip-enemy" title="${label}: d20 ${e.roll1} / ${e.roll2}${diceTip}">`
                + `<span class="dnd-roll-chip-label">${label}</span>`
                + `<span class="dnd-roll-chip-val">${e.roll1}</span>`
                + `<span class="dnd-roll-chip-sep">/</span>`
                + `<span class="dnd-roll-chip-val">${e.roll2}</span>`
                + `</div>`;
        }
        $enemyContainer.html(enemyHtml);

        $result.show();
        $rollBtn.prop('disabled', true).addClass('dnd-roll-locked');
    } else {
        $result.hide();
        $val1.text('');
        $val2.text('');
        $allyContainer.empty();
        $enemyContainer.empty();
        $rollBtn.prop('disabled', false).removeClass('dnd-roll-locked');
    }

    updateAllyCountLabel();
    updateEnemyCountLabel();
    updateModifierDisplay();
}

/**
 * Update the ally count label text to reflect current setting.
 */
export function updateAllyCountLabel() {
    const count = extensionSettings.allyCount ?? 1;
    $('#dnd-ally-count-val').text(count);
}

export function updateEnemyCountLabel() {
    const count = extensionSettings.enemyCount ?? 1;
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
        + `</span>`;
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
                + `</span>`;
        }
        $results.html(html).show();
    } else {
        $results.empty().hide();
    }
}

