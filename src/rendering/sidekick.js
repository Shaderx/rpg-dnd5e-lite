/**
 * D&D 5e Lite - Sidekick Rendering
 * Card grid panel renderer + detail modal populator.
 */

import { sidekicks, headerInfo } from '../core/state.js';
import { computeSidekickStats, getSidekickLevel, getModStr, SIDEKICK_TYPES, SKILL_LABELS, ALL_SKILLS, calculateHireCost } from '../features/sidekick.js';

const TYPE_ICONS = { expert: 'fa-hat-wizard', spellcaster: 'fa-wand-sparkles', warrior: 'fa-shield-halved' };

export function renderSidekickCards() {
    const container = document.getElementById('dnd-sidekick-cards');
    if (!container) return;

    if (!sidekicks || sidekicks.length === 0) {
        container.innerHTML = '<div class="dnd-empty-state">No sidekicks configured</div>';
        return;
    }

    const level = getSidekickLevel();
    const currentDate = headerInfo?.date || null;

    const cards = sidekicks.map(sk => {
        const typeInfo = SIDEKICK_TYPES[sk.type];
        const subInfo = typeInfo?.subtypes?.find(s => s.key === sk.subtype);
        const typeLabel = typeInfo?.label || sk.type;
        const subLabel = subInfo ? subInfo.label : '';
        const enabledClass = sk.enabled ? 'dnd-sidekick-enabled' : 'dnd-sidekick-disabled';
        const typeIcon = TYPE_ICONS[sk.type] || 'fa-user';
        const stats = computeSidekickStats(sk, level);

        // Hire cost calculation
        let hireHtml = '';
        if (sk.hireDate || sk.hireGoldPerDay > 0) {
            const parts = [];
            if (sk.hireDate) parts.push(`<span class="dnd-sk-card-hire-date">${escHtml(sk.hireDate)}</span>`);
            if (sk.hireGoldPerDay > 0) {
                parts.push(`<span class="dnd-sk-card-rate">${sk.hireGoldPerDay}gp/day</span>`);
                const cost = calculateHireCost(sk.hireDate, currentDate, sk.hireGoldPerDay);
                if (cost && cost.daysElapsed > 0) {
                    parts.push(`<span class="dnd-sk-card-owed">${cost.goldOwed}gp owed<span class="dnd-sk-card-days">(${cost.daysElapsed}d)</span></span>`);
                }
            }
            hireHtml = `<div class="dnd-sk-card-hire">${parts.join('')}</div>`;
        }

        // Compact stat pills
        const statPills = `<div class="dnd-sk-card-stats">
            <span class="dnd-sk-pill dnd-sk-pill-hp">HP ${stats.hp}</span>
            <span class="dnd-sk-pill">AC ${sk.baseAc}${sk.type === 'warrior' && level >= 10 ? '+1' : ''}</span>
            <span class="dnd-sk-pill">+${stats.proficiency}</span>
        </div>`;

        // Ability scores row
        const abilRow = ['str','dex','con','int','wis','cha']
            .map(a => `<span class="dnd-sk-card-ab"><b>${a[0].toUpperCase()}</b>${stats.scores[a]}</span>`)
            .join('');

        // Weapons summary
        let weaponHtml = '';
        if (sk.weapons?.length > 0) {
            const wStr = sk.weapons.map(w => w.name).join(', ');
            weaponHtml = `<div class="dnd-sk-card-weapons" title="${escHtml(sk.weapons.map(w => `${w.name}: ${w.damageDice} ${w.damageType}`).join('; '))}"><i class="fa-solid fa-crosshairs"></i> ${escHtml(wStr)}</div>`;
        }

        return `<div class="dnd-sidekick-card ${enabledClass}" data-sk-id="${sk.id}" title="Click to toggle injection, Shift+click for details">
            <div class="dnd-sk-card-top">
                <div class="dnd-sk-card-identity">
                    <div class="dnd-sk-card-name">${escHtml(sk.name || 'Unnamed')}</div>
                    <div class="dnd-sk-card-subtitle">${escHtml(sk.race || '')} ${escHtml(sk.creatureName || '')}</div>
                </div>
                <div class="dnd-sk-card-type-badge" title="${typeLabel}${subLabel ? ' / ' + subLabel : ''}">
                    <i class="fa-solid ${typeIcon}"></i>
                    <span>${subLabel || typeLabel}</span>
                </div>
            </div>
            ${statPills}
            <div class="dnd-sk-card-abilities">${abilRow}</div>
            ${weaponHtml}
            ${hireHtml}
            ${sk.enabled ? '' : '<div class="dnd-sk-card-badge-off"><i class="fa-solid fa-eye-slash"></i></div>'}
        </div>`;
    });

    container.innerHTML = cards.join('');
}

