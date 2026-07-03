/**
 * D&D 5e Lite - Main Entry Point
 * Dice roller + Quest injector + Header info widgets for SillyTavern
 */

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extensionName, extensionSettings, chatAttributes, chatAttributeSchema, defaultAttributeSchema, buildDefaultAttributes, spellTrackerDisabled, setSpellTrackerDisabled, sendAttributesOnRoll, setSendAttributesOnRoll, spellInjectEnabled, setSpellInjectEnabled, autoLongRestEnabled, setAutoLongRestEnabled, character, sidekicks, headerInfo, lastEventRoll, lastNonCombatRoll, migrateSettingsToMode, syncModeFlags } from './src/core/state.js';
import { saveSettings, loadSettings, loadQuests, loadInventory, loadSpellLog, saveAttributes, loadAttributes, saveSpellTrackerDisabled, loadSpellTrackerDisabled, saveSendAttributesOnRoll, loadSendAttributesOnRoll, saveSpellInjectEnabled, loadSpellInjectEnabled, saveAutoLongRest, loadAutoLongRest, loadSpellbook, loadCharacter, saveSidekicks, loadSidekicks, loadRandomEventState, saveRandomEventState, loadAutoBackgrounds } from './src/core/persistence.js';
import { importSpellbook, clearSpellbook, ensureSpellData } from './src/features/spellbook.js';
import { renderSpellbook, hideSpellTooltip } from './src/rendering/spellbook.js';
import { fetchClassIndex, fetchClassData, listClasses, getSubclasses, saveCharacterConfig, clearCharacter, ensureCharacterData } from './src/features/character.js';
import { renderCharacter } from './src/rendering/character.js';
import { renderSidekickCards, renderSidekickDetail } from './src/rendering/sidekick.js';
import { SIDEKICK_TYPES, ASI_LEVELS, ALL_SKILLS, SKILL_LABELS, CANTRIP_PROGRESSION, SPELLS_KNOWN_PROGRESSION, CREATURE_TYPES, SPELL_SCHOOLS, SIDEKICK_MAX_ATTUNEMENT, getSidekickAttunedCount, fetchBestiaryIndex, fetchBestiarySource, preloadBestiarySources, getAvailableSourceKeys, getLoadedSourceKeys, searchCreatures, findCreatureVersions, getCreatureStats, fetchEquipmentItems, fetchMagicItems, isMagicWeaponsLoaded, extractCreatureActions, extractCreatureTraits, extractCreatureSkillProficiencies, createSidekickFromCreature, getSidekickLevel, getMaxSpellLevel, preloadSpellData, getSpellsForClass, getAllLoadedSpells, spellSchoolLabel, searchEquipment, searchMagicItems, weaponFromItem, armorFromItem, shieldFromItem, computeEquippedAC, DND_LANGUAGES, parseCreatureLanguages, getSpellDamageInfo, fetchFeats, getLoadedFeats, parseFeatAbility, checkFeatPrereqs, lookupFeatByName, lookupItemByName } from './src/features/sidekick.js';
import { getFeatUIDescriptor, DND_TOOLS } from './src/features/featEffects.js';
import { bindTooltipEvents, hideTooltip, showEventTooltip } from './src/rendering/tooltip.js';
import { onGenerationStarted, clearExtensionPrompts } from './src/generation/injector.js';
import { DEFAULT_SEVERITY_TIERS, getSeverityTiers } from './src/features/randomEvents.js';
import { renderQuests, addQuestFromInput } from './src/rendering/quests.js';
import { renderInventory, addInventoryItemFromInput } from './src/rendering/inventory.js';
import { renderSpellLog, addSpellFromInput, addRestFromButton, addShortRestFromButton, addDispelFromButton, addDropConcFromButton, hardRefreshSpellLogFromButton } from './src/rendering/spellLog.js';
import { refreshSpellLog, hardRefreshSpellLog } from './src/features/spellTracker.js';
import { rollD20, updateDiceDisplay, clearDiceRoll, addDamageDie, removeDamageDie, updateDamageDisplay, clearDamageRoll, toggleModifier, updateModifierDisplay, clearModifiers, updatePlayerCountLabel, updateAllyCountLabel, updateEnemyCountLabel, renderModifierButtons } from './src/features/dice.js';
import { refreshHeaderFromChat, updateHeaderFromMessage } from './src/features/headerParser.js';
import { updateStripWidgets, updateHeaderWidgets, getOmniWidgetSizes, DEFAULT_OMNI_WIDGET_SIZES } from './src/ui/desktop.js';
import { setupMobileFab } from './src/ui/mobile.js';
import { setupCollapseToggle, applyPanelPosition, updatePanelVisibility, updateStripWidgetClass } from './src/ui/layout.js';
import { applyWeatherVisuals, destroyWeatherVisuals, rebuildWeatherParticles, refreshLightingOverlay } from './src/features/weatherVisuals.js';
import { evaluateAutoBackground, resetAutoBackgroundState, openAutoBackgroundModal, saveAutoBackgroundModal, addAutoBackgroundEntry, removeAutoBackgroundEntry } from './src/features/autoBackground.js';
import { loadCharacterV1, saveCharacterV1 } from './src/v1/core/persistence.js';
import { characterV1, setCharacterV1 } from './src/v1/core/state.js';
import { renderV1CharacterPanel } from './src/v1/rendering/character.js';
import { renderV1DetailModal } from './src/v1/rendering/detail.js';
import { openV1ConfigModal } from './src/v1/rendering/configModal.js';
import { renderV1Spellbook, initV1Spellbook } from './src/v1/rendering/spellbook.js';
import { preloadSpellData as preloadV1SpellData } from './src/v1/features/spells.js';
import { preloadSpellData as preloadV2SpellData } from './src/v2/features/spells.js';
import { fetchClassFile } from './src/v1/data/sources.js';
import { renderV1CompanionPanel, initCompanionPanel } from './src/v1/rendering/companion.js';
import { listCustomSpecies, createCustomSpecies, updateCustomSpecies, deleteCustomSpecies, blankCustomSpecies } from './src/v1/features/customSpecies.js';
import { CREATURE_TYPES as V1_CREATURE_TYPES, DAMAGE_TYPES, ABILITY_KEYS as V1_ABILITY_KEYS, ABILITY_LABELS as V1_ABILITY_LABELS } from './src/v1/core/constants.js';

// V2 Inline Game Actions
import { v2Quests, v2Inventory } from './src/v2/core/state.js';
import { loadV2Quests, loadV2Inventory, saveV2Quests, saveV2Inventory, getChatDataVersion, loadV2Companions } from './src/v2/core/persistence.js';
import { hasV1DataToMigrate, isChatV2, executeV2Migration } from './src/v2/core/migration.js';
import { parseAndApplyGameActions, hasGameActionBackup, revertGameActions } from './src/v2/tools/inlineParser.js';
import { renderV2Quests, addV2QuestFromInput } from './src/v2/rendering/quests.js';
import { renderV2Inventory, addV2InventoryItemFromInput } from './src/v2/rendering/inventory.js';
import { showV2MigrationModal } from './src/v2/rendering/migration.js';
import { characterV2, setCharacterV2 } from './src/v2/core/characterState.js';
import { loadCharacterV2, saveCharacterV2 } from './src/v2/core/characterPersist.js';
import { renderV2CharacterPanel } from './src/v2/rendering/character.js';
import { renderV2DetailModal } from './src/v2/rendering/detail.js';
import { openV2ConfigModal } from './src/v2/rendering/configModal.js';
import { renderV2Spellbook, initV2Spellbook } from './src/v2/rendering/spellbook.js';
import { openSpellSearchModal } from './src/v2/rendering/spellSearch.js';
import { renderCompanionCards, renderCompanionDetail, openCompanionEditModal, saveCompanionFromEditModal, openCompanionWizard } from './src/v2/rendering/companionCards.js';
import { toggleCompanionEnabled, deleteCompanion } from './src/v2/features/companion.js';

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
        loadAutoLongRest();
        refreshHeaderFromChat();
        if (!spellTrackerDisabled) refreshSpellLog();
        renderQuests();
        renderInventory();
        if (!spellTrackerDisabled) renderSpellLog();
        updateHeaderWidgets();
        updateStripWidgets();
        updateDiceDisplay();
        updateDamageDisplay();
        updateModifierDisplay();
        updateSpellTrackerToggleUI();

        if (extensionSettings.v2Enabled) {
            loadCharacterV2();
            loadV2Quests();
            loadV2Inventory();
            loadV2Companions();
            renderV2Quests();
            renderV2Inventory();
            renderCompanionCards();
        }

        loadSidekicks();
        renderSidekickCards();
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
    $('#dnd-spellbook-container').removeClass('dnd-collapsed');
    toastr.success(`Loaded: ${result.name} (${result.count} spells)`);
}

function handleSpellbookFileRead(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(/** @type {string} */ (e.target.result));
            await handleSpellbookImport(json);
        } catch {
            $('#dnd-spellbook-import-error').text('Failed to parse JSON file.').show();
        }
    };
    reader.readAsText(file);
}

// ─── Character UI helpers ────────────────────────────────────

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
    const cleanName = /** @type {string} */ ($('#dnd-char-class-select').val());
    const classSource = /** @type {string} */ ($('#dnd-char-source-select').val());
    const subVal = /** @type {string} */ ($('#dnd-char-subclass-select').val());
    const level = Math.max(1, Math.min(20, parseInt(String($('#dnd-char-level-input').val())) || 1));
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
    $('#dnd-character-container').removeClass('dnd-collapsed');
    toastr.success(`Character: ${config.className}${subclassName ? ` (${subclassName})` : ''} Lv ${level}`);
}

// ─── Sidekick UI helpers ─────────────────────────────────────

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

let _skEditId = null;
let _skTempCreature = null;
let _skTempActions = [];
let _skTempTraits = [];
let _skTempWeapons = [];
let _skTempCantrips = [];
let _skTempSpells = [];
let _skTempItems = [];
let _skTempArmorAttuned = false;
let _skSelectedShieldName = null;
let _skTempShieldAttuned = false;

function getTempAttunedCount() {
    let count = 0;
    if (_skTempArmorAttuned) count++;
    if (_skTempShieldAttuned) count++;
    count += _skTempWeapons.filter(w => w.attuned).length;
    count += _skTempItems.filter(it => it.attuned).length;
    return count;
}

function toggleSidekickEnabled(id) {
    const sk = sidekicks.find(s => s.id === id);
    if (!sk) return;
    sk.enabled = !sk.enabled;
    saveSidekicks(sidekicks);
    renderSidekickCards();
}

function openSidekickDetailModal(id) {
    renderSidekickDetail(id);
    const $popup = $('#dnd-sidekick-detail-popup');
    $popup.css('display', 'flex');
    $popup.find('.dnd-modal-body').attr('data-sidekick-id', id);
    bindTooltipEvents($popup[0]);
}

function deleteSidekick(id) {
    const idx = sidekicks.findIndex(s => s.id === id);
    if (idx < 0) return;
    const name = sidekicks[idx].name || 'this sidekick';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    sidekicks.splice(idx, 1);
    saveSidekicks(sidekicks);
    renderSidekickCards();
    $('#dnd-sidekick-detail-popup').hide();
    toastr.info(`Sidekick "${name}" deleted`);
}

async function openSidekickConfigModal(editId) {
    _skEditId = editId || null;
    _skTempCreature = null;
    _skTempActions = [];
    _skTempTraits = [];
    _skTempWeapons = [];
    _skTempCantrips = [];
    _skTempSpells = [];
    _skTempChosenLanguages = [];
    _skTempItems = [];
    Object.keys(_skFeatSpellData).forEach(k => delete _skFeatSpellData[k]);

    const $popup = $('#dnd-sidekick-config-popup');
    const $error = $('#dnd-sk-config-error');
    $error.hide().text('');

    $('#dnd-sk-config-title').text(editId ? 'Edit Sidekick' : 'Add Sidekick');
    $('#dnd-sk-config-id').val(editId || '');
    $('#dnd-sk-name').val('');
    $('#dnd-sk-race').val('');
    $('#dnd-sk-type').val('');
    $('#dnd-sk-subtype-row').hide();
    $('#dnd-sk-creature-search').val('');
    const $typeFilter = $('#dnd-sk-creature-type-filter');
    $typeFilter.html('<option value="">All types</option>');
    for (const t of CREATURE_TYPES) {
        $typeFilter.append(`<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`);
    }
    $('#dnd-sk-creature-dropdown').html('<div class="dnd-sk-dd-empty">Pick a creature type or search by name</div>');
    $('#dnd-sk-source-row').hide();
    $('#dnd-sk-creature-preview').hide().html('');
    $('#dnd-sk-prof-section').hide();
    $('#dnd-sk-asi-section').hide();
    $('#dnd-sk-equip-section').hide();
    $('#dnd-sk-spells-section').hide();
    $('#dnd-sk-hire-gold').val(0);
    $('#dnd-sk-hire-gold-row').show();
    $('#dnd-sk-hire-paymode').val('owed');
    $('#dnd-sk-hire-paid').val(0);
    $('#dnd-sk-hire-paid-row').show();
    $('#dnd-sk-hire-quest-row').hide();
    $('#dnd-sk-hire-quest-amount').val(0);
    $('#dnd-sk-hire-quest-paid').prop('checked', false);
    $('#dnd-sk-hire-date').val('');
    _skSelectedArmorName = null;
    _skTempArmorAttuned = false;
    _skSelectedShieldName = null;
    _skTempShieldAttuned = false;
    $('#dnd-sk-armor-current').text('None');
    $('#dnd-sk-armor-clear').hide();
    $('#dnd-sk-armor-search').val('');
    $('#dnd-sk-armor-results').html('');
    $('#dnd-sk-magic-armor-check').prop('checked', false);
    $('#dnd-sk-armor-attune-check').prop('checked', false).closest('.dnd-sk-armor-attune-row').hide();
    $('#dnd-sk-shield-current').text('None');
    $('#dnd-sk-shield-clear').hide();
    $('#dnd-sk-shield-search').val('');
    $('#dnd-sk-shield-results').html('');
    $('#dnd-sk-magic-shield-check').prop('checked', false);
    $('#dnd-sk-shield-attune-check').prop('checked', false).closest('.dnd-sk-shield-attune-row').hide();
    $('#dnd-sk-equip-search').val('');
    $('#dnd-sk-equip-results').html('');
    $('#dnd-sk-magic-check').prop('checked', false);
    $('#dnd-sk-item-input').val('');
    $('#dnd-sk-item-results').html('');
    _skSelectedCreatureName = null;

    await preloadBestiarySources();
    await fetchEquipmentItems();
    populateExtraSourceDropdown();

    if (editId) {
        const sk = sidekicks.find(s => s.id === editId);
        if (sk) {
            $('#dnd-sk-name').val(sk.name || '');
            $('#dnd-sk-race').val(sk.race || '');
            $('#dnd-sk-type').val(sk.type || '');
            onSkTypeChanged();
            if (sk.subtype) $('#dnd-sk-subtype').val(sk.subtype);
            $('#dnd-sk-hire-gold').val(sk.hireGoldPerDay || 0);
            $('#dnd-sk-hire-paymode').val(sk.hirePayMode || 'owed');
            const payMode = sk.hirePayMode || 'owed';
            $('#dnd-sk-hire-gold-row').toggle(payMode !== 'quest' && payMode !== 'free');
            $('#dnd-sk-hire-paid-row').toggle(payMode === 'owed');
            $('#dnd-sk-hire-paid').val(sk.hirePaidAmount || 0);
            $('#dnd-sk-hire-quest-row').toggle(payMode === 'quest');
            $('#dnd-sk-hire-quest-amount').val(sk.hireQuestAmount || 0);
            $('#dnd-sk-hire-quest-paid').prop('checked', !!sk.hireQuestPaid);
            $('#dnd-sk-hire-date').val(sk.hireDate || '');

            _skTempActions = (sk.creatureActions || []).map(a => ({ ...a }));
            _skTempTraits = (sk.creatureTraits || []).map(t => ({ ...t }));
            _skTempWeapons = (sk.weapons || []).map(w => ({ ...w }));
            _skTempItems = (sk.items || []).slice();
            _skTempChosenLanguages = (sk.chosenLanguages || []).slice();

            if (sk.creatureSource) {
                if (!getCreatureStats(sk.creatureName, sk.creatureSource)) {
                    await fetchBestiarySource(sk.creatureSource);
                }
                const creature = getCreatureStats(sk.creatureName, sk.creatureSource);
                if (creature) {
                    _skTempCreature = creature;
                    _skSelectedCreatureName = sk.creatureName;
                    $('#dnd-sk-creature-search').val(sk.creatureName);
                    showCreaturePreview(creature);

                    const versions = findCreatureVersions(sk.creatureName);
                    if (versions.length > 1) {
                        const $srcSelect = $('#dnd-sk-creature-source');
                        $srcSelect.html('');
                        for (const v of versions) {
                            $srcSelect.append(`<option value="${v.source}">${v.source} (CR ${v.cr}, HP ${v.hp}, AC ${v.ac})</option>`);
                        }
                        $srcSelect.val(sk.creatureSource);
                        $('#dnd-sk-source-row').show();
                    }
                }
            }

            if (sk.equippedArmor) {
                setSelectedArmor(sk.equippedArmor.name);
                _skTempArmorAttuned = !!sk.equippedArmor.attuned;
                if (_skTempArmorAttuned) {
                    $('#dnd-sk-armor-attune-check').prop('checked', true);
                }
                updateArmorAttuneVisibility();
            }
            if (sk.equippedShield) {
                setSelectedShield(sk.equippedShield.name);
                _skTempShieldAttuned = !!sk.equippedShield.attuned;
                if (_skTempShieldAttuned) {
                    $('#dnd-sk-shield-attune-check').prop('checked', true);
                }
                updateShieldAttuneVisibility();
            } else if (sk.hasShield) {
                setSelectedShield('Shield');
            }
            showEquipmentSection();

            populateProfSection(sk.type, sk.saveProficiency, sk.skillProficiencies, sk.skillExpertise, sk.toolProficiencies);
            populateAsiSection(sk.type, sk.asiChoices, sk.featData);
            populateClassFeatureChoices(sk.type, sk);
            if (sk.type === 'spellcaster') {
                showSpellsSection(sk);
            }
        }
    }

    $popup.css('display', 'flex');
    bindTooltipEvents($popup[0]);
}

function onSkTypeChanged() {
    const type = /** @type {string} */ ($('#dnd-sk-type').val());
    const typeInfo = SIDEKICK_TYPES[type];
    const $subRow = $('#dnd-sk-subtype-row');
    const $subSelect = $('#dnd-sk-subtype');

    if (typeInfo?.subtypes?.length > 0) {
        $subSelect.html('<option value="">-- Select --</option>');
        for (const sub of typeInfo.subtypes) {
            $subSelect.append(`<option value="${sub.key}">${sub.label}</option>`);
        }
        $subRow.show();
    } else {
        $subRow.hide();
        $subSelect.html('');
    }

    if (type) {
        populateProfSection(type, null, [], [], []);
        populateAsiSection(type, {});
        populateClassFeatureChoices(type, null);
    } else {
        $('#dnd-sk-prof-section').hide();
        $('#dnd-sk-asi-section').hide();
        $('#dnd-sk-class-features-section').hide();
    }

    if (type === 'spellcaster') {
        $('#dnd-sk-cantrip-dropdown').html('<div class="dnd-sk-dd-empty">Select a subtype to see spells</div>');
        $('#dnd-sk-spell-dropdown').html('<div class="dnd-sk-dd-empty">Select a subtype to see spells</div>');
        $('#dnd-sk-cantrip-tags').html('<span class="dnd-sk-no-spells">None selected</span>');
        $('#dnd-sk-spell-tags').html('<span class="dnd-sk-no-spells">None selected</span>');
        $('#dnd-sk-spells-section').show();
    } else {
        $('#dnd-sk-spells-section').hide();
    }
}

