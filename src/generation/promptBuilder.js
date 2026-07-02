/**
 * D&D 5e Lite - Prompt Builder
 * Builds XML-sectioned game state blocks for consolidated LLM injection.
 */

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, chatAttributes, chatAttributeSchema, quests, inventory, spellLog, headerInfo, sendAttributesOnRoll, spellInjectEnabled, spellDataCache, sidekicks, lastNonCombatRoll } from '../core/state.js';
import { RARITY_LABELS, normalizeRarity } from '../features/inventoryRarity.js';
import { formatLevel, schoolName } from '../features/spellbook.js';
import { extractSpellCasts, actionLabels } from '../features/spellTracker.js';
import { MODIFIER_DEFS } from '../features/modifiers.js';
import { computeSidekickStats, getSidekickLevel, getModStr, SIDEKICK_TYPES, SKILL_LABELS, ALL_SKILLS, calculateHireCost, getSpellDamageInfo, buildSpellAnnotation, lookupFeatByName, strip5eMarkup, lookupSpellByName, getSidekickAttunedCount, SIDEKICK_MAX_ATTUNEMENT, lookupItemByName } from '../features/sidekick.js';
import { getSpellDamageInfo as getV1SpellDamageInfo, lookupSpellSync, ordinal } from '../v1/features/spells.js';
import {
    getActiveEffectsList,
    getActiveConcentrationSpell,
    getEffectStatusByLogIndex,
    formatEffectStatusTag,
    formatDurationLabel,
    formatRemainingMinutes,
} from '../v2/features/activeEffects.js';
import { characterV2 } from '../v2/core/characterState.js';
import { computeV2CharacterStats } from '../v2/features/character.js';

/**
 * Get spell damage bonuses from the active characterV2, if any.
 * Returns an object suitable for spreading into getSpellDamageInfo's bonuses param.
 */
function getCharacterSpellBonuses() {
    if (!characterV2) return null;
    const stats = computeV2CharacterStats(characterV2);
    if (!stats) return null;
    return {
        potentMod: stats.potentMod || 0,
        empoweredSchool: stats.empoweredSchool || null,
        empoweredMod: stats.empoweredMod || 0,
        empoweredDamageType: stats.empoweredDamageType || null,
        empoweredDamageTypeMod: stats.empoweredDamageTypeMod || 0,
    };
}

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
 * Build the <quests> section.
 * Returns empty string if no quests exist.
 */
export function buildQuestSection() {
    if (!quests || quests.length === 0) return '';

    const active = quests.filter(q => !q.completed);
    const done = quests.filter(q => q.completed);

    if (active.length === 0 && done.length === 0) return '';

    const main = active.filter(q => q.priority === 3);
    const side = active.filter(q => q.priority === 2);
    const reminders = active.filter(q => (q.priority || 1) === 1);

    const lines = ['<quests>'];

    if (active.length > 0) {
        lines.push('[Active]');
        for (const q of main)      lines.push(`  👑 ${q.text}`);
        for (const q of side)      lines.push(`  🛡️ ${q.text}`);
        for (const q of reminders)  lines.push(`  📌 ${q.text}`);
    }

    if (done.length > 0) {
        lines.push('[Completed]');
        for (const q of done) {
            const emoji = questTypeEmoji(q.priority);
            lines.push(`  ✓ ${emoji} ${q.text}`);
        }
    }

    lines.push('</quests>');
    return lines.join('\n');
}

const RARITY_TAGS = RARITY_LABELS;

/**
 * Build the <inventory> section.
 * Returns empty string if no items exist.
 */
export function buildInventorySection() {
    if (!inventory || inventory.length === 0) return '';

    const equipped = inventory.filter(item => item.location === 'equipped');
    const stored = inventory.filter(item => item.location !== 'equipped');

    if (equipped.length === 0 && stored.length === 0) return '';

    const lines = ['<inventory>'];

    if (equipped.length > 0) {
        lines.push('[Equipped]');
        for (const item of equipped) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = normalizeRarity(item.rarity) >= 1 ? ` (${RARITY_TAGS[normalizeRarity(item.rarity)]})` : '';
            lines.push(`  ⚔ ${item.text}${qty}${rarity}`);
        }
    }

    if (stored.length > 0) {
        lines.push('[Stored]');
        for (const item of stored) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = normalizeRarity(item.rarity) >= 1 ? ` (${RARITY_TAGS[normalizeRarity(item.rarity)]})` : '';
            lines.push(`  📦 ${item.text}${qty}${rarity}`);
        }
    }

    lines.push('</inventory>');
    return lines.join('\n');
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
 * Build the <spell_log> section (chronological cast history).
 * Excludes spells from the last user message.
 * Returns empty string if no spells logged.
 */
