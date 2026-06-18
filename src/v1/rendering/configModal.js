/**
 * V1 Character System - Config Modal (Multi-step Wizard)
 * Handles the character creation/edit wizard UI logic.
 */

import { characterV1, setCharacterV1 } from '../core/state.js';
import { saveCharacterV1 } from '../core/persistence.js';
import { createCharacter, computeCharacterStats } from '../features/character.js';
import { getAvailableSpecies } from '../features/species.js';
import { getAvailableBackgrounds } from '../features/background.js';
import { listAvailableClasses, getClassData } from '../features/classData.js';
import { getClassSpells, getClassCantrips, preloadSpellData, lookupSpell } from '../features/spells.js';
import { getAvailableArmor, getAvailableWeapons, computeAC, searchEquipment } from '../features/equipment.js';
import { getFeatsForLevel, findFeat } from '../features/feats.js';
import {
    ABILITY_KEYS, ABILITY_LABELS, STANDARD_ARRAY, POINT_BUY_COSTS, POINT_BUY_TOTAL,
    getModifier, ASI_LEVELS, CLASS_SKILL_OPTIONS, CLASS_SKILL_COUNT,
    SKILL_LABELS, CREATURE_TYPES, getSpellSlots, CANTRIPS_KNOWN, SPELLS_KNOWN,
    PREPARED_CASTERS, getPreparedCount, SPELLCASTING_ABILITY, CASTER_TYPE,
    SPELLCASTING_SUBCLASSES, SUBCLASS_EXTRA_SPELL_LISTS,
} from '../core/constants.js';
import { getLevelFeatures } from '../features/levelFeatures.js';
import { renderV1CharacterPanel } from './character.js';
import { renderV1Spellbook } from './spellbook.js';

const STEPS = ['identity', 'species', 'background', 'class', 'abilities', 'asi', 'proficiencies', 'equipment', 'spells'];
let currentStep = 0;

// Wizard state (accumulated across steps before final save)
let wizState = {};
let classDataCache = null;
let speciesList = [];
let backgroundList = [];
let classList = [];

/**
 * Open the character config modal for creating or editing.
 * @param {string|null} editId - If set, load existing character for editing
 */
export async function openV1ConfigModal(editId) {
    const popup = document.getElementById('dnd-v1-config-popup');
    if (!popup) return;

    currentStep = 0;
    wizState = {};
    classDataCache = null;

    if (editId && characterV1 && characterV1.id === editId) {
        wizState = { ...characterV1 };
        // Restore featData from asiChoices.featConfig for editing
        if (!wizState.featData) wizState.featData = {};
        for (const choice of Object.values(wizState.asiChoices || {})) {
            if (choice?.type === 'feat' && choice.feat && choice.featConfig) {
                wizState.featData[choice.feat] = { ...choice.featConfig };
            }
        }
        document.getElementById('dnd-v1-config-id').value = editId;
        document.getElementById('dnd-v1-config-title').textContent = 'Edit Character';
    } else {
        document.getElementById('dnd-v1-config-id').value = '';
        document.getElementById('dnd-v1-config-title').textContent = 'Create Character';
    }

    popup.style.display = 'flex';

    // Preload data
    [speciesList, backgroundList, classList] = await Promise.all([
        getAvailableSpecies(),
        getAvailableBackgrounds(),
        listAvailableClasses(),
        preloadSpellData(),
    ]);

    showStep(0);
    bindWizardEvents();
}

/**
 * Close the config modal.
 */
export function closeV1ConfigModal() {
    const popup = document.getElementById('dnd-v1-config-popup');
    if (popup) popup.style.display = 'none';
}

/**
 * Show a specific step, hide others.
 */
function showStep(idx) {
    currentStep = idx;
    const panels = document.querySelectorAll('.dnd-v1-step-panel');
    panels.forEach((p, i) => {
        p.style.display = STEPS[i] === STEPS[idx] ? '' : 'none';
    });

    // Update step buttons
    document.querySelectorAll('.dnd-v1-step-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
        btn.classList.toggle('completed', i < idx);
    });

    // Show/hide prev/next/save
    const prevBtn = document.getElementById('dnd-v1-config-prev');
    const nextBtn = document.getElementById('dnd-v1-config-next');
    const saveBtn = document.getElementById('dnd-v1-config-save');

    if (prevBtn) prevBtn.style.display = idx > 0 ? '' : 'none';
    if (nextBtn) nextBtn.style.display = idx < STEPS.length - 1 ? '' : 'none';
    if (saveBtn) saveBtn.style.display = idx === STEPS.length - 1 ? '' : 'none';

    populateStep(STEPS[idx]);
    updateStatsPreview();
}

/**
 * Populate a step's UI with current wizard state and available data.
 */
function populateStep(step) {
    switch (step) {
        case 'identity': populateIdentity(); break;
        case 'species': populateSpecies(); break;
        case 'background': populateBackground(); break;
        case 'class': populateClass(); break;
        case 'abilities': populateAbilities(); break;
        case 'asi': populateASI(); break;
        case 'proficiencies': populateProficiencies(); break;
        case 'equipment': populateEquipment(); break;
        case 'spells': populateSpells(); break;
    }
}

function populateIdentity() {
    const nameInput = document.getElementById('dnd-v1-name');
    if (nameInput) nameInput.value = wizState.name || '';
}

async function populateSpecies() {
    // Re-fetch species each time to pick up newly created custom species
    speciesList = await getAvailableSpecies();

    const select = document.getElementById('dnd-v1-species');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Species --</option>';
    for (const sp of speciesList) {
        const opt = document.createElement('option');
        opt.value = `${sp.name}|${sp.source}`;
        opt.textContent = `${sp.name}${sp.source === 'CUSTOM' ? ' (Custom)' : ''}`;
        if (wizState.speciesName === sp.name && wizState.speciesSource === sp.source) {
            opt.selected = true;
        }
        select.appendChild(opt);
    }
    updateSpeciesPreview();
}

function updateSpeciesPreview() {
    const select = document.getElementById('dnd-v1-species');
    const preview = document.getElementById('dnd-v1-species-preview');
    if (!select || !preview) return;

    const val = select.value;
    if (!val) { preview.style.display = 'none'; return; }

    const [name, source] = val.split('|');
    const sp = speciesList.find(s => s.name === name && s.source === source);
    if (!sp) { preview.style.display = 'none'; return; }

    const parts = [`<b>Size:</b> ${sp.size}`, `<b>Speed:</b> ${sp.speed}ft`];
    if (sp.darkvision) parts.push(`<b>Darkvision:</b> ${sp.darkvision}ft`);
    if (sp.resistances?.length) parts.push(`<b>Resist:</b> ${sp.resistances.join(', ')}`);
    if (sp.languages?.length) parts.push(`<b>Languages:</b> ${sp.languages.join(', ')}`);
    if (sp.traits?.length) {
        parts.push('<b>Traits:</b>');
        for (const t of sp.traits) {
            parts.push(`• ${t.name}: ${t.description.substring(0, 100)}${t.description.length > 100 ? '...' : ''}`);
        }
    }

    preview.innerHTML = parts.join('<br/>');
    preview.style.display = '';
}

function populateBackground() {
    const select = document.getElementById('dnd-v1-background');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Background --</option>';
    for (const bg of backgroundList) {
        const opt = document.createElement('option');
        opt.value = bg.name;
        opt.textContent = bg.name;
        if (wizState.backgroundName === bg.name) opt.selected = true;
        select.appendChild(opt);
    }
    updateBackgroundPreview();
}

function updateBackgroundPreview() {
    const select = document.getElementById('dnd-v1-background');
    const preview = document.getElementById('dnd-v1-background-preview');
    if (!select || !preview) return;

    const bg = backgroundList.find(b => b.name === select.value);
    if (!bg) {
        preview.style.display = 'none';
        const boostSec = document.getElementById('dnd-v1-bg-ability-boosts');
        if (boostSec) boostSec.style.display = 'none';
        const featCfg = document.getElementById('dnd-v1-origin-feat-config');
        if (featCfg) featCfg.style.display = 'none';
        return;
    }

    const parts = [];
    if (bg.skills?.length) parts.push(`<b>Skills:</b> ${bg.skills.map(s => SKILL_LABELS[s] || s).join(', ')}`);
    if (bg.tools?.length) parts.push(`<b>Tools:</b> ${bg.tools.join(', ')}`);
    if (bg.originFeat) parts.push(`<b>Origin Feat:</b> ${bg.originFeat}`);

    const boostOpts = bg.abilityBoostOptions;
    if (boostOpts?.from?.length) {
        const labels = boostOpts.from.map(a => ABILITY_LABELS[a]).join('/');
        parts.push(`<b>Ability Boosts:</b> Choose from ${labels}: +2/+1 or +1/+1/+1`);
    }

    preview.innerHTML = parts.join('<br/>');
    preview.style.display = '';

    wizState.originFeat = bg.originFeat || '';
    wizState.backgroundSkills = bg.skills || [];
    wizState.backgroundTools = bg.tools || [];

    buildBoostControls(bg);
    buildOriginFeatConfig(bg);
}

function buildBoostControls(bg) {
    const container = document.getElementById('dnd-v1-bg-boost-controls');
    const section = document.getElementById('dnd-v1-bg-ability-boosts');
    if (!container || !section) return;

    section.style.display = '';
    container.innerHTML = '';

    const boostOpts = bg.abilityBoostOptions;
    const allowedAbilities = boostOpts?.from || ABILITY_KEYS;
    const existing = wizState.backgroundAbilityBoosts || {};

    // Boost mode selector
    const modeDiv = document.createElement('div');
    modeDiv.className = 'dnd-setting-row';
    const modeSelect = document.createElement('select');
    modeSelect.id = 'dnd-v1-bg-boost-mode';
    modeSelect.innerHTML = `
        <option value="twoone" ${wizState.boostMode !== 'threeone' ? 'selected' : ''}>+2 to one, +1 to another</option>
        <option value="threeone" ${wizState.boostMode === 'threeone' ? 'selected' : ''}>+1 to all three</option>
    `;
    modeDiv.appendChild(modeSelect);
    container.appendChild(modeDiv);

    const pickerDiv = document.createElement('div');
    pickerDiv.id = 'dnd-v1-bg-boost-pickers';
    container.appendChild(pickerDiv);

    const renderPickers = () => {
        const mode = modeSelect.value;
        wizState.boostMode = mode;
        pickerDiv.innerHTML = '';

        if (mode === 'threeone') {
            for (let i = 0; i < allowedAbilities.length; i++) {
                const ab = allowedAbilities[i];
                const tag = document.createElement('span');
                tag.className = 'v1-boost-tag';
                tag.textContent = `${ABILITY_LABELS[ab]} +1`;
                pickerDiv.appendChild(tag);
            }
            wizState.backgroundAbilityBoosts = {};
            for (const ab of allowedAbilities) {
                wizState.backgroundAbilityBoosts[ab] = 1;
            }
        } else {
            // +2 picker
            const s1 = document.createElement('select');
            s1.id = 'dnd-v1-bg-boost-2';
            s1.innerHTML = `<option value="">+2 to...</option>`;
            for (const ab of allowedAbilities) {
                const opt = document.createElement('option');
                opt.value = ab;
                opt.textContent = ABILITY_LABELS[ab];
                if (existing[ab] === 2) opt.selected = true;
                s1.appendChild(opt);
            }
            pickerDiv.appendChild(labelWrap('+2:', s1));

            // +1 picker
            const s2 = document.createElement('select');
            s2.id = 'dnd-v1-bg-boost-1';
            s2.innerHTML = `<option value="">+1 to...</option>`;
            for (const ab of allowedAbilities) {
                const opt = document.createElement('option');
                opt.value = ab;
                opt.textContent = ABILITY_LABELS[ab];
                if (existing[ab] === 1) opt.selected = true;
                s2.appendChild(opt);
            }
            pickerDiv.appendChild(labelWrap('+1:', s2));
        }
    };

    modeSelect.onchange = renderPickers;
    renderPickers();
}

