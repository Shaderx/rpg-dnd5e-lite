# Dice Feature V2

## Status

Implemented on the Dice Feature V2 feature branch, with deterministic validation coverage in
`tests/companionDice.validation.mjs`.

## Goal

When the user manually activates the combat dice roller, automatically create and inject named roll sets for every active sidekick, companion, and familiar. The number and contents of those sets must come from each creature's computed stat block.

The player character remains completely manual and keeps the existing `playerCount` behavior.

## Current behavior

- `src/features/dice.js` creates combat rolls from the manual `playerCount`, `allyCount`, and `enemyCount` settings.
- Each player, ally, or enemy set gets two d20 values so the model can resolve normal rolls, advantage, or disadvantage.
- Generic allies and enemies also receive one generic d4, d6, d8, d10, and d12 value.
- Enabled sidekicks and companions are injected separately as stat blocks, so their activation state and attack count currently have no effect on combat dice.
- Sidekick creature actions imported from the CDN are already stored in `creatureActions`. These can include a `Multiattack` action as well as the individual attacks referenced by it.
- Sidekick class progression separately exposes `computedActions`, `computedWeapons`, and `extraAttack` through `computeSidekickStats()`.
- V2 companions/familiars expose their current actions through `getComputedStats()`.

## Scope

Automatically include:

- Enabled shared sidekicks.
- Enabled V2 companion/familiar cards.
- A selected character-bound V1/V2 companion or familiar only when it is the active companion source and is not already represented by enabled V2 companion cards.

Do not automatically include:

- The player character.
- Disabled sidekicks or companions.
- Creature actions that have been disabled in the sidekick configuration.

Manual unnamed ally rolls should remain available for other party NPCs. They should be stored separately from roster-derived rolls and presented as `Extra Ally` rolls to avoid confusing them with enabled companions.

## Proposed roll model

Add a backward-compatible `companionRolls` array to the existing combat-roll snapshot. It contains only names, attack-set indexes, and raw roll values:

```js
{
    userRolls: [],
    allyRolls: [],
    companionRolls: [
        {
            entityId: '...',
            name: 'Fang',
            key: 'fang',
            source: 'sidekick',
            physicalAttackCount: 2,
            maxSpellAttackCount: 3,
            maxBonusWeaponAttackCount: 2,
            mainSetCount: 3,
            additionalSetCount: 2,
            rollSetCount: 5,
            sets: [
                {
                    index: 1,
                    roll1: 14,
                    roll2: 7,
                    dice: { d6: [5, 2], d8: [6] },
                },
            ],
            spellDice: [
                {
                    name: 'Fire Bolt',
                    key: 'fire',
                    dice: { d10: [8, 3] },
                },
            ],
        },
    ],
    enemyRolls: [],
}
```

Do not attach semantic labels such as attack name, damage, healing, damage type, formula, modifier, or computed total. The companion stat block is already present elsewhere in the prompt. The LLM decides whether and how the supplied raw rolls apply to the current narrative.

An existing saved roll without `companionRolls` must continue to render and inject normally.

## Roll-spec resolver

Create a pure resolver, preferably `src/features/companionDice.js`, responsible for turning active stat blocks into compact roll specifications. It returns only:

- Stable entity ID and display name.
- A compact prompt key derived from the display name.
- Source type: sidekick, V2 companion, or character-bound companion.
- Main-action attack-set count and its compact raw option-dice profile.
- Any additive same-turn attack-set count and the compact raw weapon-dice profile required by those appended sets.
- Total ordered roll-set count after combining those two categories.

The resolver must not roll dice. It should return ordered per-set specifications, or an equivalent explicit `mainSetCount`/`additionalSetCount` partition with separate raw dice profiles, so appended weapon-grant sets can use a different bank from the main sets. These structural fields remain internal and are not injected as semantic labels. `src/features/dice.js` remains responsible for generating random values.

## Sidekick attack resolution