let _skSearchDebounce = null;
let _skSelectedCreatureName = null;

function refreshCreatureDropdown() {
    const query = /** @type {string} */ ($('#dnd-sk-creature-search').val()).trim();
    const typeFilter = /** @type {string} */ ($('#dnd-sk-creature-type-filter').val()) || null;
    const hasQuery = query.length >= 2;

    if (!hasQuery && !typeFilter) {
        $('#dnd-sk-creature-dropdown').html('<div class="dnd-sk-dd-empty">Pick a creature type or search by name</div>');
        return;
    }

    const results = searchCreatures(hasQuery ? query : null, typeFilter);
    const $dd = $('#dnd-sk-creature-dropdown');
    if (results.length === 0) {
        $dd.html('<div class="dnd-sk-dd-empty">No matches</div>');
        return;
    }
    const SIZE_MAP = { T: 'Tiny', S: 'Small', M: 'Med', L: 'Large', H: 'Huge', G: 'Garg' };
    const rows = results.map(r => {
        const sz = SIZE_MAP[r.size] || r.size;
        const typePart = typeFilter ? '' : `${r.type} &middot; `;
        const selected = _skSelectedCreatureName === r.name ? ' dnd-sk-dd-selected' : '';
        return `<div class="dnd-sk-dd-item${selected}" data-creature-name="${escHtml(r.name)}">
            <span class="dnd-sk-dd-name">${escHtml(r.name)}</span>
            <span class="dnd-sk-dd-info">CR ${r.cr} &middot; ${typePart}${sz} &middot; HP ${r.hp} &middot; AC ${r.ac}</span>
        </div>`;
    });
    $dd.html(rows.join(''));
}

function onSkCreatureSearch() {
    clearTimeout(_skSearchDebounce);
    _skSearchDebounce = setTimeout(refreshCreatureDropdown, 200);
}

function onSkCreatureTypeFilter() {
    refreshCreatureDropdown();
}

function onSkCreatureNamePicked(creatureName) {
    _skSelectedCreatureName = creatureName;
    $('.dnd-sk-dd-item').removeClass('dnd-sk-dd-selected');
    $(`.dnd-sk-dd-item[data-creature-name="${creatureName}"]`).addClass('dnd-sk-dd-selected');

    const versions = findCreatureVersions(creatureName);
    const $srcRow = $('#dnd-sk-source-row');
    const $srcSelect = $('#dnd-sk-creature-source');

    if (versions.length <= 1) {
        $srcRow.hide();
        const v = versions[0];
        if (v) selectCreatureVersion(v.name, v.source);
    } else {
        $srcSelect.html('');
        for (const v of versions) {
            $srcSelect.append(`<option value="${v.source}">${v.source} (CR ${v.cr}, HP ${v.hp}, AC ${v.ac})</option>`);
        }
        $srcRow.show();
        selectCreatureVersion(versions[0].name, versions[0].source);
    }
}

function onSkCreatureSourceChanged() {
    if (!_skSelectedCreatureName) return;
    const source = /** @type {string} */ ($('#dnd-sk-creature-source').val());
    if (source) selectCreatureVersion(_skSelectedCreatureName, source);
}

function selectCreatureVersion(name, source) {
    const creature = getCreatureStats(name, source);
    if (!creature) return;
    _skTempCreature = creature;
    _skTempActions = extractCreatureActions(creature);
    _skTempTraits = extractCreatureTraits(creature);
    _skTempWeapons = [];
    _skTempChosenLanguages = [];
    showCreaturePreview(creature);
    showEquipmentSection();
    renderCreatureSkillsDisplay();
    renderLanguageSelection();
}

async function onSkLoadExtraSource() {
    const key = /** @type {string} */ ($('#dnd-sk-load-extra-source').val());
    if (!key) return;
    const $btn = $('#dnd-sk-load-source-btn');
    $btn.prop('disabled', true).text('...');
    await fetchBestiarySource(key);
    $btn.prop('disabled', false).text('+');
    toastr.info(`Loaded bestiary source: ${key}`);
    populateExtraSourceDropdown();
}

function populateExtraSourceDropdown() {
    const available = getAvailableSourceKeys();
    const loaded = new Set(getLoadedSourceKeys());
    const $sel = $('#dnd-sk-load-extra-source');
    $sel.html('<option value="">-- Pick --</option>');
    let count = 0;
    for (const key of available) {
        if (loaded.has(key)) continue;
        $sel.append(`<option value="${key}">${key}</option>`);
        count++;
    }
    if (count > 0) {
        $('#dnd-sk-load-more-row').show();
    } else {
        $('#dnd-sk-load-more-row').hide();
    }
}

function showCreaturePreview(creature) {
    const hp = creature.hp?.average ?? '?';
    const formula = creature.hp?.formula || '?';
    const ac = typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? '?';
    const abilities = ['str','dex','con','int','wis','cha']
        .map(a => `${a.toUpperCase()} ${creature[a] ?? 10}`)
        .join(' | ');

    const speedParts = [];
    if (creature.speed) {
        for (const [k, v] of Object.entries(creature.speed)) {
            if (typeof v === 'number') speedParts.push(`${k} ${v}ft`);
            else if (v && typeof v === 'object' && typeof v.number === 'number') speedParts.push(`${k} ${v.number}ft`);
        }
    }
    const speedStr = speedParts.join(', ') || '30ft';

    $('#dnd-sk-creature-preview')
        .html(`<div class="dnd-sk-preview-line"><strong>${creature.name}</strong> (${creature.source})</div>
               <div class="dnd-sk-preview-line">HP ${hp} (${formula}) | AC ${ac} | Speed ${speedStr}</div>
               <div class="dnd-sk-preview-line">${abilities}</div>`)
        .show();
}

let _skArmorSearchDebounce = null;
let _skSelectedArmorName = null;

function setSelectedArmor(name) {
    _skSelectedArmorName = name || null;
    if (!name) {
        _skTempArmorAttuned = false;
        $('#dnd-sk-armor-attune-check').prop('checked', false);
    }
    $('#dnd-sk-armor-current').text(name || 'None');
    $('#dnd-sk-armor-clear').toggle(!!name);
    updateAcPreview();
    updateArmorAttuneVisibility();
}

function onSkArmorSearch() {
    clearTimeout(_skArmorSearchDebounce);
    _skArmorSearchDebounce = setTimeout(() => {
        const query = /** @type {string} */ ($('#dnd-sk-armor-search').val());
        if (!query || query.length < 2) { $('#dnd-sk-armor-results').html(''); return; }
        const useMagic = !!$('#dnd-sk-magic-armor-check').prop('checked');
        const results = searchEquipment(query, 'armor', useMagic);
        const $results = $('#dnd-sk-armor-results');
        if (results.length === 0) { $results.html('<em>No results</em>'); return; }
        const ARMOR_LABELS = { LA: 'Light', MA: 'Medium', HA: 'Heavy' };
        const items = results.map(item => {
            const typeLabel = ARMOR_LABELS[item._armorType] || '?';
            const bonusAc = item.bonusAc ? ` (+${item.bonusAc})` : '';
            const rarity = item._magic && item.rarity && !RARITY_HIDDEN.has(item.rarity) ? ` · ${item.rarity}` : '';
            const src = item._magic ? ` · ${item.source || '?'}` : '';
            return `<div class="dnd-sk-dd-item dnd-sk-armor-result" data-item-name="${escHtml(item.name)}" data-item-source="${escHtml(item.source || '')}"><span class="dnd-sk-dd-name">${escHtml(item.name)}${bonusAc}</span><span class="dnd-sk-dd-info">${typeLabel}, AC ${item.ac || '?'}${rarity}${src}</span></div>`;
        });
        $results.html(items.join(''));
    }, 250);
}

// ─── Shield Search & Selection ──────────────────────────────

let _skShieldSearchDebounce = null;

function setSelectedShield(name) {
    _skSelectedShieldName = name || null;
    if (!name) {
        _skTempShieldAttuned = false;
        $('#dnd-sk-shield-attune-check').prop('checked', false);
    }
    $('#dnd-sk-shield-current').text(name || 'None');
    $('#dnd-sk-shield-clear').toggle(!!name);
    updateAcPreview();
    updateShieldAttuneVisibility();
}

function onSkShieldSearch() {
    clearTimeout(_skShieldSearchDebounce);
    _skShieldSearchDebounce = setTimeout(() => {
        const query = /** @type {string} */ ($('#dnd-sk-shield-search').val());
        if (!query || query.length < 2) { $('#dnd-sk-shield-results').html(''); return; }
        const useMagic = !!$('#dnd-sk-magic-shield-check').prop('checked');
        const results = searchEquipment(query, 'shield', useMagic);
        const $results = $('#dnd-sk-shield-results');
        if (results.length === 0) { $results.html('<em>No results</em>'); return; }
        const items = results.map(item => {
            const bonusAc = item.bonusAc ? ` (+${item.bonusAc})` : '';
            const rarity = item._magic && item.rarity && !RARITY_HIDDEN.has(item.rarity) ? ` · ${item.rarity}` : '';
            const src = item._magic ? ` · ${item.source || '?'}` : '';
            return `<div class="dnd-sk-dd-item dnd-sk-shield-result" data-item-name="${escHtml(item.name)}" data-item-source="${escHtml(item.source || '')}"><span class="dnd-sk-dd-name">${escHtml(item.name)}${bonusAc}</span><span class="dnd-sk-dd-info">Shield, AC +${item.ac || 2}${rarity}${src}</span></div>`;
        });
        $results.html(items.join(''));
    }, 250);
}

function updateShieldAttuneVisibility() {
    if (!_skSelectedShieldName) {
        $('#dnd-sk-shield-attune-check').closest('.dnd-sk-shield-attune-row').hide();
        return;
    }
    const useMagic = !!$('#dnd-sk-magic-shield-check').prop('checked');
    if (!useMagic) {
        _skTempShieldAttuned = false;
        $('#dnd-sk-shield-attune-check').prop('checked', false).closest('.dnd-sk-shield-attune-row').hide();
        updateAttuneCounter();
        return;
    }
    const item = searchEquipment(_skSelectedShieldName, 'shield', true).find(i => i.name === _skSelectedShieldName);
    if (item?.reqAttune) {
        $('#dnd-sk-shield-attune-check').closest('.dnd-sk-shield-attune-row').show();
    } else {
        _skTempShieldAttuned = false;
        $('#dnd-sk-shield-attune-check').prop('checked', false).closest('.dnd-sk-shield-attune-row').hide();
    }
    updateAttuneCounter();
}

function showEquipmentSection() {
    renderTraitsList();
    renderActionsList();
    renderWeaponsList();
    renderItemsList();
    updateAcPreview();
    $('#dnd-sk-equip-section').show();
}

function renderTraitsList() {
    const $list = $('#dnd-sk-traits-list');
    if (_skTempTraits.length === 0) {
        $list.html('<div class="dnd-sk-no-spells">No creature traits</div>');
        return;
    }
    let html = '';
    for (let i = 0; i < _skTempTraits.length; i++) {
        const t = _skTempTraits[i];
        const checked = t.enabled ? 'checked' : '';
        const dimClass = t.enabled ? '' : ' dnd-sk-action-disabled';
        html += `<div class="dnd-sk-action-row${dimClass}">
            <label class="dnd-sk-action-toggle">
                <input type="checkbox" data-trait-idx="${i}" ${checked} />
                <strong>${escHtml(t.name)}.</strong>
            </label>
            <span class="dnd-sk-action-text" title="${escHtml(t.text)}">${escHtml(t.text)}</span>
        </div>`;
    }
    $list.html(html);
}

function renderActionsList() {
    const $list = $('#dnd-sk-actions-list');
    if (_skTempActions.length === 0) {
        $list.html('<div class="dnd-sk-no-spells">No creature actions</div>');
        return;
    }
    let html = '';
    for (let i = 0; i < _skTempActions.length; i++) {
        const a = _skTempActions[i];
        const checked = a.enabled ? 'checked' : '';
        const dimClass = a.enabled ? '' : ' dnd-sk-action-disabled';
        html += `<div class="dnd-sk-action-row${dimClass}">
            <label class="dnd-sk-action-toggle">
                <input type="checkbox" data-action-idx="${i}" ${checked} />
                <strong>${escHtml(a.name)}.</strong>
            </label>
            <span class="dnd-sk-action-text" title="${escHtml(a.text)}">${escHtml(a.text)}</span>
        </div>`;
    }
    $list.html(html);
}

function formatWeaponDesc(w) {
    let desc = `${w.damageDice} ${w.damageType}`;
    if (w.bonus) desc = `${w.bonus} ${desc}`;
    if (w.versatileDice) desc += `, versatile ${w.versatileDice}`;
    if (w.range) desc += `, range ${w.range}`;
    const props = (w.properties || []).filter(p => p !== 'Versatile' || !w.versatileDice).join(', ');
    if (props) desc += ` [${props}]`;
    return desc;
}

function renderWeaponsList() {
    const $list = $('#dnd-sk-weapons-list');
    if (_skTempWeapons.length === 0) {
        $list.html('<div class="dnd-sk-no-spells">No extra weapons</div>');
        updateAttuneCounter();
        return;
    }
    let html = '';
    for (let i = 0; i < _skTempWeapons.length; i++) {
        const w = _skTempWeapons[i];
        const isMagic = w._magic || !!w.bonus || w.attuned;
        const attuneBtn = isMagic
            ? `<button class="dnd-sk-attune-toggle${w.attuned ? ' active' : ''}" data-equip-idx="${i}" title="${w.attuned ? 'Attuned — click to unattune' : 'Click to attune'}"><i class="fa-solid fa-sun"></i></button>`
            : '';
        const notesInput = isMagic ? `<input type="text" class="dnd-sk-item-notes" data-equip-idx="${i}" placeholder="Notes (e.g. bound spell)" value="${escHtml(w.customNotes || '')}" />` : '';
        html += `<div class="dnd-sk-equip-item${w.attuned ? ' dnd-sk-attuned' : ''}" data-item-name="${escHtml(w.name)}">
            <span>${escHtml(w.name)} &mdash; ${formatWeaponDesc(w)}</span>
            ${attuneBtn}
            <button class="dnd-sk-equip-remove" data-equip-idx="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            ${notesInput}
        </div>`;
    }
    $list.html(html);
    $list.find('.dnd-sk-item-notes').on('change', function() {
        const idx = parseInt($(this).data('equip-idx'));
        if (idx >= 0 && idx < _skTempWeapons.length) {
            _skTempWeapons[idx].customNotes = /** @type {string} */ ($(this).val()).trim();
        }
    });
    $list.find('.dnd-sk-attune-toggle').on('click', function() {
        const idx = parseInt($(this).data('equip-idx'));
        if (idx < 0 || idx >= _skTempWeapons.length) return;
        const w = _skTempWeapons[idx];
        if (w.attuned) {
            w.attuned = false;
        } else if (getTempAttunedCount() < SIDEKICK_MAX_ATTUNEMENT) {
            w.attuned = true;
        } else {
            toastr.warning(`Attunement full (${SIDEKICK_MAX_ATTUNEMENT}/${SIDEKICK_MAX_ATTUNEMENT} slots used)`);
            return;
        }
        renderWeaponsList();
    });
    updateAttuneCounter();
}

function getSelectedFeatNames() {
    const feats = [];
    $('#dnd-sk-asi-rows .dnd-sk-asi-row').each(function () {
        if ($(this).find('.dnd-sk-asi-feat-toggle').prop('checked')) {
            const name = $(this).find('.dnd-sk-feat-select').val();
            if (name) feats.push(name);
        }
    });
    return feats;
}

function updateAcPreview() {
    let armorObj = null;
    if (_skSelectedArmorName) {
        const useMagic = !!$('#dnd-sk-magic-armor-check').prop('checked');
        const item = searchEquipment(_skSelectedArmorName, 'armor', useMagic).find(i => i.name === _skSelectedArmorName);
        if (item) armorObj = armorFromItem(item);
    }

    let shieldObj = null;
    if (_skSelectedShieldName) {
        const useMagic = !!$('#dnd-sk-magic-shield-check').prop('checked');
        const item = searchEquipment(_skSelectedShieldName, 'shield', useMagic).find(i => i.name === _skSelectedShieldName);
        if (item) shieldObj = shieldFromItem(item);
        else shieldObj = { name: _skSelectedShieldName, ac: 2, rarity: null };
    }

    const baseDex = _skTempCreature?.dex ?? 10;
    const dexMod = Math.floor((baseDex - 10) / 2);
    const baseAc = _skTempCreature ? (typeof _skTempCreature.ac?.[0] === 'number' ? _skTempCreature.ac[0] : _skTempCreature.ac?.[0]?.ac ?? 10) : 10;

    const selectedFeats = getSelectedFeatNames();
    const hasMediumArmorMaster = selectedFeats.includes('Medium Armor Master');
    const hasDualWielder = selectedFeats.includes('Dual Wielder') && _skTempWeapons.length >= 2;

    const ac = computeEquippedAC(armorObj, shieldObj, dexMod, baseAc, 0, {
        mediumArmorMaster: hasMediumArmorMaster,
        featAcBonus: hasDualWielder ? 1 : 0,
    });
    $('#dnd-sk-ac-preview').text(`AC ${ac}`);
}

let _skEquipSearchDebounce = null;
function onSkEquipSearch() {
    clearTimeout(_skEquipSearchDebounce);
    _skEquipSearchDebounce = setTimeout(() => {
        const query = /** @type {string} */ ($('#dnd-sk-equip-search').val());
        if (!query || query.length < 2) { $('#dnd-sk-equip-results').html(''); return; }
        const useMagic = !!$('#dnd-sk-magic-check').prop('checked');
        const results = searchEquipment(query, 'weapon', useMagic);
        const $results = $('#dnd-sk-equip-results');
        if (results.length === 0) { $results.html('<em>No results</em>'); return; }
        const items = results.map(item => {
            const dmg = item.dmg1 || '?';
            const cat = item.weaponCategory || '';
            const rawB = item.bonusWeapon || '';
            const bonus = rawB ? ` (${String(rawB).startsWith('+') ? rawB : '+' + rawB})` : '';
            const rarity = item._magic && item.rarity && !RARITY_HIDDEN.has(item.rarity) ? ` · ${item.rarity}` : '';
            const src = item._magic ? ` · ${item.source || '?'}` : '';
            return `<div class="dnd-sk-dd-item dnd-sk-equip-result" data-item-name="${escHtml(item.name)}" data-item-source="${escHtml(item.source || '')}"><span class="dnd-sk-dd-name">${escHtml(item.name)}${bonus}</span><span class="dnd-sk-dd-info">${dmg}, ${cat}${rarity}${src}</span></div>`;
        });
        $results.html(items.join(''));
    }, 250);
}

