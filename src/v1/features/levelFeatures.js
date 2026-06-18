/**
 * V1 Character System - Level-Derived Features
 * Defines per-level choices for each class/subclass that require user selection.
 *
 * Feature types:
 *   'single-select'    - Choose one option from a list
 *   'multi-select'     - Choose N options from a list (with optional scaleCount for level-ups)
 *   'cantrip-pick'     - Choose cantrips from a class list
 *   'proficiency-pick' - Choose N skills/tools from a list
 *   'spell-pick'       - Choose N spells from a filtered list
 *   'companion'        - Companion type picker with stat block
 *   'asi'              - Ability Score Improvement or Feat (handled by existing ASI picker)
 *
 * Each feature entry:
 *   { level, id, type, label, description?, options?, count?, scaleCount?,
 *     classSpellList?, grantedSpell?, filterByLevel?, skillList?, spellFilter? }
 */

import { ASI_LEVELS } from '../core/constants.js';

// ============================================================
// FIGHTING STYLE OPTIONS
// ============================================================

const FIGHTER_STYLES = [
    { id: 'archery', label: 'Archery', desc: '+2 to ranged weapon attack rolls' },
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'great-weapon', label: 'Great Weapon Fighting', desc: 'Reroll 1s/2s on damage dice with 2H/versatile' },
    { id: 'twf', label: 'Two-Weapon Fighting', desc: 'Add ability mod to off-hand attack damage' },
    { id: 'protection', label: 'Protection', desc: 'Impose disadvantage on attack vs adjacent ally (reaction, requires shield)' },
    { id: 'thrown-weapon', label: 'Thrown Weapon Fighting', desc: '+2 damage with thrown weapons' },
    { id: 'blind-fighting', label: 'Blind Fighting', desc: '10ft blindsight' },
    { id: 'interception', label: 'Interception', desc: 'Reduce damage to adjacent ally by 1d10+PB (reaction, requires shield/weapon)' },
    { id: 'superior-technique', label: 'Superior Technique', desc: 'Learn 1 Battle Master maneuver (1 d6 superiority die)' },
];

const RANGER_STYLES = [
    { id: 'archery', label: 'Archery', desc: '+2 to ranged weapon attack rolls' },
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'twf', label: 'Two-Weapon Fighting', desc: 'Add ability mod to off-hand attack damage' },
    { id: 'druidic-warrior', label: 'Druidic Warrior', desc: 'Learn 2 Druid cantrips (WIS-based)', hasCantrips: true, cantripClass: 'druid', cantripCount: 2 },
];

const PALADIN_STYLES = [
    { id: 'defense', label: 'Defense', desc: '+1 AC when wearing armor' },
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'great-weapon', label: 'Great Weapon Fighting', desc: 'Reroll 1s/2s on damage dice with 2H/versatile' },
    { id: 'blessed-warrior', label: 'Blessed Warrior', desc: 'Learn 2 Cleric cantrips (CHA-based)', hasCantrips: true, cantripClass: 'cleric', cantripCount: 2 },
];

const BARD_SWORDS_STYLES = [
    { id: 'dueling', label: 'Dueling', desc: '+2 melee damage with one-handed, no other weapon' },
    { id: 'twf', label: 'Two-Weapon Fighting', desc: 'Add ability mod to off-hand attack damage' },
];

// ============================================================
// DIVINE SOUL / DRACONIC OPTIONS
// ============================================================

const DIVINE_AFFINITIES = [
    { id: 'good', label: 'Good', grantSpell: 'Cure Wounds' },
    { id: 'evil', label: 'Evil', grantSpell: 'Inflict Wounds' },
    { id: 'law', label: 'Law', grantSpell: 'Bless' },
    { id: 'chaos', label: 'Chaos', grantSpell: 'Bane' },
    { id: 'neutrality', label: 'Neutrality', grantSpell: 'Protection from Evil and Good' },
];

const DRACONIC_ELEMENTS = [
    { id: 'acid', label: 'Acid (Black/Copper)' },
    { id: 'cold', label: 'Cold (Silver/White)' },
    { id: 'fire', label: 'Fire (Brass/Gold/Red)' },
    { id: 'lightning', label: 'Lightning (Blue/Bronze)' },
    { id: 'poison', label: 'Poison (Green)' },
];

// ============================================================
// BATTLE MASTER MANEUVERS
// ============================================================

