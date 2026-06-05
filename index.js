/**
 * D&D 5e Lite - Main Entry Point
 * Dice roller + Quest injector + Header info widgets for SillyTavern
 */

import { getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';
import { extensionName, extensionSettings, chatAttributes, chatAttributeSchema, defaultAttributeSchema, buildDefaultAttributes, spellTrackerDisabled, setSpellTrackerDisabled, sendAttributesOnRoll, setSendAttributesOnRoll, spellInjectEnabled, setSpellInjectEnabled, character, sidekicks, headerInfo } from './src/core/state.js';
import { saveSettings, loadSettings, loadQuests, loadInventory, loadSpellLog, saveAttributes, loadAttributes, saveSpellTrackerDisabled, loadSpellTrackerDisabled, saveSendAttributesOnRoll, loadSendAttributesOnRoll, saveSpellInjectEnabled, loadSpellInjectEnabled, loadSpellbook, loadCharacter, saveSidekicks, loadSidekicks } from './src/core/persistence.js';
import { importSpellbook, clearSpellbook, ensureSpellData } from './src/features/spellbook.js';
import { renderSpellbook, hideSpellTooltip } from './src/rendering/spellbook.js';
import { fetchClassIndex, fetchClassData, listClasses, getSubclasses, saveCharacterConfig, clearCharacter, ensureCharacterData } from './src/features/character.js';
import { renderCharacter } from './src/rendering/character.js';
import { renderSidekickCards, renderSidekickDetail } from './src/rendering/sidekick.js';
import { SIDEKICK_TYPES, ASI_LEVELS, ALL_SKILLS, SKILL_LABELS, CANTRIP_PROGRESSION, SPELLS_KNOWN_PROGRESSION, fetchBestiaryIndex, fetchBestiarySource, searchCreatures, getCreatureStats, fetchWeaponItems, enrichWeaponFromItems, parseCreatureActions, createSidekickFromCreature, getSidekickLevel, getMaxSpellLevel, searchSpellsForSidekick } from './src/features/sidekick.js';
import { onGenerationStarted, clearExtensionPrompts } from './src/generation/injector.js';
import { renderQuests, addQuestFromInput } from './src/rendering/quests.js';
import { renderInventory, addInventoryItemFromInput } from './src/rendering/inventory.js';
import { renderSpellLog, addSpellFromInput, addRestFromButton, addShortRestFromButton, addDispelFromButton, hardRefreshSpellLogFromButton } from './src/rendering/spellLog.js';
import { refreshSpellLog } from './src/features/spellTracker.js';
import { rollD20, updateDiceDisplay, clearDiceRoll, addDamageDie, updateDamageDisplay, clearDamageRoll, toggleModifier, updateModifierDisplay, clearModifiers, updateAllyCountLabel, renderModifierButtons } from './src/features/dice.js';
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
        updateModifierDisplay();
        updateSpellTrackerToggleUI();
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

let _skEditId = null;
let _skTempCreature = null;
let _skTempWeapons = [];
let _skTempSpecial = [];

function toggleSidekickEnabled(id) {
    const sk = sidekicks.find(s => s.id === id);
    if (!sk) return;
    sk.enabled = !sk.enabled;
    saveSidekicks(sidekicks);
    renderSidekickCards();
}

function openSidekickDetailModal(id) {
    renderSidekickDetail(id);
    $('#dnd-sidekick-detail-popup').css('display', 'flex');
    $('#dnd-sidekick-detail-popup .dnd-modal-body').attr('data-sidekick-id', id);
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
    _skTempWeapons = [];
    _skTempSpecial = [];

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
    $('#dnd-sk-creature-select').hide().html('');
    $('#dnd-sk-creature-preview').hide().html('');
    $('#dnd-sk-prof-section').hide();
    $('#dnd-sk-asi-section').hide();
    $('#dnd-sk-weapons-section').hide();
    $('#dnd-sk-spells-section').hide();
    $('#dnd-sk-hire-gold').val(0);
    $('#dnd-sk-hire-date').val('');

    const index = await fetchBestiaryIndex();
    const $srcSelect = $('#dnd-sk-creature-source');
    $srcSelect.html('<option value="">-- Select source --</option>');
    if (index) {
        const defaultSources = ['MM', 'XMM'];
        for (const key of defaultSources) {
            if (index[key]) $srcSelect.append(`<option value="${key}">${key}</option>`);
        }
        for (const key of Object.keys(index).sort()) {
            if (!defaultSources.includes(key)) {
                $srcSelect.append(`<option value="${key}">${key}</option>`);
            }
        }
    }

    await fetchWeaponItems();

    if (editId) {
        const sk = sidekicks.find(s => s.id === editId);
        if (sk) {
            $('#dnd-sk-name').val(sk.name || '');
            $('#dnd-sk-race').val(sk.race || '');
            $('#dnd-sk-type').val(sk.type || '');
            onSkTypeChanged();
            if (sk.subtype) $('#dnd-sk-subtype').val(sk.subtype);
            $('#dnd-sk-hire-gold').val(sk.hireGoldPerDay || 0);
            $('#dnd-sk-hire-date').val(sk.hireDate || '');

            if (sk.creatureSource) {
                $srcSelect.val(sk.creatureSource);
                await onSkCreatureSourceChanged();
                const creature = getCreatureStats(sk.creatureName, sk.creatureSource);
                if (creature) {
                    _skTempCreature = creature;
                    _skTempWeapons = sk.weapons || [];
                    _skTempSpecial = sk.specialActions || [];
                    showCreaturePreview(creature);
                    showWeaponsSection();
                }
            }

            populateProfSection(sk.type, sk.saveProficiency, sk.skillProficiencies, sk.skillExpertise);
            populateAsiSection(sk.type, sk.asiChoices);
            if (sk.type === 'spellcaster') {
                showSpellsSection(sk);
            }
        }
    }

    $popup.css('display', 'flex');
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
        populateProfSection(type, null, [], []);
        populateAsiSection(type, {});
    } else {
        $('#dnd-sk-prof-section').hide();
        $('#dnd-sk-asi-section').hide();
    }

    if (type === 'spellcaster') {
        showSpellsSection(null);
    } else {
        $('#dnd-sk-spells-section').hide();
    }
}

