/**
 * D&D 5e Lite - Desktop Strip Widgets & Header Widget Rendering
 * Analog clock, season cards, dynamic location icons, weather emoji, spell cubes
 */

import { extensionSettings, quests, headerInfo } from '../core/state.js';
import { hasCurrency, formatCurrencyStrip, formatCurrencyTitle, buildCurrencyOmniHtml } from '../features/currencyParser.js';
import { rollD20, updateDiceDisplay, clearDiceRoll, formatDiceSetTooltip } from '../features/dice.js';
import { applyWeatherVisuals } from '../features/weatherVisuals.js';

// ─── Helpers ────────────────────────────────────────────────

function parseTime(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let hours = parseInt(m[1]);
    const minutes = parseInt(m[2]);
    const period = m[3]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
}

function setClockHands(hourEl, minuteEl, timeStr) {
    const t = parseTime(timeStr);
    if (!t || !hourEl || !minuteEl) {
        if (hourEl) hourEl.style.transform = 'rotate(0deg)';
        if (minuteEl) minuteEl.style.transform = 'rotate(0deg)';
        return;
    }
    const hourDeg = ((t.hours % 12) + t.minutes / 60) * 30;
    const minDeg = t.minutes * 6;
    hourEl.style.transform = `rotate(${hourDeg}deg)`;
    minuteEl.style.transform = `rotate(${minDeg}deg)`;
}

// Forgotten Realms calendar: 12 months mapped to season + month key
const FR_MONTHS = {
    hammer:    { num: 1,  season: 'winter', key: 'hammer' },
    alturiak:  { num: 2,  season: 'winter', key: 'alturiak' },
    ches:      { num: 3,  season: 'spring', key: 'ches' },
    tarsakh:   { num: 4,  season: 'spring', key: 'tarsakh' },
    mirtul:    { num: 5,  season: 'spring', key: 'mirtul' },
    kythorn:   { num: 6,  season: 'summer', key: 'kythorn' },
    flamerule: { num: 7,  season: 'summer', key: 'flamerule' },
    eleasis:   { num: 8,  season: 'summer', key: 'eleasis' },
    eleint:    { num: 9,  season: 'autumn', key: 'eleint' },
    marpenoth: { num: 10, season: 'autumn', key: 'marpenoth' },
    uktar:     { num: 11, season: 'autumn', key: 'uktar' },
    nightal:   { num: 12, season: 'winter', key: 'nightal' },
};

function inferMonth(dateStr) {
    if (!dateStr) return null;
    const d = dateStr.toLowerCase();
    for (const [name, info] of Object.entries(FR_MONTHS)) {
        if (d.includes(name)) return info;
    }
    return null;
}

function inferSeason(dateStr) {
    if (!dateStr) return null;
    const month = inferMonth(dateStr);
    if (month) return month.season;
    const d = dateStr.toLowerCase();
    if (/spring/.test(d)) return 'spring';
    if (/summer/.test(d)) return 'summer';
    if (/autumn|fall/.test(d)) return 'autumn';
    if (/winter/.test(d)) return 'winter';
    if (/march|april|may/.test(d)) return 'spring';
    if (/june|july|august/.test(d)) return 'summer';
    if (/septemb|octob|novemb/.test(d)) return 'autumn';
    if (/decemb|january|february/.test(d)) return 'winter';
    return null;
}

const SEASON_CLASSES = ['dnd-season-spring', 'dnd-season-summer', 'dnd-season-autumn', 'dnd-season-winter'];
const MONTH_CLASSES = Object.keys(FR_MONTHS).map(k => `dnd-month-${k}`);
const ALL_THEME_CLASSES = [...SEASON_CLASSES, ...MONTH_CLASSES];

function applySeason(el, dateStr) {
    if (!el) return;
    const $el = $(el);
    $el.removeClass(ALL_THEME_CLASSES.join(' '));
    const season = inferSeason(dateStr);
    if (season) $el.addClass(`dnd-season-${season}`);
    const month = inferMonth(dateStr);
    if (month) $el.addClass(`dnd-month-${month.key}`);
}