function labelWrap(text, el) {
    const span = document.createElement('span');
    span.style.display = 'flex';
    span.style.alignItems = 'center';
    span.style.gap = '0.25em';
    const lbl = document.createElement('span');
    lbl.textContent = text;
    lbl.style.fontSize = '0.85em';
    span.appendChild(lbl);
    span.appendChild(el);
    return span;
}

// ─── Origin Feat Configuration ──────────────────────────────
const ALL_SKILLS = Object.entries(SKILL_LABELS);
const COMMON_TOOLS = [
    "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
    "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
    "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
    "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
    "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools",
    "Woodcarver's Tools", "Disguise Kit", "Forgery Kit", "Gaming Set",
    "Herbalism Kit", "Musical Instrument", "Navigator's Tools",
    "Poisoner's Kit", "Thieves' Tools",
];

function buildOriginFeatConfig(bg) {
    const section = document.getElementById('dnd-v1-origin-feat-config');
    const body = document.getElementById('dnd-v1-origin-feat-body');
    if (!section || !body) return;

    const featName = bg.originFeat;
    if (!featName) {
        section.style.display = 'none';
        return;
    }

    if (!wizState.originFeatConfig) wizState.originFeatConfig = {};
    const config = wizState.originFeatConfig;

    const builder = resolveOriginFeatBuilder(featName);
    if (!builder) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(featName)}">${esc(featName)}</div>`;
    builder(body, config);
}

const ORIGIN_FEAT_BUILDERS = {
    'Skilled': buildSkilledConfig,
    'Magic Initiate': buildMagicInitiateConfig,
    'Fey Touched': buildFeyTouchedConfig,
    'Shadow Touched': buildShadowTouchedConfig,
    'Skill Expert': buildSkillExpertConfig,
    'Elemental Adept': buildElementalAdeptConfig,
    'Resilient': buildResilientConfig,
    'Ritual Caster': buildRitualCasterConfig,
    'Crafter': buildCrafterConfig,
    'Musician': buildMusicianConfig,

    // Feats with no user config needed
    'Alert': buildSimpleFeatSummary,
    'Healer': buildSimpleFeatSummary,
    'Lucky': buildSimpleFeatSummary,
    'Savage Attacker': buildSimpleFeatSummary,
    'Tavern Brawler': buildSimpleFeatSummary,
    'Tough': buildSimpleFeatSummary,
};

function normalizeFeatName(name) {
    if (!name) return '';
    return name.replace(/-/g, ' ');
}

function resolveOriginFeatBuilder(featName) {
    if (!featName) return null;
    if (featName in ORIGIN_FEAT_BUILDERS) return ORIGIN_FEAT_BUILDERS[featName];
    const normalized = normalizeFeatName(featName);
    if (normalized in ORIGIN_FEAT_BUILDERS) return ORIGIN_FEAT_BUILDERS[normalized];
    const base = normalized.split(':')[0].trim();
    if (base.startsWith('Magic Initiate')) return buildMagicInitiateConfig;
    if (base === 'Fey Touched') return buildFeyTouchedConfig;
    if (base === 'Shadow Touched') return buildShadowTouchedConfig;
    return buildSimpleFeatSummary;
}

async function buildSimpleFeatSummary(body, _config) {
    const nameEl = body.querySelector('.v1-origin-feat-name');
    const featName = nameEl?.dataset?.feat || nameEl?.textContent || '';
    const feat = await findFeat(featName);
    if (feat) {
        const desc = feat.description.length > 200 ? feat.description.substring(0, 197) + '...' : feat.description;
        const div = document.createElement('div');
        div.className = 'v1-feat-desc-text';
        div.textContent = desc;
        body.appendChild(div);
    }
}

function buildSkilledConfig(body, config) {
    if (!config.skilledChoices) config.skilledChoices = [];

    const total = 3;
    const label = document.createElement('div');
    label.className = 'v1-origin-feat-label';
    label.id = 'v1-skilled-count';
    label.textContent = `Choose ${total} skills or tools (${config.skilledChoices.length}/${total}):`;
    body.appendChild(label);

    const listDiv = document.createElement('div');
    listDiv.id = 'v1-skilled-tags';
    listDiv.className = 'v1-feat-tag-list';
    body.appendChild(listDiv);

    const renderTags = () => {
        listDiv.innerHTML = '';
        for (const item of config.skilledChoices) {
            const tag = document.createElement('span');
            tag.className = 'v1-feat-tag';
            tag.innerHTML = `${esc(item)} <button class="v1-feat-remove">&times;</button>`;
            tag.querySelector('.v1-feat-remove').onclick = () => {
                config.skilledChoices = config.skilledChoices.filter(s => s !== item);
                renderTags();
                label.textContent = `Choose ${total} skills or tools (${config.skilledChoices.length}/${total}):`;
            };
            listDiv.appendChild(tag);
        }
    };
    renderTags();

    // Skill dropdown
    const skillSelect = document.createElement('select');
    skillSelect.innerHTML = '<option value="">Add skill...</option>';
    for (const [key, lbl] of ALL_SKILLS) {
        if (config.skilledChoices.includes(key)) continue;
        skillSelect.innerHTML += `<option value="skill:${key}">${lbl}</option>`;
    }
    body.appendChild(skillSelect);

    // Tool dropdown
    const toolSelect = document.createElement('select');
    toolSelect.innerHTML = '<option value="">Add tool...</option>';
    for (const tool of COMMON_TOOLS) {
        if (config.skilledChoices.includes(tool)) continue;
        toolSelect.innerHTML += `<option value="tool:${esc(tool)}">${esc(tool)}</option>`;
    }
    body.appendChild(toolSelect);

    const addChoice = (val) => {
        if (!val) return;
        const actual = val.startsWith('skill:') ? val.substring(6) : val.substring(5);
        if (config.skilledChoices.length >= total || config.skilledChoices.includes(actual)) return;
        config.skilledChoices.push(actual);
        renderTags();
        label.textContent = `Choose ${total} skills or tools (${config.skilledChoices.length}/${total}):`;
    };

    skillSelect.onchange = () => { addChoice(skillSelect.value); skillSelect.value = ''; };
    toolSelect.onchange = () => { addChoice(toolSelect.value); toolSelect.value = ''; };
}

async function buildMagicInitiateConfig(body, config) {
    const nameEl = body.querySelector('.v1-origin-feat-name');
    const featName = nameEl?.dataset?.feat || nameEl?.textContent || 'Magic Initiate';

    // Try to extract class from feat name (e.g. "Magic Initiate: Cleric" or background-set)
    let presetClass = '';
    if (featName.includes(':')) {
        presetClass = featName.split(':')[1].trim().split('|')[0].trim();
    }
    if (!config.miClass && presetClass) config.miClass = presetClass.toLowerCase();
    if (!config.miCantrips) config.miCantrips = [];
    if (!config.miSpell) config.miSpell = '';

    const classOptions = ['Cleric', 'Druid', 'Wizard'];

    // Class picker (may be pre-locked by background)
    const classDiv = document.createElement('div');
    classDiv.className = 'dnd-setting-row';
    if (presetClass) {
        classDiv.innerHTML = `<b>Spell List:</b> ${esc(presetClass)}`;
    } else {
        const sel = document.createElement('select');
        sel.id = 'v1-mi-class';
        sel.innerHTML = '<option value="">Choose spell list...</option>';
        for (const c of classOptions) {
            sel.innerHTML += `<option value="${c.toLowerCase()}" ${config.miClass === c.toLowerCase() ? 'selected' : ''}>${c}</option>`;
        }
        classDiv.appendChild(labelWrap('Spell List:', sel));
        sel.onchange = () => {
            config.miClass = sel.value;
            config.miCantrips = [];
            config.miSpell = '';
            body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(featName)}">${esc(featName)}</div>`;
            buildMagicInitiateConfig(body, config);
        };
    }
    body.appendChild(classDiv);

    if (!config.miClass) return;

    // Cantrip pickers
    const cantrips = await getClassCantrips(config.miClass);
    const cantripLabel = document.createElement('div');
    cantripLabel.className = 'v1-origin-feat-label';
    cantripLabel.textContent = `Cantrips (${config.miCantrips.length}/2):`;
    body.appendChild(cantripLabel);

    const cantripTags = document.createElement('div');
    cantripTags.className = 'v1-feat-tag-list';
    body.appendChild(cantripTags);

    const renderCantripTags = () => {
        cantripTags.innerHTML = '';
        for (const name of config.miCantrips) {
            const tag = document.createElement('span');
            tag.className = 'v1-feat-tag';
            tag.innerHTML = `${esc(name)} <button class="v1-feat-remove">&times;</button>`;
            tag.querySelector('.v1-feat-remove').onclick = () => {
                config.miCantrips = config.miCantrips.filter(c => c !== name);
                renderCantripTags();
                cantripLabel.textContent = `Cantrips (${config.miCantrips.length}/2):`;
            };
            cantripTags.appendChild(tag);
        }
    };
    renderCantripTags();

    // Cantrip search
    const cantripSearchDiv = document.createElement('div');
    cantripSearchDiv.className = 'v1-feat-search-wrapper dnd-setting-row';
    const cantripInput = document.createElement('input');
    cantripInput.type = 'text';
    cantripInput.placeholder = 'Search cantrips...';
    cantripInput.autocomplete = 'off';
    const cantripDD = document.createElement('div');
    cantripDD.className = 'v1-feat-dropdown';
    cantripSearchDiv.appendChild(cantripInput);
    cantripSearchDiv.appendChild(cantripDD);
    body.appendChild(cantripSearchDiv);

    cantripInput.oninput = () => {
        const q = cantripInput.value.toLowerCase().trim();
        if (!q) { cantripDD.classList.remove('open'); return; }
        const matches = cantrips.filter(s => s.name.toLowerCase().includes(q) && !config.miCantrips.includes(s.name)).slice(0, 10);
        cantripDD.innerHTML = matches.map(s => `<div class="dropdown-item" data-name="${esc(s.name)}">${esc(s.name)}</div>`).join('') || '<div class="dropdown-empty">No cantrips found</div>';
        cantripDD.classList.add('open');
        cantripDD.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = () => {
                if (config.miCantrips.length < 2) {
                    config.miCantrips.push(item.dataset.name);
                    renderCantripTags();
                    cantripLabel.textContent = `Cantrips (${config.miCantrips.length}/2):`;
                }
                cantripDD.classList.remove('open');
                cantripInput.value = '';
            };
        });
    };

    // 1st-level spell picker
    const spellLabel = document.createElement('div');
    spellLabel.className = 'v1-origin-feat-label';
    spellLabel.textContent = `1st-Level Spell (1/LR free cast):`;
    body.appendChild(spellLabel);

    if (config.miSpell) {
        const tag = document.createElement('span');
        tag.className = 'v1-feat-tag';
        tag.innerHTML = `${esc(config.miSpell)} <button class="v1-feat-remove">&times;</button>`;
        tag.querySelector('.v1-feat-remove').onclick = () => {
            config.miSpell = '';
            body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(featName)}">${esc(featName)}</div>`;
            buildMagicInitiateConfig(body, config);
        };
        body.appendChild(tag);
    } else {
        const spellSearchDiv = document.createElement('div');
        spellSearchDiv.className = 'v1-feat-search-wrapper dnd-setting-row';
        const spellInput = document.createElement('input');
        spellInput.type = 'text';
        spellInput.placeholder = 'Search 1st-level spells...';
        spellInput.autocomplete = 'off';
        const spellDD = document.createElement('div');
        spellDD.className = 'v1-feat-dropdown';
        spellSearchDiv.appendChild(spellInput);
        spellSearchDiv.appendChild(spellDD);
        body.appendChild(spellSearchDiv);

        spellInput.oninput = async () => {
            const q = spellInput.value.toLowerCase().trim();
            if (!q) { spellDD.classList.remove('open'); return; }
            const allSpells = await getClassSpells(config.miClass, 1);
            const matches = allSpells.filter(s => s.level === 1 && s.name.toLowerCase().includes(q)).slice(0, 10);
            spellDD.innerHTML = matches.map(s => `<div class="dropdown-item" data-name="${esc(s.name)}">${esc(s.name)}</div>`).join('') || '<div class="dropdown-empty">No spells found</div>';
            spellDD.classList.add('open');
            spellDD.querySelectorAll('.dropdown-item').forEach(item => {
                item.onclick = () => {
                    config.miSpell = item.dataset.name;
                    spellDD.classList.remove('open');
                    // Rebuild to show tag
                    body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(featName)}">${esc(featName)}</div>`;
                    buildMagicInitiateConfig(body, config);
                };
            });
        };
    }
}

