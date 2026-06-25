/**
 * D&D 5e Lite - Hover Tooltip System
 * Generic tooltip for creatures, spells, equipment, and items.
 */

import { lookupCreatureByName, lookupSpellByName, lookupItemByName, lookupFeatByName, parseFeatAbility } from '../features/sidekick.js';
import { lookupSpellSync } from '../v1/features/spells.js';
import { lookupSpellSync as lookupSpellSyncV2 } from '../v2/features/spells.js';

let activeTooltip = null;
let tooltipTimer = null;
const TOOLTIP_DELAY = 200;

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function strip5eMarkupLight(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/{@atk\s+([^}]+)}/g, (_, k) => {
            const labels = { mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:', ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:', 'mw,rw': 'Melee or Ranged Weapon Attack:', 'rw,mw': 'Melee or Ranged Weapon Attack:' };
            return labels[k.trim()] || `${k.trim()} Attack:`;
        })
        .replace(/{@h}/g, 'Hit: ')
        .replace(/{@hit\s+([^}]+)}/g, (_, n) => `+${n.trim()}`)
        .replace(/{@dc\s+([^}]+)}/g, (_, n) => `DC ${n.trim()}`)
        .replace(/{@damage\s+([^}]+)}/g, (_, d) => d.trim())
        .replace(/{@dice\s+([^}]+)}/g, (_, d) => d.trim())
        .replace(/{@recharge\s*([^}]*)}/g, (_, n) => n ? `(Recharge ${n.trim()})` : '(Recharge)')
        .replace(/{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function flattenEntries(entries) {
    if (!Array.isArray(entries)) return '';
    const parts = [];
    for (const e of entries) {
        if (typeof e === 'string') {
            parts.push(strip5eMarkupLight(e));
        } else if (e?.entries) {
            const heading = e.name ? `<strong>${escHtml(e.name)}.</strong> ` : '';
            parts.push(heading + flattenEntries(e.entries));
        } else if (e?.type === 'list' && Array.isArray(e.items)) {
            parts.push(e.items.map(li => typeof li === 'string' ? strip5eMarkupLight(li) : flattenEntries(li.entries || [])).join('; '));
        } else if (e?.type === 'table') {
            const cols = (e.colLabels || []).map(c => strip5eMarkupLight(c)).join(' | ');
            const rows = (e.rows || []).map(r => r.map(c => strip5eMarkupLight(String(c))).join(' | ')).join('<br>');
            parts.push(`<em>${cols}</em><br>${rows}`);
        }
    }
    return parts.join('<br>');
}

// ─── Feature Descriptions ───────────────────────────────────

const FEATURE_DESC = {
    'Martial Role': 'At 1st level the warrior chooses a martial role: Attacker (+2 to attack rolls) or Defender (use reaction to impose disadvantage on an attack against an ally within 5 ft.).',
    'Second Wind': 'Starting at 2nd level, the warrior can use a bonus action to regain hit points equal to 1d10 + sidekick level. Usable once per short or long rest.',
    'Improved Critical': 'Starting at 3rd level, the warrior scores a critical hit on a roll of 19 or 20.',
    'Extra Attack': 'The warrior can attack twice (level 6) or three times (level 15) when taking the Attack action.',
    'Battle Readiness': 'Starting at 7th level, the warrior has advantage on initiative rolls.',
    'Improved Defense': 'At 10th level, the warrior gains a +1 bonus to AC.',
    'Indomitable': 'Starting at 11th level, the warrior can reroll a failed saving throw (once per long rest, twice at 18th level).',
    'Helpful': 'The expert can take the Help action as a bonus action.',
    'Expertise': 'The expert gains expertise in chosen skills, doubling the proficiency bonus for ability checks using those skills.',
    'Coordinated Strike': 'At 6th level, when the expert uses Help to aid an ally\'s attack and the attack hits, the target takes an extra 2d6 damage.',
    'Evasion': 'At 7th level, on a successful DEX save for half damage the expert takes no damage; on a failure, half damage.',
    'Inspiring Help': 'At 9th level, a creature aided by the expert\'s Help gains 1d6 (2d6 at level 20) temporary hit points.',
    'Reliable Talent': 'At 11th level, the expert treats any d20 roll of 9 or lower as a 10 on proficient ability checks.',
    'Cunning Action': 'At 14th level, the expert can take the Dash, Disengage, or Hide action as a bonus action.',
    'Sharp Mind': 'At 18th level, the expert gains proficiency in an additional saving throw.',
    'Potent Cantrips': 'At 6th level, the spellcaster adds its spellcasting ability modifier to cantrip damage.',
    'Empowered Spells': 'At 14th level, the spellcaster adds its spellcasting ability modifier to spell damage or healing.',
    'Focused Casting': 'At 18th level, the spellcaster has advantage on Constitution saving throws to maintain concentration.',
};

function buildFeatureTooltip(featureName, fullText) {
    if (!featureName) return '<div class="dnd-tt-name">Unknown feature</div>';
    const name = featureName.split('(')[0].trim();
    const desc = fullText || FEATURE_DESC[name] || '';

    return `<div class="dnd-tt-name">${escHtml(featureName)}</div>
<div class="dnd-tt-sub">Sidekick Class Feature</div>
${desc ? '<div class="dnd-tt-divider"></div><div class="dnd-tt-desc">' + escHtml(desc) + '</div>' : ''}`;
}

// ─── Content Builders ───────────────────────────────────────

function buildCreatureTooltip(creature) {
    if (!creature) return '<div class="dnd-tt-name">Creature not found</div>';
    const SIZE_MAP = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
    const sz = SIZE_MAP[Array.isArray(creature.size) ? creature.size[0] : creature.size] || '?';
    const t = typeof creature.type === 'string' ? creature.type : creature.type?.type || '?';
    const hp = creature.hp?.average ?? '?';
    const hpFormula = creature.hp?.formula ? ` (${creature.hp.formula})` : '';
    const ac = typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? '?';
    const spd = creature.speed ? Object.entries(creature.speed).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v} ft.`).join(', ') : '30 ft.';

    const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const statLine = stats.map(s => {
        const val = creature[s] ?? 10;
        const mod = Math.floor((val - 10) / 2);
        const sign = mod >= 0 ? '+' : '';
        return `<span class="dnd-tt-stat"><span class="dnd-tt-stat-label">${s.toUpperCase()}</span><span>${val} (${sign}${mod})</span></span>`;
    }).join('');

    let actions = '';
    if (creature.action?.length) {
        const acts = creature.action.slice(0, 4).map(a => {
            const text = Array.isArray(a.entries) ? strip5eMarkupLight(a.entries.join(' ')) : '';
            const truncated = text.length > 120 ? text.slice(0, 117) + '...' : text;
            return `<div class="dnd-tt-action"><strong>${escHtml(a.name)}.</strong> ${truncated}</div>`;
        }).join('');
        actions = `<div class="dnd-tt-divider"></div>${acts}`;
    }

    return `<div class="dnd-tt-name">${escHtml(creature.name)}</div>
<div class="dnd-tt-sub">${sz} ${t}, ${creature.source || '?'}</div>
<div class="dnd-tt-divider"></div>
<div class="dnd-tt-field"><strong>AC</strong> ${ac} &nbsp; <strong>HP</strong> ${hp}${hpFormula} &nbsp; <strong>CR</strong> ${creature.cr ?? '?'}</div>
<div class="dnd-tt-field"><strong>Speed</strong> ${spd}</div>
<div class="dnd-tt-divider"></div>
<div class="dnd-tt-stats">${statLine}</div>${actions}`;
}

function buildSpellTooltip(spell) {
    if (!spell) return '<div class="dnd-tt-name">Spell not found</div>';
    const SCHOOLS = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };
    const school = SCHOOLS[spell.school] || spell.school || '';
    const levelSchool = spell.level === 0 ? `${school} cantrip` : `Level ${spell.level} ${school}`;

    const time = Array.isArray(spell.time) && spell.time[0]
        ? (typeof spell.time[0] === 'string' ? spell.time[0] : `${spell.time[0].number} ${spell.time[0].unit}`)
        : '—';

    let range = '—';
    if (spell.range) {
        const r = spell.range;
        if (r.type === 'point' && r.distance) {
            if (r.distance.type === 'self') range = 'Self';
            else if (r.distance.type === 'touch') range = 'Touch';
            else range = `${r.distance.amount} ${r.distance.type}`;
        } else if (r.type === 'special') range = 'Special';
    }

    const comp = spell.components
        ? [spell.components.v && 'V', spell.components.s && 'S', spell.components.m && ('M' + (typeof spell.components.m === 'object' ? ` (${spell.components.m.text})` : typeof spell.components.m === 'string' ? ` (${spell.components.m})` : ''))].filter(Boolean).join(', ')
        : '—';

    let duration = '—';
    if (Array.isArray(spell.duration) && spell.duration[0]) {
        const d = spell.duration[0];
        if (d.type === 'instant') duration = 'Instantaneous';
        else if (d.type === 'permanent') duration = 'Until dispelled';
        else if (d.type === 'special') duration = 'Special';
        else if (d.type === 'timed') {
            const conc = d.concentration ? 'Concentration, up to ' : '';
            duration = `${conc}${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
        }
    }

    const desc = flattenEntries(spell.entries);
    const truncDesc = desc.length > 400 ? desc.slice(0, 397) + '...' : desc;

    let higherLevel = '';
    if (spell.entriesHigherLevel?.length) {
        const hl = flattenEntries(spell.entriesHigherLevel);
        if (hl) {
            higherLevel = `<div class="dnd-tt-divider"></div><div class="dnd-tt-field"><strong>Cantrip Upgrade / At Higher Levels:</strong></div><div class="dnd-tt-desc">${hl}</div>`;
        }
    }

    return `<div class="dnd-tt-name">${escHtml(spell.name)}</div>
<div class="dnd-tt-sub">${escHtml(levelSchool)} &mdash; ${escHtml(spell.source || '')}</div>
<div class="dnd-tt-divider"></div>
<div class="dnd-tt-field"><strong>Casting Time:</strong> ${escHtml(time)}</div>
<div class="dnd-tt-field"><strong>Range:</strong> ${escHtml(range)}</div>
<div class="dnd-tt-field"><strong>Components:</strong> ${escHtml(comp)}</div>
<div class="dnd-tt-field"><strong>Duration:</strong> ${escHtml(duration)}</div>
<div class="dnd-tt-divider"></div>
<div class="dnd-tt-desc">${truncDesc}</div>${higherLevel}`;
}

