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
 * Roll 4d20 (2 player + 2 NPC for advantage/disadvantage checks), store as pending, and save to settings.
 */
export function rollD20() {
    const r1 = secureRoll(20);
    const r2 = secureRoll(20);
    const npc1 = secureRoll(20);
    const npc2 = secureRoll(20);
    const rollData = {
        formula: '4d20',
        roll1: r1,
        roll2: r2,
        npcRoll1: npc1,
        npcRoll2: npc2,
        rolls: [r1, r2, npc1, npc2],
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
 * Update the inline dice display in the expanded panel (player + NPC rolls).
 */
export function updateDiceDisplay() {
    const roll = extensionSettings.lastDiceRoll;
    const $result = $('#dnd-roll-result');
    const $val1 = $('#dnd-roll-value-1');
    const $val2 = $('#dnd-roll-value-2');
    const $npc1 = $('#dnd-roll-npc-1');
    const $npc2 = $('#dnd-roll-npc-2');

    if (roll) {
        $val1.text(`${roll.roll1}`).attr('title', `Player 1st: ${roll.roll1}`);
        $val2.text(`${roll.roll2}`).attr('title', `Player 2nd: ${roll.roll2}`);
        $npc1.text(`${roll.npcRoll1 ?? '--'}`).attr('title', `NPC 1st: ${roll.npcRoll1 ?? '--'}`);
        $npc2.text(`${roll.npcRoll2 ?? '--'}`).attr('title', `NPC 2nd: ${roll.npcRoll2 ?? '--'}`);
        $result.show();
    } else {
        $result.hide();
        $val1.text('');
        $val2.text('');
        $npc1.text('');
        $npc2.text('');
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