Use `computeSidekickStats(sidekick, getSidekickLevel())` as the source of current values. Relevant inputs are enabled `computedActions`, `computedWeapons`, `extraAttack`, and the original `creatureActions`, which can contain a CDN-imported `Multiattack` action.

### Stat-block Multiattack

Extend sidekick action extraction so a `Multiattack` action retains a derived count. Parse common forms including:

- "The creature makes two attacks."
- "The creature attacks twice."
- "The creature makes three attacks: one with its Bite and two with its Claws."
- Numeric variants such as `2 attacks` as well as number words.

Only the count is required for dice injection. The prompt does not need the composition or attack names because those are already available in the sidekick stat block.

Resolution rules:

1. Use the parsed Multiattack count when available.
2. If only a general count can be determined, create that many identical roll sets.
3. If no count can be parsed, fall back to one set.
4. Cap derived counts at a conservative maximum, such as eight.

### Multiattack versus sidekick Extra Attack

Multiattack and the sidekick class's Extra Attack are different action choices. Supply enough identical sets for the largest legal sequence, without adding the two features together:

```text
physicalAttackCount = max(1, parsed Multiattack count, computed Extra Attack count)
```

This is the physical main-action requirement. The final shared turn-roll count may be larger if a known spell creates more direct attacks or grants additive Bonus Action/additional-action weapon attacks.

## Companion and familiar resolution

- Use `getComputedStats(companion)` for enabled V2 companion cards.
- Use computed character stats for the character-bound V1/V2 fallback companion.
- Preserve V2's existing duplicate-suppression rule.
- Add a derived attack count when Bestial Fury grants a primal companion two attacks.
- Familiar and steed entries default to one set unless their stat text supplies a different count.
- Always supply the derived sets for an active creature. Do not try to predict whether it can attack, heal, or act in the current narrative; the LLM makes that decision.

## Compact side-dice bank

Scan usable action and trait text for dice expressions, but retain only die sizes and counts. Do not retain or inject what a die represents.

Examples:

- `1d4 + 3` plus `3d6` requires one d4 and three d6 values.
- `2d8 + spell slot level` requires two d8 values.
- Flat-only effects require no additional die.

When several actions use the same die size, keep the maximum count needed by any one option rather than summing every option. This produces a safe reusable bank with fewer tokens. For example, actions using `1d6` and `3d6` require three d6 values, not four.

Every repeated set within the same resolved attack sequence receives the same dice shape with independently rolled values. Normal main-action sets use the creature's compact action option bank; spell-granted weapon sets may use the narrower compatible weapon bank required by that grant. No formula, purpose, modifier, damage type, or total is injected.

## Sidekick spellcaster spell dice

Sidekicks may use both cantrips and leveled spells. They never upcast: every leveled spell uses only its native spell-level behavior, dice, targets, rays, and attack count. Ignore `entriesHigherLevel` for leveled spells.

For every enabled sidekick whose computed stats include `spellcasting`, inspect:

- `knownCantrips`
- `knownSpells`
- Bonus cantrips and bonus leveled spells exposed through computed feat effects

Deduplicate by normalized spell name before rolling.

### Inclusion rule

Resolve every spell through `lookupSpellByName()`. Include its raw spell-dice line only when its native/current data contains at least one real dice expression, including both `{@damage ...}` and generic `{@dice ...}` rolls.

- Dice-bearing attack, save, healing, and utility spells are included.
- A spell with no dice is omitted from spell-dice lines unless it qualifies for the same-turn weapon-attack-grant exception below.
- A leveled spell is included at native level only.
- Upcast dice, additional rays, and additional targets are never included.
- Exception: a spell that explicitly grants same-turn weapon attacks can contribute attack sets even when the spell has no dice tags. Those sets use the sidekick's matching weapon dice, not a synthetic spell-dice line.

### Spell dice profile

For an included spell:

