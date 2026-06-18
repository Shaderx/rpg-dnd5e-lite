/**
 * V1 Character System - State
 * Runtime state for the V1 character builder.
 */

// The active V1 character for the current chat (loaded from chat_metadata).
export let characterV1 = null;
export function setCharacterV1(val) { characterV1 = val; }

// CDN data caches (not persisted — refetched on demand)
export const speciesCache = new Map();
export const backgroundCache = new Map();
export const v1ClassDataCache = new Map();
export const v1SpellCache = new Map();
export const v1FeatCache = [];
export let v1SpellClassLookup = null;
export function setV1SpellClassLookup(val) { v1SpellClassLookup = val; }
export let v1EquipmentCache = null;
export function setV1EquipmentCache(val) { v1EquipmentCache = val; }
export let v1OptionalFeaturesCache = null;
export function setV1OptionalFeaturesCache(val) { v1OptionalFeaturesCache = val; }
