# D&D 5e Lite repository navigation

This directory is a browser-side SillyTavern extension. It is loaded as a native ES-module extension by SillyTavern; there is no local `package.json`, bundler, test runner, or build step in this repo. `manifest.json` declares `index.js` as the JavaScript entry point and `style.css` as the stylesheet.

## Start here

1. Read [`index.js`](index.js), especially the imports at the top, `initUI()` around line 3021, the chat/generation handlers around lines 2287–2417, and the entry point around line 4112.
2. Read [`src/core/state.js`](src/core/state.js) and [`src/core/persistence.js`](src/core/persistence.js) to understand what is runtime state versus persisted state.
3. Read [`src/generation/injector.js`](src/generation/injector.js) to understand what the extension sends to the LLM.
4. Read [`template.html`](template.html) for the DOM contract and [`style.css`](style.css) for the visual/layout contract.
5. Select the relevant mode: legacy, V1, or V2. The mode selector is in [`settings.html`](settings.html).

## High-level architecture

```text
SillyTavern
  ├─ loads manifest.json
  ├─ imports index.js
  │    ├─ loads template.html into <body>
  │    ├─ loads settings.html into the Extensions settings panel
  │    ├─ loads chat metadata into src/**/core state modules
  │    ├─ renders the panel and widgets
  │    └─ subscribes to SillyTavern eventSource events
  ├─ GENERATION_STARTED → src/generation/injector.js → setExtensionPrompt()
  ├─ MESSAGE_RECEIVED → header/spell refresh + V2 game_actions parser
  ├─ MESSAGE_SWIPED → refresh + revert/apply V2 game actions
  └─ CHAT_CHANGED → reload per-chat state and rerender
```

`index.js` is intentionally orchestration-heavy: most feature logic lives under `src/`, but DOM event binding and cross-mode routing are centralized there. Avoid moving behavior into the entry point unless it is genuinely orchestration or a UI callback.

## Directory map

| Path | Responsibility | Start with |
| --- | --- | --- |
| `manifest.json` | SillyTavern extension metadata and entry files | `js`, `css`, `loading_order` |
| `index.js` | Entry point, event wiring, modal callbacks, mode switching, UI lifecycle | imports; `initUI()`; `onMessageReceived()`; `onChatChanged()` |
| `template.html` | Complete panel, strip widgets, sections, inputs, and modal DOM | IDs beginning with `dnd-` |
| `settings.html` | Extensions-tab settings UI: enable, mode, milestone XP, V2 regex controls | `dnd-mode` radio group |
| `style.css` | All extension styles, responsive layout, widgets, modals, weather effects | selectors beginning with `.dnd-` |
| `src/core/` | Shared state, persistence, and data cache | `state.js`, `persistence.js`, `spellCache.js` |
| `src/features/` | Shared gameplay services: parsing, dice, spellbook, character data, sidekicks, weather, auto-backgrounds | feature-specific file |
| `src/generation/` | Shared prompt-section builders and prompt injection | `injector.js`, `promptBuilder.js` |
| `src/rendering/` | Shared legacy UI renderers and DOM event binding | renderer matching the section |
| `src/ui/` | Desktop/mobile layout and strip/header/minimap widgets | `desktop.js`, `layout.js`, `mobile.js` |
| `src/data/` | Static random-event table | `eventTable.js` |
| `src/v1/` | V1 character system, data, character prompt, companion UI | `core/`, `features/`, `rendering/configModal.js` |
| `src/v2/` | V2 character system, richer quests/inventory/companions, migration, tools | `core/`, `generation/`, `tools/` |

## Runtime lifecycle

### Startup

The jQuery-ready callback at the bottom of `index.js`:

- loads extension settings and migrates old V1/V2 flags into the `mode` field;
- injects `settings.html` into `#extensions_settings2`;
- binds enable/mode/milestone/regex controls;
- calls `initUI()` when enabled;
- registers `GENERATION_STARTED`, `MESSAGE_RECEIVED`, `MESSAGE_SWIPED`, and `CHAT_CHANGED` handlers.

`initUI()` appends `template.html`, applies layout, loads shared per-chat data, renders shared sections, then loads the selected V1/V2 character system. It also loads shared sidekicks and V2 companions. `destroyUI()` removes the panel and dynamically-created modal elements when the extension is disabled.

### Chat changes and refreshes