1. Parse all relevant dice expressions in its primary entries.
2. For cantrips, apply `scalingLevelDice` at the current sidekick level and avoid counting Cantrip Upgrade text twice.
3. For leveled spells, use primary/native-level entries only and ignore `entriesHigherLevel`.
4. Merge the result into a raw count by die size.
5. Do not inject formulas, modifiers, purpose labels, damage types, or totals.
6. When one native casting makes multiple separate spell attacks, multiply the per-hit dice so the spell bank contains enough values for every attack.

### Shared turn d20 pool

Do not create a d20 pair for each spell. The sidekick normally chooses either a physical Attack action or one Magic action, so single-attack spells reuse the first shared pair. A spell that grants attacks through a Bonus Action or another additional action is additive because those attacks can occur alongside the chosen main action.

```text
physicalAttackCount = max(1, parsed Multiattack count, computed Extra Attack count)
maxSpellAttackCount = largest native/current separate attack count among known spells
baseActionAttackCount = max(physicalAttackCount, maxSpellAttackCount)
maxBonusWeaponAttackCount = largest compatible same-turn weapon-attack grant among known spells
rollSetCount = baseActionAttackCount + maxBonusWeaponAttackCount
```

- A normal physical attack or single-attack spell uses the first pair.
- Physical Multiattack/Extra Attack uses its required number of pairs.
- A multi-beam cantrip or native-level multi-attack spell uses its required number of pairs.
- Save-based and other non-attack spells ignore all d20 pairs.
- Competing main-action physical and direct spell-attack counts use `max`, never addition.
- A compatible Bonus Action/additional-action weapon grant is appended to that main-action maximum.
- If several known concentration spells could grant extra weapon attacks, use the largest compatible grant rather than summing mutually exclusive spell effects.

### Spell prompt keys

Derive a spell key using the same first-word, lowercase, ASCII, four-character rule as creature keys:

```text
<creature>_<spell>_
```

```text
Fang — Fire Bolt dice: fang_fire_d10_1=8, fang_fire_d10_2=3
Fang — Cure Wounds dice: fang_cure_d8_1=4, fang_cure_d8_2=7
```

The readable spell name may appear as the line label, but the values remain unlabeled by purpose. Resolve four-character spell-key collisions with the alphabetic suffix rule. Spell dice lines never receive their own d20 pairs.

## Validated PHB 2024 spell-attack audit

The full PHB 2024 CDN audit found three spells that require multiple separate spell attacks at their current/native level:

| Spell | Native/current attack count | Raw dice requirement |
| --- | ---: | --- |
| Eldritch Blast | 1/2/3/4 at sidekick levels 1/5/11/17 | Matching number of d10s |
| Scorching Ray | 3 at native 2nd level | 6d6 total |
| Steel Wind Strike | Up to 5 at native 5th level | Up to 30d10 total |

#### Eldritch Blast gap

PHB 2024 uses word counts and `at level N` ordering: "two beams at level 5, three beams at level 11, and four beams at level 17." The current `parseBeamCount()` recognizes only digit-based variants and incorrectly returns one beam at every level.

Extend it to accept digits and number words, both level-wording orders, and `entriesHigherLevel` for cantrip scaling. Require the explicit "separate attack roll for each beam" wording before expanding the d20 pool.

#### Native leveled multi-attack patterns

Add a native spell-attack-count parser for primary entries only:

- Scorching Ray: `three fiery rays` plus `spell attack for each ray` resolves to 3. Ignore its higher-level additional-ray text.
- Steel Wind Strike: `choose up to five creatures` plus `spell attack against each target` resolves to 5.

Require structured `spellAttack` metadata, an explicit plural per-ray/per-target attack instruction, and a resolvable fixed or bounded count. Otherwise default to one.

#### Swift Quiver weapon-attack grant

