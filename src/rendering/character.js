/**
 * D&D 5e Lite - Character Renderer
 * Renders class table, proficiencies, and collapsible feature list
 * up to the configured character level.
 */

import { character, classDataCache } from '../core/state.js';
import {
    getClassObject, getClassFeatures, getSubclassFeatures,
    buildClassTable, formatProficiencies, flattenEntries,
} from '../features/character.js';

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Render the full character panel inside #dnd-character-content.
 */
export function renderCharacter() {
    const container = document.getElementById('dnd-character-content');
    const titleEl = document.getElementById('dnd-character-title');
    if (!container) return;

    if (!character) {
        container.innerHTML = '<div class="dnd-empty-state">No character configured</div>';
        if (titleEl) titleEl.textContent = 'Character';
        return;
    }

    const data = classDataCache.get(character.classFile);
    if (!data) {
        container.innerHTML = '<div class="dnd-empty-state">Loading class data...</div>';
        return;
    }

    const classObj = getClassObject(data, character.className, character.classSource);
    if (!classObj) {
        container.innerHTML = '<div class="dnd-empty-state">Class not found in data</div>';
        return;
    }

    const maxLevel = character.level || 1;
    const subLabel = character.subclassName ? ` (${character.subclassName})` : '';
    if (titleEl) titleEl.textContent = `${character.className}${subLabel} — Lv ${maxLevel}`;

    const { saves, hd } = formatProficiencies(classObj);
    const tableData = buildClassTable(classObj, maxLevel);
    const classFeats = getClassFeatures(data, character.className, character.classSource, maxLevel);
    const subFeats = character.subclassShortName
        ? getSubclassFeatures(data, character.subclassShortName, character.subclassSource, character.className, character.classSource, maxLevel)
        : [];

    let html = '';

    // Header stats
    html += `<div class="dnd-char-stats">`;
    html += `<span class="dnd-char-stat"><strong>HD</strong> ${escapeHtml(hd)}</span>`;
    html += `<span class="dnd-char-stat"><strong>Saves</strong> ${escapeHtml(saves.join(', '))}</span>`;
    html += `</div>`;

    // Class table
    html += renderClassTable(tableData);

    // Features by level
    html += renderFeaturesByLevel(classFeats, subFeats, maxLevel);

    container.innerHTML = html;
    bindFeatureEvents(container);
}

function renderClassTable(tableData) {
    if (!tableData?.rows?.length) return '';
    const { colGroups, colLabels, rows } = tableData;
    const hasGroupRow = colGroups?.some(g => g.title);

    let html = '<div class="dnd-char-table-wrap"><table class="dnd-char-table"><thead>';

    if (hasGroupRow) {
        html += '<tr class="dnd-char-table-group-row">';
        for (const g of colGroups) {
            if (g.span === 0) continue;
            const title = g.title ? escapeHtml(g.title) : '';
            html += `<th colspan="${g.span}" class="${g.title ? 'dnd-char-group-titled' : ''}">${title}</th>`;
        }
        html += '</tr>';
    }

    html += '<tr>';
    for (const label of colLabels) {
        html += `<th>${escapeHtml(label)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of rows) {
        html += '<tr>';
        for (const cell of row) {
            html += `<td>${escapeHtml(String(cell))}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function renderFeaturesByLevel(classFeats, subFeats, maxLevel) {
    const byLevel = new Map();
    for (let l = 1; l <= maxLevel; l++) byLevel.set(l, []);

    for (const f of classFeats) {
        const bucket = byLevel.get(f.level);
        if (bucket) bucket.push({ ...f, _sub: false });
    }
    for (const f of subFeats) {
        const bucket = byLevel.get(f.level);
        if (bucket) bucket.push({ ...f, _sub: true });
    }

    let html = '<div class="dnd-char-features">';
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
        const feats = byLevel.get(lvl);
        if (!feats || feats.length === 0) continue;

        const names = feats.map(f => f._sub ? `[${escapeHtml(f.name)}]` : escapeHtml(f.name)).join(', ');
        html += `<div class="dnd-char-level-group" data-level="${lvl}">`;
        html += `<div class="dnd-char-level-header"><i class="fa-solid fa-chevron-right dnd-char-expand-icon"></i> <strong>Level ${lvl}</strong> <span class="dnd-char-feat-names">${names}</span></div>`;
        html += `<div class="dnd-char-level-body" style="display:none;">`;
        for (const f of feats) {
            const cls = f._sub ? ' dnd-char-subfeat' : '';
            const body = flattenEntries(f.entries);
            const needsTruncate = body.length > 500;
            html += `<div class="dnd-char-feat${cls}">`;
            html += `<div class="dnd-char-feat-name">${f._sub ? '<span class="dnd-char-sub-tag">Sub</span> ' : ''}${escapeHtml(f.name)}</div>`;
            if (needsTruncate) {
                html += `<div class="dnd-char-feat-body dnd-char-feat-truncated">${body.substring(0, 500)}</div>`;
                html += `<div class="dnd-char-feat-body dnd-char-feat-full" style="display:none;">${body}</div>`;
                html += `<button class="dnd-char-feat-more">Show more</button>`;
            } else {
                html += `<div class="dnd-char-feat-body">${body}</div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;
    }
    html += '</div>';
    return html;
}

function bindFeatureEvents(container) {
    container.querySelectorAll('.dnd-char-level-header').forEach(header => {
        header.addEventListener('click', () => {
            const group = header.closest('.dnd-char-level-group');
            const body = group.querySelector('.dnd-char-level-body');
            const icon = header.querySelector('.dnd-char-expand-icon');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            } else {
                body.style.display = 'none';
                icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
            }
        });
    });

    container.querySelectorAll('.dnd-char-feat-more').forEach(btn => {
        btn.addEventListener('click', () => {
            const feat = btn.closest('.dnd-char-feat');
            const truncated = feat.querySelector('.dnd-char-feat-truncated');
            const full = feat.querySelector('.dnd-char-feat-full');
            if (full.style.display === 'none') {
                truncated.style.display = 'none';
                full.style.display = '';
                btn.textContent = 'Show less';
            } else {
                truncated.style.display = '';
                full.style.display = 'none';
                btn.textContent = 'Show more';
            }
        });
    });
}
