/**
 * D&D 5e Lite - Main Entry Point
 * Dice roller + Quest injector + Header info widgets for SillyTavern
 */

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';
import { extensionName, extensionSettings, chatAttributes, chatAttributeSchema, defaultAttributeSchema, buildDefaultAttributes, spellTrackerDisabled, setSpellTrackerDisabled, sendAttributesOnRoll, setSendAttributesOnRoll, spellInjectEnabled, setSpellInjectEnabled, spellbook, character } from './src/core/state.js';
import { saveSettings, loadSettings, loadQuests, loadInventory, loadSpellLog, saveAttributes, loadAttributes, saveSpellTrackerDisabled, loadSpellTrackerDisabled, saveSendAttributesOnRoll, loadSendAttributesOnRoll, saveSpellInjectEnabled, loadSpellInjectEnabled, loadSpellbook, loadCharacter } from './src/core/persistence.js';
import { importSpellbook, clearSpellbook, ensureSpellData } from './src/features/spellbook.js';
import { renderSpellbook, hideSpellTooltip } from './src/rendering/spellbook.js';
import { fetchClassIndex, fetchClassData, listClasses, getSubclasses, saveCharacterConfig, clearCharacter, ensureCharacterData } from './src/features/character.js';
import { renderCharacter } from './src/rendering/character.js';
import { onGenerationStarted, clearExtensionPrompts } from './src/generation/injector.js';
import { renderQuests, addQuestFromInput } from './src/rendering/quests.js';
import { renderInventory, addInventoryItemFromInput } from './src/rendering/inventory.js';
import { renderSpellLog, addSpellFromInput, addRestFromButton, addShortRestFromButton, hardRefreshSpellLogFromButton } from './src/rendering/spellLog.js';
import { refreshSpellLog } from './src/features/spellTracker.js';
import { rollD20, updateDiceDisplay, clearDiceRoll, addDamageDie, updateDamageDisplay, clearDamageRoll, rollFavored, updateFavoredDisplay } from './src/features/dice.js';
import { refreshHeaderFromChat, updateHeaderFromMessage } from './src/features/headerParser.js';
import { updateStripWidgets, updateHeaderWidgets } from './src/ui/desktop.js';
import { setupMobileFab } from './src/ui/mobile.js';
import { setupCollapseToggle, applyPanelPosition, updatePanelVisibility, updateStripWidgetClass } from './src/ui/layout.js';
import { applyWeatherVisuals, destroyWeatherVisuals, rebuildWeatherParticles, refreshLightingOverlay } from './src/features/weatherVisuals.js';

// ─── Power toggle ───────────────────────────────────────────

function updatePowerButtonState() {
    const isOn = !extensionSettings.softDisabled;
    const $panel = $('#dnd-panel');

    $('#dnd-strip-power, #dnd-panel-power')
        .removeClass('dnd-power-on dnd-power-off')
        .addClass(isOn ? 'dnd-power-on' : 'dnd-power-off');

    if (isOn) {
        $panel.removeClass('dnd-powered-off');
    } else {
        $panel.addClass('dnd-powered-off');
    }
}

function togglePower() {
    extensionSettings.softDisabled = !extensionSettings.softDisabled;
    saveSettings();
    updatePowerButtonState();

    if (extensionSettings.softDisabled) {
        clearExtensionPrompts();
        destroyWeatherVisuals();
    } else {
        loadQuests();
        loadInventory();
        loadSpellTrackerDisabled();
        loadSendAttributesOnRoll();
        loadSpellInjectEnabled();
        refreshHeaderFromChat();
        if (!spellTrackerDisabled) refreshSpellLog();
        renderQuests();
        renderInventory();
        if (!spellTrackerDisabled) renderSpellLog();
        updateHeaderWidgets();
        updateStripWidgets();
        updateDiceDisplay();
        updateDamageDisplay();
        updateFavoredDisplay();
        updateSpellTrackerToggleUI();
    }
}

// ─── Spell tracker per-chat toggle ───────────────────────────

