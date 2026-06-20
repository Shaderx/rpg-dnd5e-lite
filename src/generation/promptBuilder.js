/**
 * D&D 5e Lite - Prompt Builder
 * Builds the quest injection prompt and the roll+attributes prompt
 */

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, chatAttributes, chatAttributeSchema, quests, inventory, spellLog, headerInfo, sendAttributesOnRoll, spellInjectEnabled, spellDataCache, sidekicks } from '../core/state.js';
import { formatLevel, schoolName } from '../features/spellbook.js';
import { extractSpellCasts, actionLabels } from '../features/spellTracker.js';
import { MODIFIER_DEFS } from '../features/modifiers.js';
import { computeSidekickStats, getSidekickLevel, getModStr, SIDEKICK_TYPES, SKILL_LABELS, ALL_SKILLS, calculateHireCost, getSpellDamageInfo, buildSpellAnnotation, lookupFeatByName, strip5eMarkup, lookupSpellByName } from '../features/sidekick.js';
import { getSpellDamageInfo as getV1SpellDamageInfo, lookupSpellSync, ordinal } from '../v1/features/spells.js';

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

    lines.push('[Quests are categorized by type:]');
    lines.push('  👑 Main Quest — central storyline objectives driving the narrative');
    lines.push('  🛡️ Side Errand — optional tasks, favors, or diversions');
    lines.push('  📌 Reminder — notes, things to remember, not necessarily a quest');
    lines.push('');

    if (active.length > 0) {
        lines.push('[Active Quests:]');
        for (const q of main)      lines.push(`  👑 ${q.text}`);
        for (const q of side)      lines.push(`  🛡️ ${q.text}`);
        for (const q of reminders)  lines.push(`  📌 ${q.text}`);
    }

    if (done.length > 0) {
        lines.push('[Completed:]');
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
        lines.push('[Equipped:]');
        for (const item of equipped) {
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            const rarity = item.rarity >= 1 ? ` (${RARITY_TAGS[item.rarity]})` : '';
            lines.push(`  ⚔ ${item.text}${qty}${rarity}`);
        }
    }

    if (stored.length > 0) {
        lines.push('');
        lines.push('[Stored:]');
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
        e.type === 'rest' || e.type === 'short-rest' || e.type === 'dispel' || e.msgIndex === null || e.msgIndex !== lastUserIdx
    );

    if (prior.length === 0) return '';

    const userName = getContext().name1 || 'User';
    const lines = [
        `[${userName}'s Spell Log:]`,
        `[${userName} has already casted these spells — only track ${userName}, use this list as the correct authority for the tracker. This tracker does not take the next user message into account. Listed in chronological order:]`,
    ];

    for (const entry of prior) {
        if (entry.type === 'rest') {
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${entry.text}${datePart}`);
        } else if (entry.type === 'short-rest' || entry.type === 'dispel') {
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${entry.text}${timePart}${datePart}`);
        } else {
            const { past } = actionLabels(entry.action);
            const detailsPart = entry.details ? ` (${entry.details})` : '';
            const timePart = entry.time ? ` at ${entry.time}` : '';
            const datePart = entry.date ? `, ${entry.date}` : '';
            lines.push(`- ${past} ${entry.spell}${detailsPart}${timePart}${datePart}`);
        }
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
    const mods = extensionSettings.lastModifierRolls || {};
    const hasModifiers = Object.keys(mods).length > 0;
    if (!roll && !dmg && !hasModifiers) return '';

    const userName = getContext().name1 || 'User';
    const includeAttrs = sendAttributesOnRoll;
    let prompt = '';

    if (roll) {
        if (includeAttrs) {
            prompt += `${userName}'s attributes: ${buildAttributesString()}\n`;
        }
        prompt += `${userName} rolled two combat d20 dice — combat_user_d20_1 = ${roll.roll1}, combat_user_d20_2 = ${roll.roll2}.\n`;
        prompt += `Disregard any rolls if not needed. If the situation grants advantage, use the higher roll. If it imposes disadvantage, use the lower roll. Otherwise use the 1st roll.\n`;
        if (includeAttrs) {
            prompt += `The relevant ability modifier is calculated from their attributes above. Add the appropriate modifier to the chosen roll and compare against the DC to determine success or failure. Attack rolls are d20 + Modifier + Proficiency Bonus.\n`;
            prompt += `Remember to apply all applicable proficiencies and expertise: skill proficiency, tool proficiency, weapon/armor proficiency, saving throw proficiency, and expertise (double proficiency bonus) where the character has them.\n\n`;
        } else {
            prompt += `Compare the chosen roll against the DC to determine success or failure. Remember to apply all applicable proficiencies and expertise (double proficiency bonus) the character has when calculating the final result.\n\n`;
        }
        const allies = roll.allyRolls ?? (roll.allyRoll1 != null
            ? [{ roll1: roll.allyRoll1, roll2: roll.allyRoll2 }] : []);
        if (allies.length > 0) {
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                const n = i + 1;
                const tag = allies.length === 1 ? 'Ally' : `Ally ${n}`;
                prompt += `${tag} combat rolls (use only when this ally needs to roll this turn; otherwise ignore) — ally${n}_combat_d20_1 = ${a.roll1}, ally${n}_combat_d20_2 = ${a.roll2}.\n`;
            }
            prompt += `Apply the same advantage/disadvantage logic for each ally: use the higher if advantage, the lower if disadvantage, otherwise the 1st roll.\n`;
            prompt += `Use these ally rolls for any checks, saves, attacks, or contested rolls a friendly NPC or companion must make this turn.\n\n`;
        }
        const enemies = roll.enemyRolls ?? (roll.npcRoll1 != null
            ? [{ roll1: roll.npcRoll1, roll2: roll.npcRoll2 }] : []);
        if (enemies.length > 0) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                const n = i + 1;
                const tag = enemies.length === 1 ? 'Enemy' : `Enemy ${n}`;
                prompt += `${tag} combat rolls (use only when an enemy needs to roll this turn; otherwise ignore) — enemy${n}_combat_d20_1 = ${e.roll1}, enemy${n}_combat_d20_2 = ${e.roll2}.\n`;
            }
            prompt += `Apply the same advantage/disadvantage logic for each enemy: use the higher if advantage, the lower if disadvantage, otherwise the 1st roll.\n`;
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

    if (hasModifiers) {
        if (prompt) prompt += '\n';
        prompt += `${userName} has the following active dice modifiers:\n`;
        for (const [id, modRoll] of Object.entries(mods)) {
            const def = MODIFIER_DEFS.find(m => m.id === id);
            if (!def || !modRoll) continue;
            const desc = def.prompt.replace(/\{user\}/g, userName);
            prompt += `- ${desc} Rolled ${modRoll.formula}: ${modRoll.rolls.join(' + ')} = ${modRoll.total}.\n`;
        }
    }