function inferLocationIcon(location) {
    if (!location) return 'fa-map-marker-alt';
    const loc = location.toLowerCase();
    if (/tavern|inn|pub|bar|alehouse|brewhouse/.test(loc)) return 'fa-mug-saucer';
    if (/forest|woods|grove|jungle|wilds/.test(loc)) return 'fa-tree';
    if (/cave|mine|dungeon|catacomb|tunnel|underground|sewers?/.test(loc)) return 'fa-dungeon';
    if (/castle|tower|spire|fortress|citadel|palace|keep/.test(loc)) return 'fa-chess-rook';
    if (/temple|church|shrine|cathedral|chapel|sanctum/.test(loc)) return 'fa-place-of-worship';
    if (/city|town|village|market|square|district|street|alley/.test(loc)) return 'fa-city';
    if (/port|harbor|harbour|dock|pier|wharf/.test(loc)) return 'fa-anchor';
    if (/ship|boat|vessel|galleon|brig/.test(loc)) return 'fa-ship';
    if (/mountain|peak|summit|cliff|ridge|highland/.test(loc)) return 'fa-mountain';
    if (/camp|tent|campfire|bivouac/.test(loc)) return 'fa-campground';
    if (/shop|store|merchant|bazaar|emporium/.test(loc)) return 'fa-store';
    if (/road|path|trail|highway|bridge|crossroad/.test(loc)) return 'fa-road';
    if (/library|archive|study|academy|school|university/.test(loc)) return 'fa-book';
    if (/prison|jail|cell|gaol/.test(loc)) return 'fa-lock';
    if (/garden|park|meadow|field|glade/.test(loc)) return 'fa-seedling';
    if (/river|lake|pond|waterfall|stream|ocean|sea|beach/.test(loc)) return 'fa-water';
    if (/house|home|manor|estate|villa|cottage|hut|shack|quarters/.test(loc)) return 'fa-house';
    if (/barracks|armory|armoury|garrison|fort/.test(loc)) return 'fa-shield-halved';
    if (/throne|court|hall|chamber/.test(loc)) return 'fa-crown';
    if (/graveyard|cemetery|crypt|tomb|mausoleum/.test(loc)) return 'fa-skull';
    if (/arena|colosseum|pit|ring/.test(loc)) return 'fa-khanda';
    return 'fa-map-marker-alt';
}

const KEYCAP_EMOJIS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// Previous state for diff-based animation
let _prevSlots = null;   // Map<level, { current, max }>
let _prevSorcery = null; // { current, max }
let _prevSecondary = null; // { current, max }

function snapshotSlotState(spellSlots, sorceryPoints, secondaryResource) {
    const map = new Map();
    if (spellSlots && Array.isArray(spellSlots)) {
        for (const s of spellSlots) map.set(s.level, { current: s.current, max: s.max });
    }
    return {
        slots: map,
        sorcery: sorceryPoints ? { ...sorceryPoints } : null,
        secondary: secondaryResource ? { ...secondaryResource } : null,
    };
}

const ANIM_STAGGER_MS = 120;

/**
 * Animate individual indicator elements within a row's .dnd-spell-level-cubes container.
 * `oldCurrent`/`newCurrent` are the filled counts; elements are indexed left-to-right.
 * Slots that change from filled->empty get a "spend" animation (sequenced right-to-left).
 * Slots that change from empty->filled get a "restore" animation (sequenced left-to-right).
 */
function animateRowDiff(rowEl, oldCurrent, newCurrent, max) {
    if (oldCurrent === newCurrent || !rowEl) return;

    const cubesContainer = rowEl.querySelector('.dnd-spell-level-cubes');
    if (!cubesContainer) return;
    const indicators = cubesContainer.children;

    if (newCurrent < oldCurrent) {
        // Slots spent: indices [newCurrent .. oldCurrent-1] switched filled->empty
        // Animate right-to-left (highest slot first)
        const spent = [];
        for (let i = oldCurrent - 1; i >= newCurrent; i--) {
            if (indicators[i]) spent.push(indicators[i]);
        }
        spent.forEach((el, idx) => {
            el.style.animationDelay = `${idx * ANIM_STAGGER_MS}ms`;
            el.classList.add('dnd-anim-spend');
            el.addEventListener('animationend', () => {
                el.classList.remove('dnd-anim-spend');
                el.style.animationDelay = '';
            }, { once: true });
        });
    } else {
        // Slots restored: indices [oldCurrent .. newCurrent-1] switched empty->filled
        // Animate left-to-right (lowest slot first)
        const restored = [];
        for (let i = oldCurrent; i < newCurrent; i++) {
            if (indicators[i]) restored.push(indicators[i]);
        }
        restored.forEach((el, idx) => {
            el.style.animationDelay = `${idx * ANIM_STAGGER_MS}ms`;
            el.classList.add('dnd-anim-restore');
            el.addEventListener('animationend', () => {
                el.classList.remove('dnd-anim-restore');
                el.style.animationDelay = '';
            }, { once: true });
        });
    }
}