function addWeaponFromSearch(itemName, itemSource) {
    const useMagic = !!$('#dnd-sk-magic-check').prop('checked');
    let item = searchEquipment(itemName, 'weapon', useMagic).find(i =>
        i.name === itemName && (!itemSource || i.source === itemSource),
    );
    if (!item) return;
    if (_skTempWeapons.some(w => w.name === itemName)) {
        toastr.warning(`${itemName} is already equipped`);
        return;
    }
    const wpn = weaponFromItem(item);
    if (item._magic && item.reqAttune && getTempAttunedCount() < SIDEKICK_MAX_ATTUNEMENT) {
        wpn.attuned = true;
    }
    _skTempWeapons.push(wpn);
    renderWeaponsList();
    $('#dnd-sk-equip-search').val('');
    $('#dnd-sk-equip-results').html('');
}

function removeWeaponByIndex(idx) {
    if (idx >= 0 && idx < _skTempWeapons.length) {
        _skTempWeapons.splice(idx, 1);
        renderWeaponsList();
    }
}

// ─── Attunement Helpers ─────────────────────────────────────

function updateAttuneCounter() {
    const count = getTempAttunedCount();
    const $counter = $('#dnd-sk-attune-counter');
    $counter.text(`Attuned ${count}/${SIDEKICK_MAX_ATTUNEMENT}`);
    $counter.toggleClass('dnd-sk-attune-full', count >= SIDEKICK_MAX_ATTUNEMENT);
}

function updateArmorAttuneVisibility() {
    if (!_skSelectedArmorName) {
        $('#dnd-sk-armor-attune-check').closest('.dnd-sk-armor-attune-row').hide();
        return;
    }
    const useMagic = !!$('#dnd-sk-magic-armor-check').prop('checked');
    if (!useMagic) {
        _skTempArmorAttuned = false;
        $('#dnd-sk-armor-attune-check').prop('checked', false).closest('.dnd-sk-armor-attune-row').hide();
        updateAttuneCounter();
        return;
    }
    const item = searchEquipment(_skSelectedArmorName, 'armor', true).find(i => i.name === _skSelectedArmorName);
    if (item?.reqAttune) {
        $('#dnd-sk-armor-attune-check').closest('.dnd-sk-armor-attune-row').show();
    } else {
        _skTempArmorAttuned = false;
        $('#dnd-sk-armor-attune-check').prop('checked', false).closest('.dnd-sk-armor-attune-row').hide();
    }
    updateAttuneCounter();
}

// ─── Items & Gear ───────────────────────────────────────────

const RARITY_HIDDEN = new Set(['unknown', 'unknown (magic)', 'none']);

function renderItemsList() {
    const $list = $('#dnd-sk-items-list');
    if (_skTempItems.length === 0) {
        $list.html('<div class="dnd-sk-no-spells">No items</div>');
        updateAttuneCounter();
        return;
    }
    let html = '';
    for (let i = 0; i < _skTempItems.length; i++) {
        const it = _skTempItems[i];
        const rarity = it.rarity && !RARITY_HIDDEN.has(it.rarity) ? ` (${it.rarity})` : '';
        const attuneBtn = `<button class="dnd-sk-attune-toggle${it.attuned ? ' active' : ''}" data-item-idx="${i}" title="${it.attuned ? 'Attuned — click to unattune' : 'Click to attune'}"><i class="fa-solid fa-sun"></i></button>`;
        html += `<div class="dnd-sk-equip-item${it.attuned ? ' dnd-sk-attuned' : ''}" data-item-name="${escHtml(it.name)}">
            <span>${escHtml(it.name)}${rarity}</span>
            ${attuneBtn}
            <button class="dnd-sk-item-remove" data-item-idx="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            <input type="text" class="dnd-sk-item-notes" data-item-idx="${i}" placeholder="Notes (e.g. bound spell)" value="${escHtml(it.customNotes || '')}" />
        </div>`;
    }
    $list.html(html);
    $list.find('.dnd-sk-item-notes').on('change', function() {
        const idx = parseInt($(this).data('item-idx'));
        if (idx >= 0 && idx < _skTempItems.length) {
            _skTempItems[idx].customNotes = /** @type {string} */ ($(this).val()).trim();
        }
    });
    $list.find('.dnd-sk-attune-toggle').on('click', function() {
        const idx = parseInt($(this).data('item-idx'));
        if (idx < 0 || idx >= _skTempItems.length) return;
        const it = _skTempItems[idx];
        if (it.attuned) {
            it.attuned = false;
        } else if (getTempAttunedCount() < SIDEKICK_MAX_ATTUNEMENT) {
            it.attuned = true;
        } else {
            toastr.warning(`Attunement full (${SIDEKICK_MAX_ATTUNEMENT}/${SIDEKICK_MAX_ATTUNEMENT} slots used)`);
            return;
        }
        renderItemsList();
    });
    updateAttuneCounter();
}

function addItemCustom() {
    const name = /** @type {string} */ ($('#dnd-sk-item-input').val()).trim();
    if (!name) return;
    if (_skTempItems.some(it => it.name.toLowerCase() === name.toLowerCase())) {
        toastr.warning(`${name} is already in the list`);
        return;
    }
    _skTempItems.push({ name, rarity: null, source: null });
    renderItemsList();
    $('#dnd-sk-item-input').val('');
    $('#dnd-sk-item-results').html('');
}

function addItemFromSearch(itemName) {
    const match = searchMagicItems(itemName).find(i => i.name === itemName);
    const item = match || { name: itemName, rarity: null, source: null };
    if (_skTempItems.some(it => it.name.toLowerCase() === item.name.toLowerCase())) {
        toastr.warning(`${item.name} is already in the list`);
        return;
    }
    const cdnItem = lookupItemByName(itemName);
    const autoAttune = cdnItem?.reqAttune && getTempAttunedCount() < SIDEKICK_MAX_ATTUNEMENT;
    _skTempItems.push({ name: item.name, rarity: item.rarity || null, source: item.source || null, attuned: !!autoAttune });
    renderItemsList();
    $('#dnd-sk-item-input').val('');
    $('#dnd-sk-item-results').html('');
}

function removeItemByIndex(idx) {
    if (idx >= 0 && idx < _skTempItems.length) {
        _skTempItems.splice(idx, 1);
        renderItemsList();
    }
}

let _skItemSearchDebounce = null;
function onSkItemSearch() {
    clearTimeout(_skItemSearchDebounce);
    _skItemSearchDebounce = setTimeout(async () => {
        const query = /** @type {string} */ ($('#dnd-sk-item-input').val());
        if (!query || query.length < 2) { $('#dnd-sk-item-results').html(''); return; }
        if (!isMagicWeaponsLoaded()) {
            await fetchMagicItems();
        }
        const results = searchMagicItems(query);
        const $results = $('#dnd-sk-item-results');
        if (results.length === 0) { $results.html(''); return; }
        const items = results.map(item => {
            const rarity = item.rarity && !RARITY_HIDDEN.has(item.rarity) ? ` · ${item.rarity}` : '';
            const src = item.source ? ` · ${item.source}` : '';
            return `<div class="dnd-sk-dd-item dnd-sk-item-result" data-item-name="${escHtml(item.name)}"><span class="dnd-sk-dd-name">${escHtml(item.name)}</span><span class="dnd-sk-dd-info">${item.type || '?'}${rarity}${src}</span></div>`;
        });
        $results.html(items.join(''));
    }, 300);
}

function populateProfSection(type, savedSave, savedSkills, savedExpertise, savedTools) {
    const typeInfo = SIDEKICK_TYPES[type];
    if (!typeInfo) { $('#dnd-sk-prof-section').hide(); return; }

    const $saveSelect = $('#dnd-sk-save-prof');
    $saveSelect.html('<option value="">-- Select --</option>');
    for (const s of typeInfo.saveOptions) {
        const selected = s === savedSave ? ' selected' : '';
        $saveSelect.append(`<option value="${s}"${selected}>${s.toUpperCase()}</option>`);
    }

    const skillOpts = typeInfo.skillOptions || ALL_SKILLS;
    const maxSkills = typeInfo.skillCount;
    const $label = $('#dnd-sk-skill-label');
    $label.text(`Skills (${(savedSkills || []).length}/${maxSkills}):`);

    const $checks = $('#dnd-sk-skill-checks');
    let html = '';
    for (const sk of skillOpts) {
        const checked = (savedSkills || []).includes(sk) ? ' checked' : '';
        html += `<label class="dnd-sk-check"><input type="checkbox" data-skill="${sk}"${checked} /> ${SKILL_LABELS[sk] || sk}</label>`;
    }
    $checks.html(html);

    const level = getSidekickLevel();
    const maxExpertise = 2;
    if (type === 'expert' && level >= 3) {
        const $expChecks = $('#dnd-sk-expertise-checks');
        let expHtml = '';
        const profSkills = savedSkills || [];
        for (const sk of profSkills) {
            const checked = (savedExpertise || []).includes(sk) ? ' checked' : '';
            expHtml += `<label class="dnd-sk-check"><input type="checkbox" data-expertise="${sk}"${checked} /> ${SKILL_LABELS[sk] || sk}</label>`;
        }
        $expChecks.html(expHtml).show();
        $expChecks.off('change').on('change', 'input', function () {
            if ($expChecks.find('input:checked').length > maxExpertise) $(this).prop('checked', false);
        });
        $('#dnd-sk-expertise-row').show();
    } else {
        $('#dnd-sk-expertise-row').hide();
        $('#dnd-sk-expertise-checks').hide().html('');
    }

    // Tool proficiency selection:
    // - All sidekicks can manually choose 1 tool.
    // - Expert sidekicks can choose 3 total (their 2 class tools + 1 manual extra).
    const maxTools = type === 'expert' ? 3 : 1;
    const $toolRow = $('#dnd-sk-tool-row');
    const $toolChecks = $('#dnd-sk-tool-checks');
    const $toolLabel = $('#dnd-sk-tool-label');
    const existingTools = (savedTools || []).slice(0, maxTools);
    $toolLabel.text(`Tools (${existingTools.length}/${maxTools}):`);
    let toolHtml = '';
    for (const tool of DND_TOOLS) {
        const checked = existingTools.includes(tool) ? ' checked' : '';
        toolHtml += `<label class="dnd-sk-check"><input type="checkbox" data-tool="${escHtml(tool)}"${checked} /> ${escHtml(tool)}</label>`;
    }
    $toolChecks.html(toolHtml).show();
    $toolChecks.off('change').on('change', 'input[type="checkbox"]', function () {
        const checkedTools = $toolChecks.find('input:checked');
        if (checkedTools.length > maxTools) {
            $(this).prop('checked', false);
            return;
        }
        $toolLabel.text(`Tools (${checkedTools.length}/${maxTools}):`);
    });
    $toolRow.show();

    $checks.off('change').on('change', 'input[type="checkbox"]', function () {
        const checked = $checks.find('input:checked');
        if (checked.length > maxSkills) {
            $(this).prop('checked', false);
            return;
        }
        $label.text(`Skills (${checked.length}/${maxSkills}):`);

        if (type === 'expert' && level >= 3) {
            const profSkills = [];
            checked.each(function () { profSkills.push($(this).data('skill')); });
            const $expChecks = $('#dnd-sk-expertise-checks');
            const curExp = [];
            $expChecks.find('input:checked').each(function () { curExp.push($(this).data('expertise')); });
            let expHtml = '';
            for (const sk of profSkills) {
                const checked2 = curExp.includes(sk) ? ' checked' : '';
                expHtml += `<label class="dnd-sk-check"><input type="checkbox" data-expertise="${sk}"${checked2} /> ${SKILL_LABELS[sk] || sk}</label>`;
            }
            $expChecks.html(expHtml).show();
            $expChecks.off('change').on('change', 'input', function () {
                if ($expChecks.find('input:checked').length > maxExpertise) $(this).prop('checked', false);
            });
            $('#dnd-sk-expertise-row').show();
        }
    });

    renderCreatureSkillsDisplay();
    renderLanguageSelection();

    $('#dnd-sk-prof-section').show();
}

let _skTempChosenLanguages = [];

function renderCreatureSkillsDisplay() {
    const crSkills = _skTempCreature?.skill;
    if (!crSkills || Object.keys(crSkills).length === 0) {
        $('#dnd-sk-creature-skills-row').hide();
        return;
    }
    const items = Object.entries(crSkills).map(([sk, val]) => `${sk} ${val}`);
    $('#dnd-sk-creature-skills-list').text(items.join(', '));
    $('#dnd-sk-creature-skills-row').show();
}

function renderLanguageSelection() {
    const langStr = _skTempCreature
        ? (Array.isArray(_skTempCreature.languages) ? _skTempCreature.languages.join(', ') : (_skTempCreature.languages || ''))
        : '';
    if (!langStr) { $('#dnd-sk-lang-row').hide(); return; }

    const parsed = parseCreatureLanguages(langStr);
    $('#dnd-sk-lang-fixed').text(parsed.fixed.length > 0 ? parsed.fixed.join(', ') : langStr);
    $('#dnd-sk-lang-row').show();

    if (parsed.choiceCount > 0) {
        $('#dnd-sk-lang-choice-label').text(`Choose ${parsed.choiceCount} language${parsed.choiceCount > 1 ? 's' : ''}:`);
        const available = DND_LANGUAGES.filter(l => !parsed.fixed.includes(l));
        let html = '';
        for (const lang of available) {
            const checked = _skTempChosenLanguages.includes(lang) ? ' checked' : '';
            html += `<label class="dnd-sk-check"><input type="checkbox" data-lang="${escHtml(lang)}"${checked} /> ${escHtml(lang)}</label>`;
        }
        $('#dnd-sk-lang-choices').html(html);
        $('#dnd-sk-lang-choice-row').show();

        $('#dnd-sk-lang-choices').off('change').on('change', 'input[type="checkbox"]', function () {
            const checked = $('#dnd-sk-lang-choices input:checked');
            if (checked.length > parsed.choiceCount) {
                $(this).prop('checked', false);
                return;
            }
            _skTempChosenLanguages = [];
            checked.each(function () { _skTempChosenLanguages.push($(this).data('lang')); });
        });
    } else {
        $('#dnd-sk-lang-choice-row').hide();
    }
}

async function populateAsiSection(type, savedChoices, savedFeatData) {
    const asiLevels = ASI_LEVELS[type];
    if (!asiLevels) { $('#dnd-sk-asi-section').hide(); return; }

    const level = getSidekickLevel();
    const applicable = asiLevels.filter(l => l <= level);
    if (applicable.length === 0) { $('#dnd-sk-asi-section').hide(); return; }

    await fetchFeats();
    const allFeats = getLoadedFeats();

    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const optionsHtml = abilities.map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join('');

    const $rows = $('#dnd-sk-asi-rows');
    let html = '';
    for (const asiLvl of applicable) {
        const choice = (savedChoices || {})[asiLvl];
        const isFeat = choice && choice.feat;
        html += `<div class="dnd-sk-asi-row" data-asi-level="${asiLvl}">
            <span class="dnd-sk-asi-badge">Lv ${asiLvl}</span>
            <label class="dnd-sk-check"><input type="checkbox" class="dnd-sk-asi-feat-toggle" data-asi-level="${asiLvl}" ${isFeat ? 'checked' : ''}/> Feat</label>
            <div class="dnd-sk-asi-ability-picks" ${isFeat ? 'style="display:none;"' : ''}>
                <select class="dnd-sk-asi-select" data-asi-idx="0">${optionsHtml}</select>
                <select class="dnd-sk-asi-select" data-asi-idx="1">${optionsHtml}</select>
            </div>
            <div class="dnd-sk-asi-feat-picks" ${isFeat ? '' : 'style="display:none;"'}>
                <select class="dnd-sk-feat-select" data-asi-level="${asiLvl}"><option value="">-- Pick Feat --</option></select>
                <div class="dnd-sk-feat-ability-row" data-asi-level="${asiLvl}"></div>
            </div>
        </div>`;
    }
    $rows.html(html);

    for (const asiLvl of applicable) {
        const choice = (savedChoices || {})[asiLvl];
        const $row = $rows.find(`[data-asi-level="${asiLvl}"]`);
        if (choice?.feat) {
            populateFeatDropdown($row.find('.dnd-sk-feat-select'), allFeats, asiLvl, choice.feat);
            $row.find('.dnd-sk-feat-select').val(choice.feat);
            renderFeatAbilityChoice($row, choice.feat, choice.featAbility, (savedFeatData || {})[choice.feat]);
        } else {
            const c = choice || ['str', 'str'];
            $row.find('[data-asi-idx="0"]').val(c[0] || 'str');
            $row.find('[data-asi-idx="1"]').val(c[1] || 'str');
        }
    }

    $rows.off('change', '.dnd-sk-asi-feat-toggle').on('change', '.dnd-sk-asi-feat-toggle', function () {
        const $row = $(this).closest('.dnd-sk-asi-row');
        const lvl = parseInt($row.data('asi-level'));
        if ($(this).prop('checked')) {
            $row.find('.dnd-sk-asi-ability-picks').hide();
            $row.find('.dnd-sk-asi-feat-picks').show();
            populateFeatDropdown($row.find('.dnd-sk-feat-select'), allFeats, lvl);
        } else {
            $row.find('.dnd-sk-asi-ability-picks').show();
            $row.find('.dnd-sk-asi-feat-picks').hide();
        }
        updateAcPreview();
    });

    $rows.off('change', '.dnd-sk-feat-select').on('change', '.dnd-sk-feat-select', function () {
        const featName = $(this).val();
        const $row = $(this).closest('.dnd-sk-asi-row');
        renderFeatAbilityChoice($row, featName);
        updateAcPreview();
    });

    $rows.off('change', '.dnd-sk-feat-mi-list').on('change', '.dnd-sk-feat-mi-list', function () {
        const featName = $(this).data('feat');
        const newList = $(this).val();
        if (!featName) return;
        const store = _skFeatSpellData[featName] || {};
        store.selectedCantrips = [];
        store.selectedSpell = '';
        _skFeatSpellData[featName] = store;
        const $container = $(this).closest('.dnd-sk-feat-ability-row');
        populateFeatSpellPickers($container, featName, { spellList: newList });
    });

    $('#dnd-sk-asi-section').show();
}

function populateFeatDropdown($select, allFeats, asiLvl, selectedFeat) {
    const type = /** @type {string} */ ($('#dnd-sk-type').val());
    const level = getSidekickLevel();
    $select.html('<option value="">-- Pick Feat --</option>');
    const eligible = allFeats.filter(f => {
        const cat = f.category || '';
        return cat === 'G' || cat === 'O';
    });
    for (const f of eligible.sort((a, b) => a.name.localeCompare(b.name))) {
        const sel = f.name === selectedFeat ? ' selected' : '';
        const abInfo = parseFeatAbility(f);
        let abHint = '';
        if (abInfo) {
            const parts = [];
            for (const [ab, val] of Object.entries(abInfo.fixed)) parts.push(`${ab.toUpperCase()} +${val}`);
            if (abInfo.choose) parts.push(`Choose ${abInfo.choose.count} from ${abInfo.choose.from.map(a => a.toUpperCase()).join('/')}`);
            abHint = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
        }
        $select.append(`<option value="${escHtml(f.name)}"${sel}>${escHtml(f.name)}${abHint}</option>`);
    }
}

