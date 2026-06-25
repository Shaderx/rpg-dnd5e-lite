/**
 * V2 Prompt Builder
 * Enhanced quest/inventory sections with index numbering,
 * plus inline JSON game-actions instructions for the LLM.
 * Inventory items include type tags (armor/shield/weapon) for equipment tracking.
 */

import { v2Quests, v2Inventory, v2Companions } from '../core/state.js';
import { extensionSettings } from '../../core/state.js';
import { RARITY_LABELS, normalizeRarity } from '../../features/inventoryRarity.js';
import { getComputedStats, CATEGORY_META } from '../features/companion.js';

const PRIORITY_LABELS = { 1: 'Reminder', 2: 'Side Quest', 3: 'Main Quest' };

/**
 * Build the V2 <quests> section with index numbering and full quest details.
 * @returns {string} XML section or empty string
 */
export function buildV2QuestSection() {
    if (!v2Quests || v2Quests.length === 0) return '';

    const active = v2Quests.filter(q => q.status !== 'completed' && q.status !== 'failed');
    const done = v2Quests.filter(q => q.status === 'completed' || q.status === 'failed');

    if (active.length === 0 && done.length === 0) return '';

    const lines = ['<quests>'];
    let globalIdx = 1;

    if (active.length > 0) {
        for (const q of active) {
            const p = PRIORITY_LABELS[q.priority] || 'Reminder';
            const meta = [];
            if (q.giver) meta.push(q.giver);
            if (q.location) meta.push(q.location);
            const metaStr = meta.length > 0 ? ` (${meta.join(', ')})` : '';
            lines.push(`[#${globalIdx}] [${p}] ${q.title}${metaStr}`);

            if (q.description) lines.push(`  ${q.description}`);

            if (q.objectives?.length > 0) {
                for (let oi = 0; oi < q.objectives.length; oi++) {
                    const obj = q.objectives[oi];
                    lines.push(`  [#${oi + 1}] [${obj.completed ? 'x' : ' '}] ${obj.text}`);
                }
            }

            const rewards = [];
            if (!extensionSettings.milestoneXP && q.rewards?.xp) rewards.push(`${q.rewards.xp}XP`);
            if (q.rewards?.gold) rewards.push(`${q.rewards.gold}GP`);
            if (q.rewards?.items?.length > 0) rewards.push(...q.rewards.items);
            if (rewards.length > 0) lines.push(`  Reward: ${rewards.join(', ')}`);

            globalIdx++;
        }
    }

    if (done.length > 0) {
        lines.push('Resolved:');
        for (const q of done) {
            const p = PRIORITY_LABELS[q.priority] || 'Reminder';
            const tag = q.status === 'failed' ? 'FAILED' : 'done';
            lines.push(`[#${globalIdx}] [${p}] ${q.title} (${tag})`);
            globalIdx++;
        }
    }

    lines.push('</quests>');
    return lines.join('\n');
}

function formatItemLine(item, globalIdx) {
    const qty = `(x${item.quantity || 1})`;
    const r = normalizeRarity(item.rarity);
    const rTag = r >= 1 ? ` [${RARITY_LABELS[r]}]` : '';
    const typeTags = [];
    if (item.type && item.type !== 'none') typeTags.push(item.type);
    if (item.magic) typeTags.push('magic');
    if (item.charges !== null && item.charges !== undefined) typeTags.push(`charges:${item.charges}`);
    const typeStr = typeTags.length > 0 ? ` {${typeTags.join(', ')}}` : '';
    const notes = item.magicNotes ? ` (${item.magicNotes})` : '';
    return `  [#${globalIdx}] ${item.name} ${qty}${rTag}${typeStr}${notes}`;
}

/**
 * Build the V2 <inventory> section with index numbering.
 * Items include type annotations ({armor}, {weapon}, {shield}, {magic}).
 * @returns {string} XML section or empty string
 */
export function buildV2InventorySection() {
    const equipped = v2Inventory ? v2Inventory.filter(item => item.location === 'equipped') : [];
    const stored = v2Inventory ? v2Inventory.filter(item => item.location !== 'equipped') : [];

    if (equipped.length === 0 && stored.length === 0) return '';

    const lines = ['<inventory>'];
    let globalIdx = 1;

    if (equipped.length > 0) {
        lines.push('Equipped:');
        for (const item of equipped) {
            lines.push(formatItemLine(item, globalIdx++));
        }
    }

    if (stored.length > 0) {
        lines.push('Stored:');
        for (const item of stored) {
            lines.push(formatItemLine(item, globalIdx++));
        }
    }

    lines.push('</inventory>');
    return lines.join('\n');
}

/**
 * Build the <game_state_actions> instruction section.
 * Tells the LLM to output a JSON block at the end of its response
 * when quest/inventory changes occur, instead of using native tool calling.
 * @returns {string} XML section
 */