function renderSpellLevels(container, spellSlots, sorceryPoints, secondaryResource) {
    if (!container) return;

    const hasData = (spellSlots && Array.isArray(spellSlots) && spellSlots.length > 0)
        || sorceryPoints
        || secondaryResource;
    if (!hasData) {
        _prevSlots = null;
        _prevSorcery = null;
        _prevSecondary = null;
        container.innerHTML = '';
        return;
    }

    const oldSnap = { slots: _prevSlots, sorcery: _prevSorcery, secondary: _prevSecondary };
    const newSnap = snapshotSlotState(spellSlots, sorceryPoints, secondaryResource);

    // Build the new HTML (always reflects latest state)
    let html = '';
    if (spellSlots && spellSlots.length > 0) {
        html += spellSlots.map(s => {
            const label = s.level > 0 ? KEYCAP_EMOJIS[s.level] : '🪄';
            const filled = Math.max(0, Math.min(s.current, s.max));
            const empty = Math.max(0, s.max - filled);
            let cubes = '';
            for (let i = 0; i < filled; i++) cubes += '<div class="dnd-spell-cube dnd-spell-filled"></div>';
            for (let i = 0; i < empty; i++) cubes += '<div class="dnd-spell-cube dnd-spell-empty"></div>';
            return `<div class="dnd-spell-level-row" data-spell-level="${s.level}">
                <span class="dnd-spell-level-label">${label}</span>
                <span class="dnd-spell-level-count">${s.current}/${s.max}</span>
                <div class="dnd-spell-level-cubes">${cubes}</div>
            </div>`;
        }).join('');
    }
    if (sorceryPoints) {
        const sp = sorceryPoints;
        const filled = Math.max(0, Math.min(sp.current, sp.max));
        const empty = Math.max(0, sp.max - filled);
        let circles = '';
        for (let i = 0; i < filled; i++) circles += '<div class="dnd-spell-circle dnd-spell-filled"></div>';
        for (let i = 0; i < empty; i++) circles += '<div class="dnd-spell-circle dnd-spell-empty"></div>';
        const wideClass = sp.max > 8 ? ' dnd-spell-row-wide' : '';
        html += `<div class="dnd-spell-level-row dnd-spell-sorcery-row${wideClass}" data-spell-level="sp">
            <span class="dnd-spell-level-label">⚡</span>
            <span class="dnd-spell-level-count">${sp.current}/${sp.max}</span>
            <div class="dnd-spell-level-cubes">${circles}</div>
        </div>`;
    }
    if (secondaryResource) {
        const sr = secondaryResource;
        const filled = Math.max(0, Math.min(sr.current, sr.max));
        const empty = Math.max(0, sr.max - filled);
        let circles = '';
        for (let i = 0; i < filled; i++) circles += '<div class="dnd-spell-circle dnd-spell-filled"></div>';
        for (let i = 0; i < empty; i++) circles += '<div class="dnd-spell-circle dnd-spell-empty"></div>';
        const wideClass = sr.max > 8 ? ' dnd-spell-row-wide' : '';
        html += `<div class="dnd-spell-level-row dnd-spell-secondary-row${wideClass}" data-spell-level="sr">
            <span class="dnd-spell-level-label">🔥</span>
            <span class="dnd-spell-level-count">${sr.current}/${sr.max}</span>
            <div class="dnd-spell-level-cubes">${circles}</div>
        </div>`;
    }

    container.innerHTML = html;

    // Animate diffs if we have a previous snapshot to compare against
    if (oldSnap.slots) {
        const rows = container.querySelectorAll('.dnd-spell-level-row[data-spell-level]');
        for (const row of rows) {
            const lvl = row.dataset.spellLevel;
            if (lvl === 'sp') continue;
            const level = parseInt(lvl);
            const oldData = oldSnap.slots.get(level);
            const newData = newSnap.slots.get(level);
            if (oldData && newData && oldData.current !== newData.current) {
                animateRowDiff(row, oldData.current, newData.current, newData.max);
            }
        }
    }

    // Sorcery points diff
    if (oldSnap.sorcery && newSnap.sorcery && oldSnap.sorcery.current !== newSnap.sorcery.current) {
        const spRow = container.querySelector('[data-spell-level="sp"]');
        if (spRow) {
            animateRowDiff(spRow, oldSnap.sorcery.current, newSnap.sorcery.current, newSnap.sorcery.max);
        }
    }

    // Secondary resource diff
    if (oldSnap.secondary && newSnap.secondary && oldSnap.secondary.current !== newSnap.secondary.current) {
        const srRow = container.querySelector('[data-spell-level="sr"]');
        if (srRow) {
            animateRowDiff(srRow, oldSnap.secondary.current, newSnap.secondary.current, newSnap.secondary.max);
        }
    }

    // Save current as previous for next diff
    _prevSlots = newSnap.slots;
    _prevSorcery = newSnap.sorcery;
    _prevSecondary = newSnap.secondary;
}

