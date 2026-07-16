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

    // Size / Creature Type
    const sizeType = [stats.speciesSize, stats.speciesCreatureType].filter(Boolean).join(' ');
    if (sizeType) {
        lines.push(`<div class="v1-row"><span class="v1-label">Size/Type:</span><span>${esc(sizeType)}</span></div>`);
    }

    // Resistances
    if (stats.speciesResistances?.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Resistances:</span><span>${esc(stats.speciesResistances.join(', '))}</span></div>`);
    }

    // Proficiencies (armor | weapons | tools)
    const profParts = [];
    if (stats.armorProficiencies?.length > 0) {
        profParts.push(stats.armorProficiencies.map(p => esc(p.charAt(0).toUpperCase() + p.slice(1))).join(', '));
    }
    if (stats.weaponProficiencies?.length > 0) {
        profParts.push(stats.weaponProficiencies.map(p => esc(p.charAt(0).toUpperCase() + p.slice(1))).join(', '));
    }
    if (stats.toolProficiencies?.length > 0) {
        profParts.push(stats.toolProficiencies.map(p => esc(p)).join(', '));
    }
    if (profParts.length > 0) {
        lines.push(`<div class="v1-row"><span class="v1-label">Profs:</span><span>${profParts.join(' · ')}</span></div>`);
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

    // Spellcasting (header + slots only, no spell lists)
    if (stats.spellcasting) {
        lines.push('<hr class="v1-divider" />');
        const sc = stats.spellcasting;
        lines.push(`<div class="v1-section-title">Spellcasting (${esc(sc.abilityLabel)})</div>`);
        lines.push(`<div class="v1-row">
            <span>Attack: +${sc.attackMod}</span>
            <span>Save DC: ${sc.saveDC}</span>
            <span>Slots: ${esc(sc.slotsStr)}</span>
        </div>`);
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
    const L = [];
    const sub = stats.subclassName ? ` (${stats.subclassName})` : '';
    const sizeType = [stats.speciesSize, stats.speciesCreatureType].filter(Boolean).join(' ');

    // ── HEADER (full span) ──
    L.push('<div class="cs-grid">');
    L.push('<div class="cs-header">');
    L.push(`<div class="cs-name">${esc(stats.name || 'Unnamed')}</div>`);
    L.push(`<div class="cs-subtitle">${esc(stats.speciesName)} ${esc(stats.className)}${esc(sub)} — Level ${stats.level}</div>`);
    L.push(`<div class="cs-background">Background: ${esc(stats.backgroundName)}${sizeType ? ` · ${esc(sizeType)}` : ''}</div>`);
    L.push('</div>');

    // ── LEFT COLUMN: Abilities, Saves, Skills ──
    L.push('<div class="cs-col-left">');

    // Ability scores
    L.push('<div class="cs-section cs-abilities-section">');
    L.push('<div class="cs-section-title">Ability Scores</div>');
    L.push('<div class="cs-ability-grid">');
    for (const ab of ABILITY_KEYS) {
        const mod = stats.mods[ab];
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        L.push(`<div class="cs-ability-box">
            <div class="cs-ability-label">${ABILITY_LABELS[ab]}</div>
            <div class="cs-ability-mod">${modStr}</div>
            <div class="cs-ability-score">${stats.abilities[ab]}</div>
        </div>`);
    }
    L.push('</div>');
    L.push('</div>');

    // Saving Throws
    L.push('<div class="cs-section">');
    L.push('<div class="cs-section-title">Saving Throws</div>');
    for (const ab of ABILITY_KEYS) {
        const s = stats.saves[ab];
        const prof = s.proficient ? '<i class="fa-solid fa-circle cs-prof-dot"></i>' : '<i class="fa-regular fa-circle cs-prof-dot cs-prof-empty"></i>';
        L.push(`<div class="cs-save-row">${prof} <span class="cs-save-mod">${s.mod >= 0 ? '+' : ''}${s.mod}</span> ${ABILITY_LABELS[ab]}</div>`);
    }
    if (stats.saveBonusSources?.length > 0) {
        L.push(`<div class="cs-note">${esc(stats.saveBonusSources.join(', '))}</div>`);
    }
    L.push('</div>');

    // Skills
    L.push('<div class="cs-section">');
    L.push('<div class="cs-section-title">Skills</div>');
    for (const [, skill] of Object.entries(stats.skills)) {
        if (!skill.proficient && !skill.expertise) continue;
        const mark = skill.expertise ? ' <span class="cs-expertise-tag">E</span>' : '';
        const prof = '<i class="fa-solid fa-circle cs-prof-dot"></i>';
        L.push(`<div class="cs-skill-row">${prof} <span class="cs-save-mod">${skill.mod >= 0 ? '+' : ''}${skill.mod}</span> ${esc(skill.label)}${mark}</div>`);
    }
    L.push('</div>');

    L.push('</div>'); // end cs-col-left

    // ── CENTER COLUMN: Combat, Equipment, Resources, Level Choices ──
    L.push('<div class="cs-col-center">');

    // Combat Stats
    const acTooltipLines = (stats.acBreakdown || []).map(b => {
        const val = b.isBase ? `${b.value}` : (b.value >= 0 ? `+${b.value}` : `${b.value}`);
        return `${b.label}: ${val}`;
    });
    const acTooltip = acTooltipLines.length > 0
        ? ` class="dnd-tt-hover" data-tt-type="trait" data-tt-name="AC ${stats.ac}" data-tt-sub="Breakdown" data-tt-text="${esc(acTooltipLines.join('\n'))}"`
        : '';

    L.push('<div class="cs-section cs-combat-section">');
    L.push('<div class="cs-combat-row">');
    L.push(`<div class="cs-combat-box"><div class="cs-combat-val">${stats.hp}</div><div class="cs-combat-lbl">HP</div></div>`);
    L.push(`<div class="cs-combat-box"${acTooltip}><div class="cs-combat-val">${stats.ac}</div><div class="cs-combat-lbl">AC</div></div>`);
    L.push(`<div class="cs-combat-box"><div class="cs-combat-val">${stats.speed}ft</div><div class="cs-combat-lbl">Speed</div></div>`);
    L.push(`<div class="cs-combat-box"><div class="cs-combat-val">+${stats.proficiency}</div><div class="cs-combat-lbl">Prof</div></div>`);
    L.push(`<div class="cs-combat-box"><div class="cs-combat-val">d${stats.hitDie}</div><div class="cs-combat-lbl">Hit Die</div></div>`);
    L.push('</div>');
    L.push('</div>');

    // Equipment
    if (stats.equippedArmor || stats.hasShield || stats.computedWeapons?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Equipment</div>');
        if (stats.equippedArmor) {
            L.push(`<div class="cs-equip-row"><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(stats.equippedArmor.name)}">${esc(stats.equippedArmor.name)}</span> <span class="cs-equip-tag">Armor</span></div>`);
        }
        if (stats.hasShield) {
            L.push('<div class="cs-equip-row">Shield <span class="cs-equip-tag">Shield</span></div>');
        }
        for (const w of (stats.computedWeapons || [])) {
            const hit = w.computedHit >= 0 ? `+${w.computedHit}` : `${w.computedHit}`;
            const notes = w.customNotes ? ` <span class="cs-note">[${esc(w.customNotes)}]</span>` : '';
            L.push(`<div class="cs-equip-row"><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${esc(w.name)}">${esc(w.name)}</span>: ${hit}, ${esc(w.computedDamage)} ${esc(w.damageType || '')}${notes}</div>`);
        }
        L.push('</div>');
    }

    // Class Resources
    if (stats.classResources?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Resources</div>');
        for (const r of stats.classResources) {
            L.push(`<div class="cs-resource-row"><b>${esc(String(r.value))}</b> ${esc(r.label)} <span class="cs-recharge">/${r.recharge}</span></div>`);
        }
        L.push('</div>');
    }

    // Level Choice Details
    if (stats.levelChoiceDetails) {
        const lcd = stats.levelChoiceDetails;
        const hasSections = lcd.pactBoon || lcd.metamagic?.length || lcd.invocations?.length || lcd.maneuvers?.length || lcd.arcaneShots?.length || lcd.kenseiWeapons?.length;
        if (hasSections) {
            L.push('<div class="cs-section">');
            L.push('<div class="cs-section-title">Class Choices</div>');
            if (lcd.pactBoon) {
                const pb = lcd.pactBoon;
                L.push(`<div class="cs-choice-row"><b>Pact Boon:</b> <span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(pb.label)}" data-tt-text="${esc(pb.desc)}">${esc(pb.label)}</span></div>`);
            }
            const choiceSections = [
                { title: 'Metamagic', items: lcd.metamagic },
                { title: 'Invocations', items: lcd.invocations },
                { title: 'Maneuvers', items: lcd.maneuvers },
                { title: 'Arcane Shots', items: lcd.arcaneShots },
                { title: 'Kensei Weapons', items: lcd.kenseiWeapons?.map(id => ({ label: id, desc: '' })) },
            ];
            for (const sec of choiceSections) {
                if (!sec.items?.length) continue;
                L.push(`<div class="cs-choice-row"><b>${esc(sec.title)}:</b> ${
                    sec.items.map(o => o.desc
                        ? `<span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(o.label)}" data-tt-text="${esc(o.desc)}">${esc(o.label)}</span>`
                        : esc(o.label),
                    ).join(', ')
                }</div>`);
            }
            L.push('</div>');
        }
    }

    // Combat Notes
    if (stats.combatNotes?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Combat Notes</div>');
        for (const note of stats.combatNotes) {
            L.push(`<div class="cs-note-row">${esc(note)}</div>`);
        }
        L.push('</div>');
    }

    L.push('</div>'); // end cs-col-center

    // ── RIGHT COLUMN: Proficiencies, Senses, Traits, Features ──
    L.push('<div class="cs-col-right">');

    // Proficiencies
    L.push('<div class="cs-section">');
    L.push('<div class="cs-section-title">Proficiencies</div>');
    if (stats.armorProficiencies?.length > 0) {
        L.push(`<div class="cs-prof-row"><span class="cs-prof-label">Armor</span> ${stats.armorProficiencies.map(p => esc(p.charAt(0).toUpperCase() + p.slice(1))).join(', ')}</div>`);
    }
    if (stats.weaponProficiencies?.length > 0) {
        L.push(`<div class="cs-prof-row"><span class="cs-prof-label">Weapons</span> ${stats.weaponProficiencies.map(p => esc(p.charAt(0).toUpperCase() + p.slice(1))).join(', ')}</div>`);
    }
    if (stats.toolProficiencies?.length > 0) {
        L.push(`<div class="cs-prof-row"><span class="cs-prof-label">Tools</span> ${stats.toolProficiencies.map(p => esc(p)).join(', ')}</div>`);
    }
    L.push('</div>');

    // Senses, Languages, Resistances
    L.push('<div class="cs-section">');
    L.push('<div class="cs-section-title">Senses & Languages</div>');
    if (stats.senses?.length > 0) {
        L.push(`<div class="cs-info-row"><span class="cs-prof-label">Senses</span> ${esc(stats.senses.join(', '))}</div>`);
    }
    if (stats.languages?.length > 0) {
        L.push(`<div class="cs-info-row"><span class="cs-prof-label">Languages</span> ${esc(stats.languages.join(', '))}</div>`);
    }
    if (stats.speciesResistances?.length > 0) {
        L.push(`<div class="cs-info-row"><span class="cs-prof-label">Resistances</span> ${esc(stats.speciesResistances.join(', '))}</div>`);
    }
    L.push('</div>');

    // Species Traits
    if (stats.speciesTraits?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Species Traits</div>');
        for (const t of stats.speciesTraits) {
            L.push(`<div class="cs-trait-row"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(t.name)}" data-tt-text="${esc(t.description)}"><b>${esc(t.name)}</b></span>: ${esc(t.description)}</div>`);
        }
        L.push('</div>');
    }

    // Class Features
    if (stats.classFeatures?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Class Features</div>');
        for (const feat of stats.classFeatures) {
            const tag = feat.featureSource === 'subclass' ? 'Subclass — ' : '';
            L.push(`<div class="cs-feature-row"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${esc(tag + feat.name)}" data-tt-text="${esc(feat.description || '')}"><b>Lv ${feat.level}: ${esc(feat.name)}</b></span></div>`);
        }
        L.push('</div>');
    }

    // Feats
    if (stats.chosenFeats?.length > 0) {
        L.push('<div class="cs-section">');
        L.push('<div class="cs-section-title">Feats</div>');
        L.push(`<div class="cs-feat-list">${stats.chosenFeats.map(f => `<span class="dnd-tt-hover cs-feat-tag" data-tt-type="feat" data-tt-name="${esc(f)}">${esc(f)}</span>`).join(' ')}</div>`);
        L.push('</div>');
    }

    L.push('</div>'); // end cs-col-right

    // ── SPELLCASTING (full span) ──
    if (stats.spellcasting) {
        const sc = stats.spellcasting;

        // Merge all cantrips: class + bonus
        const allCantrips = [...(stats.annotatedCantrips || [])];
        const cantripSources = new Map();
        for (const c of (stats.featBonusCantrips || [])) {
            if (!allCantrips.some(ac => ac.name === c.name)) {
                allCantrips.push({ name: c.name, annotation: c.name, info: null });
            }
            cantripSources.set(c.name, c.source);
        }

        // Merge all spells: class + subclass + bonus
        const allSpells = [...(stats.annotatedSpells || [])];
        const spellSources = new Map();
        for (const name of (stats.subclassSpells || [])) {
            if (!allSpells.some(s => s.name === name)) {
                allSpells.push({ name, annotation: name, info: null });
            }
            spellSources.set(name, stats.subclassSpellsAreKnown ? 'Subclass' : 'Subclass (Always Prepared)');
        }
        for (const s of (stats.featBonusSpells || [])) {
            if (!allSpells.some(sp => sp.name === s.name)) {
                allSpells.push({ name: s.name, annotation: s.name, info: null });
            }
            spellSources.set(s.name, s.source);
        }

        L.push('<div class="cs-spells">');
        L.push(`<div class="cs-section-title">Spellcasting <span class="cs-spell-meta">(${esc(sc.abilityLabel)}) Attack +${sc.attackMod} · Save DC ${sc.saveDC}</span></div>`);
        L.push(`<div class="cs-spell-slots">Slots: ${esc(sc.slotsStr)}</div>`);

        if (allCantrips.length > 0) {
            L.push('<div class="cs-spell-group"><b>Cantrips:</b> ');
            L.push(allCantrips.map(c => {
                const src = cantripSources.get(c.name);
                const srcTag = src ? ` <span class="dnd-v1-spell-source-tag">${esc(src)}</span>` : '';
                return spellHoverSpan(c) + srcTag;
            }).join(', '));
            L.push('</div>');
        }

        if (allSpells.length > 0) {
            const label = sc.isPrepared ? 'Prepared' : 'Known';
            L.push(`<div class="cs-spell-group"><b>${label} Spells:</b> `);
            L.push(allSpells.map(s => {
                const src = spellSources.get(s.name) || s.extraSource;
                const srcTag = src ? ` <span class="dnd-v1-spell-source-tag">${esc(src)}</span>` : '';
                return spellHoverSpan(s) + srcTag;
            }).join(', '));
            L.push('</div>');
        }

        L.push('</div>');
    }

    // ── COMPANION SUMMARY (full span, only if has access) ──
    if (stats.companion || stats.familiarStats) {
        L.push('<div class="cs-companion">');
        L.push('<div class="cs-section-title">Companion</div>');
        if (stats.companion) {
            const c = stats.companion;
            const displayName = c.customName || c.name;
            L.push(`<div class="cs-companion-line"><b>${esc(displayName)}</b> (${esc(c.size)} ${esc(c.type)}) — HP ${c.hp} · AC ${c.ac} · Speed ${esc(c.speed)}</div>`);
        } else if (stats.familiarStats) {
            const f = stats.familiarStats;
            const displayName = f.customName || f.label;
            const typeLabel = f.creatureType ? f.creatureType.charAt(0).toUpperCase() + f.creatureType.slice(1) : f.type;
            L.push(`<div class="cs-companion-line"><b>${esc(displayName)}</b> (${esc(f.size)} ${esc(typeLabel)}) — HP ${f.hp} · AC ${f.ac} · Speed ${esc(f.speed)}</div>`);
        }
        L.push('</div>');
    }

    L.push('</div>'); // end cs-grid
    return L.join('\n');
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