export const BATTLE_MASTER_MANEUVERS = [
    { id: 'ambush', label: 'Ambush', desc: 'Add superiority die to Stealth or Initiative' },
    { id: 'bait-and-switch', label: 'Bait and Switch', desc: 'Swap places with ally within 5ft, one gains +die AC' },
    { id: 'commanders-strike', label: 'Commander\'s Strike', desc: 'Ally uses reaction to attack, adding die to damage' },
    { id: 'commanding-presence', label: 'Commanding Presence', desc: 'Add die to Intimidation/Performance/Persuasion check' },
    { id: 'disarming-attack', label: 'Disarming Attack', desc: '+die damage, target drops item on failed STR save' },
    { id: 'distracting-strike', label: 'Distracting Strike', desc: '+die damage, next attack vs target has advantage' },
    { id: 'evasive-footwork', label: 'Evasive Footwork', desc: 'Add die to AC while moving' },
    { id: 'feinting-attack', label: 'Feinting Attack', desc: 'Bonus action feint, advantage + die on next attack' },
    { id: 'goading-attack', label: 'Goading Attack', desc: '+die damage, target has disadvantage attacking others' },
    { id: 'grappling-strike', label: 'Grappling Strike', desc: 'After hit, add die to grapple check' },
    { id: 'lunging-attack', label: 'Lunging Attack', desc: '+5ft reach, +die damage' },
    { id: 'maneuvering-attack', label: 'Maneuvering Attack', desc: '+die damage, ally moves half speed no OA' },
    { id: 'menacing-attack', label: 'Menacing Attack', desc: '+die damage, target frightened on failed WIS save' },
    { id: 'parry', label: 'Parry', desc: 'Reduce melee damage by die + DEX mod (reaction)' },
    { id: 'precision-attack', label: 'Precision Attack', desc: 'Add die to attack roll' },
    { id: 'pushing-attack', label: 'Pushing Attack', desc: '+die damage, push Large or smaller 15ft on failed STR save' },
    { id: 'rally', label: 'Rally', desc: 'Ally gains die + CHA mod temp HP' },
    { id: 'riposte', label: 'Riposte', desc: 'When enemy misses, reaction attack + die damage' },
    { id: 'sweeping-attack', label: 'Sweeping Attack', desc: 'Die damage to second creature adjacent' },
    { id: 'tactical-assessment', label: 'Tactical Assessment', desc: 'Add die to History/Insight/Investigation check' },
    { id: 'trip-attack', label: 'Trip Attack', desc: '+die damage, target prone on failed STR save' },
];

// ============================================================
// ARCANE ARCHER SHOTS
// ============================================================

export const ARCANE_SHOT_OPTIONS = [
    { id: 'banishing', label: 'Banishing Arrow', desc: 'Target makes CHA save or is banished until end of next turn (2d6 force)' },
    { id: 'beguiling', label: 'Beguiling Arrow', desc: '2d6 psychic, target charmed by chosen ally (WIS save)' },
    { id: 'bursting', label: 'Bursting Arrow', desc: '2d6 force to target + creatures within 10ft' },
    { id: 'enfeebling', label: 'Enfeebling Arrow', desc: '2d6 necrotic, target weapon damage halved (CON save)' },
    { id: 'grasping', label: 'Grasping Arrow', desc: '2d6 poison, target takes 2d6 slashing when moving (athletics check)' },
    { id: 'piercing', label: 'Piercing Arrow', desc: '30ft line, 1d6 piercing to each creature (DEX save half)' },
    { id: 'seeking', label: 'Seeking Arrow', desc: 'Ignore cover/disadvantage, 1d6 force (DEX save half)' },
    { id: 'shadow', label: 'Shadow Arrow', desc: '2d6 psychic, target can\'t see beyond 5ft (WIS save)' },
];

// ============================================================
// SORCERER METAMAGIC OPTIONS
// ============================================================

export const METAMAGIC_OPTIONS = [
    { id: 'careful', label: 'Careful Spell', desc: 'CHA mod creatures auto-succeed on spell save (1 SP)' },
    { id: 'distant', label: 'Distant Spell', desc: 'Double spell range or touch→30ft (1 SP)' },
    { id: 'empowered', label: 'Empowered Spell', desc: 'Reroll up to CHA mod damage dice (1 SP)' },
    { id: 'extended', label: 'Extended Spell', desc: 'Double duration up to 24hr (1 SP)' },
    { id: 'heightened', label: 'Heightened Spell', desc: 'One target has disadvantage on first save (2 SP)' },
    { id: 'quickened', label: 'Quickened Spell', desc: 'Change casting time to bonus action (2 SP)' },
    { id: 'seeking', label: 'Seeking Spell', desc: 'Reroll missed spell attack (1 SP)' },
    { id: 'subtle', label: 'Subtle Spell', desc: 'No verbal/somatic components (1 SP)' },
    { id: 'transmuted', label: 'Transmuted Spell', desc: 'Change damage type: acid/cold/fire/lightning/poison/thunder (1 SP)' },
    { id: 'twinned', label: 'Twinned Spell', desc: 'Target second creature with single-target spell (SP = spell level, min 1)' },
];

// ============================================================
// WARLOCK ELDRITCH INVOCATIONS
// ============================================================