// Disabling this for now.
//    prompt += `\nIMPORTANT: Write out the roll results and calculations at the end of your response (e.g. the chosen roll, modifiers applied, total, DC, and outcome).`;

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

    const characterLevel = getSidekickLevel();
    const seen = new Set();
    const matched = [];

    for (const cast of casts) {
        const spell = findSpellForInject(cast.spell);
        if (!spell) continue;
        const key = `${spell.name.toLowerCase()}|${cast.castLevel ?? 'base'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matched.push({ spell, cast });
    }
    if (matched.length === 0) return '';

    const userName = getContext().name1 || '{{User}}';
    const lines = [
        `[${userName}'s Spell Details:]`,
        `[${userName} is casting/referencing the following spell(s). Use computed stats for accurate narration:]`,
    ];

    for (const { spell, cast } of matched) {
        const levelSchool = spell.level === 0
            ? `${schoolName(spell.school)} cantrip`
            : `${formatLevel(spell.level)} ${schoolName(spell.school)}`;

        lines.push('');
        lines.push(`**${spell.name}** (${levelSchool})`);

        if (cast.castLevel != null) {
            lines.push(`Cast at ${ordinal(cast.castLevel)}-level slot${cast.extras ? ` — ${cast.extras}` : ''}`);
        } else if (cast.extras) {
            lines.push(`Notes: ${cast.extras}`);
        }

        lines.push(`Casting Time: ${fmtTime(spell.time)} | Range: ${fmtRange(spell.range)} | Duration: ${fmtDuration(spell.duration)}`);
        lines.push(`Components: ${fmtComponents(spell.components)}`);

        const statsLines = buildSpellComputedStats(spell.name, characterLevel, cast.castLevel);
        if (statsLines.length > 0) {
            lines.push('Computed Stats:');
            for (const sl of statsLines) lines.push(`  ${sl}`);
        }

        const desc = plainTextEntries(spell.entries);
        if (desc) lines.push(desc);

        if (spell.entriesHigherLevel?.length) {
            const hl = plainTextEntries(spell.entriesHigherLevel);
            if (hl) lines.push(`At Higher Levels: ${hl}`);
        }
    }

    return lines.join('\n');
}