async function onSkCreatureSourceChanged() {
    const sourceKey = /** @type {string} */ ($('#dnd-sk-creature-source').val());
    if (!sourceKey) return;
    await fetchBestiarySource(sourceKey);
}

let _skSearchDebounce = null;
function onSkCreatureSearch() {
    clearTimeout(_skSearchDebounce);
    _skSearchDebounce = setTimeout(() => {
        const query = /** @type {string} */ ($('#dnd-sk-creature-search').val());
        const sourceKey = /** @type {string} */ ($('#dnd-sk-creature-source').val());
        if (!query || query.length < 2 || !sourceKey) {
            $('#dnd-sk-creature-select').hide().html('');
            return;
        }
        const results = searchCreatures(query, [sourceKey]);
        const $select = $('#dnd-sk-creature-select');
        $select.html('<option value="">-- Select --</option>');
        for (const r of results) {
            $select.append(`<option value="${r.name}|${r.source}">${r.name} (CR ${r.cr}, ${r.type})</option>`);
        }
        $select.show();
    }, 250);
}

function onSkCreatureSelected() {
    const val = /** @type {string} */ ($('#dnd-sk-creature-select').val());
    if (!val) return;
    const [name, source] = val.split('|');
    const creature = getCreatureStats(name, source);
    if (!creature) return;
    _skTempCreature = creature;
    const { weapons, specialActions } = parseCreatureActions(creature);
    for (const w of weapons) enrichWeaponFromItems(w);
    _skTempWeapons = weapons;
    _skTempSpecial = specialActions;
    showCreaturePreview(creature);
    showWeaponsSection();
}

function showCreaturePreview(creature) {
    const hp = creature.hp?.average ?? '?';
    const formula = creature.hp?.formula || '?';
    const ac = typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? '?';
    const abilities = ['str','dex','con','int','wis','cha']
        .map(a => `${a.toUpperCase()} ${creature[a] ?? 10}`)
        .join(' | ');

    $('#dnd-sk-creature-preview')
        .html(`<div class="dnd-sk-preview-line"><strong>${creature.name}</strong> (${creature.source})</div>
               <div class="dnd-sk-preview-line">HP ${hp} (${formula}) | AC ${ac} | Speed ${creature.speed?.walk ?? 30}ft</div>
               <div class="dnd-sk-preview-line">${abilities}</div>`)
        .show();
}

function showWeaponsSection() {
    const $list = $('#dnd-sk-weapons-list');
    if (_skTempWeapons.length === 0 && _skTempSpecial.length === 0) {
        $('#dnd-sk-weapons-section').hide();
        return;
    }
    let html = '';
    for (const w of _skTempWeapons) {
        let desc = `${w.damageDice} ${w.damageType}`;
        if (w.versatileDice) desc += `, versatile ${w.versatileDice}`;
        if (w.range) desc += `, range ${w.range}`;
        const props = (w.properties || []).join(', ');
        html += `<div class="dnd-sk-weapon-item">${w.name} &mdash; ${desc}${props ? ` [${props}]` : ''}</div>`;
    }
    for (const a of _skTempSpecial) {
        html += `<div class="dnd-sk-weapon-item"><em>${a.name}</em></div>`;
    }
    $list.html(html);
    $('#dnd-sk-weapons-section').show();
}