const DMG_TYPES = { B: 'bludgeoning', P: 'piercing', S: 'slashing', N: 'necrotic', R: 'radiant', F: 'fire', C: 'cold', L: 'lightning', T: 'thunder', O: 'force', A: 'acid', Y: 'psychic' };
const PROP_LABELS = { '2H': 'Two-Handed', A: 'Ammunition', AF: 'Ammunition', F: 'Finesse', H: 'Heavy', L: 'Light', LD: 'Loading', R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown', V: 'Versatile' };

const ITEM_TYPE_LABELS = {
    INS: 'Musical Instrument', AT: "Artisan's Tools", GS: 'Gaming Set', T: 'Tool',
    G: 'Adventuring Gear', SCF: 'Spellcasting Focus', P: 'Potion', RG: 'Ring',
    RD: 'Rod', WD: 'Wand', SC: 'Scroll', W: 'Wondrous Item', A: 'Ammunition',
    EXP: 'Explosive', FD: 'Food/Drink', TG: 'Trade Good', MNT: 'Mount/Vehicle',
    TAH: 'Tack & Harness', VEH: 'Vehicle', OTH: 'Other', HA: 'Heavy Armor',
    MA: 'Medium Armor', LA: 'Light Armor', S: 'Shield', R: 'Ranged Weapon',
    M: 'Melee Weapon', '$': 'Treasure', AF: 'Arcane Focus', AIR: 'Airship',
    SHP: 'Ship', MR: 'Master Rune',
};

function resolveTypeLabel(rawType) {
    if (!rawType) return 'Gear';
    if (ITEM_TYPE_LABELS[rawType]) return ITEM_TYPE_LABELS[rawType];
    // Strip $ prefix (5e.tools uses $G, $I etc. for inherited/variant types)
    const stripped = rawType.replace(/^\$/, '');
    return ITEM_TYPE_LABELS[stripped] || stripped || 'Gear';
}

function buildEquipmentTooltip(item) {
    if (!item) return '<div class="dnd-tt-name">Item not found</div>';

    const isWeapon = !!(item.weaponCategory || item.weapon || item.dmg1);
    const isArmor = item._kind === 'armor' || item._kind === 'shield' || item._armorType;

    let body = '';
    if (isWeapon) {
        const cat = item.weaponCategory || (item.type === 'R' ? 'ranged' : 'melee');
        const dmg = item.dmg1 || '?';
        const dmgType = DMG_TYPES[item.dmgType] || item.dmgType || '';
        const bonus = item.bonusWeapon ? ` (${String(item.bonusWeapon).startsWith('+') ? item.bonusWeapon : '+' + item.bonusWeapon})` : '';
        const props = (item.property || []).map(p => {
            const code = typeof p === 'string' ? p.split('|')[0] : p?.uid?.split('|')[0] || '';
            return PROP_LABELS[code] || code;
        }).filter(Boolean);
        const rng = item.range ? `Range ${item.range}` : '';

        body += `<div class="dnd-tt-field"><strong>Type:</strong> ${escHtml(cat)} weapon${bonus}</div>`;
        body += `<div class="dnd-tt-field"><strong>Damage:</strong> ${escHtml(dmg)} ${escHtml(dmgType)}</div>`;
        if (item.dmg2) body += `<div class="dnd-tt-field"><strong>Versatile:</strong> ${escHtml(item.dmg2)}</div>`;
        if (rng) body += `<div class="dnd-tt-field"><strong>Range:</strong> ${escHtml(item.range)}</div>`;
        if (props.length) body += `<div class="dnd-tt-field"><strong>Properties:</strong> ${escHtml(props.join(', '))}</div>`;
        if (item.weight) body += `<div class="dnd-tt-field"><strong>Weight:</strong> ${item.weight} lb.</div>`;
    } else if (isArmor) {
        const armorTypes = { LA: 'Light Armor', MA: 'Medium Armor', HA: 'Heavy Armor', S: 'Shield' };
        body += `<div class="dnd-tt-field"><strong>Type:</strong> ${armorTypes[item._armorType || item.type] || 'Armor'}</div>`;
        if (item.ac != null) {
            let acStr = String(item.ac);
            if (item.bonusAc) acStr += ` (+${item.bonusAc} bonus)`;
            const dexNote = item._armorType === 'LA' ? ' + Dex' : item._armorType === 'MA' ? ' + Dex (max 2)' : '';
            body += `<div class="dnd-tt-field"><strong>AC:</strong> ${acStr}${dexNote}</div>`;
        }
        if (item.stealth) body += `<div class="dnd-tt-field"><strong>Stealth:</strong> Disadvantage</div>`;
        if (item.strength) body += `<div class="dnd-tt-field"><strong>Str Required:</strong> ${item.strength}</div>`;
        if (item.weight) body += `<div class="dnd-tt-field"><strong>Weight:</strong> ${item.weight} lb.</div>`;
    } else {
        const rawType = (item.type || '').split('|')[0];
        const typeStr = resolveTypeLabel(rawType);
        body += `<div class="dnd-tt-field"><strong>Type:</strong> ${escHtml(typeStr)}</div>`;
        if (item.weight) body += `<div class="dnd-tt-field"><strong>Weight:</strong> ${item.weight} lb.</div>`;
        if (item.value != null) {
            const gp = item.value >= 100 ? `${Math.floor(item.value / 100)} gp` : item.value >= 10 ? `${Math.floor(item.value / 10)} sp` : `${item.value} cp`;
            body += `<div class="dnd-tt-field"><strong>Cost:</strong> ${gp}</div>`;
        }
    }

    const rarity = item.rarity && item.rarity !== 'unknown' && item.rarity !== 'unknown (magic)' ? item.rarity : null;
    const subline = [rarity, item.source].filter(Boolean).join(' &mdash; ');
    const rawType = (item.type || '').split('|')[0];
    const typeLabel = isWeapon ? 'Weapon' : isArmor ? 'Armor' : resolveTypeLabel(rawType);

    let desc = '';
    if (item.entries?.length) {
        const text = flattenEntries(item.entries);
        desc = text.length > 300 ? text.slice(0, 297) + '...' : text;
    }

    return `<div class="dnd-tt-name">${escHtml(item.name)}</div>
<div class="dnd-tt-sub">${typeLabel}${subline ? ' &mdash; ' + subline : ''}</div>
<div class="dnd-tt-divider"></div>
${body}${desc ? '<div class="dnd-tt-divider"></div><div class="dnd-tt-desc">' + desc + '</div>' : ''}`;
}

// ─── Positioning & Show/Hide ────────────────────────────────

function positionTooltip(tip, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = rect.right + 8;
    if (left + tipRect.width > window.innerWidth - 8) {
        left = rect.left - tipRect.width - 8;
    }
    if (left < 8) left = 8;

    let top = rect.top;
    if (top + tipRect.height > window.innerHeight - 8) {
        top = window.innerHeight - tipRect.height - 8;
    }
    if (top < 8) top = 8;

    const maxH = window.innerHeight - top - 8;
    if (tipRect.height > maxH) {
        tip.style.maxHeight = `${maxH}px`;
        tip.style.overflowY = 'auto';
    }

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.opacity = '1';
}

function showTooltip(anchorEl, htmlContent) {
    hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'dnd-hover-tooltip';
    tip.innerHTML = htmlContent;
    document.body.appendChild(tip);
    activeTooltip = tip;
    positionTooltip(tip, anchorEl);
}

export function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

// ─── Public API ─────────────────────────────────────────────

export function showCreatureTooltip(anchorEl, creatureName) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        const creature = lookupCreatureByName(creatureName);
        showTooltip(anchorEl, buildCreatureTooltip(creature));
    }, TOOLTIP_DELAY);
}