export function buildSpellLogSection() {
    if (!spellLog || spellLog.length === 0) return '';

    const lastUserIdx = getLastUserMsgIndex();
    const statusByIndex = getEffectStatusByLogIndex();

    const lines = [
        '<spell_log>',
        '[Chronological, does not include current message]',
    ];

    let hasEntries = false;
    for (let i = 0; i < spellLog.length; i++) {
        const entry = spellLog[i];
        const include = entry.type === 'rest' || entry.type === 'short-rest'
            || entry.type === 'dispel' || entry.type === 'drop-concentration'
            || entry.msgIndex === null || entry.msgIndex !== lastUserIdx;
        if (!include) continue;

        hasEntries = true;
        if (entry.type === 'rest') {
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${entry.text}${datePart}`);
        } else if (entry.type === 'drop-concentration') {
            const target = entry.spell ? `concentration on ${entry.spell}` : 'all concentration';
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- Ended ${target}${timePart}${datePart}`);
        } else if (entry.type === 'short-rest' || entry.type === 'dispel') {
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${entry.text}${timePart}${datePart}`);
        } else {
            const { past } = actionLabels(entry.action);
            const statusTag = formatEffectStatusTag(statusByIndex.get(i));
            const statusPart = statusTag ? ` ${statusTag}` : '';
            const elementPart = entry.chosenElement ? ` [${entry.chosenElement}]` : '';
            const detailsPart = entry.details ? ` (${entry.details})` : '';
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${past} ${entry.spell}${elementPart}${detailsPart}${statusPart}${timePart}${datePart}`);
        }
    }

    if (!hasEntries) return '';

    lines.push('</spell_log>');
    return lines.join('\n');
}

/**
 * Build the <active_effects> section from spell log duration tracking.
 * Always available when spell tracker is enabled (not gated on spell_reference inject).
 * Concentration callout is handled in buildActiveSpellsSection() instead.
 */
export function buildActiveEffectsSection() {
    const active = getActiveEffectsList();
    const armedReactions = buildArmedReactionsList();

    if (active.length === 0 && armedReactions.length === 0) return '';

    const lines = [
        '<active_effects>',
        '[Computed from spell log and header time; only listed effects are currently active]',
    ];

    for (const effect of active) {
        const name = effect.logEntry.spell;
        const elPart = effect.logEntry.chosenElement ? ` [${effect.logEntry.chosenElement}]` : '';
        const dur = effect.spell?.duration?.[0];
        const durLabel = formatDurationLabel(dur);
        const rem = formatRemainingMinutes(effect.remainingMinutes);
        let statusLine = 'ACTIVE';
        if (effect.concentration) statusLine += ' (concentration)';
        if (rem) statusLine += ` (${rem} remaining)`;
        else if (effect.status === 'unknown') statusLine += ' (duration unknown)';

        lines.push(`- ${name}${elPart}: ${statusLine} — ${durLabel}`);
    }

    if (armedReactions.length > 0) {
        lines.push('');
        lines.push('Prepared Reactions (ARMED — auto-trigger when conditions met, apply without asking player):');
        for (const r of armedReactions) {
            const triggerStr = r.trigger ? `: ${r.trigger}` : '';
            lines.push(`- ${r.name} [${r.level}]${triggerStr}`);
        }
    }

    lines.push('</active_effects>');
    return lines.join('\n');
}

function buildArmedReactionsList() {
    const armed = characterV2?.preparedReactions;
    if (!Array.isArray(armed) || armed.length === 0) return [];
    return armed.map(name => {
        const spell = lookupSpellSync(name);
        if (!spell) return null;
        const condition = spell.time?.[0]?.condition;
        const trigger = condition
            ? strip5eMarkup(condition).replace(/^which you take\s*/i, '')
            : '';
        const lvl = spell.level === 0
            ? 'cantrip'
            : `${ordinal(spell.level)} level`;
        return { name, level: lvl, trigger };
    }).filter(Boolean);
}

/**
 * Format a pre-rolled d4-d12 set into a compact prompt string.
 * @param {object} diceSet
 * @param {string} prefix - e.g. "ally1_" or "enemy2_"
 */
function fmtDiceSet(diceSet, prefix = '') {
    if (!diceSet) return '';
    return ['d4', 'd6', 'd8', 'd10', 'd12'].map(k => `${prefix}${k}=${diceSet[k]}`).join(', ');
}

