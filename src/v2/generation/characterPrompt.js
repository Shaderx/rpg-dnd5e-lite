/**
 * V2 Character System - Prompt Builder
 * Builds the <character> section for V2 mode.
 * Equipment is EXCLUDED here (shown in <inventory> with type tags instead).
 */

import { characterV2 } from '../core/characterState.js';
import { computeV2CharacterStats } from '../features/character.js';
import { computeFreeCastUsage, formatFreeCastPromptTag } from '../features/freeCastTracker.js';
import { ABILITY_KEYS, ABILITY_LABELS } from '../core/constants.js';
import { v2Companions } from '../core/state.js';
import { extensionSettings, spellLog } from '../../core/state.js';
import { compressCombatNote } from '../../generation/compress.js';

/**
 * Build the V2 <character> section for the consolidated game state injection.
 * Excludes equipment (armor/weapons/shield) since it's in the inventory section.
 * @returns {string} Formatted section with XML tags, or '' if no character / disabled
 */
export function buildV2CharacterSection(options = {}) {
    const { isCombat = false } = options;
    if (!characterV2 || !characterV2.enabled) return '';

    const stats = computeV2CharacterStats(characterV2);
    if (!stats) return '';

    const freeCastUsage = computeFreeCastUsage(characterV2, stats, spellLog);
    const lines = [];

    lines.push('<character>');

    const subLabel = stats.subclassName ? ` (${stats.subclassName})` : '';
    lines.push(`[${stats.name || 'Unnamed'}, Lv${stats.level} ${stats.speciesName || ''} ${stats.className}${subLabel}]`.trim());
    if (stats.backgroundName) lines.push(`Background: ${stats.backgroundName}`);

    const acParts = (stats.acBreakdown || []).map(b => {
        const val = b.isBase ? `${b.value}` : (b.value >= 0 ? `+${b.value}` : `${b.value}`);
        return `${b.label} ${val}`;
    });
    const acDetail = acParts.length > 0 ? ` (${acParts.join(', ')})` : '';
    lines.push(`HP: ${stats.hp} | AC: ${stats.ac}${acDetail} | Speed: ${stats.speed}ft | Prof: +${stats.proficiency}`);

    const abLine = ABILITY_KEYS.map(ab => {
        const score = stats.abilities[ab];
        const mod = stats.mods[ab];
        return `${ABILITY_LABELS[ab]} ${score}(${mod >= 0 ? '+' : ''}${mod})`;
    }).join(' ');
    lines.push(abLine);

    const saveParts = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        const mark = s.proficient ? '*' : '';
        return `${ABILITY_LABELS[ab]} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
    });
    const saveSuffix = stats.saveBonusSources?.length > 0
        ? ` [includes ${stats.saveBonusSources.join(', ')}]`
        : '';
    lines.push(`Saves: ${saveParts.join(', ')}${saveSuffix}`);

    const skillParts = [];
    for (const [, skill] of Object.entries(stats.skills)) {
        if (skill.proficient || skill.expertise) {
            const mark = skill.expertise ? '**' : '*';
            skillParts.push(`${skill.label} ${skill.mod >= 0 ? '+' : ''}${skill.mod}${mark}`);
        }
    }
    if (skillParts.length > 0) {
        lines.push(`Skills: ${skillParts.join(', ')}`);
    }

    if (stats.senses?.length > 0) {
        lines.push(`Senses: ${stats.senses.join(', ')}`);
    }

    if (stats.languages?.length > 0) {
        lines.push(`Languages: ${stats.languages.join(', ')}`);
    }

    if (stats.speciesResistances?.length > 0) {
        lines.push(`Resistances: ${stats.speciesResistances.join(', ')}`);
    }

    // Equipment is deliberately excluded — it's in the <inventory> section with type tags

    if (isCombat && stats.combatNotes?.length > 0) {
        lines.push('Combat Notes:');
        for (const note of stats.combatNotes) {
            lines.push(`  - ${compressCombatNote(note)}`);
        }
    }

    if (stats.classFeatures?.length > 0) {
        const classFeatureParts = stats.classFeatures
            .filter(feat => feat?.name)
            .map(feat => {
                const prefix = feat.featureSource === 'subclass' ? '[SC] ' : '';
                const tag = feat.statTag ? ` (${feat.statTag})` : '';
                return `${prefix}${feat.name}${tag}`;
            });
        if (classFeatureParts.length > 0) {
            lines.push(`Class Features: ${classFeatureParts.join(', ')}`);
        }
    }

    if (stats.speciesTraits?.length > 0) {
        lines.push('Species Traits:');
        for (const trait of stats.speciesTraits) {
            const desc = trait.description.length > 150
                ? trait.description.substring(0, 147) + '...'
                : trait.description;
            lines.push(`  - ${trait.name}: ${desc}`);
        }
    }

    if (stats.chosenFeats?.length > 0) {
        lines.push(`Feats: ${stats.chosenFeats.join(', ')}`);
    }

    if (stats.featExtraTools?.length > 0) {
        lines.push(`Feat Tools: ${stats.featExtraTools.join(', ')}`);
    }

    if (stats.featBonusCantrips?.length > 0 || stats.featBonusSpells?.length > 0) {
        const parts = [];
        for (const c of (stats.featBonusCantrips || [])) {
            parts.push(`${c.name} (${c.source})`);
        }
        for (const s of (stats.featBonusSpells || [])) {
            const free = formatFreeCastPromptTag(s.freeCast, freeCastUsage, s.name);
            const always = s.alwaysPrepared ? ' [always prepared]' : '';
            const ritual = s.ritualOnly ? ' [ritual only]' : '';
            parts.push(`${s.name}${free}${always}${ritual} (${s.source})`);
        }
        lines.push(`Bonus Spells: ${parts.join(', ')}`);
    }

    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        lines.push(`Spellcasting (${sc.abilityLabel}): Attack +${sc.attackMod}, Save DC ${sc.saveDC}`);

        if (stats.annotatedCantrips?.length > 0) {
            const cantripStr = stats.annotatedCantrips.map(c => c.annotation).join(', ');
            lines.push(`  Cantrips: ${cantripStr}`);
        }

        lines.push(`  Slots: ${sc.slotsStr}`);

        if (stats.subclassSpells?.length > 0) {
            const label = stats.subclassSpellsAreKnown ? 'Bonus Known' : 'Always Prepared';
            lines.push(`  Subclass Spells (${label}): ${stats.subclassSpells.join(', ')}`);
        }

        if (stats.annotatedSpells?.length > 0) {
            const byLevel = {};
            for (const sp of stats.annotatedSpells) {
                const lv = sp.info?.spellLevel ?? 1;
                if (!byLevel[lv]) byLevel[lv] = [];
                let entry = sp.annotation;
                if (sp.extraFreeCast) entry += formatFreeCastPromptTag(sp.extraFreeCast, freeCastUsage, sp.name);
                if (sp.extraSource) entry += ` (${sp.extraSource})`;
                byLevel[lv].push(entry);
            }

            const label = sc.isPrepared ? 'Prepared' : 'Known';
            for (const [lv, spells] of Object.entries(byLevel).sort((a, b) => Number(a[0]) - Number(b[0]))) {
                lines.push(`  ${label} (${ordinal(parseInt(lv))} level): ${spells.join(', ')}`);
            }
        }
    }

    if (stats.classResources?.length > 0) {
        const resParts = stats.classResources.map(r => `${r.label} ${r.value}/${r.recharge}`);
        lines.push(`Resources: ${resParts.join(', ')}`);
    }

    if (stats.levelChoiceDetails) {
        const lcd = stats.levelChoiceDetails;
        if (lcd.pactBoon) {
            lines.push(`Pact Boon: ${lcd.pactBoon.label}: ${lcd.pactBoon.desc}`);
        }
        if (lcd.metamagic?.length > 0) {
            lines.push(`Metamagic: ${lcd.metamagic.map(o => `${o.label} (${o.desc})`).join('; ')}`);
        }
        if (lcd.invocations?.length > 0) {
            lines.push(`Eldritch Invocations: ${lcd.invocations.map(o => `${o.label} (${o.desc})`).join('; ')}`);
        }
        if (lcd.maneuvers?.length > 0) {
            lines.push(`Battle Master Maneuvers: ${lcd.maneuvers.map(o => `${o.label} (${o.desc})`).join('; ')}`);
        }
        if (lcd.arcaneShots?.length > 0) {
            lines.push(`Arcane Shot Options: ${lcd.arcaneShots.map(o => `${o.label} (${o.desc})`).join('; ')}`);
        }
        if (lcd.kenseiWeapons?.length > 0) {
            lines.push(`Kensei Weapons: ${lcd.kenseiWeapons.join(', ')}`);
        }
    }

    // Companion / Familiar — skip if V2 companion module is active (injected via <companion> tag)
    const hasV2Companion = extensionSettings.v2Enabled && v2Companions?.some(c => c.enabled);
    if (!hasV2Companion) {
        if (stats.companion) {
            const c = stats.companion;
            const displayName = c.customName || c.name;
            lines.push('');
            lines.push(`[Companion: ${displayName} (${c.size} ${c.type})]`);
            lines.push(`HP: ${c.hp} | AC: ${c.ac} | Speed: ${c.speed}`);
            const cAbil = ABILITY_KEYS.map(a => {
                const score = c[a];
                if (score == null) return null;
                const mod = Math.floor((score - 10) / 2);
                return `${a.toUpperCase()} ${score}(${mod >= 0 ? '+' : ''}${mod})`;
            }).filter(Boolean).join(' ');
            if (cAbil) lines.push(cAbil);
            if (c.traits?.length > 0) {
                lines.push('Traits:');
                for (const t of c.traits) lines.push(`  ${t.name}: ${t.desc}`);
            }
            if (c.actions?.length > 0) {
                lines.push('Actions:');
                for (const a of c.actions) lines.push(`  ${a.name}: ${a.desc}`);
            }
        } else if (stats.familiarStats) {
            const f = stats.familiarStats;
            const displayName = f.customName || f.label;
            const typeLabel = f.creatureType
                ? f.creatureType.charAt(0).toUpperCase() + f.creatureType.slice(1)
                : f.type;
            lines.push('');
            lines.push(`[Familiar: ${displayName} (${f.size} ${typeLabel})]`);
            lines.push(`HP: ${f.hp} | AC: ${f.ac} | Speed: ${f.speed}`);
            const fAbil = ABILITY_KEYS.map(a => {
                const score = f[a];
                if (score == null) return null;
                const mod = Math.floor((score - 10) / 2);
                return `${a.toUpperCase()} ${score}(${mod >= 0 ? '+' : ''}${mod})`;
            }).filter(Boolean).join(' ');
            if (fAbil) lines.push(fAbil);
            if (f.senses) lines.push(`Senses: ${f.senses}`);
            if (f.skills) lines.push(`Skills: ${f.skills}`);
            if (f.traits?.length > 0) {
                lines.push('Traits:');
                for (const t of f.traits) lines.push(`  ${t.name}: ${t.desc}`);
            }
            if (f.actions?.length > 0) {
                lines.push('Actions:');
                for (const a of f.actions) lines.push(`  ${a.name}: ${a.desc}`);
            }
        }
    }

    lines.push('</character>');
    return lines.join('\n');
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