function updateSpellTrackerToggleUI() {
    const $btn = $('#dnd-spell-tracker-toggle');
    const $container = $('.dnd-spell-log-container');
    if (spellTrackerDisabled) {
        $btn.attr('title', 'Enable spell tracker for this chat')
            .html('<i class="fa-solid fa-toggle-off"></i>')
            .addClass('dnd-spell-tracker-off');
        $container.addClass('dnd-spell-tracker-disabled');
    } else {
        $btn.attr('title', 'Disable spell tracker for this chat')
            .html('<i class="fa-solid fa-toggle-on"></i>')
            .removeClass('dnd-spell-tracker-off');
        $container.removeClass('dnd-spell-tracker-disabled');
    }
}

function toggleSpellTracker() {
    setSpellTrackerDisabled(!spellTrackerDisabled);
    saveSpellTrackerDisabled(spellTrackerDisabled);
    updateSpellTrackerToggleUI();
    if (spellTrackerDisabled) {
        toastr.info('Spell tracker disabled for this chat');
    } else {
        refreshSpellLog();
        renderSpellLog();
        toastr.success('Spell tracker enabled for this chat');
    }
}

// ─── Spellbook UI helpers ────────────────────────────────────

function updateSpellbookVisibility() {
    const $container = $('#dnd-spellbook-container');
    if (spellbook?.items?.length) {
        $container.show();
    } else {
        $container.hide();
    }
}

function openSpellbookImportModal() {
    $('#dnd-spellbook-paste-input').val('');
    $('#dnd-spellbook-file-input').val('');
    $('#dnd-spellbook-import-error').hide().text('');
    $('#dnd-spellbook-import-popup').css('display', 'flex');
}

async function handleSpellbookImport(json) {
    const $error = $('#dnd-spellbook-import-error');
    const result = await importSpellbook(json);
    if (!result.ok) {
        $error.text(result.error).show();
        return;
    }
    $error.hide();
    $('#dnd-spellbook-import-popup').hide();
    renderSpellbook();
    updateSpellbookVisibility();
    toastr.success(`Loaded: ${result.name} (${result.count} spells)`);
}

function handleSpellbookFileRead(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            await handleSpellbookImport(json);
        } catch {
            $('#dnd-spellbook-import-error').text('Failed to parse JSON file.').show();
        }
    };
    reader.readAsText(file);
}

// ─── Character UI helpers ────────────────────────────────────

function updateCharacterVisibility() {
    const $container = $('#dnd-character-container');
    if (character) {
        $container.show();
    } else {
        $container.hide();
    }
}

let _charClassList = [];
let _charSubclassList = [];

async function openCharacterConfigModal() {
    const $error = $('#dnd-character-config-error');
    $error.hide().text('');

    const $classSelect = $('#dnd-char-class-select');
    const $sourceSelect = $('#dnd-char-source-select');
    const $subSelect = $('#dnd-char-subclass-select');
    const $level = $('#dnd-char-level-input');

    $classSelect.html('<option value="">-- Loading --</option>');
    $sourceSelect.html('<option value="">--</option>');
    $subSelect.html('<option value="">(None)</option>');
    $('#dnd-character-config-popup').css('display', 'flex');

    const index = await fetchClassIndex();
    if (!index) {
        $classSelect.html('<option value="">Failed to load</option>');
        return;
    }

    const uniqueNames = [...new Set(Object.keys(index).map(k => {
        const parts = k.replace(/^class-/, '').replace(/\.json$/, '').split('-');
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }))];

    _charClassList = Object.entries(index).map(([filename]) => {
        const cleanName = filename.replace(/^class-/, '').replace(/\.json$/, '');
        return { filename, cleanName };
    });

    $classSelect.html('<option value="">-- Select class --</option>');
    const seen = new Set();
    for (const entry of _charClassList) {
        if (seen.has(entry.cleanName)) continue;
        seen.add(entry.cleanName);
        const display = entry.cleanName.charAt(0).toUpperCase() + entry.cleanName.slice(1);
        $classSelect.append(`<option value="${entry.cleanName}">${display}</option>`);
    }

    if (character) {
        $classSelect.val(character.classFile?.replace(/^class-/, '').replace(/\.json$/, '') || '');
        $level.val(character.level || 1);
        if ($classSelect.val()) {
            await onCharClassChanged();
            if (character.classSource) {
                $sourceSelect.val(character.classSource);
                await onCharSourceChanged();
                if (character.subclassShortName && character.subclassSource) {
                    $subSelect.val(`${character.subclassShortName}|${character.subclassSource}`);
                }
            }
        }
    }
}