export function showSpellTooltip(anchorEl, spellName, extraText = '') {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        const spell = lookupSpellByName(spellName) || lookupSpellSync(spellName) || lookupSpellSyncV2(spellName);
        let html = buildSpellTooltip(spell);
        if (extraText) {
            html += `<div class="dnd-tt-divider"></div><div class="dnd-tt-field"><strong>${escHtml(extraText)}</strong></div>`;
        }
        showTooltip(anchorEl, html);
    }, TOOLTIP_DELAY);
}

export function showEquipmentTooltip(anchorEl, itemName, extraText = '') {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        const item = lookupItemByName(itemName);
        let html = buildEquipmentTooltip(item);
        if (extraText) {
            html += `<div class="dnd-tt-divider"></div><div class="dnd-tt-field"><strong>✨ Magic:</strong> ${escHtml(extraText)}</div>`;
        }
        showTooltip(anchorEl, html);
    }, TOOLTIP_DELAY);
}

export function showFeatureTooltip(anchorEl, featureName, fullText) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        showTooltip(anchorEl, buildFeatureTooltip(featureName, fullText));
    }, TOOLTIP_DELAY);
}

function buildFeatTooltip(featName) {
    const feat = lookupFeatByName(featName);
    if (!feat) return `<div class="dnd-tt-name">${escHtml(featName)}</div><div class="dnd-tt-sub">Feat not found</div>`;

    const abInfo = parseFeatAbility(feat);
    let abStr = '';
    if (abInfo) {
        const parts = [];
        for (const [ab, val] of Object.entries(abInfo.fixed)) parts.push(`${ab.toUpperCase()} +${val}`);
        if (abInfo.choose) parts.push(`Choose +1 from ${abInfo.choose.from.map(a => a.toUpperCase()).join('/')}`);
        if (parts.length > 0) abStr = `<div class="dnd-tt-field"><strong>Ability:</strong> ${parts.join(', ')}</div>`;
    }

    let prereqStr = '';
    if (feat.prerequisite?.length > 0) {
        const parts = [];
        for (const p of feat.prerequisite) {
            if (p.level) parts.push(`Level ${p.level}+`);
            if (p.ability) {
                for (const abReq of p.ability) {
                    for (const [ab, min] of Object.entries(abReq)) parts.push(`${ab.toUpperCase()} ${min}+`);
                }
            }
            if (p.spellcasting2020) parts.push('Spellcasting');
            if (p.proficiency) {
                for (const prof of p.proficiency) {
                    if (prof.armor) parts.push(`${prof.armor} armor proficiency`);
                }
            }
        }
        if (parts.length > 0) prereqStr = `<div class="dnd-tt-field"><strong>Prereq:</strong> ${parts.join(', ')}</div>`;
    }

    const entries = (feat.entries || []).map(e => {
        if (typeof e === 'string') return `<p>${escHtml(strip5eMarkupLight(e))}</p>`;
        if (e.type === 'list' && e.items) return '<ul>' + e.items.map(i => {
            if (typeof i === 'string') return `<li>${escHtml(strip5eMarkupLight(i))}</li>`;
            if (i.type === 'item' && i.name && i.entries) return `<li><strong>${escHtml(i.name)}.</strong> ${escHtml(strip5eMarkupLight(i.entries.join(' ')))}</li>`;
            return '';
        }).join('') + '</ul>';
        return '';
    }).join('');

    return `<div class="dnd-tt-name">${escHtml(feat.name)}</div>
<div class="dnd-tt-sub">Feat (${feat.category === 'O' ? 'Origin' : feat.category === 'G' ? 'General' : feat.category || '?'}) — XPHB</div>
<div class="dnd-tt-divider"></div>
${abStr}${prereqStr}
<div class="dnd-tt-desc">${entries}</div>`;
}

