/**
 * V1 Character System - Subclass Feature Effect Registry
 * Registers prompt notes and computed effects for all XPHB + XGE subclass features.
 * Uses the data-driven register() from classEffects.js with { subclass } metadata.
 *
 * Exported as a single function to avoid circular import issues.
 */

let register;

/**
 * Called by classEffects.js to register all subclass features.
 * @param {Function} registerFn - The register function from classEffects.js
 */
export function registerAllSubclassEffects(registerFn) {
    register = registerFn;
    registerBarbarian();
    registerBard();
    registerCleric();
    registerDruid();
    registerFighter();
    registerMonk();
    registerPaladin();
    registerRanger();
    registerRogue();
    registerSorcerer();
    registerWarlock();
    registerWizard();
}

// ============================================================
// BARBARIAN SUBCLASSES
// ============================================================

function registerBarbarian() {
// --- Path of the Berserker (XPHB) ---
    register('barbarian', 'Frenzy', 3, {
        promptNote: () => 'Frenzy: While raging, make one extra weapon attack as bonus action each turn',
    }, { subclass: 'Berserker' });

    register('barbarian', 'Mindless Rage', 6, {
        promptNote: () => 'Mindless Rage: Cannot be charmed or frightened while raging (existing effects suspended)',
    }, { subclass: 'Berserker' });

    register('barbarian', 'Retaliation', 10, {
        promptNote: () => 'Retaliation: When creature within 5ft hits you, reaction melee attack against it',
    }, { subclass: 'Berserker' });

    register('barbarian', 'Intimidating Presence', 14, {
        promptNote: (stats) => `Intimidating Presence: Bonus action frighten one creature within 30ft (DC ${8 + stats.proficiency + (stats.mods.str || 0)}, WIS save)`,
    }, { subclass: 'Berserker' });

    // --- Path of the Wild Heart (XPHB) ---
    register('barbarian', 'Rage of the Wilds', 3, {
        promptNote: () => 'Rage of the Wilds: While raging, gain chosen animal aspect (Bear/Eagle/Wolf)',
    }, { subclass: 'Wild Heart' });

    register('barbarian', 'Aspect of the Wilds', 6, {
        promptNote: () => 'Aspect of the Wilds: Gain passive benefit of chosen aspect (Owl/Panther/Salmon)',
    }, { subclass: 'Wild Heart' });

    register('barbarian', 'Power of the Wilds', 14, {
        promptNote: () => 'Power of the Wilds: While raging, gain enhanced animal aspect (Bear/Eagle/Wolf level 14)',
    }, { subclass: 'Wild Heart' });

    // --- Path of the World Tree (XPHB) ---
    register('barbarian', 'Vitality of the Tree', 3, {
        promptNote: (stats) => `Vitality of the Tree: While raging, at start of each turn gain ${stats.level >= 14 ? Math.floor(stats.level / 2) : Math.max(1, stats.mods.con || 0)} temp HP`,
    }, { subclass: 'World Tree' });

    register('barbarian', 'Branches of the Tree', 6, {
        promptNote: () => 'Branches of the Tree: While raging, teleport willing ally within 60ft to space within 5ft of you (bonus action)',
    }, { subclass: 'World Tree' });

    register('barbarian', 'Battering Roots', 10, {
        promptNote: () => 'Battering Roots: While raging, reach extends by 10ft; push target 5ft on hit',
    }, { subclass: 'World Tree' });

    register('barbarian', 'Travel Along the Tree', 14, {
        promptNote: () => 'Travel Along the Tree: As bonus action while raging, teleport up to 60ft to unoccupied space you can see',
    }, { subclass: 'World Tree' });

    // --- Path of the Zealot (XPHB) ---
    register('barbarian', 'Divine Fury', 3, {
        promptNote: (stats) => {
            const dice = stats.level >= 14 ? '2d6' : '1d6';
            return `Divine Fury: First hit each turn while raging +${dice} + floor(level/2) radiant/necrotic damage`;
        },
    }, { subclass: 'Zealot' });

    register('barbarian', 'Warrior of the Gods', 3, {
        promptNote: () => 'Warrior of the Gods: Spells to revive you need no material components',
    }, { subclass: 'Zealot' });

    register('barbarian', 'Fanatical Focus', 6, {
        promptNote: () => 'Fanatical Focus: Reroll a failed save while raging (1/rage)',
    }, { subclass: 'Zealot' });

    register('barbarian', 'Zealous Presence', 10, {
        promptNote: () => 'Zealous Presence: Bonus action grant 10 allies within 60ft advantage on attacks and saves (1/LR)',
    }, { subclass: 'Zealot' });

    register('barbarian', 'Rage Beyond Death', 14, {
        promptNote: () => 'Rage Beyond Death: While raging at 0 HP, not unconscious; still make death saves; die only if rage ends at 0',
    }, { subclass: 'Zealot' });

    // --- Ancestral Guardian (XGE) ---
    register('barbarian', 'Ancestral Protectors', 3, {
        promptNote: () => 'Ancestral Protectors: First creature you hit while raging has disadvantage on attacks vs others and resistance to its damage against allies',
    }, { subclass: 'Ancestral Guardian' });

    register('barbarian', 'Spirit Shield', 6, {
        statTag: (stats) => {
            const dice = stats.level >= 14 ? '4d6' : stats.level >= 10 ? '3d6' : '2d6';
            return `rxn -${dice} dmg`;
        },
        promptNote: (stats) => {
            const dice = stats.level >= 14 ? '4d6' : stats.level >= 10 ? '3d6' : '2d6';
            return `Spirit Shield: Reaction reduce damage to ally within 30ft by ${dice}`;
        },
    }, { subclass: 'Ancestral Guardian' });

    register('barbarian', 'Consult the Spirits', 10, {
        promptNote: () => 'Consult the Spirits: Cast Clairvoyance/Augury without spell slot (1/SR)',
    }, { subclass: 'Ancestral Guardian' });

    register('barbarian', 'Vengeful Ancestors', 14, {
        promptNote: () => 'Vengeful Ancestors: Spirit Shield also deals equal force damage to attacker',
    }, { subclass: 'Ancestral Guardian' });

    // --- Storm Herald (XGE) ---
    register('barbarian', 'Storm Aura', 3, {
        promptNote: () => 'Storm Aura: 10ft aura while raging (Desert: fire dmg / Sea: lightning dmg / Tundra: temp HP)',
    }, { subclass: 'Storm Herald' });

    register('barbarian', 'Storm Soul', 6, {
        promptNote: () => 'Storm Soul: Resistance to chosen element; passive benefit (Desert: fire resist / Sea: breathe underwater + swim / Tundra: cold resist)',
    }, { subclass: 'Storm Herald' });

    register('barbarian', 'Shielding Storm', 10, {
        promptNote: () => 'Shielding Storm: Allies in aura gain your Storm Soul resistance',
    }, { subclass: 'Storm Herald' });

    register('barbarian', 'Raging Storm', 14, {
        promptNote: () => 'Raging Storm: Enhanced aura effect (Desert: reaction fire / Sea: knock prone / Tundra: freeze)',
    }, { subclass: 'Storm Herald' });
}

// ============================================================
// BARD SUBCLASSES
// ============================================================