`onChatChanged()` reloads chat metadata into state, refreshes header/spell/background data, rerenders the shared UI, then loads the active character system and companion/sidekick data. The manual Refresh button follows the same pattern in `handleRefreshFromChat()`.

`onMessageReceived()` only processes assistant messages. It updates the status header, resets dice display, refreshes the spell log, evaluates auto-backgrounds, and, in V2, parses the assistant’s `game_actions` block.

`onMessageSwiped()` refreshes from the visible assistant swipe. In V2 it first reverts the previous parsed action backup and then applies actions from the new swipe.

## Modes

`extensionSettings.mode` is one of:

- `legacy`: shared/legacy character panel and shared quest/inventory UI.
- `v1`: V1 character sheet/builder plus the shared legacy quest/inventory UI.
- `v2`: V2 character sheet, V2 quest/inventory/companion data, V2 prompt sections, and inline game actions.

`v1Enabled` and `v2Enabled` are derived compatibility flags. Use `mode` for new branching; keep the flags synchronized through `syncModeFlags()` / `migrateSettingsToMode()` in `src/core/state.js`.

The mode switch is handled in `index.js` by `applyV1PanelVisibility()` and `applyV2Mode()`. V1 and V2 share the character container area in the template, while legacy character/spellbook panels are hidden when either full character system is active. The shared attribute editor is disabled for V1/V2 because those sheets provide their own stats.

## State and persistence

There are two persistence scopes:

1. Global extension settings: `context.extension_settings[extensionName]`, where `extensionName` is `third-party/rpg-dnd5e-lite`.
2. Current-chat metadata: SillyTavern’s imported `chat_metadata` object, saved with `saveChatDebounced()`.

The shared persistence module is the source of truth for storage keys and migrations. Do not invent a new key without adding a load/save path there.

| Scope | Keys / state | Owner |
| --- | --- | --- |
| Global settings | `enabled`, `softDisabled`, `mode`, injection depth, panel position, widget sizes, weather/lighting, dice/random-event settings, `milestoneXP`, auto-background presets | `src/core/state.js`, `src/core/persistence.js` |
| Chat attributes | `dnd5e_attribute_schema`, `dnd5e_attributes` | shared core |
| Legacy chat data | `dnd5e_quests`, `dnd5e_inventory`, spell log and tracker flags, spellbook, legacy character, sidekicks, event state, auto-background state | shared core |
| V1 character | `dnd5e_v1_character` | `src/v1/core/persistence.js` |
| V2 character | `dnd5e_v2_character` | `src/v2/core/characterPersist.js` |
| V2 gameplay | `dnd5e_v2_quests`, `dnd5e_v2_inventory`, `dnd5e_v2_companions`, `dnd5e_dataVersion` | `src/v2/core/persistence.js` |

Runtime modules hold mutable copies of chat data. A renderer normally mutates that runtime object, calls the matching save function, and rerenders. When changing state shape, update normalization/migration code as well as the renderer and prompt builder.

## Prompt and LLM integration

`src/generation/injector.js` is the central prompt boundary. On generation start it builds one consolidated block:

```xml
<dnd5e_game_state>
  character (V1 or V2)
  sidekicks and companions
  inventory and quests
  spell log, active effects, active spells
  combat tactics and dice, or non-combat dice
  optional random event
  V2 tool instructions
</dnd5e_game_state>
```

The block is injected through SillyTavern’s `setExtensionPrompt()` under `dnd5e-main` at `extensionSettings.injectionDepth`. System-role random events use a separate `dnd5e-random-event` prompt key. Old prompt keys are explicitly cleared for compatibility.

Prompt section ownership:

- Shared sections: `src/generation/promptBuilder.js`.
- V1 character section: `src/v1/generation/promptBuilder.js`.
- V2 character section: `src/v2/generation/characterPrompt.js`.
- V2 quest/inventory/tool/companion sections: `src/v2/generation/promptBuilder.js`.

When adding prompt state, update the appropriate builder and then add it to `buildConsolidatedPrompt()` in `injector.js`. If the state is mode-specific, make the mode branch explicit.

## V2 inline actions

V2 expects the model to emit a hidden block shaped like:

```html
<details><summary>game_actions</summary>
[{"tool":"quest","action":"add", ...}]
</details>
```

`src/v2/tools/inlineParser.js` parses the block, snapshots V2 quests/inventory/sidekicks, and routes each action to:

- `src/v2/tools/questTool.js`
- `src/v2/tools/inventoryTool.js`
- `src/v2/tools/sidekickInventoryTool.js`

Each tool persists and rerenders its own state. The parser exposes a one-level revert backup used by the header revert button and swipe handling. V2 installs a global SillyTavern regex named `D&D 5e - Strip game_actions` so the action block can be removed from displayed/prompt-formatted output while still being available to the extension parser. The regex management code is in `index.js` around lines 2947–3017, and the user-facing controls are in `settings.html`.

## Feature navigation

### Shared gameplay

- Header/status parsing: [`src/features/headerParser.js`](src/features/headerParser.js). Parses time, date, location, weather, spell slots, secondary resources, and unknown resource sections from assistant headers.
- Currency parsing: [`src/features/currencyParser.js`](src/features/currencyParser.js). Converts header currency text into strip/tooltip data.
- Spell tracking: [`src/features/spellTracker.js`](src/features/spellTracker.js). Scans recent assistant messages for casts, rests, concentration changes, and related actions.
- Spellbook: [`src/features/spellbook.js`](src/features/spellbook.js) and [`src/rendering/spellbook.js`](src/rendering/spellbook.js). Imports spell lists, fetches details, caches them, and renders tooltips.
- Dice/modifiers: [`src/features/dice.js`](src/features/dice.js) and [`src/features/modifiers.js`](src/features/modifiers.js). UI state is tied to the prompt builder’s combat/non-combat dice sections.
- Sidekicks: [`src/features/sidekick.js`](src/features/sidekick.js) owns creature/equipment/spell/feat lookup and derived stats; [`src/rendering/sidekick.js`](src/rendering/sidekick.js) renders the shared sidekick cards.
- Weather/background: [`src/features/weatherVisuals.js`](src/features/weatherVisuals.js), [`src/features/autoBackground.js`](src/features/autoBackground.js), and [`src/ui/desktop.js`](src/ui/desktop.js).
- Shared character reference: [`src/features/character.js`](src/features/character.js) fetches legacy class data and feeds [`src/rendering/character.js`](src/rendering/character.js).

### V1 and V2 character systems

`src/v1/` and `src/v2/` intentionally contain parallel copies of much of the class/species/background/spell/feat/equipment implementation. Compare the corresponding file before changing only one version. V2 adds newer effects/companion/free-cast/wondrous-item behavior, while the shared sidekick feature remains outside these trees.

For character calculations, inspect the relevant `features/` module first, then its `rendering/character.js` and `rendering/configModal.js`. Character data loading is separate from UI rendering:

- V1: `src/v1/core/state.js`, `src/v1/core/persistence.js`, `src/v1/features/*`, `src/v1/rendering/*`.
- V2: `src/v2/core/characterState.js`, `src/v2/core/characterPersist.js`, `src/v2/features/*`, `src/v2/rendering/*`.

V2 migration is handled by `src/v2/core/migration.js` and surfaced through `src/v2/rendering/migration.js`. It converts legacy quest/inventory/equipment data into V2 chat keys and records `dnd5e_dataVersion = 2`.

## External data and caching

Most class, species, feat, spell, bestiary, and equipment data comes from the 5etools mirror at `raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data`. The source adapters are `src/v1/data/sources.js` and `src/v2/data/sources.js`; shared legacy character and sidekick fetches also live under `src/features/`.

Use `src/core/spellCache.js` for fetches that should participate in the extension cache. It handles timeout/error behavior and cache invalidation helpers. Do not scatter raw `fetch()` calls into renderers. The settings modal exposes a spell DB cache refresh path wired from `index.js`.

The auto-background feature additionally calls SillyTavern’s `/api/backgrounds/all` endpoint. Treat network data as optional: existing modules generally return empty/null data and log warnings when a source is unavailable.

## DOM and styling contract

`template.html` is the source of truth for element IDs. Most JavaScript uses jQuery selectors or `document.getElementById()` with IDs such as `#dnd-panel`, `#dnd-v1-character-container`, `#dnd-v2-inventory-list`, and modal IDs. If a renderer adds a new selector, add the corresponding element to the template first.

Major DOM areas are:

- left secondary character panel (`#dnd-panel-left`);
- main right panel and collapsible strip widgets (`#dnd-panel`, `#dnd-strip-widget-container`);
- character, sidekick, companion, spellbook, quest, inventory, and spell-log sections;
- attribute/settings/random-event/auto-background/zoom/import/configuration modals.

