/**
 * D&D 5e Lite - Prompt Builder
 * Builds the quest injection prompt and the roll+attributes prompt
 */

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, chatAttributes, chatAttributeSchema, quests, inventory, spellLog, headerInfo, sendAttributesOnRoll, spellInjectEnabled, spellDataCache } from '../core/state.js';
import { formatLevel, schoolName } from '../features/spellbook.js';
import { extractSpellCasts, actionLabels } from '../features/spellTracker.js';

export function getModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

function buildAttributesString() {
    const a = chatAttributes;
    return chatAttributeSchema.map(s => {
        const val = a[s.key] ?? 10;
        return `${s.label} ${val}(${getModifier(val)})`;
    }).join(' ');
}

const QUEST_EMOJIS = { 1: '📌', 2: '🛡️', 3: '👑' };

function questTypeEmoji(priority) {
    const p = priority >= 1 && priority <= 3 ? priority : 1;
    return QUEST_EMOJIS[p];
}

/**
 * Build the quest injection prompt (sent every generation at AN depth).
 * Types: 3=Main Quest(👑), 2=Side Errand(🛡️), 1=Reminder(📌).
 * Returns empty string if no quests.
 */
export function buildQuestPrompt() {
    if (!quests || quests.length === 0) return '';

    const active = quests.filter(q => !q.completed);
    const done = quests.filter(q => q.completed);

    if (active.length === 0 && done.length === 0) return '';

    const main = active.filter(q => q.priority === 3);
    const side = active.filter(q => q.priority === 2);
    const reminders = active.filter(q => (q.priority || 1) === 1);

    const userName = getContext().name1 || '{{User}}';
    const lines = [`[${userName}'s Quest Log:]`];

    lines.push('[Quests are categorized by type:');
    lines.push('  👑 Main Quest — central storyline objectives driving the narrative');
    lines.push('  🛡️ Side Errand — optional tasks, favors, or diversions');
    lines.push('  📌 Reminder — notes, things to remember, not necessarily a quest');
    lines.push('');

    if (active.length > 0) {
        lines.push('Active Quests:');
        for (const q of main)      lines.push(`  👑 ${q.text}`);
        for (const q of side)      lines.push(`  🛡️ ${q.text}`);
        for (const q of reminders)  lines.push(`  📌 ${q.text}`);
    }

    if (done.length > 0) {
        lines.push('Completed:');
        for (const q of done) {
            const emoji = questTypeEmoji(q.priority);
            lines.push(`  ✓ ${emoji} ${q.text}`);
        }
    }

    return lines.join('\n');
}

const RARITY_TAGS = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * Build the inventory injection prompt (sent every generation at AN depth).
 * Lists equipped and stored items with quantity and rarity.
 * Returns empty string if no items.
 */
export function buildInventoryPrompt() {
    if (!inventory || inventory.length === 0) return '';

    const equipped = inventory.filter(item => item.location === 'equipped');
    const stored = inventory.filter(item => item.location !== 'equipped');

    if (equipped.length === 0 && stored.length === 0) return '';

    const userName = getContext().name1 || '{{User}}';
    const lines = [`[${userName}'s inventory:]`];

    if (equipped.length > 0) {
        lines.push('');
        lines.push('Equipped:');
        for (const item of equipped) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = item.rarity >= 1 ? ` (${RARITY_TAGS[item.rarity]})` : '';
            lines.push(`  ⚔ ${item.text}${qty}${rarity}`);
        }
    }

    if (stored.length > 0) {
        lines.push('');
        lines.push('Stored:');
        for (const item of stored) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = item.rarity >= 1 ? ` (${RARITY_TAGS[item.rarity]})` : '';
            lines.push(`  📦 ${item.text}${qty}${rarity}`);
        }
    }

    return lines.join('\n');
}

const KEYCAP = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function buildSpellSlotsString() {
    const slots = headerInfo?.spellSlots;
    const sp = headerInfo?.sorceryPoints;
    let str = '';
    if (slots && Array.isArray(slots) && slots.length > 0) {
        str = slots.map(s => {
            const label = s.level > 0 ? KEYCAP[s.level] : '🪄';
            return `${label}${s.current}/${s.max}`;
        }).join(' ');
    }
    if (sp) {
        const spStr = `⚡${sp.current}/${sp.max}`;
        str = str ? `${str} ${spStr}` : spStr;
    }
    return str;
}

/**
 * Find the index of the last user message in the chat.
 */
function getLastUserMsgIndex() {
    const chat = getContext().chat;
    if (!chat) return -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user) return i;
    }
    return -1;
}