function registerBard() {
// --- College of Dance (XPHB) ---
    register('bard', 'Dazzling Footwork', 3, {
        acOverride: (stats) => ({
            formula: 10 + (stats.mods.dex || 0) + (stats.mods.cha || 0),
            requiresNoArmor: true,
            allowsShield: false,
        }),
        statTag: () => 'AC=10+DEX+CHA,+10ft',
        promptNote: () => 'Dazzling Footwork: AC = 10 + DEX + CHA (no armor/shield); speed +10ft; no OA from targets you attacked',
        speedBonus: () => 10,
    }, { subclass: 'Dance' });

    register('bard', 'Inspiring Movement', 6, {
        promptNote: () => 'Inspiring Movement: When ally uses Bardic Inspiration, another creature within 30ft can move half speed as reaction (no OA)',
    }, { subclass: 'Dance' });

    register('bard', 'Tandem Footwork', 6, {
        promptNote: () => 'Tandem Footwork: When you roll initiative, allies who hear you add Bardic Inspiration die to their initiative',
    }, { subclass: 'Dance' });

    register('bard', 'Leading Evasion', 14, {
        promptNote: () => 'Leading Evasion: Reaction when you or ally within 5ft makes DEX save vs area effect — all within 5ft who save take no damage',
    }, { subclass: 'Dance' });

    // --- College of Glamour (XPHB) ---
    register('bard', 'Mantle of Inspiration', 3, {
        promptNote: (stats) => `Mantle of Inspiration: Bonus action grant ${Math.max(1, stats.mods.cha || 0)} allies within 60ft ${stats.level >= 14 ? '2d' : '1d'}${stats.level >= 15 ? '12' : stats.level >= 10 ? '10' : stats.level >= 5 ? '8' : '6'} temp HP + move speed (no OA)`,
    }, { subclass: 'Glamour' });

    register('bard', 'Enthralling Performance', 3, {
        promptNote: () => 'Enthralling Performance: After 1min performance, charm up to CHA mod creatures for 1 hour (WIS save)',
    }, { subclass: 'Glamour' });

    register('bard', 'Mantle of Majesty', 6, {
        promptNote: () => 'Mantle of Majesty: Bonus action cast Command without slot each turn for 1 minute (concentration, 1/LR)',
    }, { subclass: 'Glamour' });

    register('bard', 'Unbreakable Majesty', 14, {
        promptNote: () => 'Unbreakable Majesty: Bonus action for 1 min, creatures must CHA save to target you with attack; fail = choose new target (1/LR)',
    }, { subclass: 'Glamour' });

    // --- College of Lore (XPHB) ---
    register('bard', 'Cutting Words', 3, {
        promptNote: () => 'Cutting Words: Reaction subtract Bardic Inspiration die from creature\'s attack/ability/damage roll within 60ft',
    }, { subclass: 'Lore' });

    register('bard', 'Magical Discoveries', 6, {
        promptNote: () => 'Magical Discoveries: Learn 2 spells from Cleric, Druid, or Wizard list',
    }, { subclass: 'Lore' });

    register('bard', 'Peerless Skill', 14, {
        promptNote: () => 'Peerless Skill: Add Bardic Inspiration die to your own ability checks',
    }, { subclass: 'Lore' });

    // --- College of Valor (XPHB) ---
    register('bard', 'Combat Inspiration', 3, {
        promptNote: () => 'Combat Inspiration: Ally can add Bardic Inspiration die to weapon damage or AC (reaction) against one attack',
    }, { subclass: 'Valor' });

    register('bard', 'Extra Attack (Valor)', 6, {
        promptNote: () => 'Extra Attack: 2 attacks per Attack action',
    }, { subclass: 'Valor' });

    register('bard', 'Battle Magic', 14, {
        promptNote: () => 'Battle Magic: When you cast a Bard spell, make one weapon attack as bonus action',
    }, { subclass: 'Valor' });

    // --- College of Swords (XGE) ---
    register('bard', 'Blade Flourish', 3, {
        promptNote: () => 'Blade Flourish: On Attack action, speed +10ft; once per turn add Bardic Inspiration die to weapon damage and apply flourish (Defensive/Slashing/Mobile)',
    }, { subclass: 'Swords' });

    register('bard', 'Extra Attack (Swords)', 6, {
        promptNote: () => 'Extra Attack: 2 attacks per Attack action',
    }, { subclass: 'Swords' });

    register('bard', 'Master\'s Flourish', 14, {
        promptNote: () => 'Master\'s Flourish: Use d6 instead of Bardic Inspiration die for Blade Flourish (no resource spent)',
    }, { subclass: 'Swords' });

    // --- College of Whispers (XGE) ---
    register('bard', 'Psychic Blades', 3, {
        promptNote: (stats) => {
            const dice = stats.level >= 15 ? '8d6' : stats.level >= 10 ? '5d6' : stats.level >= 5 ? '3d6' : '2d6';
            return `Psychic Blades: Expend Bardic Inspiration on weapon hit for +${dice} psychic damage`;
        },
    }, { subclass: 'Whispers' });

    register('bard', 'Words of Terror', 3, {
        promptNote: () => 'Words of Terror: After 1min talking, one creature frightened of chosen target for 1hr (WIS save)',
    }, { subclass: 'Whispers' });

    register('bard', 'Mantle of Whispers', 6, {
        promptNote: () => 'Mantle of Whispers: Capture shadow of dying humanoid; assume their appearance for 1hr as disguise',
    }, { subclass: 'Whispers' });

    register('bard', 'Shadow Lore', 14, {
        promptNote: () => 'Shadow Lore: Whisper to creature, it is charmed and obeys you for 8hr (WIS save, 1/LR)',
    }, { subclass: 'Whispers' });
}

// ============================================================
// CLERIC SUBCLASSES
// ============================================================

function registerCleric() {
// --- Trickery Domain (XPHB) ---
    register('cleric', 'Blessing of the Trickster', 3, {
        promptNote: () => 'Blessing of the Trickster: Grant touched creature advantage on Stealth checks (until next use)',
    }, { subclass: 'Trickery' });

    register('cleric', 'Invoke Duplicity', 3, {
        promptNote: () => 'Invoke Duplicity: Channel Divinity to create illusory duplicate within 30ft; cast spells from its space; advantage on attacks when both within 5ft of target',
    }, { subclass: 'Trickery' });

    register('cleric', 'Trickster\'s Transposition', 6, {
        promptNote: () => 'Trickster\'s Transposition: Teleport to swap places with duplicate (30ft, bonus action)',
    }, { subclass: 'Trickery' });

    register('cleric', 'Improved Duplicity', 17, {
        promptNote: () => 'Improved Duplicity: Duplicate can move independently; you can cast from its position; advantage in its 5ft',
    }, { subclass: 'Trickery' });

    // --- War Domain (XPHB) ---
    register('cleric', 'War Priest', 3, {
        promptNote: (stats) => `War Priest: Make one weapon attack as bonus action (${Math.max(1, stats.mods.wis || 0)} uses/LR)`,
    }, { subclass: 'War' });

    register('cleric', 'Guided Strike', 3, {
        promptNote: () => 'Guided Strike: Channel Divinity to add +10 to an attack roll',
    }, { subclass: 'War' });

    register('cleric', 'War God\'s Blessing', 6, {
        promptNote: () => 'War God\'s Blessing: Channel Divinity to grant ally within 30ft +10 to attack roll (reaction)',
    }, { subclass: 'War' });

    register('cleric', 'Avatar of Battle', 17, {
        promptNote: () => 'Avatar of Battle: Resistance to bludgeoning/piercing/slashing from nonmagical weapons',
    }, { subclass: 'War' });

    // --- Forge Domain (XGE) ---
    register('cleric', 'Blessing of the Forge', 3, {
        promptNote: () => 'Blessing of the Forge: At end of LR, enchant one weapon or armor with +1 bonus (until next LR)',
    }, { subclass: 'Forge' });

    register('cleric', 'Artisan\'s Blessing', 3, {
        promptNote: () => 'Artisan\'s Blessing: Channel Divinity to create simple metal item (ritual, 1hr)',
    }, { subclass: 'Forge' });

    register('cleric', 'Soul of the Forge', 6, {
        acBonus: (stats) => stats.hasArmor && stats.armorType === 'HA' ? 1 : 0,
        promptNote: () => 'Soul of the Forge: +1 AC in heavy armor; resistance to fire damage',
    }, { subclass: 'Forge' });

    register('cleric', 'Divine Strike (Forge)', 8, {
        promptNote: (stats) => `Divine Strike: +${stats.level >= 14 ? '2d8' : '1d8'} fire damage on weapon hit once/turn`,
    }, { subclass: 'Forge' });

    register('cleric', 'Saint of Forge and Fire', 17, {
        promptNote: () => 'Saint of Forge and Fire: Immunity to fire damage; resistance to nonmagical bludgeoning/piercing/slashing in heavy armor',
    }, { subclass: 'Forge' });

    // --- Grave Domain (XGE) ---
    register('cleric', 'Circle of Mortality', 3, {
        promptNote: () => 'Circle of Mortality: Max healing on spells for creatures at 0 HP; Spare the Dying as bonus action at 30ft range',
    }, { subclass: 'Grave' });

    register('cleric', 'Eyes of the Grave', 3, {
        promptNote: (stats) => `Eyes of the Grave: Detect undead within 60ft not behind total cover (${Math.max(1, stats.mods.wis || 0)} uses/LR)`,
    }, { subclass: 'Grave' });

    register('cleric', 'Path to the Grave', 3, {
        promptNote: () => 'Path to the Grave: Channel Divinity — curse creature within 30ft; next attack deals double damage (vulnerability)',
    }, { subclass: 'Grave' });

    register('cleric', 'Sentinel at Death\'s Door', 6, {
        promptNote: (stats) => `Sentinel at Death's Door: Reaction negate a critical hit within 30ft (${Math.max(1, stats.mods.wis || 0)} uses/LR)`,
    }, { subclass: 'Grave' });

    register('cleric', 'Divine Strike (Grave)', 8, {
        promptNote: (stats) => `Divine Strike: +${stats.level >= 14 ? '2d8' : '1d8'} necrotic damage on weapon hit once/turn`,
    }, { subclass: 'Grave' });

    register('cleric', 'Keeper of Souls', 17, {
        promptNote: () => 'Keeper of Souls: When creature within 60ft dies, you or ally within 60ft regains HP equal to the creature\'s HD',
    }, { subclass: 'Grave' });
}

// ============================================================
// DRUID SUBCLASSES
// ============================================================