export function buildToolInstructionsSection() {
    const ms = extensionSettings.milestoneXP;
    const rewardsEx = ms
        ? '"rewards":{"gold":200,"items":["Manticore Hide"]}'
        : '"rewards":{"xp":500,"gold":200,"items":["Manticore Hide"]}';
    const msNote = ms ? '\n- Milestone campaign: no XP tracking.' : '';

    return `<game_state_actions>
When quest or inventory changes occur, output a JSON action block at the END of your response.
Format: <details><summary>game_actions</summary>[...actions...]</details>
Each object needs "tool" + "action". [#N] from lists above = "index" for existing entries.

== QUEST (tool:"quest") ==
Priority levels: 1=Reminder, 2=Side Quest, 3=Main Quest

add: create a new quest:
  {"tool":"quest","action":"add","title":"Slay the Manticore","priority":3,"giver":"Liora","location":"Northern Wastes","description":"Hunt the beast","objectives":[{"text":"Travel north"},{"text":"Find lair"}],${rewardsEx}}
  Required: title
  Optional: priority (default 1), giver, location, description, objectives[{text,completed}], ${ms ? 'rewards{gold,items}' : 'rewards{xp,gold,items}'}

update: modify fields on an existing quest:
  {"tool":"quest","action":"update","index":1,"description":"New info","giver":"Different NPC"}
  Check off objectives using their [#N] number:
  {"tool":"quest","action":"update","index":1,"objectives_update":[{"objective_index":1,"completed":true},{"objective_index":2,"completed":true}]}

complete: mark quest done: {"tool":"quest","action":"complete","index":2}
fail: mark quest failed: {"tool":"quest","action":"fail","index":3}
remove: delete quest: {"tool":"quest","action":"remove","index":4}

== INVENTORY (tool:"inventory") ==
Item types:
  "none" = DEFAULT. Normal items: potions, cloaks, rope, tools, scrolls, food, clothing, trinkets, gems, etc.
  "armor" = ONLY actual D&D armor (Leather, Chain Mail, Plate, etc.) that provides a base AC calculation.
  "shield" = ONLY a shield (+2 AC).
  "weapon" = ONLY actual D&D weapons (Longsword, Shortbow, Dagger, etc.) with attack/damage stats.
Do NOT set type for mundane/generic items. A cloak, ring, boots, or potion is type "none".

add: add a new item to inventory:
  Normal item: {"tool":"inventory","action":"add","name":"Healing Potion","quantity":2,"rarity":"uncommon","location":"stored"}
  Equipment: {"tool":"inventory","action":"add","name":"Chain Mail","type":"armor","location":"equipped"}
  Magic weapon: {"tool":"inventory","action":"add","name":"Staff of Fire","type":"weapon","magic":true,"charges":10,"magic_notes":"Fireball (3ch), Wall of Fire (4ch)","location":"equipped"}
  Required: name
  Optional: quantity (default 1), rarity (common/uncommon/rare/very_rare/legendary/artifact), location (equipped/stored), type, magic, magic_notes, charges

update: modify fields on existing item:
  {"tool":"inventory","action":"update","index":1,"quantity":3}
  {"tool":"inventory","action":"update","index":2,"magic_notes":"Used 1 charge of Fireball"}
  quantity_change: use +/- for relative changes (e.g. -1 to consume one)

equip: {"tool":"inventory","action":"equip","index":1}
unequip: {"tool":"inventory","action":"unequip","index":1}
remove: {"tool":"inventory","action":"remove","index":2}

charges: modify charges on a magic item:
  {"tool":"inventory","action":"charges","index":1,"op":"reduce","value":3}
  ops: set (absolute), reduce (subtract), increase (add), reset (restore to value)

== RULES ==${msNote}
- Only output game_actions when state actually changed. Omit entirely if nothing changed.
- Do NOT mention game_actions in prose. It is invisible metadata.
- Equipment type auto-resolves stats from D&D database. Only 1 armor + 1 shield can be equipped.
- No gold/currency in inventory. Track items only.
- magic_notes: describe attached spells/abilities. charges: track uses remaining.
</game_state_actions>`;
}

/**
 * Build the <companion> section for the active companion.
 * Only included if a companion is enabled.
 */
export function buildCompanionSection() {
    if (!v2Companions || v2Companions.length === 0) return '';
    const active = v2Companions.find(c => c.enabled);
    if (!active) return '';

    const meta = CATEGORY_META[active.category] || CATEGORY_META.familiar;
    const computed = getComputedStats(active);
    const ctypeLabel = active.creatureType
        ? active.creatureType.charAt(0).toUpperCase() + active.creatureType.slice(1)
        : '';

    const lines = [];
    lines.push(`[${active.name || 'Unnamed'} (${active.creatureName}), ${ctypeLabel} ${meta.label}]`);

    const speedStr = computed.speed || active.speed || '';
    lines.push(`HP: ${computed.hp} | AC: ${computed.ac} | Speed: ${speedStr} | Size: ${active.size || 'M'}`);

    const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const abilLine = ABILITY_KEYS.map(a => {
        const score = active[a] ?? 10;
        const mod = Math.floor((score - 10) / 2);
        const modS = mod >= 0 ? `+${mod}` : `${mod}`;
        return `${a.toUpperCase()} ${score}(${modS})`;
    }).join(' ');
    lines.push(abilLine);

    if (active.senses) lines.push(`Senses: ${active.senses}`);
    if (active.skills) lines.push(`Skills: ${active.skills}`);

    const traits = computed.traits || active.traits || [];
    if (traits.length > 0) {
        lines.push('Traits:');
        for (const t of traits) lines.push(`  ${t.name}: ${t.desc}`);
    }

    const actions = computed.actions || active.actions || [];
    if (actions.length > 0) {
        lines.push('Actions:');
        for (const a of actions) lines.push(`  ${a.name}: ${a.desc}`);
    }

    if (active.description) lines.push(`Notes: ${active.description}`);

    return `<companion>\n${lines.join('\n')}\n</companion>`;
}