function renderFeatAbilityChoice($row, featName, savedChoice, savedFeatData) {
    const $container = $row.find('.dnd-sk-feat-ability-row');
    if (!featName) { $container.html(''); return; }
    const feat = lookupFeatByName(featName);
    if (!feat) { $container.html(''); return; }

    let html = '';

    const abInfo = parseFeatAbility(feat);
    if (abInfo) {
        for (const [ab, val] of Object.entries(abInfo.fixed)) {
            html += `<span class="dnd-sk-feat-fixed">${ab.toUpperCase()} +${val}</span> `;
        }
        if (abInfo.choose) {
            const opts = abInfo.choose.from.map(a => {
                const sel = savedChoice === a ? ' selected' : '';
                return `<option value="${a}"${sel}>${a.toUpperCase()}</option>`;
            }).join('');
            html += `<select class="dnd-sk-feat-ability-select">${opts}</select> +1 `;
        }
    }

    const uiDesc = getFeatUIDescriptor(featName);
    if (uiDesc) {
        html += renderFeatConfigUI(featName, uiDesc, savedFeatData || {});
    }

    $container.html(html || '<em>No ability boost</em>');

    if (uiDesc && (uiDesc.type === 'magicInitiate' || uiDesc.type === 'spellPick' || uiDesc.type === 'ritualCaster')) {
        populateFeatSpellPickers($container, featName, savedFeatData || {});
    }
}

function renderFeatConfigUI(featName, uiDesc, savedData) {
    const c = uiDesc.config;
    let html = '<div class="dnd-sk-feat-config">';

    if (uiDesc.type === 'skillsAndTools') {
        html += `<div class="dnd-sk-feat-config-label">${escHtml(c.label)}</div>`;
        const savedSkills = savedData.selectedSkills || [];
        const savedTools = savedData.selectedTools || [];
        html += '<div class="dnd-sk-feat-config-picks">';
        for (let i = 0; i < c.skillCount; i++) {
            const saved = i < savedSkills.length ? savedSkills[i] : (i < c.skillCount - savedTools.length ? '' : '');
            const allSaved = [...savedSkills, ...savedTools];
            const val = allSaved[i] || '';
            html += `<select class="dnd-sk-feat-skill-tool-pick" data-feat="${escHtml(featName)}" data-idx="${i}">`;
            html += '<option value="">-- Pick --</option>';
            html += '<optgroup label="Skills">';
            for (const sk of ALL_SKILLS) {
                const sel = val === sk ? ' selected' : '';
                html += `<option value="${sk}"${sel}>${SKILL_LABELS[sk]}</option>`;
            }
            html += '</optgroup><optgroup label="Tools & Instruments">';
            for (const tool of DND_TOOLS) {
                const sel = val === tool ? ' selected' : '';
                html += `<option value="${escHtml(tool)}"${sel}>${escHtml(tool)}</option>`;
            }
            html += '</optgroup></select>';
        }
        html += '</div>';
    } else if (uiDesc.type === 'skillExpert') {
        html += `<div class="dnd-sk-feat-config-label">${escHtml(c.label)}</div>`;
        html += '<div class="dnd-sk-feat-config-picks">';
        html += `<select class="dnd-sk-feat-skill-pick" data-feat="${escHtml(featName)}" data-key="selectedSkill">`;
        html += '<option value="">Proficiency</option>';
        for (const sk of ALL_SKILLS) {
            const sel = savedData.selectedSkill === sk ? ' selected' : '';
            html += `<option value="${sk}"${sel}>${SKILL_LABELS[sk]}</option>`;
        }
        html += '</select>';
        html += `<select class="dnd-sk-feat-skill-pick" data-feat="${escHtml(featName)}" data-key="selectedExpertise">`;
        html += '<option value="">Expertise</option>';
        for (const sk of ALL_SKILLS) {
            const sel = savedData.selectedExpertise === sk ? ' selected' : '';
            html += `<option value="${sk}"${sel}>${SKILL_LABELS[sk]}</option>`;
        }
        html += '</select></div>';
    } else if (uiDesc.type === 'magicInitiate') {
        html += `<div class="dnd-sk-feat-config-label">${escHtml(c.label)}</div>`;
        html += '<div class="dnd-sk-feat-config-picks">';
        html += `<select class="dnd-sk-feat-mi-list" data-feat="${escHtml(featName)}">`;
        for (const list of c.lists) {
            const sel = savedData.spellList === list ? ' selected' : '';
            html += `<option value="${list}"${sel}>${list}</option>`;
        }
        html += '</select>';
        html += `<div class="dnd-sk-feat-mi-spells" data-feat="${escHtml(featName)}"></div>`;
        html += '</div>';
    } else if (uiDesc.type === 'spellPick') {
        html += `<div class="dnd-sk-feat-config-label">${escHtml(c.label)}</div>`;
        if (c.fixedSpells?.length) {
            html += `<div><em>Always: ${c.fixedSpells.join(', ')}</em></div>`;
        }
        html += `<div class="dnd-sk-feat-mi-spells" data-feat="${escHtml(featName)}"></div>`;
    } else if (uiDesc.type === 'damageTypePick') {
        html += `<select class="dnd-sk-feat-dmgtype-pick" data-feat="${escHtml(featName)}">`;
        for (const opt of c.options) {
            const sel = savedData.damageType === opt ? ' selected' : '';
            html += `<option value="${opt}"${sel}>${opt}</option>`;
        }
        html += '</select>';
    } else if (uiDesc.type === 'ritualCaster') {
        html += `<div class="dnd-sk-feat-config-label">${escHtml(c.label)}</div>`;
        html += `<div class="dnd-sk-feat-mi-spells" data-feat="${escHtml(featName)}"></div>`;
    }

    html += '</div>';
    return html;
}

// ─── Feat Spell Picker UI ────────────────────────────────────

const _skFeatSpellData = {};

async function populateFeatSpellPickers($container, featName, savedData) {
    const uiDesc = getFeatUIDescriptor(featName);
    if (!uiDesc) return;
    const $target = $container.find(`.dnd-sk-feat-mi-spells[data-feat="${featName}"]`);
    if (!$target.length) return;

    $target.html('<span class="dnd-sk-no-spells">Loading spells...</span>');
    await preloadSpellData();

    if (!_skFeatSpellData[featName]) _skFeatSpellData[featName] = {};
    const store = _skFeatSpellData[featName];

    if (uiDesc.type === 'magicInitiate') {
        const list = $container.find(`.dnd-sk-feat-mi-list[data-feat="${featName}"]`).val() || savedData.spellList || uiDesc.config.lists[0];
        Object.assign(store, { selectedCantrips: savedData.selectedCantrips?.slice() || store.selectedCantrips || [], selectedSpell: savedData.selectedSpell || store.selectedSpell || '' });
        buildMagicInitiatePicker($target, featName, list, store);
    } else if (uiDesc.type === 'spellPick') {
        Object.assign(store, { selectedSpell: savedData.selectedSpell || store.selectedSpell || '' });
        const schoolCodes = uiDesc.config.pickSchools || [];
        buildSchoolSpellPicker($target, featName, schoolCodes, uiDesc.config.pickLevel || 1, store);
    } else if (uiDesc.type === 'ritualCaster') {
        Object.assign(store, { selectedSpells: savedData.selectedSpells?.slice() || store.selectedSpells || [] });
        buildRitualCasterPicker($target, featName, store);
    }
}

function buildMagicInitiatePicker($target, featName, classList, store) {
    $target.empty();
    const cantrips = getSpellsForClass(classList, 0, true);
    const spells = getSpellsForClass(classList, 1, false).filter(s => s.level === 1);

    const cantripLabel = $(`<div class="dnd-sk-feat-config-label">Cantrips (${store.selectedCantrips.length}/2):</div>`);
    $target.append(cantripLabel);

    const $cantripTags = $('<div class="dnd-sk-feat-spell-tags"></div>');
    $target.append($cantripTags);

    const renderCTags = () => {
        $cantripTags.empty();
        if (!store.selectedCantrips.length) {
            $cantripTags.html('<span class="dnd-sk-no-spells">None selected</span>');
            return;
        }
        for (const name of store.selectedCantrips) {
            const $tag = $(`<span class="dnd-sk-spell-tag">${escHtml(name)} <button class="dnd-sk-spell-remove">&times;</button></span>`);
            $tag.find('.dnd-sk-spell-remove').on('click', () => {
                store.selectedCantrips = store.selectedCantrips.filter(c => c !== name);
                cantripLabel.text(`Cantrips (${store.selectedCantrips.length}/2):`);
                renderCTags();
            });
            $cantripTags.append($tag);
        }
    };
    renderCTags();

    const $cantripSearch = $('<input type="text" placeholder="Search cantrips..." autocomplete="off" class="dnd-sk-feat-spell-input" />');
    const $cantripDD = $('<div class="dnd-sk-feat-spell-dd"></div>');
    $target.append($cantripSearch, $cantripDD);

    $cantripSearch.on('input', function () {
        const q = /** @type {string} */ ($(this).val()).toLowerCase().trim();
        if (!q) { $cantripDD.empty().hide(); return; }
        const chosen = new Set(store.selectedCantrips.map(n => n.toLowerCase()));
        const matches = cantrips.filter(s => s.name.toLowerCase().includes(q) && !chosen.has(s.name.toLowerCase())).slice(0, 10);
        if (!matches.length) { $cantripDD.html('<div class="dnd-sk-dd-empty">No cantrips found</div>').show(); return; }
        $cantripDD.html(matches.map(s => `<div class="dnd-sk-dd-item" data-name="${escHtml(s.name)}">${escHtml(s.name)} <span style="opacity:0.5">${spellSchoolLabel(s.school)}</span></div>`).join('')).show();
        $cantripDD.find('.dnd-sk-dd-item').on('click', function () {
            if (store.selectedCantrips.length >= 2) return;
            store.selectedCantrips.push($(this).data('name'));
            cantripLabel.text(`Cantrips (${store.selectedCantrips.length}/2):`);
            renderCTags();
            $cantripSearch.val('');
            $cantripDD.empty().hide();
        });
    });

    const spellLabel = $(`<div class="dnd-sk-feat-config-label" style="margin-top:0.3rem">1st-Level Spell (1/LR free):</div>`);
    $target.append(spellLabel);

    const $spellTags = $('<div class="dnd-sk-feat-spell-tags"></div>');
    $target.append($spellTags);

    const renderSTags = () => {
        $spellTags.empty();
        if (!store.selectedSpell) {
            $spellTags.html('<span class="dnd-sk-no-spells">None selected</span>');
            return;
        }
        const $tag = $(`<span class="dnd-sk-spell-tag">${escHtml(store.selectedSpell)} <button class="dnd-sk-spell-remove">&times;</button></span>`);
        $tag.find('.dnd-sk-spell-remove').on('click', () => {
            store.selectedSpell = '';
            renderSTags();
        });
        $spellTags.append($tag);
    };
    renderSTags();

    if (!store.selectedSpell) {
        const $spellSearch = $('<input type="text" placeholder="Search 1st-level spells..." autocomplete="off" class="dnd-sk-feat-spell-input" />');
        const $spellDD = $('<div class="dnd-sk-feat-spell-dd"></div>');
        $target.append($spellSearch, $spellDD);

        $spellSearch.on('input', function () {
            const q = /** @type {string} */ ($(this).val()).toLowerCase().trim();
            if (!q) { $spellDD.empty().hide(); return; }
            const matches = spells.filter(s => s.name.toLowerCase().includes(q)).slice(0, 10);
            if (!matches.length) { $spellDD.html('<div class="dnd-sk-dd-empty">No spells found</div>').show(); return; }
            $spellDD.html(matches.map(s => `<div class="dnd-sk-dd-item" data-name="${escHtml(s.name)}">${escHtml(s.name)} <span style="opacity:0.5">${spellSchoolLabel(s.school)}</span></div>`).join('')).show();
            $spellDD.find('.dnd-sk-dd-item').on('click', function () {
                store.selectedSpell = $(this).data('name');
                renderSTags();
                $spellSearch.val('');
                $spellDD.empty().hide();
                $spellSearch.hide();
            });
        });
    }
}

