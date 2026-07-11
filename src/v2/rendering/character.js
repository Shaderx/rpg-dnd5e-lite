/**
 * V2 Character System - Character Panel Rendering
 * Renders the character stat card in the panel and detail modal.
 */

import { characterV2 } from '../core/characterState.js';
import { computeV2CharacterStats } from '../features/character.js';
import { ABILITY_KEYS, ABILITY_LABELS } from '../core/constants.js';
import { bindTooltipEvents } from '../../rendering/tooltip.js';
import { formatAtLevelStats } from '../../features/spellScaling.js';

function spellHoverSpan(entry) {
    const statsLine = formatAtLevelStats(entry.info);
    const ttAttr = statsLine ? ` data-tt-text="${esc(statsLine)}"` : '';
    return `<span class="dnd-tt-hover" data-tt-type="spell" data-tt-name="${esc(entry.name)}"${ttAttr}>${esc(entry.annotation)}</span>`;
}

/**
 * Render the V2 character panel content.
 * Called whenever the character changes.
 */
export function renderV2CharacterPanel() {
    const container = document.getElementById('dnd-v1-character-content');
    if (!container) return;

    const levelUpBtn = document.getElementById('dnd-v1-character-levelup');

    if (!characterV2) {
        container.innerHTML = `
            <div class="dnd-empty-state">
                <span>No character configured</span>
                <button id="dnd-v1-character-create" class="dnd-btn dnd-btn-primary dnd-btn-sm">Create Character</button>
            </div>`;
        if (levelUpBtn) levelUpBtn.style.display = 'none';
        return;
    }

    const stats = computeV2CharacterStats(characterV2);
    if (!stats) {
        container.innerHTML = '<div class="dnd-empty-state">Error computing stats</div>';
        if (levelUpBtn) levelUpBtn.style.display = 'none';
        return;
    }

    container.innerHTML = buildStatCard(stats);
    bindTooltipEvents(container);

    if (levelUpBtn) levelUpBtn.style.display = stats.level < 20 ? '' : 'none';

    const titleEl = document.getElementById('dnd-v1-character-title');
    if (titleEl) {
        const sub = stats.subclassName ? ` (${stats.subclassName})` : '';
        titleEl.textContent = `${stats.name || 'Character'} \u2014 ${stats.className}${sub} Lv ${stats.level}`;
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

    // Core stats — AC with breakdown tooltip
    const acTooltipLines = (stats.acBreakdown || []).map(b => {
        const val = b.isBase ? `${b.value}` : (b.value >= 0 ? `+${b.value}` : `${b.value}`);
        return `${b.label}: ${val}`;
    });
    const acTooltip = acTooltipLines.length > 0
        ? ` class="dnd-tt-hover dnd-ac-hover" data-tt-type="trait" data-tt-name="AC ${stats.ac}" data-tt-sub="Breakdown" data-tt-text="${esc(acTooltipLines.join('\n'))}"`
        : '';
    lines.push(`<div class="v1-row">
        <span>HP: <b>${stats.hp}</b></span>
        <span${acTooltip}>AC: <b>${stats.ac}</b></span>
        <span>Speed: <b>${stats.speed}ft</b></span>
        <span>Prof: <b>+${stats.proficiency}</b></span>
        <span>Hit Die: <b>d${stats.hitDie}</b></span>
    </div>`);

    // Equipped armor and shield
    const equipParts = [];
    if (stats.equippedArmor?.name) {
        equipParts.push(`Armor: <span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(stats.equippedArmor.name)}"><b>${esc(stats.equippedArmor.name)}</b></span>`);
    }
    if (stats.hasShield) {
        equipParts.push('Shield');
    }
    if (equipParts.length > 0) {
        lines.push(`<div class="v1-row">${equipParts.join(' | ')}</div>`);
    }

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

    // Saves — with breakdown tooltip
    const saveTooltipLines = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        const parts = [`${ABILITY_LABELS[ab]}: ${stats.mods[ab] >= 0 ? '+' : ''}${stats.mods[ab]}`];
        if (s.proficient) parts.push(`Prof +${stats.proficiency}`);
        if (stats.saveBonusSources?.length > 0) {
            for (const src of stats.saveBonusSources) parts.push(src);
        }
        return `${parts.join(', ')} = ${s.mod >= 0 ? '+' : ''}${s.mod}`;
    });
    const saveTooltip = ` class="dnd-tt-hover" data-tt-type="trait" data-tt-name="Saving Throws" data-tt-sub="Breakdown" data-tt-text="${esc(saveTooltipLines.join('\n'))}"`;
    const saveParts = ABILITY_KEYS.map(ab => {
        const s = stats.saves[ab];
        const mark = s.proficient ? '<b>*</b>' : '';
        return `${ABILITY_LABELS[ab]} ${s.mod >= 0 ? '+' : ''}${s.mod}${mark}`;
    });
    lines.push(`<div class="v1-row"><span class="v1-label">Saves:</span><span${saveTooltip}>${saveParts.join(', ')}</span></div>`);

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

    // Species traits (collapsed by default)
    if (stats.speciesTraits?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="dnd-collapsible dnd-collapsed">');
        lines.push('<div class="dnd-collapsible-header" data-section="species-traits">');
        lines.push('<i class="fa-solid fa-chevron-down dnd-collapse-icon"></i>');
        lines.push('<span>Species Traits</span>');
        lines.push('</div>');
        lines.push('<div class="dnd-collapsible-body">');
        const traitNames = stats.speciesTraits.map(t =>
            `<span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(t.name)}" data-tt-text="${esc(t.description || '')}">${esc(t.name)}</span>`,
        ).join(', ');
        lines.push(`<div class="v1-row">${traitNames}</div>`);
        lines.push('</div>');
        lines.push('</div>');
    }

    // Class Resources
    if (stats.classResources?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-section-title">Resources</div>');
        lines.push('<div class="v1-row v1-resources">');
        for (const r of stats.classResources) {
            lines.push(`<span class="v1-resource-item"><b>${esc(String(r.value))}</b> ${esc(r.label)} <span class="v1-resource-recharge">/${r.recharge}</span></span>`);
        }
        lines.push('</div>');
    }

    // Level Choice Details (Metamagic, Invocations, etc.)
    if (stats.levelChoiceDetails) {
        const lcd = stats.levelChoiceDetails;
        const sections = [];
        if (lcd.pactBoon) sections.push({ title: 'Pact Boon', items: [lcd.pactBoon] });
        if (lcd.metamagic?.length > 0) sections.push({ title: 'Metamagic', items: lcd.metamagic });
        if (lcd.invocations?.length > 0) sections.push({ title: 'Invocations', items: lcd.invocations });
        if (lcd.maneuvers?.length > 0) sections.push({ title: 'Maneuvers', items: lcd.maneuvers });
        if (lcd.arcaneShots?.length > 0) sections.push({ title: 'Arcane Shots', items: lcd.arcaneShots });
        if (lcd.kenseiWeapons?.length > 0) sections.push({ title: 'Kensei Weapons', items: lcd.kenseiWeapons.map(id => ({ label: id, desc: '' })) });

        if (sections.length > 0) {
            lines.push('<hr class="v1-divider" />');
            for (const sec of sections) {
                lines.push(`<div class="v1-row"><span class="v1-label">${esc(sec.title)}:</span><span>${
                    sec.items.map(o => o.desc
                        ? `<span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(o.label)}" data-tt-text="${esc(o.desc)}">${esc(o.label)}</span>`
                        : esc(o.label),
                    ).join(', ')
                }</span></div>`);
            }
        }
    }

    // Weapons
    if (stats.computedWeapons?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-section-title">Weapons</div>');
        for (const w of stats.computedWeapons) {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            const notes = w.customNotes ? ` <span class="v1-equip-notes">[${esc(w.customNotes)}]</span>` : '';
            lines.push(`<div class="v1-feature-item"><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(w.name)}">${esc(w.name)}</span>: ${hit} to hit, ${esc(w.computedDamage)} ${esc(w.damageType || '')}${notes}</div>`);
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
            lines.push(`<div class="v1-spell-item"><b>Cantrips:</b> ${stats.annotatedCantrips.map(spellHoverSpan).join(', ')}</div>`);
        }
        if (stats.annotatedSpells?.length > 0) {
            lines.push(`<div class="v1-spell-item"><b>${sc.isPrepared ? 'Prepared' : 'Known'}:</b> ${stats.annotatedSpells.map(spellHoverSpan).join(', ')}</div>`);
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

    if (stats.classFeatures?.length > 0) {
        lines.push('<hr class="v1-divider" />');
        lines.push('<div class="v1-section-title">Class Features</div>');
        for (const feat of stats.classFeatures) {
            const tag = feat.featureSource === 'subclass' ? 'Subclass — ' : '';
            lines.push(`<div class="v1-feature-item"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(tag + feat.name)}" data-tt-text="${esc(feat.description || '')}"><b>Lv ${feat.level}: ${esc(feat.name)}</b></span></div>`);
        }
    }

    // Feats
    if (stats.chosenFeats?.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Feats:</span><span>${stats.chosenFeats.map(f => `<span class="dnd-tt-hover" data-tt-type="feat" data-tt-name="${esc(f)}">${esc(f)}</span>`).join(', ')}</span></div>`);
    }

    lines.push('</div>');
    return lines.join('\n');
}

/**
 * Render the detail modal with full stat block.
 */
export function renderV2DetailModal() {
    if (!characterV2) return;

    const stats = computeV2CharacterStats(characterV2);
    if (!stats) return;

    const titleEl = document.getElementById('dnd-v1-detail-title');
    if (titleEl) {
        titleEl.textContent = `${stats.name || 'Character'} — Details`;
    }

    const body = document.getElementById('dnd-v1-detail-body');
    if (!body) return;

    body.innerHTML = buildDetailContent(stats);
    bindTooltipEvents(body);
}

function buildDetailContent(stats) {
    const lines = [];
    const sub = stats.subclassName ? ` (${stats.subclassName})` : '';

    lines.push(`<h4>${esc(stats.name || 'Unnamed')}</h4>`);
    lines.push(`<p>${esc(stats.speciesName)} ${esc(stats.className)}${esc(sub)} — Level ${stats.level}</p>`);
    lines.push(`<p>Background: ${esc(stats.backgroundName)}</p>`);
    const detailAcParts = (stats.acBreakdown || []).map(b => {
        const val = b.isBase ? `${b.value}` : (b.value >= 0 ? `+${b.value}` : `${b.value}`);
        return `${b.label} ${val}`;
    });
    const detailAcNote = detailAcParts.length > 0 ? ` (${detailAcParts.join(', ')})` : '';
    lines.push(`<p><b>HP:</b> ${stats.hp} | <b>AC:</b> ${stats.ac}${detailAcNote} | <b>Speed:</b> ${stats.speed}ft | <b>Prof:</b> +${stats.proficiency} | <b>Hit Die:</b> d${stats.hitDie}</p>`);

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
    const detailSaveSuffix = stats.saveBonusSources?.length > 0
        ? ` <em>(includes ${esc(stats.saveBonusSources.join(', '))})</em>`
        : '';
    lines.push(`<p><b>Saves:</b> ${saveStr}${detailSaveSuffix}</p>`);

    // All skills
    lines.push('<p><b>Skills:</b></p><ul>');
    for (const [, skill] of Object.entries(stats.skills)) {
        if (skill.proficient || skill.expertise) {
            const mark = skill.expertise ? ' (expertise)' : '';
            lines.push(`<li>${esc(skill.label)}: ${skill.mod >= 0 ? '+' : ''}${skill.mod}${mark}</li>`);
        }
    }
    lines.push('</ul>');

    // Senses & languages
    if (stats.senses?.length > 0) {
        lines.push(`<p><b>Senses:</b> ${esc(stats.senses.join(', '))}</p>`);
    }
    if (stats.languages?.length > 0) {
        lines.push(`<p><b>Languages:</b> ${esc(stats.languages.join(', '))}</p>`);
    }

    // Class Resources
    if (stats.classResources?.length > 0) {
        const resParts = stats.classResources.map(r => `<b>${esc(String(r.value))}</b> ${esc(r.label)} /${r.recharge}`);
        lines.push(`<p><b>Resources:</b> ${resParts.join(' &middot; ')}</p>`);
    }

    // Level Choice Details (Metamagic, Invocations, etc.)
    if (stats.levelChoiceDetails) {
        const lcd = stats.levelChoiceDetails;
        if (lcd.pactBoon) {
            const pb = lcd.pactBoon;
            lines.push(`<p><b>Pact Boon:</b> <span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(pb.label)}" data-tt-text="${esc(pb.desc)}">${esc(pb.label)}</span></p>`);
        }
        const detailSections = [
            { title: 'Metamagic', items: lcd.metamagic },
            { title: 'Eldritch Invocations', items: lcd.invocations },
            { title: 'Battle Master Maneuvers', items: lcd.maneuvers },
            { title: 'Arcane Shot Options', items: lcd.arcaneShots },
            { title: 'Kensei Weapons', items: lcd.kenseiWeapons?.map(id => ({ label: id, desc: '' })) },
        ];
        for (const sec of detailSections) {
            if (sec.items?.length > 0) {
                lines.push(`<p><b>${esc(sec.title)}:</b></p><ul>`);
                for (const o of sec.items) {
                    const tip = o.desc
                        ? ` class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(o.label)}" data-tt-text="${esc(o.desc)}"`
                        : '';
                    lines.push(`<li><span${tip}>${esc(o.label)}</span>${o.desc ? `: ${esc(o.desc)}` : ''}</li>`);
                }
                lines.push('</ul>');
            }
        }
    }

    // Equipment
    if (stats.equippedArmor || stats.hasShield || stats.computedWeapons?.length > 0) {
        lines.push('<p><b>Equipment:</b></p><ul>');
        if (stats.equippedArmor) lines.push(`<li>Armor: <span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(stats.equippedArmor.name)}">${esc(stats.equippedArmor.name)}</span></li>`);
        if (stats.hasShield) lines.push('<li>Shield</li>');
        for (const w of (stats.computedWeapons || [])) {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            lines.push(`<li><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(w.name)}">${esc(w.name)}</span>: ${hit} to hit, ${esc(w.computedDamage)} ${esc(w.damageType || '')}</li>`);
        }
        lines.push('</ul>');
    }

    // Spellcasting
    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        lines.push(`<p><b>Spellcasting (${esc(sc.abilityLabel)}):</b> Attack +${sc.attackMod}, Save DC ${sc.saveDC}</p>`);
        lines.push(`<p>Slots: ${esc(sc.slotsStr)}</p>`);

        if (stats.annotatedCantrips?.length > 0) {
            lines.push(`<p><b>Cantrips:</b> ${stats.annotatedCantrips.map(spellHoverSpan).join(', ')}</p>`);
        }
        if (stats.annotatedSpells?.length > 0) {
            lines.push(`<p><b>${sc.isPrepared ? 'Prepared' : 'Known'} Spells:</b> ${stats.annotatedSpells.map(spellHoverSpan).join(', ')}</p>`);
        }
    }

    // Species traits
    if (stats.speciesTraits?.length > 0) {
        lines.push('<p><b>Species Traits:</b></p><ul>');
        for (const t of stats.speciesTraits) {
            lines.push(`<li><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(t.name)}" data-tt-text="${esc(t.description)}"><b>${esc(t.name)}</b></span>: ${esc(t.description)}</li>`);
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

    if (stats.classFeatures?.length > 0) {
        lines.push('<p><b>Class Features:</b></p><ul>');
        for (const feat of stats.classFeatures) {
            const tag = feat.featureSource === 'subclass' ? 'Subclass — ' : '';
            lines.push(`<li><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(tag + feat.name)}" data-tt-text="${esc(feat.description || '')}"><b>Lv ${feat.level}: ${esc(feat.name)}</b></span>: ${esc(feat.description)}</li>`);
        }
        lines.push('</ul>');
    }

    // Feats
    if (stats.chosenFeats?.length > 0) {
        lines.push(`<p><b>Feats:</b> ${stats.chosenFeats.map(f => `<span class="dnd-tt-hover" data-tt-type="feat" data-tt-name="${esc(f)}">${esc(f)}</span>`).join(', ')}</p>`);
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