// ─── Fey Touched / Shadow Touched (choose 1 school-filtered spell + fixed spell) ──

const DIV_ENCH_SCHOOLS = ['Divination', 'Enchantment'];
const ILL_NEC_SCHOOLS = ['Illusion', 'Necromancy'];
const SCHOOL_MAP = {
    A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
    V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation',
};

function buildFeyTouchedConfig(body, config) {
    if (!config.ftSpell) config.ftSpell = '';
    buildTouchedConfig(body, config, 'Fey Touched', 'Misty Step', DIV_ENCH_SCHOOLS, 'ftSpell');
}

function buildShadowTouchedConfig(body, config) {
    if (!config.stSpell) config.stSpell = '';
    buildTouchedConfig(body, config, 'Shadow Touched', 'Invisibility', ILL_NEC_SCHOOLS, 'stSpell');
}

function buildTouchedConfig(body, config, featLabel, fixedSpell, allowedSchools, configKey) {
    const fixedDiv = document.createElement('div');
    fixedDiv.className = 'v1-origin-feat-label';
    fixedDiv.innerHTML = `<b>Granted:</b> ${esc(fixedSpell)} (free 1/LR)`;
    body.appendChild(fixedDiv);

    const chooseLabel = document.createElement('div');
    chooseLabel.className = 'v1-origin-feat-label';
    chooseLabel.textContent = `Choose a 1st-level ${allowedSchools.join('/')} spell:`;
    body.appendChild(chooseLabel);

    if (config[configKey]) {
        const tag = document.createElement('span');
        tag.className = 'v1-feat-tag';
        tag.innerHTML = `${esc(config[configKey])} <button class="v1-feat-remove">&times;</button>`;
        tag.querySelector('.v1-feat-remove').onclick = () => {
            config[configKey] = '';
            const nameEl = body.querySelector('.v1-origin-feat-name');
            const fn = nameEl?.dataset?.feat || featLabel;
            body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(fn)}">${esc(fn)}</div>`;
            buildTouchedConfig(body, config, featLabel, fixedSpell, allowedSchools, configKey);
        };
        body.appendChild(tag);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'v1-feat-search-wrapper dnd-setting-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Search ${allowedSchools.join('/')} spells...`;
        input.autocomplete = 'off';
        const dd = document.createElement('div');
        dd.className = 'v1-feat-dropdown';
        wrapper.appendChild(input);
        wrapper.appendChild(dd);
        body.appendChild(wrapper);

        // Compute school codes for filtering
        const schoolCodes = new Set();
        for (const [code, name] of Object.entries(SCHOOL_MAP)) {
            if (allowedSchools.includes(name)) schoolCodes.add(code);
        }

        // Fetch and filter lazily on input (avoids async render issues)
        input.oninput = async () => {
            const q = input.value.toLowerCase().trim();
            if (!q) { dd.classList.remove('open'); return; }
            const allSpells = await preloadSpellData();
            const filtered = (allSpells || []).filter(s => s.level === 1 && schoolCodes.has(s.school));
            const matches = filtered.filter(s => s.name.toLowerCase().includes(q)).slice(0, 10);
            dd.innerHTML = matches.map(s => `<div class="dropdown-item" data-name="${esc(s.name)}">${esc(s.name)} <span style="opacity:0.5">(${SCHOOL_MAP[s.school] || s.school})</span></div>`).join('') || '<div class="dropdown-empty">No spells found</div>';
            dd.classList.add('open');
            dd.querySelectorAll('.dropdown-item').forEach(item => {
                item.onclick = () => {
                    config[configKey] = item.dataset.name;
                    dd.classList.remove('open');
                    const nameEl = body.querySelector('.v1-origin-feat-name');
                    const fn = nameEl?.dataset?.feat || featLabel;
                    body.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(fn)}">${esc(fn)}</div>`;
                    buildTouchedConfig(body, config, featLabel, fixedSpell, allowedSchools, configKey);
                };
            });
        };
    }
}

// ─── Skill Expert (1 skill proficiency + 1 expertise) ──

function buildSkillExpertConfig(body, config) {
    if (!config.seSkill) config.seSkill = '';
    if (!config.seExpertise) config.seExpertise = '';

    const skillLabel = document.createElement('div');
    skillLabel.className = 'v1-origin-feat-label';
    skillLabel.textContent = 'Choose a skill proficiency:';
    body.appendChild(skillLabel);

    const skillSel = document.createElement('select');
    skillSel.innerHTML = '<option value="">-- Select --</option>';
    for (const [key, lbl] of ALL_SKILLS) {
        skillSel.innerHTML += `<option value="${key}" ${config.seSkill === key ? 'selected' : ''}>${lbl}</option>`;
    }
    body.appendChild(skillSel);

    const expLabel = document.createElement('div');
    expLabel.className = 'v1-origin-feat-label';
    expLabel.textContent = 'Choose a skill for expertise (double proficiency):';
    body.appendChild(expLabel);

    const expSel = document.createElement('select');
    expSel.innerHTML = '<option value="">-- Select --</option>';
    for (const [key, lbl] of ALL_SKILLS) {
        expSel.innerHTML += `<option value="${key}" ${config.seExpertise === key ? 'selected' : ''}>${lbl}</option>`;
    }
    body.appendChild(expSel);

    skillSel.onchange = () => { config.seSkill = skillSel.value; };
    expSel.onchange = () => { config.seExpertise = expSel.value; };
}

// ─── Elemental Adept (damage type picker) ──

const ELEMENTAL_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

function buildElementalAdeptConfig(body, config) {
    if (!config.eaDamageType) config.eaDamageType = '';

    const label = document.createElement('div');
    label.className = 'v1-origin-feat-label';
    label.textContent = 'Choose a damage type:';
    body.appendChild(label);

    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">-- Select --</option>';
    for (const t of ELEMENTAL_TYPES) {
        sel.innerHTML += `<option value="${t}" ${config.eaDamageType === t ? 'selected' : ''}>${t}</option>`;
    }
    body.appendChild(sel);

    sel.onchange = () => { config.eaDamageType = sel.value; };
}

// ─── Resilient (saving throw proficiency) ──

function buildResilientConfig(body, config) {
    if (!config.resSave) config.resSave = '';

    const label = document.createElement('div');
    label.className = 'v1-origin-feat-label';
    label.textContent = 'Choose a saving throw proficiency:';
    body.appendChild(label);

    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">-- Select --</option>';
    for (const ab of ABILITY_KEYS) {
        sel.innerHTML += `<option value="${ab}" ${config.resSave === ab ? 'selected' : ''}>${ABILITY_LABELS[ab]}</option>`;
    }
    body.appendChild(sel);

    sel.onchange = () => { config.resSave = sel.value; };
}

// ─── Ritual Caster (class spell list) ──

function buildRitualCasterConfig(body, config) {
    if (!config.rcClass) config.rcClass = '';
    if (!config.rcSpells) config.rcSpells = [];
    const classOptions = ['Bard', 'Cleric', 'Druid', 'Wizard'];

    const label = document.createElement('div');
    label.className = 'v1-origin-feat-label';
    label.textContent = 'Choose ritual spell list class:';
    body.appendChild(label);

    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">-- Select --</option>';
    for (const c of classOptions) {
        sel.innerHTML += `<option value="${c.toLowerCase()}" ${config.rcClass === c.toLowerCase() ? 'selected' : ''}>${c}</option>`;
    }
    body.appendChild(sel);

    const spellArea = document.createElement('div');
    spellArea.className = 'v1-rc-spell-area';
    body.appendChild(spellArea);

    const renderRitualSpells = () => {
        spellArea.innerHTML = '';
        if (!config.rcClass) return;

        const tagRow = document.createElement('div');
        tagRow.className = 'v1-origin-feat-label';
        tagRow.textContent = `Chosen ritual spells (${config.rcSpells.length}/2):`;
        spellArea.appendChild(tagRow);

        for (let i = 0; i < config.rcSpells.length; i++) {
            const tag = document.createElement('span');
            tag.className = 'v1-feat-tag';
            tag.innerHTML = `${esc(config.rcSpells[i])} <button class="v1-feat-remove">&times;</button>`;
            tag.querySelector('.v1-feat-remove').onclick = () => {
                config.rcSpells.splice(i, 1);
                renderRitualSpells();
            };
            spellArea.appendChild(tag);
        }

        if (config.rcSpells.length < 2) {
            const wrapper = document.createElement('div');
            wrapper.className = 'v1-feat-search-wrapper dnd-setting-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Search ${config.rcClass} ritual spells...`;
            input.autocomplete = 'off';
            const dd = document.createElement('div');
            dd.className = 'v1-feat-dropdown';
            wrapper.appendChild(input);
            wrapper.appendChild(dd);
            spellArea.appendChild(wrapper);

            input.oninput = async () => {
                const q = input.value.toLowerCase().trim();
                if (!q) { dd.classList.remove('open'); return; }
                const classSpells = await getClassSpells(config.rcClass, 9);
                const rituals = classSpells.filter(s => s.level >= 1 && s.meta?.ritual);
                const matches = rituals.filter(s => s.name.toLowerCase().includes(q))
                    .filter(s => !config.rcSpells.includes(s.name))
                    .slice(0, 10);
                dd.innerHTML = matches.map(s => `<div class="dropdown-item" data-name="${esc(s.name)}">${esc(s.name)} (Lv${s.level})</div>`).join('') || '<div class="dropdown-empty">No ritual spells found</div>';
                dd.classList.add('open');
                dd.querySelectorAll('.dropdown-item').forEach(item => {
                    item.onclick = () => {
                        config.rcSpells.push(item.dataset.name);
                        dd.classList.remove('open');
                        renderRitualSpells();
                    };
                });
            };
        }
    };

    sel.onchange = () => {
        config.rcClass = sel.value;
        config.rcSpells = [];
        renderRitualSpells();
    };

    renderRitualSpells();
}