export const ELDRITCH_INVOCATIONS = [
    { id: 'agonizing-blast', label: 'Agonizing Blast', desc: 'Add CHA to Eldritch Blast damage', prereq: { cantrip: 'Eldritch Blast' } },
    { id: 'armor-of-shadows', label: 'Armor of Shadows', desc: 'Cast Mage Armor at will on self' },
    { id: 'ascendant-step', label: 'Ascendant Step', desc: 'Cast Levitate at will on self', prereq: { level: 9 } },
    { id: 'beast-speech', label: 'Beast Speech', desc: 'Cast Speak with Animals at will' },
    { id: 'beguiling-influence', label: 'Beguiling Influence', desc: 'Proficiency in Deception and Persuasion' },
    { id: 'bond-of-the-talisman', label: 'Bond of the Talisman', desc: 'Teleport to talisman bearer (PB uses/LR)', prereq: { level: 12, pact: 'talisman' } },
    { id: 'book-of-ancient-secrets', label: 'Book of Ancient Secrets', desc: 'Ritual casting from your Book of Shadows', prereq: { pact: 'tome' } },
    { id: 'chains-of-carceri', label: 'Chains of Carceri', desc: 'Cast Hold Monster at will on celestials/fiends/elementals', prereq: { level: 15, pact: 'chain' } },
    { id: 'cloak-of-flies', label: 'Cloak of Flies', desc: 'Poison damage aura + CHA to Intimidation', prereq: { level: 5 } },
    { id: 'devils-sight', label: 'Devil\'s Sight', desc: 'See normally in magical and nonmagical darkness to 120ft' },
    { id: 'dreadful-word', label: 'Dreadful Word', desc: 'Cast Confusion with a Pact slot (1/LR)', prereq: { level: 7 } },
    { id: 'eldritch-mind', label: 'Eldritch Mind', desc: 'Advantage on Constitution saves for concentration' },
    { id: 'eldritch-sight', label: 'Eldritch Sight', desc: 'Cast Detect Magic at will' },
    { id: 'eldritch-smite', label: 'Eldritch Smite', desc: 'On hit with pact weapon, expend slot for +force damage + prone', prereq: { level: 5, pact: 'blade' } },
    { id: 'eldritch-spear', label: 'Eldritch Spear', desc: 'Eldritch Blast range becomes 300ft', prereq: { cantrip: 'Eldritch Blast' } },
    { id: 'eyes-of-the-rune-keeper', label: 'Eyes of the Rune Keeper', desc: 'Read all writing' },
    { id: 'fiendish-vigor', label: 'Fiendish Vigor', desc: 'Cast False Life at will as 1st-level' },
    { id: 'gaze-of-two-minds', label: 'Gaze of Two Minds', desc: 'Perceive through willing humanoid\'s senses' },
    { id: 'ghostly-gaze', label: 'Ghostly Gaze', desc: 'See through solid objects 30ft (1/SR)', prereq: { level: 7 } },
    { id: 'gift-of-the-depths', label: 'Gift of the Depths', desc: 'Breathe underwater + swim speed', prereq: { level: 5 } },
    { id: 'gift-of-the-ever-living-ones', label: 'Gift of the Ever-Living Ones', desc: 'Max healing dice when familiar within 100ft', prereq: { pact: 'chain' } },
    { id: 'gift-of-the-protectors', label: 'Gift of the Protectors', desc: 'Names in book drop to 1HP instead of 0 (1/LR each)', prereq: { level: 9, pact: 'tome' } },
    { id: 'grasp-of-hadar', label: 'Grasp of Hadar', desc: 'Eldritch Blast pulls 10ft toward you', prereq: { cantrip: 'Eldritch Blast' } },
    { id: 'improved-pact-weapon', label: 'Improved Pact Weapon', desc: 'Pact weapon +1, can be ranged, use as focus', prereq: { pact: 'blade' } },
    { id: 'investment-of-the-chain-master', label: 'Investment of the Chain Master', desc: 'Familiar attacks use your spell DC + bonus action command', prereq: { pact: 'chain' } },
    { id: 'lance-of-lethargy', label: 'Lance of Lethargy', desc: 'Eldritch Blast reduces speed by 10ft', prereq: { cantrip: 'Eldritch Blast' } },
    { id: 'lifedrinker', label: 'Lifedrinker', desc: 'Pact weapon +CHA necrotic on hit', prereq: { level: 12, pact: 'blade' } },
    { id: 'mask-of-many-faces', label: 'Mask of Many Faces', desc: 'Cast Disguise Self at will' },
    { id: 'master-of-myriad-forms', label: 'Master of Myriad Forms', desc: 'Cast Alter Self at will', prereq: { level: 15 } },
    { id: 'minions-of-chaos', label: 'Minions of Chaos', desc: 'Cast Conjure Elemental with a Pact slot (1/LR)', prereq: { level: 9 } },
    { id: 'mire-the-mind', label: 'Mire the Mind', desc: 'Cast Slow with a Pact slot (1/LR)', prereq: { level: 5 } },
    { id: 'misty-visions', label: 'Misty Visions', desc: 'Cast Silent Image at will' },
    { id: 'one-with-shadows', label: 'One with Shadows', desc: 'Become invisible in dim/darkness (action, until move/action)', prereq: { level: 5 } },
    { id: 'otherworldly-leap', label: 'Otherworldly Leap', desc: 'Cast Jump at will on self', prereq: { level: 9 } },
    { id: 'protection-of-the-talisman', label: 'Protection of the Talisman', desc: 'Add d4 to failed save (PB uses/LR)', prereq: { level: 7, pact: 'talisman' } },
    { id: 'rebuke-of-the-talisman', label: 'Rebuke of the Talisman', desc: 'When talisman holder hit, deal PB psychic + push 10ft', prereq: { pact: 'talisman' } },
    { id: 'relentless-hex', label: 'Relentless Hex', desc: 'Teleport 30ft to cursed target (bonus action)', prereq: { level: 7 } },
    { id: 'repelling-blast', label: 'Repelling Blast', desc: 'Eldritch Blast pushes 10ft', prereq: { cantrip: 'Eldritch Blast' } },
    { id: 'sculptor-of-flesh', label: 'Sculptor of Flesh', desc: 'Cast Polymorph with a Pact slot (1/LR)', prereq: { level: 7 } },
    { id: 'sign-of-ill-omen', label: 'Sign of Ill Omen', desc: 'Cast Bestow Curse with a Pact slot (1/LR)', prereq: { level: 5 } },
    { id: 'thirsting-blade', label: 'Thirsting Blade', desc: 'Attack twice with pact weapon', prereq: { level: 5, pact: 'blade' } },
    { id: 'tomb-of-levistus', label: 'Tomb of Levistus', desc: 'When taking damage, gain 10*level temp HP in ice (reaction, 1/SR)', prereq: { level: 5 } },
    { id: 'undying-servitude', label: 'Undying Servitude', desc: 'Cast Animate Dead with a Pact slot (1/LR)', prereq: { level: 5 } },
    { id: 'visions-of-distant-realms', label: 'Visions of Distant Realms', desc: 'Cast Arcane Eye at will', prereq: { level: 15 } },
    { id: 'voice-of-the-chain-master', label: 'Voice of the Chain Master', desc: 'Perceive through/speak through familiar', prereq: { pact: 'chain' } },
    { id: 'whispers-of-the-grave', label: 'Whispers of the Grave', desc: 'Cast Speak with Dead at will', prereq: { level: 9 } },
    { id: 'witch-sight', label: 'Witch Sight', desc: 'See true form of shapechangers/illusions within 30ft', prereq: { level: 15 } },
];