/**
 * Build the <dice> section for combat rolls.
 * Only activates when the big yellow d20 button was pressed (lastDiceRoll).
 * Pool dice and modifiers are included here when a combat d20 is active,
 * but on their own they flow through the non-combat path instead.
 */
export function buildCombatDiceSection() {
    const roll = extensionSettings.lastDiceRoll;
    if (!roll) return '';

    const poolDice = extensionSettings.lastDamageRoll;
    const mods = extensionSettings.lastModifierRolls || {};
    const hasModifiers = Object.keys(mods).length > 0;

    const userName = getContext().name1 || 'User';
    const includeAttrs = sendAttributesOnRoll;
    const lines = ['<dice>', '[Combat: use these pre-rolled values]'];

    if (includeAttrs) {
        lines.push(`Attributes: ${buildAttributesString()}`);
    }

    if (roll) {
        lines.push(`${userName}: user_d20_1=${roll.roll1}, user_d20_2=${roll.roll2}`);
        if (includeAttrs) {
            lines.push('Attack = d20 + ability mod + proficiency. Apply all proficiencies/expertise where applicable.');
        }
        const allies = roll.allyRolls ?? (roll.allyRoll1 != null
            ? [{ roll1: roll.allyRoll1, roll2: roll.allyRoll2 }] : []);
        if (allies.length > 0) {
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                const n = i + 1;
                const tag = allies.length === 1 ? 'Ally' : `Ally ${n}`;
                const prefix = `ally${n}_`;
                let line = `${tag}: ${prefix}d20_1=${a.roll1}, ${prefix}d20_2=${a.roll2}`;
                if (a.dmg) line += ` | dice: ${fmtDiceSet(a.dmg, prefix)}`;
                lines.push(line);
            }
        }
        const enemies = roll.enemyRolls ?? (roll.npcRoll1 != null
            ? [{ roll1: roll.npcRoll1, roll2: roll.npcRoll2 }] : []);
        if (enemies.length > 0) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                const n = i + 1;
                const tag = enemies.length === 1 ? 'Enemy' : `Enemy ${n}`;
                const prefix = `enemy${n}_`;
                let line = `${tag}: ${prefix}d20_1=${e.roll1}, ${prefix}d20_2=${e.roll2}`;
                if (e.dmg) line += ` | dice: ${fmtDiceSet(e.dmg, prefix)}`;
                lines.push(line);
            }
        }
    }

    if (poolDice) {
        const diceList = poolDice.dice
            ? poolDice.dice.map((d, i) => `user_dice_${i + 1}_d${d.sides}=${d.result}`).join(', ')
            : poolDice.rolls.map((r, i) => `user_dice_${i + 1}_d${poolDice.sides}=${r}`).join(', ');
        lines.push(`Dice: ${diceList} (use for damage, healing, or other effects)`);
    }

    if (hasModifiers) {
        lines.push('Modifiers:');
        for (const [id, modRoll] of Object.entries(mods)) {
            const def = MODIFIER_DEFS.find(m => m.id === id);
            if (!def || !modRoll) continue;
            const desc = def.prompt.replace(/\{user\}/g, userName);
            lines.push(`- ${desc} Rolled ${modRoll.formula}: ${modRoll.rolls.join(' + ')} = ${modRoll.total}.`);
        }
    }

    lines.push('</dice>');
    return lines.join('\n');
}

/**
 * Build the <dice> section for non-combat checks.
 * Includes auto-rolled non-combat d20s (when enabled) plus any active pool
 * dice (d4-d12) and buff/debuff modifiers (Guidance, Bless, etc.).
 * Returns empty string if nothing is available to inject.
 */
export function buildNonCombatDiceSection() {
    const hasNonCombatD20 = extensionSettings.nonCombatDiceEnabled && !!lastNonCombatRoll;
    const poolDice = extensionSettings.lastDamageRoll;
    const mods = extensionSettings.lastModifierRolls || {};
    const hasModifiers = Object.keys(mods).length > 0;

    if (!hasNonCombatD20 && !poolDice && !hasModifiers) return '';

    const userName = getContext().name1 || 'User';
    const lines = ['<dice>'];

    if (hasNonCombatD20) {
        const { user, npc } = lastNonCombatRoll;
        lines.push(
            '[Non-combat: skill checks, ability checks, saving throws only. Use for non-trivial checks vs DC.]',
            'Pick one d20 per check: use higher if advantage, lower if disadvantage, sequentially if straight roll.',
            `${userName}: user_d20_1=${user.roll1}, user_d20_2=${user.roll2}`,
            `NPC: npc_d20_1=${npc.roll1}, npc_d20_2=${npc.roll2}`,
        );
    }

    if (poolDice) {
        const diceList = poolDice.dice
            ? poolDice.dice.map((d, i) => `user_dice_${i + 1}_d${d.sides}=${d.result}`).join(', ')
            : poolDice.rolls.map((r, i) => `user_dice_${i + 1}_d${poolDice.sides}=${r}`).join(', ');
        lines.push(`Dice: ${diceList} (use for damage, healing, or other effects)`);
    }

    if (hasModifiers) {
        lines.push('Modifiers:');
        for (const [id, modRoll] of Object.entries(mods)) {
            const def = MODIFIER_DEFS.find(m => m.id === id);
            if (!def || !modRoll) continue;
            const desc = def.prompt.replace(/\{user\}/g, userName);
            lines.push(`- ${desc} Rolled ${modRoll.formula}: ${modRoll.rolls.join(' + ')} = ${modRoll.total}.`);
        }
    }

    lines.push('</dice>');
    return lines.join('\n');
}