function registerDruid() {
// --- Circle of the Land (XPHB) ---
    register('druid', 'Land\'s Aid', 3, {
        promptNote: () => 'Land\'s Aid: Spend Wild Shape use to heal allies in 10ft for 2d6 (free action)',
    }, { subclass: 'Land' });

    register('druid', 'Natural Recovery', 6, {
        promptNote: (stats) => `Natural Recovery: Recover up to ${Math.ceil(stats.level / 2)} levels of spell slots on short rest (1/LR)`,
    }, { subclass: 'Land' });

    register('druid', 'Nature\'s Ward', 10, {
        promptNote: () => 'Nature\'s Ward: Immune to poison, disease; can\'t be frightened/charmed by elementals/fey',
    }, { subclass: 'Land' });

    register('druid', 'Nature\'s Sanctuary', 14, {
        promptNote: () => 'Nature\'s Sanctuary: Beasts and plants must WIS save to target you with attacks; on fail choose new target',
    }, { subclass: 'Land' });

    // --- Circle of the Moon (XPHB) ---
    register('druid', 'Combat Wild Shape', 3, {
        promptNote: () => 'Combat Wild Shape: Wild Shape as bonus action; can spend spell slots for 1d8/slot healing while transformed',
    }, { subclass: 'Moon' });

    register('druid', 'Circle Forms', 3, {
        promptNote: (stats) => {
            const cr = stats.level >= 18 ? 6 : stats.level >= 15 ? 5 : stats.level >= 12 ? 4 : stats.level >= 9 ? 3 : stats.level >= 6 ? 2 : 1;
            return `Circle Forms: Wild Shape into beasts up to CR ${cr}`;
        },
    }, { subclass: 'Moon' });

    register('druid', 'Moonlight Step', 6, {
        promptNote: () => 'Moonlight Step: Bonus action teleport 30ft to unoccupied space you can see; adjacent ally regains 1d10 HP',
    }, { subclass: 'Moon' });

    register('druid', 'Lunar Form', 10, {
        promptNote: () => 'Lunar Form: While in Wild Shape, add 2d10 radiant to one attack per turn; resistance to radiant',
    }, { subclass: 'Moon' });

    register('druid', 'Thousand Forms', 14, {
        promptNote: () => 'Thousand Forms: Cast Alter Self at will; use Wild Shape to become CR 6 beast',
    }, { subclass: 'Moon' });

    // --- Circle of the Sea (XPHB) ---
    register('druid', 'Wrath of the Sea', 3, {
        promptNote: (stats) => `Wrath of the Sea: Spend Wild Shape use as bonus action: 5ft radius, ${stats.level >= 10 ? '3d6' : stats.level >= 6 ? '2d6' : '1d6'} cold/lightning; CON save or push 15ft/prone`,
    }, { subclass: 'Sea' });

    register('druid', 'Aquatic Affinity', 6, {
        promptNote: () => 'Aquatic Affinity: Swim speed 30ft; can breathe underwater',
        speedBonus: () => 0,
    }, { subclass: 'Sea' });

    register('druid', 'Stormborn', 10, {
        promptNote: () => 'Stormborn: Resistance to cold and lightning; fly speed 30ft outdoors',
    }, { subclass: 'Sea' });

    register('druid', 'Oceanic Gift', 14, {
        promptNote: () => 'Oceanic Gift: When you deal cold/lightning with Wrath of the Sea, grant allies in area temp HP equal to druid level',
    }, { subclass: 'Sea' });

    // --- Circle of the Stars (XPHB) ---
    register('druid', 'Star Map', 3, {
        promptNote: () => 'Star Map: Guidance cantrip + Guiding Bolt always prepared; cast Guiding Bolt free PB/LR',
    }, { subclass: 'Stars' });

    register('druid', 'Starry Form', 3, {
        promptNote: () => 'Starry Form: Spend Wild Shape use as bonus action to assume starry form (Archer/Chalice/Dragon) for 10 min',
    }, { subclass: 'Stars' });

    register('druid', 'Cosmic Omen', 6, {
        promptNote: () => 'Cosmic Omen: After LR, roll die — Weal or Woe; reaction add/subtract 1d6 to ally/enemy roll within 30ft (PB/LR)',
    }, { subclass: 'Stars' });

    register('druid', 'Twinkling Constellations', 10, {
        promptNote: () => 'Twinkling Constellations: Starry Form constellation improves; can change form at start of each turn',
    }, { subclass: 'Stars' });

    register('druid', 'Full of Stars', 14, {
        promptNote: () => 'Full of Stars: While in Starry Form, resistance to bludgeoning/piercing/slashing',
    }, { subclass: 'Stars' });

    // --- Circle of Dreams (XGE) ---
    register('druid', 'Balm of the Summer Court', 3, {
        promptNote: (stats) => `Balm of the Summer Court: Pool of ${stats.level}d6 healing dice; bonus action heal ally within 120ft + temp HP`,
    }, { subclass: 'Dreams' });

    register('druid', 'Hearth of Moonlight and Shadow', 6, {
        promptNote: () => 'Hearth of Moonlight and Shadow: During rest, create 30ft warded area — +5 Stealth/Perception, dim light',
    }, { subclass: 'Dreams' });

    register('druid', 'Hidden Paths', 10, {
        promptNote: (stats) => `Hidden Paths: Teleport 60ft as bonus action or touch ally 30ft (${Math.max(1, stats.mods.wis || 0)} uses/LR)`,
    }, { subclass: 'Dreams' });

    register('druid', 'Walker in Dreams', 14, {
        promptNote: () => 'Walker in Dreams: Cast Dream, Scrying, or Teleportation Circle (to last LR location) free 1/LR',
    }, { subclass: 'Dreams' });

    // --- Circle of the Shepherd (XGE) ---
    register('druid', 'Spirit Totem', 3, {
        promptNote: () => 'Spirit Totem: Bonus action summon spirit (Bear: temp HP / Hawk: advantage on perception + advantage attacks vs enemies in aura / Unicorn: advantage heal in aura)',
    }, { subclass: 'Shepherd' });

    register('druid', 'Mighty Summoner', 6, {
        promptNote: () => 'Mighty Summoner: Summoned beasts/fey have +2 HP per HD and attacks count as magical',
    }, { subclass: 'Shepherd' });

    register('druid', 'Guardian Spirit', 10, {
        promptNote: (stats) => `Guardian Spirit: Summoned beasts/fey in Spirit Totem aura regain ${Math.floor(stats.level / 2)} HP at end of your turn`,
    }, { subclass: 'Shepherd' });

    register('druid', 'Faithful Summons', 14, {
        promptNote: () => 'Faithful Summons: When reduced to 0 HP, summon 4 beasts (CR 2) that defend you (1/LR)',
    }, { subclass: 'Shepherd' });
}

// ============================================================
// FIGHTER SUBCLASSES
// ============================================================

function registerFighter() {
// --- Battle Master (XPHB) ---
    register('fighter', 'Combat Superiority', 3, {
        promptNote: (stats) => {
            const dice = stats.level >= 15 ? 6 : stats.level >= 7 ? 5 : 4;
            const die = stats.level >= 18 ? 'd12' : stats.level >= 10 ? 'd10' : 'd8';
            return `Combat Superiority: ${dice} superiority dice (${die}), regain on short rest; DC ${8 + stats.proficiency + Math.max(stats.mods.str || 0, stats.mods.dex || 0)}`;
        },
    }, { subclass: 'Battle Master' });

    register('fighter', 'Know Your Enemy', 7, {
        promptNote: () => 'Know Your Enemy: Study creature 1 min to learn 2 characteristics (relative stats comparison)',
    }, { subclass: 'Battle Master' });

    register('fighter', 'Relentless', 15, {
        promptNote: () => 'Relentless: If you have no superiority dice at initiative, regain 1',
    }, { subclass: 'Battle Master' });

    // --- Champion (XPHB) ---
    register('fighter', 'Improved Critical', 3, {
        promptNote: () => 'Improved Critical: Weapon attacks crit on 19-20',
    }, { subclass: 'Champion' });

    register('fighter', 'Remarkable Athlete', 7, {
        promptNote: () => 'Remarkable Athlete: Advantage on Athletics/Acrobatics; running long jump +STR ft without running start',
    }, { subclass: 'Champion' });

    register('fighter', 'Superior Critical', 15, {
        promptNote: () => 'Superior Critical: Weapon attacks crit on 18-20',
    }, { subclass: 'Champion' });

    register('fighter', 'Survivor', 18, {
        promptNote: (stats) => `Survivor: At start of turn, regain 5 + CON mod (${5 + (stats.mods.con || 0)}) HP if at or below half HP`,
    }, { subclass: 'Champion' });

    // --- Psi Warrior (XPHB) ---
    register('fighter', 'Psionic Power', 3, {
        promptNote: (stats) => {
            const die = stats.level >= 11 ? 'd10' : stats.level >= 5 ? 'd8' : 'd6';
            return `Psionic Power: ${stats.proficiency * 2} Psionic Energy dice (${die}), regain all on LR, 1 on SR; Protective Field (reduce damage), Psionic Strike (+die force), Telekinetic Movement (move/pull objects)`;
        },
    }, { subclass: 'Psi Warrior' });

    register('fighter', 'Telekinetic Adept', 7, {
        promptNote: () => 'Telekinetic Adept: Psi-Powered Leap (fly PB*10ft) + Telekinetic Thrust (push 10ft/prone on Psionic Strike)',
    }, { subclass: 'Psi Warrior' });

    register('fighter', 'Guarded Mind', 10, {
        promptNote: () => 'Guarded Mind: Resistance to psychic; end charmed/frightened by spending Psionic Energy die',
    }, { subclass: 'Psi Warrior' });

    register('fighter', 'Bulwark of Force', 15, {
        promptNote: () => 'Bulwark of Force: Bonus action grant half cover to PB creatures within 30ft for 1 min (1/LR or 1 die)',
    }, { subclass: 'Psi Warrior' });

    register('fighter', 'Telekinetic Master', 18, {
        promptNote: () => 'Telekinetic Master: Cast Telekinesis without slot (concentration); bonus action make weapon attack while concentrating (1/LR)',
    }, { subclass: 'Psi Warrior' });

    // --- Arcane Archer (XGE) ---
    register('fighter', 'Arcane Shot', 3, {
        promptNote: (stats) => `Arcane Shot: 2 uses/SR (${stats.level >= 18 ? '4d6' : stats.level >= 11 ? '3d6' : '2d6'} damage); apply Arcane Shot option to arrow`,
    }, { subclass: 'Arcane Archer' });

    register('fighter', 'Magic Arrow', 7, {
        promptNote: () => 'Magic Arrow: Nonmagical arrows become magical for overcoming resistance',
    }, { subclass: 'Arcane Archer' });

    register('fighter', 'Curving Shot', 7, {
        promptNote: () => 'Curving Shot: When you miss with magic arrow, redirect to new target within 60ft (new attack roll with bonus)',
    }, { subclass: 'Arcane Archer' });

    register('fighter', 'Ever-Ready Shot', 15, {
        promptNote: () => 'Ever-Ready Shot: If you have no Arcane Shot uses when rolling initiative, regain 1',
    }, { subclass: 'Arcane Archer' });

    // --- Cavalier (XGE) ---
    register('fighter', 'Born to the Saddle', 3, {
        promptNote: () => 'Born to the Saddle: Advantage on saves vs falling off mount; mount/dismount costs 5ft; land on feet if fall < 10ft',
    }, { subclass: 'Cavalier' });

    register('fighter', 'Unwavering Mark', 3, {
        promptNote: (stats) => `Unwavering Mark: When you hit, mark target until end of next turn; disadvantage on attacks vs others; if it attacks other, bonus action attack with +${Math.max(1, stats.mods.str || 0)} damage (${Math.max(1, stats.mods.str || 0)} uses/LR)`,
    }, { subclass: 'Cavalier' });

    register('fighter', 'Warding Maneuver', 7, {
        promptNote: (stats) => `Warding Maneuver: Reaction when you or adjacent ally hit — +1d8 AC; if still hits, target gains resistance (${Math.max(1, stats.mods.con || 0)} uses/LR)`,
    }, { subclass: 'Cavalier' });

    register('fighter', 'Hold the Line', 10, {
        promptNote: () => 'Hold the Line: OA when creature moves within reach (not just leaves); hit reduces speed to 0',
    }, { subclass: 'Cavalier' });

    register('fighter', 'Ferocious Charger', 15, {
        promptNote: () => 'Ferocious Charger: If move 10+ft straight, bonus action after Attack action to shove prone (Athletics)',
    }, { subclass: 'Cavalier' });

    register('fighter', 'Vigilant Defender', 18, {
        promptNote: () => 'Vigilant Defender: Special reaction on every other creature\'s turn for OA (not your turn)',
    }, { subclass: 'Cavalier' });

    // --- Samurai (XGE) ---
    register('fighter', 'Fighting Spirit', 3, {
        promptNote: (stats) => `Fighting Spirit: Bonus action gain advantage on all weapon attacks this turn + ${stats.level >= 15 ? 15 : stats.level >= 10 ? 10 : 5} temp HP (3 uses/LR)`,
    }, { subclass: 'Samurai' });

    register('fighter', 'Elegant Courtier', 7, {
        promptNote: (stats) => `Elegant Courtier: Add WIS (+${stats.mods.wis || 0}) to CHA (Persuasion) checks; proficiency in WIS saves (or INT/CHA if already)`,
    }, { subclass: 'Samurai' });

    register('fighter', 'Tireless Spirit', 10, {
        promptNote: () => 'Tireless Spirit: If no Fighting Spirit uses when rolling initiative, regain 1',
    }, { subclass: 'Samurai' });

    register('fighter', 'Rapid Strike', 15, {
        promptNote: () => 'Rapid Strike: Once per turn, forgo advantage on weapon attack to make one extra attack',
    }, { subclass: 'Samurai' });

    register('fighter', 'Strength Before Death', 18, {
        promptNote: () => 'Strength Before Death: When reduced to 0 HP, take a full turn immediately (then fall unconscious if still at 0); 1/LR',
    }, { subclass: 'Samurai' });
}