/** Resolve spell from imported spellbook, sidekick CDN cache, or V1 CDN cache. */
function findSpellForInject(name) {
    const fromBook = findSpellInCache(name);
    if (fromBook && !fromBook._fallback) return fromBook;
    const fromSk = lookupSpellByName(name);
    if (fromSk) return fromSk;
    return lookupSpellSync(name);
}

/** Build computed damage/range/beam lines for inject prompt. */
function buildSpellComputedStats(spellName, characterLevel, castLevel) {
    const info = getV1SpellDamageInfo(spellName, characterLevel, { castLevel })
        || getSpellDamageInfo(spellName, characterLevel, 0, null, 0, castLevel);
    if (!info) return [];

    const lines = [];
    const annotation = buildSpellAnnotation(spellName, { ...info, castLevel });
    if (annotation !== spellName) lines.push(annotation);

    if (castLevel != null && info.upcastTable?.[castLevel]) {
        const row = info.upcastTable[castLevel];
        const parts = [];
        if (row.dice) parts.push(`${row.dice}${info.type ? ' ' + info.type : ''} damage`);
        if (row.healDice) parts.push(`heal ${row.healDice}`);
        if (parts.length > 0) {
            lines.push(`Upcast at ${ordinal(castLevel)} level: ${parts.join(', ')}`);
        }
    }

    if (info.upcastExtra) {
        lines.push(`Upcast effects: ${stripTags(info.upcastExtra)}`);
    }

    if (info.isCantrip) {
        if (info.range && info.baseRange && info.range !== info.baseRange) {
            lines.push(`Scaled range (character Lv ${characterLevel}): ${info.range}`);
        }
        if (info.beamCount > 1) {
            lines.push(`Beams at character Lv ${characterLevel}: ${info.beamCount}`);
        }
    }

    return lines;
}


/**
 * Build the sidekick injection prompt with compact stat blocks for enabled NPCs.
 */
