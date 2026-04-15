/**
 * D&D 5e Lite - Main Entry Point
 * Dice roller + Quest injector + Header info widgets for SillyTavern
 */

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';
import { extensionName, extensionSettings } from './src/core/state.js';
import { saveSettings, loadSettings, loadQuests, loadSpellLog } from './src/core/persistence.js';
import { onGenerationStarted, clearExtensionPrompts } from './src/generation/injector.js';
import { renderQuests, addQuestFromInput } from './src/rendering/quests.js';
import { renderSpellLog, addSpellFromInput, addRestFromButton } from './src/rendering/spellLog.js';
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
        refreshHeaderFromChat();
        refreshSpellLog();
        renderQuests();
        renderSpellLog();
        updateHeaderWidgets();
        updateStripWidgets();
        updateDiceDisplay();
    }
}

// ─── Refresh from chat ──────────────────────────────────────

function handleRefreshFromChat() {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) return;

    loadQuests();
    const headerResult = refreshHeaderFromChat();
    refreshSpellLog();

    renderQuests();
    renderSpellLog();
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

    // Try to parse header from the new message
    const result = updateHeaderFromMessage(message.mes);
    if (result) {
        updateHeaderWidgets();
        updateStripWidgets();
    }

    refreshSpellLog();
    renderSpellLog();
}

// ─── Chat changed ───────────────────────────────────────────

function onChatChanged() {
    if (!extensionSettings.enabled) return;

    loadQuests();
    loadSpellLog();
    refreshHeaderFromChat();
    refreshSpellLog();

    renderQuests();
    renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updatePowerButtonState();
}

// ─── Attribute editor ───────────────────────────────────────

function populateAttrEditor() {
    const grid = document.getElementById('dnd-attr-editor-grid');
    if (!grid) return;
    const attrs = extensionSettings.attributes;
    const labels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    grid.innerHTML = keys.map((k, i) =>
        `<div class="dnd-editor-attr">
            <label>${labels[i]}</label>
            <input type="number" data-attr="${k}" value="${attrs[k]}" min="1" max="30" />
        </div>`
    ).join('');
}

function saveAttrEditor() {
    const inputs = /** @type {NodeListOf<HTMLInputElement>} */ (
        document.querySelectorAll('#dnd-attr-editor-grid input[data-attr]')
    );
    inputs.forEach(inp => {
        const key = inp.dataset.attr;
        extensionSettings.attributes[key] = parseInt(inp.value) || 10;
    });
    saveSettings();
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
    loadSpellLog();
    refreshHeaderFromChat();
    refreshSpellLog();

    renderQuests();
    renderSpellLog();
    updateHeaderWidgets();
    updateDiceDisplay();
    updateStripWidgets();
    updatePowerButtonState();

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
    $('#dnd-add-rest-btn').on('click', () => {
        addRestFromButton();
    });

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
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    console.log('[D&D 5e Lite] Extension loaded');
});
