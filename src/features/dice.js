/**
 * D&D 5e Lite - Dice Module
 * Crypto-secure d20 rolling with inline display
 */

import { extensionSettings, pendingDiceRoll, setPendingDiceRoll } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';

/**
 * Secure random roll using crypto.getRandomValues() with rejection sampling.
 */
function secureRoll(sides) {
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

/**
 * Roll 6d20 (2 player + 2 ally + 2 enemy for advantage/disadvantage checks), store as pending, and save to settings.
 */
export function rollD20() {
    const r1 = secureRoll(20);
    const r2 = secureRoll(20);
    const ally1 = secureRoll(20);
    const ally2 = secureRoll(20);
    const npc1 = secureRoll(20);
    const npc2 = secureRoll(20);
    const rollData = {
        formula: '6d20',
        roll1: r1,
        roll2: r2,
        allyRoll1: ally1,
        allyRoll2: ally2,
        npcRoll1: npc1,
        npcRoll2: npc2,
        rolls: [r1, r2, ally1, ally2, npc1, npc2],
        timestamp: Date.now()
    };
    setPendingDiceRoll(rollData);
    extensionSettings.lastDiceRoll = { ...rollData };
    extensionSettings.lastFavoredRoll = null;

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
 * Update the inline dice display in the expanded panel (player + ally + enemy rolls).
 */
export function updateDiceDisplay() {
    const roll = extensionSettings.lastDiceRoll;
    const $result = $('#dnd-roll-result');
    const $val1 = $('#dnd-roll-value-1');
    const $val2 = $('#dnd-roll-value-2');
    const $ally1 = $('#dnd-roll-ally-1');
    const $ally2 = $('#dnd-roll-ally-2');
    const $npc1 = $('#dnd-roll-npc-1');
    const $npc2 = $('#dnd-roll-npc-2');

    if (roll) {
        $val1.text(`${roll.roll1}`).attr('title', `Player 1st: ${roll.roll1}`);
        $val2.text(`${roll.roll2}`).attr('title', `Player 2nd: ${roll.roll2}`);
        $ally1.text(`${roll.allyRoll1 ?? '--'}`).attr('title', `Ally 1st: ${roll.allyRoll1 ?? '--'}`);
        $ally2.text(`${roll.allyRoll2 ?? '--'}`).attr('title', `Ally 2nd: ${roll.allyRoll2 ?? '--'}`);
        $npc1.text(`${roll.npcRoll1 ?? '--'}`).attr('title', `Enemy 1st: ${roll.npcRoll1 ?? '--'}`);
        $npc2.text(`${roll.npcRoll2 ?? '--'}`).attr('title', `Enemy 2nd: ${roll.npcRoll2 ?? '--'}`);
        $result.show();
    } else {
        $result.hide();
        $val1.text('');
        $val2.text('');
        $ally1.text('');
        $ally2.text('');
        $npc1.text('');
        $npc2.text('');
    }

    updateFavoredDisplay();
}

/**
 * Clear the last dice roll.
 */
export function clearDiceRoll() {
    extensionSettings.lastDiceRoll = null;
    extensionSettings.lastFavoredRoll = null;
    setPendingDiceRoll(null);
    saveSettings();
    updateDiceDisplay();
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
 * Add a single damage die, accumulating with any previous dice.
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


function dieChipHtml(sides, result) {
    const opacity = rollBrightness(result, sides).toFixed(2);
    return `<span class="dnd-damage-chip" data-sides="${sides}" title="d${sides}">`
        + `<span class="dnd-damage-chip-val" style="opacity:${opacity}">${result}</span>`
        + `<span class="dnd-damage-chip-die">d${sides}</span>`
        + `</span>`;
}

/**
 * Update the inline damage display in the expanded panel.
 * Renders individual dice as compact chips — no sum, since each die may
 * serve a different purpose (damage, save penalty, healing, etc.).
 */
export function updateDamageDisplay() {
    const roll = extensionSettings.lastDamageRoll;
    const $result = $('#dnd-damage-result');
    if (!$result.length) return;

    const dice = roll?.dice;
    if (dice && dice.length > 0) {
        $('#dnd-damage-dice').html(dice.map(d => dieChipHtml(d.sides, d.result)).join(''));
        $result.show();
    } else if (roll?.rolls) {
        const s = roll.sides || 6;
        $('#dnd-damage-dice').html(roll.rolls.map(r => dieChipHtml(s, r)).join(''));
        $result.show();
    } else {
        $result.hide();
    }
}

/**
 * Clear the last damage roll.
 */
export function clearDamageRoll() {
    extensionSettings.lastDamageRoll = null;
    saveSettings();
    updateDamageDisplay();
}

/**
 * Roll Favored by the Gods (2d4). Only works when a d20 roll is active.
 */
export function rollFavored() {
    if (!extensionSettings.lastDiceRoll) return;
    const { rolls, total } = executeRoll(2, 4);
    extensionSettings.lastFavoredRoll = { formula: '2d4', rolls, total, timestamp: Date.now() };
    saveSettings();
    updateFavoredDisplay();
}

/**
 * Update the Favored by the Gods inline roll display.
 */
export function updateFavoredDisplay() {
    const roll = extensionSettings.lastFavoredRoll;
    const hasD20 = !!extensionSettings.lastDiceRoll;
    const $btn = $('#dnd-favored-btn');
    const $result = $('#dnd-favored-result');

    if (hasD20 && !roll) {
        $btn.prop('disabled', false).removeClass('dnd-favored-used');
    } else if (roll) {
        $btn.prop('disabled', true).addClass('dnd-favored-used');
    } else {
        $btn.prop('disabled', true).removeClass('dnd-favored-used');
    }

    if (roll) {
        $('#dnd-favored-rolls').text(roll.rolls.join(' + '));
        $('#dnd-favored-total').text(`= +${roll.total}`);
        $result.show();
    } else {
        $result.hide();
    }
}