/**
 * Build the spell log injection prompt (chronological list of already-cast spells).
 * Excludes spells from the last user message — the LLM is about to process those,
 * and the spell slots don't yet reflect their cost.
 * Appends current spell slot state so the LLM knows remaining resources.
 * Returns empty string if no spells logged.
 */
export function buildSpellLogPrompt() {
    if (!spellLog || spellLog.length === 0) return '';

    const lastUserIdx = getLastUserMsgIndex();

    // Filter out entries from the current (last) user message
    const prior = spellLog.filter(e =>
        e.type === 'rest' || e.type === 'short-rest' || e.msgIndex === null || e.msgIndex !== lastUserIdx
    );

    const casts = prior.filter(e => e.type === 'cast');
    if (casts.length === 0) return '';

    const userName = getContext().name1 || 'User';
    const lines = [
        `[${userName}'s Spell Log:]`,
        `[${userName} has already casted these spells — only track ${userName}, use this list as the correct authority for the tracker. This tracker does not take the next user message into account. Listed in chronological order:]`,
    ];

    for (const entry of prior) {
        if (entry.type === 'rest' || entry.type === 'short-rest') {
            lines.push(`- ${entry.text}`);
        } else {
            const { past } = actionLabels(entry.action);
            const detailsPart = entry.details ? ` (${entry.details})` : '';
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${past} ${entry.spell}${detailsPart}${timePart}${datePart}`);
        }
    }

    const slotsStr = buildSpellSlotsString();
    if (slotsStr) {
        lines.push('');
        lines.push(`[Current spell slots remaining: ${slotsStr}]`);
    }

    return lines.join('\n');
}

/**
 * Build the roll+attributes prompt (sent only when a roll is active).
 * Six d20 rolls: 2 player, 2 ally, 2 enemy — each pair supports advantage/disadvantage independently.
 * Returns empty string if no roll.
 */
export function buildRollPrompt() {
    const roll = extensionSettings.lastDiceRoll;
    const dmg = extensionSettings.lastDamageRoll;
    const favored = extensionSettings.lastFavoredRoll;
    if (!roll && !dmg && !favored) return '';

    const userName = getContext().name1 || 'User';
    const includeAttrs = sendAttributesOnRoll;
    let prompt = '';

    if (roll) {
        if (includeAttrs) {
            prompt += `${userName}'s attributes: ${buildAttributesString()}\n`;
        }
        prompt += `${userName} rolled two d20 dice — 1st roll: ${roll.roll1}, 2nd roll: ${roll.roll2}.\n`;
        prompt += `If the situation grants advantage, use the higher roll. If it imposes disadvantage, use the lower roll. Otherwise use the 1st roll.\n`;
        if (includeAttrs) {
            prompt += `The relevant ability modifier is calculated from their attributes above. Add the appropriate modifier to the chosen roll and compare against the DC to determine success or failure. Attack rolls are d20 + Modifier + Proficiency Bonus\n\n`;
        } else {
            prompt += `Compare the chosen roll against the DC to determine success or failure.\n\n`;
        }
        if (roll.allyRoll1 != null && roll.allyRoll2 != null) {
            prompt += `Allied rolls (use only when an ally needs to roll this turn; otherwise ignore) — 1st roll: ${roll.allyRoll1}, 2nd roll: ${roll.allyRoll2}.\n`;
            prompt += `Apply the same advantage/disadvantage logic for the ally: use the higher if advantage, the lower if disadvantage, otherwise the 1st roll.\n`;
            prompt += `Use these ally rolls for any checks, saves, attacks, or contested rolls a friendly NPC or companion must make this turn.\n\n`;
        }
        if (roll.npcRoll1 != null && roll.npcRoll2 != null) {
            prompt += `Enemy rolls (use only when an enemy needs to roll this turn; otherwise ignore) — 1st roll: ${roll.npcRoll1}, 2nd roll: ${roll.npcRoll2}.\n`;
            prompt += `Apply the same advantage/disadvantage logic for the enemy: use the higher if advantage, the lower if disadvantage, otherwise the 1st roll.\n`;
            prompt += `Use these enemy rolls for any opposing checks, saves, attacks, or contested rolls a hostile NPC must make this turn.\n`;
        }
    }

    if (dmg) {
        if (prompt) prompt += '\n';
        const diceList = dmg.dice
            ? dmg.dice.map(d => `d${d.sides}→${d.result}`).join(', ')
            : dmg.rolls.map(r => `d${dmg.sides}→${r}`).join(', ');
        prompt += `${userName} also rolled dice: ${diceList}.\n`;
        prompt += `Apply each die result to the relevant effect of the spell, ability, or attack used this turn (damage, healing, save penalty, duration, etc.).`;
    }

    if (favored) {
        if (prompt) prompt += '\n';
        prompt += `${userName} activates Favored by the Gods (Divine Soul, 1st level): `;
        prompt += `If they failed a saving throw or missed with an attack roll, they may add 2d4 to the total, possibly changing the outcome. `;
        prompt += `Rolled 2d4: ${favored.rolls.join(' + ')} = ${favored.total} to add.\n`;
        prompt += `Once this feature is used, it cannot be used again until ${userName} finishes a short or long rest.`;
    }

    return prompt;
}

