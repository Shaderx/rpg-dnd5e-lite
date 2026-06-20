/**
 * D&D 5e Lite - Currency parsing
 *
 * Designed to parse currency from a wide variety of LLM output formats.
 * Does NOT depend on absolute header position — any text containing
 * recognisable currency tokens can be parsed.
 *
 * Recognised leaders: 💰, 🪙, or none (signal-based detection)
 *
 * Formats handled:
 *   Amount-first  : "150 gp", "12g 45s 30c", "1,250 GP", "12 Gold 45 Silver"
 *   Word-first    : "Gold: 12", "Silver = 45", "GP: 100"
 *   Emoji coins   : "12🟡45⚪30🟤", "12🟡 45⚪ 30🟤"
 *   Parenthetical : "(150 gp, 30 sp)", "Gold (150)"
 *   Piece/coin    : "150 gold pieces", "45 silver coins"
 *   Platinum/EP   : Normalised into gp/sp (1pp=10gp, 1ep=5sp)
 *   Bare amount   : "💰 150" → defaults to gold
 *   Mixed         : "150gp, 45sp, 30cp" — comma/semicolon separated
 */

const AMOUNT = String.raw`(\d+(?:,\d{3})*(?:\.\d+)?)`;

const UNIT_ALTS = [
    'platinum\\s*(?:pieces?|coins?)?', 'pp',
    'electrum\\s*(?:pieces?|coins?)?', 'ep',
    'gold\\s*(?:pieces?|coins?)?', 'gp', 'g', '🟡',
    'silver\\s*(?:pieces?|coins?)?', 'sp', 's', '⚪',
    'copper\\s*(?:pieces?|coins?)?', 'cp', 'c', '🟤',
];

const AMOUNT_FIRST_RE = new RegExp(
    `${AMOUNT}\\s*(?:${UNIT_ALTS.join('|')})(?![a-z])`,
    'giu'
);

const WORD_FIRST_RE = new RegExp(
    String.raw`\b(gold|silver|copper|platinum|electrum|gp|sp|cp|pp|ep)\b\s*[:=()]\s*${AMOUNT}`,
    'giu'
);

const EMOJI_TRIPLE_RE = new RegExp(
    `${AMOUNT}\\s*🟡\\s*${AMOUNT}\\s*⚪\\s*${AMOUNT}\\s*🟤`,
    'u'
);

const BARE_AMOUNT_RE = new RegExp(
    String.raw`^${AMOUNT}\s*(?:gp|g|gold|pieces?)?\s*$`,
    'iu'
);

const BARE_NUMBER_RE = new RegExp(String.raw`^${AMOUNT}\s*$`);

const LEADER_RE = /^(?:💰|🪙)\s*/u;

const CURRENCY_SIGNAL_RE = /(?:\b(?:gold|silver|copper|platinum|electrum|gp|sp|cp|pp|ep)\b|🟡|⚪|🟤)/iu;

function parseAmount(str) {
    const n = parseFloat(String(str).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.floor(n) : 0;
}

/**
 * @param {{ gold: number, silver: number, copper: number }} cur
 * @param {'gold'|'silver'|'copper'} field
 * @param {number} amount
 */
function addCoin(cur, field, amount) {
    if (amount > 0) cur[field] += amount;
}

function normaliseUnit(raw) {
    const u = raw.toLowerCase().replace(/\uFE0F/g, '').replace(/\s*(pieces?|coins?)\s*/g, '').trim();
    if (u === 'pp' || u === 'platinum') return 'platinum';
    if (u === 'ep' || u === 'electrum') return 'electrum';
    if (u === 'gp' || u === 'g' || u === 'gold' || u === '🟡') return 'gold';
    if (u === 'sp' || u === 's' || u === 'silver' || u === '⚪') return 'silver';
    if (u === 'cp' || u === 'c' || u === 'copper' || u === '🟤') return 'copper';
    return null;
}

function applyUnit(cur, rawUnit, amount) {
    const kind = normaliseUnit(rawUnit);
    if (!kind) return false;
    switch (kind) {
        case 'platinum': addCoin(cur, 'gold', amount * 10); break;
        case 'electrum': addCoin(cur, 'silver', amount * 5); break;
        case 'gold':     addCoin(cur, 'gold', amount);       break;
        case 'silver':   addCoin(cur, 'silver', amount);     break;
        case 'copper':   addCoin(cur, 'copper', amount);     break;
    }
    return true;
}

/**
 * Core extraction — works on any text body, no leader prefix required.
 * @returns {{ gold: number, silver: number, copper: number } | null}
 */
export function extractCurrency(body) {
    if (!body) return null;

    const cur = { gold: 0, silver: 0, copper: 0 };
    let found = false;

    const emojiTriple = body.match(EMOJI_TRIPLE_RE);
    if (emojiTriple) {
        return {
            gold: parseAmount(emojiTriple[1]),
            silver: parseAmount(emojiTriple[2]),
            copper: parseAmount(emojiTriple[3]),
        };
    }

    let m;
    AMOUNT_FIRST_RE.lastIndex = 0;
    while ((m = AMOUNT_FIRST_RE.exec(body)) !== null) {
        const unit = m[0].replace(new RegExp(`^${AMOUNT}\\s*`, 'u'), '');
        if (applyUnit(cur, unit, parseAmount(m[1]))) found = true;
    }

    WORD_FIRST_RE.lastIndex = 0;
    while ((m = WORD_FIRST_RE.exec(body)) !== null) {
        if (applyUnit(cur, m[1], parseAmount(m[2]))) found = true;
    }

    if (found) return cur;

    const bareGp = body.match(BARE_AMOUNT_RE);
    if (bareGp) return { gold: parseAmount(bareGp[1]), silver: 0, copper: 0 };

    const bareNum = body.match(BARE_NUMBER_RE);
    if (bareNum) return { gold: parseAmount(bareNum[1]), silver: 0, copper: 0 };

    return null;
}

/**
 * Parse from a 💰 / 🪙 prefixed header section (original entry-point).
 * @returns {{ gold: number, silver: number, copper: number } | null}
 */
export function parseCurrencySection(section) {
    if (!section || !LEADER_RE.test(section)) return null;
    const body = section.replace(LEADER_RE, '').trim();
    return body ? extractCurrency(body) : null;
}

/**
 * Detect whether arbitrary text contains strong currency signals
 * (usable even without a 💰 / 🪙 leader).
 */
export function hasCurrencySignal(text) {
    return CURRENCY_SIGNAL_RE.test(text);
}

/** @param {{ gold?: number, silver?: number, copper?: number } | null} c */
export function hasCurrency(c) {
    return c != null && (c.gold > 0 || c.silver > 0 || c.copper > 0);
}

/** Compact strip label — only non-zero denominations */
export function formatCurrencyStrip(c) {
    const parts = [];
    if (c.gold > 0) parts.push(`${c.gold}🟡`);
    if (c.silver > 0) parts.push(`${c.silver}⚪`);
    if (c.copper > 0) parts.push(`${c.copper}🟤`);
    return parts.length > 0 ? parts.join(' ') : '0🟡';
}

/** Tooltip / title for currency widget */
export function formatCurrencyTitle(c) {
    const parts = [];
    if (c.gold > 0) parts.push(`${c.gold} gp`);
    if (c.silver > 0) parts.push(`${c.silver} sp`);
    if (c.copper > 0) parts.push(`${c.copper} cp`);
    return parts.length > 0 ? parts.join(', ') : '0 gp';
}