function buildSchoolSpellPicker($target, featName, schoolCodes, level, store) {
    $target.empty();
    const schoolSet = new Set(schoolCodes);
    const allSpells = getAllLoadedSpells().filter(s => s.level === level && schoolSet.has(s.school))
        .map(s => ({ name: s.name, school: s.school, source: s.source }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const schoolNames = schoolCodes.map(c => SPELL_SCHOOLS[c] || c).join('/');
    const $tags = $('<div class="dnd-sk-feat-spell-tags"></div>');
    $target.append($tags);

    const renderTags = () => {
        $tags.empty();
        if (!store.selectedSpell) {
            $tags.html('<span class="dnd-sk-no-spells">None selected</span>');
            return;
        }
        const $tag = $(`<span class="dnd-sk-spell-tag">${escHtml(store.selectedSpell)} <button class="dnd-sk-spell-remove">&times;</button></span>`);
        $tag.find('.dnd-sk-spell-remove').on('click', () => {
            store.selectedSpell = '';
            buildSchoolSpellPicker($target, featName, schoolCodes, level, store);
        });
        $tags.append($tag);
    };
    renderTags();

    if (!store.selectedSpell) {
        const $search = $(`<input type="text" placeholder="Search ${schoolNames} spells..." autocomplete="off" class="dnd-sk-feat-spell-input" />`);
        const $dd = $('<div class="dnd-sk-feat-spell-dd"></div>');
        $target.append($search, $dd);

        $search.on('input', function () {
            const q = /** @type {string} */ ($(this).val()).toLowerCase().trim();
            if (!q) { $dd.empty().hide(); return; }
            const matches = allSpells.filter(s => s.name.toLowerCase().includes(q)).slice(0, 10);
            if (!matches.length) { $dd.html('<div class="dnd-sk-dd-empty">No spells found</div>').show(); return; }
            $dd.html(matches.map(s => `<div class="dnd-sk-dd-item" data-name="${escHtml(s.name)}">${escHtml(s.name)} <span style="opacity:0.5">(${SPELL_SCHOOLS[s.school] || s.school})</span></div>`).join('')).show();
            $dd.find('.dnd-sk-dd-item').on('click', function () {
                store.selectedSpell = $(this).data('name');
                renderTags();
                $search.val('');
                $dd.empty().hide();
                $search.hide();
            });
        });
    }
}

function buildRitualCasterPicker($target, featName, store) {
    $target.empty();
    const allSpells = getAllLoadedSpells().filter(s => s.level >= 1 && s.meta?.ritual)
        .map(s => ({ name: s.name, level: s.level, school: s.school, source: s.source }))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

    const level = getSidekickLevel();
    const profBonus = Math.floor((level - 1) / 4) + 2;
    const maxPicks = profBonus;

    const countLabel = $(`<div class="dnd-sk-feat-config-label">Ritual Spells (${store.selectedSpells.length}/${maxPicks}):</div>`);
    $target.append(countLabel);

    const $tags = $('<div class="dnd-sk-feat-spell-tags"></div>');
    $target.append($tags);

    const renderTags = () => {
        $tags.empty();
        if (!store.selectedSpells.length) {
            $tags.html('<span class="dnd-sk-no-spells">None selected</span>');
            return;
        }
        for (const name of store.selectedSpells) {
            const $tag = $(`<span class="dnd-sk-spell-tag">${escHtml(name)} <button class="dnd-sk-spell-remove">&times;</button></span>`);
            $tag.find('.dnd-sk-spell-remove').on('click', () => {
                store.selectedSpells = store.selectedSpells.filter(s => s !== name);
                countLabel.text(`Ritual Spells (${store.selectedSpells.length}/${maxPicks}):`);
                renderTags();
            });
            $tags.append($tag);
        }
    };
    renderTags();

    const $search = $('<input type="text" placeholder="Search ritual spells..." autocomplete="off" class="dnd-sk-feat-spell-input" />');
    const $dd = $('<div class="dnd-sk-feat-spell-dd"></div>');
    $target.append($search, $dd);

    $search.on('input', function () {
        const q = /** @type {string} */ ($(this).val()).toLowerCase().trim();
        if (!q) { $dd.empty().hide(); return; }
        const chosen = new Set(store.selectedSpells.map(n => n.toLowerCase()));
        const matches = allSpells.filter(s => s.name.toLowerCase().includes(q) && !chosen.has(s.name.toLowerCase())).slice(0, 10);
        if (!matches.length) { $dd.html('<div class="dnd-sk-dd-empty">No spells found</div>').show(); return; }
        $dd.html(matches.map(s => `<div class="dnd-sk-dd-item" data-name="${escHtml(s.name)}">${escHtml(s.name)} <span style="opacity:0.5">Lv${s.level} ${spellSchoolLabel(s.school)}</span></div>`).join('')).show();
        $dd.find('.dnd-sk-dd-item').on('click', function () {
            if (store.selectedSpells.length >= maxPicks) return;
            store.selectedSpells.push($(this).data('name'));
            countLabel.text(`Ritual Spells (${store.selectedSpells.length}/${maxPicks}):`);
            renderTags();
            $search.val('');
            $dd.empty().hide();
        });
    });
}

function populateClassFeatureChoices(type, existingSk) {
    const level = getSidekickLevel();
    let anyVisible = false;

    if (type === 'expert' && level >= 15) {
        const profSkills = [];
        $('#dnd-sk-skill-checks input:checked').each(function () { profSkills.push($(this).data('skill')); });
        const allProf = [...profSkills, ...(existingSk?.creatureSkillProficiencies || [])];
        const saved = existingSk?.expertise15 || [];
        let html = '';
        for (const sk of [...new Set(allProf)]) {
            const checked = saved.includes(sk) ? ' checked' : '';
            html += `<label class="dnd-sk-check"><input type="checkbox" data-exp15="${sk}"${checked} /> ${SKILL_LABELS[sk] || sk}</label>`;
        }
        $('#dnd-sk-expertise15-checks').html(html);
        $('#dnd-sk-expertise15-checks').off('change').on('change', 'input', function () {
            if ($('#dnd-sk-expertise15-checks input:checked').length > 2) $(this).prop('checked', false);
        });
        $('#dnd-sk-expertise15-row').show();
        anyVisible = true;
    } else {
        $('#dnd-sk-expertise15-row').hide();
    }

    if (type === 'expert' && level >= 18) {
        $('#dnd-sk-sharp-mind-select').val(existingSk?.sharpMindSave || '');
        $('#dnd-sk-sharp-mind-row').show();
        anyVisible = true;
    } else {
        $('#dnd-sk-sharp-mind-row').hide();
    }

    if (type === 'spellcaster' && level >= 14) {
        const $sel = $('#dnd-sk-empowered-select');
        $sel.html('<option value="">-- Select --</option>');
        for (const [code, label] of Object.entries(SPELL_SCHOOLS)) {
            $sel.append(`<option value="${code}">${label}</option>`);
        }
        $sel.val(existingSk?.empoweredSchool || '');
        $('#dnd-sk-empowered-row').show();
        anyVisible = true;
    } else {
        $('#dnd-sk-empowered-row').hide();
    }

    $('#dnd-sk-class-features-section').toggle(anyVisible);
}

async function showSpellsSection(existingSk) {
    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const maxCantrips = CANTRIP_PROGRESSION[idx] || 2;
    const maxSpells = SPELLS_KNOWN_PROGRESSION[idx] || 1;

    _skTempCantrips = existingSk?.knownCantrips?.slice() || [];
    _skTempSpells = existingSk?.knownSpells?.slice() || [];

    $('#dnd-sk-cantrip-count').text(`Cantrips (${_skTempCantrips.length}/${maxCantrips}):`);
    $('#dnd-sk-spell-count').text(`Spells (${_skTempSpells.length}/${maxSpells}):`);

    renderSpellTags('#dnd-sk-cantrip-tags', _skTempCantrips);
    renderSpellTags('#dnd-sk-spell-tags', _skTempSpells);

    $('#dnd-sk-cantrip-search').val('');
    $('#dnd-sk-spell-search').val('');
    $('#dnd-sk-cantrip-dropdown').html('<div class="dnd-sk-dd-empty">Loading spells...</div>');
    $('#dnd-sk-spell-dropdown').html('<div class="dnd-sk-dd-empty">Loading spells...</div>');

    $('#dnd-sk-spells-section').show();

    await preloadSpellData();
    refreshSpellDropdown(true);
    refreshSpellDropdown(false);
}

function getSelectedSpellList(isCantrip) {
    return isCantrip ? _skTempCantrips : _skTempSpells;
}

function refreshSpellDropdown(isCantrip) {
    const dropId = isCantrip ? '#dnd-sk-cantrip-dropdown' : '#dnd-sk-spell-dropdown';
    const searchId = isCantrip ? '#dnd-sk-cantrip-search' : '#dnd-sk-spell-search';
    const $drop = $(dropId);
    const query = (/** @type {string} */ ($(searchId).val()) || '').toLowerCase().trim();

    const subtype = /** @type {string} */ ($('#dnd-sk-subtype').val());
    const subInfo = SIDEKICK_TYPES.spellcaster.subtypes.find(s => s.key === subtype);
    if (!subInfo) {
        $drop.html('<div class="dnd-sk-dd-empty">Select a subtype first</div>');
        return;
    }

    const level = getSidekickLevel();
    const maxLevel = getMaxSpellLevel(level);
    let spells = getSpellsForClass(subInfo.list, maxLevel, isCantrip);

    if (query) {
        spells = spells.filter(s => s.name.toLowerCase().includes(query));
    }

    const selected = new Set(getSelectedSpellList(isCantrip).map(n => n.toLowerCase()));

    if (spells.length === 0) {
        $drop.html('<div class="dnd-sk-dd-empty">No spells found</div>');
        return;
    }

    const items = spells.map(s => {
        const esc = escHtml(s.name);
        const school = spellSchoolLabel(s.school);
        const lvl = s.level === 0 ? 'cantrip' : `Lv${s.level}`;
        const info = [lvl, school, s.source].filter(Boolean).join(' · ');
        const sel = selected.has(s.name.toLowerCase()) ? ' dnd-sk-dd-selected' : '';
        return `<div class="dnd-sk-dd-item dnd-sk-spell-dd-item${sel}" data-spell-name="${esc}" data-is-cantrip="${isCantrip}"><span class="dnd-sk-dd-name">${esc}</span><span class="dnd-sk-dd-info">${info}</span></div>`;
    });
    $drop.html(items.join(''));
}

function renderSpellTags(selector, spells) {
    const $el = $(selector);
    if (!spells || spells.length === 0) {
        $el.html('<span class="dnd-sk-no-spells">None selected</span>');
        return;
    }
    const tags = spells.map(name =>
        `<span class="dnd-sk-spell-tag" data-spell-name="${escHtml(name)}">${escHtml(name)} <button class="dnd-sk-spell-remove" data-spell="${escHtml(name)}">&times;</button></span>`
    );
    $el.html(tags.join(''));
}

function addSpellToSidekick(name, isCantrip) {
    const tagsId = isCantrip ? '#dnd-sk-cantrip-tags' : '#dnd-sk-spell-tags';
    const countId = isCantrip ? '#dnd-sk-cantrip-count' : '#dnd-sk-spell-count';

    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const max = isCantrip ? (CANTRIP_PROGRESSION[idx] || 2) : (SPELLS_KNOWN_PROGRESSION[idx] || 1);

    const list = getSelectedSpellList(isCantrip);
    if (list.some(s => s.toLowerCase() === name.toLowerCase())) return;
    if (list.length >= max) {
        toastr.warning(`Maximum ${max} ${isCantrip ? 'cantrips' : 'spells'} allowed at this level`);
        return;
    }

    list.push(name);
    renderSpellTags(tagsId, list);
    $(countId).text(`${isCantrip ? 'Cantrips' : 'Spells'} (${list.length}/${max}):`);
    refreshSpellDropdown(isCantrip);
}

function removeSpellFromSidekick(name, isCantrip) {
    const tagsId = isCantrip ? '#dnd-sk-cantrip-tags' : '#dnd-sk-spell-tags';
    const countId = isCantrip ? '#dnd-sk-cantrip-count' : '#dnd-sk-spell-count';

    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const max = isCantrip ? (CANTRIP_PROGRESSION[idx] || 2) : (SPELLS_KNOWN_PROGRESSION[idx] || 1);

    const list = getSelectedSpellList(isCantrip);
    const idx2 = list.findIndex(s => s.toLowerCase() === name.toLowerCase());
    if (idx2 >= 0) list.splice(idx2, 1);
    renderSpellTags(tagsId, list);
    $(countId).text(`${isCantrip ? 'Cantrips' : 'Spells'} (${list.length}/${max}):`);
    refreshSpellDropdown(isCantrip);
}

function saveSidekickFromModal() {
    const $error = $('#dnd-sk-config-error');
    $error.hide();

    const name = /** @type {string} */ ($('#dnd-sk-name').val()).trim();
    const race = /** @type {string} */ ($('#dnd-sk-race').val()).trim();
    const type = /** @type {string} */ ($('#dnd-sk-type').val());
    const subtype = /** @type {string} */ ($('#dnd-sk-subtype').val()) || null;

    if (!name) { $error.text('Name is required.').show(); return; }
    if (!type) { $error.text('Select a sidekick type.').show(); return; }

    const saveProficiency = /** @type {string} */ ($('#dnd-sk-save-prof').val()) || null;

    const skillProficiencies = [];
    $('#dnd-sk-skill-checks input:checked').each(function () {
        skillProficiencies.push($(this).data('skill'));
    });

    const skillExpertise = [];
    $('#dnd-sk-expertise-checks input:checked').each(function () {
        skillExpertise.push($(this).data('expertise'));
    });

    const toolProficiencies = [];
    $('#dnd-sk-tool-checks input:checked').each(function () {
        toolProficiencies.push($(this).data('tool'));
    });

    const asiChoices = {};
    $('#dnd-sk-asi-rows .dnd-sk-asi-row').each(function () {
        const lvl = parseInt($(this).data('asi-level'));
        const isFeat = $(this).find('.dnd-sk-asi-feat-toggle').prop('checked');
        if (isFeat) {
            const featName = $(this).find('.dnd-sk-feat-select').val() || null;
            const featAbility = $(this).find('.dnd-sk-feat-ability-select').val() || null;
            asiChoices[lvl] = { feat: featName, featAbility };
        } else {
            const a1 = $(this).find('[data-asi-idx="0"]').val();
            const a2 = $(this).find('[data-asi-idx="1"]').val();
            asiChoices[lvl] = [a1, a2];
        }
    });

    const featData = {};
    $('#dnd-sk-asi-rows .dnd-sk-feat-config').each(function () {
        const $cfg = $(this);
        const $row = $cfg.closest('.dnd-sk-asi-row');
        const featName = $row.find('.dnd-sk-feat-select').val();
        if (!featName) return;
        const data = {};

        const $stPicks = $cfg.find('.dnd-sk-feat-skill-tool-pick');
        if ($stPicks.length > 0) {
            data.selectedSkills = [];
            data.selectedTools = [];
            $stPicks.each(function () {
                const val = /** @type {string} */ ($(this).val());
                if (!val) return;
                if (ALL_SKILLS.includes(val)) data.selectedSkills.push(val);
                else data.selectedTools.push(val);
            });
        }

        const $skillPicks = $cfg.find('.dnd-sk-feat-skill-pick');
        $skillPicks.each(function () {
            const key = $(this).data('key');
            if (key) data[key] = $(this).val() || null;
        });

        const $miList = $cfg.find('.dnd-sk-feat-mi-list');
        if ($miList.length) data.spellList = $miList.val() || null;

        const $dmgType = $cfg.find('.dnd-sk-feat-dmgtype-pick');
        if ($dmgType.length) data.damageType = $dmgType.val() || null;

        const spellStore = _skFeatSpellData[featName];
        if (spellStore) {
            if (spellStore.selectedCantrips?.length) data.selectedCantrips = spellStore.selectedCantrips.slice();
            if (spellStore.selectedSpell) data.selectedSpell = spellStore.selectedSpell;
            if (spellStore.selectedSpells?.length) data.selectedSpells = spellStore.selectedSpells.slice();
        }

        featData[featName] = data;
    });

    const knownCantrips = _skTempCantrips.slice();
    const knownSpells = _skTempSpells.slice();

    const expertise15 = [];
    $('#dnd-sk-expertise15-checks input:checked').each(function () { expertise15.push($(this).data('exp15')); });
    const sharpMindSave = /** @type {string} */ ($('#dnd-sk-sharp-mind-select').val()) || null;
    const empoweredSchool = /** @type {string} */ ($('#dnd-sk-empowered-select').val()) || null;

    const hireGoldPerDay = parseInt(/** @type {string} */ ($('#dnd-sk-hire-gold').val())) || 0;
    const hirePayMode = /** @type {string} */ ($('#dnd-sk-hire-paymode').val()) || 'owed';
    const hirePaidAmount = parseInt(/** @type {string} */ ($('#dnd-sk-hire-paid').val())) || 0;
    const hireQuestAmount = parseInt(/** @type {string} */ ($('#dnd-sk-hire-quest-amount').val())) || 0;
    const hireQuestPaid = !!$('#dnd-sk-hire-quest-paid').prop('checked');
    const hireDate = /** @type {string} */ ($('#dnd-sk-hire-date').val()).trim() || null;

    // Equipment: armor + shield
    let equippedArmor = null;
    if (_skSelectedArmorName) {
        const useMagic = !!$('#dnd-sk-magic-armor-check').prop('checked');
        const item = searchEquipment(_skSelectedArmorName, 'armor', useMagic).find(i => i.name === _skSelectedArmorName);
        if (item) {
            equippedArmor = armorFromItem(item);
            equippedArmor.attuned = !!_skTempArmorAttuned;
        }
    }
    let equippedShield = null;
    if (_skSelectedShieldName) {
        const useMagic = !!$('#dnd-sk-magic-shield-check').prop('checked');
        const item = searchEquipment(_skSelectedShieldName, 'shield', useMagic).find(i => i.name === _skSelectedShieldName);
        if (item) {
            equippedShield = shieldFromItem(item);
            equippedShield.attuned = !!_skTempShieldAttuned;
        } else {
            equippedShield = { name: _skSelectedShieldName, ac: 2, rarity: null, attuned: false };
        }
    }

    const editId = _skEditId;
    if (editId) {
        const sk = sidekicks.find(s => s.id === editId);
        if (!sk) { $error.text('Sidekick not found.').show(); return; }
        sk.name = name;
        sk.race = race;
        sk.type = type;
        sk.subtype = subtype;
        sk.saveProficiency = saveProficiency;
        sk.skillProficiencies = skillProficiencies;
        sk.skillExpertise = skillExpertise;
        sk.toolProficiencies = toolProficiencies;
        sk.asiChoices = asiChoices;
        sk.featData = featData;
        sk.expertise15 = expertise15;
        sk.sharpMindSave = sharpMindSave;
        sk.empoweredSchool = empoweredSchool;
        sk.knownCantrips = knownCantrips;
        sk.knownSpells = knownSpells;
        sk.hireGoldPerDay = hireGoldPerDay;
        sk.hirePayMode = hirePayMode;
        sk.hirePaidAmount = hirePaidAmount;
        sk.hireQuestAmount = hireQuestAmount;
        sk.hireQuestPaid = hireQuestPaid;
        sk.hireDate = hireDate;
        sk.equippedArmor = equippedArmor;
        sk.equippedShield = equippedShield;
        delete sk.hasShield;
        sk.creatureActions = _skTempActions;
        sk.creatureTraits = _skTempTraits;
        sk.weapons = _skTempWeapons;
        sk.items = _skTempItems.slice();
        sk.chosenLanguages = _skTempChosenLanguages.slice();

        if (_skTempCreature) {
            if (_skTempCreature.name !== sk.creatureName) {
                Object.assign(sk, buildCreatureFields(_skTempCreature));
            } else {
                if (!sk.creatureSkillProficiencies) {
                    sk.creatureSkillProficiencies = extractCreatureSkillProficiencies(_skTempCreature);
                }
                if (!sk.languagesFixed) {
                    const langRaw = Array.isArray(_skTempCreature.languages) ? _skTempCreature.languages.join(', ') : (_skTempCreature.languages || '');
                    const parsed = parseCreatureLanguages(langRaw);
                    sk.languagesFixed = parsed.fixed;
                    sk.languageChoiceCount = parsed.choiceCount;
                }
            }
        }
    } else {
        if (!_skTempCreature) { $error.text('Select a base creature.').show(); return; }
        const newSk = createSidekickFromCreature(_skTempCreature, {
            name, race, type, subtype, saveProficiency,
            skillProficiencies, skillExpertise, hireGoldPerDay, hirePayMode, hirePaidAmount, hireQuestAmount, hireQuestPaid, hireDate,
        });
        newSk.toolProficiencies = toolProficiencies;
        newSk.asiChoices = asiChoices;
        newSk.featData = featData;
        newSk.expertise15 = expertise15;
        newSk.sharpMindSave = sharpMindSave;
        newSk.empoweredSchool = empoweredSchool;
        newSk.knownCantrips = knownCantrips;
        newSk.knownSpells = knownSpells;
        newSk.creatureActions = _skTempActions;
        newSk.creatureTraits = _skTempTraits;
        newSk.weapons = _skTempWeapons;
        newSk.items = _skTempItems.slice();
        newSk.chosenLanguages = _skTempChosenLanguages.slice();
        newSk.equippedArmor = equippedArmor;
        newSk.equippedShield = equippedShield;
        sidekicks.push(newSk);
    }

    saveSidekicks(sidekicks);
    renderSidekickCards();
    hideTooltip();
    $('#dnd-sidekick-config-popup').hide();
    $('#dnd-sidekick-container').removeClass('dnd-collapsed');
    toastr.success(`Sidekick "${name}" ${editId ? 'updated' : 'added'}`);
}

function buildCreatureFields(creature) {
    const hd = (creature.hp?.formula || '').match(/(\d+)d(\d+)/);
    const speedParts = [];
    if (creature.speed) {
        for (const [k, v] of Object.entries(creature.speed)) {
            if (typeof v === 'number') speedParts.push(`${k} ${v} ft.`);
            else if (v && typeof v === 'object' && typeof v.number === 'number') speedParts.push(`${k} ${v.number} ft.`);
        }
    }
    const walkRaw = creature.speed?.walk;
    const walkSpeed = typeof walkRaw === 'number' ? walkRaw : (walkRaw?.number ?? 30);
    const langRaw = Array.isArray(creature.languages) ? creature.languages.join(', ') : (creature.languages || '');
    const langParsed = parseCreatureLanguages(langRaw);
    return {
        creatureName: creature.name,
        creatureSource: creature.source,
        baseHp: creature.hp || { average: 10, formula: '2d8' },
        baseAc: typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? 10,
        baseSpeed: walkSpeed,
        speedFull: speedParts.join(', ') || '30 ft.',
        baseSize: Array.isArray(creature.size) ? creature.size[0] : creature.size || 'M',
        baseStr: creature.str ?? 10,
        baseDex: creature.dex ?? 10,
        baseCon: creature.con ?? 10,
        baseInt: creature.int ?? 10,
        baseWis: creature.wis ?? 10,
        baseCha: creature.cha ?? 10,
        hitDieFaces: hd ? parseInt(hd[2]) : 8,
        hitDiceCount: hd ? parseInt(hd[1]) : 1,
        creatureSkills: creature.skill || {},
        creatureSaves: creature.save || {},
        creatureSkillProficiencies: extractCreatureSkillProficiencies(creature),
        senses: Array.isArray(creature.senses) ? creature.senses.join(', ') : (creature.senses || ''),
        languages: langRaw,
        languagesFixed: langParsed.fixed,
        languageChoiceCount: langParsed.choiceCount,
    };
}

// ─── Sidekick data migration ────────────────────────────────

function migrateSidekickData() {
    if (!sidekicks || sidekicks.length === 0) return;
    let dirty = false;
    for (const sk of sidekicks) {
        if (!sk.creatureSkillProficiencies && sk.creatureSkills) {
            const profs = [];
            for (const [rawKey, valStr] of Object.entries(sk.creatureSkills)) {
                const camel = rawKey.replace(/\s+/g, '').charAt(0).toLowerCase() + rawKey.replace(/\s+/g, '').slice(1);
                const ab = { acrobatics:'dex', animalHandling:'wis', arcana:'int', athletics:'str', deception:'cha', history:'int', insight:'wis', intimidation:'cha', investigation:'int', medicine:'wis', nature:'int', perception:'wis', performance:'cha', persuasion:'cha', religion:'int', sleightOfHand:'dex', stealth:'dex', survival:'wis' }[camel];
                if (!ab) continue;
                const baseScore = sk['base' + ab.charAt(0).toUpperCase() + ab.slice(1)] ?? 10;
                const baseMod = Math.floor((baseScore - 10) / 2);
                if (parseInt(valStr) > baseMod) profs.push(camel);
            }
            sk.creatureSkillProficiencies = profs;
            dirty = true;
        }
        if (!sk.languagesFixed && sk.languages) {
            const parsed = parseCreatureLanguages(sk.languages);
            sk.languagesFixed = parsed.fixed;
            sk.languageChoiceCount = parsed.choiceCount;
            dirty = true;
        }
        if (!sk.chosenLanguages) {
            sk.chosenLanguages = [];
            dirty = true;
        }
        // Migrate hasShield boolean to equippedShield object
        if (sk.hasShield !== undefined) {
            if (sk.hasShield && !sk.equippedShield) {
                sk.equippedShield = { name: 'Shield', ac: 2, rarity: null, attuned: false };
            }
            delete sk.hasShield;
            dirty = true;
        }
        // Backfill attunement fields on items, weapons, armor, and shield
        for (const it of (sk.items || [])) {
            if (it.attuned === undefined) { it.attuned = false; dirty = true; }
        }
        for (const w of (sk.weapons || [])) {
            if (w.attuned === undefined) { w.attuned = false; dirty = true; }
        }
        if (sk.equippedArmor && sk.equippedArmor.attuned === undefined) {
            sk.equippedArmor.attuned = false;
            dirty = true;
        }
        if (sk.equippedShield && sk.equippedShield.attuned === undefined) {
            sk.equippedShield.attuned = false;
            dirty = true;
        }
    }
    if (dirty) saveSidekicks(sidekicks);
}

// ─── Refresh from chat ──────────────────────────────────────

function handleRefreshFromChat() {
    if (!extensionSettings.enabled || extensionSettings.softDisabled) return;

    if (extensionSettings.v2Enabled) {
        loadV2Quests();
        loadV2Inventory();
        loadV2Companions();
    } else {
        loadQuests();
        loadInventory();
    }

    const headerResult = refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();

    if (extensionSettings.v2Enabled) {
        renderV2Quests();
        renderV2Inventory();
        renderV2CharacterPanel();
        renderCompanionCards();
    } else {
        renderQuests();
        renderInventory();
    }

    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateModifierDisplay();

    evaluateAutoBackground();

    if (headerResult) {
        toastr.success('Refreshed from chat');
    } else {
        toastr.info('Refreshed (no header found)');
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
        evaluateAutoBackground();
    }

    if (!spellTrackerDisabled) {
        refreshSpellLog();
        renderSpellLog();
    }

    // V2: parse inline game_actions JSON block from LLM response
    if (extensionSettings.v2Enabled) {
        parseAndApplyGameActions(message.mes);
        updateV2RevertButton();
    }

    // Re-save event state so it survives SillyTavern's own chat_metadata save
    if (extensionSettings.randomEventsEnabled && lastEventRoll) {
        saveRandomEventState();
    }
    updateRandomEventDisplay();
    updateNonCombatDiceDisplay();
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
    evaluateAutoBackground();

    // V2: re-parse inline game_actions from the new swipe
    if (extensionSettings.v2Enabled) {
        parseAndApplyGameActions(message.mes);
        updateV2RevertButton();
    }
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
    loadAutoLongRest();
    loadSpellLog();
    loadSpellbook();
    loadAutoBackgrounds();
    resetAutoBackgroundState();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();
    evaluateAutoBackground();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateStripWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateModifierDisplay();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

    ensureSpellData().then(() => renderSpellbook());

    loadCharacter();
    ensureCharacterData().then(() => renderCharacter());

    // Character must load before sidekicks so getSidekickLevel() sees the level
    if (extensionSettings.v1Enabled) {
        loadCharacterV1();
        renderV1CharacterPanel();
        renderV1Spellbook();
        renderV1CompanionPanel();
        preloadV1Assets();
        renderInventory();
    }
    if (extensionSettings.v2Enabled) {
        loadCharacterV2();
        renderV2CharacterPanel();
        preloadV2Assets();
    }

    loadSidekicks();
    renderSidekickCards();
    fetchEquipmentItems().then(() => fetchMagicItems());

    loadRandomEventState();
    updateRandomEventDisplay();
    updateNonCombatDiceDisplay();

    // V2 tool calling
    handleV2ChatChanged();
    checkCrossVersionWarning();
}

function preloadV1Assets() {
    const tasks = [
        preloadV1SpellData(),
        preloadSpellData(),
        fetchFeats(),
        fetchEquipmentItems().then(() => fetchMagicItems()),
    ];
    if (characterV1?.classFile) tasks.push(fetchClassFile(characterV1.classFile));
    return Promise.all(tasks).then(() => {
        renderV1Spellbook();
        renderV1CharacterPanel();
    });
}

function preloadV2Assets() {
    const tasks = [
        preloadSpellData(),
        preloadV2SpellData(),
        fetchFeats(),
        fetchEquipmentItems().then(() => fetchMagicItems()),
    ];
    if (characterV2?.classFile) tasks.push(fetchClassFile(characterV2.classFile));
    return Promise.all(tasks).then(() => {
        renderV2Spellbook();
        renderV2CharacterPanel();
    });
}


// ─── Random event display ───────────────────────────────────

const EVENT_SEVERITY_CLASSES = ['dnd-event-triggered', 'dnd-event-minor', 'dnd-event-moderate', 'dnd-event-major', 'dnd-event-critical'];

function setRandomEventInjectionEnabled(enabled) {
    extensionSettings.randomEventsEnabled = !!enabled;
    $('#dnd-setting-random-events').prop('checked', extensionSettings.randomEventsEnabled);
    saveSettings();
    updateRandomEventDisplay();
}

function updateRandomEventDisplay() {
    const enabled = extensionSettings.randomEventsEnabled;
    const roll = lastEventRoll;
    const $stripTag = $('#dnd-strip-event-tag');
    const $panelTag = $('#dnd-panel-event-tag');
    const $opts = $('#dnd-random-event-options');

    $opts.toggle(extensionSettings.randomEventsEnabled ?? false);

    if (!roll) {
        $stripTag.hide();
        $panelTag.hide();
        return;
    }

    const hasSeverity = !!roll.severity;
    const label = `${roll.roll}`;
    const severityClass = enabled && hasSeverity ? `dnd-event-${roll.severity.id}` : '';

    for (const $tag of [$stripTag, $panelTag]) {
        $tag.text(label).removeAttr('title').show();
        $tag.removeClass(EVENT_SEVERITY_CLASSES.join(' '));
        if (severityClass) $tag.addClass(severityClass);
    }

    bindEventTagTooltip($stripTag, roll, enabled);
    bindEventTagTooltip($panelTag, roll, enabled);
}

function bindEventTagTooltip($el, eventRoll, enabled) {
    const NS = '.dndEventTip';
    $el.off(NS);
    $el.on('mouseenter' + NS, function () { showEventTooltip(this, eventRoll, enabled); });
    $el.on('mouseleave' + NS, function () { hideTooltip(); });
}

// ─── Non-combat dice display ────────────────────────────────

function normalizeNonCombatRoll(roll) {
    if (!roll || !roll.user) return null;
    const user = roll.user;
    const ally = roll.ally || roll.npc || user;
    const npc = roll.npc || roll.ally || user;
    return { user, ally, npc };
}

function buildNonCombatDiceGroup(groupClass, shortLabel, pair) {
    return `<span class="${groupClass}">`
        + `<span class="dnd-noncombat-role">${shortLabel}</span>`
        + `<span class="dnd-noncombat-val">${pair.roll1}</span>`
        + `<span class="dnd-noncombat-sep">|</span>`
        + `<span class="dnd-noncombat-val">${pair.roll2}</span>`
        + `</span>`;
}

function buildNonCombatDiceLabel(roll) {
 /*   return buildNonCombatDiceGroup('dnd-noncombat-user', 'U', roll.user)
        + `<span class="dnd-noncombat-divider">·</span>`
        + buildNonCombatDiceGroup('dnd-noncombat-ally', 'A', roll.ally)
        + `<span class="dnd-noncombat-divider">·</span>`
        + buildNonCombatDiceGroup('dnd-noncombat-npc', 'N', roll.npc);
*/
// Removed U/A/N labels without breaking code. Lazy i know.
      return buildNonCombatDiceGroup('dnd-noncombat-user', '', roll.user)
        + `<span class="dnd-noncombat-divider">·</span>`
        + buildNonCombatDiceGroup('dnd-noncombat-ally', '', roll.ally)
        + `<span class="dnd-noncombat-divider">·</span>`
        + buildNonCombatDiceGroup('dnd-noncombat-npc', '', roll.npc);
}

function updateNonCombatDiceDisplay() {
    const enabled = extensionSettings.nonCombatDiceEnabled;
    const roll = normalizeNonCombatRoll(lastNonCombatRoll);
    const $stripTag = $('#dnd-strip-noncombat-tag');
    const $panelTag = $('#dnd-panel-noncombat-tag');

    if (!enabled || !roll) {
        $stripTag.hide();
        $panelTag.hide();
        return;
    }

    const label = buildNonCombatDiceLabel(roll);
    const tooltip = `Non-Combat d20s\nUser: ${roll.user.roll1}, ${roll.user.roll2}\nAlly: ${roll.ally.roll1}, ${roll.ally.roll2}\nNPC: ${roll.npc.roll1}, ${roll.npc.roll2}\n(checks vs DC, not opposed)`;

    $stripTag.html(label).attr('title', tooltip).show();
    $stripTag.addClass('dnd-noncombat-active');

    $panelTag.html(label).attr('title', tooltip).show();
    $panelTag.addClass('dnd-noncombat-active');
}

// ─── Threshold modal ────────────────────────────────────────

function openThresholdModal() {
    const tiers = getSeverityTiers();
    for (const tier of tiers) {
        $(`.dnd-event-tier-min[data-tier="${tier.id}"]`).val(tier.min);
        $(`.dnd-event-tier-max[data-tier="${tier.id}"]`).val(tier.max);
    }
    updateThresholdSummary();
    $('#dnd-event-threshold-popup').css('display', 'flex');
}

function updateThresholdSummary() {
    const minors = parseInt(/** @type {string} */ ($('.dnd-event-tier-min[data-tier="minor"]').val())) || 71;
    const noEventMax = minors - 1;
    $('#dnd-event-threshold-summary').text(`Rolls 1\u2013${noEventMax} = no event`);
}

function saveThresholds() {
    const overrides = {};
    for (const tier of DEFAULT_SEVERITY_TIERS) {
        const min = parseInt(/** @type {string} */ ($(`.dnd-event-tier-min[data-tier="${tier.id}"]`).val()));
        const max = parseInt(/** @type {string} */ ($(`.dnd-event-tier-max[data-tier="${tier.id}"]`).val()));
        if (!isNaN(min) && !isNaN(max)) {
            overrides[tier.id] = { min, max };
        }
    }
    extensionSettings.eventThresholds = overrides;
    saveSettings();
    $('#dnd-event-threshold-popup').hide();
}

function resetThresholds() {
    for (const tier of DEFAULT_SEVERITY_TIERS) {
        $(`.dnd-event-tier-min[data-tier="${tier.id}"]`).val(tier.min);
        $(`.dnd-event-tier-max[data-tier="${tier.id}"]`).val(tier.max);
    }
    updateThresholdSummary();
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

// ─── V1 Custom Species Editor ────────────────────────────────

function openSpeciesEditorModal() {
    const popup = document.getElementById('dnd-v1-species-editor-popup');
    if (!popup) return;
    popup.style.display = 'flex';
    showSpeciesListView();
}

function showSpeciesListView() {
    document.getElementById('dnd-v1-species-list-view').style.display = '';
    document.getElementById('dnd-v1-species-form-view').style.display = 'none';
    document.getElementById('dnd-v1-species-form-save').style.display = 'none';
    document.getElementById('dnd-v1-species-form-back').style.display = 'none';

    const list = document.getElementById('dnd-v1-species-list');
    if (!list) return;

    const species = listCustomSpecies();
    if (species.length === 0) {
        list.innerHTML = '<div class="dnd-v1-info-text">No custom species yet</div>';
        return;
    }

    list.innerHTML = species.map(s => `
        <div class="dnd-v1-species-list-item" data-id="${s.id}">
            <span class="species-name">${escHtml(s.name)}</span>
            <span class="dnd-v1-info-text">${s.size} | Speed ${s.speed}ft</span>
            <span class="species-actions">
                <button class="dnd-btn-sm v1-species-edit" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="dnd-btn-sm v1-species-delete" data-id="${s.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </span>
        </div>
    `).join('');

    list.querySelectorAll('.v1-species-edit').forEach(b => {
        const btn = /** @type {HTMLElement} */ (b);
        btn.onclick = () => openSpeciesForm(btn.dataset.id);
    });
    list.querySelectorAll('.v1-species-delete').forEach(b => {
        const btn = /** @type {HTMLElement} */ (b);
        btn.onclick = () => {
            if (confirm('Delete this custom species?')) {
                deleteCustomSpecies(btn.dataset.id);
                showSpeciesListView();
            }
        };
    });
}

function openSpeciesForm(editId) {
    document.getElementById('dnd-v1-species-list-view').style.display = 'none';
    document.getElementById('dnd-v1-species-form-view').style.display = '';
    document.getElementById('dnd-v1-species-form-save').style.display = '';
    document.getElementById('dnd-v1-species-form-back').style.display = '';

    const data = editId ? (listCustomSpecies().find(s => s.id === editId) || blankCustomSpecies()) : blankCustomSpecies();
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-species-form-id')).value = editId || '';

    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-name')).value = data.name || '';
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-size')).value = data.size || 'Medium';
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-speed')).value = data.speed ?? 30;
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-darkvision')).value = data.darkvision ?? 0;
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-resistances')).value = (data.resistances || []).join(', ');
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-languages')).value = (data.languages || []).join(', ');
    /** @type {HTMLInputElement} */ (document.getElementById('dnd-v1-cs-lang-choices')).value = data.languageChoiceCount ?? 0;

    // Creature type dropdown
    const typeSelect = document.getElementById('dnd-v1-cs-creature-type');
    if (typeSelect) {
        typeSelect.innerHTML = V1_CREATURE_TYPES.map(t =>
            `<option value="${t}" ${t === data.creatureType ? 'selected' : ''}>${t}</option>`
        ).join('');
    }

    // Ability boosts
    const boostGrid = document.getElementById('dnd-v1-cs-ability-boosts');
    if (boostGrid) {
        boostGrid.innerHTML = V1_ABILITY_KEYS.map(ab => {
            const val = data.abilityBoosts?.[ab] || 0;
            return `<div><label style="font-size:0.75em;display:block;text-align:center;">${V1_ABILITY_LABELS[ab]}</label><input type="number" min="0" max="5" value="${val}" data-ability="${ab}" class="v1-cs-boost" /></div>`;
        }).join('');
    }

    // Traits
    const traitsList = document.getElementById('dnd-v1-cs-traits-list');
    if (traitsList) {
        traitsList.innerHTML = '';
        for (const trait of (data.traits || [])) {
            addSpeciesTraitRow(trait.name, trait.description);
        }
    }
}

function addSpeciesTraitRow(name = '', description = '') {
    const list = document.getElementById('dnd-v1-cs-traits-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'dnd-v1-trait-item';
    div.innerHTML = `
        <span class="trait-remove" title="Remove trait">✕</span>
        <input type="text" class="v1-trait-name" placeholder="Trait name" value="${escHtml(name)}" />
        <textarea class="v1-trait-desc" placeholder="Mechanical description">${escHtml(description)}</textarea>
    `;
    /** @type {HTMLElement} */ (div.querySelector('.trait-remove')).onclick = () => div.remove();
    list.appendChild(div);
}

function saveSpeciesForm() {
    const id = /** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-species-form-id'))?.value || '';
    const name = /** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-name'))?.value?.trim() || '';
    if (!name) { toastr.warning('Species name is required'); return; }

    const data = {
        name,
        size: /** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-size'))?.value || 'Medium',
        speed: parseInt(/** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-speed'))?.value) || 30,
        darkvision: parseInt(/** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-darkvision'))?.value) || 0,
        resistances: (/** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-resistances'))?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        languages: (/** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-languages'))?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        languageChoiceCount: parseInt(/** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-lang-choices'))?.value) || 0,
        creatureType: /** @type {HTMLInputElement | null} */ (document.getElementById('dnd-v1-cs-creature-type'))?.value || 'Humanoid',
    };

    // Ability boosts
    const boosts = {};
    let hasBoosts = false;
    document.querySelectorAll('.v1-cs-boost').forEach(el => {
        const inp = /** @type {HTMLInputElement} */ (el);
        const val = parseInt(inp.value) || 0;
        if (val > 0) {
            boosts[inp.dataset.ability] = val;
            hasBoosts = true;
        }
    });
    data.abilityBoosts = hasBoosts ? boosts : null;

    // Traits
    const traits = [];
    document.querySelectorAll('.dnd-v1-trait-item').forEach(div => {
        const tName = /** @type {HTMLInputElement | null} */ (div.querySelector('.v1-trait-name'))?.value?.trim() || '';
        const tDesc = /** @type {HTMLTextAreaElement | null} */ (div.querySelector('.v1-trait-desc'))?.value?.trim() || '';
        if (tName) traits.push({ name: tName, description: tDesc });
    });
    data.traits = traits;

    if (id) {
        updateCustomSpecies(id, data);
        toastr.success(`Updated "${name}"`);
    } else {
        createCustomSpecies(data);
        toastr.success(`Created "${name}"`);
    }

    showSpeciesListView();
}

// ─── V1 panel visibility ─────────────────────────────────────

function applyV1PanelVisibility() {
    const mode = extensionSettings.mode || 'legacy';
    const charActive = mode === 'v1' || mode === 'v2';

    // V1/V2 share the character container
    const v1Container = document.getElementById('dnd-v1-character-container');
    if (v1Container) v1Container.style.display = charActive ? '' : 'none';

    const v1Spellbook = document.getElementById('dnd-v1-spellbook-container');
    if (v1Spellbook) v1Spellbook.style.display = charActive ? '' : 'none';

    // Legacy panels — hide when V1 or V2 is active
    const legacyChar = document.getElementById('dnd-character-container');
    if (legacyChar) legacyChar.style.display = charActive ? 'none' : '';

    const legacySpellbook = document.getElementById('dnd-spellbook-container');
    if (legacySpellbook) legacySpellbook.style.display = charActive ? 'none' : '';

    // V1/V2 has attributes on the char sheet — hide attr editor button and force-disable attr injection
    const attrBtn = document.getElementById('dnd-open-attr-editor');
    if (attrBtn) attrBtn.style.display = charActive ? 'none' : '';

    if (charActive) {
        setSendAttributesOnRoll(false);
        saveSendAttributesOnRoll(false);
    }
}

// ─── V2 mode ─────────────────────────────────────────────────

function updatePanelTitle() {
    const el = document.getElementById('dnd-panel-title');
    if (!el) return;
    const mode = extensionSettings.mode || 'legacy';
    const suffix = mode === 'v2' ? ' V2' : mode === 'v1' ? ' V1' : '';
    el.textContent = `D&D 5e Lite${suffix}`;
}

function applyV2Mode() {
    const v2 = extensionSettings.v2Enabled;
    const $compContainer = $('#dnd-v2-companion-container');
    if (v2) {
        loadV2Quests();
        loadV2Inventory();
        loadV2Companions();
        renderV2Quests();
        renderV2Inventory();
        renderCompanionCards();
        $compContainer.show();
        $('#dnd-v1-companion-container').hide();
        loadCharacterV2();
        renderV2CharacterPanel();
        initV2Spellbook();
        renderV2Spellbook();
        preloadV2Assets();
    } else {
        $compContainer.hide();
        renderQuests();
        renderInventory();
    }
}

function handleV2ChatChanged() {
    if (!extensionSettings.v2Enabled) return;

    const chatVersion = getChatDataVersion();

    if (chatVersion >= 2) {
        loadV2Quests();
        loadV2Inventory();
        renderV2Quests();
        renderV2Inventory();
    } else if (hasV1DataToMigrate()) {
        showV2MigrationModal(() => {
            executeV2Migration(characterV1);
            renderV2Quests();
            renderV2Inventory();
        });
    } else {
        loadV2Quests();
        loadV2Inventory();
        renderV2Quests();
        renderV2Inventory();
    }

    loadCharacterV2();
    renderV2CharacterPanel();
    renderV2Spellbook();
    loadV2Companions();
    renderCompanionCards();
    $('#dnd-v1-companion-container').hide();
}

function checkCrossVersionWarning() {
    const chatVersion = getChatDataVersion();
    if (!extensionSettings.v2Enabled && chatVersion >= 2) {
        toastr.warning(
            'This chat uses V2 data. Quest/inventory may not display correctly. Enable V2 mode in extension settings.',
            'D&D 5e Lite',
            { timeOut: 8000, preventDuplicates: true },
        );
    }
}

// ─── V2 revert button visibility ─────────────────────────────

function updateV2RevertButton() {
    const show = extensionSettings.v2Enabled && hasGameActionBackup();
    $('#dnd-v2-revert-btn').toggle(show);
}

// ─── V2 context-stripping regex management ──────────────────

const V2_REGEX_SCRIPT_NAME = 'D&D 5e - Strip game_actions';

function getGlobalRegexScripts() {
    const context = getContext();
    const ext = context.extension_settings || context.extensionSettings;
    if (!ext) return null;
    if (!Array.isArray(ext.regex)) ext.regex = [];
    return ext.regex;
}

function findV2RegexScript() {
    const scripts = getGlobalRegexScripts();
    if (!scripts) return null;
    return scripts.find(s => s.scriptName === V2_REGEX_SCRIPT_NAME) || null;
}

function createV2RegexScript() {
    return {
        id: crypto.randomUUID(),
        scriptName: V2_REGEX_SCRIPT_NAME,
        findRegex: '<details>\\s*<summary>game_actions</summary>[\\s\\S]*?</details>',
        replaceString: '',
        trimStrings: [],
        substituteRegex: 0,
        disabled: false,
        markdownOnly: false,
        promptOnly: true,
        runOnEdit: false,
        placement: [2],
        minDepth: null,
        maxDepth: null,
    };
}

function installV2Regex() {
    const scripts = getGlobalRegexScripts();
    if (!scripts) return false;

    const existing = scripts.findIndex(s => s.scriptName === V2_REGEX_SCRIPT_NAME);
    if (existing >= 0) scripts.splice(existing, 1);

    scripts.push(createV2RegexScript());
    saveSettingsDebounced();
    console.log('[D&D 5e V2] Context-stripping regex installed');
    return true;
}

function ensureV2Regex() {
    if (findV2RegexScript()) return;
    installV2Regex();
}

function updateV2RegexStatus() {
    const $section = $('#dnd-v2-regex-section');
    const $status = $('#dnd-v2-regex-status');

    if (!extensionSettings.v2Enabled) {
        $section.hide();
        return;
    }

    $section.show();
    const found = findV2RegexScript();
    if (found && !found.disabled) {
        $status.text('Installed').css('color', 'var(--SmartThemeQuoteColor, #4caf50)');
    } else if (found && found.disabled) {
        $status.text('Disabled').css('color', 'var(--warning-color, #ff9800)');
    } else {
        $status.text('Not Found').css('color', 'var(--error-color, #f44336)');
    }
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
    loadAutoLongRest();
    loadSpellLog();
    loadAutoBackgrounds();
    refreshHeaderFromChat();
    if (!spellTrackerDisabled) refreshSpellLog();
    evaluateAutoBackground();

    renderQuests();
    renderInventory();
    if (!spellTrackerDisabled) renderSpellLog();
    updateHeaderWidgets();
    updateDiceDisplay();
    updateDamageDisplay();
    updateModifierDisplay();
    updateStripWidgets();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

    // Spellbook
    loadSpellbook();
    ensureSpellData().then(() => renderSpellbook());

    // Character
    loadCharacter();
    ensureCharacterData().then(() => renderCharacter());

    // Character System (V1 or V2 based on mode)
    updatePanelTitle();
    applyV1PanelVisibility();
    if (extensionSettings.v1Enabled) {
        loadCharacterV1();
        renderV1CharacterPanel();
        initV1Spellbook();
        renderV1Spellbook();
        initCompanionPanel();
        renderV1CompanionPanel();
        preloadV1Assets();
        renderInventory();
    }

    // V2 Inline Game Actions + Character
    if (extensionSettings.v2Enabled) {
        loadV2Quests();
        loadV2Inventory();
        loadV2Companions();
        renderV2Quests();
        renderV2Inventory();
        renderCompanionCards();
        $('#dnd-v2-companion-container').show();
        $('#dnd-v1-companion-container').hide();
        loadCharacterV2();
        renderV2CharacterPanel();
        initV2Spellbook();
        renderV2Spellbook();
        preloadV2Assets();
    }

    // Sidekicks (after V1 so getSidekickLevel() has the correct level)
    loadSidekicks();
    migrateSidekickData();
    renderSidekickCards();

    if (sidekicks && sidekicks.length > 0) {
        fetchEquipmentItems().then(() => fetchMagicItems());
    }

    // ─── Event bindings ─────────────────────────────────

    // Power toggle
    $('#dnd-strip-power, #dnd-panel-power').on('click', togglePower);

    // Refresh buttons (both strip and expanded)
    $('#dnd-strip-reload, #dnd-refresh-btn').on('click', handleRefreshFromChat);

    // V2 revert button
    $('#dnd-v2-revert-btn').on('click', () => {
        if (revertGameActions()) {
            updateV2RevertButton();
            toastr.success('Reverted quests & inventory to pre-parse state.', 'D&D 5e Lite');
        }
    });

    // V2 Companion cards — click for details, shift+click to toggle
    $(document).on('click', '.dnd-comp-card', function (e) {
        const id = $(this).data('comp-id');
        if (!id) return;
        if (e.shiftKey) {
            toggleCompanionEnabled(id);
            renderCompanionCards();
        } else {
            renderCompanionDetail(id);
            $('#dnd-v2-comp-detail-popup').css('display', 'flex');
        }
    });

    // V2 Companion add button
    $('#dnd-v2-companion-add').on('click', (e) => {
        e.stopPropagation();
        openCompanionWizard();
    });

    // V2 Companion detail modal
    $('#dnd-v2-comp-detail-close').on('click', () => { hideTooltip(); $('#dnd-v2-comp-detail-popup').hide(); });
    $('#dnd-v2-comp-detail-edit').on('click', () => {
        const id = $('#dnd-v2-comp-detail-body').data('companionId') || $('#dnd-v2-comp-detail-body').attr('data-companion-id');
        if (id) {
            $('#dnd-v2-comp-detail-popup').hide();
            openCompanionEditModal(id);
        }
    });
    $('#dnd-v2-comp-detail-delete').on('click', () => {
        const id = $('#dnd-v2-comp-detail-body').data('companionId') || $('#dnd-v2-comp-detail-body').attr('data-companion-id');
        if (id) {
            deleteCompanion(id);
            renderCompanionCards();
            $('#dnd-v2-comp-detail-popup').hide();
        }
    });

    // V2 Companion edit modal
    $('#dnd-v2-comp-edit-close, #dnd-v2-comp-edit-cancel').on('click', () => { $('#dnd-v2-comp-edit-popup').hide(); });
    $('#dnd-v2-comp-edit-save').on('click', () => {
        saveCompanionFromEditModal();
    });

    // V2 Companion wizard modal
    $('#dnd-v2-comp-wizard-close').on('click', () => { $('#dnd-v2-comp-wizard-popup').hide(); });

    // Dice — expanded panel roll button
    $('#dnd-roll-btn').on('click', () => {
        if (extensionSettings.lastDiceRoll) {
            clearDiceRoll();
        } else {
            rollD20();
        }
        updateStripWidgets();
    });
    $('#dnd-player-minus').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        extensionSettings.playerCount = Math.max(1, (extensionSettings.playerCount ?? 1) - 1);
        saveSettings();
        updatePlayerCountLabel();
    });
    $('#dnd-player-plus').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        extensionSettings.playerCount = Math.min(4, (extensionSettings.playerCount ?? 1) + 1);
        saveSettings();
        updatePlayerCountLabel();
    });
    updatePlayerCountLabel();

    // Ally count +/- controls (clamped 0–8)
    $('#dnd-ally-minus').on('click', () => {
        extensionSettings.allyCount = Math.max(0, (extensionSettings.allyCount ?? 1) - 1);
        saveSettings();
        updateAllyCountLabel();
    });
    $('#dnd-ally-plus').on('click', () => {
        extensionSettings.allyCount = Math.min(8, (extensionSettings.allyCount ?? 1) + 1);
        saveSettings();
        updateAllyCountLabel();
    });
    updateAllyCountLabel();

    // Enemy count +/- controls (clamped 0–16)
    $('#dnd-enemy-minus').on('click', () => {
        extensionSettings.enemyCount = Math.max(0, (extensionSettings.enemyCount ?? 1) - 1);
        saveSettings();
        updateEnemyCountLabel();
    });
    $('#dnd-enemy-plus').on('click', () => {
        extensionSettings.enemyCount = Math.min(16, (extensionSettings.enemyCount ?? 1) + 1);
        saveSettings();
        updateEnemyCountLabel();
    });
    updateEnemyCountLabel();

    // Pool dice — each click adds one die to the pool
    $('.dnd-pool-dice-die-btn').on('click', function () {
        const sides = parseInt($(this).data('sides'));
        addDamageDie(sides);
        updateStripWidgets();
    });
    $('#dnd-pool-dice-chips').on('click', '.dnd-pool-dice-chip', function () {
        const index = parseInt($(this).data('index'), 10);
        if (Number.isNaN(index)) return;
        removeDamageDie(index);
        updateStripWidgets();
    });
    $('#dnd-pool-dice-clear').on('click', () => {
        clearDamageRoll();
        updateStripWidgets();
    });

    // Modifier toggles — rendered from MODIFIER_DEFS, delegated click
    renderModifierButtons();
    $('#dnd-modifier-toggles').on('click', '.dnd-mod-btn', function () {
        const modId = $(this).data('mod');
        toggleModifier(modId);
    });

    // Collapsible sections — click header to toggle, shift+click for special action
    $('#dnd-panel-content').on('click', '.dnd-collapsible-header', function (e) {
        if ($(e.target).closest('.dnd-section-action-btn, .dnd-spellbook-level-filters').length) return;
        const section = $(this).data('section');
        if (e.shiftKey) {
            if (section === 'character') { openCharacterConfigModal(); return; }
            if (section === 'spellbook') { openSpellbookImportModal(); return; }
            if (section === 'v1-spellbook' && extensionSettings.mode === 'v2') { openSpellSearchModal(); return; }
        }
        $(this).closest('.dnd-collapsible').toggleClass('dnd-collapsed');
    });

    // Quest — inline add
    $('#dnd-add-quest-btn').on('click', () => {
        if (extensionSettings.v2Enabled) {
            addV2QuestFromInput();
        } else {
            addQuestFromInput();
        }
        updateStripWidgets();
    });
    $('#dnd-add-quest-input').on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (extensionSettings.v2Enabled) {
                addV2QuestFromInput();
            } else {
                addQuestFromInput();
            }
            updateStripWidgets();
        }
    });

    // Inventory — inline add
    $('#dnd-add-inventory-btn').on('click', () => {
        if (extensionSettings.v2Enabled) {
            addV2InventoryItemFromInput();
        } else {
            addInventoryItemFromInput();
        }
    });
    $('#dnd-add-inventory-input').on('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (extensionSettings.v2Enabled) {
                addV2InventoryItemFromInput();
            } else {
                addInventoryItemFromInput();
            }
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
    $('#dnd-add-drop-conc-btn').on('click', () => {
        addDropConcFromButton();
    });
    $('#dnd-add-dispel-btn').on('click', () => {
        addDispelFromButton();
    });

    // Spell log — dedicated refresh (wipe + rebuild from chat)
    $('#dnd-spell-log-refresh').on('click', () => {
        hardRefreshSpellLogFromButton();
        toastr.success('Spell log rebuilt from chat');
    });

    // Spell tracker — per-chat disable toggle
    $('#dnd-spell-tracker-toggle').on('click', toggleSpellTracker);
    updateSpellTrackerToggleUI();

    // Spellbook clear
    $('#dnd-spellbook-clear').on('click', () => {
        clearSpellbook();
        renderSpellbook();
        hideSpellTooltip();
        toastr.info('Spellbook removed');
    });

    // Spellbook import modal
    $('#dnd-spellbook-import-close').on('click', () => $('#dnd-spellbook-import-popup').hide());
    $('#dnd-spellbook-file-input').on('change', function () {
        handleSpellbookFileRead(/** @type {HTMLInputElement} */ (this).files[0]);
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
        const text = String($('#dnd-spellbook-paste-input').val() || '').trim();
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

    // Character clear
    $('#dnd-character-clear').on('click', () => {
        clearCharacter();
        renderCharacter();
        toastr.info('Character removed');
    });

    // Character config modal
    $('#dnd-character-config-close').on('click', () => $('#dnd-character-config-popup').hide());
    $('#dnd-char-class-select').on('change', onCharClassChanged);
    $('#dnd-char-source-select').on('change', onCharSourceChanged);
    $('#dnd-character-config-save').on('click', saveCharacterFromModal);

    // V1/V2 Character panel events (routes to correct modal based on mode)
    $(document).on('click', '#dnd-v1-character-create', () => {
        if (extensionSettings.mode === 'v2') openV2ConfigModal(null);
        else openV1ConfigModal(null);
    });
    $('#dnd-v1-character-edit').on('click', (e) => {
        e.stopPropagation();
        if (extensionSettings.mode === 'v2') {
            openV2ConfigModal(characterV2?.id || null);
        } else {
            if (characterV1) openV1ConfigModal(characterV1.id);
            else openV1ConfigModal(null);
        }
    });
    $('#dnd-v1-character-levelup').on('click', (e) => {
        e.stopPropagation();
        if (extensionSettings.mode === 'v2') {
            if (characterV2 && (characterV2.level || 1) < 20) openV2ConfigModal(characterV2.id, true);
        } else {
            if (characterV1 && (characterV1.level || 1) < 20) openV1ConfigModal(characterV1.id, true);
        }
    });
    $('#dnd-v1-character-clear').on('click', (e) => {
        e.stopPropagation();
        if (extensionSettings.mode === 'v2') {
            setCharacterV2(null);
            saveCharacterV2(null);
            renderV2CharacterPanel();
            toastr.info('V2 Character removed');
        } else {
            setCharacterV1(null);
            saveCharacterV1(null);
            renderV1CharacterPanel();
            renderV1Spellbook();
            renderV1CompanionPanel();
            toastr.info('V1 Character removed');
        }
    });
    // V1/V2 Detail modal
    $(document).on('click', '#dnd-v1-character-content .dnd-v1-stat-card', () => {
        if (extensionSettings.mode === 'v2') {
            if (!characterV2) return;
            renderV2DetailModal();
            $('#dnd-v1-detail-popup').show();
        } else {
            if (!characterV1) return;
            renderV1DetailModal();
            $('#dnd-v1-detail-popup').show();
        }
    });
    $('#dnd-v1-detail-close').on('click', () => $('#dnd-v1-detail-popup').hide());
    $('#dnd-v1-detail-edit').on('click', () => {
        $('#dnd-v1-detail-popup').hide();
        if (extensionSettings.mode === 'v2') {
            openV2ConfigModal(characterV2?.id || null);
        } else {
            if (characterV1) openV1ConfigModal(characterV1.id);
        }
    });
    // V1/V2 Collapsible header shift+click to configure
    $(document).on('click', '[data-section="v1-character"]', function (e) {
        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            if (extensionSettings.mode === 'v2') {
                openV2ConfigModal(characterV2?.id || null);
            } else {
                if (characterV1) openV1ConfigModal(characterV1.id);
                else openV1ConfigModal(null);
            }
        }
    });

    // V1 Custom Species Editor
    $(document).on('click', '#dnd-v1-manage-species', () => openSpeciesEditorModal());
    $('#dnd-v1-species-editor-close, #dnd-v1-species-editor-done').on('click', () => {
        $('#dnd-v1-species-editor-popup').hide();
    });
    $('#dnd-v1-species-new').on('click', () => openSpeciesForm(null));
    $('#dnd-v1-species-form-back').on('click', () => showSpeciesListView());
    $('#dnd-v1-species-form-save').on('click', () => saveSpeciesForm());
    $('#dnd-v1-cs-add-trait').on('click', () => addSpeciesTraitRow());

    // Sidekick — add button
    $('#dnd-sidekick-add').on('click', (e) => {
        e.stopPropagation();
        openSidekickConfigModal(null);
    });

    // Sidekick cards — click to open detail, shift+click to toggle enabled
    $(document).on('click', '.dnd-sidekick-card', function (e) {
        const id = $(this).data('sk-id');
        if (!id) return;
        if (e.shiftKey) {
            toggleSidekickEnabled(id);
        } else {
            openSidekickDetailModal(id);
        }
    });

    // Sidekick detail modal
    $('#dnd-sk-detail-close').on('click', () => { hideTooltip(); $('#dnd-sidekick-detail-popup').hide(); });
    $('#dnd-sk-detail-edit').on('click', () => {
        const id = $('#dnd-sk-detail-body').attr('data-sidekick-id');
        if (id) {
            $('#dnd-sidekick-detail-popup').hide();
            openSidekickConfigModal(id);
        }
    });
    $('#dnd-sk-detail-delete').on('click', () => {
        const id = $('#dnd-sk-detail-body').attr('data-sidekick-id');
        if (id) deleteSidekick(id);
    });

    // Sidekick config modal
    $('#dnd-sk-config-close, #dnd-sk-config-cancel').on('click', () => { hideTooltip(); $('#dnd-sidekick-config-popup').hide(); });
    $('#dnd-sk-type').on('change', onSkTypeChanged);
    $('#dnd-sk-subtype').on('change', async () => {
        if ($('#dnd-sk-type').val() === 'spellcaster') {
            $('#dnd-sk-cantrip-dropdown').html('<div class="dnd-sk-dd-empty">Loading spells...</div>');
            $('#dnd-sk-spell-dropdown').html('<div class="dnd-sk-dd-empty">Loading spells...</div>');
            await preloadSpellData();
            refreshSpellDropdown(true);
            refreshSpellDropdown(false);
        }
    });
    $('#dnd-sk-creature-type-filter').on('change', onSkCreatureTypeFilter);
    $('#dnd-sk-creature-search').on('input', onSkCreatureSearch);
    $(document).on('click', '#dnd-sk-creature-dropdown .dnd-sk-dd-item', function () {
        const name = $(this).data('creature-name');
        if (name) onSkCreatureNamePicked(name);
    });
    $('#dnd-sk-creature-source').on('change', onSkCreatureSourceChanged);
    $('#dnd-sk-load-source-btn').on('click', onSkLoadExtraSource);
    $('#dnd-sk-config-save').on('click', saveSidekickFromModal);

    // Sidekick spell filter (fuzzy search in dropdown)
    let _skSpellDebounce = null;
    $('#dnd-sk-cantrip-search').on('input', () => {
        clearTimeout(_skSpellDebounce);
        _skSpellDebounce = setTimeout(() => refreshSpellDropdown(true), 200);
    });
    $('#dnd-sk-spell-search').on('input', () => {
        clearTimeout(_skSpellDebounce);
        _skSpellDebounce = setTimeout(() => refreshSpellDropdown(false), 200);
    });

    // Sidekick spell dropdown click (delegated)
    $(document).on('click', '.dnd-sk-spell-dd-item', function () {
        const name = $(this).data('spell-name');
        const isCantrip = $(this).data('is-cantrip') === true || $(this).data('is-cantrip') === 'true';
        if (name) addSpellToSidekick(name, isCantrip);
    });

    // Sidekick spell tag remove (delegated)
    $(document).on('click', '.dnd-sk-spell-remove', function (e) {
        e.stopPropagation();
        const name = $(this).data('spell');
        const $parent = $(this).closest('.dnd-sk-spell-tags');
        const isCantrip = $parent.attr('id') === 'dnd-sk-cantrip-tags';
        if (name) removeSpellFromSidekick(name, isCantrip);
    });

    // Creature action toggle (delegated)
    $(document).on('change', '#dnd-sk-actions-list input[type="checkbox"]', function () {
        const idx = parseInt($(this).data('action-idx'));
        if (!isNaN(idx) && _skTempActions[idx]) {
            _skTempActions[idx].enabled = $(this).prop('checked');
            renderActionsList();
        }
    });

    // Creature trait toggle (delegated)
    $(document).on('change', '#dnd-sk-traits-list input[type="checkbox"]', function () {
        const idx = parseInt($(this).data('trait-idx'));
        if (!isNaN(idx) && _skTempTraits[idx]) {
            _skTempTraits[idx].enabled = $(this).prop('checked');
            renderTraitsList();
        }
    });

    // Magic weapons toggle
    $('#dnd-sk-magic-check').on('change', async function () {
        if ($(this).prop('checked') && !isMagicWeaponsLoaded()) {
            $(this).parent().addClass('dnd-sk-loading');
            await fetchMagicItems();
            $(this).parent().removeClass('dnd-sk-loading');
        }
        onSkEquipSearch();
    });

    // Sidekick equipment search
    $('#dnd-sk-equip-search').on('input', onSkEquipSearch);

    // Equipment search result click (delegated)
    $(document).on('click', '.dnd-sk-equip-result', function () {
        const itemName = $(this).data('item-name');
        const itemSource = $(this).data('item-source') || '';
        if (itemName) addWeaponFromSearch(itemName, itemSource);
    });

    // Weapon remove button (delegated)
    $(document).on('click', '.dnd-sk-equip-remove', function (e) {
        e.stopPropagation();
        const idx = parseInt($(this).data('equip-idx'));
        if (!isNaN(idx)) removeWeaponByIndex(idx);
    });

    // Items & Gear
    $('#dnd-sk-item-input').on('input', onSkItemSearch);
    $('#dnd-sk-item-input').on('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addItemCustom(); }
    });
    $('#dnd-sk-item-add-btn').on('click', addItemCustom);
    $(document).on('click', '.dnd-sk-item-result', function () {
        const name = $(this).data('item-name');
        if (name) addItemFromSearch(name);
    });
    $(document).on('click', '.dnd-sk-item-remove', function (e) {
        e.stopPropagation();
        const idx = parseInt($(this).data('item-idx'));
        if (!isNaN(idx)) removeItemByIndex(idx);
    });

    // Armor search + clear + magic toggle
    $('#dnd-sk-armor-search').on('input', onSkArmorSearch);
    $('#dnd-sk-armor-clear').on('click', () => { setSelectedArmor(null); $('#dnd-sk-armor-search').val(''); $('#dnd-sk-armor-results').html(''); });
    $(document).on('click', '.dnd-sk-armor-result', function () {
        const name = $(this).data('item-name');
        if (name) {
            setSelectedArmor(name);
            $('#dnd-sk-armor-search').val('');
            $('#dnd-sk-armor-results').html('');
        }
    });
    $('#dnd-sk-magic-armor-check').on('change', async function () {
        if ($(this).prop('checked') && !isMagicWeaponsLoaded()) {
            $(this).parent().addClass('dnd-sk-loading');
            await fetchMagicItems();
            $(this).parent().removeClass('dnd-sk-loading');
        }
        onSkArmorSearch();
        updateArmorAttuneVisibility();
    });
    $('#dnd-sk-armor-attune-check').on('change', function () {
        const checked = $(this).prop('checked');
        if (checked && getTempAttunedCount() >= SIDEKICK_MAX_ATTUNEMENT) {
            $(this).prop('checked', false);
            toastr.warning(`Attunement full (${SIDEKICK_MAX_ATTUNEMENT}/${SIDEKICK_MAX_ATTUNEMENT} slots used)`);
            return;
        }
        _skTempArmorAttuned = !!checked;
        updateAttuneCounter();
    });

    // Shield search + clear + magic toggle + attune
    $('#dnd-sk-shield-search').on('input', onSkShieldSearch);
    $('#dnd-sk-shield-clear').on('click', () => { setSelectedShield(null); $('#dnd-sk-shield-search').val(''); $('#dnd-sk-shield-results').html(''); });
    $(document).on('click', '.dnd-sk-shield-result', function () {
        const name = $(this).data('item-name');
        if (name) {
            setSelectedShield(name);
            $('#dnd-sk-shield-search').val('');
            $('#dnd-sk-shield-results').html('');
        }
    });
    $('#dnd-sk-magic-shield-check').on('change', async function () {
        if ($(this).prop('checked') && !isMagicWeaponsLoaded()) {
            $(this).parent().addClass('dnd-sk-loading');
            await fetchMagicItems();
            $(this).parent().removeClass('dnd-sk-loading');
        }
        onSkShieldSearch();
        updateShieldAttuneVisibility();
    });
    $('#dnd-sk-shield-attune-check').on('change', function () {
        const checked = $(this).prop('checked');
        if (checked && getTempAttunedCount() >= SIDEKICK_MAX_ATTUNEMENT) {
            $(this).prop('checked', false);
            toastr.warning(`Attunement full (${SIDEKICK_MAX_ATTUNEMENT}/${SIDEKICK_MAX_ATTUNEMENT} slots used)`);
            return;
        }
        _skTempShieldAttuned = !!checked;
        updateAttuneCounter();
    });

    // Payment mode toggle
    $('#dnd-sk-hire-paymode').on('change', function () {
        const mode = $(this).val();
        $('#dnd-sk-hire-gold-row').toggle(mode !== 'quest' && mode !== 'free');
        $('#dnd-sk-hire-paid-row').toggle(mode === 'owed');
        $('#dnd-sk-hire-quest-row').toggle(mode === 'quest');
    });

    // Sidekick hire date "Set Current" button
    $('#dnd-sk-hire-date-now').on('click', () => {
        const date = headerInfo?.date;
        if (date) {
            $('#dnd-sk-hire-date').val(date);
        } else {
            toastr.warning('No date found in header info');
        }
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
        const v1Active = extensionSettings.v1Enabled;
        const $sendAttrLabel = $('#dnd-setting-send-attributes').closest('.dnd-toggle-label');
        if (v1Active) {
            $sendAttrLabel.hide();
        } else {
            $sendAttrLabel.show();
            $('#dnd-setting-send-attributes').prop('checked', sendAttributesOnRoll);
        }
        $('#dnd-setting-spell-inject').prop('checked', spellInjectEnabled);
        $('#dnd-setting-auto-long-rest').prop('checked', autoLongRestEnabled);
        $('#dnd-setting-noncombat-dice').prop('checked', extensionSettings.nonCombatDiceEnabled ?? false);
        $('#dnd-setting-random-events').prop('checked', extensionSettings.randomEventsEnabled ?? false);
        $('#dnd-setting-event-role').val(extensionSettings.randomEventRole || 'user');
        updateRandomEventDisplay();
        $('#dnd-setting-weather-visuals').prop('checked', extensionSettings.weatherVisuals?.enabled ?? true);
        $('#dnd-setting-weather-particles').val(extensionSettings.weatherVisuals?.particleCount ?? 200);
        $('#dnd-setting-lighting-overlay').prop('checked', extensionSettings.lightingOverlay?.enabled ?? true);
        const lIntensity = extensionSettings.lightingOverlay?.intensity ?? 1.0;
        $('#dnd-setting-lighting-intensity').val(lIntensity);
        $('#dnd-setting-lighting-intensity-val').text(lIntensity.toFixed(2));
        $('#dnd-setting-lighting-blend').val(extensionSettings.lightingOverlay?.blendMode ?? 'soft-light');
        const omniSizes = getOmniWidgetSizes();
        $('#dnd-setting-omni-two-wide').val(omniSizes.twoWide);
        $('#dnd-setting-omni-three-wide').val(omniSizes.threeWide);
        $('#dnd-setting-omni-full-wide').val(omniSizes.fullWide);
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
    $('#dnd-setting-auto-long-rest').on('change', function () {
        setAutoLongRestEnabled($(this).prop('checked'));
        saveAutoLongRest(autoLongRestEnabled);
        if (!spellTrackerDisabled) {
            hardRefreshSpellLog();
            renderSpellLog();
        }
    });
    $('#dnd-setting-noncombat-dice').on('change', function () {
        extensionSettings.nonCombatDiceEnabled = $(this).prop('checked');
        saveSettings();
        updateNonCombatDiceDisplay();
    });
    $('#dnd-setting-random-events').on('change', function () {
        setRandomEventInjectionEnabled($(this).prop('checked'));
    });
    $('#dnd-setting-event-role').on('change', function () {
        extensionSettings.randomEventRole = String($(this).val());
        saveSettings();
    });

    function saveOmniWidgetSizesFromInputs() {
        const twoWide = Math.max(1, parseInt(String($('#dnd-setting-omni-two-wide').val())) || DEFAULT_OMNI_WIDGET_SIZES.twoWide);
        let threeWide = Math.max(1, parseInt(String($('#dnd-setting-omni-three-wide').val())) || DEFAULT_OMNI_WIDGET_SIZES.threeWide);
        let fullWide = Math.max(0, parseInt(String($('#dnd-setting-omni-full-wide').val())) || 0);
        if (threeWide <= twoWide) threeWide = twoWide + 1;
        if (fullWide > 0 && fullWide <= threeWide) fullWide = threeWide + 1;
        extensionSettings.omniWidgetSizes = { twoWide, threeWide, fullWide };
        $('#dnd-setting-omni-two-wide').val(twoWide);
        $('#dnd-setting-omni-three-wide').val(threeWide);
        $('#dnd-setting-omni-full-wide').val(fullWide);
        saveSettings();
        updateHeaderWidgets();
    }
    $('#dnd-setting-omni-two-wide, #dnd-setting-omni-three-wide, #dnd-setting-omni-full-wide')
        .on('change', saveOmniWidgetSizesFromInputs);

    // Event tags: click toggles random-event injection; shift-click opens threshold modal
    $('#dnd-strip-event-tag, #dnd-panel-event-tag').on('click', function (e) {
        if (e.shiftKey) {
            openThresholdModal();
            return;
        }

        const nextEnabled = !(extensionSettings.randomEventsEnabled ?? false);
        setRandomEventInjectionEnabled(nextEnabled);
        toastr.info(`Random encounter injection ${nextEnabled ? 'enabled' : 'disabled'}`);
    });

    // Threshold modal
    $('#dnd-event-threshold-close').on('click', () => $('#dnd-event-threshold-popup').hide());
    $('#dnd-event-threshold-save').on('click', saveThresholds);
    $('#dnd-event-threshold-reset').on('click', resetThresholds);
    $('.dnd-event-tier-min, .dnd-event-tier-max').on('input', updateThresholdSummary);

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

    // Auto background switching modal
    $('#dnd-open-auto-bg').on('click', () => {
        openAutoBackgroundModal();
    });
    $('#dnd-auto-bg-close').on('click', () => {
        saveAutoBackgroundModal();
        $('#dnd-auto-bg-modal').hide();
        evaluateAutoBackground();
    });
    $('#dnd-auto-bg-modal').on('click', function (e) {
        if (e.target === this) {
            saveAutoBackgroundModal();
            $(this).hide();
            evaluateAutoBackground();
        }
    });
    $('#dnd-auto-bg-enabled').on('change', function () {
        saveAutoBackgroundModal();
    });
    $('#dnd-auto-bg-add').on('click', () => {
        addAutoBackgroundEntry();
    });
    $(document).on('click', '.dnd-auto-bg-delete', function () {
        const idx = parseInt($(this).data('idx'), 10);
        removeAutoBackgroundEntry(idx);
        saveAutoBackgroundModal();
    });
    $(document).on('change', '.dnd-auto-bg-day, .dnd-auto-bg-night, .dnd-auto-bg-name-input', function () {
        saveAutoBackgroundModal();
    });
}

function populateDebugModules() {
    const container = document.getElementById('dnd-debug-modules');
    if (!container) return;

    const summary = container.closest('details')?.querySelector('summary');
    if (summary) {
        summary.addEventListener('click', () => setTimeout(renderDebugList, 50), { once: true });
    }

    function renderDebugList() {
        const extBase = 'scripts/extensions/third-party/rpg-dnd5e-lite/';
        const collected = new Set();

        // Performance API entries (works for non-cached loads)
        for (const r of performance.getEntriesByType('resource')) {
            if (r.name.includes('rpg-dnd5e-lite') && r.name.endsWith('.js')) {
                const idx = r.name.indexOf(extBase);
                collected.add(idx >= 0 ? r.name.substring(idx + extBase.length) : r.name);
            }
        }

        // Statically known module tree (always accurate)
        const knownModules = [
            'index.js',
            'src/core/state.js', 'src/core/persistence.js',
            'src/features/sidekick.js', 'src/features/spellbook.js',
            'src/features/character.js', 'src/features/inventoryRarity.js',
            'src/features/spellScaling.js', 'src/features/featEffects.js',
            'src/features/autoBackground.js',
            'src/rendering/character.js', 'src/rendering/spellbook.js',
            'src/rendering/sidekick.js', 'src/rendering/tooltip.js',
            'src/rendering/spellbookLevelFilter.js',
            'src/generation/injector.js', 'src/generation/promptBuilder.js',
            'src/v1/core/state.js', 'src/v1/core/persistence.js', 'src/v1/core/constants.js',
            'src/v1/features/character.js', 'src/v1/features/species.js',
            'src/v1/features/background.js', 'src/v1/features/classData.js',
            'src/v1/features/spells.js', 'src/v1/features/feats.js',
            'src/v1/features/featEffects.js', 'src/v1/features/classEffects.js',
            'src/v1/features/subclassEffects.js', 'src/v1/features/levelFeatures.js',
            'src/v1/features/subclassSpells.js', 'src/v1/features/equipment.js',
            'src/v1/features/customSpecies.js',
            'src/v1/rendering/character.js', 'src/v1/rendering/detail.js',
            'src/v1/rendering/configModal.js', 'src/v1/rendering/spellbook.js',
            'src/v1/rendering/companion.js', 'src/v1/data/sources.js',
            'src/v2/core/state.js', 'src/v2/core/persistence.js',
            'src/v2/core/characterState.js', 'src/v2/core/characterPersist.js',
            'src/v2/core/migration.js', 'src/v2/core/constants.js',
            'src/v2/features/character.js', 'src/v2/features/species.js',
            'src/v2/features/background.js', 'src/v2/features/classData.js',
            'src/v2/features/spells.js', 'src/v2/features/feats.js',
            'src/v2/features/featEffects.js', 'src/v2/features/classEffects.js',
            'src/v2/features/subclassEffects.js', 'src/v2/features/levelFeatures.js',
            'src/v2/features/subclassSpells.js', 'src/v2/features/equipment.js',
            'src/v2/rendering/character.js', 'src/v2/rendering/detail.js',
            'src/v2/rendering/configModal.js', 'src/v2/rendering/spellbook.js',
            'src/v2/rendering/companion.js', 'src/v2/rendering/inventory.js',
            'src/v2/rendering/quests.js', 'src/v2/rendering/questModal.js',
            'src/v2/rendering/migration.js',
            'src/v2/generation/promptBuilder.js', 'src/v2/generation/characterPrompt.js',
            'src/v2/tools/inlineParser.js', 'src/v2/tools/inventoryTool.js',
            'src/v2/tools/questTool.js', 'src/v2/data/sources.js',
        ];
        for (const m of knownModules) collected.add(m);

        const sorted = [...collected].sort();
        container.innerHTML = `<div style="margin-bottom:4px;color:rgba(255,255,255,0.4);">${sorted.length} modules loaded</div>`
            + sorted.map(p => `<div>${p}</div>`).join('');
    }
}

function destroyUI() {
    clearExtensionPrompts();
    destroyWeatherVisuals();
    hideSpellTooltip();
    $('#dnd-panel').remove();
    $('#dnd-mobile-toggle').remove();
    $('#dnd-attr-editor-popup').remove();
    $('#dnd-settings-popup').remove();
    $('#dnd-auto-bg-modal').remove();
    $('#dnd-spellbook-import-popup').remove();
    $('#dnd-character-config-popup').remove();
    $('#dnd-sidekick-detail-popup').remove();
    $('#dnd-sidekick-config-popup').remove();
}

// ─── Entry point ────────────────────────────────────────────

jQuery(async () => {
    loadSettings();
    migrateSettingsToMode();

    // Settings panel in Extensions tab
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');
    $('#extensions_settings2').append(settingsHtml);

    // Debug: list loaded modules
    populateDebugModules();

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

    // Mode selector handler (replaces V1/V2 toggle checkboxes)
    $(`input[name="dnd-mode"][value="${extensionSettings.mode}"]`).prop('checked', true);
    $('input[name="dnd-mode"]').on('change', function () {
        const newMode = /** @type {string} */ ($(this).val());
        extensionSettings.mode = newMode;
        extensionSettings.v1Enabled = newMode === 'v1';
        extensionSettings.v2Enabled = newMode === 'v2';
        saveSettings();

        updatePanelTitle();
        applyV1PanelVisibility();
        if (extensionSettings.v1Enabled) {
            loadCharacterV1();
            renderV1CharacterPanel();
            initV1Spellbook();
            renderV1Spellbook();
            initCompanionPanel();
            renderV1CompanionPanel();
            preloadV1Assets();
        }

        applyV2Mode();
        if (extensionSettings.v2Enabled) ensureV2Regex();
        updateV2RegexStatus();
    });

    // Milestone XP toggle
    $('#dnd-milestone-xp').prop('checked', extensionSettings.milestoneXP).on('change', function () {
        extensionSettings.milestoneXP = $(this).prop('checked');
        saveSettings();
    });

    // V2 regex management UI
    $('#dnd-v2-regex-reinstall').on('click', function () {
        installV2Regex();
        updateV2RegexStatus();
        toastr.success('Context-stripping regex reinstalled.', 'D&D 5e Lite');
    });
    $('#dnd-v2-regex-manual-toggle').on('click', function () {
        $('#dnd-v2-regex-manual').toggle();
    });
    if (extensionSettings.v2Enabled) {
        ensureV2Regex();
    }
    updateV2RegexStatus();

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