async function onCharClassChanged() {
    const cleanName = $('#dnd-char-class-select').val();
    const $sourceSelect = $('#dnd-char-source-select');
    const $subSelect = $('#dnd-char-subclass-select');
    $sourceSelect.html('<option value="">--</option>');
    $subSelect.html('<option value="">(None)</option>');
    _charSubclassList = [];

    if (!cleanName) return;

    const filename = `class-${cleanName}.json`;
    const data = await fetchClassData(filename);
    if (!data) {
        $sourceSelect.html('<option value="">Failed to load</option>');
        return;
    }

    const classes = listClasses(data);
    if (classes.length === 1) {
        $sourceSelect.html(`<option value="${classes[0].source}">${classes[0].source}</option>`);
        $sourceSelect.val(classes[0].source);
        await onCharSourceChanged();
    } else {
        $sourceSelect.html('<option value="">-- Select source --</option>');
        for (const c of classes) {
            $sourceSelect.append(`<option value="${c.source}">${c.name} (${c.source})</option>`);
        }
    }
}

async function onCharSourceChanged() {
    const cleanName = $('#dnd-char-class-select').val();
    const classSource = $('#dnd-char-source-select').val();
    const $subSelect = $('#dnd-char-subclass-select');
    $subSelect.html('<option value="">(None)</option>');
    _charSubclassList = [];

    if (!cleanName || !classSource) return;

    const filename = `class-${cleanName}.json`;
    const data = await fetchClassData(filename);
    if (!data) return;

    const classes = listClasses(data);
    const classObj = classes.find(c => c.source === classSource);
    if (!classObj) return;

    const subs = getSubclasses(data, classObj.name, classSource);
    _charSubclassList = subs;

    for (const s of subs) {
        $subSelect.append(`<option value="${s.shortName}|${s.source}">${s.name} (${s.source})</option>`);
    }
}

async function saveCharacterFromModal() {
    const cleanName = $('#dnd-char-class-select').val();
    const classSource = $('#dnd-char-source-select').val();
    const subVal = $('#dnd-char-subclass-select').val();
    const level = Math.max(1, Math.min(20, parseInt($('#dnd-char-level-input').val()) || 1));
    const $error = $('#dnd-character-config-error');

    if (!cleanName || !classSource) {
        $error.text('Select a class and source.').show();
        return;
    }

    const filename = `class-${cleanName}.json`;
    const data = await fetchClassData(filename);
    if (!data) {
        $error.text('Failed to load class data.').show();
        return;
    }

    const classes = listClasses(data);
    const classObj = classes.find(c => c.source === classSource);
    if (!classObj) {
        $error.text('Class not found in data.').show();
        return;
    }

    let subclassName = null, subclassShortName = null, subclassSource = null;
    if (subVal) {
        const [sn, ss] = subVal.split('|');
        const sub = _charSubclassList.find(s => s.shortName === sn && s.source === ss);
        if (sub) {
            subclassName = sub.name;
            subclassShortName = sub.shortName;
            subclassSource = sub.source;
        }
    }

    const config = {
        className: classObj.name,
        classSource,
        classFile: filename,
        subclassName,
        subclassShortName,
        subclassSource,
        level,
    };

    saveCharacterConfig(config);
    $error.hide();
    $('#dnd-character-config-popup').hide();
    renderCharacter();
    updateCharacterVisibility();
    toastr.success(`Character: ${config.className}${subclassName ? ` (${subclassName})` : ''} Lv ${level}`);
}

// ─── Refresh from chat ──────────────────────────────────────

function handleRefreshFromChat() {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) return;

    loadQuests();
    loadInventory();
    const headerResult = refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateFavoredDisplay();

    if (headerResult) {
        toastr.success('Refreshed from chat');
    } else {
        toastr.info('Quests refreshed (no header found)');
    }
}

// ─── Message received (auto-update header) ──────────────────

function onMessageReceived(messageIndex) {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) return;

    const context = getContext();
    const message = context.chat?.[messageIndex];
    if (!message || message.is_user) return;

    // Auto-reset dice rolls after every LLM reply so old rolls don't carry over
    clearDiceRoll();
    clearDamageRoll();
    updateStripWidgets();

    const result = updateHeaderFromMessage(message.mes);
    if (result) {
        updateHeaderWidgets();
        updateStripWidgets();
    }

    if (!spellTrackerDisabled) {
        refreshSpellLog();
        renderSpellLog();
    }
}