export function buildSidekickPrompt() {
    if (!sidekicks || sidekicks.length === 0) return '';
    const enabled = sidekicks.filter(sk => sk.enabled);
    if (enabled.length === 0) return '';

    const level = getSidekickLevel();
    const lines = [`[Active Sidekicks (Lv ${level}):]`];

    for (const sk of enabled) {
        const stats = computeSidekickStats(sk, level);
        const typeInfo = SIDEKICK_TYPES[sk.type];
        const subInfo = typeInfo?.subtypes?.find(s => s.key === sk.subtype);
        const typeLabel = typeInfo?.label || sk.type;
        const subLabel = subInfo ? ` (${subInfo.label})` : '';
        const raceStr = sk.race ? `${sk.race} ` : '';
        const creatureStr = sk.creatureName || '';
        const armorNote = sk.equippedArmor ? ` (${sk.equippedArmor.name}${sk.hasShield ? '+Shield' : ''})` : (sk.hasShield ? ' (Shield)' : '');

        lines.push(`\n[Hireling — ${sk.name} (${raceStr}${creatureStr}, ${typeLabel}${subLabel}) Lv ${level}:]`);
        lines.push(`HP ${stats.hp} | AC ${stats.ac}${armorNote} | SPD ${sk.speedFull || sk.baseSpeed + 'ft'} | Prof +${stats.proficiency}`);

        // Ability scores
        const abilLine = ['str','dex','con','int','wis','cha']
            .map(a => `${a.toUpperCase()} ${stats.scores[a]}(${getModStr(stats.scores[a])})`)
            .join(' ');
        lines.push(abilLine);

        // Saves — show all, mark proficient with *
        const saveParts = ['str','dex','con','int','wis','cha'].map(a => {
            const s = stats.saves[a];
            const mark = s.proficient ? '*' : '';
            return `${a.toUpperCase()} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
        });
        lines.push(`Saves: ${saveParts.join(', ')}  (* = proficient)`);

        // Skills — only proficient/expert, mark * / **
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

        // Senses / Languages
        if (sk.senses) lines.push(`Senses: ${sk.senses}`);
        const allLangs = [...(sk.languagesFixed || []), ...(sk.chosenLanguages || [])];
        const langDisplay = allLangs.length > 0 ? allLangs.join(', ') : sk.languages;
        if (langDisplay) lines.push(`Languages: ${langDisplay}`);

        // Creature Traits
        const enabledTraits = (sk.creatureTraits || []).filter(t => t.enabled);
        if (enabledTraits.length > 0) {
            lines.push('Traits:');
            for (const t of enabledTraits) lines.push(`  ${t.name}: ${t.text}`);
        }

        // Armor
        const equipParts = [];
        if (sk.equippedArmor) equipParts.push(sk.equippedArmor.name);
        if (sk.hasShield) equipParts.push('Shield');
        if (equipParts.length > 0) lines.push(`Armor: ${equipParts.join(', ')}`);

        // Weapons (player-assigned)
        const cWeapons = stats.computedWeapons || [];
        if (cWeapons.length > 0) {
            const wpnParts = cWeapons.map(w => {
                const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
                let desc = `${hit} to hit, ${w.computedDamage} ${w.damageType}`;
                if (w.computedVersatile) desc += ` (versatile: ${w.computedVersatile})`;
                if (w.range) desc += `, ${w.attackType?.includes('mw') ? 'thrown' : 'range'} ${w.range}`;
                return `${w.name} (${desc})`;
            });
            lines.push(`Weapons: ${wpnParts.join('; ')}`);
        }

        // Creature Actions (stat-block attacks / abilities)
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
            lines.push(`Items: ${sk.items.map(it => it.name).join(', ')}`);
        }

        // Spellcasting
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

        // Class Features (level-derived)
        if (stats.features?.length > 0) {
            lines.push('Class Features:');
            for (const f of stats.features) lines.push(`  ${f.name}: ${f.text}`);
        }

        // Feats (ASI-chosen)
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

        const fe = stats.featEffects;
        if (fe) {
            if (fe.toolProficiencies?.length > 0) {
                lines.push(`Feat Tools: ${fe.toolProficiencies.join(', ')}`);
            }
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

        // Hire cost
        if (sk.hireGoldPerDay > 0 || sk.hireDate || sk.hirePayMode === 'free') {
            const parts = [];
            if (sk.hirePayMode === 'free') {
                parts.push('Oathbound/volunteer — serves without pay');
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

    return lines.join('\n');
}

/**
 * Build the random event injection prompt.
 * Always wraps output in <Random_Event> tags for COT reference.
 * @param {object} eventResult - Result from rollRandomEvent()
 */
export function buildRandomEventPrompt(eventResult) {
    if (!eventResult) {
        return '<random_event>\n[No Roll]\nRandom events are active but no roll was produced this turn.\n</Random_Event>';
    }

    const { roll, severity, category, categoryMeta, examples, cooldownActive, cooldownRemaining } = eventResult;

    if (!severity) {
        const cdNote = cooldownActive
            ? ` (Cooldown: ${cooldownRemaining} turn${cooldownRemaining !== 1 ? 's' : ''} remaining)`
            : '';
        return `<Random_Event>\n[d100: ${roll} | No Event${cdNote}]\nNo random event this turn. Continue the narrative based on the player's actions and current situation.\n</Random_Event>`;
    }

    const lines = [];
    lines.push(`<Random_Event>`);
    lines.push(`[d100: ${roll} | ${severity.label} | ${categoryMeta.label}]`);
    lines.push(categoryMeta.directive);

    if (examples.length > 0) {
        lines.push('');
        lines.push('Examples for inspiration (adapt to current context — do not copy verbatim):');
        for (const ex of examples) {
            lines.push(`- ${ex}`);
        }
    }

    lines.push('');
    lines.push('Weave this event naturally into the narrative. The party should have a chance to react. Do not mention dice rolls, random generation, or game mechanics in the narrative.');
    lines.push('</Random_Event>');

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