/**
 * Scan the last user message for [Spell Name, Level] references and build
 * a prompt injecting matched spell descriptions from the spellbook cache.
 */
export function buildSpellInjectPrompt() {
    if (!spellInjectEnabled) return '';

    const chat = getContext().chat;
    if (!chat?.length) return '';

    let lastUserMsg = null;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user) { lastUserMsg = chat[i].mes; break; }
    }
    if (!lastUserMsg) return '';

    const casts = extractSpellCasts(lastUserMsg);
    if (casts.length === 0) return '';

    const seen = new Set();
    const matched = [];
    for (const { spell: name } of casts) {
        const spell = findSpellInCache(name);
        if (spell && !spell._fallback && !seen.has(spell.name)) {
            seen.add(spell.name);
            matched.push(spell);
        }
    }
    if (matched.length === 0) return '';

    const userName = getContext().name1 || '{{User}}';
    const lines = [
        `[${userName}'s Spell Details:]`,
        `[${userName} is casting/referencing the following spell(s). Here are the full spell details for accurate narration:]`,
    ];

    for (const spell of matched) {
        const levelSchool = spell.level === 0
            ? `${schoolName(spell.school)} cantrip`
            : `${formatLevel(spell.level)} ${schoolName(spell.school)}`;

        lines.push('');
        lines.push(`**${spell.name}** (${levelSchool})`);
        lines.push(`Casting Time: ${fmtTime(spell.time)} | Range: ${fmtRange(spell.range)} | Duration: ${fmtDuration(spell.duration)}`);
        lines.push(`Components: ${fmtComponents(spell.components)}`);

        const desc = plainTextEntries(spell.entries);
        if (desc) lines.push(desc);

        if (spell.entriesHigherLevel?.length) {
            const hl = plainTextEntries(spell.entriesHigherLevel);
            if (hl) lines.push(`At Higher Levels: ${hl}`);
        }
    }

    return lines.join('\n');
}


function findSpellInCache(name) {
    const lower = name.toLowerCase();
    for (const [, spell] of spellDataCache) {
        if (spell.name?.toLowerCase() === lower) return spell;
    }
    return null;
}

function fmtTime(timeArr) {
    if (!Array.isArray(timeArr) || !timeArr.length) return '—';
    const t = timeArr[0];
    return typeof t === 'string' ? t : `${t.number} ${t.unit}`;
}

function fmtRange(range) {
    if (!range) return '—';
    if (range.type === 'point') {
        const d = range.distance;
        if (!d || d.type === 'self') return 'Self';
        if (d.type === 'touch') return 'Touch';
        return `${d.amount} ${d.type}`;
    }
    if (range.type === 'special') return 'Special';
    return '—';
}

function fmtDuration(durArr) {
    if (!Array.isArray(durArr) || !durArr.length) return '—';
    const d = durArr[0];
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') return 'Until dispelled';
    if (d.type === 'timed') {
        const conc = d.concentration ? 'Concentration, up to ' : '';
        return `${conc}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
    }
    return '—';
}

function fmtComponents(comp) {
    if (!comp) return '—';
    const parts = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) {
        const mText = typeof comp.m === 'object' ? comp.m.text : comp.m;
        parts.push(mText ? `M (${mText})` : 'M');
    }
    return parts.join(', ') || '—';
}

function stripTags(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str.replace(/{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, '$1');
}

function plainTextEntries(entries) {
    if (!Array.isArray(entries)) return '';
    const parts = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            parts.push(stripTags(e));
        } else if (e?.entries) {
            if (e.name) parts.push(`${stripTags(e.name)}.`);
            parts.push(plainTextEntries(e.entries));
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            for (const item of e.items) {
                if (typeof item === 'string') parts.push(`- ${stripTags(item)}`);
            }
        }
    }
    return parts.join(' ');
}
