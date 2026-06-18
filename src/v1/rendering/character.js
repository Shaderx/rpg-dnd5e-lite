/**
 * V1 Character System - Character Panel Rendering
 * Renders the character stat card in the panel and detail modal.
 */

import { characterV1 } from '../core/state.js';
import { computeCharacterStats } from '../features/character.js';
import { ABILITY_KEYS, ABILITY_LABELS } from '../core/constants.js';

/**
 * Render the V1 character panel content.
 * Called whenever the character changes.
 */
export function renderV1CharacterPanel() {
    const container = document.getElementById('dnd-v1-character-content');
    if (!container) return;

    if (!characterV1) {
        container.innerHTML = `
            <div class="dnd-empty-state">
                <span>No character configured</span>
                <button id="dnd-v1-character-create" class="dnd-btn dnd-btn-primary dnd-btn-sm">Create Character</button>
            </div>`;
        return;
    }

    const stats = computeCharacterStats(characterV1);
    if (!stats) {
        container.innerHTML = '<div class="dnd-empty-state">Error computing stats</div>';
        return;
    }

    container.innerHTML = buildStatCard(stats);

    // Update title
    const titleEl = document.getElementById('dnd-v1-character-title');
    if (titleEl) {
        const sub = stats.subclassName ? ` (${stats.subclassName})` : '';
        titleEl.textContent = `${stats.name || 'Character'} — ${stats.className}${sub} Lv ${stats.level}`;
    }
}

/**
 * Build the stat card HTML for the panel.
 */
function buildStatCard(stats) {
    const lines = [];
    lines.push('<div class="dnd-v1-stat-card">');

    // Header
    const sub = stats.subclassName ? ` (${stats.subclassName})` : '';
    lines.push(`<div class="v1-header">${esc(stats.name || 'Unnamed')} — ${esc(stats.className)}${esc(sub)} Lv ${stats.level}</div>`);
    lines.push(`<div class="v1-row"><span class="v1-label">Species:</span><span class="v1-value">${esc(stats.speciesName)}</span></div>`);
    lines.push(`<div class="v1-row"><span class="v1-label">Background:</span><span class="v1-value">${esc(stats.backgroundName)}</span></div>`);

    // Core stats
    lines.push(`<div class="v1-row">
        <span>HP: <b>${stats.hp}</b></span>
        <span>AC: <b>${stats.ac}</b></span>
        <span>Speed: <b>${stats.speed}ft</b></span>
        <span>Prof: <b>+${stats.proficiency}</b></span>
    </div>`);

    lines.push('<hr class="v1-divider" />');

    // Abilities grid
    lines.push('<div class="v1-abilities">');
    for (const ab of ABILITY_KEYS) {
        const mod = stats.mods[ab];
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        lines.push(`<div class="v1-ability">
            <div class="v1-ability-label">${ABILITY_LABELS[ab]}</div>
            <div class="v1-ability-score">${stats.abilities[ab]}</div>
            <div class="v1-ability-mod">${modStr}</div>
        </div>`);
    }
    lines.push('</div>');

    lines.push('<hr class="v1-divider" />');

    // Saves
    const saveParts = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        const mark = s.proficient ? '<b>*</b>' : '';
        return `${ABILITY_LABELS[ab]} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
    });
    lines.push(`<div class="v1-row"><span class="v1-label">Saves:</span><span>${saveParts.join(', ')}</span></div>`);

    // Proficient skills
    const profSkills = Object.entries(stats.skills)
        .filter(([_, s]) => s.proficient || s.expertise)
        .map(([_, s]) => {
            const mark = s.expertise ? '**' : '*';
            return `${s.label} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
        });
    if (profSkills.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Skills:</span><span>${profSkills.join(', ')}</span></div>`);
    }

    // Senses & languages
    if (stats.senses?.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Senses:</span><span>${esc(stats.senses.join(', '))}</span></div>`);
    }
    if (stats.languages?.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Languages:</span><span>${esc(stats.languages.join(', '))}</span></div>`);
    }

    // Weapons
    if (stats.computedWeapons?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-section-title">Weapons</div>');
        for (const w of stats.computedWeapons) {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            lines.push(`<div class="v1-feature-item">${esc(w.name)}: ${hit} to hit, ${esc(w.computedDamage)} ${esc(w.damageType || '')}</div>`);
        }
    }

    // Spellcasting
    if (stats.spellcasting) {
        lines.push('<hr class="v1-divider" />');
        const sc = stats.spellcasting;
        lines.push(`<div class="v1-section-title">Spellcasting (${esc(sc.abilityLabel)})</div>`);
        lines.push(`<div class="v1-row">
            <span>Attack: +${sc.attackMod}</span>
            <span>Save DC: ${sc.saveDC}</span>
            <span>Slots: ${esc(sc.slotsStr)}</span>
        </div>`);

        if (stats.annotatedCantrips?.length > 0) {
            lines.push(`<div class="v1-spell-item"><b>Cantrips:</b> ${stats.annotatedCantrips.map(c => esc(c.annotation)).join(', ')}</div>`);
        }
        if (stats.annotatedSpells?.length > 0) {
            lines.push(`<div class="v1-spell-item"><b>${sc.isPrepared ? 'Prepared' : 'Known'}:</b> ${stats.annotatedSpells.map(s => esc(s.annotation)).join(', ')}</div>`);
        }
    }

    // Combat notes
    if (stats.combatNotes?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-section-title">Combat</div>');
        for (const note of stats.combatNotes) {
            lines.push(`<div class="v1-feature-item">${esc(note)}</div>`);
        }
    }

    // Feats
    if (stats.chosenFeats?.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Feats:</span><span>${stats.chosenFeats.map(esc).join(', ')}</span></div>`);
    }

    lines.push('</div>');
    return lines.join('\n');
}

