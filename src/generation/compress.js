/**
 * Shared prompt compression helpers for token-heavy combat notes.
 */

const REPLACEMENTS = [
    [/\bbludgeoning\/piercing\/slashing\b/gi, 'B/P/S'],
    [/\bbonus action\b/gi, 'BA'],
    [/\breaction\b/gi, 'rxn'],
    [/\badvantage\b/gi, 'adv'],
    [/\bdisadvantage\b/gi, 'dis'],
    [/\bproficiency bonus\b/gi, 'prof'],
    [/\bsaving throws\b/gi, 'saves'],
    [/\bsaving throw\b/gi, 'save'],
    [/\bdamage\b/gi, 'dmg'],
    [/\battacks\b/gi, 'atks'],
    [/\battack\b/gi, 'atk'],
    [/\bhit points\b/gi, 'HP'],
];

const FILLER_PREFIX = /(^|[;:.]\s+)(?:You can|You have|Gain)\s+/gi;

export function compressCombatNote(text) {
    if (text == null) return '';

    let out = String(text).replace(/\s+/g, ' ').trim();
    if (!out) return '';

    for (const [pattern, replacement] of REPLACEMENTS) {
        out = out.replace(pattern, replacement);
    }

    out = out.replace(FILLER_PREFIX, '$1');
    out = out.replace(/\s+/g, ' ').trim();
    return out;
}
