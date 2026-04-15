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
 * Roll a d20, store as pending, and save to settings.
 */
export function rollD20() {
    const result = executeRoll(1, 20);
    const rollData = {
        formula: '1d20',
        total: result.total,
        rolls: result.rolls,
        timestamp: Date.now()
    };
    setPendingDiceRoll(rollData);
    extensionSettings.lastDiceRoll = { ...rollData };
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
 * Update the inline dice display in the expanded panel.
 */
export function updateDiceDisplay() {
    const roll = extensionSettings.lastDiceRoll;
    const $result = $('#dnd-roll-result');
    const $value = $('#dnd-roll-value');

    if (roll) {
        $value.text(`${roll.total}`).attr('title', `${roll.formula}: ${roll.total}`);
        $result.show();
    } else {
        $result.hide();
        $value.text('');
    }
}

/**
 * Clear the last dice roll.
 */
export function clearDiceRoll() {
    extensionSettings.lastDiceRoll = null;
    setPendingDiceRoll(null);
    saveSettings();
    updateDiceDisplay();
}