// ─── Crafter (3 artisan tools) ──

const ARTISAN_TOOLS = [
    "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
    "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
    "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
    "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
    "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools",
    "Woodcarver's Tools",
];

function buildCrafterConfig(body, config) {
    if (!config.crafterTools) config.crafterTools = [];
    buildMultiPickConfig(body, config, 'crafterTools', 3, ARTISAN_TOOLS, "artisan's tool");
}

// ─── Musician (3 instruments) ──

const INSTRUMENTS = [
    'Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Horn',
    'Lute', 'Lyre', 'Pan Flute', 'Shawm', 'Viol',
];

function buildMusicianConfig(body, config) {
    if (!config.musicianInstruments) config.musicianInstruments = [];
    buildMultiPickConfig(body, config, 'musicianInstruments', 3, INSTRUMENTS, 'instrument');
}

// Shared multi-pick builder for simple list selections
function buildMultiPickConfig(body, config, key, max, options, label) {
    const countLabel = document.createElement('div');
    countLabel.className = 'v1-origin-feat-label';
    countLabel.textContent = `Choose ${max} ${label}s (${config[key].length}/${max}):`;
    body.appendChild(countLabel);

    const listDiv = document.createElement('div');
    listDiv.className = 'v1-feat-tag-list';
    body.appendChild(listDiv);

    const renderTags = () => {
        listDiv.innerHTML = '';
        for (const item of config[key]) {
            const tag = document.createElement('span');
            tag.className = 'v1-feat-tag';
            tag.innerHTML = `${esc(item)} <button class="v1-feat-remove">&times;</button>`;
            tag.querySelector('.v1-feat-remove').onclick = () => {
                config[key] = config[key].filter(x => x !== item);
                renderTags();
                countLabel.textContent = `Choose ${max} ${label}s (${config[key].length}/${max}):`;
            };
            listDiv.appendChild(tag);
        }
    };
    renderTags();

    const sel = document.createElement('select');
    sel.innerHTML = `<option value="">Add ${label}...</option>`;
    for (const item of options) {
        if (config[key].includes(item)) continue;
        sel.innerHTML += `<option value="${esc(item)}">${esc(item)}</option>`;
    }
    body.appendChild(sel);

    sel.onchange = () => {
        if (!sel.value || config[key].length >= max) return;
        config[key].push(sel.value);
        renderTags();
        countLabel.textContent = `Choose ${max} ${label}s (${config[key].length}/${max}):`;
        const opt = sel.querySelector(`option[value="${CSS.escape(sel.value)}"]`);
        if (opt) opt.remove();
        sel.value = '';
    };
}

async function populateClass() {
    const select = document.getElementById('dnd-v1-class');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Class --</option>';
    for (const cls of classList) {
        const opt = document.createElement('option');
        opt.value = `${cls.name}|${cls.source}|${cls.filename}`;
        opt.textContent = `${cls.name} (${cls.source})`;
        if (wizState.className === cls.name && wizState.classSource === cls.source) {
            opt.selected = true;
        }
        select.appendChild(opt);
    }

    const levelInput = document.getElementById('dnd-v1-level');
    if (levelInput) levelInput.value = wizState.level || 1;

    await updateClassSubclasses();
}

async function updateClassSubclasses() {
    const select = document.getElementById('dnd-v1-class');
    const subRow = document.getElementById('dnd-v1-subclass-row');
    const subSelect = document.getElementById('dnd-v1-subclass');
    const preview = document.getElementById('dnd-v1-class-preview');
    if (!select || !subRow || !subSelect) return;

    const val = select.value;
    if (!val) {
        subRow.style.display = 'none';
        if (preview) preview.style.display = 'none';
        classDataCache = null;
        return;
    }

    const [name, source, filename] = val.split('|');
    classDataCache = await getClassData(filename, name, source);

    if (!classDataCache) {
        subRow.style.display = 'none';
        return;
    }

    // Populate subclasses
    if (classDataCache.subclasses?.length > 0) {
        subRow.style.display = '';
        subSelect.innerHTML = '<option value="">-- None --</option>';
        for (const sc of classDataCache.subclasses) {
            const opt = document.createElement('option');
            opt.value = `${sc.name}|${sc.shortName}|${sc.source}`;
            opt.textContent = `${sc.name} (${sc.source})`;
            if (wizState.subclassName === sc.name) opt.selected = true;
            subSelect.appendChild(opt);
        }
    } else {
        subRow.style.display = 'none';
    }

    // Preview
    if (preview) {
        preview.innerHTML = `<b>Hit Die:</b> d${classDataCache.hitDie} | <b>Saves:</b> ${classDataCache.saveProficiencies.map(s => ABILITY_LABELS[s]).join(', ')}`;
        preview.style.display = '';
    }
}

function populateAbilities() {
    const grid = document.getElementById('dnd-v1-ability-grid');
    const methodSelect = document.getElementById('dnd-v1-ability-method');
    if (!grid || !methodSelect) return;

    const method = wizState.abilityMethod || 'standard_array';
    methodSelect.value = method;

    if (!wizState.baseAbilities) {
        wizState.baseAbilities = {};
        for (const ab of ABILITY_KEYS) wizState.baseAbilities[ab] = method === 'point_buy' ? 8 : 10;
    }
    const base = wizState.baseAbilities;

    grid.innerHTML = '';

    if (method === 'standard_array') {
        buildStandardArrayGrid(grid, base);
    } else if (method === 'point_buy') {
        buildPointBuyGrid(grid, base);
    } else {
        buildManualEntryGrid(grid, base);
    }

    // Point buy remaining
    const pbRemaining = document.getElementById('dnd-v1-point-buy-remaining');
    if (pbRemaining) {
        pbRemaining.style.display = method === 'point_buy' ? '' : 'none';
        if (method === 'point_buy') updatePointBuyDisplay();
    }
}

function buildStandardArrayGrid(grid, base) {
    const getUsedValues = () => {
        const used = {};
        for (const ab of ABILITY_KEYS) {
            if (base[ab] && STANDARD_ARRAY.includes(base[ab])) {
                used[base[ab]] = (used[base[ab]] || 0) + 1;
            }
        }
        return used;
    };

    const rebuildDropdowns = () => {
        const usedCounts = getUsedValues();
        const available = val => {
            const maxUse = STANDARD_ARRAY.filter(v => v === val).length;
            return (usedCounts[val] || 0) < maxUse;
        };

        for (const ab of ABILITY_KEYS) {
            const sel = grid.querySelector(`.v1-ab-select[data-ability="${ab}"]`);
            if (!sel) continue;
            const current = base[ab];
            sel.innerHTML = '<option value="">--</option>';
            for (const val of STANDARD_ARRAY) {
                if (val === current || available(val)) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    if (current === val) opt.selected = true;
                    sel.appendChild(opt);
                }
            }
        }
    };

    for (const ab of ABILITY_KEYS) {
        const cell = document.createElement('div');
        cell.className = 'v1-ab-cell';

        const label = document.createElement('label');
        label.textContent = ABILITY_LABELS[ab];
        cell.appendChild(label);

        const sel = document.createElement('select');
        sel.dataset.ability = ab;
        sel.className = 'v1-ab-select';
        cell.appendChild(sel);

        const modDiv = document.createElement('div');
        modDiv.className = 'v1-ab-mod';
        const mod = getModifier(base[ab] || 10);
        modDiv.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
        cell.appendChild(modDiv);

        sel.onchange = () => {
            const val = sel.value ? parseInt(sel.value) : 0;
            base[ab] = val || 10;
            const m = getModifier(base[ab]);
            modDiv.textContent = m >= 0 ? `+${m}` : `${m}`;
            rebuildDropdowns();
        };

        grid.appendChild(cell);
    }

    rebuildDropdowns();
}

function buildPointBuyGrid(grid, base) {
    for (const ab of ABILITY_KEYS) {
        if (!base[ab] || base[ab] < 8 || base[ab] > 15) base[ab] = 8;
    }

    const allCells = [];

    for (const ab of ABILITY_KEYS) {
        const cell = document.createElement('div');
        cell.className = 'v1-ab-cell v1-pb-cell';

        const label = document.createElement('label');
        label.textContent = ABILITY_LABELS[ab];
        cell.appendChild(label);

        const controls = document.createElement('div');
        controls.className = 'v1-pb-controls';

        const plusBtn = document.createElement('button');
        plusBtn.className = 'v1-pb-btn';
        plusBtn.textContent = '+';
        plusBtn.type = 'button';

        const valSpan = document.createElement('span');
        valSpan.className = 'v1-pb-value';
        valSpan.textContent = base[ab];

        const minusBtn = document.createElement('button');
        minusBtn.className = 'v1-pb-btn';
        minusBtn.textContent = '−';
        minusBtn.type = 'button';

        controls.appendChild(plusBtn);
        controls.appendChild(valSpan);
        controls.appendChild(minusBtn);
        cell.appendChild(controls);

        const costSpan = document.createElement('div');
        costSpan.className = 'v1-pb-cost';
        costSpan.textContent = `${POINT_BUY_COSTS[base[ab]] ?? 0}pt`;
        cell.appendChild(costSpan);

        const modDiv = document.createElement('div');
        modDiv.className = 'v1-ab-mod';
        const mod = getModifier(base[ab]);
        modDiv.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
        cell.appendChild(modDiv);

        allCells.push({ ab, cell, plusBtn, minusBtn, valSpan, costSpan, modDiv });
        grid.appendChild(cell);
    }

    const refreshAll = () => {
        const spent = getPointBuySpent(base);
        for (const c of allCells) {
            c.valSpan.textContent = base[c.ab];
            c.costSpan.textContent = `${POINT_BUY_COSTS[base[c.ab]] ?? 0}pt`;
            const m = getModifier(base[c.ab]);
            c.modDiv.textContent = m >= 0 ? `+${m}` : `${m}`;
            c.minusBtn.disabled = base[c.ab] <= 8;
            c.plusBtn.disabled = base[c.ab] >= 15 || spent >= POINT_BUY_TOTAL;
        }
        updatePointBuyDisplay();
    };

    for (const c of allCells) {
        c.minusBtn.onclick = () => {
            if (base[c.ab] > 8) { base[c.ab]--; refreshAll(); }
        };
        c.plusBtn.onclick = () => {
            if (base[c.ab] < 15) {
                const newCost = POINT_BUY_COSTS[base[c.ab] + 1] - POINT_BUY_COSTS[base[c.ab]];
                if (getPointBuySpent(base) + newCost <= POINT_BUY_TOTAL) {
                    base[c.ab]++;
                    refreshAll();
                }
            }
        };
    }

    refreshAll();
}

function getPointBuySpent(base) {
    let spent = 0;
    for (const ab of ABILITY_KEYS) {
        spent += POINT_BUY_COSTS[base[ab]] ?? 0;
    }
    return spent;
}

