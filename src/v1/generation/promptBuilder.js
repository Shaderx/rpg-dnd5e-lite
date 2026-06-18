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

    // Inventory
    if (stats.items?.length > 0) {
        const itemStr = stats.items.map(i => typeof i === 'string' ? i : i.text || '').filter(Boolean).join(', ');
        if (itemStr) lines.push(`Inventory: ${itemStr}`);
    }

    // Combat Notes
    if (stats.combatNotes?.length > 0) {
        lines.push('Combat Notes:');
        for (const note of stats.combatNotes) {
            lines.push(`  - ${note}`);
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

        if (stats.annotatedSpells?.length > 0) {
            // Group spells by level
            const byLevel = {};
            for (const sp of stats.annotatedSpells) {
                const lv = sp.info?.spellLevel ?? 1;
                if (!byLevel[lv]) byLevel[lv] = [];
                byLevel[lv].push(sp.annotation);
            }

            const label = sc.isPrepared ? 'Prepared' : 'Known';
            for (const [lv, spells] of Object.entries(byLevel).sort((a, b) => a[0] - b[0])) {
                lines.push(`  ${label} (${ordinal(parseInt(lv))} level): ${spells.join(', ')}`);
            }
        }
    }

    return lines.join('\n');
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