function populateProfSection(type, savedSave, savedSkills, savedExpertise) {
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
    if (type === 'expert' && level >= 3) {
        const $expChecks = $('#dnd-sk-expertise-checks');
        let expHtml = '';
        const profSkills = savedSkills || [];
        for (const sk of profSkills) {
            const checked = (savedExpertise || []).includes(sk) ? ' checked' : '';
            expHtml += `<label class="dnd-sk-check"><input type="checkbox" data-expertise="${sk}"${checked} /> ${SKILL_LABELS[sk] || sk}</label>`;
        }
        $expChecks.html(expHtml).show();
        $('#dnd-sk-expertise-row').show();
    } else {
        $('#dnd-sk-expertise-row').hide();
        $('#dnd-sk-expertise-checks').hide().html('');
    }

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
            $('#dnd-sk-expertise-row').show();
        }
    });

    $('#dnd-sk-prof-section').show();
}

function populateAsiSection(type, savedChoices) {
    const asiLevels = ASI_LEVELS[type];
    if (!asiLevels) { $('#dnd-sk-asi-section').hide(); return; }

    const level = getSidekickLevel();
    const applicable = asiLevels.filter(l => l <= level);
    if (applicable.length === 0) { $('#dnd-sk-asi-section').hide(); return; }

    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const optionsHtml = abilities.map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join('');

    const $rows = $('#dnd-sk-asi-rows');
    let html = '';
    for (const asiLvl of applicable) {
        const choice = (savedChoices || {})[asiLvl] || ['str', 'str'];
        html += `<div class="dnd-sk-asi-row" data-asi-level="${asiLvl}">
            <span class="dnd-sk-asi-badge">Lv ${asiLvl}</span>
            <select class="dnd-sk-asi-select" data-asi-idx="0">${optionsHtml}</select>
            <select class="dnd-sk-asi-select" data-asi-idx="1">${optionsHtml}</select>
        </div>`;
    }
    $rows.html(html);

    for (const asiLvl of applicable) {
        const choice = (savedChoices || {})[asiLvl] || ['str', 'str'];
        const $row = $rows.find(`[data-asi-level="${asiLvl}"]`);
        $row.find('[data-asi-idx="0"]').val(choice[0] || 'str');
        $row.find('[data-asi-idx="1"]').val(choice[1] || 'str');
    }

    $('#dnd-sk-asi-section').show();
}

function showSpellsSection(existingSk) {
    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const maxCantrips = CANTRIP_PROGRESSION[idx] || 2;
    const maxSpells = SPELLS_KNOWN_PROGRESSION[idx] || 1;

    const cantrips = existingSk?.knownCantrips || [];
    const spells = existingSk?.knownSpells || [];

    $('#dnd-sk-cantrip-count').text(`Cantrips (${cantrips.length}/${maxCantrips}):`);
    $('#dnd-sk-spell-count').text(`Spells (${spells.length}/${maxSpells}):`);

    renderSpellTags('#dnd-sk-cantrip-tags', cantrips);
    renderSpellTags('#dnd-sk-spell-tags', spells);

    $('#dnd-sk-cantrip-results').html('');
    $('#dnd-sk-spell-results').html('');
    $('#dnd-sk-cantrip-search').val('');
    $('#dnd-sk-spell-search').val('');

    $('#dnd-sk-spells-section').show();
}

function renderSpellTags(selector, spells) {
    const $el = $(selector);
    if (!spells || spells.length === 0) {
        $el.html('<span class="dnd-sk-no-spells">None selected</span>');
        return;
    }
    const tags = spells.map(name =>
        `<span class="dnd-sk-spell-tag">${$('<span>').text(name).html()} <button class="dnd-sk-spell-remove" data-spell="${$('<span>').text(name).html()}">&times;</button></span>`
    );
    $el.html(tags.join(''));
}