// ============================================================
// MONK SUBCLASSES
// ============================================================

function registerMonk() {
// --- Way of Mercy (XPHB) ---
    register('monk', 'Hands of Healing', 3, {
        promptNote: (stats) => `Hands of Healing: Spend 1 ki + Flurry: heal 1 Martial Arts die + WIS (+${stats.mods.wis || 0}) to touched creature; remove disease/poison at L6`,
    }, { subclass: 'Mercy' });

    register('monk', 'Hands of Harm', 3, {
        promptNote: () => 'Hands of Harm: On Flurry hit, spend 1 ki for +1 Martial Arts die necrotic + poisoned (CON save)',
    }, { subclass: 'Mercy' });

    register('monk', 'Physician\'s Touch', 6, {
        promptNote: () => 'Physician\'s Touch: Hands of Healing removes blinded, deafened, paralyzed, poisoned, or stunned',
    }, { subclass: 'Mercy' });

    register('monk', 'Flurry of Healing and Harm', 11, {
        promptNote: () => 'Flurry of Healing and Harm: Replace Flurry attacks with Hands of Healing (no ki cost); Hands of Harm no longer costs extra ki on Flurry',
    }, { subclass: 'Mercy' });

    register('monk', 'Hand of Ultimate Mercy', 17, {
        promptNote: () => 'Hand of Ultimate Mercy: Touch dead creature (dead < 24hr), spend 5 ki to revive with 4d10 + WIS HP (1/LR)',
    }, { subclass: 'Mercy' });

    // --- Way of Shadow (XPHB) ---
    register('monk', 'Shadow Arts', 3, {
        promptNote: () => 'Shadow Arts: Spend 2 ki to cast Darkness, Darkvision, Pass without Trace, or Silence (no components)',
    }, { subclass: 'Shadow' });

    register('monk', 'Shadow Step', 6, {
        promptNote: () => 'Shadow Step: Bonus action teleport 60ft from dim light/darkness to dim light/darkness; advantage on first melee attack',
    }, { subclass: 'Shadow' });

    register('monk', 'Improved Shadow Step', 11, {
        promptNote: () => 'Improved Shadow Step: Shadow Step costs no movement; can bring one willing creature',
    }, { subclass: 'Shadow' });

    register('monk', 'Cloak of Shadows', 17, {
        promptNote: () => 'Cloak of Shadows: Action to become invisible in dim light/darkness until you attack, cast, or enter bright light',
    }, { subclass: 'Shadow' });

    // --- Way of the Elements (XPHB) ---
    register('monk', 'Elemental Attunement', 3, {
        promptNote: () => 'Elemental Attunement: Choose element each turn; unarmed strike changes to chosen damage type; reach +10ft; bonus effects with ki',
    }, { subclass: 'Elements' });

    register('monk', 'Environmental Burst', 6, {
        promptNote: (stats) => `Environmental Burst: Spend 2 ki, 20ft radius: 3d6 chosen element damage (DEX save DC ${8 + stats.proficiency + (stats.mods.wis || 0)})`,
    }, { subclass: 'Elements' });

    register('monk', 'Stride of the Elements', 11, {
        promptNote: () => 'Stride of the Elements: Gain fly speed = walking speed (or swim) for the turn when using Step of the Wind',
    }, { subclass: 'Elements' });

    register('monk', 'Elemental Epitome', 17, {
        promptNote: () => 'Elemental Epitome: Spend 3 ki for 1 min: resistance to chosen element, reach +10ft on unarmed, bonus die on hits, bonus action burst',
    }, { subclass: 'Elements' });

    // --- Way of the Open Hand (XPHB) ---
    register('monk', 'Open Hand Technique', 3, {
        promptNote: () => 'Open Hand Technique: On Flurry hit, target knocked prone (DEX save), pushed 15ft (STR save), or can\'t take reactions',
    }, { subclass: 'Open Hand' });

    register('monk', 'Wholeness of Body', 6, {
        promptNote: (stats) => `Wholeness of Body: Bonus action regain ${stats.level} + Martial Arts die HP (1/LR or 2 ki)`,
    }, { subclass: 'Open Hand' });

    register('monk', 'Fleet Step', 11, {
        promptNote: () => 'Fleet Step: Step of the Wind is free (no ki cost)',
    }, { subclass: 'Open Hand' });

    register('monk', 'Quivering Palm', 17, {
        promptNote: () => 'Quivering Palm: Spend 4 ki on hit; anytime within days, action to deal 10d12 necrotic or drop to 0 HP (CON save)',
    }, { subclass: 'Open Hand' });

    // --- Way of the Drunken Master (XGE) ---
    register('monk', 'Drunken Technique', 3, {
        promptNote: () => 'Drunken Technique: Flurry of Blows grants Disengage + 10ft bonus speed for the turn',
    }, { subclass: 'Drunken Master' });

    register('monk', 'Tipsy Sway', 6, {
        promptNote: () => 'Tipsy Sway: When prone, stand for 5ft; when missed in melee, redirect to adjacent creature (same attack roll)',
    }, { subclass: 'Drunken Master' });

    register('monk', 'Drunkard\'s Luck', 11, {
        promptNote: () => 'Drunkard\'s Luck: When you have disadvantage, spend 2 ki to cancel it',
    }, { subclass: 'Drunken Master' });

    register('monk', 'Intoxicated Frenzy', 17, {
        promptNote: () => 'Intoxicated Frenzy: Flurry of Blows makes up to 5 attacks if each targets a different creature',
    }, { subclass: 'Drunken Master' });

    // --- Way of the Sun Soul (XGE) ---
    register('monk', 'Radiant Sun Bolt', 3, {
        promptNote: (stats) => 'Radiant Sun Bolt: Ranged 30ft attack using Martial Arts die + DEX for radiant; spend 1 ki for 2 bonus bolts',
    }, { subclass: 'Sun Soul' });

    register('monk', 'Searing Arc Strike', 6, {
        promptNote: () => 'Searing Arc Strike: After Attack action, spend 2+ ki to cast Burning Hands (3+ for higher level)',
    }, { subclass: 'Sun Soul' });

    register('monk', 'Searing Sunburst', 11, {
        promptNote: (stats) => `Searing Sunburst: Action 20ft radius at 150ft range: 2d6 radiant (CON save DC ${8 + stats.proficiency + (stats.mods.wis || 0)}); spend ki for +2d6 each`,
    }, { subclass: 'Sun Soul' });

    register('monk', 'Sun Shield', 17, {
        promptNote: (stats) => `Sun Shield: Emit 30ft bright light (toggle); when hit in melee, deal ${5 + (stats.mods.wis || 0)} radiant`,
    }, { subclass: 'Sun Soul' });
}

// ============================================================
// PALADIN SUBCLASSES
// ============================================================