PHB 2024 Swift Quiver has no `spellAttack` or dice tags, but its primary entry says that when the spell is cast, and as a Bonus Action on later turns, the caster can make two attacks with a weapon that fires Arrows or Bolts. Its casting time is a Bonus Action, so the cast-time attacks leave the caster's main action available; on later turns the repeated attacks also use a Bonus Action. Treat this as a native `+2` same-turn weapon-attack grant.

Resolve the dice for both appended sets from the sidekick's current compatible weapon data:

1. Inspect all configured `computedWeapons` plus enabled weapon-like `computedActions`. Current computed weapon records do not have a separate equipped/enabled flag.
2. Retain ranged ammunition weapons whose normalized name/text identifies an Arrow- or Bolt-firing weapon, such as a Shortbow, Longbow, or Crossbow.
3. Parse the weapon's native `damageDice`, `computedDamage`, or action `origDamage` expression.
4. If several compatible weapons exist, merge them using the normal maximum-per-die-size option-bank rule rather than summing alternatives.
5. Give each of the two Swift Quiver sets an independently rolled copy of that same weapon-dice bank.
6. If the sidekick has no compatible Arrow- or Bolt-firing weapon, add no Swift Quiver sets because it cannot make the granted attacks.

The two sets continue the creature's normal numeric sequence and carry no injected semantic label. For example, a sidekick with two physical attacks and Swift Quiver receives four available sets: the first two cover its main action and the final two cover the spell-granted weapon attacks. A minimal general prompt instruction may state that later-numbered sets can represent additional-action options and must be checked against the stat block; it must not name or classify the roll values themselves. The LLM decides whether the spell is active and whether those rolls are usable in the narrative.

The pool represents the largest legal combination available on a turn, not permission to cast two leveled spells together. On Swift Quiver's cast turn, its Bonus Action cast-time attacks can accompany a physical action or other legal main action. On a later turn while it is already active, its Bonus Action attacks can accompany the largest otherwise legal main-action sequence.

#### Same-action and false-positive guards

- Spiritual Weapon, Bigby's Hand, Vampiric Touch, Grasping Vine, and Mordenkainen's Sword make at most one attack per current action; "repeat on later turns" does not increase the snapshot count.
- Blade Ward, Friends, and Vicious Mockery only mention someone else's or a future attack roll.
- True Strike makes one weapon attack and needs no extra pair despite lacking `spellAttack` metadata.
- Sorcerous Burst is a single attack identified by structured `spellAttack` even though its prose says "ranged attack roll."
- Swift Quiver is the explicit dice-less exception: it contributes two additional d20 pairs plus two independently rolled copies of the sidekick's compatible Arrow/Bolt weapon-dice bank.

## Combat roll generation

Update `rollD20()` in `src/features/dice.js` to:

1. Resolve the active roster when the yellow combat-roll button is pressed.
2. Leave `userRolls` and `playerCount` unchanged.
3. Leave manual unnamed `allyRolls` and `enemyRolls` available.
4. Generate one `companionRolls` entry per active entity.
5. Derive physical attack count, the largest known direct multi-attack-spell count, and the largest compatible same-turn bonus weapon-attack grant.
6. Generate the main-action d20 pairs using the larger of the physical and direct spell counts, then append any compatible bonus weapon-attack pairs.
7. Generate the compact raw physical option bank alongside each main-action slot and the compatible weapon-dice bank alongside each appended weapon-grant slot.
8. For spellcasting sidekicks, generate a raw spell-dice bank for every known dice-bearing cantrip or native-level spell; ignore upcast data and do not generate per-spell d20 pairs. For Swift Quiver, append two qualifying weapon-dice attack sets instead of a spell-dice line.
9. Save the complete result as the existing one-use combat snapshot.

Changing activation after a roll must not mutate the current snapshot. The new roster applies to the next roll.

## Prompt-key naming

Use the existing combat-roll naming convention from `buildCombatDiceSection()`: a readable label followed by named values such as `<prefix>d20_1`, `<prefix>d20_2`, and `<prefix>d8`.

Derive the creature key as follows:

1. Trim the display name and take its first whitespace-separated word.
2. Convert it to lowercase.
3. Remove characters that are not ASCII letters or digits.
4. Truncate the result to four characters when the first word is longer than four characters. Multi-word names therefore use their first word, also capped at four characters.
5. If nothing remains, use `comp` as the fallback key.

Examples:

| Display name | Key |
| --- | --- |
| `Fang` | `fang` |
| `Shadow Fang` | `shad` |
| `Bartholomew` | `bart` |
| `Bo` | `bo` |

Keys must be unique within the snapshot. When two active creatures resolve to the same four-character base, append an alphabetic entity suffix to later entries, such as `fang` and `fangb`. This avoids colliding with numeric Multiattack set suffixes (`fang1`, `fang2`, `fangb1`, `fangb2`). The full display name remains at the start of the prompt line, so the LLM can associate the compact key with the correct stat block.

For a creature with one set, use the key directly:

```text
fang_d20_1, fang_d20_2, fang_d6, fang_d8
```

For a creature with two or more sets, append the set number to the key, matching the existing `ally1_`/`ally2_` pattern:

```text
fang1_d20_1, fang1_d20_2, fang1_d6, fang1_d8
fang2_d20_1, fang2_d20_2, fang2_d6, fang2_d8
```

If a side-die bank contains more than one die of the same size, number only those repeated dice:

```text
fang1_d6_1=5, fang1_d6_2=2, fang1_d6_3=6
```

This naming change applies only to automatic companion combat rolls. Existing player, manual ally, enemy, pool-dice, and non-combat keys remain unchanged.

## Prompt injection

The current combat injection emits lines in this form:

```text
Ally: ally1_d20_1=14, ally1_d20_2=7 | dice: ally1_d4=3, ally1_d6=5, ...
```

Extend the same formatter with creature-derived prefixes:

```text
Fang:
  1/2: fang1_d20_1=14, fang1_d20_2=7 | dice: fang1_d6_1=5, fang1_d6_2=2, fang1_d8=6
  2/2: fang2_d20_1=18, fang2_d20_2=4 | dice: fang2_d6_1=3, fang2_d6_2=6, fang2_d8=2
```

Name each creature once, then group its numbered attack sets and spell rolls beneath that header. Put the short independent-set reminder immediately below the opening combat-roll instruction, before attributes and all roll values; do not interrupt the roll list with it. Each set is independently available, later-numbered sets may cover additional-action options, and the LLM should use or ignore them as appropriate to the narrative and stat block. Existing general advantage/disadvantage guidance remains sufficient. Do not inject the generic attack-formula/proficiency/expertise reminder.

Do not inject attack names, formulas, semantic effect labels, modifiers, or calculated totals. Player-character prompt lines remain unchanged.

Within the same creature block, append each dice-bearing sidekick spell using its readable spell name and combined creature/spell prefix. Do not repeat the creature name on every spell line. Spell lines contain only raw side dice. Spells without dice are absent from the `<dice>` section unless they explicitly grant same-turn weapon attacks. Leveled spells use only their native-level data; higher-slot/upcast entries never contribute dice or attack counts. Swift Quiver contributes two additional numbered creature sets containing d20 pairs and compatible weapon dice; it does not receive an empty spell line.

## UI changes

Update the expanded display in `src/features/dice.js` and the compact strip in `src/ui/desktop.js`. In the expanded sidebar, named companion and sidekick results appear in a dedicated `Companion Rolls` section directly below the omni modules and above the generic player/Extra Ally/enemy roller. Keep this module shallow and visually aligned with the normal compact roll chips: an inline heading, a four-column roll grid, abbreviated visible values, and full raw values in tooltips. Each turn-roll entry shows the creature name, set ordinal, d20 pair, and compact raw side dice. Swift Quiver's two appended sets use the same display and prompt shape as other creature sets. Spell entries show the creature and spell names plus raw side dice only. Tooltips may expand the raw values but must not classify their purpose.