// ============================================================
// WARLOCK PACT BOON OPTIONS
// ============================================================

export const PACT_BOON_OPTIONS = [
    { id: 'blade', label: 'Pact of the Blade', desc: 'Create a magic melee weapon or bond a magic weapon; use CHA for attacks' },
    { id: 'chain', label: 'Pact of the Chain', desc: 'Find Familiar with improved forms (imp, pseudodragon, quasit, sprite)' },
    { id: 'tome', label: 'Pact of the Tome', desc: 'Book of Shadows with 3 cantrips from any class list' },
    { id: 'talisman', label: 'Pact of the Talisman', desc: 'Talisman adds 1d4 to failed ability checks (PB uses/LR)' },
];

// ============================================================
// COMPANION DATA (Beast Master)
// ============================================================

export const PRIMAL_COMPANIONS = {
    land: {
        id: 'land', label: 'Beast of the Land',
        size: 'Medium', type: 'Beast',
        speed: '40 ft, climb 40 ft',
        baseHP: 5, hpPerLevel: 5,
        baseAC: 13,
        str: 14, dex: 14, con: 15, int: 8, wis: 14, cha: 11,
        attack: { name: 'Maul', reach: '5 ft', damageDice: '1d8', damageType: 'slashing', useStat: 'str' },
        special: 'Charge: If moves 20+ ft straight toward target, DC 8+PB+STR or prone',
    },
    sea: {
        id: 'sea', label: 'Beast of the Sea',
        size: 'Medium', type: 'Beast',
        speed: '5 ft, swim 60 ft',
        baseHP: 5, hpPerLevel: 5,
        baseAC: 13,
        str: 14, dex: 14, con: 15, int: 8, wis: 14, cha: 11,
        attack: { name: 'Binding Strike', reach: '5 ft', damageDice: '1d6', damageType: 'bludgeoning', useStat: 'str' },
        special: 'Binding Strike: Target grappled (escape DC 8+PB+STR)',
    },
    sky: {
        id: 'sky', label: 'Beast of the Sky',
        size: 'Small', type: 'Beast',
        speed: '10 ft, fly 60 ft',
        baseHP: 4, hpPerLevel: 4,
        baseAC: 13,
        str: 6, dex: 16, con: 13, int: 8, wis: 14, cha: 11,
        attack: { name: 'Shred', reach: '5 ft', damageDice: '1d4', damageType: 'slashing', useStat: 'dex' },
        special: 'Flyby: No opportunity attacks when flying out of reach',
    },
};

// ============================================================
// HUNTER RANGER OPTIONS
// ============================================================

const HUNTER_PREY_OPTIONS = [
    { id: 'colossus-slayer', label: 'Colossus Slayer', desc: '+1d8 damage once/turn if target is below max HP' },
    { id: 'giant-killer', label: 'Giant Killer', desc: 'Reaction attack when Large+ creature within 5ft attacks you' },
    { id: 'horde-breaker', label: 'Horde Breaker', desc: 'One additional attack per turn against a different adjacent creature' },
];

const HUNTER_DEFENSIVE_OPTIONS = [
    { id: 'escape-horde', label: 'Escape the Horde', desc: 'Opportunity attacks against you are made with disadvantage' },
    { id: 'multiattack-defense', label: 'Multiattack Defense', desc: '+4 AC against subsequent attacks from same creature this turn' },
    { id: 'steel-will', label: 'Steel Will', desc: 'Advantage on saves against being frightened' },
];

// ============================================================
// STORM HERALD AURA OPTIONS
// ============================================================

const STORM_AURA_OPTIONS = [
    { id: 'desert', label: 'Desert', desc: 'Fire damage to adjacent enemies; fire resistance at L6; reaction fire damage at L14' },
    { id: 'sea', label: 'Sea', desc: 'Lightning damage to one enemy; lightning resistance at L6; knockback at L14' },
    { id: 'tundra', label: 'Tundra', desc: 'Temp HP to allies; cold resistance at L6; freeze enemies at L14' },
];