function registerPaladin() {
// --- Oath of Devotion (XPHB) ---
    register('paladin', 'Sacred Weapon', 3, {
        promptNote: (stats) => `Sacred Weapon: Channel Divinity, weapon gains +${Math.max(1, stats.mods.cha || 0)} to attack for 10 min + emits light`,
    }, { subclass: 'Devotion' });

    register('paladin', 'Aura of Devotion', 7, {
        promptNote: (stats) => `Aura of Devotion: You and allies within ${stats.level >= 18 ? 30 : 10}ft can't be charmed`,
    }, { subclass: 'Devotion' });

    register('paladin', 'Smite of Protection', 14, {
        promptNote: () => 'Smite of Protection: After Divine Smite, give target or ally within 30ft PB temp HP',
    }, { subclass: 'Devotion' });

    register('paladin', 'Holy Nimbus', 20, {
        promptNote: () => 'Holy Nimbus: Action 10ft aura for 1 min: 10 radiant to enemies; advantage on saves vs fiend/undead spells (1/LR)',
    }, { subclass: 'Devotion' });

    // --- Oath of Glory (XPHB) ---
    register('paladin', 'Peerless Athlete', 3, {
        promptNote: () => 'Peerless Athlete: Channel Divinity for 10 min: advantage Athletics/Acrobatics, +10ft jump, +10ft carrying capacity',
    }, { subclass: 'Glory' });

    register('paladin', 'Inspiring Smite', 3, {
        promptNote: () => 'Inspiring Smite: After Divine Smite, distribute 2d8 + spell level temp HP among creatures within 30ft',
    }, { subclass: 'Glory' });

    register('paladin', 'Aura of Alacrity', 7, {
        promptNote: (stats) => `Aura of Alacrity: Your speed +10ft; allies starting turn within ${stats.level >= 18 ? 30 : 10}ft get +10ft speed`,
    }, { subclass: 'Glory' });

    register('paladin', 'Living Legend', 20, {
        promptNote: () => 'Living Legend: Bonus action for 10 min: advantage CHA checks, miss→hit once/turn, advantage on saves vs magical effects (1/LR)',
    }, { subclass: 'Glory' });

    // --- Oath of the Ancients (XPHB) ---
    register('paladin', 'Nature\'s Wrath', 3, {
        promptNote: () => 'Nature\'s Wrath: Channel Divinity to restrain creature within 10ft with vines (STR/DEX save)',
    }, { subclass: 'Ancients' });

    register('paladin', 'Aura of Warding', 7, {
        promptNote: (stats) => `Aura of Warding: You and allies within ${stats.level >= 18 ? 30 : 10}ft have resistance to spell damage`,
    }, { subclass: 'Ancients' });

    register('paladin', 'Undying Sentinel', 14, {
        promptNote: () => 'Undying Sentinel: When reduced to 0 HP, drop to 1 instead (1/LR); no aging penalties',
    }, { subclass: 'Ancients' });

    register('paladin', 'Elder Champion', 20, {
        promptNote: () => 'Elder Champion: Transform for 1 min: regain 10 HP/turn, spells as bonus action, enemies within 10ft disadvantage on saves (1/LR)',
    }, { subclass: 'Ancients' });

    // --- Oath of Vengeance (XPHB) ---
    register('paladin', 'Vow of Enmity', 3, {
        promptNote: () => 'Vow of Enmity: Channel Divinity, bonus action: advantage on attacks vs one creature within 30ft for 1 min',
    }, { subclass: 'Vengeance' });

    register('paladin', 'Relentless Avenger', 7, {
        promptNote: () => 'Relentless Avenger: When OA hits, move up to half speed toward target (no OA) immediately after',
    }, { subclass: 'Vengeance' });

    register('paladin', 'Soul of Vengeance', 14, {
        promptNote: () => 'Soul of Vengeance: When Vow of Enmity target attacks, reaction melee against it',
    }, { subclass: 'Vengeance' });

    register('paladin', 'Avenging Angel', 20, {
        promptNote: () => 'Avenging Angel: Transform for 1 hr: 60ft fly, 30ft aura of menace (frightened, WIS save) (1/LR)',
    }, { subclass: 'Vengeance' });

    // --- Oath of Conquest (XGE) ---
    register('paladin', 'Conquering Presence', 3, {
        promptNote: () => 'Conquering Presence: Channel Divinity — each creature of your choice within 30ft makes WIS save or is frightened for 1 min',
    }, { subclass: 'Conquest' });

    register('paladin', 'Guided Strike (Conquest)', 3, {
        promptNote: () => 'Guided Strike: Channel Divinity to add +10 to attack roll',
    }, { subclass: 'Conquest' });

    register('paladin', 'Aura of Conquest', 7, {
        promptNote: (stats) => `Aura of Conquest: Frightened creatures within ${stats.level >= 18 ? 30 : 10}ft have speed 0 and take psychic damage = half paladin level`,
    }, { subclass: 'Conquest' });

    register('paladin', 'Scornful Rebuke', 15, {
        promptNote: (stats) => `Scornful Rebuke: When you are hit, attacker takes ${Math.max(1, stats.mods.cha || 0)} psychic damage`,
    }, { subclass: 'Conquest' });

    register('paladin', 'Invincible Conqueror', 20, {
        promptNote: () => 'Invincible Conqueror: Transform for 1 min: resistance all damage, extra attack on Attack action, crit on 19-20 (1/LR)',
    }, { subclass: 'Conquest' });

    // --- Oath of Redemption (XGE) ---
    register('paladin', 'Emissary of Peace', 3, {
        promptNote: () => 'Emissary of Peace: Channel Divinity for +5 to Persuasion checks for 10 min',
    }, { subclass: 'Redemption' });

    register('paladin', 'Rebuke the Violent', 3, {
        promptNote: () => 'Rebuke the Violent: Channel Divinity — when creature deals damage to another within 30ft, attacker takes equal radiant (CHA save half)',
    }, { subclass: 'Redemption' });

    register('paladin', 'Aura of the Guardian', 7, {
        promptNote: (stats) => `Aura of the Guardian: Reaction take damage instead of ally within ${stats.level >= 18 ? 30 : 10}ft`,
    }, { subclass: 'Redemption' });

    register('paladin', 'Protective Spirit', 15, {
        promptNote: (stats) => `Protective Spirit: At end of turn if below half HP, regain 1d6 + ${Math.floor(stats.level / 2)} HP`,
    }, { subclass: 'Redemption' });

    register('paladin', 'Emissary of Redemption', 20, {
        promptNote: () => 'Emissary of Redemption: Resistance to all damage from creatures; when hit, attacker takes equal radiant (lost if you attack/cast on them)',
    }, { subclass: 'Redemption' });
}

// ============================================================
// RANGER SUBCLASSES
// ============================================================