function renderStripSpellLevels($container, spellSlots, sorceryPoints, secondaryResource) {
    const $el = $container.find('.dnd-strip-spell-levels');
    if (!$el.length) return;
    if ((!spellSlots || !Array.isArray(spellSlots) || spellSlots.length === 0) && !sorceryPoints && !secondaryResource) {
        $el.html('<span style="font-size:0.5em;opacity:0.3">--</span>');
        return;
    }
    let html = '';
    if (spellSlots && spellSlots.length > 0) {
        html += spellSlots.map(s => {
            const label = s.level > 0 ? KEYCAP_EMOJIS[s.level] : '🪄';
            let cls = 'dnd-strip-spell-full';
            if (s.current === 0) cls = 'dnd-strip-spell-depleted';
            else if (s.current < s.max) cls = 'dnd-strip-spell-partial';
            return `<span class="dnd-strip-spell-level"><span class="${cls}">${label}${s.current}/${s.max}</span></span>`;
        }).join('');
    }
    if (sorceryPoints) {
        const sp = sorceryPoints;
        let cls = 'dnd-strip-spell-full';
        if (sp.current === 0) cls = 'dnd-strip-spell-depleted';
        else if (sp.current < sp.max) cls = 'dnd-strip-spell-partial';
        html += `<span class="dnd-strip-spell-level dnd-strip-spell-sorcery"><span class="${cls}">⚡${sp.current}/${sp.max}</span></span>`;
    }
    if (secondaryResource) {
        const sr = secondaryResource;
        let cls = 'dnd-strip-spell-full';
        if (sr.current === 0) cls = 'dnd-strip-spell-depleted';
        else if (sr.current < sr.max) cls = 'dnd-strip-spell-partial';
        html += `<span class="dnd-strip-spell-level dnd-strip-spell-secondary"><span class="${cls}">🔥${sr.current}/${sr.max}</span></span>`;
    }
    $el.html(html);
}

// ─── Expanded panel header widgets ──────────────────────────

