/**
 * D&D 5e Lite - Weather Visuals
 * Automatic background overlays (fog, rain, snow, wind, sandstorm, ash, magical)
 * and directional time-of-day lighting, all driven by headerInfo parsed from
 * AI messages. Supports compound weather (e.g. foggy rain) and intensity
 * scaling (light / moderate / heavy).
 */

import { extensionSettings, headerInfo } from '../core/state.js';

const PREFIX = 'dnd-weather';

// ─── Weather-type inference from header text ─────────────

const WEATHER_PATTERNS = [
    { type: 'snow',      re: /\b(snow|blizzard|sleet|hail|flurr)/i },
    { type: 'rain',      re: /\b(rain|drizzle|storm|thunder|downpour|shower|pour|torrent|monsoon|squall|lightning)/i },
    { type: 'sandstorm', re: /\b(sandstorm|duststorm|sand\s*storm|dust\s*storm|sirocco|haboob|dust|arid)/i },
    { type: 'ash',       re: /\b(ash|volcanic|ember|cinder|soot)/i },
    { type: 'wind',      re: /\b(wind|gust|gale|breeze|blustery|windswept|cyclone|whirlwind)/i },
    { type: 'fog',       re: /\b(fog|mist|haze|overcast|cloudy|cloud cover|smog|murk)/i },
    { type: 'magical',   re: /\b(arcane|magical|ethereal|enchanted|aurora|shimmer|radiant|fey|ley|eldritch)/i },
];

const INTENSITY_HEAVY = /\b(heavy|torrential|blinding|thick|dense|violent|fierce|brutal|severe)\b/i;
const INTENSITY_LIGHT = /\b(light|gentle|slight|mild|faint|thin|scattered|patchy|intermittent)\b/i;

const INTENSITY_MULTIPLIERS = { light: 0.5, moderate: 1.0, heavy: 1.6 };

const EMOJI_TYPE_MAP = [
    { emojis: '❄️🌨️☃️',    type: 'snow' },
    { emojis: '🌧️⛈️🌩️💧🌊', type: 'rain' },
    { emojis: '🌫️',          type: 'fog' },
    { emojis: '💨🍃🌬️',     type: 'wind' },
    { emojis: '🏜️',          type: 'sandstorm' },
    { emojis: '🌋🔥',        type: 'ash' },
    { emojis: '✨🔮💫🌌',    type: 'magical' },
];

/**
 * Structured weather inference: returns all matching types (compound)
 * ordered by position in text, plus an intensity level.
 * @returns {{ types: string[], intensity: 'light'|'moderate'|'heavy', raw: string }}
 */
export function inferWeather(weatherText, weatherEmoji) {
    const raw = weatherText || '';
    const text = raw.toLowerCase();

    const matches = [];
    for (const { type, re } of WEATHER_PATTERNS) {
        const m = re.exec(text);
        if (m) matches.push({ type, pos: m.index });
    }
    matches.sort((a, b) => a.pos - b.pos);
    const types = matches.map(m => m.type);

    if (types.length === 0 && weatherEmoji) {
        for (const { emojis, type } of EMOJI_TYPE_MAP) {
            if (emojis.includes(weatherEmoji)) { types.push(type); break; }
        }
    }

    if (types.length === 0) types.push('clear');

    let intensity = 'moderate';
    if (INTENSITY_HEAVY.test(text)) intensity = 'heavy';
    else if (INTENSITY_LIGHT.test(text)) intensity = 'light';

    return { types, intensity, raw };
}

/**
 * Backward-compatible single-type inference.
 * Returns 'clear'|'fog'|'rain'|'snow'|'wind'|'sandstorm'|'ash'|'magical'.
 */
export function inferWeatherType(weatherText, weatherEmoji) {
    return inferWeather(weatherText, weatherEmoji).types[0];
}

// ─── Time-of-day inference from header time ──────────────

/**
 * Derive a time-of-day bucket from the header's time string.
 * Returns 'morning' | 'day' | 'evening' | 'night'.
 */
export function inferTimeOfDay(timeStr, weatherText) {
    const wt = (weatherText || '').toLowerCase();
    if (/\bnight\b/.test(wt)) return 'night';
    if (/\bdawn\b/.test(wt)) return 'morning';
    if (/\bdusk\b|\btwilight\b/.test(wt)) return 'evening';

    if (!timeStr) return 'day';
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return 'day';

    let hours = parseInt(m[1]);
    const period = m[3]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    if (hours >= 5 && hours < 9) return 'morning';
    if (hours >= 9 && hours < 17) return 'day';
    if (hours >= 17 && hours < 21) return 'evening';
    return 'night';
}

// ─── Color helpers ───────────────────────────────────────

