/**
 * D&D 5e Lite - Feat Effects Module
 *
 * Modular system for applying feat effects to sidekick stats.
 * Each feat that modifies computed values registers an effect handler.
 *
 * Effect types:
 *   hp       – modifies max HP
 *   skills   – grants skill/tool proficiencies or expertise
 *   spells   – grants bonus cantrips/spells (with free-cast info)
 *   damage   – modifies damage rolls or dice
 *   prompt   – adds extra text for the LLM prompt
 *
 * Feat data shape (stored on sidekick.featData[featName]):
 *   Arbitrary per-feat config chosen by the user in the UI,
 *   e.g. { selectedSkills: [...], selectedSpells: [...], spellList: 'Cleric' }
 */

import { lookupFeatByName, lookupSpellByName } from './sidekick.js';

// ─── Registry ───────────────────────────────────────────────

const FEAT_EFFECTS = {};

function register(featName, handler) {
    FEAT_EFFECTS[featName] = handler;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Collect all feat effects for a sidekick's chosen feats.
 * Returns a merged effects object consumed by computeSidekickStats.
 *
 * @param {string[]} chosenFeats - array of feat names
 * @param {object} featData - sidekick.featData keyed by feat name
 * @param {object} ctx - { level, scores, mods, proficiency }
 * @returns {{ hpBonus:number, extraSkills:string[], extraExpertise:string[],
 *             toolProficiencies:string[], bonusCantrips:{name,source,freeCast}[],
 *             bonusSpells:{name,source,freeCast,level}[],
 *             promptNotes:string[] }}
 */
export function collectFeatEffects(chosenFeats, featData, ctx) {
    const result = {
        hpBonus: 0,
        extraSkills: [],
        extraExpertise: [],
        toolProficiencies: [],
        bonusCantrips: [],
        bonusSpells: [],
        promptNotes: [],
    };

    if (!chosenFeats?.length) return result;

    for (const featName of chosenFeats) {
        const handler = FEAT_EFFECTS[featName];
        if (!handler) continue;
        const data = featData?.[featName] || {};
        handler(result, data, ctx);
    }
    return result;
}

/**
 * Describe what UI configuration a feat needs.
 * Returns null if no special UI is needed.
 *
 * @param {string} featName
 * @returns {{ type: string, config: object }|null}
 */
export function getFeatUIDescriptor(featName) {
    const desc = FEAT_UI_DESCRIPTORS[featName];
    return desc ? desc() : null;
}

const FEAT_UI_DESCRIPTORS = {};

function registerUI(featName, descriptorFn) {
    FEAT_UI_DESCRIPTORS[featName] = descriptorFn;
}

// ─── Tough ──────────────────────────────────────────────────
// HP max increases by 2 * character level.

register('Tough', (result, _data, ctx) => {
    result.hpBonus += ctx.level * 2;
});

// ─── Durable ────────────────────────────────────────────────
// Advantage on CON saves + bonus action heal; no computed stat change
// beyond the +1 CON from ability, but note it for prompt.

register('Durable', (result) => {
    result.promptNotes.push('Durable: advantage on Constitution saving throws to maintain concentration; can use bonus action to expend one Hit Die and regain HP.');
});

// ─── Skilled ────────────────────────────────────────────────
// Gain proficiency in 3 skills or tools. Repeatable.

register('Skilled', (result, data) => {
    if (data.selectedSkills?.length) result.extraSkills.push(...data.selectedSkills);
    if (data.selectedTools?.length) result.toolProficiencies.push(...data.selectedTools);
});

registerUI('Skilled', () => ({
    type: 'skillsAndTools',
    config: { skillCount: 3, toolCount: 3, combined: true, label: 'Choose 3 skills or tools' },
}));

// ─── Skill Expert ───────────────────────────────────────────
// Proficiency in 1 skill + expertise in 1 proficient skill.

register('Skill Expert', (result, data) => {
    if (data.selectedSkill) result.extraSkills.push(data.selectedSkill);
    if (data.selectedExpertise) result.extraExpertise.push(data.selectedExpertise);
});

registerUI('Skill Expert', () => ({
    type: 'skillExpert',
    config: { label: 'Choose 1 skill proficiency and 1 expertise' },
}));

// ─── Magic Initiate ─────────────────────────────────────────
// 2 cantrips + 1 level-1 spell from Cleric/Druid/Wizard, free cast 1/LR.

register('Magic Initiate', (result, data) => {
    const list = data.spellList || '';
    if (data.selectedCantrips?.length) {
        for (const name of data.selectedCantrips) {
            result.bonusCantrips.push({ name, source: `Magic Initiate (${list})`, freeCast: false });
        }
    }
    if (data.selectedSpell) {
        result.bonusSpells.push({
            name: data.selectedSpell,
            source: `Magic Initiate (${list})`,
            freeCast: true,
            level: 1,
        });
    }
});

registerUI('Magic Initiate', () => ({
    type: 'magicInitiate',
    config: {
        lists: ['Cleric', 'Druid', 'Wizard'],
        cantrips: 2,
        spells: 1,
        spellLevel: 1,
        label: 'Choose spell list, 2 cantrips, and 1 level-1 spell',
    },
}));

// ─── Fey-Touched ────────────────────────────────────────────
// Misty Step + 1 level-1 Enchantment or Divination spell, each free 1/LR.

register('Fey-Touched', (result, data) => {
    result.bonusSpells.push({ name: 'Misty Step', source: 'Fey-Touched', freeCast: true, level: 2 });
    if (data.selectedSpell) {
        result.bonusSpells.push({ name: data.selectedSpell, source: 'Fey-Touched', freeCast: true, level: 1 });
    }
});

registerUI('Fey-Touched', () => ({
    type: 'spellPick',
    config: {
        fixedSpells: ['Misty Step'],
        pickCount: 1,
        pickLevel: 1,
        pickSchools: ['D', 'E'],
        label: 'Choose 1 level-1 Divination or Enchantment spell',
    },
}));

// ─── Shadow-Touched ─────────────────────────────────────────
// Invisibility + 1 level-1 Illusion or Necromancy spell, each free 1/LR.

register('Shadow-Touched', (result, data) => {
    result.bonusSpells.push({ name: 'Invisibility', source: 'Shadow-Touched', freeCast: true, level: 2 });
    if (data.selectedSpell) {
        result.bonusSpells.push({ name: data.selectedSpell, source: 'Shadow-Touched', freeCast: true, level: 1 });
    }
});

registerUI('Shadow-Touched', () => ({
    type: 'spellPick',
    config: {
        fixedSpells: ['Invisibility'],
        pickCount: 1,
        pickLevel: 1,
        pickSchools: ['I', 'N'],
        label: 'Choose 1 level-1 Illusion or Necromancy spell',
    },
}));

// ─── Telekinetic ────────────────────────────────────────────
// Learn Mage Hand (invisible, +30ft range).

register('Telekinetic', (result) => {
    result.bonusCantrips.push({ name: 'Mage Hand', source: 'Telekinetic', freeCast: false });
    result.promptNotes.push('Telekinetic: Mage Hand is invisible with +30ft range. As a bonus action, telekinetically shove one creature within 30ft (STR save or pushed 5ft).');
});

// ─── Telepathic ─────────────────────────────────────────────
// Detect Thoughts 1/LR free.

register('Telepathic', (result) => {
    result.bonusSpells.push({ name: 'Detect Thoughts', source: 'Telepathic', freeCast: true, level: 2 });
    result.promptNotes.push('Telepathic: Can speak telepathically to any creature within 60ft that shares a language.');
});

// ─── Ritual Caster ──────────────────────────────────────────
// Level-1 ritual spells (count scales with prof bonus).

register('Ritual Caster', (result, data) => {
    if (data.selectedSpells?.length) {
        for (const name of data.selectedSpells) {
            result.bonusSpells.push({ name, source: 'Ritual Caster', freeCast: true, level: 1 });
        }
    }
    result.promptNotes.push('Ritual Caster: Can cast prepared ritual spells without a slot once per long rest. Can cast any ritual spell with extended ritual casting time without a slot.');
});

registerUI('Ritual Caster', () => ({
    type: 'ritualCaster',
    config: {
        spellLevel: 1,
        ritual: true,
        label: 'Choose level-1 ritual spells (count = proficiency bonus)',
    },
}));

// ─── Healer ─────────────────────────────────────────────────
// Modifies healing dice (reroll 1s). No computed stat change but prompt note.

register('Healer', (result) => {
    result.promptNotes.push('Healer: With a Healer\'s Kit, can use bonus action to let a creature expend a Hit Die to heal (roll + proficiency bonus). Rerolls 1s on healing dice from spells and this feat.');
});

// ─── Chef ───────────────────────────────────────────────────

register('Chef', (result, _data, ctx) => {
    const mod = ctx.mods?.con ?? 0;
    result.toolProficiencies.push("Cook's Utensils");
    result.promptNotes.push(`Chef: During short rest, creatures who eat and spend Hit Dice regain extra 1d8 HP. Can cook ${Math.max(1, mod)} treats (bonus action: eat for 1d8 temp HP).`);
});

// ─── Inspiring Leader ───────────────────────────────────────

register('Inspiring Leader', (result, _data, ctx) => {
    const abilityBonus = ctx.featAbilityMod ?? 0;
    const tempHp = ctx.level + abilityBonus;
    result.promptNotes.push(`Inspiring Leader: After short/long rest, up to 6 allies gain ${tempHp} temp HP from an inspiring performance.`);
});

// ─── Great Weapon Master ────────────────────────────────────

register('Great Weapon Master', (result, _data, ctx) => {
    result.promptNotes.push(`Great Weapon Master: Heavy/Two-Handed weapons deal +${ctx.proficiency} extra damage on Attack action hits. After a crit or reducing a creature to 0 HP with a melee weapon, can make one bonus action attack.`);
});

// ─── Heavy Armor Master ─────────────────────────────────────

register('Heavy Armor Master', (result, _data, ctx) => {
    result.promptNotes.push(`Heavy Armor Master: While wearing heavy armor, Bludgeoning/Piercing/Slashing damage from attacks is reduced by ${ctx.proficiency}.`);
});

// ─── Crusher / Piercer / Slasher ────────────────────────────

register('Crusher', (result) => {
    result.promptNotes.push('Crusher: Once/turn on Bludgeoning hit, push target 5ft. On crit with Bludgeoning, attacks vs target have advantage until your next turn.');
});

register('Piercer', (result) => {
    result.promptNotes.push('Piercer: Once/turn on Piercing hit, reroll one damage die. On crit with Piercing, roll one additional damage die.');
});

register('Slasher', (result) => {
    result.promptNotes.push('Slasher: Once/turn on Slashing hit, reduce target speed by 10ft until your next turn. On crit with Slashing, target has disadvantage on attacks until your next turn.');
});

// ─── Elemental Adept ────────────────────────────────────────

register('Elemental Adept', (result, data) => {
    const type = data.damageType || '?';
    result.promptNotes.push(`Elemental Adept (${type}): Spells ignore resistance to ${type} damage. Treat 1s on ${type} damage dice as 2s.`);
});

registerUI('Elemental Adept', () => ({
    type: 'damageTypePick',
    config: {
        options: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        label: 'Choose damage type',
    },
}));

// ─── Savage Attacker ────────────────────────────────────────

register('Savage Attacker', (result) => {
    result.promptNotes.push('Savage Attacker: Once/turn on weapon hit, roll damage dice twice and use either result.');
});

// ─── Resilient ──────────────────────────────────────────────

register('Resilient', (result, data) => {
    if (data.saveProficiency) {
        result.promptNotes.push(`Resilient: Gains proficiency in ${data.saveProficiency.toUpperCase()} saving throws.`);
    }
});

// ─── Musician ───────────────────────────────────────────────

register('Musician', (result) => {
    result.toolProficiencies.push('Musical Instrument (3)');
    result.promptNotes.push('Musician: Proficiency with 3 musical instruments. After Inspiring Help, allies gain Heroic Inspiration.');
});

// ─── Tavern Brawler ─────────────────────────────────────────

register('Tavern Brawler', (result) => {
    result.promptNotes.push('Tavern Brawler: Unarmed Strike deals 1d4 + STR. Can push 5ft on hit. Reroll damage 1s with improvised weapons and unarmed strikes. Proficient with improvised weapons.');
});

// ─── Alert ──────────────────────────────────────────────────

register('Alert', (result, _data, ctx) => {
    result.promptNotes.push(`Alert: +${ctx.proficiency} to initiative. Can swap initiative with a willing ally at combat start. Can't be surprised if conscious.`);
});

// ─── Lucky ──────────────────────────────────────────────────

register('Lucky', (result) => {
    result.promptNotes.push('Lucky: Has Luck Points equal to proficiency bonus. Can spend 1 to roll extra d20 on attack/ability/save (use either). Can force attacker reroll. Regains all on long rest.');
});

// ─── War Caster ─────────────────────────────────────────────

register('War Caster', (result) => {
    result.promptNotes.push('War Caster: Advantage on CON saves for concentration. Can perform somatic components with weapons/shield. Can cast a cantrip for opportunity attack reaction.');
});

// ─── Spell Sniper ───────────────────────────────────────────

register('Spell Sniper', (result) => {
    result.promptNotes.push('Spell Sniper: Spell attack rolls ignore half/three-quarters cover. No disadvantage for being within 5ft. Spells with 10ft+ range that require attack rolls get +60ft range.');
});

// ─── Tool / Instrument Constants ────────────────────────────

export const DND_TOOLS = [
    "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
    "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
    "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
    "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
    "Potter's Tools", "Smith's Tools", "Tinker's Tools",
    "Weaver's Tools", "Woodcarver's Tools",
    "Disguise Kit", "Forgery Kit", "Herbalism Kit",
    "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools",
    "Bagpipes", "Drum", "Dulcimer", "Flute", "Horn",
    "Lute", "Lyre", "Pan Flute", "Shawm", "Viol",
    "Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set",
];