export function updateHeaderWidgets() {
    const info = headerInfo;

    // Analog clock
    setClockHands(
        document.getElementById('dnd-clock-hour'),
        document.getElementById('dnd-clock-minute'),
        info.time
    );

    // Digital time
    const $time = $('#dnd-info-time');
    if ($time.length) {
        $time.text(info.time || '--:--')
            .toggleClass('dnd-value-empty', !info.time);
    }

    // Date with season
    const $dateWidget = $('#dnd-date-widget');
    const $date = $('#dnd-info-date');
    if ($date.length) {
        $date.text(info.date || '---').attr('title', info.date || '')
            .toggleClass('dnd-value-empty', !info.date);
    }
    applySeason($dateWidget[0], info.date);

    // Location with dynamic icon
    const $locIcon = $('#dnd-location-icon');
    const $location = $('#dnd-info-location');
    if ($location.length) {
        $location.text(info.location || '---').attr('title', info.location || '')
            .toggleClass('dnd-value-empty', !info.location);
    }
    if ($locIcon.length) {
        const iconClass = inferLocationIcon(info.location);
        $locIcon.html(`<i class="fa-solid ${iconClass}"></i>`);
    }

    // Weather with emoji
    const $emoji = $('#dnd-weather-emoji');
    const $weather = $('#dnd-info-weather');
    if ($emoji.length) {
        $emoji.text(info.weatherEmoji || '🌤️');
    }
    if ($weather.length) {
        $weather.text(info.weather || '---').attr('title', info.weather || '')
            .toggleClass('dnd-value-empty', !info.weather);
    }

    // Spell slots per-level
    renderSpellLevels(
        document.getElementById('dnd-spell-levels'),
        info.spellSlots,
        info.sorceryPoints,
        info.secondaryResource,
    );
    const $spellsWidget = $('#dnd-spells-widget');
    if ($spellsWidget.length) {
        if ((info.spellSlots && info.spellSlots.length > 0) || info.sorceryPoints || info.secondaryResource) {
            $spellsWidget.show();
        } else {
            $spellsWidget.hide();
        }
    }

    // Secondary widgets: 4-column grid with currency + omni items
    const $secondaryRow = $('#dnd-secondary-widgets');
    const c = info.currency;
    const hasOmni = info.extras && info.extras.length > 0;

    if ($secondaryRow.length) {
        const showCurrency = hasCurrency(c);
        if (!showCurrency && !hasOmni) {
            $secondaryRow.addClass('dnd-secondary-hidden').empty();
        } else {
            $secondaryRow.removeClass('dnd-secondary-hidden');
            renderSecondaryGrid($secondaryRow[0], showCurrency ? c : null, hasOmni ? info.extras : []);
        }
    }

    // Weather/time-of-day background visuals
    applyWeatherVisuals();
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Secondary grid (currency + omni) ───────────────────

const GRID_COLS = 4;

export const DEFAULT_OMNI_WIDGET_SIZES = {
    twoWide: 13,
    threeWide: 31,
    fullWide: 0,
};

export function getOmniWidgetSizes() {
    const o = extensionSettings.omniWidgetSizes;
    if (!o) return { ...DEFAULT_OMNI_WIDGET_SIZES };
    return {
        twoWide: o.twoWide ?? DEFAULT_OMNI_WIDGET_SIZES.twoWide,
        threeWide: o.threeWide ?? DEFAULT_OMNI_WIDGET_SIZES.threeWide,
        fullWide: o.fullWide ?? DEFAULT_OMNI_WIDGET_SIZES.fullWide,
    };
}

const EMOJI_WIDE_RE = /[\u2300-\u2BFF\u{1F000}-\u{1FFFF}]/u;
const COL_VISUAL_CAPACITY = 14;

function visualWidth(text, hasEmoji) {
    let w = hasEmoji ? 4 : 0;
    if (!text) return w;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp === 0x200D || (cp >= 0xFE00 && cp <= 0xFE0F)) continue;
        w += EMOJI_WIDE_RE.test(ch) ? 3 : 1;
    }
    return w;
}

function omniTextWeight(text, hasEmoji) {
    const vw = visualWidth(text, hasEmoji);
    const { twoWide, threeWide, fullWide } = getOmniWidgetSizes();
    let w = 1;
    if (fullWide > 0 && vw >= fullWide) w = GRID_COLS;
    else if (vw >= threeWide) w = 3;
    else if (vw >= twoWide) w = 2;
    const minSpan = Math.min(GRID_COLS, Math.ceil(vw / COL_VISUAL_CAPACITY));
    return Math.max(w, minSpan);
}

function buildCurrencyItemHtml(currency) {
    return buildCurrencyOmniHtml(currency);
}