`style.css` is large and uses the `dnd-` prefix. Keep new selectors namespaced to avoid collisions with SillyTavern. Layout behavior is split between CSS and `src/ui/layout.js`; desktop widget content is in `src/ui/desktop.js`, with mobile FAB behavior in `src/ui/mobile.js`.

## Safe change recipes

### Add a persisted field

1. Add a default in the owning `core/state.js`.
2. Add load/save behavior in the owning persistence module.
3. Normalize old/missing values while loading.
4. Update the relevant renderer and prompt builder.
5. Reload on `onChatChanged()` if it is per-chat data.

### Add a panel control

1. Add markup and a stable `dnd-` ID in `template.html` or `settings.html`.
2. Bind it in `index.js` or the renderer that owns the section.
3. Persist the setting/state through the appropriate module.
4. Make teardown safe if the UI can be disabled/recreated.
5. Add/update CSS in `style.css`.

### Add an LLM-managed V2 action

1. Add the action schema/instructions in `src/v2/generation/promptBuilder.js`.
2. Route the tool name in `src/v2/tools/inlineParser.js`.
3. Implement validation, mutation, persistence, and rerendering in a V2 tool module.
4. Include rollback data if the action touches another state collection.
5. Verify swipe/regenerate behavior, because the previous parse is reverted before a replacement is applied.

### Fix a header format

Start with the parser tests-by-inspection in `src/features/headerParser.js` and `src/features/currencyParser.js`, then check `updateHeaderFromMessage()` / `refreshHeaderFromChat()` callers and the desktop strip renderer. Header parsing affects both visible widgets and prompt state.

## Debugging checklist

- Confirm the extension is enabled in `settings.html` and `extensionSettings.enabled` is true.
- Check the browser console for `[D&D 5e Lite]`, `[D&D 5e V1]`, or `[D&D 5e V2]` logs.
- Use the in-extension “Debug: Loaded Modules” section to confirm the expected module tree.
- Inspect the current chat’s `chat_metadata` keys when state appears missing or stale.
- Click Refresh from chat after changing an assistant header or switching chats.
- For V2, check `dnd5e_dataVersion`, the global regex entry, and the revert button after an assistant action block.
- If a UI change does nothing, verify the element ID in `template.html` and whether the active mode hides that container.
- If data lookup fails, inspect `src/core/spellCache.js` behavior and the 5etools network request before changing UI code.

## Constraints and gotchas

- Preserve SillyTavern-relative import paths; the extension is nested deeply under `public/scripts/extensions/third-party/`.
- Keep `chat_metadata` data per-chat. Global extension settings are not a substitute for chat state.
- Use the setter functions exported by state modules for imported mutable bindings; do not reassign imported `let` bindings.
- V1/V2 are separate persisted character formats. Do not silently write V1 data into V2 keys or vice versa.
- V2 action indexes are generally 1-based in the prompt-facing tool handlers and converted to array indexes internally.
- Regeneration/swipes require rollback-aware logic because assistant messages can be replaced.
- Escape or sanitize user/model text before inserting it into `innerHTML`; follow nearby renderer patterns.
- When editing a large file, inspect `git diff` first and preserve unrelated worktree changes.
- There is no local automated test command documented by this repo. Validate syntax/module imports through SillyTavern and exercise the affected mode and chat lifecycle manually.

## Suggested reading order by task

| Task | Files |
| --- | --- |
| Understand startup or event behavior | `index.js` → `src/core/state.js` → `src/core/persistence.js` |
| Change what the model sees | `src/generation/injector.js` → relevant prompt builder → state/persistence |
| Change V2 game actions | `src/v2/generation/promptBuilder.js` → `src/v2/tools/inlineParser.js` → tool handler → V2 persistence/rendering |
| Change character calculations | relevant `src/v1/features/*` or `src/v2/features/*` → corresponding `rendering/character.js` → character prompt |
| Change panel layout/widgets | `template.html` → `src/ui/layout.js` / `src/ui/desktop.js` → `style.css` |
| Change header-driven behavior | `src/features/headerParser.js` → `src/features/weatherVisuals.js` / `src/ui/desktop.js` / `src/generation/promptBuilder.js` |
| Change external data loading | `src/*/data/sources.js` or feature fetcher → `src/core/spellCache.js` |