function updatePointBuyDisplay() {
    const el = document.getElementById('dnd-v1-point-buy-remaining');
    if (!el) return;
    const base = wizState.baseAbilities || {};
    const spent = getPointBuySpent(base);
    const remaining = POINT_BUY_TOTAL - spent;
    el.textContent = `Points remaining: ${remaining} / ${POINT_BUY_TOTAL}`;
    el.style.color = remaining < 0 ? '#e44' : remaining === 0 ? '#5bd05b' : '';
}

function buildManualEntryGrid(grid, base) {
    for (const ab of ABILITY_KEYS) {
        const cell = document.createElement('div');
        cell.className = 'v1-ab-cell';

        const label = document.createElement('label');
        label.textContent = ABILITY_LABELS[ab];
        cell.appendChild(label);

        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 1;
        inp.max = 20;
        inp.value = base[ab] || 10;
        inp.dataset.ability = ab;
        inp.className = 'v1-ab-input';
        cell.appendChild(inp);

        const modDiv = document.createElement('div');
        modDiv.className = 'v1-ab-mod';
        const mod = getModifier(base[ab] || 10);
        modDiv.textContent = mod >= 0 ? `+${mod}` : `${mod}`;
        cell.appendChild(modDiv);

        inp.oninput = () => {
            base[ab] = parseInt(inp.value) || 10;
            const m = getModifier(base[ab]);
            modDiv.textContent = m >= 0 ? `+${m}` : `${m}`;
        };

        grid.appendChild(cell);
    }
}

function populateASI() {
    const container = document.getElementById('dnd-v1-asi-rows');
    if (!container) return;

    const level = wizState.level || 1;
    const classKey = wizState.className?.toLowerCase() || '';
    const subclassName = wizState.subclassName || null;

    const features = getLevelFeatures(classKey, subclassName, level);

    if (features.length === 0) {
        container.innerHTML = '<div class="dnd-v1-info-text">No level features at level ' + level + '</div>';
        return;
    }

    if (!wizState.levelChoices) wizState.levelChoices = {};

    container.innerHTML = '';

    // Group features by level
    const byLevel = {};
    for (const feat of features) {
        if (!byLevel[feat.level]) byLevel[feat.level] = [];
        byLevel[feat.level].push(feat);
    }

    for (const [lv, feats] of Object.entries(byLevel).sort((a, b) => a[0] - b[0])) {
        const levelSection = document.createElement('div');
        levelSection.className = 'dnd-v1-level-section';
        levelSection.innerHTML = `<div class="v1-level-header">Level ${lv}</div>`;

        for (const feat of feats) {
            if (feat.type === 'asi') {
                renderASIFeature(levelSection, parseInt(lv));
            } else if (feat.type === 'single-select') {
                renderSingleSelectFeature(levelSection, parseInt(lv), feat);
            }
        }

        container.appendChild(levelSection);
    }

    bindASIEvents(container);
}

function renderASIFeature(parent, lv) {
    const choice = wizState.asiChoices?.[lv] || { type: 'asi', abilities: [] };
    const isAsi = choice.type !== 'feat';

    const row = document.createElement('div');
    row.className = 'dnd-v1-asi-row';
    row.dataset.level = lv;
    row.innerHTML = `
        <div class="asi-level-label">Ability Score Improvement / Feat</div>
        <div class="dnd-setting-row">
            <label class="dnd-v1-asi-toggle">
                <input type="checkbox" class="v1-asi-feat-toggle" data-level="${lv}" ${!isAsi ? 'checked' : ''} />
                <span>Feat</span>
            </label>
        </div>
        <div class="v1-asi-ability-picks" data-level="${lv}" ${!isAsi ? 'style="display:none;"' : ''}>
            <div class="dnd-setting-row">
                <select class="v1-asi-ab1" data-level="${lv}">
                    <option value="">+1 to...</option>
                    ${ABILITY_KEYS.map(ab => `<option value="${ab}" ${choice.abilities?.[0] === ab ? 'selected' : ''}>${ABILITY_LABELS[ab]}</option>`).join('')}
                </select>
                <select class="v1-asi-ab2" data-level="${lv}">
                    <option value="">+1 to...</option>
                    ${ABILITY_KEYS.map(ab => `<option value="${ab}" ${choice.abilities?.[1] === ab ? 'selected' : ''}>${ABILITY_LABELS[ab]}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="v1-asi-feat-picks" data-level="${lv}" ${isAsi ? 'style="display:none;"' : ''}>
            <div class="dnd-setting-row v1-feat-search-wrapper">
                <input type="text" class="v1-asi-feat-search" data-level="${lv}" placeholder="Search feats..." autocomplete="off" value="" />
                <div class="v1-feat-dropdown" data-level="${lv}"></div>
            </div>
            <div class="v1-asi-feat-selected" data-level="${lv}"></div>
            <div class="v1-asi-feat-ability-row" data-level="${lv}"></div>
            <div class="v1-asi-feat-desc" data-level="${lv}"></div>
        </div>
    `;
    parent.appendChild(row);

    if (!isAsi && choice.feat) {
        renderSelectedFeat(lv, choice.feat, choice.featAbility);
    }
}

function renderSingleSelectFeature(parent, lv, featDef) {
    const choices = wizState.levelChoices[lv] || {};
    const current = choices[featDef.id] || {};

    const row = document.createElement('div');
    row.className = 'dnd-v1-level-feature-row';
    row.dataset.level = lv;
    row.dataset.featureId = featDef.id;

    let descHtml = '';
    if (featDef.description) {
        descHtml = `<div class="v1-level-feature-desc">${esc(featDef.description)}</div>`;
    }

    const optionsHtml = (featDef.options || []).map(opt => {
        const sel = current.selected === opt.id ? ' selected' : '';
        const descSuffix = opt.desc ? ` — ${esc(opt.desc)}` : '';
        return `<option value="${esc(opt.id)}"${sel}>${esc(opt.label)}${descSuffix}</option>`;
    }).join('');

    row.innerHTML = `
        <div class="v1-level-feature-label">${esc(featDef.label)}</div>
        ${descHtml}
        <select class="v1-level-feature-select" data-level="${lv}" data-feature-id="${esc(featDef.id)}">
            <option value="">-- Choose --</option>
            ${optionsHtml}
        </select>
        <div class="v1-level-feature-subconfig" data-level="${lv}" data-feature-id="${esc(featDef.id)}"></div>
    `;
    parent.appendChild(row);

    const select = row.querySelector('.v1-level-feature-select');
    const subconfigDiv = row.querySelector('.v1-level-feature-subconfig');

    select.onchange = () => {
        const val = select.value;
        if (!wizState.levelChoices[lv]) wizState.levelChoices[lv] = {};
        wizState.levelChoices[lv][featDef.id] = { selected: val || null };
        renderFeatureSubconfig(subconfigDiv, lv, featDef, val);
    };

    if (current.selected) {
        renderFeatureSubconfig(subconfigDiv, lv, featDef, current.selected);
    }
}

function renderFeatureSubconfig(container, lv, featDef, selectedId) {
    container.innerHTML = '';
    if (!selectedId) return;

    const opt = (featDef.options || []).find(o => o.id === selectedId);
    if (!opt) return;

    // Show granted spell if any
    if (opt.grantSpell) {
        const div = document.createElement('div');
        div.className = 'v1-level-feature-grant';
        div.innerHTML = `<b>Granted spell:</b> ${esc(opt.grantSpell)} (always prepared)`;
        container.appendChild(div);
    }

    // Cantrip picker for fighting styles with hasCantrips
    if (opt.hasCantrips) {
        const data = wizState.levelChoices[lv]?.[featDef.id] || {};
        if (!data.cantrips) data.cantrips = [];

        const label = document.createElement('div');
        label.className = 'v1-origin-feat-label';
        label.textContent = `Choose ${opt.cantripCount} ${opt.cantripClass} cantrips (${data.cantrips.length}/${opt.cantripCount}):`;
        container.appendChild(label);

        const tagDiv = document.createElement('div');
        tagDiv.className = 'v1-feat-tag-list';
        container.appendChild(tagDiv);

        const renderCantripTags = () => {
            tagDiv.innerHTML = '';
            for (const name of data.cantrips) {
                const tag = document.createElement('span');
                tag.className = 'v1-feat-tag';
                tag.innerHTML = `${esc(name)} <button class="v1-feat-remove">&times;</button>`;
                tag.querySelector('.v1-feat-remove').onclick = () => {
                    data.cantrips = data.cantrips.filter(c => c !== name);
                    wizState.levelChoices[lv][featDef.id] = data;
                    renderCantripTags();
                    label.textContent = `Choose ${opt.cantripCount} ${opt.cantripClass} cantrips (${data.cantrips.length}/${opt.cantripCount}):`;
                };
                tagDiv.appendChild(tag);
            }
        };
        renderCantripTags();

        if (data.cantrips.length < opt.cantripCount) {
            const wrapper = document.createElement('div');
            wrapper.className = 'v1-feat-search-wrapper dnd-setting-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Search ${opt.cantripClass} cantrips...`;
            input.autocomplete = 'off';
            const dd = document.createElement('div');
            dd.className = 'v1-feat-dropdown';
            wrapper.appendChild(input);
            wrapper.appendChild(dd);
            container.appendChild(wrapper);

            input.oninput = async () => {
                const q = input.value.toLowerCase().trim();
                if (!q) { dd.classList.remove('open'); return; }
                const { getClassCantrips } = await import('../features/spells.js');
                const cantrips = await getClassCantrips(opt.cantripClass);
                const matches = cantrips.filter(s => s.name.toLowerCase().includes(q) && !data.cantrips.includes(s.name)).slice(0, 10);
                dd.innerHTML = matches.map(s => `<div class="dropdown-item" data-name="${esc(s.name)}">${esc(s.name)}</div>`).join('') || '<div class="dropdown-empty">No cantrips found</div>';
                dd.classList.add('open');
                dd.querySelectorAll('.dropdown-item').forEach(item => {
                    item.onclick = () => {
                        if (data.cantrips.length < opt.cantripCount) {
                            data.cantrips.push(item.dataset.name);
                            wizState.levelChoices[lv][featDef.id] = data;
                            renderCantripTags();
                            label.textContent = `Choose ${opt.cantripCount} ${opt.cantripClass} cantrips (${data.cantrips.length}/${opt.cantripCount}):`;
                        }
                        dd.classList.remove('open');
                        input.value = '';
                    };
                });
            };
        }
    }
}

function bindASIEvents(container) {
    container.querySelectorAll('.v1-asi-feat-toggle').forEach(toggle => {
        toggle.onchange = function () {
            const lv = this.dataset.level;
            const abilPicks = container.querySelector(`.v1-asi-ability-picks[data-level="${lv}"]`);
            const featPicks = container.querySelector(`.v1-asi-feat-picks[data-level="${lv}"]`);
            if (this.checked) {
                if (abilPicks) abilPicks.style.display = 'none';
                if (featPicks) featPicks.style.display = '';
            } else {
                if (abilPicks) abilPicks.style.display = '';
                if (featPicks) featPicks.style.display = 'none';
            }
        };
    });

    let _featSearchDebounce = null;
    container.querySelectorAll('.v1-asi-feat-search').forEach(input => {
        input.oninput = () => {
            clearTimeout(_featSearchDebounce);
            _featSearchDebounce = setTimeout(() => featSearchHandler(input), 180);
        };
        input.onfocus = () => {
            if (input.value.length >= 1) {
                clearTimeout(_featSearchDebounce);
                _featSearchDebounce = setTimeout(() => featSearchHandler(input), 100);
            }
        };
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.v1-feat-search-wrapper')) {
            container.querySelectorAll('.v1-feat-dropdown').forEach(dd => dd.classList.remove('open'));
        }
    });
}

