/**
 * V1 Character System - Prompt Builder
 * Builds the full character stat block for LLM context injection.
 */

import { characterV1 } from '../core/state.js';
import { computeCharacterStats } from '../features/character.js';
import { ABILITY_KEYS, ABILITY_LABELS, SKILL_LABELS } from '../core/constants.js';

/**
 * Build the full character prompt for injection.
 * @returns {string} Formatted prompt string, or '' if no character / disabled
 */
export function buildCharacterPrompt() {
    if (!characterV1 || !characterV1.enabled) return '';

    const stats = computeCharacterStats(characterV1);
    if (!stats) return '';

    const lines = [];

    // Header
    const subLabel = stats.subclassName ? ` (${stats.subclassName})` : '';
    lines.push(`[Player Character — ${stats.name || 'Unnamed'} (Lv ${stats.level}):]`);
    lines.push(`Species: ${stats.speciesName || 'Unknown'} | Background: ${stats.backgroundName || 'Unknown'}`);
    lines.push(`Class: ${stats.className}${subLabel}`);

    // Core stats line
    lines.push(`HP: ${stats.hp} | AC: ${stats.ac} | Speed: ${stats.speed}ft | Prof: +${stats.proficiency}`);

    // Ability scores
    const abLine = ABILITY_KEYS.map(ab => {
        const score = stats.abilities[ab];
        const mod = stats.mods[ab];
        return `${ABILITY_LABELS[ab]} ${score}(${mod >= 0 ? '+' : ''}${mod})`;
    }).join(' ');
    lines.push(abLine);

    // Saves
    const saveParts = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        const mark = s.proficient ? '*' : '';
        return `${ABILITY_LABELS[ab]} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
    });
    lines.push(`Saves: ${saveParts.join(', ')}  (* = proficient)`);

    // Skills (only show proficient/expert skills to save tokens)
    const skillParts = [];
    for (const [key, skill] of Object.entries(stats.skills)) {
        if (skill.proficient || skill.expertise) {
            const mark = skill.expertise ? '**' : '*';
            skillParts.push(`${skill.label} ${skill.mod >= 0 ? '+' : ''}${skill.mod}${mark}`);
        }
    }
    if (skillParts.length > 0) {
        lines.push(`Skills: ${skillParts.join(', ')}  (* = proficient, ** = expertise)`);
    }

    // Senses
    if (stats.senses?.length > 0) {
        lines.push(`Senses: ${stats.senses.join(', ')}`);
    }

    // Languages
    if (stats.languages?.length > 0) {
        lines.push(`Languages: ${stats.languages.join(', ')}`);
    }

    // Resistances
    if (stats.speciesResistances?.length > 0) {
        lines.push(`Resistances: ${stats.speciesResistances.join(', ')}`);
    }

    // Equipment
    const armorName = stats.equippedArmor?.name || 'None';
    const shieldStr = stats.hasShield ? ' + Shield' : '';
    lines.push(`Armor: ${armorName}${shieldStr}`);

    // Weapons
    if (stats.computedWeapons?.length > 0) {
        const wpnParts = stats.computedWeapons.map(w => {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            let dmgStr = `${w.computedDamage} ${w.damageType || ''}`.trim();
            if (w.computedVersatile) dmgStr += ` (versatile: ${w.computedVersatile})`;
            return `${w.name} (${hit} to hit, ${dmgStr})`;
        });
        lines.push(`Weapons: ${wpnParts.join('; ')}`);
    }

    // Combat Notes
    if (stats.combatNotes?.length > 0) {
        lines.push('Combat Notes:');
        for (const note of stats.combatNotes) {
            lines.push(`  - ${note}`);
        }
    }

    // Automatic class/subclass features (from CDN class data, with compact notes preferred)
    if (stats.classFeatures?.length > 0) {
        lines.push('Class Features:');
        for (const feat of stats.classFeatures) {
            const prefix = feat.featureSource === 'subclass' ? '[SC] ' : '';
            if (feat.compactNote) {
                lines.push(`  Lv${feat.level}: ${prefix}${feat.compactNote}`);
            } else {
                const desc = feat.description || '';
                const truncated = desc.length > 150
                    ? desc.substring(0, 147) + '...'
                    : desc;
                lines.push(`  Lv${feat.level}: ${prefix}${feat.name}${truncated ? ` — ${truncated}` : ''}`);
            }
        }
    }

    // Species Traits
    if (stats.speciesTraits?.length > 0) {
        lines.push('Species Traits:');
        for (const trait of stats.speciesTraits) {
            const desc = trait.description.length > 150
                ? trait.description.substring(0, 147) + '...'
                : trait.description;
            lines.push(`  - ${trait.name}: ${desc}`);
        }
    }

    // Feats (with brief effect descriptions from combat notes)
    if (stats.chosenFeats?.length > 0) {
        lines.push(`Feats: ${stats.chosenFeats.join(', ')}`);
    }

    // Feat-granted tool proficiencies
    if (stats.featExtraTools?.length > 0) {
        lines.push(`Feat Tools: ${stats.featExtraTools.join(', ')}`);
    }

    // Bonus spells (from feats, subclass features, fighting styles, etc.)
    if (stats.featBonusCantrips?.length > 0 || stats.featBonusSpells?.length > 0) {
        const parts = [];
        for (const c of (stats.featBonusCantrips || [])) {
            parts.push(`${c.name} (${c.source})`);
        }
        for (const s of (stats.featBonusSpells || [])) {
            const free = s.freeCast ? ' [1/LR free]' : '';
            const always = s.alwaysPrepared ? ' [always prepared]' : '';
            const ritual = s.ritualOnly ? ' [ritual only]' : '';
            parts.push(`${s.name}${free}${always}${ritual} (${s.source})`);
        }
        lines.push(`Bonus Spells: ${parts.join(', ')}`);
    }

    // Spellcasting
    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        lines.push(`Spellcasting (${sc.abilityLabel}): Attack +${sc.attackMod}, Save DC ${sc.saveDC}`);

        if (stats.annotatedCantrips?.length > 0) {
            const cantripStr = stats.annotatedCantrips.map(c => c.annotation).join(', ');
            lines.push(`  Cantrips: ${cantripStr}`);
        }

        lines.push(`  Slots: ${sc.slotsStr}`);

        // Subclass spells (always prepared or bonus known)
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
                if (sp.extraFreeCast) entry += ` [${sp.extraFreeCast} free]`;
                if (sp.extraSource) entry += ` (${sp.extraSource})`;
                byLevel[lv].push(entry);
            }

            const label = sc.isPrepared ? 'Prepared' : 'Known';
            for (const [lv, spells] of Object.entries(byLevel).sort((a, b) => a[0] - b[0])) {
                lines.push(`  ${label} (${ordinal(parseInt(lv))} level): ${spells.join(', ')}`);
            }
        }
    }

    // Class Resources
    if (stats.classResources?.length > 0) {
        const resParts = stats.classResources.map(r => `${r.label} ${r.value}/${r.recharge}`);
        lines.push(`Resources: ${resParts.join(', ')}`);
    }

    // Level Choice Details (Metamagic, Invocations, Maneuvers, etc.)
    if (stats.levelChoiceDetails) {
        const lcd = stats.levelChoiceDetails;
        if (lcd.pactBoon) {
            lines.push(`Pact Boon: ${lcd.pactBoon.label} — ${lcd.pactBoon.desc}`);
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

    // Companion (Primal Companion / Familiar)
    if (stats.companion) {
        const c = stats.companion;
        const displayName = c.customName || c.name;
        lines.push(`[Companion — ${displayName} (${c.size} ${c.type}):]`);
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
        lines.push(`[Familiar — ${displayName} (${f.size} ${typeLabel}):]`);
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

    return lines.join('\n');
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
