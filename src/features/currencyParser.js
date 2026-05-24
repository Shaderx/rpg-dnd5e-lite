/**
 * D&D 5e Lite - Currency parsing from 💰 header sections
 *
 * Supports:
 * - "💰 150 gp", "💰 12g 45s 30c", "💰 1,250 GP"
 * - "💰 12 Gold 45 Silver 30 Copper", word-first "Gold: 12"
 * - Legacy emoji triple: "💰 12🟡45⚪30🟤"
 * - Platinum / electrum (normalized into gp/sp for display)
 * - Bare amount after 💰 (defaults to gold): "💰 150"
 */

const AMOUNT = String.raw`(\d+(?:,\d{3})*(?:\.\d+)?)`;

/** amount-first: 150 gp, 12g, 1,250 Gold — longest unit names before single-letter aliases */
const AMOUNT_FIRST_RE = new RegExp(
    `${AMOUNT}\\s*(platinum|pp|electrum|ep|gold|gp|g|silver|sp|s|copper|cp|c|🟡|⚪|🟤)`,
    'giu'
);

/** word-first: Gold: 12 (requires : or = so "12 Gold 45 Silver" isn't misread) */
const WORD_FIRST_RE = new RegExp(
    String.raw`\b(gold|silver|copper|platinum|electrum|gp|sp|cp|pp|ep)\b\s*[:=]\s*${AMOUNT}`,
    'giu'
);

const EMOJI_TRIPLE_RE = new RegExp(
    `${AMOUNT}\\D*🟡\\D*${AMOUNT}\\D*⚪\\D*${AMOUNT}\\D*🟤`,
    'u'
);

const BARE_AMOUNT_RE = new RegExp(
    String.raw`^${AMOUNT}\s*(?:gp|g|gold|pieces?)?\s*$`,
    'iu'
);

const BARE_NUMBER_RE = new RegExp(String.raw`^${AMOUNT}\s*$`);

function parseAmount(str) {
    const n = parseFloat(String(str).replace(/,/g, ''));
    return Number.isFinite(n) ? Math.floor(n) : 0;
}

/**
 * @param {'gold'|'silver'|'copper'} field
 * @param {number} amount
 * @param {{ gold: number, silver: number, copper: number }} cur
 */
function addCoin(cur, field, amount) {
    if (amount > 0) cur[field] += amount;
}

/**
 * @param {string} unit
 * @param {number} amount
 * @param {{ gold: number, silver: number, copper: number }} cur
 */
function applyUnit(cur, unit, amount) {
    const u = unit.toLowerCase().replace(/\uFE0F/g, '');
    switch (u) {
        case 'pp':
        case 'platinum':
            addCoin(cur, 'gold', amount * 10);
            break;
        case 'ep':
        case 'electrum':
            addCoin(cur, 'silver', amount * 5);
            break;
        case 'gp':
        case 'g':
        case 'gold':
        case '🟡':
            addCoin(cur, 'gold', amount);
            break;
        case 'sp':
        case 's':
        case 'silver':
        case '⚪':
            addCoin(cur, 'silver', amount);
            break;
        case 'cp':
        case 'c':
        case 'copper':
        case '🟤':
            addCoin(cur, 'copper', amount);
            break;
        default:
            return false;
    }
    return true;
}

/**
 * @returns {{ gold: number, silver: number, copper: number } | null}
 */
export function parseCurrencySection(section) {
    if (!section || !/^💰/u.test(section)) return null;

    const body = section.replace(/^💰\s*/u, '').trim();
    if (!body) return null;

    const cur = { gold: 0, silver: 0, copper: 0 };
    let found = false;

    const emojiTriple = body.match(EMOJI_TRIPLE_RE);
    if (emojiTriple) {
        return {
            gold: parseAmount(emojiTriple[1]),
            silver: parseAmount(emojiTriple[2]),
            copper: parseAmount(emojiTriple[3])
        };
    }

    let m;
    AMOUNT_FIRST_RE.lastIndex = 0;
    while ((m = AMOUNT_FIRST_RE.exec(body)) !== null) {
        if (applyUnit(cur, m[2], parseAmount(m[1]))) found = true;
    }

    WORD_FIRST_RE.lastIndex = 0;
    while ((m = WORD_FIRST_RE.exec(body)) !== null) {
        if (applyUnit(cur, m[1], parseAmount(m[2]))) found = true;
    }

    if (found) return cur;

    const bareGp = body.match(BARE_AMOUNT_RE);
    if (bareGp) {
        return { gold: parseAmount(bareGp[1]), silver: 0, copper: 0 };
    }

    const bareNum = body.match(BARE_NUMBER_RE);
    if (bareNum) {
        return { gold: parseAmount(bareNum[1]), silver: 0, copper: 0 };
    }

    return null;
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