async function featSearchHandler(input) {
    const lv = parseInt(input.dataset.level);
    const dropdown = input.parentElement.querySelector(`.v1-feat-dropdown[data-level="${lv}"]`);
    if (!dropdown) return;

    const query = input.value.toLowerCase().trim();
    if (!query) { dropdown.classList.remove('open'); return; }

    const feats = await getFeatsForLevel(lv);
    const matches = feats
        .filter(f => f.name.toLowerCase().includes(query))
        .sort((a, b) => {
            const aStart = a.name.toLowerCase().startsWith(query) ? 0 : 1;
            const bStart = b.name.toLowerCase().startsWith(query) ? 0 : 1;
            return aStart - bStart || a.name.localeCompare(b.name);
        })
        .slice(0, 12);

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-empty">No feats found</div>';
        dropdown.classList.add('open');
        return;
    }

    dropdown.innerHTML = matches.map(f => {
        const abHint = formatFeatAbilityHint(f);
        const cat = f.category !== 'General' ? ` (${f.category})` : '';
        const desc = f.description.length > 100 ? f.description.substring(0, 97) + '...' : f.description;
        return `<div class="dropdown-item v1-feat-dd-item" data-feat-name="${esc(f.name)}" data-level="${lv}">
            <div class="feat-dd-name">${esc(f.name)}${cat}${abHint ? ' ' + abHint : ''}</div>
            <div class="feat-dd-desc">${esc(desc)}</div>
        </div>`;
    }).join('');
    dropdown.classList.add('open');

    dropdown.querySelectorAll('.v1-feat-dd-item').forEach(item => {
        item.onclick = () => {
            const featName = item.dataset.featName;
            input.value = '';
            dropdown.classList.remove('open');
            renderSelectedFeat(lv, featName, null);
        };
    });
}

function formatFeatAbilityHint(feat) {
    if (!feat.abilityOptions || feat.abilityOptions.length === 0) return '';
    const parts = [];
    for (const opt of feat.abilityOptions) {
        if (opt.choose) {
            parts.push(`+${opt.amount || 1} ${opt.from.map(a => a.toUpperCase()).join('/')}`);
        } else if (opt.ability) {
            parts.push(`${opt.ability.toUpperCase()} +${opt.bonus}`);
        }
    }
    return parts.length ? `[${parts.join(', ')}]` : '';
}

async function renderSelectedFeat(level, featName, savedAbility) {
    const selectedEl = document.querySelector(`.v1-asi-feat-selected[data-level="${level}"]`);
    const abilityEl = document.querySelector(`.v1-asi-feat-ability-row[data-level="${level}"]`);
    const descEl = document.querySelector(`.v1-asi-feat-desc[data-level="${level}"]`);
    if (!selectedEl) return;

    const feat = await findFeat(featName);

    selectedEl.innerHTML = `<span class="v1-feat-tag">${esc(featName)} <button class="v1-feat-remove" data-level="${level}">&times;</button></span>`;
    selectedEl.querySelector('.v1-feat-remove').onclick = () => {
        clearSelectedFeat(level);
    };

    // Store in wizState
    if (!wizState.asiChoices) wizState.asiChoices = {};
    wizState.asiChoices[level] = { type: 'feat', feat: featName, featAbility: savedAbility || null };

    if (!feat) {
        if (abilityEl) abilityEl.innerHTML = '';
        if (descEl) descEl.innerHTML = '';
        return;
    }

    // Ability boost picker
    if (abilityEl) {
        const chooseOpts = feat.abilityOptions.filter(o => o.choose);
        const fixedOpts = feat.abilityOptions.filter(o => o.ability);
        let html = '';

        for (const fo of fixedOpts) {
            html += `<span class="v1-feat-fixed-ab">${fo.ability.toUpperCase()} +${fo.bonus}</span> `;
        }

        for (const co of chooseOpts) {
            const options = co.from.map(a => {
                const sel = savedAbility === a ? ' selected' : '';
                return `<option value="${a}"${sel}>${a.toUpperCase()}</option>`;
            }).join('');
            html += `<select class="v1-asi-feat-ability" data-level="${level}"><option value="">Choose ability +${co.amount || 1}...</option>${options}</select> `;
        }

        abilityEl.innerHTML = html || '<em class="v1-feat-no-ab">No ability boost</em>';
    }

    // Feat-specific config (Magic Initiate class/spell picker, Skilled skill picker, etc.)
    // Reuse the origin feat builder system for ASI feats too
    if (descEl) {
        const baseFeatName = featName.split(':')[0].trim();
        const builder = resolveOriginFeatBuilder(baseFeatName);

        if (builder && builder !== buildSimpleFeatSummary) {
            if (!wizState.featData) wizState.featData = {};
            if (!wizState.featData[featName]) wizState.featData[featName] = {};
            descEl.innerHTML = `<div class="v1-origin-feat-name" data-feat="${esc(featName)}">${esc(featName)}</div>`;
            builder(descEl, wizState.featData[featName]);
        } else {
            const desc = feat.description.length > 300 ? feat.description.substring(0, 297) + '...' : feat.description;
            descEl.innerHTML = `<div class="v1-feat-desc-text">${esc(desc)}</div>`;
        }
    }
}

function clearSelectedFeat(level) {
    const selectedEl = document.querySelector(`.v1-asi-feat-selected[data-level="${level}"]`);
    const abilityEl = document.querySelector(`.v1-asi-feat-ability-row[data-level="${level}"]`);
    const descEl = document.querySelector(`.v1-asi-feat-desc[data-level="${level}"]`);
    if (selectedEl) selectedEl.innerHTML = '';
    if (abilityEl) abilityEl.innerHTML = '';
    if (descEl) descEl.innerHTML = '';
    if (wizState.asiChoices?.[level]) {
        wizState.asiChoices[level] = { type: 'feat', feat: '', featAbility: null };
    }
}

function populateProficiencies() {
    const classKey = wizState.className?.toLowerCase();
    const skillOptions = CLASS_SKILL_OPTIONS[classKey] || [];
    const skillCount = CLASS_SKILL_COUNT[classKey] || 2;

    // Background skills display
    const bgSkillsDisplay = document.getElementById('dnd-v1-bg-skills-display');
    const bgSkillsList = document.getElementById('dnd-v1-bg-skills-list');
    if (bgSkillsDisplay && bgSkillsList) {
        const bgSkills = wizState.backgroundSkills || [];
        if (bgSkills.length > 0) {
            bgSkillsDisplay.style.display = '';
            bgSkillsList.textContent = bgSkills.map(s => SKILL_LABELS[s] || s).join(', ');
        } else {
            bgSkillsDisplay.style.display = 'none';
        }
    }

    // Feat-granted skills/tools display (from origin feat config)
    const featSkillsDisplay = document.getElementById('dnd-v1-feat-skills-display');
    const featSkillsList = document.getElementById('dnd-v1-feat-skills-list');
    if (featSkillsDisplay && featSkillsList) {
        const featItems = getOriginFeatGrantedProfs();
        if (featItems.length > 0) {
            featSkillsDisplay.style.display = '';
            featSkillsList.textContent = featItems.map(item => {
                if (item.type === 'skill') return SKILL_LABELS[item.key] || item.key;
                return item.key;
            }).join(', ');
        } else {
            featSkillsDisplay.style.display = 'none';
        }
    }

    // Class skill selection
    const label = document.getElementById('dnd-v1-skill-label');
    if (label) label.textContent = `Class Skills (${(wizState.skillChoices || []).length}/${skillCount}):`;

    const checksContainer = document.getElementById('dnd-v1-skill-checks');
    if (checksContainer) {
        checksContainer.innerHTML = '';
        const bgSkillSet = new Set(wizState.backgroundSkills || []);
        const featSkillSet = new Set(getOriginFeatGrantedProfs().filter(p => p.type === 'skill').map(p => p.key));

        for (const sk of skillOptions) {
            const lbl = document.createElement('label');
            const isSelected = (wizState.skillChoices || []).includes(sk);
            const fromBg = bgSkillSet.has(sk);
            const fromFeat = featSkillSet.has(sk);
            lbl.className = isSelected ? 'selected' : '';
            let suffix = '';
            if (fromBg) suffix = ' (BG)';
            else if (fromFeat) suffix = ' (Feat)';
            lbl.innerHTML = `<input type="checkbox" value="${sk}" ${isSelected ? 'checked' : ''} /> ${SKILL_LABELS[sk] || sk}${suffix}`;
            checksContainer.appendChild(lbl);
        }
    }

    // Tool proficiencies display — combine background tools, feat tools, and class tools
    const toolList = document.getElementById('dnd-v1-tool-list');
    if (toolList) {
        const bgTools = wizState.backgroundTools || [];
        const featTools = getOriginFeatGrantedProfs().filter(p => p.type === 'tool').map(p => p.key);
        const classTools = wizState.toolChoices || [];
        const tools = [...new Set([...bgTools, ...featTools, ...classTools])];
        toolList.textContent = tools.length > 0 ? tools.join(', ') : 'None';
    }

    // Languages
    const langList = document.getElementById('dnd-v1-language-list');
    if (langList) {
        const langs = [...new Set([...(wizState.speciesLanguages || []), ...(wizState.languageChoices || [])])];
        langList.textContent = langs.length > 0 ? langs.join(', ') : 'Common';
    }
}

function getOriginFeatGrantedProfs() {
    const result = [];
    const config = wizState.originFeatConfig || {};

    // Skilled: 3 skills/tools
    if (config.skilledChoices?.length) {
        for (const item of config.skilledChoices) {
            const isSkill = ALL_SKILLS.some(([key]) => key === item);
            result.push({ type: isSkill ? 'skill' : 'tool', key: item });
        }
    }

    return result;
}

async function populateEquipment() {
    // Armor
    const armorCurrent = document.getElementById('dnd-v1-armor-current');
    if (armorCurrent) {
        armorCurrent.textContent = wizState.equippedArmor?.name || 'None';
    }

    const shieldCheck = document.getElementById('dnd-v1-shield-check');
    if (shieldCheck) shieldCheck.checked = !!wizState.hasShield;

    // Weapons list
    const weaponsList = document.getElementById('dnd-v1-weapons-list');
    if (weaponsList) {
        weaponsList.innerHTML = '';
        for (const wpn of (wizState.weapons || [])) {
            const div = document.createElement('div');
            div.className = 'dnd-v1-equip-item';
            div.innerHTML = `<span>${esc(wpn.name)} (${wpn.damageDice} ${wpn.damageType || ''})</span>
                <span class="item-remove" data-weapon="${esc(wpn.name)}">✕</span>`;
            weaponsList.appendChild(div);
        }
    }

    // Items list
    const itemsList = document.getElementById('dnd-v1-items-list');
    if (itemsList) {
        itemsList.innerHTML = '';
        for (const item of (wizState.items || [])) {
            const text = typeof item === 'string' ? item : item.text || '';
            const div = document.createElement('div');
            div.className = 'dnd-v1-equip-item';
            div.innerHTML = `<span>${esc(text)}</span><span class="item-remove" data-item="${esc(text)}">✕</span>`;
            itemsList.appendChild(div);
        }
    }

    updateACPreview();
}