let _skSpellDebounce = null;
async function onSkSpellSearch(isCantrip) {
    clearTimeout(_skSpellDebounce);
    _skSpellDebounce = setTimeout(async () => {
        const inputId = isCantrip ? '#dnd-sk-cantrip-search' : '#dnd-sk-spell-search';
        const resultsId = isCantrip ? '#dnd-sk-cantrip-results' : '#dnd-sk-spell-results';
        const query = /** @type {string} */ ($(inputId).val());
        if (!query || query.length < 2) { $(resultsId).html(''); return; }

        const subtype = /** @type {string} */ ($('#dnd-sk-subtype').val());
        const subInfo = SIDEKICK_TYPES.spellcaster.subtypes.find(s => s.key === subtype);
        if (!subInfo) { $(resultsId).html('<em>Select a subtype first</em>'); return; }

        const level = getSidekickLevel();
        const maxLevel = getMaxSpellLevel(level);
        const results = await searchSpellsForSidekick(query, subInfo.list, maxLevel, isCantrip);

        const $results = $(resultsId);
        if (results.length === 0) {
            $results.html('<em>No results</em>');
            return;
        }
        const items = results.map(s => {
            const lvl = s.level === 0 ? 'cantrip' : `Lv ${s.level}`;
            return `<div class="dnd-sk-spell-result" data-spell-name="${$('<span>').text(s.name).html()}" data-is-cantrip="${isCantrip}">${s.name} (${lvl})</div>`;
        });
        $results.html(items.join(''));
    }, 300);
}

function addSpellToSidekick(name, isCantrip) {
    const tagsId = isCantrip ? '#dnd-sk-cantrip-tags' : '#dnd-sk-spell-tags';
    const countId = isCantrip ? '#dnd-sk-cantrip-count' : '#dnd-sk-spell-count';

    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const max = isCantrip ? (CANTRIP_PROGRESSION[idx] || 2) : (SPELLS_KNOWN_PROGRESSION[idx] || 1);

    const $tags = $(tagsId);
    const existing = [];
    $tags.find('.dnd-sk-spell-tag').each(function () {
        existing.push($(this).text().replace('×', '').trim());
    });

    if (existing.includes(name)) return;
    if (existing.length >= max) {
        toastr.warning(`Maximum ${max} ${isCantrip ? 'cantrips' : 'spells'} allowed at this level`);
        return;
    }

    existing.push(name);
    renderSpellTags(tagsId, existing);
    $(countId).text(`${isCantrip ? 'Cantrips' : 'Spells'} (${existing.length}/${max}):`);
}

function removeSpellFromSidekick(name, isCantrip) {
    const tagsId = isCantrip ? '#dnd-sk-cantrip-tags' : '#dnd-sk-spell-tags';
    const countId = isCantrip ? '#dnd-sk-cantrip-count' : '#dnd-sk-spell-count';

    const level = getSidekickLevel();
    const idx = Math.min(level, 20) - 1;
    const max = isCantrip ? (CANTRIP_PROGRESSION[idx] || 2) : (SPELLS_KNOWN_PROGRESSION[idx] || 1);

    const existing = [];
    $(tagsId).find('.dnd-sk-spell-tag').each(function () {
        existing.push($(this).text().replace('×', '').trim());
    });
    const filtered = existing.filter(s => s !== name);
    renderSpellTags(tagsId, filtered);
    $(countId).text(`${isCantrip ? 'Cantrips' : 'Spells'} (${filtered.length}/${max}):`);
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

    const asiChoices = {};
    $('#dnd-sk-asi-rows .dnd-sk-asi-row').each(function () {
        const lvl = parseInt($(this).data('asi-level'));
        const a1 = $(this).find('[data-asi-idx="0"]').val();
        const a2 = $(this).find('[data-asi-idx="1"]').val();
        asiChoices[lvl] = [a1, a2];
    });

    const knownCantrips = [];
    $('#dnd-sk-cantrip-tags .dnd-sk-spell-tag').each(function () {
        knownCantrips.push($(this).text().replace('×', '').trim());
    });
    const knownSpells = [];
    $('#dnd-sk-spell-tags .dnd-sk-spell-tag').each(function () {
        knownSpells.push($(this).text().replace('×', '').trim());
    });

    const hireGoldPerDay = parseInt($('#dnd-sk-hire-gold').val()) || 0;
    const hireDate = /** @type {string} */ ($('#dnd-sk-hire-date').val()).trim() || null;

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
        sk.asiChoices = asiChoices;
        sk.knownCantrips = knownCantrips;
        sk.knownSpells = knownSpells;
        sk.hireGoldPerDay = hireGoldPerDay;
        sk.hireDate = hireDate;

        if (_skTempCreature && _skTempCreature.name !== sk.creatureName) {
            Object.assign(sk, buildCreatureFields(_skTempCreature));
            sk.weapons = _skTempWeapons;
            sk.specialActions = _skTempSpecial;
        }
    } else {
        if (!_skTempCreature) { $error.text('Select a base creature.').show(); return; }
        const newSk = createSidekickFromCreature(_skTempCreature, {
            name, race, type, subtype, saveProficiency,
            skillProficiencies, skillExpertise, hireGoldPerDay, hireDate,
        });
        newSk.asiChoices = asiChoices;
        newSk.knownCantrips = knownCantrips;
        newSk.knownSpells = knownSpells;
        newSk.weapons = _skTempWeapons;
        newSk.specialActions = _skTempSpecial;
        sidekicks.push(newSk);
    }

    saveSidekicks(sidekicks);
    renderSidekickCards();
    $('#dnd-sidekick-config-popup').hide();
    $('#dnd-sidekick-container').removeClass('dnd-collapsed');
    toastr.success(`Sidekick "${name}" ${editId ? 'updated' : 'added'}`);
}