/**
 * Render the detail modal with full stat block.
 */
export function renderV1DetailModal() {
    if (!characterV1) return;

    const stats = computeCharacterStats(characterV1);
    if (!stats) return;

    const titleEl = document.getElementById('dnd-v1-detail-title');
    if (titleEl) {
        titleEl.textContent = `${stats.name || 'Character'} — Details`;
    }

    const body = document.getElementById('dnd-v1-detail-body');
    if (!body) return;

    body.innerHTML = buildDetailContent(stats);
}

function buildDetailContent(stats) {
    const lines = [];
    const sub = stats.subclassName ? ` (${stats.subclassName})` : '';

    lines.push(`<h4>${esc(stats.name || 'Unnamed')}</h4>`);
    lines.push(`<p>${esc(stats.speciesName)} ${esc(stats.className)}${esc(sub)} — Level ${stats.level}</p>`);
    lines.push(`<p>Background: ${esc(stats.backgroundName)}</p>`);
    lines.push(`<p><b>HP:</b> ${stats.hp} | <b>AC:</b> ${stats.ac} | <b>Speed:</b> ${stats.speed}ft | <b>Prof:</b> +${stats.proficiency} | <b>Hit Die:</b> d${stats.hitDie}</p>`);

    // Abilities
    lines.push('<table style="width:100%;text-align:center;margin:0.5em 0;"><tr>');
    for (const ab of ABILITY_KEYS) {
        const mod = stats.mods[ab];
        lines.push(`<td><b>${ABILITY_LABELS[ab]}</b><br/>${stats.abilities[ab]} (${mod >= 0 ? '+' : ''}${mod})</td>`);
    }
    lines.push('</tr></table>');

    // Saves
    const saveStr = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        return `${ABILITY_LABELS[ab]} ${s.mod >= 0 ? '+' : ''}${s.mod}${s.proficient ? ' *' : ''}`;
    }).join(' | ');
    lines.push(`<p><b>Saves:</b> ${saveStr}</p>`);

    // All skills
    lines.push('<p><b>Skills:</b></p><ul>');
    for (const [key, skill] of Object.entries(stats.skills)) {
        if (skill.proficient || skill.expertise) {
            const mark = skill.expertise ? ' (expertise)' : '';
            lines.push(`<li>${esc(skill.label)}: ${skill.mod >= 0 ? '+' : ''}${skill.mod}${mark}</li>`);
        }
    }
    lines.push('</ul>');

    // Equipment
    if (stats.equippedArmor || stats.hasShield || stats.computedWeapons?.length > 0) {
        lines.push('<p><b>Equipment:</b></p><ul>');
        if (stats.equippedArmor) lines.push(`<li>Armor: ${esc(stats.equippedArmor.name)}</li>`);
        if (stats.hasShield) lines.push('<li>Shield</li>');
        for (const w of (stats.computedWeapons || [])) {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            lines.push(`<li>${esc(w.name)}: ${hit} to hit, ${esc(w.computedDamage)} ${esc(w.damageType || '')}</li>`);
        }
        lines.push('</ul>');
    }

    // Spellcasting
    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        lines.push(`<p><b>Spellcasting (${esc(sc.abilityLabel)}):</b> Attack +${sc.attackMod}, Save DC ${sc.saveDC}</p>`);
        lines.push(`<p>Slots: ${esc(sc.slotsStr)}</p>`);

        if (stats.annotatedCantrips?.length > 0) {
            lines.push(`<p><b>Cantrips:</b> ${stats.annotatedCantrips.map(c => esc(c.annotation)).join(', ')}</p>`);
        }
        if (stats.annotatedSpells?.length > 0) {
            lines.push(`<p><b>${sc.isPrepared ? 'Prepared' : 'Known'} Spells:</b> ${stats.annotatedSpells.map(s => esc(s.annotation)).join(', ')}</p>`);
        }
    }

    // Species traits
    if (stats.speciesTraits?.length > 0) {
        lines.push('<p><b>Species Traits:</b></p><ul>');
        for (const t of stats.speciesTraits) {
            lines.push(`<li><b>${esc(t.name)}:</b> ${esc(t.description)}</li>`);
        }
        lines.push('</ul>');
    }

    // Combat notes
    if (stats.combatNotes?.length > 0) {
        lines.push('<p><b>Combat Notes:</b></p><ul>');
        for (const note of stats.combatNotes) {
            lines.push(`<li>${esc(note)}</li>`);
        }
        lines.push('</ul>');
    }

    // Feats
    if (stats.chosenFeats?.length > 0) {
        lines.push(`<p><b>Feats:</b> ${stats.chosenFeats.map(esc).join(', ')}</p>`);
    }

    return lines.join('\n');
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
