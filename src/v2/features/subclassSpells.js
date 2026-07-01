/**
 * V1 Character System - Subclass Spell Registry
 * Defines always-prepared (or bonus-known) spells granted by each subclass.
 *
 * Key format: 'classKey|Subclass Name'
 * Value: array of { minLevel, spells: string[] }
 *   minLevel = class level at which these spells become available
 *
 * Sources: XPHB (PHB'24) and XGE (Xanathar's Guide to Everything)
 */

// ============================================================
// SUBCLASS SPELL LISTS
// ============================================================

export const SUBCLASS_SPELL_LISTS = {

    // ----------------------------------------------------------
    // BARD
    // ----------------------------------------------------------

    'bard|College of Glamour': [
        { minLevel: 3, spells: ['Charm Person', 'Mirror Image'] },
        { minLevel: 5, spells: ['Hypnotic Pattern', 'Tongues'] },
        { minLevel: 7, spells: ['Compulsion', 'Polymorph'] },
        { minLevel: 9, spells: ['Hold Monster', 'Rary\'s Telepathic Bond'] },
    ],

    // ----------------------------------------------------------
    // CLERIC (XPHB)
    // ----------------------------------------------------------

    'cleric|Life Domain': [
        { minLevel: 3, spells: ['Bless', 'Cure Wounds'] },
        { minLevel: 3, spells: ['Aid', 'Lesser Restoration'] },
        { minLevel: 5, spells: ['Mass Healing Word', 'Revivify'] },
        { minLevel: 7, spells: ['Aura of Life', 'Death Ward'] },
        { minLevel: 9, spells: ['Greater Restoration', 'Mass Cure Wounds'] },
    ],

    'cleric|Light Domain': [
        { minLevel: 3, spells: ['Burning Hands', 'Faerie Fire'] },
        { minLevel: 3, spells: ['Flaming Sphere', 'Scorching Ray'] },
        { minLevel: 5, spells: ['Daylight', 'Fireball'] },
        { minLevel: 7, spells: ['Guardian of Faith', 'Wall of Fire'] },
        { minLevel: 9, spells: ['Flame Strike', 'Scrying'] },
    ],

    'cleric|Trickery Domain': [
        { minLevel: 3, spells: ['Charm Person', 'Disguise Self'] },
        { minLevel: 3, spells: ['Mirror Image', 'Pass without Trace'] },
        { minLevel: 5, spells: ['Hypnotic Pattern', 'Nondetection'] },
        { minLevel: 7, spells: ['Dimension Door', 'Polymorph'] },
        { minLevel: 9, spells: ['Dominate Person', 'Modify Memory'] },
    ],

    'cleric|War Domain': [
        { minLevel: 3, spells: ['Divine Favor', 'Shield of Faith'] },
        { minLevel: 3, spells: ['Magic Weapon', 'Spiritual Weapon'] },
        { minLevel: 5, spells: ['Crusader\'s Mantle', 'Spirit Guardians'] },
        { minLevel: 7, spells: ['Freedom of Movement', 'Stoneskin'] },
        { minLevel: 9, spells: ['Flame Strike', 'Hold Monster'] },
    ],

    // CLERIC (XGE)

    'cleric|Forge Domain': [
        { minLevel: 3, spells: ['Identify', 'Searing Smite'] },
        { minLevel: 3, spells: ['Heat Metal', 'Magic Weapon'] },
        { minLevel: 5, spells: ['Elemental Weapon', 'Protection from Energy'] },
        { minLevel: 7, spells: ['Fabricate', 'Wall of Fire'] },
        { minLevel: 9, spells: ['Animate Objects', 'Creation'] },
    ],

    'cleric|Grave Domain': [
        { minLevel: 3, spells: ['Bane', 'False Life'] },
        { minLevel: 3, spells: ['Gentle Repose', 'Ray of Enfeeblement'] },
        { minLevel: 5, spells: ['Revivify', 'Vampiric Touch'] },
        { minLevel: 7, spells: ['Blight', 'Death Ward'] },
        { minLevel: 9, spells: ['Antilife Shell', 'Raise Dead'] },
    ],

    // ----------------------------------------------------------
    // DRUID (XPHB)
    // ----------------------------------------------------------

    'druid|Circle of the Land (Arid)': [
        { minLevel: 3, spells: ['Blur', 'Burning Hands', 'Fire Bolt'] },
        { minLevel: 5, spells: ['Fireball'] },
        { minLevel: 7, spells: ['Blight'] },
        { minLevel: 9, spells: ['Wall of Stone'] },
    ],

    'druid|Circle of the Land (Polar)': [
        { minLevel: 3, spells: ['Fog Cloud', 'Hold Person', 'Ray of Frost'] },
        { minLevel: 5, spells: ['Sleet Storm'] },
        { minLevel: 7, spells: ['Ice Storm'] },
        { minLevel: 9, spells: ['Cone of Cold'] },
    ],

    'druid|Circle of the Land (Temperate)': [
        { minLevel: 3, spells: ['Misty Step', 'Shocking Grasp', 'Sleep'] },
        { minLevel: 5, spells: ['Lightning Bolt'] },
        { minLevel: 7, spells: ['Freedom of Movement'] },
        { minLevel: 9, spells: ['Tree Stride'] },
    ],

    'druid|Circle of the Land (Tropical)': [
        { minLevel: 3, spells: ['Acid Splash', 'Ray of Sickness', 'Web'] },
        { minLevel: 5, spells: ['Stinking Cloud'] },
        { minLevel: 7, spells: ['Polymorph'] },
        { minLevel: 9, spells: ['Insect Plague'] },
    ],

    'druid|Circle of the Moon': [
        { minLevel: 3, spells: ['Cure Wounds', 'Moonbeam', 'Starry Wisp'] },
        { minLevel: 5, spells: ['Conjure Animals'] },
        { minLevel: 7, spells: ['Fount of Moonlight'] },
        { minLevel: 9, spells: ['Mass Cure Wounds'] },
    ],

    'druid|Circle of the Sea': [
        { minLevel: 3, spells: ['Fog Cloud', 'Gust of Wind', 'Ray of Frost', 'Shatter', 'Thunderwave'] },
        { minLevel: 5, spells: ['Lightning Bolt', 'Water Breathing'] },
        { minLevel: 7, spells: ['Control Water', 'Ice Storm'] },
        { minLevel: 9, spells: ['Conjure Elemental', 'Hold Monster'] },
    ],

    'druid|Circle of the Stars': [
        { minLevel: 3, spells: ['Guidance', 'Guiding Bolt'] },
        { minLevel: 5, spells: ['Revivify'] },
        { minLevel: 7, spells: ['Divination'] },
        { minLevel: 9, spells: ['Commune'] },
    ],

    // DRUID (XGE)

    'druid|Circle of Dreams': [
        { minLevel: 3, spells: ['Healing Word'] },
    ],

    'druid|Circle of the Shepherd': [
        { minLevel: 3, spells: ['Animal Friendship', 'Speak with Animals'] },
    ],

    // ----------------------------------------------------------
    // PALADIN (XPHB)
    // ----------------------------------------------------------

    'paladin|Oath of Devotion': [
        { minLevel: 3, spells: ['Protection from Evil and Good', 'Shield of Faith'] },
        { minLevel: 5, spells: ['Aid', 'Zone of Truth'] },
        { minLevel: 9, spells: ['Beacon of Hope', 'Dispel Magic'] },
        { minLevel: 13, spells: ['Freedom of Movement', 'Guardian of Faith'] },
        { minLevel: 17, spells: ['Commune', 'Flame Strike'] },
    ],

    'paladin|Oath of Glory': [
        { minLevel: 3, spells: ['Guiding Bolt', 'Heroism'] },
        { minLevel: 5, spells: ['Enhance Ability', 'Magic Weapon'] },
        { minLevel: 9, spells: ['Haste', 'Protection from Energy'] },
        { minLevel: 13, spells: ['Compulsion', 'Freedom of Movement'] },
        { minLevel: 17, spells: ['Commune', 'Yolande\'s Regal Presence'] },
    ],

    'paladin|Oath of the Ancients': [
        { minLevel: 3, spells: ['Ensnaring Strike', 'Speak with Animals'] },
        { minLevel: 5, spells: ['Misty Step', 'Moonbeam'] },
        { minLevel: 9, spells: ['Plant Growth', 'Protection from Energy'] },
        { minLevel: 13, spells: ['Ice Storm', 'Stoneskin'] },
        { minLevel: 17, spells: ['Commune with Nature', 'Tree Stride'] },
    ],

    'paladin|Oath of Vengeance': [
        { minLevel: 3, spells: ['Bane', 'Hunter\'s Mark'] },
        { minLevel: 5, spells: ['Hold Person', 'Misty Step'] },
        { minLevel: 9, spells: ['Haste', 'Protection from Energy'] },
        { minLevel: 13, spells: ['Banishment', 'Dimension Door'] },
        { minLevel: 17, spells: ['Hold Monster', 'Scrying'] },
    ],

    // PALADIN (XGE)

    'paladin|Oath of Conquest': [
        { minLevel: 3, spells: ['Armor of Agathys', 'Command'] },
        { minLevel: 5, spells: ['Hold Person', 'Spiritual Weapon'] },
        { minLevel: 9, spells: ['Bestow Curse', 'Fear'] },
        { minLevel: 13, spells: ['Dominate Beast', 'Stoneskin'] },
        { minLevel: 17, spells: ['Cloudkill', 'Dominate Person'] },
    ],

    'paladin|Oath of Redemption': [
        { minLevel: 3, spells: ['Sanctuary', 'Sleep'] },
        { minLevel: 5, spells: ['Calm Emotions', 'Hold Person'] },
        { minLevel: 9, spells: ['Counterspell', 'Hypnotic Pattern'] },
        { minLevel: 13, spells: ['Otiluke\'s Resilient Sphere', 'Stoneskin'] },
        { minLevel: 17, spells: ['Hold Monster', 'Wall of Force'] },
    ],

    // ----------------------------------------------------------
    // RANGER (XPHB)
    // ----------------------------------------------------------

    'ranger|Fey Wanderer': [
        { minLevel: 3, spells: ['Charm Person'] },
        { minLevel: 5, spells: ['Misty Step'] },
        { minLevel: 9, spells: ['Dispel Magic'] },
        { minLevel: 13, spells: ['Dimension Door'] },
        { minLevel: 17, spells: ['Mislead'] },
    ],

    'ranger|Gloom Stalker': [
        { minLevel: 3, spells: ['Disguise Self'] },
        { minLevel: 5, spells: ['Rope Trick'] },
        { minLevel: 9, spells: ['Fear'] },
        { minLevel: 13, spells: ['Greater Invisibility'] },
        { minLevel: 17, spells: ['Seeming'] },
    ],

    'ranger|Hunter': [],

    'ranger|Beast Master': [],

    // RANGER (XGE)

    'ranger|Gloom Stalker (XGE)': [
        { minLevel: 3, spells: ['Disguise Self'] },
        { minLevel: 5, spells: ['Rope Trick'] },
        { minLevel: 9, spells: ['Fear'] },
        { minLevel: 13, spells: ['Greater Invisibility'] },
        { minLevel: 17, spells: ['Seeming'] },
    ],

    'ranger|Horizon Walker': [
        { minLevel: 3, spells: ['Protection from Evil and Good'] },
        { minLevel: 5, spells: ['Misty Step'] },
        { minLevel: 9, spells: ['Haste'] },
        { minLevel: 13, spells: ['Banishment'] },
        { minLevel: 17, spells: ['Teleportation Circle'] },
    ],

    'ranger|Monster Slayer': [
        { minLevel: 3, spells: ['Protection from Evil and Good'] },
        { minLevel: 5, spells: ['Zone of Truth'] },
        { minLevel: 9, spells: ['Magic Circle'] },
        { minLevel: 13, spells: ['Banishment'] },
        { minLevel: 17, spells: ['Hold Monster'] },
    ],

    // ----------------------------------------------------------
    // SORCERER (XPHB)
    // ----------------------------------------------------------

    'sorcerer|Aberrant Sorcery': [
        { minLevel: 3, spells: ['Arms of Hadar', 'Calm Emotions', 'Detect Thoughts', 'Dissonant Whispers', 'Hunger of Hadar', 'Mind Sliver'] },
        { minLevel: 3, spells: ['Sending', 'Evard\'s Black Tentacles'] },
        { minLevel: 5, spells: ['Rary\'s Telepathic Bond', 'Telekinesis'] },
    ],

    'sorcerer|Clockwork Soul': [
        { minLevel: 3, spells: ['Aid', 'Alarm', 'Lesser Restoration', 'Protection from Evil and Good'] },
        { minLevel: 3, spells: ['Dispel Magic', 'Freedom of Movement'] },
        { minLevel: 5, spells: ['Greater Restoration', 'Summon Construct', 'Wall of Force'] },
    ],

    'sorcerer|Draconic Bloodline': [
        { minLevel: 3, spells: ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"] },
        { minLevel: 5, spells: ['Fear', 'Fly'] },
        { minLevel: 7, spells: ['Arcane Eye', 'Charm Monster'] },
        { minLevel: 9, spells: ['Legend Lore', 'Summon Dragon'] },
    ],

    'sorcerer|Draconic Sorcery': [
        { minLevel: 3, spells: ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"] },
        { minLevel: 5, spells: ['Fear', 'Fly'] },
        { minLevel: 7, spells: ['Arcane Eye', 'Charm Monster'] },
        { minLevel: 9, spells: ['Legend Lore', 'Summon Dragon'] },
    ],

    'sorcerer|Wild Magic': [],

    // SORCERER (XGE)

    'sorcerer|Divine Soul': [
        { minLevel: 3, spells: [] },
    ],

    'sorcerer|Shadow Magic': [
        { minLevel: 3, spells: ['Darkness'] },
    ],

    'sorcerer|Storm Sorcery': [],

    // ----------------------------------------------------------
    // WARLOCK (XPHB)
    // ----------------------------------------------------------

    'warlock|Archfey Patron': [
        { minLevel: 3, spells: ['Calm Emotions', 'Faerie Fire', 'Misty Step', 'Phantasmal Force', 'Sleep'] },
        { minLevel: 3, spells: ['Blink', 'Plant Growth'] },
        { minLevel: 5, spells: ['Dominate Beast', 'Greater Invisibility'] },
        { minLevel: 7, spells: ['Dominate Person', 'Seeming'] },
    ],

    'warlock|Celestial Patron': [
        { minLevel: 3, spells: ['Aid', 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Light', 'Sacred Flame'] },
        { minLevel: 3, spells: ['Daylight', 'Revivify'] },
        { minLevel: 5, spells: ['Guardian of Faith', 'Wall of Fire'] },
        { minLevel: 7, spells: ['Greater Restoration', 'Summon Celestial'] },
    ],

    'warlock|Fiend Patron': [
        { minLevel: 3, spells: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'] },
        { minLevel: 3, spells: ['Fireball', 'Stinking Cloud'] },
        { minLevel: 5, spells: ['Fire Shield', 'Wall of Fire'] },
        { minLevel: 7, spells: ['Geas', 'Insect Plague'] },
    ],

    'warlock|Great Old One Patron': [
        { minLevel: 3, spells: ['Detect Thoughts', 'Dissonant Whispers', 'Phantasmal Force', 'Tasha\'s Hideous Laughter'] },
        { minLevel: 3, spells: ['Clairvoyance', 'Hunger of Hadar'] },
        { minLevel: 5, spells: ['Evard\'s Black Tentacles', 'Phantasmal Killer'] },
        { minLevel: 7, spells: ['Modify Memory', 'Telekinesis'] },
    ],

    // WARLOCK (XGE)

    'warlock|The Celestial': [
        { minLevel: 3, spells: ['Cure Wounds', 'Guiding Bolt', 'Light', 'Sacred Flame'] },
        { minLevel: 3, spells: ['Flaming Sphere', 'Lesser Restoration'] },
        { minLevel: 5, spells: ['Daylight', 'Revivify'] },
        { minLevel: 7, spells: ['Guardian of Faith', 'Wall of Fire'] },
        { minLevel: 9, spells: ['Flame Strike', 'Greater Restoration'] },
    ],

    'warlock|The Hexblade': [
        { minLevel: 3, spells: ['Shield', 'Wrathful Smite'] },
        { minLevel: 3, spells: ['Blur', 'Branding Smite'] },
        { minLevel: 5, spells: ['Blink', 'Elemental Weapon'] },
        { minLevel: 7, spells: ['Phantasmal Killer', 'Staggering Smite'] },
        { minLevel: 9, spells: ['Banishing Smite', 'Cone of Cold'] },
    ],

    // ----------------------------------------------------------
    // WIZARD (XPHB)
    // ----------------------------------------------------------

    'wizard|School of Abjuration': [
        { minLevel: 3, spells: ['Counterspell', 'Dispel Magic', 'Shield'] },
    ],

    'wizard|School of Divination': [
        { minLevel: 3, spells: ['Augury', 'Detect Magic', 'See Invisibility'] },
    ],

    'wizard|School of Evocation': [
        { minLevel: 3, spells: ['Magic Missile', 'Scorching Ray', 'Shatter'] },
    ],

    'wizard|School of Illusion': [
        { minLevel: 3, spells: ['Mirror Image', 'Phantasmal Force'] },
        { minLevel: 6, spells: ['Summon Beast', 'Summon Fey'] },
    ],
};

// ============================================================
// Subclasses whose bonus spells are "known" (not always-prepared)
// XGE Rangers, XGE Warlocks use this pattern
// ============================================================

export const BONUS_SPELLS_KNOWN = new Set([
    'ranger|Gloom Stalker (XGE)',
    'ranger|Horizon Walker',
    'ranger|Monster Slayer',
    'warlock|The Celestial',
    'warlock|The Hexblade',
]);

// ============================================================
// Bonus cantrips granted by subclass (separate from spell lists above)
// These are in addition to the class cantrip progression
// ============================================================

export const SUBCLASS_BONUS_CANTRIPS = {
    'warlock|Celestial Patron': ['Light', 'Sacred Flame'],
    'warlock|The Celestial': ['Light', 'Sacred Flame'],
    'druid|Circle of the Stars': ['Guidance'],
    'druid|Circle of the Moon': ['Starry Wisp'],
    'druid|Circle of the Land (Arid)': ['Fire Bolt'],
    'druid|Circle of the Land (Polar)': ['Ray of Frost'],
    'druid|Circle of the Land (Temperate)': ['Shocking Grasp'],
    'druid|Circle of the Land (Tropical)': ['Acid Splash'],
    'sorcerer|Aberrant Sorcery': ['Mind Sliver'],
};

/**
 * Get subclass spells available at a given class level.
 * @param {string} classKey - Lowercase class name
 * @param {string} subclassName - Full subclass name as stored in character data
 * @param {number} level - Current class level
 * @returns {{ spells: string[], isKnown: boolean, bonusCantrips: string[] }}
 */
export function getSubclassSpells(classKey, subclassName, level) {
    const key = `${classKey}|${subclassName}`;
    const entries = SUBCLASS_SPELL_LISTS[key] || [];
    const isKnown = BONUS_SPELLS_KNOWN.has(key);
    const bonusCantrips = SUBCLASS_BONUS_CANTRIPS[key] || [];

    const spells = [];
    for (const entry of entries) {
        if (entry.minLevel <= level) {
            for (const spell of entry.spells) {
                if (!bonusCantrips.includes(spell) && !spells.includes(spell)) {
                    spells.push(spell);
                }
            }
        }
    }

    return { spells, isKnown, bonusCantrips };
}