export function renderSidekickDetail(sidekickId) {
    const sk = sidekicks.find(s => s.id === sidekickId);
    if (!sk) return;

    const level = getSidekickLevel();
    const stats = computeSidekickStats(sk, level);
    const body = document.getElementById('dnd-sk-detail-body');
    const title = document.getElementById('dnd-sk-detail-title');
    if (!body || !title) return;

    const typeInfo = SIDEKICK_TYPES[sk.type];
    const subInfo = typeInfo?.subtypes?.find(s => s.key === sk.subtype);
    const typeLabel = typeInfo?.label || sk.type;
    const subLabel = subInfo ? ` / ${subInfo.label}` : '';

    title.textContent = sk.name || 'Sidekick Details';

    const sections = [];

    sections.push(`<div class="dnd-sk-det-header">
        <div class="dnd-sk-det-name">${escHtml(sk.name || 'Unnamed')}</div>
        <div class="dnd-sk-det-meta">${escHtml(sk.race || '')} ${escHtml(sk.creatureName || '')} &mdash; ${typeLabel}${subLabel} (Lv ${level})</div>
    </div>`);

    sections.push(`<div class="dnd-sk-det-row dnd-sk-det-combat">
        <span>HP <strong>${stats.hp}</strong></span>
        <span>AC <strong>${sk.baseAc}${sk.type === 'warrior' && level >= 10 ? ' (+1)' : ''}</strong></span>
        <span>SPD <strong>${sk.baseSpeed}ft</strong></span>
        <span>Size <strong>${sk.baseSize}</strong></span>
        <span>Prof <strong>+${stats.proficiency}</strong></span>
        <span>HD <strong>${stats.totalHitDice}d${stats.hitDieFaces}</strong></span>
    </div>`);

    const abilityRow = ['str','dex','con','int','wis','cha']
        .map(a => `<span class="dnd-sk-det-ability"><strong>${a.toUpperCase()}</strong> ${stats.scores[a]}(${getModStr(stats.scores[a])})</span>`)
        .join('');
    sections.push(`<div class="dnd-sk-det-row dnd-sk-det-abilities">${abilityRow}</div>`);

    const saveItems = ['str','dex','con','int','wis','cha']
        .filter(a => stats.saves[a].proficient || stats.saves[a].mod !== 0)
        .map(a => {
            const s = stats.saves[a];
            const mark = s.proficient ? '*' : '';
            const sign = s.mod >= 0 ? '+' : '';
            return `${a.toUpperCase()} ${sign}${s.mod}${mark}`;
        });
    if (saveItems.length > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Saves</div><div>${saveItems.join(', ')}</div></div>`);
    }

    const skillItems = ALL_SKILLS
        .filter(sk2 => stats.skills[sk2].proficient || stats.skills[sk2].expertise)
        .map(sk2 => {
            const s = stats.skills[sk2];
            const mark = s.expertise ? '**' : s.proficient ? '*' : '';
            const sign = s.mod >= 0 ? '+' : '';
            return `${SKILL_LABELS[sk2]} ${sign}${s.mod}${mark}`;
        });
    if (skillItems.length > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Skills</div><div>${skillItems.join(', ')}</div></div>`);
    }

    if (sk.weapons?.length > 0) {
        const wLines = sk.weapons.map(w => {
            let desc = `${w.damageDice} ${w.damageType}`;
            if (w.versatileDice) desc += `, versatile ${w.versatileDice}`;
            if (w.range) desc += `, ${w.attackType?.includes('mw') ? 'thrown' : 'range'} ${w.range}`;
            return `<div class="dnd-sk-det-weapon">${escHtml(w.name)} (${desc})</div>`;
        });
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Weapons</div>${wLines.join('')}</div>`);
    }

    if (sk.specialActions?.length > 0) {
        const aLines = sk.specialActions.map(a =>
            `<div class="dnd-sk-det-weapon"><strong>${escHtml(a.name)}.</strong> ${escHtml(a.text)}</div>`
        );
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Special Actions</div>${aLines.join('')}</div>`);
    }

    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        sections.push(`<div class="dnd-sk-det-section">
            <div class="dnd-sk-det-label">Spellcasting</div>
            <div>${sc.abilityLabel} +${sc.attackMod} | DC ${sc.saveDC} | Slots ${sc.slotsStr || 'none'}</div>
        </div>`);
        if (sk.knownCantrips?.length > 0) {
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Cantrips (${sk.knownCantrips.length}/${sc.cantripsKnown})</div><div>${sk.knownCantrips.map(escHtml).join(', ')}</div></div>`);
        }
        if (sk.knownSpells?.length > 0) {
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Spells (${sk.knownSpells.length}/${sc.spellsKnown})</div><div>${sk.knownSpells.map(escHtml).join(', ')}</div></div>`);
        }
    }

    if (stats.features?.length > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Features</div><div>${stats.features.map(escHtml).join('. ')}.</div></div>`);
    }

    if (stats.extraAttack > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Extra Attack</div><div>${stats.extraAttack} attacks per Attack action</div></div>`);
    }

    if (sk.hireGoldPerDay > 0 || sk.hireDate) {
        const parts = [];
        if (sk.hireGoldPerDay > 0) parts.push(`${sk.hireGoldPerDay}gp/day`);
        if (sk.hireDate) parts.push(`since ${escHtml(sk.hireDate)}`);
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Hire</div><div>${parts.join(' ')}</div></div>`);
    }

    body.innerHTML = sections.join('');
    body.dataset.sidekickId = sidekickId;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