export const CLASS_LEVEL_FEATURES = {
    fighter: [
        { level: 1, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: FIGHTER_STYLES },
    ],
    ranger: [
        { level: 2, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: RANGER_STYLES },
    ],
    paladin: [
        { level: 2, id: 'fighting-style', type: 'single-select', label: 'Fighting Style', options: PALADIN_STYLES },
    ],
    sorcerer: [
        {
            level: 3, id: 'metamagic', type: 'multi-select',
            label: 'Metamagic Options',
            description: 'Choose Metamagic options to modify your spells using sorcery points.',
            count: 2,
            scaleCount: { 10: 3, 17: 4 },
            options: METAMAGIC_OPTIONS,
        },
    ],
    warlock: [
        {
            level: 2, id: 'invocations', type: 'multi-select',
            label: 'Eldritch Invocations',
            description: 'Choose invocations that grant special abilities or enhance your spells.',
            count: 2,
            scaleCount: { 5: 3, 7: 4, 9: 5, 12: 6, 15: 7, 18: 8 },
            options: ELDRITCH_INVOCATIONS,
            filterByLevel: true,
        },
        {
            level: 3, id: 'pact-boon', type: 'single-select',
            label: 'Pact Boon',
            description: 'Choose the supernatural gift your patron bestows upon you.',
            options: PACT_BOON_OPTIONS,
        },
    ],
};