The existing manual Ally control should be relabeled `Extra Ally`; it continues to create unnamed generic ally sets and does not control roster-derived rolls. No companion count control is needed.

## Validated CDN pull simulation

Use the MM Black Bear (CR 1/2) as the implementation fixture. It is a valid sidekick-scale example and its CDN creature object has this attached `action` array:

```js
[
    {
        name: 'Multiattack',
        entries: ['The bear makes two attacks: one with its bite and one with its claws.'],
    },
    {
        name: 'Bite',
        entries: ['{@atk mw} {@hit 4} ... {@damage 1d6 + 2} ...'],
    },
    {
        name: 'Claws',
        entries: ['{@atk mw} {@hit 4} ... {@damage 2d4 + 2} ...'],
    },
]
```

A read-only local simulation using the repository's current `strip5eMarkup()` and `extractCreatureActions()` logic confirmed that the attached actions become:

```text
Multiattack -> "The bear makes two attacks: one with its bite and one with its claws."
Bite        -> origDamage "1d6 + 2"
Claws       -> origDamage "2d4 + 2"
```

Applying the planned derived parser produces:

```js
{
    multiattackCount: 2,
    diceProfile: { d4: 2, d6: 1 },
}
```

The corresponding injection shape is:

```text
Fang:
  1/2: fang1_d20_1=..., fang1_d20_2=... | dice: fang1_d4_1=..., fang1_d4_2=..., fang1_d6=...
  2/2: fang2_d20_1=..., fang2_d20_2=... | dice: fang2_d4_1=..., fang2_d4_2=..., fang2_d6=...
```

This validates that the CDN's attached `Multiattack` action survives the existing pull/extraction path and contains enough text for count derivation. The production implementation must still add that derived count parser; the current repository only preserves the action text and does not yet convert it into roll-set count metadata.

## Expected files

- New: `src/features/companionDice.js`
- `src/features/dice.js`
- `src/features/sidekick.js`
- Possibly `src/features/spellScaling.js` if the raw spell-profile helper belongs with the existing scaling utilities
- `src/v2/features/companion.js`
- `src/v2/features/levelFeatures.js`
- `src/generation/promptBuilder.js`
- `src/ui/desktop.js`
- `template.html`
- Possibly the V1 parallel companion/stat module if derived Bestial Fury metadata is kept symmetrical across V1 and V2.

No new persistence key or CDN fetch should be required. The added roll data is a backward-compatible field inside the existing ephemeral combat snapshot.

## Verification matrix

### Activation

- No active sidekick/companion: current combat output is unchanged.
- Disabled entities are excluded.
- One enabled familiar produces one named set even if the narrative may prevent it from attacking.
- Multiple enabled entities remain separately named.
- Activation changes apply only to the next snapshot.

### Attack counts

- Single attack produces one set.
- Stat-block Multiattack x2 produces exactly two sets.
- Composed Multiattack produces the correct number of identical unlabeled sets.
- Warrior sidekick levels 5, 6, and 15 produce 1, 2, and 3 supported attack sets respectively.
- Primal Companion Bestial Fury produces two sets when active.
- Multiattack and Extra Attack are not added together.

### Raw side-dice banks

- Compound formulas contribute the required raw die counts without semantic labels.
- Repeated dice such as `3d6` produce three individual values.
- Multiple options using the same die size use the maximum required count rather than the sum.
- Flat-only effects add no unnecessary side dice.
- Attack bonuses, save DCs, distances, durations, and usage counts do not create side dice.
- Injected output contains no attack, damage, healing, formula, type, modifier, or total labels.

### Sidekick spells