function updateACPreview() {
    const preview = document.getElementById('dnd-v1-ac-preview');
    if (!preview) return;

    const dexMod = getModifier(wizState.baseAbilities?.dex || 10);
    const ac = computeAC(wizState.equippedArmor || null, !!wizState.hasShield, dexMod);
    preview.textContent = `AC: ${ac}`;
}

async function populateSpells() {
    const classKey = wizState.className?.toLowerCase();
    const casterType = CASTER_TYPE[classKey];
    const spellAbility = SPELLCASTING_ABILITY[classKey];
    const noSpells = document.getElementById('dnd-v1-no-spells');
    const content = document.getElementById('dnd-v1-spells-content');

    // Check if this is a spellcaster
    let isSpellcaster = !!(casterType && spellAbility);
    if (casterType === 'third') {
        const validSubs = SPELLCASTING_SUBCLASSES[classKey] || [];
        isSpellcaster = validSubs.some(s => wizState.subclassName?.includes(s));
    }

    // Check if feat grants spells (Magic Initiate etc)
    const cfg = wizState.originFeatConfig || {};
    const hasFeatSpells = (cfg.miCantrips?.length > 0) || !!cfg.miSpell;

    if (!isSpellcaster && !hasFeatSpells) {
        if (noSpells) noSpells.style.display = '';
        if (content) content.style.display = 'none';
        return;
    }

    if (noSpells) noSpells.style.display = 'none';
    if (content) content.style.display = '';

    const level = wizState.level || 1;

    if (isSpellcaster) {
        const slots = getSpellSlots(classKey, level, wizState.subclassName);
        let maxSpellLevel = 0;
        for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i] > 0) { maxSpellLevel = i + 1; break; }
        }

        const cantripsKnown = CANTRIPS_KNOWN[classKey]?.[level - 1] ?? 0;
        const cantripLabel = document.getElementById('dnd-v1-cantrip-count');
        if (cantripLabel) cantripLabel.textContent = `Cantrips (${(wizState.knownCantrips || []).length}/${cantripsKnown}):`;

        const spellCount = document.getElementById('dnd-v1-spell-count');
        if (spellCount) {
            const isPrepared = PREPARED_CASTERS.includes(classKey);
            // Compute effective ability score including racial/background boosts and ASI
            let totalScore = wizState.baseAbilities?.[spellAbility] || 10;
            const boosts = wizState.abilityBoosts || {};
            if (boosts[spellAbility]) totalScore += boosts[spellAbility];
            // Account for ASI ability boosts
            if (wizState.asiChoices) {
                for (const choice of Object.values(wizState.asiChoices)) {
                    if (choice?.type === 'asi' && choice.abilities) {
                        totalScore += choice.abilities[spellAbility] || 0;
                    } else if (choice?.type === 'feat' && choice.featAbility === spellAbility) {
                        totalScore += 1;
                    }
                }
            }
            const abMod = getModifier(totalScore);
            const max = isPrepared
                ? getPreparedCount(classKey, level, abMod)
                : (SPELLS_KNOWN[classKey]?.[level - 1] ?? 0);
            const label = isPrepared ? 'Prepared' : 'Known';
            spellCount.textContent = `${label} (${(wizState.knownSpells || []).length}/${max}):`;
        }
    }

    // Render class spell tags
    renderSpellTags('dnd-v1-cantrip-tags', wizState.knownCantrips || []);
    renderSpellTags('dnd-v1-spell-tags', wizState.knownSpells || []);
    renderSpellTags('dnd-v1-extra-spell-tags', wizState.extraSpells || []);

    // Show feat-granted and level-choice spells
    const featSpellsSection = document.getElementById('dnd-v1-feat-spells-display');
    if (featSpellsSection) {
        const parts = [];

        // Feat spells
        if (hasFeatSpells) {
            const listName = cfg.miClass || '';
            for (const c of (cfg.miCantrips || [])) parts.push(`${c} (cantrip, ${listName})`);
            if (cfg.miSpell) parts.push(`${cfg.miSpell} (1st, ${listName}, 1/LR free)`);
        }

        // Fey/Shadow Touched spells
        if (cfg.ftSpell) {
            parts.push(`Misty Step (2nd, Fey Touched, 1/LR free)`);
            parts.push(`${cfg.ftSpell} (1st, Fey Touched, 1/LR free)`);
        }
        if (cfg.stSpell) {
            parts.push(`Invisibility (2nd, Shadow Touched, 1/LR free)`);
            parts.push(`${cfg.stSpell} (1st, Shadow Touched, 1/LR free)`);
        }

        // Level choice spells (Divine Soul affinity, Druidic Warrior cantrips, etc.)
        const levelChoices = wizState.levelChoices || {};
        for (const [_lv, choices] of Object.entries(levelChoices)) {
            for (const [_fId, data] of Object.entries(choices || {})) {
                if (data?.cantrips?.length) {
                    for (const c of data.cantrips) parts.push(`${c} (cantrip, level feature)`);
                }
            }
        }

        if (parts.length > 0) {
            featSpellsSection.innerHTML = `<div class="dnd-v1-sub-title">Bonus Spells</div><div class="dnd-v1-info-text">${parts.map(p => esc(p)).join(', ')}</div>`;
            featSpellsSection.style.display = '';
        } else {
            featSpellsSection.style.display = 'none';
        }
    }
}

function renderSpellTags(containerId, spells) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Map container IDs to wizState keys
    const keyMap = {
        'dnd-v1-cantrip-tags': 'knownCantrips',
        'dnd-v1-spell-tags': 'knownSpells',
        'dnd-v1-extra-spell-tags': 'extraSpells',
    };
    const stateKey = keyMap[containerId];

    for (const name of spells) {
        const tag = document.createElement('span');
        tag.className = 'dnd-v1-spell-tag';
        tag.innerHTML = `${esc(name)} <span class="tag-remove" data-spell="${esc(name)}">\u2715</span>`;

        tag.querySelector('.tag-remove').onclick = (e) => {
            e.stopPropagation();
            if (stateKey && wizState[stateKey]) {
                wizState[stateKey] = wizState[stateKey].filter(s => s !== name);
                populateSpells();
            }
        };

        container.appendChild(tag);
    }
}

/**
 * Collect current wizard state from form inputs.
 */
function collectFromStep(step) {
    switch (step) {
        case 'identity': {
            wizState.name = document.getElementById('dnd-v1-name')?.value || '';
            break;
        }
        case 'species': {
            const val = document.getElementById('dnd-v1-species')?.value || '';
            if (val) {
                const [name, source] = val.split('|');
                const sp = speciesList.find(s => s.name === name && s.source === source);
                if (sp) {
                    wizState.speciesName = sp.name;
                    wizState.speciesSource = sp.source;
                    wizState.speciesTraits = sp.traits || [];
                    wizState.speciesSpeed = sp.speed;
                    wizState.speciesSize = sp.size;
                    wizState.speciesDarkvision = sp.darkvision;
                    wizState.speciesResistances = sp.resistances || [];
                    wizState.speciesLanguages = sp.languages || [];
                    wizState.speciesCreatureType = sp.creatureType;
                }
            }
            break;
        }
        case 'background': {
            const bgName = document.getElementById('dnd-v1-background')?.value || '';
            const bg = backgroundList.find(b => b.name === bgName);
            if (bg) {
                wizState.backgroundName = bg.name;
                wizState.backgroundSource = bg.source;
                wizState.originFeat = bg.originFeat || '';
                wizState.backgroundSkills = bg.skills || [];
                wizState.backgroundTools = bg.tools || [];

                const boostMode = document.getElementById('dnd-v1-bg-boost-mode')?.value || 'twoone';
                if (boostMode === 'threeone') {
                    // Already set by buildBoostControls renderPickers
                } else {
                    const boost2 = document.getElementById('dnd-v1-bg-boost-2')?.value || '';
                    const boost1 = document.getElementById('dnd-v1-bg-boost-1')?.value || '';
                    wizState.backgroundAbilityBoosts = {};
                    if (boost2) wizState.backgroundAbilityBoosts[boost2] = 2;
                    if (boost1 && boost1 !== boost2) wizState.backgroundAbilityBoosts[boost1] = 1;
                }
                // originFeatConfig is maintained by the config builder directly
            }
            break;
        }
        case 'class': {
            const classVal = document.getElementById('dnd-v1-class')?.value || '';
            if (classVal) {
                const [name, source, filename] = classVal.split('|');
                wizState.className = name;
                wizState.classSource = source;
                wizState.classFile = filename;

                if (classDataCache) {
                    wizState.saveProficiencies = classDataCache.saveProficiencies;
                    wizState.armorProficiencies = classDataCache.armorProficiencies;
                    wizState.weaponProficiencies = classDataCache.weaponProficiencies;
                }
            }
            const subVal = document.getElementById('dnd-v1-subclass')?.value || '';
            if (subVal) {
                const [sName, sShort, sSource] = subVal.split('|');
                wizState.subclassName = sName;
                wizState.subclassShortName = sShort;
                wizState.subclassSource = sSource;
            } else {
                wizState.subclassName = null;
                wizState.subclassShortName = null;
                wizState.subclassSource = null;
            }
            wizState.level = parseInt(document.getElementById('dnd-v1-level')?.value) || 1;
            break;
        }
        case 'abilities': {
            wizState.abilityMethod = document.getElementById('dnd-v1-ability-method')?.value || 'standard_array';
            // Point buy values are already live-updated in wizState.baseAbilities
            // For standard_array and manual, read from inputs
            if (wizState.abilityMethod !== 'point_buy') {
                const base = { ...wizState.baseAbilities || {} };
                const inputs = document.querySelectorAll('.v1-ab-select, .v1-ab-input');
                inputs.forEach(inp => {
                    const ab = inp.dataset.ability;
                    if (ab) base[ab] = parseInt(inp.value) || 10;
                });
                wizState.baseAbilities = base;
            }
            break;
        }
        case 'asi': {
            const level = wizState.level || 1;
            const choices = { ...(wizState.asiChoices || {}) };
            for (const lv of ASI_LEVELS.filter(l => l <= level)) {
                const toggle = document.querySelector(`.v1-asi-feat-toggle[data-level="${lv}"]`);
                const isFeat = toggle?.checked || false;

                if (!isFeat) {
                    const ab1 = document.querySelector(`.v1-asi-ab1[data-level="${lv}"]`)?.value || '';
                    const ab2 = document.querySelector(`.v1-asi-ab2[data-level="${lv}"]`)?.value || '';
                    choices[lv] = { type: 'asi', abilities: [ab1, ab2].filter(Boolean) };
                } else {
                    const existing = choices[lv];
                    const featName = existing?.feat || '';
                    const featAb = document.querySelector(`.v1-asi-feat-ability[data-level="${lv}"]`)?.value || existing?.featAbility || '';
                    const featConfig = wizState.featData?.[featName] || null;
                    choices[lv] = { type: 'feat', feat: featName, featAbility: featAb || null, featConfig };
                }
            }
            wizState.asiChoices = choices;

            // Collect level feature selections (fighting style, subclass choices, etc.)
            const levelFeatureSelects = document.querySelectorAll('.v1-level-feature-select');
            if (!wizState.levelChoices) wizState.levelChoices = {};
            for (const sel of levelFeatureSelects) {
                const featLv = sel.dataset.level;
                const featId = sel.dataset.featureId;
                if (!featLv || !featId) continue;
                if (!wizState.levelChoices[featLv]) wizState.levelChoices[featLv] = {};
                const existing = wizState.levelChoices[featLv][featId] || {};
                wizState.levelChoices[featLv][featId] = { ...existing, selected: sel.value || null };
            }
            break;
        }
        case 'proficiencies': {
            const checks = document.querySelectorAll('#dnd-v1-skill-checks input[type="checkbox"]:checked');
            wizState.skillChoices = Array.from(checks).map(c => c.value);
            break;
        }
    }
}