// ─── Message swiped (refresh state from newly visible swipe) ─

function onMessageSwiped(messageIndex) {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) return;

    const context = getContext();
    const message = context.chat?.[messageIndex];
    if (!message || message.is_user) return;

    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    updateHeaderWidgets();
    updateStripWidgets();
    if (!spellTrackerDisabled) renderSpellLog();
    applyWeatherVisuals();
}

// ─── Chat changed ───────────────────────────────────────────

function onChatChanged() {
    if (!extensionSettings.enabled) return;

    loadAttributes();
    loadQuests();
    loadInventory();
    loadSpellTrackerDisabled();
    loadSendAttributesOnRoll();
    loadSpellInjectEnabled();
    loadSpellLog();
    loadSpellbook();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateFavoredDisplay();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

    ensureSpellData().then(() => renderSpellbook());
    updateSpellbookVisibility();

    loadCharacter();
    ensureCharacterData().then(() => {
        renderCharacter();
        updateCharacterVisibility();
    });
}

// ─── Attribute editor ───────────────────────────────────────

function populateAttrEditor() {
    const list = document.getElementById('dnd-attr-editor-list');
    if (!list) return;

    const schema = chatAttributeSchema;
    const attrs = chatAttributes;

    list.innerHTML = schema.map((s, i) =>
        `<div class="dnd-attr-row" data-index="${i}">
            <input type="text" class="dnd-attr-label-input" data-field="label" value="${s.label}" placeholder="Name" maxlength="16" />
            <input type="number" class="dnd-attr-value-input" data-field="value" data-key="${s.key}" value="${attrs[s.key] ?? 10}" min="1" max="30" />
            <button class="dnd-attr-remove-btn" title="Remove attribute"><i class="fa-solid fa-trash-can"></i></button>
        </div>`
    ).join('');
}

