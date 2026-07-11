/**
 * D&D 5e Lite - Dice Modifier Definitions
 *
 * Edit this file to add, remove, or change buff/debuff dice modifiers.
 * Toggle buttons are generated automatically from this array at init.
 * Each entry defines the dice rolled and a prompt template ({user} is replaced at injection time).
 *
 * Required fields:
 *   id     - unique key used in data-mod attributes and settings storage
 *   label  - short display name shown on the toggle button and modifier chip
 *   icon   - Font Awesome icon class (fa-*) shown on the toggle button
 *   count  - number of dice to roll
 *   sides  - die size (e.g. 4 for d4)
 *   prompt - injected into the LLM prompt when this modifier is active
 */

export const MODIFIER_DEFS = [
    { id: 'guidance',   label: 'Guide',    icon: 'fa-hand-sparkles', count: 1, sides: 4,
        prompt: 'Guidance (cantrip): {user} adds 1d4 to one ability check.' },
    { id: 'bless',      label: 'Bless',   icon: 'fa-sun',           count: 1, sides: 4,
        prompt: 'Bless (1st level): {user} adds 1d4 to attack rolls and saving throws.' },
    { id: 'bardic',     label: 'Bardic',  icon: 'fa-music',         count: 1, sides: 6,
        prompt: 'Bardic Inspiration: {user} adds the die to one ability check, attack roll, or saving throw.' },
    { id: 'favored',    label: 'Favored', icon: 'fa-hands-praying', count: 2, sides: 4,
        prompt: 'Favored by the Gods (Divine Soul Sorcerer): If {user} failed a saving throw or missed an attack roll, add 2d4 to the total, possibly changing the outcome. Once per short/long rest.' },
    { id: 'sliver',     label: 'Sliver',  icon: 'fa-brain',         count: 1, sides: 4,
        prompt: 'Mind Sliver (cantrip debuff): The target subtracts 1d4 from its next saving throw before the end of {user}\'s next turn.' },
    { id: 'resistance', label: 'Resist',  icon: 'fa-shield-halved', count: 1, sides: 4,
        prompt: 'Resistance (cantrip): {user} adds 1d4 to one saving throw.' },
];