function renderSecondaryGrid(container, currency, extras) {
    const items = [];

    if (currency) {
        items.push({
            html: buildCurrencyItemHtml(currency),
            title: formatCurrencyTitle(currency),
            weight: 1,
            cls: 'dnd-sec-item dnd-sec-currency',
        });
    }

    for (const e of extras) {
        const emojiHtml = e.emoji ? `<span class="dnd-omni-emoji">${escapeAttr(e.emoji)}</span>` : '';
        items.push({
            html: `${emojiHtml}<span class="dnd-omni-text">${escapeAttr(e.text || '')}</span>`,
            title: e.text || '',
            weight: omniTextWeight(e.text, !!e.emoji),
            cls: 'dnd-sec-item',
        });
    }

    if (items.length === 0) { container.innerHTML = ''; return; }

    // Sort by weight descending for first-fit-decreasing bin packing, but keep currency first
    items.sort((a, b) => {
        const aCur = a.cls.includes('dnd-sec-currency') ? 1 : 0;
        const bCur = b.cls.includes('dnd-sec-currency') ? 1 : 0;
        if (aCur !== bCur) return bCur - aCur;
        return b.weight - a.weight;
    });

    const rows = [];
    for (const item of items) {
        const span = Math.min(item.weight, GRID_COLS);
        let placed = false;
        for (const r of rows) {
            if (r.used + span <= GRID_COLS) {
                r.items.push({ ...item, span });
                r.used += span;
                placed = true;
                break;
            }
        }
        if (!placed) {
            rows.push({ items: [{ ...item, span }], used: span });
        }
    }

    // Fill remaining cols in each row — distribute to heaviest items first
    for (const r of rows) {
        let left = GRID_COLS - r.used;
        if (left > 0) {
            const sorted = [...r.items].sort((a, b) => b.weight - a.weight);
            for (const it of sorted) {
                if (left <= 0) break;
                it.span += 1;
                left--;
            }
        }
    }

    let html = '';
    for (const r of rows) {
        for (const it of r.items) {
            html += `<div class="${it.cls}" style="grid-column:span ${it.span}" title="${escapeAttr(it.title)}">${it.html}</div>`;
        }
    }
    container.innerHTML = html;
}

// ─── Strip widgets ──────────────────────────────────────────

export function updateStripWidgets() {
    const $container = $('#dnd-strip-widget-container');
    if (!$container.length) return;

    renderStripHeaderInfo($container);
    renderStripDice($container);
    renderStripQuests($container);
}

function renderStripHeaderInfo($container) {
    const info = headerInfo;

    // Mini analog clock
    setClockHands(
        $container.find('.dnd-strip-clock-hour')[0],
        $container.find('.dnd-strip-clock-minute')[0],
        info.time
    );
    $container.find('.dnd-strip-time-value')
        .text(info.time || '--:--').attr('title', info.time || '');

    // Date with season + month styling
    const $dateWidget = $container.find('.dnd-strip-widget-date');
    const dateText = info.date || '---';
    const shortDate = dateText.length > 12 ? dateText.substring(0, 10) + '…' : dateText;
    $container.find('.dnd-strip-date-value').text(shortDate).attr('title', dateText);
    $dateWidget.removeClass(ALL_THEME_CLASSES.join(' '));
    const season = inferSeason(info.date);
    if (season) $dateWidget.addClass(`dnd-season-${season}`);
    const stripMonth = inferMonth(info.date);
    if (stripMonth) $dateWidget.addClass(`dnd-month-${stripMonth.key}`);

    // Location with dynamic icon
    const iconClass = inferLocationIcon(info.location);
    $container.find('.dnd-strip-loc-icon')
        .removeClass()
        .addClass(`fa-solid ${iconClass} dnd-strip-loc-icon`);
    const locText = info.location || '---';
    $container.find('.dnd-strip-location-value').text(locText).attr('title', locText);

    // Weather emoji (large)
    $container.find('.dnd-strip-weather-emoji').text(info.weatherEmoji || '🌤️');
    const weatherText = info.weather || '---';
    const shortWeather = weatherText.length > 14 ? weatherText.substring(0, 12) + '…' : weatherText;
    $container.find('.dnd-strip-weather-value').text(shortWeather).attr('title', weatherText);

    // Spell slots per-level (strip)
    renderStripSpellLevels($container, info.spellSlots, info.sorceryPoints, info.secondaryResource);

    // Currency
    const $stripCurrency = $container.find('.dnd-strip-widget-currency');
    if ($stripCurrency.length) {
        const c = info.currency;
        if (hasCurrency(c)) {
            $stripCurrency.find('.dnd-strip-currency-value')
                .text(formatCurrencyStrip(c))
                .attr('title', formatCurrencyTitle(c));
            $stripCurrency.show();
        } else {
            $stripCurrency.hide();
        }
    }

    // Omni extras
    const $extrasContainer = $container.find('.dnd-strip-extras-container');
    if ($extrasContainer.length) {
        if (info.extras && info.extras.length > 0) {
            const html = info.extras.map(e => {
                const emojiHtml = e.emoji ? `<span class="dnd-strip-extra-emoji">${e.emoji}</span>` : '';
                const shortText = (e.text || '').length > 16 ? (e.text || '').substring(0, 14) + '…' : (e.text || '');
                return `<div class="dnd-strip-extra-item" title="${(e.text || '').replace(/"/g, '&quot;')}">
                    ${emojiHtml}
                    <span class="dnd-strip-extra-text">${shortText}</span>
                </div>`;
            }).join('');
            $extrasContainer.html(html);
        } else {
            $extrasContainer.empty();
        }
    }
}