function registerRanger() {
// --- Beast Master (XPHB) ---
    register('ranger', 'Primal Companion', 3, {
        promptNote: () => 'Primal Companion: Command beast companion to attack (your bonus action); companion acts on your initiative',
    }, { subclass: 'Beast Master' });

    register('ranger', 'Exceptional Training', 7, {
        promptNote: () => 'Exceptional Training: Companion\'s attacks count as magical; Dash/Disengage/Dodge as bonus action',
    }, { subclass: 'Beast Master' });

    register('ranger', 'Bestial Fury', 11, {
        promptNote: () => 'Bestial Fury: When you command companion to attack, it makes 2 attacks',
    }, { subclass: 'Beast Master' });

    register('ranger', 'Share Spells', 15, {
        promptNote: () => 'Share Spells: When you cast a self-targeting spell, companion also benefits if within 30ft',
    }, { subclass: 'Beast Master' });

    // --- Fey Wanderer (XPHB) ---
    register('ranger', 'Dreadful Strikes', 3, {
        promptNote: (stats) => `Dreadful Strikes: First hit per turn +1d4 psychic (scales to +${stats.level >= 11 ? '1d6' : '1d4'})`,
    }, { subclass: 'Fey Wanderer' });

    register('ranger', 'Otherworldly Glamour', 3, {
        promptNote: (stats) => `Otherworldly Glamour: Add WIS (+${stats.mods.wis || 0}) to CHA checks`,
    }, { subclass: 'Fey Wanderer' });

    register('ranger', 'Beguiling Twist', 7, {
        promptNote: () => 'Beguiling Twist: Advantage on saves vs charmed/frightened; when you or ally saves, reaction to charm/frighten another within 120ft',
    }, { subclass: 'Fey Wanderer' });

    register('ranger', 'Fey Reinforcements', 11, {
        promptNote: () => 'Fey Reinforcements: Cast Summon Fey without slot (1/LR); can concentrate on it + another ranger spell',
    }, { subclass: 'Fey Wanderer' });

    register('ranger', 'Misty Wanderer', 15, {
        promptNote: () => 'Misty Wanderer: Cast Misty Step free PB/LR; can bring one willing creature within 5ft',
    }, { subclass: 'Fey Wanderer' });

    // --- Gloom Stalker (XPHB) ---
    register('ranger', 'Dread Ambusher', 3, {
        promptNote: () => 'Dread Ambusher: First turn of combat: +10ft speed, extra weapon attack for +1d8 damage; initiative + WIS mod',
    }, { subclass: 'Gloom Stalker' });

    register('ranger', 'Umbral Sight', 3, {
        promptNote: () => 'Umbral Sight: Darkvision 60ft (or +60ft); invisible to darkvision in darkness',
    }, { subclass: 'Gloom Stalker' });

    register('ranger', 'Iron Mind', 7, {
        promptNote: () => 'Iron Mind: Proficiency in WIS saves (or INT/CHA if already proficient)',
    }, { subclass: 'Gloom Stalker' });

    register('ranger', 'Stalker\'s Flurry', 11, {
        promptNote: () => 'Stalker\'s Flurry: When you miss, immediately make another weapon attack against same target',
    }, { subclass: 'Gloom Stalker' });

    register('ranger', 'Shadowy Dodge', 15, {
        promptNote: () => 'Shadowy Dodge: Reaction when attacked, impose disadvantage (no resource)',
    }, { subclass: 'Gloom Stalker' });

    // --- Hunter (XPHB) ---
    register('ranger', 'Hunter\'s Prey', 3, {
        promptNote: () => 'Hunter\'s Prey: Chosen specialization (Colossus Slayer/Giant Killer/Horde Breaker)',
    }, { subclass: 'Hunter' });

    register('ranger', 'Defensive Tactics', 7, {
        promptNote: () => 'Defensive Tactics: Chosen defense (Escape Horde/Multiattack Defense/Steel Will)',
    }, { subclass: 'Hunter' });

    register('ranger', 'Superior Hunter\'s Defense', 11, {
        promptNote: () => 'Superior Hunter\'s Defense: Evasion or Stand Against the Tide or Uncanny Dodge',
    }, { subclass: 'Hunter' });

    // --- Horizon Walker (XGE) ---
    register('ranger', 'Detect Portal', 3, {
        promptNote: () => 'Detect Portal: Action to detect planar portals within 1 mile (1/SR)',
    }, { subclass: 'Horizon Walker' });

    register('ranger', 'Planar Warrior', 3, {
        promptNote: (stats) => `Planar Warrior: Bonus action, one creature within 30ft — next hit is force damage +${stats.level >= 11 ? '2d8' : '1d8'}`,
    }, { subclass: 'Horizon Walker' });

    register('ranger', 'Ethereal Step', 7, {
        promptNote: () => 'Ethereal Step: Bonus action step into Ethereal Plane until end of turn (1/SR)',
    }, { subclass: 'Horizon Walker' });

    register('ranger', 'Distant Strike', 11, {
        promptNote: () => 'Distant Strike: Teleport 10ft before each attack on Attack action; if attack 2+ creatures, make one extra attack',
    }, { subclass: 'Horizon Walker' });

    register('ranger', 'Spectral Defense', 15, {
        promptNote: () => 'Spectral Defense: Reaction when hit, gain resistance to that attack\'s damage',
    }, { subclass: 'Horizon Walker' });

    // --- Monster Slayer (XGE) ---
    register('ranger', 'Hunter\'s Sense', 3, {
        promptNote: () => 'Hunter\'s Sense: Action learn vulnerabilities, immunities, resistances of one creature within 60ft (WIS mod uses/LR)',
    }, { subclass: 'Monster Slayer' });

    register('ranger', 'Slayer\'s Prey', 3, {
        promptNote: () => 'Slayer\'s Prey: Bonus action designate creature within 60ft — +1d6 first hit each turn (until SR or new target)',
    }, { subclass: 'Monster Slayer' });

    register('ranger', 'Supernatural Defense', 7, {
        promptNote: () => 'Supernatural Defense: When Slayer\'s Prey forces save or grapple, add 1d6 to your roll',
    }, { subclass: 'Monster Slayer' });

    register('ranger', 'Magic-User\'s Nemesis', 11, {
        promptNote: () => 'Magic-User\'s Nemesis: Reaction when Slayer\'s Prey casts spell or teleports, force WIS save or waste the action (1/SR)',
    }, { subclass: 'Monster Slayer' });

    register('ranger', 'Slayer\'s Counter', 15, {
        promptNote: () => 'Slayer\'s Counter: Reaction when Slayer\'s Prey forces you to save — attack it first; if hit, auto-succeed the save',
    }, { subclass: 'Monster Slayer' });
}

// ============================================================
// ROGUE SUBCLASSES
// ============================================================

function registerRogue() {
// --- Assassin (XPHB) ---
    register('rogue', 'Assassinate', 3, {
        promptNote: () => 'Assassinate: Advantage on attacks vs creatures that haven\'t acted; hits against surprised creatures are critical hits',
    }, { subclass: 'Assassin' });

    register('rogue', 'Infiltration Expertise', 9, {
        promptNote: () => 'Infiltration Expertise: Create false identity with backstory, documentation, and disguise over 25gp/7 days',
    }, { subclass: 'Assassin' });

    register('rogue', 'Envenom Weapons', 13, {
        promptNote: (stats) => `Envenom Weapons: Bonus action apply poison to weapon — next hit +2d6 poison and poisoned (CON save DC ${8 + stats.proficiency + (stats.mods.int || 0)}) (PB uses/LR)`,
    }, { subclass: 'Assassin' });

    register('rogue', 'Death Strike', 17, {
        promptNote: (stats) => `Death Strike: When you hit surprised creature, it must CON save DC ${8 + stats.proficiency + (stats.mods.dex || 0)} or take double damage`,
    }, { subclass: 'Assassin' });

    // --- Soulknife (XPHB) ---
    register('rogue', 'Psionic Power', 3, {
        promptNote: (stats) => {
            const die = stats.level >= 17 ? 'd12' : stats.level >= 11 ? 'd10' : stats.level >= 5 ? 'd8' : 'd6';
            return `Psionic Power: ${stats.proficiency * 2} Psionic Energy dice (${die}); Psi-Bolstered Knack (add to failed check), Psychic Whispers (telepathy)`;
        },
    }, { subclass: 'Soulknife' });

    register('rogue', 'Psychic Blades', 3, {
        promptNote: (stats) => 'Psychic Blades: Summon psychic blade (1d6 + DEX/STR, thrown 60ft); bonus action off-hand blade (1d4); count as finesse for Sneak Attack',
    }, { subclass: 'Soulknife' });

    register('rogue', 'Soul Blades', 9, {
        promptNote: () => 'Soul Blades: Homing Strikes (add die to missed attack), Psychic Teleportation (throw blade to teleport die*10ft)',
    }, { subclass: 'Soulknife' });

    register('rogue', 'Psychic Veil', 13, {
        promptNote: () => 'Psychic Veil: Action become invisible for 1hr or until you damage/force save (1/LR or 1 die)',
    }, { subclass: 'Soulknife' });

    register('rogue', 'Rend Mind', 17, {
        promptNote: (stats) => `Rend Mind: When Psychic Blade + Sneak Attack, target WIS save DC ${8 + stats.proficiency + (stats.mods.dex || 0)} or stunned for 1 min (1/LR or 3 dice)`,
    }, { subclass: 'Soulknife' });

    // --- Thief (XPHB) ---
    register('rogue', 'Fast Hands', 3, {
        promptNote: () => 'Fast Hands: Bonus action Use Object, Sleight of Hand, thieves\' tools',
    }, { subclass: 'Thief' });

    register('rogue', 'Second-Story Work', 3, {
        promptNote: () => 'Second-Story Work: Climb speed = walking speed; running jump +DEX mod ft',
    }, { subclass: 'Thief' });

    register('rogue', 'Supreme Sneak', 9, {
        promptNote: () => 'Supreme Sneak: Advantage on Stealth if you move no more than half speed',
    }, { subclass: 'Thief' });

    register('rogue', 'Use Magic Device', 13, {
        promptNote: () => 'Use Magic Device: Ignore class/race/level requirements for magic items; attune to 4 items',
    }, { subclass: 'Thief' });

    register('rogue', 'Thief\'s Reflexes', 17, {
        promptNote: () => 'Thief\'s Reflexes: Two turns in first round of combat (second at initiative - 10)',
    }, { subclass: 'Thief' });

    // --- Arcane Trickster (XPHB) --- (base already registered in classEffects)
    register('rogue', 'Mage Hand Legerdemain', 3, {
        promptNote: () => 'Mage Hand Legerdemain: Invisible Mage Hand; bonus action to control; plant/retrieve objects, pick locks, disarm traps at range',
    }, { subclass: 'Arcane Trickster' });

    register('rogue', 'Magical Ambush', 9, {
        promptNote: () => 'Magical Ambush: When hidden and cast spell, targets have disadvantage on saves',
    }, { subclass: 'Arcane Trickster' });

    register('rogue', 'Versatile Trickster', 13, {
        promptNote: () => 'Versatile Trickster: Bonus action Mage Hand grants you advantage on attack vs creature within 5ft of hand',
    }, { subclass: 'Arcane Trickster' });

    register('rogue', 'Spell Thief', 17, {
        promptNote: (stats) => `Spell Thief: Reaction when targeted by spell — caster saves DC ${8 + stats.proficiency + (stats.mods.int || 0)} or spell fails and you know it for 8hr (1/LR)`,
    }, { subclass: 'Arcane Trickster' });

    // --- Inquisitive (XGE) ---
    register('rogue', 'Ear for Deceit', 3, {
        promptNote: () => 'Ear for Deceit: Minimum 8 on Insight checks to determine lies',
    }, { subclass: 'Inquisitive' });

    register('rogue', 'Eye for Detail', 3, {
        promptNote: () => 'Eye for Detail: Bonus action Perception to spot hidden creature or Investigation to find clue',
    }, { subclass: 'Inquisitive' });

    register('rogue', 'Insightful Fighting', 3, {
        promptNote: () => 'Insightful Fighting: Bonus action Insight vs Deception — if succeed, Sneak Attack that target without advantage for 1 min',
    }, { subclass: 'Inquisitive' });

    register('rogue', 'Steady Eye', 9, {
        promptNote: () => 'Steady Eye: Advantage on Perception/Investigation if move no more than half speed',
    }, { subclass: 'Inquisitive' });

    register('rogue', 'Unerring Eye', 13, {
        promptNote: (stats) => `Unerring Eye: Action detect illusions/shapeshifters/magical deception within 30ft (${Math.max(1, stats.mods.wis || 0)} uses/LR)`,
    }, { subclass: 'Inquisitive' });

    register('rogue', 'Eye for Weakness', 17, {
        promptNote: () => 'Eye for Weakness: Insightful Fighting Sneak Attack deals +3d6 damage',
    }, { subclass: 'Inquisitive' });

    // --- Mastermind (XGE) ---
    register('rogue', 'Master of Intrigue', 3, {
        promptNote: () => 'Master of Intrigue: Disguise kit + forgery kit proficiency; mimic speech/accents; 2 extra languages',
    }, { subclass: 'Mastermind' });

    register('rogue', 'Master of Tactics', 3, {
        promptNote: () => 'Master of Tactics: Help action as bonus action, 30ft range',
    }, { subclass: 'Mastermind' });

    register('rogue', 'Insightful Manipulator', 9, {
        promptNote: () => 'Insightful Manipulator: Observe creature 1 min outside combat to learn 2 relative comparisons (INT/WIS/CHA/class levels)',
    }, { subclass: 'Mastermind' });

    register('rogue', 'Misdirection', 13, {
        promptNote: () => 'Misdirection: When targeted by attack while creature provides cover, redirect attack to that creature',
    }, { subclass: 'Mastermind' });

    register('rogue', 'Soul of Deceit', 17, {
        promptNote: () => 'Soul of Deceit: Thoughts can\'t be read; present false thoughts; immune to charm that compels truth',
    }, { subclass: 'Mastermind' });

    // --- Scout (XGE) ---
    register('rogue', 'Skirmisher', 3, {
        promptNote: () => 'Skirmisher: Reaction when enemy ends turn within 5ft, move half speed away (no OA)',
    }, { subclass: 'Scout' });

    register('rogue', 'Survivalist', 3, {
        promptNote: () => 'Survivalist: Proficiency + expertise in Nature and Survival',
    }, { subclass: 'Scout' });

    register('rogue', 'Superior Mobility', 9, {
        promptNote: () => 'Superior Mobility: Speed +10ft; climb/swim speed also +10ft if you have them',
        speedBonus: () => 10,
    }, { subclass: 'Scout' });

    register('rogue', 'Ambush Master', 13, {
        promptNote: () => 'Ambush Master: Advantage on initiative; first creature you hit in first round grants advantage to all attacks against it until start of next turn',
    }, { subclass: 'Scout' });

    register('rogue', 'Sudden Strike', 17, {
        promptNote: () => 'Sudden Strike: If you Attack two different creatures, apply Sneak Attack to both (second at reduced dice)',
    }, { subclass: 'Scout' });

    // --- Swashbuckler (XGE) ---
    register('rogue', 'Fancy Footwork', 3, {
        promptNote: () => 'Fancy Footwork: After melee attack, target can\'t make OA against you (hit or miss)',
    }, { subclass: 'Swashbuckler' });

    register('rogue', 'Rakish Audacity', 3, {
        promptNote: (stats) => `Rakish Audacity: +${Math.max(0, stats.mods.cha || 0)} to initiative; Sneak Attack works 1v1 (no ally/advantage needed) if no other creatures within 5ft of you`,
    }, { subclass: 'Swashbuckler' });

    register('rogue', 'Panache', 9, {
        promptNote: () => 'Panache: Persuasion vs Insight — hostile: disadvantage on attacks vs others, can\'t OA you (1 min); non-hostile: charmed (1 min)',
    }, { subclass: 'Swashbuckler' });

    register('rogue', 'Elegant Maneuver', 13, {
        promptNote: () => 'Elegant Maneuver: Bonus action gain advantage on next Acrobatics/Athletics check this turn',
    }, { subclass: 'Swashbuckler' });

    register('rogue', 'Master Duelist', 17, {
        promptNote: () => 'Master Duelist: When you miss, reroll with advantage (1/SR)',
    }, { subclass: 'Swashbuckler' });
}