export const SUBCLASS_LEVEL_FEATURES = {
    // ----------------------------------------------------------
    // BARBARIAN
    // ----------------------------------------------------------

    'barbarian|Path of the Wild Heart': [
        { level: 3, id: 'animal-aspect-3', type: 'single-select', label: 'Rage Aspect (Level 3)',
          description: 'Choose an animal aspect that manifests while you rage.',
          options: [
              { id: 'bear', label: 'Bear', desc: 'Resistance to all damage except psychic while raging' },
              { id: 'eagle', label: 'Eagle', desc: 'Dash as bonus action, opportunity attacks against you have disadvantage' },
              { id: 'wolf', label: 'Wolf', desc: 'Allies have advantage on melee attacks against enemies within 5ft of you' },
          ] },
        { level: 6, id: 'aspect-of-wilds', type: 'single-select', label: 'Aspect of the Wilds',
          options: [
              { id: 'owl', label: 'Owl', desc: 'Darkvision 60ft and advantage on Perception checks' },
              { id: 'panther', label: 'Panther', desc: 'Climbing speed equal to walking speed' },
              { id: 'salmon', label: 'Salmon', desc: 'Swimming speed equal to walking speed' },
          ] },
        { level: 14, id: 'animal-aspect-14', type: 'single-select', label: 'Rage Aspect (Level 14)',
          options: [
              { id: 'bear', label: 'Bear', desc: 'While raging, creatures within 5ft have disadvantage attacking others' },
              { id: 'eagle', label: 'Eagle', desc: 'Fly speed equal to walking speed while raging (fall at end if airborne)' },
              { id: 'wolf', label: 'Wolf', desc: 'While raging, bonus action to knock Large or smaller prone on hit' },
          ] },
    ],

    'barbarian|Path of the Zealot': [
        { level: 3, id: 'divine-fury-type', type: 'single-select', label: 'Divine Fury Damage Type',
          description: 'Choose the damage type for your Divine Fury.',
          options: [
              { id: 'radiant', label: 'Radiant' },
              { id: 'necrotic', label: 'Necrotic' },
          ] },
    ],

    'barbarian|Path of the Storm Herald': [
        { level: 3, id: 'storm-aura', type: 'single-select', label: 'Storm Aura',
          description: 'Choose a storm environment that manifests as a 10ft aura while raging.',
          options: STORM_AURA_OPTIONS },
    ],

    // ----------------------------------------------------------
    // BARD
    // ----------------------------------------------------------

    'bard|College of Lore': [
        { level: 3, id: 'bonus-skills', type: 'proficiency-pick', label: 'Bonus Proficiencies',
          description: 'Choose 3 additional skill proficiencies.',
          count: 3, skillList: 'all' },
        { level: 6, id: 'magical-discoveries', type: 'spell-pick', label: 'Magical Discoveries',
          description: 'Choose 2 spells from the Cleric, Druid, or Wizard spell list (up to spell level you can cast).',
          count: 2, spellFilter: { classes: ['cleric', 'druid', 'wizard'] } },
    ],

    'bard|College of Swords': [
        { level: 3, id: 'fighting-style', type: 'single-select', label: 'Fighting Style',
          options: BARD_SWORDS_STYLES },
    ],

    // ----------------------------------------------------------
    // CLERIC
    // ----------------------------------------------------------

    // (Life and Light have no build-time choices beyond spells)

    // ----------------------------------------------------------
    // DRUID
    // ----------------------------------------------------------

    'druid|Circle of the Land': [
        { level: 3, id: 'land-type', type: 'single-select', label: 'Land Type',
          description: 'Choose the environment that shaped your druidic magic. This determines your bonus spells and later features.',
          options: [
              { id: 'arid', label: 'Arid', desc: 'Desert, badlands — fire spells' },
              { id: 'polar', label: 'Polar', desc: 'Tundra, glacial — cold spells' },
              { id: 'temperate', label: 'Temperate', desc: 'Forest, grassland — lightning/nature spells' },
              { id: 'tropical', label: 'Tropical', desc: 'Jungle, swamp — poison/acid spells' },
          ] },
    ],

    'druid|Circle of the Stars': [
        { level: 2, id: 'starry-form', type: 'single-select', label: 'Default Starry Form',
          description: 'Choose your default constellation form (you can change each use, but this is recorded as preferred).',
          options: [
              { id: 'archer', label: 'Archer', desc: 'Bonus action ranged attack: 1d8+WIS radiant (60ft)' },
              { id: 'chalice', label: 'Chalice', desc: 'When you heal, you or adjacent ally regains 1d8+WIS' },
              { id: 'dragon', label: 'Dragon', desc: 'Treat concentration/INT/WIS checks below 10 as 10' },
          ] },
    ],

    // ----------------------------------------------------------
    // FIGHTER
    // ----------------------------------------------------------

    'fighter|Battle Master': [
        { level: 3, id: 'maneuvers', type: 'multi-select', label: 'Battle Master Maneuvers',
          description: 'Choose maneuvers that enhance your attacks and tactical options.',
          count: 3,
          scaleCount: { 7: 5, 10: 7, 15: 9 },
          options: BATTLE_MASTER_MANEUVERS },
        { level: 3, id: 'tool-proficiency', type: 'proficiency-pick', label: 'Student of War',
          description: 'Gain proficiency with one artisan\'s tool of your choice.',
          count: 1, skillList: 'tools' },
    ],

    'fighter|Champion': [
        { level: 7, id: 'additional-style', type: 'single-select', label: 'Additional Fighting Style',
          description: 'Choose a second Fighting Style.',
          options: FIGHTER_STYLES },
    ],

    'fighter|Arcane Archer': [
        { level: 3, id: 'arcane-shots', type: 'multi-select', label: 'Arcane Shot Options',
          description: 'Choose Arcane Shot options to enhance your arrows with magic.',
          count: 2,
          scaleCount: { 7: 3, 10: 4, 15: 5, 18: 6 },
          options: ARCANE_SHOT_OPTIONS },
        { level: 3, id: 'skill-pick', type: 'proficiency-pick', label: 'Arcane Archer Lore',
          description: 'Choose proficiency in Arcana or Nature.',
          count: 1, skillList: ['arcana', 'nature'] },
    ],

    'fighter|Cavalier': [
        { level: 3, id: 'bonus-skill', type: 'proficiency-pick', label: 'Bonus Proficiency',
          description: 'Choose proficiency in Animal Handling, History, Insight, Performance, or Persuasion.',
          count: 1, skillList: ['animal-handling', 'history', 'insight', 'performance', 'persuasion'] },
    ],

    'fighter|Samurai': [
        { level: 3, id: 'bonus-prof', type: 'proficiency-pick', label: 'Elegant Courtier',
          description: 'Choose one skill proficiency or one language.',
          count: 1, skillList: ['history', 'insight', 'performance', 'persuasion'] },
    ],

    // ----------------------------------------------------------
    // MONK
    // ----------------------------------------------------------

    'monk|Way of the Kensei': [
        { level: 3, id: 'kensei-weapons', type: 'multi-select', label: 'Kensei Weapons',
          description: 'Choose weapons to be your kensei weapons (not heavy or special).',
          count: 2,
          scaleCount: { 6: 3, 11: 4, 17: 5 },
          options: [
              { id: 'longsword', label: 'Longsword' },
              { id: 'scimitar', label: 'Scimitar' },
              { id: 'shortsword', label: 'Shortsword' },
              { id: 'rapier', label: 'Rapier' },
              { id: 'whip', label: 'Whip' },
              { id: 'war-pick', label: 'War Pick' },
              { id: 'battleaxe', label: 'Battleaxe' },
              { id: 'handaxe', label: 'Handaxe' },
              { id: 'longbow', label: 'Longbow' },
              { id: 'shortbow', label: 'Shortbow' },
          ] },
    ],

    'monk|Way of the Elements': [
        { level: 17, id: 'element-resistance', type: 'single-select', label: 'Elemental Mastery Resistance',
          options: [
              { id: 'acid', label: 'Acid' },
              { id: 'cold', label: 'Cold' },
              { id: 'fire', label: 'Fire' },
              { id: 'lightning', label: 'Lightning' },
              { id: 'thunder', label: 'Thunder' },
          ] },
    ],

    // ----------------------------------------------------------
    // RANGER
    // ----------------------------------------------------------

    'ranger|Hunter': [
        { level: 3, id: 'hunters-prey', type: 'single-select', label: 'Hunter\'s Prey',
          description: 'Choose your specialization against your favored quarry.',
          options: HUNTER_PREY_OPTIONS },
        { level: 7, id: 'defensive-tactics', type: 'single-select', label: 'Defensive Tactics',
          options: HUNTER_DEFENSIVE_OPTIONS },
    ],

    'ranger|Beast Master': [
        { level: 3, id: 'primal-companion', type: 'companion', label: 'Primal Companion',
          description: 'Choose the form of your primal beast companion.',
          options: [
              { id: 'land', label: 'Beast of the Land', desc: 'Speed 40ft/climb 40ft, 1d8+PB slashing, Charge (prone)' },
              { id: 'sea', label: 'Beast of the Sea', desc: 'Swim 60ft, 1d6+PB bludgeoning, Binding Strike (grapple)' },
              { id: 'sky', label: 'Beast of the Sky', desc: 'Fly 60ft, 1d4+PB slashing, Flyby (no OA)' },
          ] },
    ],

    'ranger|Fey Wanderer': [
        { level: 3, id: 'fey-skill', type: 'proficiency-pick', label: 'Otherworldly Glamour',
          description: 'Choose one skill: Deception, Performance, or Persuasion (add WIS to checks).',
          count: 1, skillList: ['deception', 'performance', 'persuasion'] },
    ],

    'ranger|Gloom Stalker': [
        { level: 11, id: 'stalkers-flurry', type: 'single-select', label: 'Stalker\'s Flurry',
          options: [
              { id: 'sudden-strike', label: 'Sudden Strike', desc: 'When you miss, make another weapon attack' },
              { id: 'mass-fear', label: 'Shadowy Dodge', desc: 'Impose disadvantage on attack against you (reaction, no resource)' },
          ] },
    ],

    // ----------------------------------------------------------
    // ROGUE
    // ----------------------------------------------------------

    'rogue|Mastermind': [
        { level: 3, id: 'languages', type: 'proficiency-pick', label: 'Master of Intrigue',
          description: 'Choose two languages.',
          count: 2, skillList: 'languages' },
    ],

    // ----------------------------------------------------------
    // SORCERER
    // ----------------------------------------------------------

    'sorcerer|Divine Soul': [
        { level: 1, id: 'divine-affinity', type: 'single-select', label: 'Divine Magic Affinity',
          description: 'Choose an affinity for the source of your divine power. This grants an additional spell always prepared.',
          options: DIVINE_AFFINITIES },
    ],

    'sorcerer|Draconic Bloodline': [
        { level: 1, id: 'draconic-element', type: 'single-select', label: 'Draconic Ancestry Element',
          description: 'Choose the damage type associated with your draconic ancestry.',
          options: DRACONIC_ELEMENTS },
    ],

    // ----------------------------------------------------------
    // WARLOCK
    // ----------------------------------------------------------

    'warlock|Fiend Patron': [
        { level: 10, id: 'fiendish-resilience', type: 'single-select', label: 'Fiendish Resilience',
          description: 'Choose a damage type to resist (can change each short/long rest).',
          options: [
              { id: 'acid', label: 'Acid' }, { id: 'cold', label: 'Cold' },
              { id: 'fire', label: 'Fire' }, { id: 'lightning', label: 'Lightning' },
              { id: 'necrotic', label: 'Necrotic' }, { id: 'poison', label: 'Poison' },
              { id: 'psychic', label: 'Psychic' }, { id: 'radiant', label: 'Radiant' },
              { id: 'thunder', label: 'Thunder' },
          ] },
    ],

    'warlock|Great Old One Patron': [
        { level: 10, id: 'hex-ability', type: 'single-select', label: 'Thought Shield Hex Ability',
          description: 'Choose the ability score for Hex disadvantage from Eldritch Hex.',
          options: [
              { id: 'str', label: 'Strength' }, { id: 'dex', label: 'Dexterity' },
              { id: 'con', label: 'Constitution' }, { id: 'int', label: 'Intelligence' },
              { id: 'wis', label: 'Wisdom' }, { id: 'cha', label: 'Charisma' },
          ] },
    ],

    // ----------------------------------------------------------
    // WIZARD
    // ----------------------------------------------------------

    'wizard|School of Divination': [
        { level: 10, id: 'third-eye', type: 'single-select', label: 'The Third Eye',
          description: 'Choose one enhanced sense (can change each short rest).',
          options: [
              { id: 'darkvision', label: 'Darkvision', desc: 'Gain 60ft darkvision' },
              { id: 'ethereal-sight', label: 'Ethereal Sight', desc: 'See into the Ethereal Plane within 60ft' },
              { id: 'see-invisibility', label: 'See Invisibility', desc: 'See invisible creatures/objects within 10ft' },
              { id: 'read-languages', label: 'Read Languages', desc: 'Read any language' },
          ] },
    ],
};