- A dice-bearing known or bonus cantrip or leveled spell produces one spell line containing raw side dice only.
- A leveled spell uses only its native primary data; `entriesHigherLevel` and all other upcast effects are ignored.
- A single-attack spell reuses the first shared sidekick d20 pair.
- Save-based and other non-attack spells add no d20 pair.
- A direct multi-attack spell expands the main-action portion of the shared turn-roll pool only when it requires more pairs than the sidekick's physical attack action.
- Physical Multiattack and direct spell attack counts use `max`, not addition; qualifying Bonus Action/additional-action grants are appended afterward.
- Eldritch Blast receives the correct number of d20 pairs and d10 values at each cantrip breakpoint.
- PHB 2024 word-based Eldritch Blast text resolves to 1/2/3/4 beams at levels 1/5/11/17.
- Native Scorching Ray produces exactly three attack pairs and six d6 values, regardless of higher spell slots the sidekick may possess.
- Steel Wind Strike supports up to five attack pairs and thirty d10 values for its native five-target action.
- Swift Quiver adds exactly two d20 pairs beyond the largest main-action sequence when the sidekick has a compatible Arrow- or Bolt-firing weapon.
- Each Swift Quiver pair carries an independently rolled copy of the compatible weapon's raw dice bank; it does not use generic spell dice.
- A Swift Quiver sidekick with Extra Attack x2 receives four total sets, while a sidekick whose largest main-action spell has five attacks receives seven.
- Swift Quiver adds no sets when no compatible configured weapon or enabled weapon-like action can be resolved.
- Spiritual Weapon, Bigby's Hand, Vampiric Touch, Grasping Vine, and Mordenkainen's Sword remain one attack for the current action; wording that permits another attack on a later turn does not multiply the snapshot.
- Blade Ward, Friends, True Strike, and Vicious Mockery do not falsely expand the d20 pool from incidental attack wording.
- Sorcerous Burst remains one attack despite using "ranged attack roll" rather than "spell attack" in its prose.
- A spell with no dice produces no roll entry unless it explicitly grants same-turn weapon attacks, as Swift Quiver does.
- Generic `{@dice ...}` spell data is included, not only `{@damage ...}` data.
- Cantrip dice counts match the sidekick's current level scaling without double-counting upgrade text.
- Known and bonus spell lists are deduplicated.

### Compatibility

- Manual player count and injected player output are unchanged.
- Manual Extra Ally and enemy rolls still work.
- Old roll snapshots without `companionRolls` render and inject safely.
- V2 character-bound companions are not duplicated when companion cards are active.
- Legacy, V1, and V2 modes load without import or syntax errors.

### Prompt keys

- `Fang` produces `fang_d20_1` and `fang_d20_2` for a single set.
- `Shadow Fang` produces the four-character base `shad`.
- Multiattack x2 produces `fang1_*` and `fang2_*` keys.
- Creatures with colliding bases receive distinct entity keys without colliding with set numbers.
- Repeated same-size side dice receive `_1`, `_2`, and subsequent suffixes.
- Existing user, ally, enemy, pool-dice, and non-combat key names are unchanged.

## Acceptance criteria

- Pressing the combat-roll button automatically rolls for every active roster creature.
- Every legal attack in a Multiattack/Extra Attack sequence has its own d20 pair.
- Every generated set contains the same compact raw dice bank derived from the creature's stat block.
- The LLM decides whether to use or ignore each set according to the narrative.
- Companion values use the existing roll-injection naming scheme with a unique, name-derived key.
- Every dice-bearing cantrip or native-level leveled spell known by an enabled spellcaster sidekick receives its own compact creature/spell-prefixed raw-dice line without a redundant per-spell d20 pair.
- Upcasting never changes a sidekick's injected spell dice or spell-derived attack count.
- The sidekick receives shared d20 pairs for the largest physical or direct spell-attack sequence it could choose as its main action.
- Swift Quiver appends two additional d20 pairs with the sidekick's compatible Arrow/Bolt weapon dice because those Bonus Action attacks can occur alongside the main action.
- Named roster results appear in the UI and in the injected `<dice>` section.
- Disabled creatures receive no rolls.
- The player-character dice workflow is unchanged.