function renderStripDice($container) {
    const $widget = $container.find('.dnd-strip-widget-dice');
    const $r1 = $widget.find('.dnd-strip-dice-r1');
    const $r2 = $widget.find('.dnd-strip-dice-r2');
    const $allyRows = $widget.find('#dnd-strip-ally-rows');
    const $enemyRows = $widget.find('#dnd-strip-enemy-rows');
    const $clearBtn = $widget.find('.dnd-strip-dice-clear');
    const $rollBtn = $widget.find('.dnd-strip-dice-roll');

    const roll = extensionSettings.lastDiceRoll;
    if (roll) {
        const users = roll.userRolls ?? (roll.roll1 != null
            ? [{ roll1: roll.roll1, roll2: roll.roll2 }] : []);
        const firstUser = users[0] || { roll1: '--', roll2: '--' };
        const extraUserSets = users.slice(1)
            .map((u, i) => `U${i + 2}: ${u.roll1}/${u.roll2}`)
            .join(', ');
        const extraTip = extraUserSets ? `\nExtra user sets: ${extraUserSets}` : '';

        $r1.text(firstUser.roll1).attr('title', `You 1st: ${firstUser.roll1}${extraTip}`);
        $r2.text(firstUser.roll2).attr('title', `You 2nd: ${firstUser.roll2}${extraTip}`);

        const allies = roll.allyRolls ?? (roll.allyRoll1 != null
            ? [{ roll1: roll.allyRoll1, roll2: roll.allyRoll2 }] : []);
        let allyHtml = '';
        for (let i = 0; i < allies.length; i++) {
            const a = allies[i];
            const label = allies.length === 1 ? 'Ally' : `A${i + 1}`;
            const diceTip = a.dmg ? `\nDice: ${formatDiceSetTooltip(a.dmg)}` : '';
            allyHtml += `<div class="dnd-strip-dice-row dnd-strip-dice-row-ally" title="${label}: d20 ${a.roll1} / ${a.roll2}${diceTip}">`
                + `<span class="dnd-strip-dice-row-label">${label}</span>`
                + `<span class="dnd-strip-dice-result dnd-strip-dice-ally">${a.roll1}</span>`
                + `<span class="dnd-strip-dice-sep">/</span>`
                + `<span class="dnd-strip-dice-result dnd-strip-dice-ally">${a.roll2}</span>`
                + `</div>`;
        }
        $allyRows.html(allyHtml);

        const enemies = roll.enemyRolls ?? (roll.npcRoll1 != null
            ? [{ roll1: roll.npcRoll1, roll2: roll.npcRoll2 }] : []);
        let enemyHtml = '';
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const label = enemies.length === 1 ? 'Foe' : `F${i + 1}`;
            const diceTip = e.dmg ? `\nDice: ${formatDiceSetTooltip(e.dmg)}` : '';
            enemyHtml += `<div class="dnd-strip-dice-row dnd-strip-dice-row-enemy" title="${label}: d20 ${e.roll1} / ${e.roll2}${diceTip}">`
                + `<span class="dnd-strip-dice-row-label">${label}</span>`
                + `<span class="dnd-strip-dice-result dnd-strip-dice-npc">${e.roll1}</span>`
                + `<span class="dnd-strip-dice-sep">/</span>`
                + `<span class="dnd-strip-dice-result dnd-strip-dice-npc">${e.roll2}</span>`
                + `</div>`;
        }
        $enemyRows.html(enemyHtml);

        $clearBtn.show();
    } else {
        $r1.text('--').attr('title', '');
        $r2.text('--').attr('title', '');
        $allyRows.html(`<div class="dnd-strip-dice-row dnd-strip-dice-row-ally">`
            + `<span class="dnd-strip-dice-row-label">Ally</span>`
            + `<span class="dnd-strip-dice-result dnd-strip-dice-ally">--</span>`
            + `<span class="dnd-strip-dice-sep">/</span>`
            + `<span class="dnd-strip-dice-result dnd-strip-dice-ally">--</span>`
            + `</div>`);
        $enemyRows.html(`<div class="dnd-strip-dice-row dnd-strip-dice-row-enemy">`
            + `<span class="dnd-strip-dice-row-label">Foe</span>`
            + `<span class="dnd-strip-dice-result dnd-strip-dice-npc">--</span>`
            + `<span class="dnd-strip-dice-sep">/</span>`
            + `<span class="dnd-strip-dice-result dnd-strip-dice-npc">--</span>`
            + `</div>`);
        $clearBtn.hide();
    }

    $rollBtn.off('click.stripRoll').on('click.stripRoll', () => {
        rollD20();
        updateStripWidgets();
        updateDiceDisplay();
    });

    $clearBtn.off('click.stripClear').on('click.stripClear', () => {
        clearDiceRoll();
        updateStripWidgets();
    });

    const poolDice = extensionSettings.lastDamageRoll;
    const $poolSep = $widget.find('.dnd-strip-pool-dice-sep');
    const $poolText = $widget.find('.dnd-strip-pool-dice-text');
    if (poolDice && (poolDice.dice?.length || poolDice.rolls?.length)) {
        const chips = poolDice.dice
            ? poolDice.dice.map(d => `d${d.sides}:${d.result}`)
            : poolDice.rolls.map(r => `d${poolDice.sides}:${r}`);
        $poolSep.show();
        $poolText.text(chips.join(' ')).attr('title', chips.join(', ')).show();
    } else {
        $poolSep.hide();
        $poolText.hide();
    }
}