/**
 * Get all level-derived features for a given class/subclass up to the current level,
 * merged with ASI/Feat entries at standard ASI levels.
 */
export function getLevelFeatures(classKey, subclassName, level) {
    const features = [];

    // Class-level features
    const classFeats = CLASS_LEVEL_FEATURES[classKey] || [];
    for (const feat of classFeats) {
        if (feat.level <= level) features.push({ ...feat, source: 'class' });
    }

    // Subclass-level features
    if (subclassName) {
        const subKey = `${classKey}|${subclassName}`;
        const subFeats = SUBCLASS_LEVEL_FEATURES[subKey] || [];
        for (const feat of subFeats) {
            if (feat.level <= level) features.push({ ...feat, source: 'subclass' });
        }
    }

    // ASI/Feat at standard ASI levels
    for (const lv of ASI_LEVELS) {
        if (lv <= level) {
            features.push({ level: lv, id: 'asi', type: 'asi', label: 'Ability Score Improvement / Feat', source: 'class' });
        }
    }

    features.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
    return features;
}

/**
 * Map a fighting style selection to the feature name used by classEffects.js.
 */
export function fightingStyleToFeatureName(styleId) {
    const map = {
        'archery': 'Fighting Style: Archery',
        'defense': 'Fighting Style: Defense',
        'dueling': 'Fighting Style: Dueling',
        'great-weapon': 'Fighting Style: Great Weapon Fighting',
        'twf': 'Fighting Style: Two-Weapon Fighting',
        'druidic-warrior': 'Druidic Warrior',
        'blessed-warrior': 'Blessed Warrior',
    };
    return map[styleId] || null;
}

/**
 * Get the fighting style option definition by its id.
 */
export function getFightingStyleOption(classKey, styleId) {
    const classFeatDef = (CLASS_LEVEL_FEATURES[classKey] || []).find(f => f.id === 'fighting-style');
    if (!classFeatDef) return null;
    return classFeatDef.options.find(o => o.id === styleId) || null;
}

/**
 * Get the total multi-select count at a given level.
 * @param {object} feature - Feature definition with count and optional scaleCount
 * @param {number} level - Current class level
 * @returns {number} Total selections allowed at this level
 */