function hexToRgba(hex, alpha) {
    const clean = String(hex).replace('#', '').trim();
    const norm = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    const num = parseInt(norm, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function getWeatherOverlay(weatherType, intensityMul = 1.0) {
    const s = extensionSettings.weatherVisuals;
    const clamp = (v) => Math.min(v * intensityMul, 1);
    switch (weatherType) {
        case 'fog':       return hexToRgba(s.fogColor,       clamp(s.fogOpacity));
        case 'rain':      return hexToRgba(s.rainColor,      clamp(s.rainOpacity));
        case 'snow':      return hexToRgba(s.snowColor,      clamp(s.snowOpacity));
        case 'wind':      return hexToRgba(s.windColor,      clamp(s.windOpacity));
        case 'sandstorm': return hexToRgba(s.sandstormColor, clamp(s.sandstormOpacity));
        case 'ash':       return hexToRgba(s.ashColor,       clamp(s.ashOpacity));
        case 'magical':   return hexToRgba(s.magicalColor,   clamp(s.magicalOpacity));
        default:          return hexToRgba(s.clearColor,     clamp(s.clearOpacity));
    }
}

// ─── Lighting overlay gradients ──────────────────────────

function a(base, k) {
    return Math.min(base * Math.max(0, k), 1).toFixed(3);
}

/**
 * Build multi-layered CSS backgrounds for the lighting overlay.
 * The `intensity` factor (0..2) scales all alpha values linearly.
 * These values are designed to work with blend modes like soft-light
 * and overlay where higher alphas interact naturally with the wallpaper.
 */
function getLightingBackground(tod, intensity) {
    const k = intensity;

    switch (tod) {
        case 'morning':
            return [
                `radial-gradient(ellipse 140% 70% at 50% 108%, rgba(255,160,60,${a(0.55, k)}) 0%, rgba(255,195,110,${a(0.30, k)}) 30%, transparent 62%)`,
                `linear-gradient(to top, rgba(255,140,50,${a(0.35, k)}) 0%, rgba(255,200,130,${a(0.18, k)}) 35%, rgba(255,230,190,${a(0.06, k)}) 60%, transparent 80%)`,
                `radial-gradient(ellipse 90% 50% at 25% 100%, rgba(255,110,60,${a(0.25, k)}) 0%, transparent 50%)`,
                `linear-gradient(to bottom, rgba(255,220,180,${a(0.08, k)}) 0%, transparent 40%)`,
            ].join(', ');

        case 'day':
            return [
                `radial-gradient(ellipse 80% 50% at 55% -8%, rgba(255,255,220,${a(0.18, k)}) 0%, rgba(255,255,240,${a(0.08, k)}) 30%, transparent 55%)`,
                `linear-gradient(to bottom, rgba(255,255,245,${a(0.10, k)}) 0%, rgba(255,255,250,${a(0.04, k)}) 30%, transparent 50%)`,
                `linear-gradient(rgba(255,252,240,${a(0.04, k)}), rgba(255,252,240,${a(0.04, k)}))`,
            ].join(', ');

        case 'evening':
            return [
                `radial-gradient(ellipse 140% 70% at 50% 108%, rgba(255,70,20,${a(0.50, k)}) 0%, rgba(220,60,100,${a(0.30, k)}) 30%, transparent 62%)`,
                `linear-gradient(to top, rgba(255,95,30,${a(0.35, k)}) 0%, rgba(180,50,100,${a(0.22, k)}) 35%, rgba(80,30,90,${a(0.14, k)}) 65%, rgba(40,15,60,${a(0.08, k)}) 100%)`,
                `radial-gradient(ellipse 70% 45% at 75% 100%, rgba(255,150,40,${a(0.30, k)}) 0%, transparent 50%)`,
                `radial-gradient(ellipse 120% 50% at 50% -10%, rgba(60,20,80,${a(0.12, k)}) 0%, transparent 50%)`,
            ].join(', ');

        case 'night':
            return [
                `linear-gradient(to bottom, rgba(6,10,35,${a(0.65, k)}) 0%, rgba(10,16,45,${a(0.55, k)}) 40%, rgba(6,8,28,${a(0.60, k)}) 100%)`,
                `radial-gradient(ellipse 55% 45% at 74% 6%, rgba(160,190,240,${a(0.18, k)}) 0%, rgba(120,150,210,${a(0.06, k)}) 35%, transparent 55%)`,
                `radial-gradient(ellipse 25% 20% at 74% 4%, rgba(210,225,255,${a(0.12, k)}) 0%, transparent 40%)`,
                `linear-gradient(rgba(15,20,50,${a(0.20, k)}), rgba(15,20,50,${a(0.20, k)}))`,
            ].join(', ');

        default:
            return 'none';
    }
}

// ─── DOM mount / teardown ────────────────────────────────

/** @returns {HTMLElement} */
function getBackgroundHost() {
    return /** @type {HTMLElement} */ (
        document.querySelector('#bg_custom') ||
        document.querySelector('.bg_custom') ||
        document.querySelector('#background') ||
        document.querySelector('.background') ||
        document.querySelector('#bg1') ||
        document.querySelector('.bg1') ||
        document.querySelector('#chat_background') ||
        document.querySelector('.chat_background') ||
        document.body
    );
}

function ensureMount() {
    if (document.getElementById(`${PREFIX}-visuals`)) return;

    const host = getBackgroundHost();
    const style = window.getComputedStyle(host);
    if (style.position === 'static') host.style.position = 'relative';

    const visuals = document.createElement('div');
    visuals.id = `${PREFIX}-visuals`;
    visuals.innerHTML = `
        <div id="${PREFIX}-overlay"></div>
        <div id="${PREFIX}-overlay-secondary"></div>
        <div id="${PREFIX}-fog" class="${PREFIX}-fogwrapper">
            <div id="${PREFIX}-foglayer_01" class="${PREFIX}-foglayer">
                <div class="image01"></div><div class="image02"></div>
            </div>
            <div id="${PREFIX}-foglayer_02" class="${PREFIX}-foglayer">
                <div class="image01"></div><div class="image02"></div>
            </div>
            <div id="${PREFIX}-foglayer_03" class="${PREFIX}-foglayer">
                <div class="image01"></div><div class="image02"></div>
            </div>
        </div>
        <div id="${PREFIX}-particles"></div>
        <div id="${PREFIX}-lighting"></div>
    `;
    host.appendChild(visuals);
}

// ─── Particle system ─────────────────────────────────────

function clearParticles() {
    const el = document.getElementById(`${PREFIX}-particles`);
    if (el) el.innerHTML = '';
}

const PARTICLE_CONFIGURATORS = {
    rain(span) {
        span.style.left = `${Math.random() * 100}%`;
        span.style.height = `${12 + Math.random() * 22}px`;
        span.style.animationDuration = `${0.55 + Math.random() * 0.55}s`;
        span.style.animationDelay = `${Math.random() * -8}s`;
        span.style.opacity = `${0.25 + Math.random() * 0.45}`;
    },
    snow(span) {
        const size = 2 + Math.random() * 5;
        span.style.left = `${Math.random() * 100}%`;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.animationDuration = `${4 + Math.random() * 5}s`;
        span.style.animationDelay = `${Math.random() * -8}s`;
        span.style.opacity = `${0.35 + Math.random() * 0.6}`;
    },
    wind(span) {
        const w = 4 + Math.random() * 8;
        span.style.top = `${Math.random() * 100}%`;
        span.style.left = '0';
        span.style.width = `${w}px`;
        span.style.height = `${1 + Math.random() * 2}px`;
        span.style.animationDuration = `${2 + Math.random() * 3}s`;
        span.style.animationDelay = `${Math.random() * -6}s`;
        span.style.opacity = `${0.2 + Math.random() * 0.5}`;
    },
    sandstorm(span) {
        span.style.left = `${Math.random() * 100}%`;
        const size = 1.5 + Math.random() * 3;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.animationDuration = `${1 + Math.random() * 2}s`;
        span.style.animationDelay = `${Math.random() * -4}s`;
        span.style.opacity = `${0.3 + Math.random() * 0.5}`;
    },
    ash(span) {
        span.style.left = `${Math.random() * 100}%`;
        const size = 2 + Math.random() * 4;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.animationDuration = `${5 + Math.random() * 5}s`;
        span.style.animationDelay = `${Math.random() * -10}s`;
        span.style.opacity = `${0.25 + Math.random() * 0.45}`;
    },
    magical(span) {
        span.style.left = `${Math.random() * 100}%`;
        const size = 3 + Math.random() * 5;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        const moveDur = 4 + Math.random() * 4;
        const glowDur = 2 + Math.random() * 2;
        span.style.animationDuration = `${moveDur}s, ${glowDur}s`;
        span.style.animationDelay = `${Math.random() * -8}s, ${Math.random() * -4}s`;
    },
};

function buildParticles(weatherType, intensityMul = 1.0) {
    const el = document.getElementById(`${PREFIX}-particles`);
    if (!el) return;
    clearParticles();

    const configure = PARTICLE_CONFIGURATORS[weatherType];
    if (!configure) return;

    const baseCount = extensionSettings.weatherVisuals.particleCount;
    const count = Math.round(baseCount * intensityMul);
    if (count <= 0) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = `${PREFIX}-particle ${PREFIX}-${weatherType}-particle`;
        configure(span);
        frag.appendChild(span);
    }
    el.appendChild(frag);
}

// ─── Public API ──────────────────────────────────────────

let lastWeatherKey = null;
let lastTimeOfDay = null;

/**
 * Apply weather visuals + lighting overlay based on current headerInfo.
 * Supports compound weather types and intensity scaling.
 */
export function applyWeatherVisuals() {
    const wSettings = extensionSettings.weatherVisuals;
    const lSettings = extensionSettings.lightingOverlay;
    const weatherEnabled = wSettings?.enabled;
    const lightingEnabled = lSettings?.enabled;

    if (!weatherEnabled && !lightingEnabled) {
        destroyWeatherVisuals();
        return;
    }

    ensureMount();

    const weather = inferWeather(headerInfo.weather, headerInfo.weatherEmoji);
    const tod = inferTimeOfDay(headerInfo.time, headerInfo.weather);
    const intensityMul = INTENSITY_MULTIPLIERS[weather.intensity];
    const primaryType = weather.types[0] || 'clear';

    // Primary weather overlay
    const overlay = document.getElementById(`${PREFIX}-overlay`);
    if (overlay) {
        if (weatherEnabled) {
            const wOverlay = getWeatherOverlay(primaryType, intensityMul);
            overlay.style.background = `linear-gradient(${wOverlay}, ${wOverlay})`;
            overlay.style.display = '';
        } else {
            overlay.style.background = 'none';
        }
    }

    // Secondary overlay for compound weather (reduced intensity)
    const overlay2 = document.getElementById(`${PREFIX}-overlay-secondary`);
    if (overlay2) {
        if (weatherEnabled && weather.types.length > 1) {
            const secondaryType = weather.types[1];
            const wOverlay = getWeatherOverlay(secondaryType, intensityMul * 0.6);
            overlay2.style.background = `linear-gradient(${wOverlay}, ${wOverlay})`;
            overlay2.style.display = '';
        } else {
            overlay2.style.background = 'none';
            overlay2.style.display = 'none';
        }
    }

    // Fog layers — show if any matched type is fog
    const fog = document.getElementById(`${PREFIX}-fog`);
    if (fog) fog.style.display = (weatherEnabled && weather.types.includes('fog')) ? 'block' : 'none';

    // Particles for primary type — rebuild when type or intensity changes
    const weatherKey = `${primaryType}:${weather.intensity}`;
    if (weatherEnabled) {
        if (weatherKey !== lastWeatherKey) {
            buildParticles(primaryType, intensityMul);
            lastWeatherKey = weatherKey;
        }
    } else {
        clearParticles();
        lastWeatherKey = null;
    }

    // Lighting overlay
    applyLightingOverlay(tod);

    lastTimeOfDay = tod;
}

const VALID_BLEND_MODES = [
    'soft-light', 'overlay', 'multiply', 'screen',
    'color', 'hard-light', 'color-dodge', 'color-burn', 'normal',
];

/**
 * Apply the directional lighting overlay for the given time of day.
 */
export function applyLightingOverlay(tod) {
    const el = document.getElementById(`${PREFIX}-lighting`);
    if (!el) return;

    const lSettings = extensionSettings.lightingOverlay;
    if (!lSettings?.enabled) {
        el.style.background = 'none';
        el.style.mixBlendMode = 'normal';
        el.removeAttribute('data-tod');
        return;
    }

    const intensity = lSettings.intensity ?? 1.0;
    const blend = VALID_BLEND_MODES.includes(lSettings.blendMode)
        ? lSettings.blendMode
        : 'soft-light';

    el.style.background = getLightingBackground(tod ?? 'day', intensity);
    el.style.mixBlendMode = blend;
    el.setAttribute('data-tod', tod ?? 'day');
}

/**
 * Remove all weather + lighting visual DOM elements.
 */
export function destroyWeatherVisuals() {
    document.getElementById(`${PREFIX}-visuals`)?.remove();
    lastWeatherKey = null;
    lastTimeOfDay = null;
}

/**
 * Force-rebuild particles (e.g. after particle count changes).
 */
export function rebuildWeatherParticles() {
    if (!extensionSettings.weatherVisuals?.enabled) return;
    const weather = inferWeather(headerInfo.weather, headerInfo.weatherEmoji);
    const primaryType = weather.types[0] || 'clear';
    const intensityMul = INTENSITY_MULTIPLIERS[weather.intensity];
    lastWeatherKey = null;
    buildParticles(primaryType, intensityMul);
    lastWeatherKey = `${primaryType}:${weather.intensity}`;
}

/**
 * Refresh just the lighting overlay (e.g. after intensity changes).
 */
export function refreshLightingOverlay() {
    const tod = inferTimeOfDay(headerInfo.time, headerInfo.weather);
    applyLightingOverlay(tod);
}
