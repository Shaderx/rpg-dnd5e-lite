/**
 * D&D 5e Lite - Desktop Strip Widgets & Header Widget Rendering
 * Analog clock, season cards, dynamic location icons, weather emoji, spell cubes
 */

import { extensionSettings, quests, headerInfo, setPendingDiceRoll } from '../core/state.js';
import { executeRoll, saveDiceRoll, updateDiceDisplay, clearDiceRoll } from '../features/dice.js';
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

function inferSeason(dateStr) {
    if (!dateStr) return null;
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

function applySeason(el, dateStr) {
    if (!el) return;
    const $el = $(el);
    $el.removeClass(SEASON_CLASSES.join(' '));
    const season = inferSeason(dateStr);
    if (season) $el.addClass(`dnd-season-${season}`);
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

function renderSpellLevels(container, spellSlots) {
    if (!container) return;
    if (!spellSlots || !Array.isArray(spellSlots) || spellSlots.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = spellSlots.map(s => {
        const label = s.level > 0 ? KEYCAP_EMOJIS[s.level] : '🪄';
        const filled = Math.max(0, Math.min(s.current, s.max));
        const empty = Math.max(0, s.max - filled);
        let cubes = '';
        for (let i = 0; i < filled; i++) cubes += '<div class="dnd-spell-cube dnd-spell-filled"></div>';
        for (let i = 0; i < empty; i++) cubes += '<div class="dnd-spell-cube dnd-spell-empty"></div>';
        return `<div class="dnd-spell-level-row">
            <span class="dnd-spell-level-label">${label}</span>
            <div class="dnd-spell-level-cubes">${cubes}</div>
            <span class="dnd-spell-level-count">${s.current}/${s.max}</span>
        </div>`;
    }).join('');
}

function renderStripSpellLevels($container, spellSlots) {
    const $el = $container.find('.dnd-strip-spell-levels');
    if (!$el.length) return;
    if (!spellSlots || !Array.isArray(spellSlots) || spellSlots.length === 0) {
        $el.html('<span style="font-size:0.5em;opacity:0.3">--</span>');
        return;
    }
    $el.html(spellSlots.map(s => {
        const label = s.level > 0 ? KEYCAP_EMOJIS[s.level] : '🪄';
        let cls = 'dnd-strip-spell-full';
        if (s.current === 0) cls = 'dnd-strip-spell-depleted';
        else if (s.current < s.max) cls = 'dnd-strip-spell-partial';
        return `<span class="dnd-strip-spell-level"><span class="${cls}">${label}${s.current}/${s.max}</span></span>`;
    }).join(''));
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
    renderSpellLevels(document.getElementById('dnd-spell-levels'), info.spellSlots);
    const $spellsWidget = $('#dnd-spells-widget');
    if ($spellsWidget.length) {
        if (info.spellSlots && info.spellSlots.length > 0) {
            $spellsWidget.show();
        } else {
            $spellsWidget.hide();
        }
    }

    // Currency
    const $currencyWidget = $('#dnd-currency-widget');
    const c = info.currency;
    if ($currencyWidget.length) {
        if (c) {
            $('#dnd-info-currency .dnd-coin-gold .dnd-coin-val').text(c.gold);
            $('#dnd-info-currency .dnd-coin-silver .dnd-coin-val').text(c.silver);
            $('#dnd-info-currency .dnd-coin-copper .dnd-coin-val').text(c.copper);
            $currencyWidget.show();
        } else {
            $currencyWidget.hide();
        }
    }

    // Omni / extra widgets
    const $omni = $('#dnd-omni-widgets');
    if ($omni.length) {
        if (info.extras && info.extras.length > 0) {
            const html = info.extras.map(e => {
                const wide = (e.text?.length || 0) > 30 ? ' dnd-omni-wide' : '';
                const emojiHtml = e.emoji ? `<span class="dnd-omni-emoji">${escapeAttr(e.emoji)}</span>` : '';
                return `<div class="dnd-omni-widget${wide}" title="${escapeAttr(e.text || '')}">
                    ${emojiHtml}
                    <span class="dnd-omni-text">${escapeAttr(e.text || '')}</span>
                </div>`;
            }).join('');
            $omni.html(html);
        } else {
            $omni.empty();
        }
    }

    // Weather/time-of-day background visuals
    applyWeatherVisuals();
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    // Date with season styling
    const $dateWidget = $container.find('.dnd-strip-widget-date');
    const dateText = info.date || '---';
    const shortDate = dateText.length > 12 ? dateText.substring(0, 10) + '…' : dateText;
    $container.find('.dnd-strip-date-value').text(shortDate).attr('title', dateText);
    $dateWidget.removeClass(SEASON_CLASSES.join(' '));
    const season = inferSeason(info.date);
    if (season) $dateWidget.addClass(`dnd-season-${season}`);

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
    renderStripSpellLevels($container, info.spellSlots);

    // Currency
    const $stripCurrency = $container.find('.dnd-strip-widget-currency');
    if ($stripCurrency.length) {
        const c = info.currency;
        if (c) {
            $stripCurrency.find('.dnd-strip-currency-value')
                .text(`${c.gold}🟡 ${c.silver}⚪ ${c.copper}🟤`)
                .attr('title', `Gold: ${c.gold}  Silver: ${c.silver}  Copper: ${c.copper}`);
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
    const $result = $widget.find('.dnd-strip-dice-result');
    const $clearBtn = $widget.find('.dnd-strip-dice-clear');
    const $rollBtn = $widget.find('.dnd-strip-dice-roll');

    const roll = extensionSettings.lastDiceRoll;
    if (roll) {
        $result.text(roll.total).attr('title', `${roll.formula}: ${roll.total}`);
        $clearBtn.show();
    } else {
        $result.text('--').attr('title', '');
        $clearBtn.hide();
    }

    $rollBtn.off('click.stripRoll').on('click.stripRoll', () => {
        const result = executeRoll(1, 20);
        setPendingDiceRoll({
            formula: '1d20', total: result.total, rolls: result.rolls, timestamp: Date.now()
        });
        saveDiceRoll();
        updateStripWidgets();
        updateDiceDisplay();
    });

    $clearBtn.off('click.stripClear').on('click.stripClear', () => {
        clearDiceRoll();
        updateStripWidgets();
    });
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
        return (b.priority || 0) - (a.priority || 0);
    });

    const display = sorted.slice(0, 4);
    const html = display.map(q => {
        let cls = 'dnd-strip-quest-item';
        let prefix = '';
        const p = q.priority || 0;
        if (!q.completed && p >= 1) {
            cls += ` dnd-quest-starred dnd-strip-priority-${p}`;
            prefix = '★ ';
        }
        if (q.completed) cls += ' dnd-quest-done';
        const truncated = q.text.length > 20 ? q.text.substring(0, 18) + '…' : q.text;
        return `<span class="${cls}" title="${q.text.replace(/"/g, '&quot;')}">${prefix}${truncated}</span>`;
    }).join('');

    const total = quests.filter(q => !q.completed).length;
    const extra = total > 4 ? `<span class="dnd-strip-quest-item" style="opacity:0.3">+${total - 4} more</span>` : '';
    $list.html(html + extra);
}
