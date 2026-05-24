/**
 * D&D 5e Lite - Main Entry Point
 * Dice roller + Quest injector + Header info widgets for SillyTavern
 */

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';
import { extensionName, extensionSettings, chatAttributes, chatAttributeSchema, defaultAttributeSchema, buildDefaultAttributes, spellTrackerDisabled, setSpellTrackerDisabled } from './src/core/state.js';
import { saveSettings, loadSettings, loadQuests, loadInventory, loadSpellLog, saveAttributes, loadAttributes, saveSpellTrackerDisabled, loadSpellTrackerDisabled } from './src/core/persistence.js';
import { onGenerationStarted, clearExtensionPrompts } from './src/generation/injector.js';
import { renderQuests, addQuestFromInput } from './src/rendering/quests.js';
import { renderInventory, addInventoryItemFromInput } from './src/rendering/inventory.js';
import { renderSpellLog, addSpellFromInput, addRestFromButton, addShortRestFromButton, hardRefreshSpellLogFromButton } from './src/rendering/spellLog.js';
import { refreshSpellLog } from './src/features/spellTracker.js';
import { rollD20, updateDiceDisplay, clearDiceRoll } from './src/features/dice.js';
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
        refreshHeaderFromChat();
        if (!spellTrackerDisabled) refreshSpellLog();
        renderQuests();
        renderInventory();
        if (!spellTrackerDisabled) renderSpellLog();
        updateHeaderWidgets();
        updateStripWidgets();
        updateDiceDisplay();
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

    // Auto-reset dice roll after every LLM reply so old rolls don't carry over
    clearDiceRoll();
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
    loadSpellLog();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();
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
    loadSpellLog();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateDiceDisplay();
    updateStripWidgets();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

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
        $('#dnd-setting-quest-depth').val(extensionSettings.questDepth ?? 4);
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
    $('#dnd-setting-quest-depth').on('change', function () {
        extensionSettings.questDepth = parseInt(String($(this).val())) || 4;
        saveSettings();
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
    $('#dnd-panel').remove();
    $('#dnd-mobile-toggle').remove();
    $('#dnd-attr-editor-popup').remove();
    $('#dnd-settings-popup').remove();
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