function renderStripQuests($container) {
    const $list = $container.find('.dnd-strip-quests-list');
    if (!$list.length) return;

    if (!quests || quests.length === 0) {
        $list.html('<span class="dnd-strip-quest-item" style="opacity:0.3">No quests</span>');
        return;
    }

    const sorted = [...quests].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.priority || 1) - (a.priority || 1);
    });

    const STRIP_EMOJIS = { 1: '📌', 2: '🛡️', 3: '👑' };

    const display = sorted.slice(0, 4);
    const html = display.map(q => {
        let cls = 'dnd-strip-quest-item';
        const p = (q.priority >= 1 && q.priority <= 3) ? q.priority : 1;
        let prefix = '';
        if (!q.completed) {
            cls += ` dnd-strip-quest-typed dnd-strip-type-${p}`;
            prefix = `${STRIP_EMOJIS[p]} `;
        }
        if (q.completed) cls += ' dnd-quest-done';
        const truncated = q.text.length > 20 ? q.text.substring(0, 18) + '…' : q.text;
        return `<span class="${cls}" title="${q.text.replace(/"/g, '&quot;')}">${prefix}${truncated}</span>`;
    }).join('');

    const total = quests.filter(q => !q.completed).length;
    const extra = total > 4 ? `<span class="dnd-strip-quest-item" style="opacity:0.3">+${total - 4} more</span>` : '';
    $list.html(html + extra);
}
