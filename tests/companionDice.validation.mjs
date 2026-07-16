import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The extension has no package.json. Import the pure ES module through a data
// URL so this deterministic validation remains runnable with plain Node.
const source = await readFile(new URL('../src/features/companionDice.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
    allocateUniqueCreatureKeys,
    buildSidekickRollSpec,
    parseMultiattackCount,
    parseNativeSpellAttackCount,
} = await import(moduleUrl);
const scalingSource = await readFile(new URL('../src/features/spellScaling.js', import.meta.url), 'utf8');
const scalingModuleUrl = `data:text/javascript;base64,${Buffer.from(scalingSource).toString('base64')}`;
const { parseBeamCount } = await import(scalingModuleUrl);
const promptBuilderSource = await readFile(new URL('../src/generation/promptBuilder.js', import.meta.url), 'utf8');
const combatHeaderIndex = promptBuilderSource.indexOf('[Combat: use these pre-rolled values');
const independentSetReminderIndex = promptBuilderSource.indexOf('Each named roll set is independently available');
const attributesIndex = promptBuilderSource.indexOf('lines.push(`Attributes:');
assert.ok(combatHeaderIndex >= 0 && independentSetReminderIndex > combatHeaderIndex);
assert.ok(attributesIndex > independentSetReminderIndex);
assert.equal(promptBuilderSource.includes('Attack = d20 + ability mod + proficiency.'), false);

assert.equal(parseMultiattackCount('The bear makes two attacks: one with its bite and one with its claws.'), 2);
assert.equal(parseMultiattackCount('The creature attacks twice.'), 2);
assert.equal(parseMultiattackCount('The creature makes 3 weapon attacks.'), 3);
assert.equal(parseMultiattackCount('The creature makes two Claw attacks and one Bite attack.'), 3);
assert.equal(parseMultiattackCount({
    name: 'Multiattack',
    text: 'The kobold makes two Spear attacks.',
    computedText: 'The kobold makes two Spear attacks.',
}), 2);

const blackBear = {
    id: 'bear', name: 'Fang', enabled: true, creatureTraits: [], knownCantrips: [], knownSpells: [],
};
const blackBearStats = {
    extraAttack: 0,
    computedActions: [
        { name: 'Multiattack', text: 'The bear makes two attacks: one with its bite and one with its claws.', enabled: true },
        { name: 'Bite', computedText: 'Hit: 1d6 + 2 piercing damage.', enabled: true },
        { name: 'Claws', computedText: 'Hit: 2d4 + 2 slashing damage.', enabled: true },
    ],
    computedWeapons: [],
};
const bearSpec = buildSidekickRollSpec(blackBear, blackBearStats, 1, () => null);
assert.equal(bearSpec.rollSetCount, 2);
assert.deepEqual(bearSpec.setProfiles[0], { d4: 2, d6: 1 });
assert.deepEqual(bearSpec.setProfiles[1], { d4: 2, d6: 1 });

const raxSpec = buildSidekickRollSpec({
    id: 'rax', name: 'Rax', type: 'warrior', creatureTraits: [], knownCantrips: [], knownSpells: [],
}, {
    extraAttack: 2,
    computedActions: [
        {
            name: 'Multiattack',
            text: 'The kobold makes two Spear attacks.',
            computedText: 'The kobold makes two Spear attacks.',
            enabled: true,
        },
        {
            name: 'Spear',
            computedText: 'Hit: 6 (1d6 + 3) piercing damage, or 5 (1d8 + 1) piercing damage.',
            enabled: true,
        },
    ],
    computedWeapons: [],
}, 6, () => null);
assert.equal(raxSpec.physicalAttackCount, 2);
assert.equal(raxSpec.rollSetCount, 2);
assert.deepEqual(raxSpec.setProfiles, [{ d6: 1, d8: 1 }, { d6: 1, d8: 1 }]);

const eldritchBlast = {
    name: 'Eldritch Blast', level: 0, spellAttack: ['R'],
    entries: ['You create one beam. Make a ranged spell attack. You make a separate attack roll for each beam.'],
    entriesHigherLevel: ['The spell creates two beams at level 5, three beams at level 11, and four beams at level 17.'],
    scalingLevelDice: { scaling: { 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' } },
};
assert.equal(parseNativeSpellAttackCount(eldritchBlast, 1), 1);
assert.equal(parseNativeSpellAttackCount(eldritchBlast, 5), 2);
assert.equal(parseNativeSpellAttackCount(eldritchBlast, 11), 3);
assert.equal(parseNativeSpellAttackCount(eldritchBlast, 17), 4);
const beamText = 'Create one beam and make a separate attack roll for each beam. Two beams at level 5, three beams at level 11, and four beams at level 17.';
assert.equal(parseBeamCount(beamText, 1), 1);
assert.equal(parseBeamCount(beamText, 5), 2);
assert.equal(parseBeamCount(beamText, 11), 3);
assert.equal(parseBeamCount(beamText, 17), 4);
assert.equal(parseBeamCount('Two beams at level 5.', 5), 1);

const scorchingRay = {
    name: 'Scorching Ray', level: 2, spellAttack: ['R'],
    entries: ['You hurl three fiery rays. Make a ranged spell attack for each ray. On a hit, a ray deals {@damage 2d6} Fire damage.'],
    entriesHigherLevel: ['The spell creates one additional ray for each spell slot level above 2.'],
};
const steelWindStrike = {
    name: 'Steel Wind Strike', level: 5, spellAttack: ['M'],
    entries: ['Choose up to five creatures. Make a melee spell attack against each target. On a hit, a target takes {@damage 6d10} Force damage.'],
};
assert.equal(parseNativeSpellAttackCount(scorchingRay, 20), 3);
assert.equal(parseNativeSpellAttackCount(steelWindStrike, 20), 5);

const spellMap = new Map([
    ['eldritch blast', eldritchBlast],
    ['scorching ray', scorchingRay],
    ['steel wind strike', steelWindStrike],
    ['swift quiver', {
        name: 'Swift Quiver', level: 5,
        entries: ['When you cast the spell, you can make two attacks with a weapon that fires Arrows or Bolts.'],
        entriesHigherLevel: ['Ignored upcast text with {@damage 9d12}.'],
    }],
]);
const caster = {
    id: 'caster', name: 'Shadow Fang', type: 'spellcaster', enabled: true,
    knownCantrips: ['Eldritch Blast'],
    knownSpells: ['Scorching Ray', 'Steel Wind Strike', 'Swift Quiver'],
    creatureTraits: [],
};
const casterStats = {
    spellcasting: {}, extraAttack: 2, featEffects: {}, computedActions: [],
    computedWeapons: [{ name: 'Longbow', damageDice: '1d8', computedDamage: '1d8 + 4', attackType: 'rw' }],
};
const casterSpec = buildSidekickRollSpec(caster, casterStats, 17, name => spellMap.get(name.toLowerCase()));
assert.equal(casterSpec.mainSetCount, 5);
assert.equal(casterSpec.additionalSetCount, 2);
assert.equal(casterSpec.rollSetCount, 7);
assert.deepEqual(casterSpec.setProfiles[5], { d8: 1 });
assert.deepEqual(casterSpec.setProfiles[6], { d8: 1 });
assert.deepEqual(casterSpec.spellDice.find(s => s.name === 'Eldritch Blast').dice, { d10: 4 });
assert.deepEqual(casterSpec.spellDice.find(s => s.name === 'Scorching Ray').dice, { d6: 6 });
assert.deepEqual(casterSpec.spellDice.find(s => s.name === 'Steel Wind Strike').dice, { d10: 30 });
assert.equal(casterSpec.spellDice.some(s => s.name === 'Swift Quiver'), false);

const keyed = allocateUniqueCreatureKeys([
    { name: 'Fang' }, { name: 'Fang Wolf' }, { name: 'Shadow Fang' }, { name: 'Bartholomew' },
    { name: 'User' }, { name: 'Ally' },
]);
assert.deepEqual(keyed.map(entry => entry.key), ['fang', 'fangb', 'shad', 'bart', 'userb', 'allyb']);

console.log('companionDice validation: all assertions passed');