function addAttrRow() {
    const list = document.getElementById('dnd-attr-editor-list');
    if (!list) return;
    const idx = list.children.length;
    const key = `attr_${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'dnd-attr-row';
    row.dataset.index = String(idx);
    row.innerHTML = `
        <input type="text" class="dnd-attr-label-input" data-field="label" value="" placeholder="Name" maxlength="16" />
        <input type="number" class="dnd-attr-value-input" data-field="value" data-key="${key}" value="10" min="1" max="30" />
        <button class="dnd-attr-remove-btn" title="Remove attribute"><i class="fa-solid fa-trash-can"></i></button>
    `;
    list.appendChild(row);
}

function resetAttrDefaults() {
    const list = document.getElementById('dnd-attr-editor-list');
    if (!list) return;

    const defaults = buildDefaultAttributes(defaultAttributeSchema);
    list.innerHTML = defaultAttributeSchema.map((s, i) =>
        `<div class="dnd-attr-row" data-index="${i}">
            <input type="text" class="dnd-attr-label-input" data-field="label" value="${s.label}" placeholder="Name" maxlength="16" />
            <input type="number" class="dnd-attr-value-input" data-field="value" data-key="${s.key}" value="${defaults[s.key]}" min="1" max="30" />
            <button class="dnd-attr-remove-btn" title="Remove attribute"><i class="fa-solid fa-trash-can"></i></button>
        </div>`
    ).join('');
}

function saveAttrEditor() {
    const rows = document.querySelectorAll('#dnd-attr-editor-list .dnd-attr-row');
    const schema = [];
    const attrs = {};

    rows.forEach(row => {
        const labelInput = /** @type {HTMLInputElement} */ (row.querySelector('.dnd-attr-label-input'));
        const valueInput = /** @type {HTMLInputElement} */ (row.querySelector('.dnd-attr-value-input'));
        const label = (labelInput.value || '').trim();
        if (!label) return;

        const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        schema.push({ key, label });
        attrs[key] = parseInt(valueInput.value) || 10;
    });

    Object.assign(chatAttributes, attrs);
    // Remove keys that are no longer in the schema
    const validKeys = new Set(schema.map(s => s.key));
    for (const k of Object.keys(chatAttributes)) {
        if (!validKeys.has(k)) delete chatAttributes[k];
    }

    chatAttributeSchema.length = 0;
    chatAttributeSchema.push(...schema);

    saveAttributes(schema, chatAttributes);
}

// ─── UI init / teardown ─────────────────────────────────────

async function initUI() {
    if (!extensionSettings.enabled) return;

    const templateHtml = await renderExtensionTemplateAsync(extensionName, 'template');
    $('body').append(templateHtml);

    // Layout
    applyPanelPosition();
    setupCollapseToggle();
    updatePanelVisibility();
    updateStripWidgetClass();
    setupMobileFab();

    // Load data and render
    loadQuests();
    loadInventory();
    loadSpellTrackerDisabled();
    loadSendAttributesOnRoll();
    loadSpellInjectEnabled();
    loadSpellLog();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateFavoredDisplay();
    updateStripWidgets();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

    // Spellbook
    loadSpellbook();
    ensureSpellData().then(() => renderSpellbook());
    updateSpellbookVisibility();

    // Character
    loadCharacter();
    ensureCharacterData().then(() => {
        renderCharacter();
        updateCharacterVisibility();
    });

    // ─── Event bindings ─────────────────────────────────

    // Power toggle
    $('#dnd-strip-power, #dnd-panel-power').on('click', togglePower);

    // Refresh buttons (both strip and expanded)
    $('#dnd-strip-reload, #dnd-refresh-btn').on('click', handleRefreshFromChat);

    // Dice — expanded panel roll button
    $('#dnd-roll-btn').on('click', () => {
        rollD20();
        updateStripWidgets();
    });
    $('#dnd-clear-roll').on('click', () => {
        clearDiceRoll();
        updateStripWidgets();
    });

    // Damage dice — each click adds one die to the pool
    $('.dnd-damage-die-btn').on('click', function () {
        const sides = parseInt($(this).data('sides'));
        addDamageDie(sides);
        updateStripWidgets();
    });
    $('#dnd-damage-clear').on('click', () => {
        clearDamageRoll();
        updateStripWidgets();
    });
    $('#dnd-favored-btn').on('click', () => {
        rollFavored();
    });

    // Quest — inline add
    $('#dnd-add-quest-btn').on('click', () => {
        addQuestFromInput();
        updateStripWidgets();
    });
    $('#dnd-add-quest-input').on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addQuestFromInput();
            updateStripWidgets();
        }
    });

    // Inventory — inline add
    $('#dnd-add-inventory-btn').on('click', () => {
        addInventoryItemFromInput();
    });
    $('#dnd-add-inventory-input').on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addInventoryItemFromInput();
        }
    });

    // Spell log — inline add spell + rest
    $('#dnd-add-spell-btn').on('click', () => {
        addSpellFromInput();
    });
    $('#dnd-add-spell-input').on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSpellFromInput();
        }
    });
    $('#dnd-add-short-rest-btn').on('click', () => {
        addShortRestFromButton();
    });
    $('#dnd-add-rest-btn').on('click', () => {
        addRestFromButton();
    });

    // Spell log — dedicated refresh (wipe + rebuild from chat)
    $('#dnd-spell-log-refresh').on('click', () => {
        hardRefreshSpellLogFromButton();
        toastr.success('Spell log rebuilt from chat');
    });

    // Spell tracker — per-chat disable toggle
    $('#dnd-spell-tracker-toggle').on('click', toggleSpellTracker);
    updateSpellTrackerToggleUI();

    // Spellbook button — click to toggle, shift+click to import
    $('#dnd-spellbook-btn').on('click', (e) => {
        if (e.shiftKey) {
            openSpellbookImportModal();
        } else if (spellbook?.items?.length) {
            $('#dnd-spellbook-container').toggle();
        } else {
            openSpellbookImportModal();
        }
    });

    // Spellbook clear
    $('#dnd-spellbook-clear').on('click', () => {
        clearSpellbook();
        renderSpellbook();
        updateSpellbookVisibility();
        hideSpellTooltip();
        toastr.info('Spellbook removed');
    });

    // Spellbook import modal
    $('#dnd-spellbook-import-close').on('click', () => $('#dnd-spellbook-import-popup').hide());
    $('#dnd-spellbook-file-input').on('change', function () {
        handleSpellbookFileRead(this.files[0]);
    });
    $('#dnd-spellbook-dropzone').on('click', (e) => {
        if (e.target.id !== 'dnd-spellbook-file-input') {
            document.getElementById('dnd-spellbook-file-input').click();
        }
    });
    $('#dnd-spellbook-dropzone').on('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        $('#dnd-spellbook-dropzone').addClass('dnd-spellbook-dropzone-hover');
    });
    $('#dnd-spellbook-dropzone').on('dragleave drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        $('#dnd-spellbook-dropzone').removeClass('dnd-spellbook-dropzone-hover');
    });
    $('#dnd-spellbook-dropzone').on('drop', (e) => {
        const file = e.originalEvent.dataTransfer?.files?.[0];
        handleSpellbookFileRead(file);
    });
    $('#dnd-spellbook-import-btn').on('click', async () => {
        const text = $('#dnd-spellbook-paste-input').val()?.trim();
        if (!text) {
            $('#dnd-spellbook-import-error').text('Paste JSON or use the file input above.').show();
            return;
        }
        try {
            const json = JSON.parse(text);
            await handleSpellbookImport(json);
        } catch {
            $('#dnd-spellbook-import-error').text('Invalid JSON syntax.').show();
        }
    });

    // Character button — click to toggle, shift+click to configure
    $('#dnd-character-btn').on('click', (e) => {
        if (e.shiftKey) {
            openCharacterConfigModal();
        } else if (character) {
            $('#dnd-character-container').toggle();
        } else {
            openCharacterConfigModal();
        }
    });

    // Character clear
    $('#dnd-character-clear').on('click', () => {
        clearCharacter();
        renderCharacter();
        updateCharacterVisibility();
        toastr.info('Character removed');
    });

    // Character config modal
    $('#dnd-character-config-close').on('click', () => $('#dnd-character-config-popup').hide());
    $('#dnd-char-class-select').on('change', onCharClassChanged);
    $('#dnd-char-source-select').on('change', onCharSourceChanged);
    $('#dnd-character-config-save').on('click', saveCharacterFromModal);

    // Attribute editor modal
    $('#dnd-open-attr-editor').on('click', () => {
        populateAttrEditor();
        $('#dnd-attr-editor-popup').css('display', 'flex');
    });
    $('#dnd-attr-editor-close').on('click', () => $('#dnd-attr-editor-popup').hide());
    $('#dnd-attr-editor-save').on('click', () => {
        saveAttrEditor();
        $('#dnd-attr-editor-popup').hide();
        toastr.success('Attributes saved');
    });
    $('#dnd-attr-add').on('click', addAttrRow);
    $('#dnd-attr-reset-defaults').on('click', resetAttrDefaults);
    $(document).on('click', '.dnd-attr-remove-btn', function () {
        $(this).closest('.dnd-attr-row').remove();
    });

    // Settings modal
    $('#dnd-open-settings').on('click', () => {
        $('#dnd-setting-strip-widgets').prop('checked', extensionSettings.stripWidgetsEnabled);
        $('#dnd-setting-position').val(extensionSettings.panelPosition || 'right');
        $('#dnd-setting-injection-depth').val(extensionSettings.injectionDepth ?? 0);
        $('#dnd-setting-send-attributes').prop('checked', sendAttributesOnRoll);
        $('#dnd-setting-spell-inject').prop('checked', spellInjectEnabled);
        $('#dnd-setting-weather-visuals').prop('checked', extensionSettings.weatherVisuals?.enabled ?? true);
        $('#dnd-setting-weather-particles').val(extensionSettings.weatherVisuals?.particleCount ?? 200);
        $('#dnd-setting-lighting-overlay').prop('checked', extensionSettings.lightingOverlay?.enabled ?? true);
        const lIntensity = extensionSettings.lightingOverlay?.intensity ?? 1.0;
        $('#dnd-setting-lighting-intensity').val(lIntensity);
        $('#dnd-setting-lighting-intensity-val').text(lIntensity.toFixed(2));
        $('#dnd-setting-lighting-blend').val(extensionSettings.lightingOverlay?.blendMode ?? 'soft-light');
        $('#dnd-settings-popup').css('display', 'flex');
    });
    $('#dnd-settings-close').on('click', () => $('#dnd-settings-popup').hide());

    $('#dnd-setting-strip-widgets').on('change', function () {
        extensionSettings.stripWidgetsEnabled = $(this).prop('checked');
        saveSettings();
        updateStripWidgetClass();
        updateStripWidgets();
    });
    $('#dnd-setting-position').on('change', function () {
        extensionSettings.panelPosition = String($(this).val());
        saveSettings();
        applyPanelPosition();
    });
    $('#dnd-setting-injection-depth').on('change', function () {
        extensionSettings.injectionDepth = parseInt(String($(this).val())) || 0;
        saveSettings();
    });
    $('#dnd-setting-send-attributes').on('change', function () {
        setSendAttributesOnRoll($(this).prop('checked'));
        saveSendAttributesOnRoll(sendAttributesOnRoll);
    });
    $('#dnd-setting-spell-inject').on('change', function () {
        setSpellInjectEnabled($(this).prop('checked'));
        saveSpellInjectEnabled(spellInjectEnabled);
    });

    // Weather visuals settings
    $('#dnd-setting-weather-visuals')
        .prop('checked', extensionSettings.weatherVisuals?.enabled ?? true)
        .on('change', function () {
            extensionSettings.weatherVisuals.enabled = $(this).prop('checked');
            saveSettings();
            if (extensionSettings.weatherVisuals.enabled) {
                applyWeatherVisuals();
            } else {
                destroyWeatherVisuals();
            }
        });
    $('#dnd-setting-weather-particles')
        .val(extensionSettings.weatherVisuals?.particleCount ?? 200)
        .on('input', function () {
            extensionSettings.weatherVisuals.particleCount = parseInt(String($(this).val())) || 0;
            saveSettings();
            rebuildWeatherParticles();
        });

    // Lighting overlay settings
    $('#dnd-setting-lighting-overlay')
        .prop('checked', extensionSettings.lightingOverlay?.enabled ?? true)
        .on('change', function () {
            extensionSettings.lightingOverlay.enabled = $(this).prop('checked');
            saveSettings();
            refreshLightingOverlay();
        });
    $('#dnd-setting-lighting-intensity')
        .val(extensionSettings.lightingOverlay?.intensity ?? 1.0)
        .on('input', function () {
            const val = parseFloat(String($(this).val())) || 0;
            extensionSettings.lightingOverlay.intensity = val;
            $('#dnd-setting-lighting-intensity-val').text(val.toFixed(2));
            saveSettings();
            refreshLightingOverlay();
        });
    $('#dnd-setting-lighting-blend')
        .val(extensionSettings.lightingOverlay?.blendMode ?? 'soft-light')
        .on('change', function () {
            extensionSettings.lightingOverlay.blendMode = String($(this).val());
            saveSettings();
            refreshLightingOverlay();
        });
}

function destroyUI() {
    clearExtensionPrompts();
    destroyWeatherVisuals();
    hideSpellTooltip();
    $('#dnd-panel').remove();
    $('#dnd-mobile-toggle').remove();
    $('#dnd-attr-editor-popup').remove();
    $('#dnd-settings-popup').remove();
    $('#dnd-spellbook-import-popup').remove();
    $('#dnd-character-config-popup').remove();
}

// ─── Entry point ────────────────────────────────────────────

jQuery(async () => {
    loadSettings();

    // Settings panel in Extensions tab
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');
    $('#extensions_settings2').append(settingsHtml);

    $('#dnd-extension-enabled').prop('checked', extensionSettings.enabled).on('change', async function () {
        const wasEnabled = extensionSettings.enabled;
        extensionSettings.enabled = $(this).prop('checked');
        saveSettings();

        if (!extensionSettings.enabled && wasEnabled) {
            destroyUI();
        } else if (extensionSettings.enabled && !wasEnabled) {
            await initUI();
        }
    });

    // Initial UI load if enabled
    if (extensionSettings.enabled) {
        await initUI();
    }

    // Delegated handlers (survive DOM destroy/recreate)
    $(document).on('click', '.dnd-modal-overlay', function (e) {
        if (e.target === this) $(this).hide();
    });

    // SillyTavern events
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    console.log('[D&D 5e Lite] Extension loaded');
});