/**
 * Build the <spell_reference> section with precalculated spell stats.
 * Only includes spells that are currently active (from active effects) or
 * cast in the current user message. Spell detail blocks are gated on
 * spellInjectEnabled, but the CONCENTRATING ON line always displays.
 */
export function buildActiveSpellsSection() {
    const concEffect = getActiveConcentrationSpell();
    const activeEffects = getActiveEffectsList();

    const chat = getContext().chat;
    const characterLevel = getSidekickLevel();
    const charSpellBonuses = getCharacterSpellBonuses();
    const seen = new Set();
    const matched = [];

    if (spellInjectEnabled) {
        for (const effect of activeEffects) {
            const entry = effect.logEntry;
            const spell = findSpellForInject(entry.spell);
            if (!spell) continue;
            const castLevel = entry.details ? parseCastLevelFromDetails(entry.details) : null;
            const key = `${spell.name.toLowerCase()}|${castLevel ?? 'base'}`;
            if (seen.has(key)) continue;
            seen.add(key);
            matched.push({ spell, cast: { spell: entry.spell, castLevel, chosenElement: entry.chosenElement || null, extras: entry.details || '' } });
        }

        if (chat?.length) {
            let lastUserMsg = null;
            for (let i = chat.length - 1; i >= 0; i--) {
                if (chat[i].is_user) { lastUserMsg = chat[i].mes; break; }
            }
            if (lastUserMsg) {
                const casts = extractSpellCasts(lastUserMsg);
                for (const cast of casts) {
                    const spell = findSpellForInject(cast.spell);
                    if (!spell) continue;
                    const key = `${spell.name.toLowerCase()}|${cast.castLevel ?? 'base'}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    matched.push({ spell, cast });
                }
            }
        }
    }

    if (matched.length === 0 && !concEffect) return '';

    const lines = ['<spell_reference>'];

    if (concEffect) {
        const concRem = formatRemainingMinutes(concEffect.remainingMinutes);
        const concDetail = concRem ? ` (${concRem} remaining)` : '';
        lines.push(`CONCENTRATING ON: ${concEffect.logEntry.spell}${concDetail}`);
    }

    if (matched.length > 0) {
        lines.push('[Active and current-turn spells — precalculated values, do not recalculate]');

        for (const { spell, cast } of matched) {
            const levelSchool = spell.level === 0
                ? `${schoolName(spell.school)} cantrip`
                : `${formatLevel(spell.level)} ${schoolName(spell.school)}`;

            lines.push('');
            lines.push(`► ${spell.name} (${levelSchool})`);

            if (cast.castLevel != null) {
                lines.push(`  Slot: ${ordinal(cast.castLevel)}-level${cast.extras ? ` | ${cast.extras}` : ''}`);
            } else if (cast.extras) {
                lines.push(`  Notes: ${cast.extras}`);
            }

            const statsBlock = buildPrecalculatedStats(spell, characterLevel, cast.castLevel, charSpellBonuses, cast.chosenElement);
            if (statsBlock) lines.push(statsBlock);

            lines.push(`  Time: ${fmtTime(spell.time)} | Range: ${fmtRange(spell.range)} | Duration: ${fmtDuration(spell.duration)}`);

            if (!statsBlock) {
                const desc = plainTextEntries(spell.entries);
                if (desc) {
                    const truncated = desc.length > 200 ? desc.slice(0, 200) + '...' : desc;
                    lines.push(`  Effect: ${truncated}`);
                }
            }
        }
    }

    lines.push('</spell_reference>');
    return lines.join('\n');
}

/** Parse a cast level from the raw details string of a spell log entry. */
function parseCastLevelFromDetails(details) {
    if (!details) return null;
    const tokens = details.split(',').map(t => t.trim());
    for (const token of tokens) {
        const m = token.match(/^(\d)(?:st|nd|rd|th)?(?:\s+level)?$/i)
            || token.match(/^(?:level|lvl|lv)\s*(\d)$/i);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n >= 1 && n <= 9) return n;
        }
    }
    return null;
}

/** Resolve spell from imported spellbook, sidekick CDN cache, or V1 CDN cache. */
function findSpellForInject(name) {
    const fromBook = findSpellInCache(name);
    if (fromBook && !fromBook._fallback) return fromBook;
    const fromSk = lookupSpellByName(name);
    if (fromSk) return fromSk;
    return lookupSpellSync(name);
}

/**
 * Build precalculated stats block for a spell (indented lines, no section tags).
 * @param {object} [spellBonuses] - Class/subclass spell damage bonuses from character stats
 * @param {string} [chosenElement] - Player-chosen damage type override (e.g. 'fire')
 */
function buildPrecalculatedStats(spell, characterLevel, castLevel, spellBonuses, chosenElement) {
    const bonusObj = { castLevel, chosenElement, ...spellBonuses };
    const info = getV1SpellDamageInfo(spell.name, characterLevel, bonusObj)
        || getSpellDamageInfo(spell.name, characterLevel, 0, null, 0, castLevel);
    if (!info) return '';

    const lines = [];

    const finalDice = castLevel != null && info.upcastTable?.[castLevel]?.dice
        ? info.upcastTable[castLevel].dice
        : (info.atCastLevel?.dice ?? info.dice);
    const finalHealDice = castLevel != null && info.upcastTable?.[castLevel]?.healDice
        ? info.upcastTable[castLevel].healDice
        : (info.atCastLevel?.healDice ?? info.healDice);

    const isUpcast = castLevel != null && castLevel > (info.spellLevel || 1);
    const upcastLabel = isUpcast ? ` (upcast at ${ordinal(castLevel)} level)` : '';

    if (finalDice && info.isHealing && info.hasDamageAndHeal) {
        const typeStr = !info.omitDamageType && info.type ? ` ${info.type}` : '';
        lines.push(`  DAMAGE${upcastLabel}: ${finalDice}${typeStr}`);
        lines.push(`  HEALING${upcastLabel}: ${finalHealDice || finalDice} HP`);
    } else if (finalDice && !info.isHealing) {
        const typeStr = !info.omitDamageType && info.type ? ` ${info.type}` : '';
        lines.push(`  DAMAGE${upcastLabel}: ${finalDice}${typeStr}`);
    } else if (finalHealDice && info.isHealing) {
        const bonusNote = info.healingClassBonus ? ` (includes +${info.healingClassBonus} class bonus)` : '';
        lines.push(`  HEALING${upcastLabel}: ${finalHealDice} HP${bonusNote}`);
    }

    if (info.savingThrow) {
        lines.push(`  SAVE: ${info.savingThrow.charAt(0).toUpperCase() + info.savingThrow.slice(1)} saving throw`);
    } else if (info.spellAttack) {
        lines.push(`  ATTACK: ${info.spellAttack === 'R' ? 'Ranged' : 'Melee'} spell attack roll`);
    }

    if (info.conditionInflict?.length > 0) {
        lines.push(`  CONDITIONS: ${info.conditionInflict.join(', ')}`);
    }

    if (info.isCantrip) {
        if (info.range && info.baseRange && info.range !== info.baseRange) {
            lines.push(`  RANGE (scaled for Lv ${characterLevel}): ${info.range}`);
        }
        if (info.beamCount > 1) {
            lines.push(`  BEAMS: ${info.beamCount} (at Lv ${characterLevel})`);
        }
    }

    if (info.upcastExtra && castLevel != null && castLevel > (info.spellLevel || 1)) {
        lines.push(`  UPCAST BONUS: ${stripTags(info.upcastExtra)}`);
    }

    return lines.length > 0 ? lines.join('\n') : '';
}


/**
 * Build the <sidekicks> section with compact stat blocks for enabled NPCs.
 * Returns empty string if no sidekicks are enabled.
 */
export function buildSidekickSection() {
    if (!sidekicks || sidekicks.length === 0) return '';
    const enabled = sidekicks.filter(sk => sk.enabled);
    if (enabled.length === 0) return '';

    const level = getSidekickLevel();
    const lines = ['<sidekicks>'];

    for (const sk of enabled) {
        const stats = computeSidekickStats(sk, level);
        const typeInfo = SIDEKICK_TYPES[sk.type];
        const subInfo = typeInfo?.subtypes?.find(s => s.key === sk.subtype);
        const typeLabel = typeInfo?.label || sk.type;
        const subLabel = subInfo ? ` (${subInfo.label})` : '';
        const raceStr = sk.race ? `${sk.race} ` : '';
        const creatureStr = sk.creatureName || '';
        const shieldSuffix = sk.equippedShield ? `+${sk.equippedShield.name || 'Shield'}` : '';
        const armorNote = sk.equippedArmor ? ` (${sk.equippedArmor.name}${shieldSuffix})` : (sk.equippedShield ? ` (${sk.equippedShield.name || 'Shield'})` : '');

        lines.push(`\n[Hireling: ${sk.name} (${raceStr}${creatureStr}, ${typeLabel}${subLabel}) Lv ${level}]`);
        lines.push(`HP ${stats.hp} | AC ${stats.ac}${armorNote} | SPD ${sk.speedFull || sk.baseSpeed + 'ft'} | Prof +${stats.proficiency}`);

        const abilLine = ['str','dex','con','int','wis','cha']
            .map(a => `${a.toUpperCase()} ${stats.scores[a]}(${getModStr(stats.scores[a])})`)
            .join(' ');
        lines.push(abilLine);

        const saveParts = ['str','dex','con','int','wis','cha'].map(a => {
            const s = stats.saves[a];
            const mark = s.proficient ? '*' : '';
            return `${a.toUpperCase()} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
        });
        lines.push(`Saves: ${saveParts.join(', ')}  (* = proficient)`);

        const skillParts = ALL_SKILLS
            .filter(sk2 => stats.skills[sk2].proficient || stats.skills[sk2].expertise)
            .map(sk2 => {
                const s = stats.skills[sk2];
                const mark = s.expertise ? '**' : '*';
                return `${SKILL_LABELS[sk2]} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
            });
        if (skillParts.length > 0) {
            lines.push(`Skills: ${skillParts.join(', ')}  (* = proficient, ** = expertise)`);
        }

        const allTools = [...(sk.toolProficiencies || [])];
        const fe = stats.featEffects;
        if (fe?.toolProficiencies?.length > 0) {
            for (const t of fe.toolProficiencies) { if (!allTools.includes(t)) allTools.push(t); }
        }
        if (allTools.length > 0) lines.push(`Tools: ${allTools.join(', ')}`);

        if (sk.senses) lines.push(`Senses: ${sk.senses}`);
        const allLangs = [...(sk.languagesFixed || []), ...(sk.chosenLanguages || [])];
        const langDisplay = allLangs.length > 0 ? allLangs.join(', ') : sk.languages;
        if (langDisplay) lines.push(`Languages: ${langDisplay}`);

        const enabledTraits = (sk.creatureTraits || []).filter(t => t.enabled);
        if (enabledTraits.length > 0) {
            lines.push('Traits:');
            for (const t of enabledTraits) lines.push(`  ${t.name}: ${t.text}`);
        }

        const equipParts = [];
        if (sk.equippedArmor) {
            const armorTag = sk.equippedArmor.attuned ? ' [attuned]' : '';
            equipParts.push(`${sk.equippedArmor.name}${armorTag}`);
        }
        if (sk.equippedShield) {
            const shieldTag = sk.equippedShield.attuned ? ' [attuned]' : '';
            equipParts.push(`${sk.equippedShield.name || 'Shield'} (+${sk.equippedShield.ac ?? 2} AC)${shieldTag}`);
        }
        if (equipParts.length > 0) lines.push(`Armor: ${equipParts.join(', ')}`);

        const cWeapons = stats.computedWeapons || [];
        if (cWeapons.length > 0) {
            const wpnParts = cWeapons.map(w => {
                const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
                let desc = `${hit} to hit, ${w.computedDamage} ${w.damageType}`;
                if (w.computedVersatile) desc += ` (versatile: ${w.computedVersatile})`;
                if (w.range) desc += `, ${w.attackType?.includes('mw') ? 'thrown' : 'range'} ${w.range}`;
                const attuneTag = w.attuned ? ' [attuned]' : '';
                const notes = w.customNotes ? ` [${w.customNotes}]` : '';
                return `${w.name}${attuneTag} (${desc})${notes}`;
            });
            lines.push(`Weapons: ${wpnParts.join('; ')}`);
        }

        const cActions = (stats.computedActions || []).filter(a => a.enabled);
        if (cActions.length > 0) {
            lines.push('Creature Actions:');
            for (const a of cActions) {
                let line = `  ${a.name}:`;
                if (a.computedHit != null) line += ` ${a.computedHit >= 0 ? '+' : ''}${a.computedHit} to hit,`;
                if (a.computedDamage) line += ` ${a.computedDamage} dmg`;
                if (a.computedDc != null) line += ` DC ${a.computedDc}`;
                if (!a.computedHit && !a.computedDamage && !a.computedDc) line += ` ${a.text}`;
                lines.push(line);
            }
        }

        if (sk.items?.length > 0) {
            const itemDescs = sk.items.map(it => {
                const attuneTag = it.attuned ? ' [attuned]' : '';
                const notes = it.customNotes ? ` [${it.customNotes}]` : '';
                return `${it.name}${attuneTag}${notes}`;
            });
            lines.push(`Items: ${itemDescs.join(', ')}`);
        }

        const attuneCount = getSidekickAttunedCount(sk);
        if (attuneCount > 0) {
            lines.push(`Attunement: ${attuneCount}/${SIDEKICK_MAX_ATTUNEMENT} slots used`);
        }

        if (stats.spellcasting) {
            const sc = stats.spellcasting;
            lines.push(`Spellcasting (${sc.abilityLabel}): Attack +${sc.attackMod}, Save DC ${sc.saveDC}`);
            lines.push(`  Slots: ${sc.slotsStr || 'none'}`);

            const allKnown = [
                ...(sk.knownCantrips || []).map(n => ({ name: n, lvl: 0 })),
                ...(sk.knownSpells || []).map(n => {
                    const info = getSpellDamageInfo(n, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                    return { name: n, lvl: info?.spellLevel ?? 1 };
                }),
            ];
            allKnown.sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));

            const byLevel = new Map();
            for (const s of allKnown) {
                if (!byLevel.has(s.lvl)) byLevel.set(s.lvl, []);
                byLevel.get(s.lvl).push(s.name);
            }

            for (const [lvl, names] of byLevel) {
                const label = lvl === 0 ? 'Cantrips' : `${lvl}${lvl === 1 ? 'st' : lvl === 2 ? 'nd' : lvl === 3 ? 'rd' : 'th'}-level`;
                const annotated = names.map(n => {
                    const info = getSpellDamageInfo(n, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                    return buildSpellAnnotation(n, info);
                });
                lines.push(`  ${label}: ${annotated.join(', ')}`);
            }
        }

        if (stats.features?.length > 0) {
            lines.push('Class Features:');
            for (const f of stats.features) lines.push(`  ${f.name}: ${f.text}`);
        }

        if (stats.chosenFeats?.length > 0) {
            lines.push(`Feats: ${stats.chosenFeats.join(', ')}`);
            for (const name of stats.chosenFeats) {
                const feat = lookupFeatByName(name);
                if (!feat) continue;
                const entries = (feat.entries || []).map(e => {
                    if (typeof e === 'string') return strip5eMarkup(e);
                    if (e.type === 'list' && e.items) {
                        return e.items.map(i => {
                            if (typeof i === 'string') return strip5eMarkup(i);
                            if (i.type === 'item' && i.name && i.entries) return `${i.name}: ${strip5eMarkup(i.entries.join(' '))}`;
                            return '';
                        }).filter(Boolean).join('; ');
                    }
                    return '';
                }).filter(Boolean).join(' ');
                if (entries) lines.push(`  ${name}: ${entries}`);
            }
        }

        if (fe) {
            if (fe.bonusCantrips?.length > 0 || fe.bonusSpells?.length > 0) {
                const bCantrips = (fe.bonusCantrips || []).map(s => {
                    const info = getSpellDamageInfo(s.name, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                    const ann = buildSpellAnnotation(s.name, info);
                    const free = s.freeCast ? ' [1/LR free]' : '';
                    return `${ann}${free} (${s.source})`;
                });
                const bSpells = (fe.bonusSpells || []).map(s => {
                    const info = getSpellDamageInfo(s.name, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                    const ann = buildSpellAnnotation(s.name, info);
                    const free = s.freeCast ? ' [1/LR free]' : '';
                    return `${ann}${free} (${s.source})`;
                });
                const all = [...bCantrips, ...bSpells];
                if (all.length > 0) lines.push(`Bonus Spells: ${all.join(', ')}`);
            }
            if (fe.promptNotes?.length > 0) {
                lines.push('Feat Notes:');
                for (const note of fe.promptNotes) lines.push(`  - ${note}`);
            }
        }

        if (sk.hireGoldPerDay > 0 || sk.hireDate || sk.hirePayMode === 'free' || sk.hirePayMode === 'quest') {
            const parts = [];
            if (sk.hirePayMode === 'free') {
                parts.push('Oathbound/volunteer, serves without pay');
            } else if (sk.hirePayMode === 'quest') {
                const amt = sk.hireQuestAmount > 0 ? `${sk.hireQuestAmount}gp` : 'agreed sum';
                parts.push(`One-time quest payment: ${amt}`);
                parts.push(sk.hireQuestPaid ? '(already paid)' : '(due on quest completion)');
            } else {
                if (sk.hireGoldPerDay > 0) parts.push(`${sk.hireGoldPerDay}gp/day`);
                if (sk.hirePayMode === 'daily') {
                    parts.push('(paid daily)');
                }
                const currentDate = headerInfo?.date || null;
                if (sk.hireGoldPerDay > 0 && sk.hireDate && currentDate && sk.hirePayMode !== 'daily') {
                    const cost = calculateHireCost(sk.hireDate, currentDate, sk.hireGoldPerDay, sk.hirePayMode, sk.hirePaidAmount);
                    if (cost && cost.daysElapsed > 0) {
                        if (cost.goldOwed > 0) {
                            parts.push(`(${cost.daysElapsed} days, ${cost.goldOwed}gp owed)`);
                        } else {
                            parts.push(`(${cost.daysElapsed} days, paid up)`);
                        }
                    }
                }
            }
            if (sk.hireDate) parts.push(`since ${sk.hireDate}`);
            lines.push(`Hire: ${parts.join(' ')}`);
        }
    }

    lines.push('</sidekicks>');
    return lines.join('\n');
}

/**
 * Build the <random_event> section.
 * @param {object|null} eventResult - Result from rollRandomEvent()
 * @returns {string} Section content or empty string
 */
export function buildRandomEventSection(eventResult) {
    if (!eventResult) {
        return '<random_world_event>\n[No Roll]\nRandom world events are active but no roll was produced this turn.\n</random_world_event>';
    }

    const { roll, severity, category, categoryMeta, examples, cooldownActive, cooldownRemaining } = eventResult;

    if (!severity) {
        const cdNote = cooldownActive
            ? ` (Cooldown: ${cooldownRemaining} turn${cooldownRemaining !== 1 ? 's' : ''} remaining)`
            : '';
        return `<random_world_event>\n[d100: ${roll} | No Event${cdNote}]\nNo random world event this turn. Continue the narrative based on the player's actions and current situation.\n</random_world_event>`;
    }

    const lines = [];
    lines.push('<random_world_event>');
    lines.push(`[d100: ${roll} | ${severity.label} | ${categoryMeta.label}]`);
    lines.push('');
    lines.push(`<event_directive>${categoryMeta.directive}</event_directive>`);

    if (examples.length > 0) {
        lines.push('');
        lines.push('<event_table_entries>');
        lines.push('The following are rolled event seeds from the world event table. Use one or combine elements from several to create the event. Adapt details to fit the current location, NPCs present, time of day, and ongoing narrative threads:');
        for (const ex of examples) {
            lines.push(`- ${ex}`);
        }
        lines.push('</event_table_entries>');
    }

    lines.push('');
    lines.push(`<event_instructions severity="${severity.id}">`);
    lines.push('IMPORTANT: Merge this event organically into the ongoing narrative. Do not treat it as a disconnected interruption.');
    lines.push('- Connect the event to existing story threads, active quests, or the current scene whenever possible.');
    lines.push('- If a direct connection exists, weave the event as a natural consequence or escalation of current events.');
    lines.push('- If no direct connection fits, introduce the event as an emerging situation the party encounters naturally.');
    lines.push('- The party and NPCs react in-character. No meta-game references, no announcing dice rolls or mechanics.');
    lines.push('- Scale the narrative weight to match the severity: minor events are passing moments, critical events reshape the scene.');
    lines.push('</event_instructions>');
    lines.push('</random_world_event>');

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
    if (!Array.isArray(timeArr) || !timeArr.length) return '-';
    const t = timeArr[0];
    return typeof t === 'string' ? t : `${t.number} ${t.unit}`;
}

function fmtRange(range) {
    if (!range) return '-';
    if (range.type === 'point') {
        const d = range.distance;
        if (!d || d.type === 'self') return 'Self';
        if (d.type === 'touch') return 'Touch';
        return `${d.amount} ${d.type}`;
    }
    if (range.type === 'special') return 'Special';
    return '-';
}

function fmtDuration(durArr) {
    if (!Array.isArray(durArr) || !durArr.length) return '-';
    const d = durArr[0];
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') return 'Until dispelled';
    if (d.type === 'timed') {
        const conc = d.concentration ? 'Concentration, up to ' : '';
        return `${conc}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
    }
    return '-';
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