export function getMultiSelectCount(feature, level) {
    let total = feature.count || 0;
    if (feature.scaleCount) {
        for (const [lv, count] of Object.entries(feature.scaleCount)) {
            if (level >= Number(lv)) total = count;
        }
    }
    return total;
}

/**
 * Filter invocations by prerequisites.
 * @param {object[]} options - Array of invocation options
 * @param {number} level - Current warlock level
 * @param {string|null} pactBoon - Current pact boon id
 * @param {string[]} cantripsKnown - Known cantrip names
 * @returns {object[]} Options with an `eligible` boolean added
 */
export function filterByPrereqs(options, level, pactBoon, cantripsKnown = []) {
    return options.map(opt => {
        let eligible = true;
        if (opt.prereq) {
            if (opt.prereq.level && level < opt.prereq.level) eligible = false;
            if (opt.prereq.pact && opt.prereq.pact !== pactBoon) eligible = false;
            if (opt.prereq.cantrip && !cantripsKnown.includes(opt.prereq.cantrip)) eligible = false;
        }
        return { ...opt, eligible };
    });
}

/**
 * Compute companion stat block from base data.
 * @param {string} companionType - 'land', 'sea', or 'sky'
 * @param {number} rangerLevel - Current ranger level
 * @param {number} profBonus - Character's proficiency bonus
 * @param {number} wisMod - Ranger's WIS modifier
 * @returns {object|null} Computed stat block or null if invalid type
 */
export function computeCompanionStats(companionType, rangerLevel, profBonus, wisMod) {
    const base = PRIMAL_COMPANIONS[companionType];
    if (!base) return null;

    const strMod = Math.floor((base.str - 10) / 2);
    const dexMod = Math.floor((base.dex - 10) / 2);
    const attackMod = base.attack.useStat === 'dex' ? dexMod : strMod;

    return {
        name: base.label,
        size: base.size,
        type: base.type,
        speed: base.speed,
        hp: base.baseHP + (base.hpPerLevel * rangerLevel),
        ac: base.baseAC + profBonus,
        str: base.str, dex: base.dex, con: base.con,
        int: base.int, wis: base.wis, cha: base.cha,
        attackName: base.attack.name,
        attackBonus: attackMod + profBonus,
        attackReach: base.attack.reach,
        damage: `${base.attack.damageDice} + ${profBonus}`,
        damageType: base.attack.damageType,
        special: base.special,
        saveDC: 8 + profBonus + strMod,
        profBonus,
    };
}

/**
 * Collect all bonus spells/cantrips from level choices.
 * @param {object} levelChoices - { [level]: { [featureId]: { selected, selectedMulti?, cantrips?, ... } } }
 * @param {string} classKey
 * @param {string|null} subclassName
 * @param {number} level - Current class level
 * @returns {{ bonusCantrips: object[], bonusSpells: object[], draconicElement: string|null, chosenFeatures: string[], metamagic: string[], invocations: string[], pactBoon: string|null, companion: string|null, maneuvers: string[], arcaneShots: string[], proficiencyPicks: object[] }}
 */
export function collectLevelChoiceEffects(levelChoices, classKey, subclassName, level) {
    const result = {
        bonusCantrips: [],
        bonusSpells: [],
        draconicElement: null,
        chosenFeatures: [],
        metamagic: [],
        invocations: [],
        pactBoon: null,
        companion: null,
        maneuvers: [],
        arcaneShots: [],
        kenseiWeapons: [],
        proficiencyPicks: [],
    };

    if (!levelChoices) return result;

    for (const [_lv, choices] of Object.entries(levelChoices)) {
        for (const [featureId, data] of Object.entries(choices || {})) {
            if (!data) continue;

            // Single-select features
            if (data.selected) {
                if (featureId === 'fighting-style' || featureId === 'additional-style') {
                    const featureName = fightingStyleToFeatureName(data.selected);
                    if (featureName) result.chosenFeatures.push(featureName);

                    const styleDef = getFightingStyleOption(classKey, data.selected);
                    if (styleDef?.hasCantrips && data.cantrips?.length) {
                        for (const name of data.cantrips) {
                            result.bonusCantrips.push({ name, source: `${styleDef.label} (${styleDef.cantripClass})` });
                        }
                    }
                }

                if (featureId === 'divine-affinity') {
                    const affinityDef = DIVINE_AFFINITIES.find(a => a.id === data.selected);
                    if (affinityDef?.grantSpell) {
                        result.bonusSpells.push({ name: affinityDef.grantSpell, source: 'Divine Soul (Affinity)', alwaysPrepared: true });
                    }
                }

                if (featureId === 'draconic-element') result.draconicElement = data.selected;
                if (featureId === 'pact-boon') result.pactBoon = data.selected;
                if (featureId === 'primal-companion') result.companion = data.selected;
            }

            // Multi-select features
            if (data.selectedMulti && Array.isArray(data.selectedMulti)) {
                if (featureId === 'metamagic') result.metamagic = data.selectedMulti;
                if (featureId === 'invocations') result.invocations = data.selectedMulti;
                if (featureId === 'maneuvers') result.maneuvers = data.selectedMulti;
                if (featureId === 'arcane-shots') result.arcaneShots = data.selectedMulti;
                if (featureId === 'kensei-weapons') result.kenseiWeapons = data.selectedMulti;
            }

            // Proficiency picks
            if (data.picks && Array.isArray(data.picks)) {
                result.proficiencyPicks.push({ featureId, picks: data.picks });
            }
        }
    }

    return result;
}