function showFeatTooltip(anchorEl, featName) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        showTooltip(anchorEl, buildFeatTooltip(featName));
    }, TOOLTIP_DELAY);
}

function buildTraitTooltip(name, text) {
    return `<div class="dnd-tt-name">${escHtml(name)}</div>
<div class="dnd-tt-sub">Creature Trait</div>
<div class="dnd-tt-divider"></div>
<div class="dnd-tt-desc">${escHtml(text)}</div>`;
}

export function showTraitTooltip(anchorEl, name, text) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        showTooltip(anchorEl, buildTraitTooltip(name, text));
    }, TOOLTIP_DELAY);
}

/**
 * Wire up delegated hover events on a container for all hoverable elements.
 * Safe to call multiple times; old bindings are removed first via namespace.
 */
export function bindTooltipEvents(container) {
    if (!container) return;
    const NS = '.dndTooltip';
    const $c = $(container);
    $c.off(NS);

    $c.on('mouseenter' + NS, '.dnd-sk-dd-item[data-creature-name]', function () {
        const name = $(this).data('creature-name');
        if (name) showCreatureTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-sk-spell-dd-item[data-spell-name]', function () {
        const name = $(this).data('spell-name');
        if (name) showSpellTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-sk-spell-tag[data-spell-name]', function () {
        const name = $(this).data('spell-name');
        if (name) showSpellTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-sk-equip-result[data-item-name], .dnd-sk-armor-result[data-item-name]', function () {
        const name = $(this).data('item-name');
        if (name) showEquipmentTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-sk-equip-item[data-item-name]', function () {
        const name = $(this).data('item-name');
        if (name) showEquipmentTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-sk-item-result[data-item-name]', function () {
        const name = $(this).data('item-name');
        if (name) showEquipmentTooltip(this, name);
    });

    $c.on('mouseenter' + NS, '.dnd-tt-hover[data-tt-type]', function () {
        const type = $(this).data('tt-type');
        const name = $(this).data('tt-name');
        if (!name) return;
        if (type === 'creature') showCreatureTooltip(this, name);
        else if (type === 'spell') showSpellTooltip(this, name, $(this).data('tt-text') || '');
        else if (type === 'equipment') showEquipmentTooltip(this, name);
        else if (type === 'feature') {
            const text = $(this).data('tt-text') || '';
            showFeatureTooltip(this, name, text);
        }
        else if (type === 'feat') showFeatTooltip(this, name);
        else if (type === 'trait') {
            const text = $(this).data('tt-text') || '';
            showTraitTooltip(this, name, text);
        }
    });

    $c.on('mouseleave' + NS, '.dnd-sk-dd-item, .dnd-sk-spell-dd-item, .dnd-sk-spell-tag[data-spell-name], .dnd-sk-equip-result, .dnd-sk-armor-result, .dnd-sk-equip-item[data-item-name], .dnd-sk-item-result, .dnd-tt-hover', function () {
        hideTooltip();
    });
}
