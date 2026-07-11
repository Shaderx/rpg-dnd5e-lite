/**
 * V1 Character System - Class Data
 * Fetch and parse class/subclass data from CDN for the V1 character builder.
 */

import { fetchClassIndex, fetchClassFile, fetchOptionalFeatures, getCachedClassFile } from '../data/sources.js';
import { V1_SOURCES, CLASS_SAVE_PROFICIENCIES, CLASS_SKILL_OPTIONS, CLASS_SKILL_COUNT, CLASS_ARMOR_PROFICIENCY, CLASS_WEAPON_PROFICIENCY, HIT_DICE, SPELLCASTING_ABILITY, CASTER_TYPE } from '../core/constants.js';
import { CLASS_LEVEL_FEATURES, SUBCLASS_LEVEL_FEATURES } from './levelFeatures.js';

/**
 * List all available classes with metadata.
 * The class index maps display name -> filename, e.g. { "Barbarian": "class-barbarian.json" }.
 * @returns {Promise<object[]>} Array of { name, source, filename, key }
 */
export async function listAvailableClasses() {
    const index = await fetchClassIndex();
    if (!index) {
        console.warn('[D&D V1] Class index fetch returned null');
        return [];
    }

    // Fetch all class files in parallel for speed
    const entries = Object.entries(index);
    const fetches = entries.map(([_, filename]) => fetchClassFile(filename));
    const dataResults = await Promise.all(fetches);

    const results = [];
    for (let i = 0; i < entries.length; i++) {
        const [, filename] = entries[i];
        const data = dataResults[i];
        if (!data?.class) {
            console.warn(`[D&D V1] No class data in file: ${filename}`);
            continue;
        }
        for (const cls of data.class) {
            if (!V1_SOURCES.includes(cls.source)) continue;
            results.push({
                name: cls.name,
                source: cls.source,
                filename,
                key: cls.name.toLowerCase(),
            });
        }
    }
    console.log(`[D&D V1] Loaded ${results.length} classes from ${entries.length} files`);
    return results;
}

/**
 * Get full class data including features and subclasses.
 * @param {string} filename - CDN filename (e.g. 'class-wizard.json')
 * @param {string} className - Class name to find
 * @param {string} classSource - Source code (e.g. 'XPHB')
 * @returns {Promise<object|null>} Parsed class data
 */
export async function getClassData(filename, className, classSource) {
    const data = await fetchClassFile(filename);
    if (!data?.class) return null;

    const cls = data.class.find(c => c.name === className && c.source === classSource);
    if (!cls) return null;

    const key = className.toLowerCase();
    // Filter subclasses by className, classSource (prevents XGE dupes for PHB vs XPHB),
    // and V1_SOURCES for the subclass's own source
    const seen = new Set();
    const subclasses = (data.subclass || [])
        .filter(sc => {
            if (sc.className !== className) return false;
            if (!V1_SOURCES.includes(sc.source)) return false;
            if (sc.classSource && sc.classSource !== classSource) return false;
            const dedupeKey = `${sc.name}|${sc.source}`;
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        })
        .map(sc => parseSubclass(sc));

    const features = extractClassFeatures(data.classFeature || [], className, classSource);
    const subclassFeaturePool = data.subclassFeature || [];

    return {
        name: cls.name,
        source: cls.source,
        key,
        hitDie: HIT_DICE[key] || 8,
        saveProficiencies: CLASS_SAVE_PROFICIENCIES[key] || [],
        skillOptions: CLASS_SKILL_OPTIONS[key] || [],
        skillCount: CLASS_SKILL_COUNT[key] || 2,
        armorProficiencies: CLASS_ARMOR_PROFICIENCY[key] || [],
        weaponProficiencies: CLASS_WEAPON_PROFICIENCY[key] || [],
        spellcastingAbility: SPELLCASTING_ABILITY[key] || null,
        casterType: CASTER_TYPE[key] || null,
        subclasses,
        features,
        subclassFeaturePool,
        classTableGroups: cls.classTableGroups || [],
        _raw: cls,
    };
}

/**
 * Parse a subclass entry.
 */
function parseSubclass(sc) {
    return {
        name: sc.name,
        shortName: sc.shortName || sc.name,
        source: sc.source,
        _raw: sc,
    };
}

/**
 * Extract and organize class features by level.
 * @returns {object} Map of level -> feature[]
 */
function extractClassFeatures(classFeatures, className, classSource) {
    const byLevel = {};

    for (const feat of classFeatures) {
        if (feat.className !== className) continue;
        if (feat.classSource !== classSource && feat.classSource) continue;

        const level = feat.level || 1;
        if (!byLevel[level]) byLevel[level] = [];

        const parsed = parseFeatureEntry(feat);
        if (parsed) byLevel[level].push(parsed);
    }

    return byLevel;
}

/**
 * Parse a single feature entry into a clean object.
 */
function parseFeatureEntry(feat) {
    if (!feat || !feat.name) return null;

    const description = flattenEntriesToMechanical(feat.entries || []);

    return {
        name: feat.name,
        source: feat.source,
        level: feat.level,
        description,
        isOptional: !!feat.isClassFeatureVariant,
        _raw: feat,
    };
}

/**
 * Flatten entries to mechanical-focused text, stripping flavor.
 * Keeps tables, lists, and key mechanical descriptions.
 */