function updateStatsPreview() {
    const preview = document.getElementById('dnd-v1-preview-content');
    if (!preview) return;

    if (!wizState.className) {
        preview.textContent = 'Select a class to see stats preview';
        return;
    }

    try {
        const tempChar = createCharacter(wizState);
        const stats = computeCharacterStats(tempChar);
        if (!stats) { preview.textContent = '—'; return; }

        const lines = [
            `HP: ${stats.hp} | AC: ${stats.ac} | Speed: ${stats.speed}ft`,
            `Prof: +${stats.proficiency}`,
            ABILITY_KEYS.map(ab => `${ABILITY_LABELS[ab]}:${stats.abilities[ab]}(${stats.mods[ab] >= 0 ? '+' : ''}${stats.mods[ab]})`).join(' '),
        ];
        if (stats.spellcasting) {
            lines.push(`Spell Atk: +${stats.spellcasting.attackMod} | DC: ${stats.spellcasting.saveDC}`);
        }
        preview.innerHTML = lines.join('<br/>');
    } catch {
        preview.textContent = '—';
    }
}

/**
 * Save the character from the wizard state.
 */
function saveFromWizard() {
    // Collect from current step
    collectFromStep(STEPS[currentStep]);

    if (!wizState.className) {
        showError('Please select a class');
        return;
    }

    const editId = document.getElementById('dnd-v1-config-id')?.value || null;
    if (editId) wizState.editId = editId;

    const char = createCharacter(wizState);
    setCharacterV1(char);
    saveCharacterV1(char);
    renderV1CharacterPanel();
    renderV1Spellbook();
    closeV1ConfigModal();
}

function showError(msg) {
    const el = document.getElementById('dnd-v1-config-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = '';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/**
 * Bind event handlers for wizard navigation and step interactions.
 */
function bindWizardEvents() {
    // Step navigation buttons
    document.querySelectorAll('.dnd-v1-step-btn').forEach((btn, i) => {
        btn.onclick = () => {
            collectFromStep(STEPS[currentStep]);
            showStep(i);
        };
    });

    const nextBtn = document.getElementById('dnd-v1-config-next');
    if (nextBtn) nextBtn.onclick = () => {
        collectFromStep(STEPS[currentStep]);
        if (currentStep < STEPS.length - 1) showStep(currentStep + 1);
    };

    const prevBtn = document.getElementById('dnd-v1-config-prev');
    if (prevBtn) prevBtn.onclick = () => {
        collectFromStep(STEPS[currentStep]);
        if (currentStep > 0) showStep(currentStep - 1);
    };

    const saveBtn = document.getElementById('dnd-v1-config-save');
    if (saveBtn) saveBtn.onclick = saveFromWizard;

    const cancelBtn = document.getElementById('dnd-v1-config-cancel');
    if (cancelBtn) cancelBtn.onclick = closeV1ConfigModal;

    const closeBtn = document.getElementById('dnd-v1-config-close');
    if (closeBtn) closeBtn.onclick = closeV1ConfigModal;

    // Species change
    const speciesSelect = document.getElementById('dnd-v1-species');
    if (speciesSelect) speciesSelect.onchange = updateSpeciesPreview;

    // Background change
    const bgSelect = document.getElementById('dnd-v1-background');
    if (bgSelect) bgSelect.onchange = updateBackgroundPreview;

    // Class change
    const classSelect = document.getElementById('dnd-v1-class');
    if (classSelect) classSelect.onchange = () => updateClassSubclasses();

    // Ability method change
    const methodSelect = document.getElementById('dnd-v1-ability-method');
    if (methodSelect) methodSelect.onchange = () => {
        wizState.abilityMethod = methodSelect.value;
        // Reset base abilities when switching methods
        wizState.baseAbilities = null;
        populateAbilities();
    };

    // Shield checkbox
    const shieldCheck = document.getElementById('dnd-v1-shield-check');
    if (shieldCheck) shieldCheck.onchange = () => {
        wizState.hasShield = shieldCheck.checked;
        updateACPreview();
    };

    // Armor search (with magic toggle)
    const armorSearch = document.getElementById('dnd-v1-armor-search');
    const magicArmorCheck = document.getElementById('dnd-v1-magic-armor-check');
    if (armorSearch) armorSearch.oninput = async () => {
        const results = document.getElementById('dnd-v1-armor-results');
        const query = armorSearch.value.toLowerCase().trim();
        if (!query || query.length < 2) { results.classList.remove('open'); return; }

        const useMagic = magicArmorCheck?.checked || false;
        const matches = await searchEquipment(query, 'armor', useMagic);

        results.innerHTML = matches.map(a => {
            const magicTag = a._magic ? ' <span class="v1-magic-tag">\u2726</span>' : '';
            const totalAc = a.ac + (a.bonusAc || 0);
            return `<div class="dropdown-item" data-armor='${JSON.stringify(a).replace(/'/g, '&#39;')}'>${esc(a.name)}${magicTag} (AC ${totalAc}, ${a.type})</div>`;
        }).join('');
        results.classList.add('open');

        results.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = () => {
                wizState.equippedArmor = JSON.parse(item.dataset.armor);
                document.getElementById('dnd-v1-armor-current').textContent = wizState.equippedArmor.name;
                results.classList.remove('open');
                armorSearch.value = '';
                updateACPreview();
            };
        });
    };

    // Armor clear
    const armorClear = document.getElementById('dnd-v1-armor-clear');
    if (armorClear) armorClear.onclick = () => {
        wizState.equippedArmor = null;
        document.getElementById('dnd-v1-armor-current').textContent = 'None';
        updateACPreview();
    };

    // Weapon search (with magic toggle)
    const weaponSearch = document.getElementById('dnd-v1-weapon-search');
    const magicWeaponCheck = document.getElementById('dnd-v1-magic-weapon-check');
    if (weaponSearch) weaponSearch.oninput = async () => {
        const results = document.getElementById('dnd-v1-weapon-results');
        const query = weaponSearch.value.toLowerCase().trim();
        if (!query || query.length < 2) { results.classList.remove('open'); return; }

        const useMagic = magicWeaponCheck?.checked || false;
        const matches = await searchEquipment(query, 'weapon', useMagic);

        results.innerHTML = matches.map(w => {
            const magicTag = w._magic ? ' <span class="v1-magic-tag">\u2726</span>' : '';
            const bonusStr = w.bonus ? ` (+${w.bonus})` : '';
            return `<div class="dropdown-item" data-weapon='${JSON.stringify(w).replace(/'/g, '&#39;')}'>${esc(w.name)}${magicTag} (${w.damageDice}${bonusStr} ${w.damageType || ''})</div>`;
        }).join('');
        results.classList.add('open');

        results.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = () => {
                const wpn = JSON.parse(item.dataset.weapon);
                if (!wizState.weapons) wizState.weapons = [];
                wizState.weapons.push(wpn);
                results.classList.remove('open');
                weaponSearch.value = '';
                populateEquipment();
            };
        });
    };

    // Item add
    const itemAdd = document.getElementById('dnd-v1-item-add');
    const itemInput = document.getElementById('dnd-v1-item-input');
    if (itemAdd && itemInput) {
        itemAdd.onclick = () => {
            const text = itemInput.value.trim();
            if (!text) return;
            if (!wizState.items) wizState.items = [];
            wizState.items.push(text);
            itemInput.value = '';
            populateEquipment();
        };
    }

    // Spell search bindings
    bindSpellSearch('dnd-v1-cantrip-search', 'dnd-v1-cantrip-dropdown', 'knownCantrips', true);
    bindSpellSearch('dnd-v1-spell-search', 'dnd-v1-spell-dropdown', 'knownSpells', false);
    bindSpellSearch('dnd-v1-extra-spell-search', 'dnd-v1-extra-spell-dropdown', 'extraSpells', false, true);
}

function bindSpellSearch(inputId, dropdownId, stateKey, cantripOnly, allSpells = false) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.oninput = async () => {
        const query = input.value.toLowerCase().trim();
        if (!query || query.length < 2) { dropdown.classList.remove('open'); return; }

        const classKey = wizState.className?.toLowerCase();
        const level = wizState.level || 1;
        let spells;

        if (allSpells) {
            const allData = await preloadSpellData();
            spells = allData || [];
        } else if (cantripOnly) {
            spells = await getClassCantrips(classKey);
            // Merge subclass extra spell lists (e.g. Divine Soul → Cleric cantrips)
            const extraLists = getExtraSpellLists(classKey, wizState.subclassName);
            for (const extraKey of extraLists) {
                const extra = await getClassCantrips(extraKey);
                spells = mergeSpellArrays(spells, extra);
            }
        } else {
            const slots = getSpellSlots(classKey, level, wizState.subclassName);
            let maxLv = 0;
            for (let i = slots.length - 1; i >= 0; i--) { if (slots[i] > 0) { maxLv = i + 1; break; } }
            spells = await getClassSpells(classKey, maxLv);
            // Merge subclass extra spell lists (e.g. Divine Soul → Cleric spells)
            const extraLists = getExtraSpellLists(classKey, wizState.subclassName);
            for (const extraKey of extraLists) {
                const extra = await getClassSpells(extraKey, maxLv);
                spells = mergeSpellArrays(spells, extra);
            }
            spells = spells.filter(s => s.level > 0);
        }

        const matches = spells.filter(s => s.name.toLowerCase().includes(query)).slice(0, 15);
        const existing = wizState[stateKey] || [];

        dropdown.innerHTML = matches
            .filter(s => !existing.includes(s.name))
            .map(s => `<div class="dropdown-item" data-spell="${esc(s.name)}">
                ${esc(s.name)} <span class="item-level">Lv${s.level}</span>
            </div>`).join('');
        dropdown.classList.add('open');

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = () => {
                if (!wizState[stateKey]) wizState[stateKey] = [];
                wizState[stateKey].push(item.dataset.spell);
                dropdown.classList.remove('open');
                input.value = '';
                populateSpells();
            };
        });
    };
}

function getExtraSpellLists(classKey, subclassName) {
    if (!classKey || !subclassName) return [];
    for (const [key, lists] of Object.entries(SUBCLASS_EXTRA_SPELL_LISTS)) {
        const [cls, sub] = key.split('|');
        if (cls === classKey && subclassName.includes(sub)) return lists;
    }
    return [];
}

function mergeSpellArrays(base, extra) {
    const seen = new Set(base.map(s => s.name.toLowerCase()));
    const merged = [...base];
    for (const s of extra) {
        if (!seen.has(s.name.toLowerCase())) {
            seen.add(s.name.toLowerCase());
            merged.push(s);
        }
    }
    return merged;
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Also bind the "get class cantrips" as a named export for the spell preload
export { getClassCantrips };