function buildCreatureFields(creature) {
    const hd = (creature.hp?.formula || '').match(/(\d+)d(\d+)/);
    return {
        creatureName: creature.name,
        creatureSource: creature.source,
        baseHp: creature.hp || { average: 10, formula: '2d8' },
        baseAc: typeof creature.ac?.[0] === 'number' ? creature.ac[0] : creature.ac?.[0]?.ac ?? 10,
        baseSpeed: creature.speed?.walk ?? 30,
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
    };
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
    updateModifierDisplay();

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
    updateModifierDisplay();
    updatePowerButtonState();
    updateSpellTrackerToggleUI();

    ensureSpellData().then(() => renderSpellbook());

    loadCharacter();
    ensureCharacterData().then(() => renderCharacter());

    loadSidekicks();
    renderSidekickCards();
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

    // Sidekicks
    loadSidekicks();
    renderSidekickCards();

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

    // Ally count +/- controls (clamped 0–5)
    $('#dnd-ally-minus').on('click', () => {
        extensionSettings.allyCount = Math.max(0, (extensionSettings.allyCount ?? 1) - 1);
        saveSettings();
        updateAllyCountLabel();
    });
    $('#dnd-ally-plus').on('click', () => {
        extensionSettings.allyCount = Math.min(5, (extensionSettings.allyCount ?? 1) + 1);
        saveSettings();
        updateAllyCountLabel();
    });
    updateAllyCountLabel();

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

    // Modifier toggles — rendered from MODIFIER_DEFS, delegated click
    renderModifierButtons();
    $('#dnd-modifier-toggles').on('click', '.dnd-mod-btn', function () {
        const modId = $(this).data('mod');
        toggleModifier(modId);
    });

    // Collapsible sections — click header to toggle, shift+click for special action
    $('#dnd-panel-content').on('click', '.dnd-collapsible-header', function (e) {
        if ($(e.target).closest('.dnd-section-action-btn').length) return;
        const section = $(this).data('section');
        if (e.shiftKey) {
            if (section === 'character') { openCharacterConfigModal(); return; }
            if (section === 'spellbook') { openSpellbookImportModal(); return; }
        }
        $(this).closest('.dnd-collapsible').toggleClass('dnd-collapsed');
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

    // Sidekick — add button
    $('#dnd-sidekick-add').on('click', (e) => {
        e.stopPropagation();
        openSidekickConfigModal(null);
    });

    // Sidekick cards — click to toggle, shift+click for detail
    $(document).on('click', '.dnd-sidekick-card', function (e) {
        const id = $(this).data('sk-id');
        if (!id) return;
        if (e.shiftKey) {
            openSidekickDetailModal(id);
        } else {
            toggleSidekickEnabled(id);
        }
    });

    // Sidekick detail modal
    $('#dnd-sk-detail-close').on('click', () => $('#dnd-sidekick-detail-popup').hide());
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
    $('#dnd-sk-config-close, #dnd-sk-config-cancel').on('click', () => $('#dnd-sidekick-config-popup').hide());
    $('#dnd-sk-type').on('change', onSkTypeChanged);
    $('#dnd-sk-creature-source').on('change', onSkCreatureSourceChanged);
    $('#dnd-sk-creature-search').on('input', onSkCreatureSearch);
    $('#dnd-sk-creature-select').on('change', onSkCreatureSelected);
    $('#dnd-sk-config-save').on('click', saveSidekickFromModal);

    // Sidekick spell search
    $('#dnd-sk-cantrip-search').on('input', () => onSkSpellSearch(true));
    $('#dnd-sk-spell-search').on('input', () => onSkSpellSearch(false));

    // Sidekick spell result click (delegated)
    $(document).on('click', '.dnd-sk-spell-result', function () {
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
    $('#dnd-sidekick-detail-popup').remove();
    $('#dnd-sidekick-config-popup').remove();
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