// ============================================================
// SORCERER SUBCLASSES
// ============================================================

function registerSorcerer() {
// --- Aberrant Sorcery (XPHB) ---
    register('sorcerer', 'Telepathic Speech', 3, {
        promptNote: () => 'Telepathic Speech: Bonus action grant telepathy to creature within 30ft for sorcerer level minutes',
    }, { subclass: 'Aberrant' });

    register('sorcerer', 'Psionic Sorcery', 6, {
        promptNote: () => 'Psionic Sorcery: Cast Aberrant spells by spending SP = spell level instead of slot (no verbal/somatic)',
    }, { subclass: 'Aberrant' });

    register('sorcerer', 'Psychic Defenses', 6, {
        promptNote: () => 'Psychic Defenses: Resistance to psychic damage; advantage on saves vs charmed/frightened',
    }, { subclass: 'Aberrant' });

    register('sorcerer', 'Revelation in Flesh', 14, {
        promptNote: () => 'Revelation in Flesh: Spend 1+ SP as bonus action: see invisible 60ft, fly, swim+breathe, squeeze through 1inch space (per SP, 10 min)',
    }, { subclass: 'Aberrant' });

    register('sorcerer', 'Warping Implosion', 18, {
        promptNote: () => 'Warping Implosion: Teleport 120ft; each creature within 30ft of departure: STR save or 3d10 force + pulled to departure point (1/LR or 5SP)',
    }, { subclass: 'Aberrant' });

    // --- Clockwork Soul (XPHB) ---
    register('sorcerer', 'Restore Balance', 3, {
        promptNote: (stats) => `Restore Balance: Reaction cancel advantage/disadvantage on roll within 60ft (${stats.proficiency} uses/LR)`,
    }, { subclass: 'Clockwork' });

    register('sorcerer', 'Bastion of Law', 6, {
        promptNote: () => 'Bastion of Law: Spend 1-5 SP to give creature d8 ward dice; when takes damage, spend dice to reduce (shield, 10 min)',
    }, { subclass: 'Clockwork' });

    register('sorcerer', 'Trance of Order', 14, {
        promptNote: () => 'Trance of Order: Bonus action for 1 min: attacks/checks/saves can\'t roll below 10 (1/LR or 5SP)',
    }, { subclass: 'Clockwork' });

    register('sorcerer', 'Clockwork Cavalcade', 18, {
        promptNote: () => 'Clockwork Cavalcade: Action 30ft cube: 100 force damage to each creature (CON save half); restore 100 HP split among allies; repair objects (1/LR or 7SP)',
    }, { subclass: 'Clockwork' });

    // --- Wild Magic (XPHB) ---
    register('sorcerer', 'Wild Magic Surge', 3, {
        promptNote: () => 'Wild Magic Surge: After casting sorcerer spell, DM may have you roll d20; on 1, roll on Wild Magic table',
    }, { subclass: 'Wild Magic' });

    register('sorcerer', 'Tides of Chaos', 3, {
        promptNote: () => 'Tides of Chaos: Advantage on one attack/check/save (1/LR or recharge via Wild Magic Surge)',
    }, { subclass: 'Wild Magic' });

    register('sorcerer', 'Bend Luck', 6, {
        promptNote: () => 'Bend Luck: Reaction spend 2 SP to add/subtract 1d4 from creature\'s attack/check/save within 60ft',
    }, { subclass: 'Wild Magic' });

    register('sorcerer', 'Controlled Chaos', 14, {
        promptNote: () => 'Controlled Chaos: Roll twice on Wild Magic table and choose which effect occurs',
    }, { subclass: 'Wild Magic' });

    register('sorcerer', 'Spell Bombardment', 18, {
        promptNote: () => 'Spell Bombardment: When you roll max on spell damage die, reroll it and add to damage (once per spell)',
    }, { subclass: 'Wild Magic' });

    // --- Shadow Magic (XGE) ---
    register('sorcerer', 'Eyes of the Dark', 3, {
        promptNote: () => 'Eyes of the Dark: Darkvision 120ft; at L3 cast Darkness for 2 SP (can see through it)',
    }, { subclass: 'Shadow' });

    register('sorcerer', 'Strength of the Grave', 3, {
        promptNote: (stats) => 'Strength of the Grave: When reduced to 0 HP (not radiant/crit), CHA save DC 5+damage — success: drop to 1 HP (1/LR)',
    }, { subclass: 'Shadow' });

    register('sorcerer', 'Hound of Ill Omen', 6, {
        promptNote: () => 'Hound of Ill Omen: Spend 3 SP bonus action: summon dire wolf that targets one creature; target has disadvantage on saves vs your spells',
    }, { subclass: 'Shadow' });

    register('sorcerer', 'Shadow Walk', 14, {
        promptNote: () => 'Shadow Walk: Bonus action in dim light/darkness, teleport 120ft to dim light/darkness',
    }, { subclass: 'Shadow' });

    register('sorcerer', 'Umbral Form', 18, {
        promptNote: () => 'Umbral Form: Spend 6 SP bonus action: shadow form for 1 min — resistance all except force/radiant, move through objects, fly',
    }, { subclass: 'Shadow' });

    // --- Storm Sorcery (XGE) ---
    register('sorcerer', 'Wind Speaker', 3, {
        promptNote: () => 'Wind Speaker: Speak, read, and write Primordial (and Aquan, Auran, Ignan, Terran)',
    }, { subclass: 'Storm' });

    register('sorcerer', 'Tempestuous Magic', 3, {
        promptNote: () => 'Tempestuous Magic: After casting 1st+ level spell, bonus action fly 10ft without OA',
    }, { subclass: 'Storm' });

    register('sorcerer', 'Heart of the Storm', 6, {
        promptNote: (stats) => `Heart of the Storm: Resistance to lightning and thunder; when you cast 1st+ level lightning/thunder spell, deal ${Math.ceil(stats.level / 2)} lightning/thunder to creatures within 10ft`,
    }, { subclass: 'Storm' });

    register('sorcerer', 'Storm Guide', 6, {
        promptNote: () => 'Storm Guide: Stop rain in 20ft sphere around you; bonus action choose wind direction in 100ft',
    }, { subclass: 'Storm' });

    register('sorcerer', 'Storm\'s Fury', 14, {
        promptNote: (stats) => `Storm's Fury: When hit by melee, reaction deal ${stats.level} lightning and push attacker (STR save or pushed 20ft)`,
    }, { subclass: 'Storm' });

    register('sorcerer', 'Wind Soul', 18, {
        promptNote: () => 'Wind Soul: Immunity to lightning and thunder; 60ft fly speed; action reduce fly to 30ft to grant 30ft fly to 3+CHA allies for 1hr',
    }, { subclass: 'Storm' });
}

