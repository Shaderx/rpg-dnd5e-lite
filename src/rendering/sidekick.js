/**
 * D&D 5e Lite - Sidekick Rendering
 * Card grid panel renderer + detail modal populator.
 */

import { sidekicks, headerInfo } from '../core/state.js';
import { computeSidekickStats, getSidekickLevel, getModStr, SIDEKICK_TYPES, SKILL_LABELS, ALL_SKILLS, calculateHireCost, getSpellDamageInfo, buildSpellAnnotation } from '../features/sidekick.js';

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
        if (sk.hireDate || sk.hireGoldPerDay > 0 || sk.hirePayMode === 'free') {
            const parts = [];
            if (sk.hireDate) parts.push(`<span class="dnd-sk-card-hire-date">${escHtml(sk.hireDate)}</span>`);
            if (sk.hirePayMode === 'free') {
                parts.push(`<span class="dnd-sk-card-paid">oathbound</span>`);
            } else if (sk.hireGoldPerDay > 0) {
                parts.push(`<span class="dnd-sk-card-rate">${sk.hireGoldPerDay}gp/day</span>`);
                const cost = calculateHireCost(sk.hireDate, currentDate, sk.hireGoldPerDay, sk.hirePayMode, sk.hirePaidAmount);
                if (cost && cost.daysElapsed > 0) {
                    if (sk.hirePayMode === 'daily') {
                        parts.push(`<span class="dnd-sk-card-paid">paid daily<span class="dnd-sk-card-days">(${cost.daysElapsed}d)</span></span>`);
                    } else if (cost.goldOwed > 0) {
                        parts.push(`<span class="dnd-sk-card-owed">${cost.goldOwed}gp owed<span class="dnd-sk-card-days">(${cost.daysElapsed}d)</span></span>`);
                    } else {
                        parts.push(`<span class="dnd-sk-card-paid">paid up<span class="dnd-sk-card-days">(${cost.daysElapsed}d)</span></span>`);
                    }
                }
            }
            hireHtml = `<div class="dnd-sk-card-hire">${parts.join('')}</div>`;
        }

        // Compact stat pills
        const armorLabel = sk.equippedArmor ? sk.equippedArmor.name : '';
        const shieldLabel = sk.hasShield ? '+Shld' : '';
        const acTitle = [armorLabel, shieldLabel].filter(Boolean).join(', ') || 'Unarmored';
        const statPills = `<div class="dnd-sk-card-stats">
            <span class="dnd-sk-pill dnd-sk-pill-hp">HP ${stats.hp}</span>
            <span class="dnd-sk-pill" title="${escHtml(acTitle)}">AC ${stats.ac}</span>
            <span class="dnd-sk-pill">+${stats.proficiency}</span>
        </div>`;

        // Ability scores row
        const abilRow = ['str','dex','con','int','wis','cha']
            .map(a => `<span class="dnd-sk-card-ab"><b>${a[0].toUpperCase()}</b>${stats.scores[a]}</span>`)
            .join('');

        // Actions & weapons summary
        const actionNames = (sk.creatureActions || []).filter(a => a.enabled).map(a => a.name);
        const weaponNames = (sk.weapons || []).map(w => w.name);
        const allNames = [...actionNames, ...weaponNames];
        let weaponHtml = '';
        if (allNames.length > 0) {
            const wStr = allNames.join(', ');
            weaponHtml = `<div class="dnd-sk-card-weapons"><i class="fa-solid fa-crosshairs"></i> ${escHtml(wStr)}</div>`;
        }

        return `<div class="dnd-sidekick-card ${enabledClass}" data-sk-id="${sk.id}" title="Click for details, Shift+click to toggle injection">
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
        <div class="dnd-sk-det-meta">${escHtml(sk.race || '')} <span class="dnd-tt-hover" data-tt-type="creature" data-tt-name="${escHtml(sk.creatureName || '')}">${escHtml(sk.creatureName || '')}</span> &mdash; ${typeLabel}${subLabel} (Lv ${level})</div>
    </div>`);

    const armorNote = sk.equippedArmor ? `(${sk.equippedArmor.name}${sk.hasShield ? ' + Shield' : ''})` : (sk.hasShield ? '(Shield)' : '');
    sections.push(`<div class="dnd-sk-det-row dnd-sk-det-combat">
        <span>HP <strong>${stats.hp}</strong></span>
        <span>AC <strong>${stats.ac}</strong> ${armorNote}</span>
        <span>SPD <strong>${sk.speedFull || sk.baseSpeed + 'ft'}</strong></span>
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

    if (sk.senses) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Senses</div><div>${escHtml(sk.senses)}</div></div>`);
    }
    if (sk.languages || sk.chosenLanguages?.length > 0) {
        const allLangs = [...(sk.languagesFixed || []), ...(sk.chosenLanguages || [])];
        const langDisplay = allLangs.length > 0 ? allLangs.join(', ') : escHtml(sk.languages);
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Languages</div><div>${langDisplay}</div></div>`);
    }

    // Equipment summary
    const equipParts = [];
    if (sk.equippedArmor) equipParts.push(`<span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${escHtml(sk.equippedArmor.name)}">${escHtml(sk.equippedArmor.name)}</span> (${escHtml(sk.equippedArmor.type)})`);
    if (sk.hasShield) equipParts.push(`<span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="Shield">Shield</span> (+2 AC)`);
    if (equipParts.length > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Armor</div><div>${equipParts.join(', ')}</div></div>`);
    }

    const enabledTraits = (sk.creatureTraits || []).filter(t => t.enabled);
    if (enabledTraits.length > 0) {
        const tLines = enabledTraits.map(t =>
            `<div class="dnd-sk-det-weapon"><span class="dnd-tt-hover" data-tt-type="trait" data-tt-name="${escHtml(t.name)}" data-tt-text="${escHtml(t.text)}"><strong>${escHtml(t.name)}.</strong></span> ${escHtml(t.text)}</div>`
        );
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Traits</div>${tLines.join('')}</div>`);
    }

    const computedActions = (stats.computedActions || []).filter(a => a.enabled);
    if (computedActions.length > 0) {
        const aLines = computedActions.map(a => {
            let statLine = '';
            if (a.computedHit != null || a.computedDamage || a.computedDc != null) {
                const parts = [];
                if (a.computedHit != null) parts.push(`<strong>${a.computedHit >= 0 ? '+' : ''}${a.computedHit}</strong> to hit`);
                if (a.computedDamage) parts.push(`<strong>${escHtml(a.computedDamage)}</strong> dmg`);
                if (a.computedDc != null) parts.push(`DC <strong>${a.computedDc}</strong>`);
                statLine = ` <span class="dnd-sk-det-computed">[${parts.join(', ')}]</span>`;
            }
            return `<div class="dnd-sk-det-weapon"><strong>${escHtml(a.name)}.</strong> ${escHtml(a.text)}${statLine}</div>`;
        });
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Actions</div>${aLines.join('')}</div>`);
    }

    const computedWeapons = stats.computedWeapons || [];
    if (computedWeapons.length > 0) {
        const wLines = computedWeapons.map(w => {
            const hitStr = `+${w.computedHit}`;
            let desc = `${hitStr} to hit, ${w.computedDamage} ${w.damageType}`;
            if (w.computedVersatile) desc += `, versatile ${w.computedVersatile}`;
            if (w.range) desc += `, ${w.attackType?.includes('mw') ? 'thrown' : 'range'} ${w.range}`;
            const props = (w.properties || []).filter(p => p !== 'Versatile' || !w.versatileDice).join(', ');
            if (props) desc += ` [${props}]`;
            return `<div class="dnd-sk-det-weapon"><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${escHtml(w.name)}">${escHtml(w.name)}</span> (${desc})</div>`;
        });
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Extra Weapons</div>${wLines.join('')}</div>`);
    }

    const RARITY_HIDE = new Set(['unknown', 'unknown (magic)', 'none']);
    if (sk.items?.length > 0) {
        const iLines = sk.items.map(it => {
            const rarity = it.rarity && !RARITY_HIDE.has(it.rarity) ? ` (${it.rarity})` : '';
            return `<div class="dnd-sk-det-weapon"><span class="dnd-tt-hover" data-tt-type="equipment" data-tt-name="${escHtml(it.name)}">${escHtml(it.name)}</span>${rarity}</div>`;
        });
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Items</div>${iLines.join('')}</div>`);
    }

    if (stats.spellcasting) {
        const sc = stats.spellcasting;
        sections.push(`<div class="dnd-sk-det-section">
            <div class="dnd-sk-det-label">Spellcasting (${sc.abilityLabel})</div>
            <div>Spell Attack: <strong>+${sc.attackMod}</strong> | Spell Save DC: <strong>${sc.saveDC}</strong> | Slots: ${sc.slotsStr || 'none'}</div>
        </div>`);
        if (sk.knownCantrips?.length > 0) {
            const ctTags = sk.knownCantrips.map(n => {
                const info = getSpellDamageInfo(n, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                const ann = buildSpellAnnotation(n, info);
                const suffix = ann !== n ? ` ${ann.slice(n.length)}` : '';
                return `<span class="dnd-tt-hover" data-tt-type="spell" data-tt-name="${escHtml(n)}">${escHtml(n)}</span>${escHtml(suffix)}`;
            });
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Cantrips (${sk.knownCantrips.length}/${sc.cantripsKnown})</div><div>${ctTags.join(', ')}</div></div>`);
        }
        if (sk.knownSpells?.length > 0) {
            const spTags = sk.knownSpells.map(n => {
                const info = getSpellDamageInfo(n, level, stats.potentCantripMod, stats.empoweredSchool, stats.empoweredMod);
                const ann = buildSpellAnnotation(n, info);
                const suffix = ann !== n ? ` ${ann.slice(n.length)}` : '';
                return `<span class="dnd-tt-hover" data-tt-type="spell" data-tt-name="${escHtml(n)}">${escHtml(n)}</span>${escHtml(suffix)}`;
            });
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Spells (${sk.knownSpells.length}/${sc.spellsKnown})</div><div>${spTags.join(', ')}</div></div>`);
        }
    }

    if (stats.features?.length > 0) {
        const fLines = stats.features.map(f => {
            const warnClass = f.needsChoice ? ' dnd-sk-det-warn' : '';
            return `<div class="dnd-sk-det-weapon${warnClass}"><span class="dnd-tt-hover" data-tt-type="feature" data-tt-name="${escHtml(f.name)}" data-tt-text="${escHtml(f.text)}"><strong>${escHtml(f.name)}.</strong></span> ${escHtml(f.text)}</div>`;
        });
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Features</div>${fLines.join('')}</div>`);
    }

    if (stats.chosenFeats?.length > 0) {
        const fLines = stats.chosenFeats.map(name =>
            `<span class="dnd-tt-hover" data-tt-type="feat" data-tt-name="${escHtml(name)}">${escHtml(name)}</span>`
        );
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Feats</div><div>${fLines.join(', ')}</div></div>`);
    }

    const fe = stats.featEffects;
    if (fe) {
        if (fe.toolProficiencies?.length > 0) {
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Tool Proficiencies</div><div>${fe.toolProficiencies.map(t => escHtml(t)).join(', ')}</div></div>`);
        }
        if (fe.bonusCantrips?.length > 0 || fe.bonusSpells?.length > 0) {
            const items = [...(fe.bonusCantrips || []), ...(fe.bonusSpells || [])].map(s => {
                const free = s.freeCast ? ' <em>[1/LR free]</em>' : '';
                return `<span class="dnd-tt-hover" data-tt-type="spell" data-tt-name="${escHtml(s.name)}">${escHtml(s.name)}</span>${free} <small>(${escHtml(s.source)})</small>`;
            });
            sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Feat Spells</div><div>${items.join(', ')}</div></div>`);
        }
    }

    if (stats.extraAttack > 0) {
        sections.push(`<div class="dnd-sk-det-section"><div class="dnd-sk-det-label">Extra Attack</div><div>${stats.extraAttack} attacks per Attack action</div></div>`);
    }

    if (sk.hireGoldPerDay > 0 || sk.hireDate || sk.hirePayMode === 'free') {
        const parts = [];
        if (sk.hirePayMode === 'free') {
            parts.push('Oathbound — no payment required');
        } else {
            if (sk.hireGoldPerDay > 0) parts.push(`${sk.hireGoldPerDay}gp/day`);
            if (sk.hirePayMode === 'daily') {
                parts.push('(paid daily)');
            } else if (sk.hirePaidAmount > 0) {
                parts.push(`(${sk.hirePaidAmount}gp paid)`);
            }
        }
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