function flattenEntriesToMechanical(entries) {
    if (!entries) return '';
    const parts = [];

    for (const entry of entries) {
        if (typeof entry === 'string') {
            parts.push(stripTags(entry));
        } else if (typeof entry === 'object') {
            if (entry.type === 'entries' && entry.entries) {
                const sub = flattenEntriesToMechanical(entry.entries);
                if (entry.name) {
                    parts.push(`${entry.name}: ${sub}`);
                } else {
                    parts.push(sub);
                }
            } else if (entry.type === 'list' && entry.items) {
                for (const item of entry.items) {
                    if (typeof item === 'string') parts.push('- ' + stripTags(item));
                    else if (item.name && item.entries) {
                        parts.push(`- ${item.name}: ${flattenEntriesToMechanical(item.entries)}`);
                    } else if (item.entry) {
                        parts.push('- ' + stripTags(item.entry));
                    }
                }
            } else if (entry.type === 'table') {
                // Skip tables in mechanical summary (too verbose)
            } else if (entry.type === 'options' && entry.entries) {
                parts.push(flattenEntriesToMechanical(entry.entries));
            } else if (entry.entries) {
                parts.push(flattenEntriesToMechanical(entry.entries));
            }
        }
    }

    return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Strip 5e.tools {@tag ...} markup to plain text.
 */
function stripTags(str) {
    if (!str) return '';
    return str
        .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
        .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

/**
 * Get features for a specific subclass at all levels up to the given level.
 * @returns {object[]} Array of feature objects
 */
export function getSubclassFeatures(classData, subclassName, maxLevel) {
    if (!classData?.subclasses) return [];

    const sc = classData.subclasses.find(s => s.name === subclassName || s.shortName === subclassName);
    if (!sc) return [];

    const pool = classData.subclassFeaturePool || [];
    const features = [];
    for (const feat of pool) {
        if (!feat?.name || !feat.level) continue;
        if (feat.level > maxLevel) continue;
        if (feat.subclassShortName !== sc.shortName && feat.subclassShortName !== sc.name) continue;
        if (sc.source && feat.subclassSource && feat.subclassSource !== sc.source) continue;
        const parsed = parseFeatureEntry(feat);
        if (parsed) features.push(parsed);
    }
    return features;
}

/**
 * Get all class + subclass features up to a given level, merged in order.
 */
export function getAllFeaturesUpToLevel(classData, subclassName, level) {
    const results = [];

    for (let lv = 1; lv <= level; lv++) {
        const classFeats = classData.features[lv] || [];
        results.push(...classFeats.map(f => ({ ...f, level: lv, featureSource: 'class' })));
    }

    if (subclassName) {
        const scFeats = getSubclassFeatures(classData, subclassName, level);
        results.push(...scFeats.map(f => ({ ...f, featureSource: 'subclass' })));
    }

    results.sort((a, b) => (a.level || 0) - (b.level || 0));
    return results;
}

const CDN_SKIP_EXACT = new Set([
    'Spellcasting',
    'Pact Magic',
]);

const CDN_SKIP_PATTERNS = [
    /^Ability Score Improvement/i,
    /^Epic Boon/i,
    /Subclass$/i,
    /^Subclass Feature/i,
    /^Metamagic/i,
    /\(Cost: \d+d\d+\)/,
];

function collectChoiceLabels(classKey, subclassName, maxLevel) {
    const labels = new Set();
    for (const feat of CLASS_LEVEL_FEATURES[classKey] || []) {
        if (feat.level <= maxLevel) labels.add(feat.label);
    }
    if (subclassName) {
        const subKey = `${classKey}|${subclassName}`;
        for (const feat of SUBCLASS_LEVEL_FEATURES[subKey] || []) {
            if (feat.level <= maxLevel) labels.add(feat.label);
        }
    }
    return labels;
}

function matchesChoiceLabel(featureName, choiceLabels) {
    const name = featureName.toLowerCase();
    for (const label of choiceLabels) {
        const l = label.toLowerCase();
        if (name === l || name.includes(l) || l.includes(name)) return true;
    }
    return false;
}

function shouldSkipCdnFeature(feat, choiceLabels) {
    if (feat.isOptional) return true;
    if (CDN_SKIP_EXACT.has(feat.name)) return true;
    if (CDN_SKIP_PATTERNS.some(p => p.test(feat.name))) return true;
    if (matchesChoiceLabel(feat.name, choiceLabels)) return true;
    return false;
}

function buildClassDataFromCache(data, className, classSource) {
    const seen = new Set();
    const subclasses = (data.subclass || [])
        .filter(sc => {
            if (sc.className !== className) return false;
            if (!V1_SOURCES.includes(sc.source)) return false;
            if (sc.classSource && sc.classSource !== classSource) return false;
            const dedupeKey = `${sc.name}|${sc.source}`;
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        })
        .map(sc => parseSubclass(sc));

    const features = extractClassFeatures(data.classFeature || [], className, classSource);
    const subclassFeaturePool = data.subclassFeature || [];
    return { features, subclasses, subclassFeaturePool };
}

/**
 * Resolve automatic class/subclass features from the CDN cache (sync).
 * Skips choice-based or redundant entries already shown elsewhere.
 */
export function getResolvedClassFeaturesSync(classFile, className, classSource, subclassName, level) {
    const data = getCachedClassFile(classFile);
    if (!data || !className || !level) return [];

    const classKey = className.toLowerCase();
    const choiceLabels = collectChoiceLabels(classKey, subclassName, level);
    const classData = buildClassDataFromCache(data, className, classSource);
    const all = getAllFeaturesUpToLevel(classData, subclassName, level);

    return all
        .filter(feat => !shouldSkipCdnFeature(feat, choiceLabels))
        .sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
}

/**
 * Resolve optional feature references (metamagic, invocations, etc.)
 * from the CDN optionalfeatures endpoint.
 */
export async function resolveOptionalFeature(featureName) {
    const feats = await fetchOptionalFeatures();
    if (!feats) return null;
    return feats.find(f => f.name === featureName) || null;
}