// ============================================================
// WARLOCK SUBCLASSES
// ============================================================

function registerWarlock() {
// --- Archfey Patron (XPHB) ---
    register('warlock', 'Steps of the Fey', 3, {
        promptNote: (stats) => `Steps of the Fey: Misty Step free ${stats.proficiency} uses/LR; on teleport choose Taunting (CHA save or attacks you) or Refreshing (gain PB temp HP)`,
    }, { subclass: 'Archfey' });

    register('warlock', 'Misty Escape', 6, {
        promptNote: () => 'Misty Escape: Reaction when you take damage, turn invisible + teleport 60ft (invisible until start of next turn, 1/LR or slot)',
    }, { subclass: 'Archfey' });

    register('warlock', 'Beguiling Defenses', 10, {
        promptNote: () => 'Beguiling Defenses: Immune to charm; when someone tries to charm you, reflect it (WIS save or charmed by you)',
    }, { subclass: 'Archfey' });

    register('warlock', 'Bewitching Magic', 14, {
        promptNote: () => 'Bewitching Magic: When dealing psychic damage, also charm or frighten target (WIS save); PB uses/LR',
    }, { subclass: 'Archfey' });

    // --- Celestial Patron (XPHB) ---
    register('warlock', 'Healing Light', 3, {
        promptNote: (stats) => `Healing Light: Pool of ${1 + stats.level}d6; bonus action heal ally within 60ft (up to ${Math.max(1, stats.mods.cha || 0)} dice at once)`,
    }, { subclass: 'Celestial' });

    register('warlock', 'Celestial Resilience', 10, {
        promptNote: (stats) => `Celestial Resilience: You + up to 5 allies gain ${stats.level + (stats.mods.cha || 0)} temp HP on SR/LR`,
    }, { subclass: 'Celestial' });

    register('warlock', 'Searing Vengeance', 14, {
        promptNote: () => 'Searing Vengeance: When making death save at start of turn, instead regain half HP, stand, deal 2d8+CHA radiant + blind in 30ft (CON save)',
    }, { subclass: 'Celestial' });

    // --- Fiend Patron (XPHB) ---
    register('warlock', 'Dark One\'s Blessing', 3, {
        promptNote: (stats) => `Dark One's Blessing: When you reduce hostile to 0 HP, gain ${stats.level + (stats.mods.cha || 0)} temp HP`,
    }, { subclass: 'Fiend' });

    register('warlock', 'Dark One\'s Own Luck', 6, {
        promptNote: () => 'Dark One\'s Own Luck: Add 1d10 to ability check or save (1/SR)',
    }, { subclass: 'Fiend' });

    register('warlock', 'Fiendish Resilience', 10, {
        promptNote: () => 'Fiendish Resilience: Choose one damage type resistance (changes on SR/LR)',
    }, { subclass: 'Fiend' });

    register('warlock', 'Hurl Through Hell', 14, {
        promptNote: () => 'Hurl Through Hell: On hit, banish target through lower planes — takes 10d10 psychic when returns (1/LR)',
    }, { subclass: 'Fiend' });

    // --- Great Old One Patron (XPHB) ---
    register('warlock', 'Awakened Mind', 3, {
        promptNote: () => 'Awakened Mind: Telepathy 120ft with any creature (can be one-way); speak to non-linguistic creatures',
    }, { subclass: 'Great Old One' });

    register('warlock', 'Psychic Spells', 6, {
        promptNote: () => 'Psychic Spells: When you deal psychic damage with Warlock spell, add CHA to one damage roll',
    }, { subclass: 'Great Old One' });

    register('warlock', 'Clairvoyant Combatant', 6, {
        promptNote: () => 'Clairvoyant Combatant: After dealing psychic damage, become invisible to that creature for 1 round (PB uses/LR)',
    }, { subclass: 'Great Old One' });

    register('warlock', 'Thought Shield', 10, {
        promptNote: () => 'Thought Shield: Thoughts can\'t be read; resistance to psychic; psychic damage reflected to attacker',
    }, { subclass: 'Great Old One' });

    register('warlock', 'Eldritch Hex', 10, {
        promptNote: () => 'Eldritch Hex: Curse creature you deal psychic to — disadvantage on checks with chosen ability (CHA save, PB uses/LR)',
    }, { subclass: 'Great Old One' });

    register('warlock', 'Create Thrall', 14, {
        promptNote: () => 'Create Thrall: Cast Summon Aberration without slot, no concentration, lasts 1 hr (1/LR or slot)',
    }, { subclass: 'Great Old One' });
}

// ============================================================
// WIZARD SUBCLASSES
// ============================================================

function registerWizard() {
// --- School of Abjuration (XPHB) ---
    register('wizard', 'Abjuration Savant', 3, {
        promptNote: () => 'Abjuration Savant: Copy abjuration spells in half time and cost',
    }, { subclass: 'Abjuration' });

    register('wizard', 'Arcane Ward', 3, {
        promptNote: (stats) => `Arcane Ward: Ward HP = ${stats.level * 2 + (stats.mods.int || 0)}; recharges when you cast abjuration spells`,
        hpBonus: () => 0,
        meta: { arcaneWard: true },
    }, { subclass: 'Abjuration' });

    register('wizard', 'Projected Ward', 6, {
        promptNote: () => 'Projected Ward: Reaction when ally within 30ft takes damage, ward absorbs damage instead',
    }, { subclass: 'Abjuration' });

    register('wizard', 'Spell Breaker', 10, {
        promptNote: () => 'Spell Breaker: When you restore HP to creature with ward active, also end one spell on it (up to ward level)',
    }, { subclass: 'Abjuration' });

    register('wizard', 'Spell Resistance', 14, {
        promptNote: () => 'Spell Resistance: Advantage on saves vs spells; resistance to spell damage',
    }, { subclass: 'Abjuration' });

    // --- School of Divination (XPHB) ---
    register('wizard', 'Divination Savant', 3, {
        promptNote: () => 'Divination Savant: Copy divination spells in half time and cost',
    }, { subclass: 'Divination' });

    register('wizard', 'Portent', 3, {
        promptNote: (stats) => `Portent: Roll ${stats.level >= 14 ? 3 : 2}d20 after LR; replace any attack/save/check you can see with stored roll`,
    }, { subclass: 'Divination' });

    register('wizard', 'Expert Divination', 6, {
        promptNote: () => 'Expert Divination: When you cast divination spell of 2nd+, regain spell slot of lower level (max 5th)',
    }, { subclass: 'Divination' });

    register('wizard', 'The Third Eye', 10, {
        promptNote: () => 'The Third Eye: Choose enhanced sense on SR (darkvision/ethereal sight/see invisibility/read languages)',
    }, { subclass: 'Divination' });

    register('wizard', 'Greater Portent', 14, {
        promptNote: () => 'Greater Portent: Roll 3d20 for Portent (up from 2)',
    }, { subclass: 'Divination' });

    // --- School of Illusion (XPHB) ---
    register('wizard', 'Illusion Savant', 3, {
        promptNote: () => 'Illusion Savant: Copy illusion spells in half time and cost',
    }, { subclass: 'Illusion' });

    register('wizard', 'Improved Minor Illusion', 3, {
        promptNote: () => 'Improved Minor Illusion: Minor Illusion creates both sound and image simultaneously',
    }, { subclass: 'Illusion' });

    register('wizard', 'Malleable Illusions', 6, {
        promptNote: () => 'Malleable Illusions: Action to change nature of ongoing illusion spell',
    }, { subclass: 'Illusion' });

    register('wizard', 'Phantom Creation', 10, {
        promptNote: () => 'Phantom Creation: When you cast illusion spell, one object becomes temporarily real (can be touched/used)',
    }, { subclass: 'Illusion' });

    register('wizard', 'Illusory Reality', 14, {
        promptNote: () => 'Illusory Reality: Bonus action make one element of your illusion real for 1 min (can deal damage, restrain, etc.)',
    }, { subclass: 'Illusion' });

    // --- War Magic (XGE) ---
    register('wizard', 'Arcane Deflection', 3, {
        promptNote: () => 'Arcane Deflection: Reaction when hit: +2 AC vs that attack; or +4 to failed save (then can only cast cantrips next turn)',
    }, { subclass: 'War Magic' });

    register('wizard', 'Tactical Wit', 3, {
        promptNote: (stats) => `Tactical Wit: +${stats.mods.int || 0} (INT) to initiative rolls`,
    }, { subclass: 'War Magic' });

    register('wizard', 'Power Surge', 6, {
        promptNote: (stats) => `Power Surge: Store up to ${stats.mods.int || 0} surges (gain on Counterspell/Dispel/SR); spend one to add ${Math.ceil(stats.level / 2)} force to spell damage`,
    }, { subclass: 'War Magic' });

    register('wizard', 'Durable Magic', 10, {
        promptNote: () => 'Durable Magic: While concentrating on a spell, +2 AC and +2 to all saves',
        acBonus: (stats) => stats.hasActiveConcentration ? 2 : 0,
    }, { subclass: 'War Magic' });

    register('wizard', 'Deflecting Shroud', 14, {
        promptNote: (stats) => `Deflecting Shroud: When you use Arcane Deflection, deal ${Math.ceil(stats.level / 2)} force to up to 3 creatures within 60ft`,
    }, { subclass: 'War Magic' });
}
