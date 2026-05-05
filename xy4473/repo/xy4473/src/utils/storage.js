const STORAGE_KEYS = {
  COMPONENTS: 'bridge_inspection_components',
  INSPECTIONS: 'bridge_inspection_inspections',
  ALARMS: 'bridge_inspection_alarms',
  CLOSURES: 'bridge_inspection_closures',
  USER_OVERRIDES: 'bridge_inspection_overrides',
  USER_NOTES: 'bridge_inspection_notes',
  BRIDGE_NAME: 'bridge_inspection_name',
};

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save to storage:', error);
    return false;
  }
}

export function loadFromStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('Failed to load from storage:', error);
    return defaultValue;
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to remove from storage:', error);
    return false;
  }
}

export function saveAllData({
  components,
  inspections,
  alarms,
  closures,
  userOverrides,
  userNotes,
  bridgeName,
}) {
  saveToStorage(STORAGE_KEYS.COMPONENTS, components);
  saveToStorage(STORAGE_KEYS.INSPECTIONS, inspections);
  saveToStorage(STORAGE_KEYS.ALARMS, alarms);
  saveToStorage(STORAGE_KEYS.CLOSURES, closures);
  saveToStorage(STORAGE_KEYS.USER_OVERRIDES, userOverrides);
  saveToStorage(STORAGE_KEYS.USER_NOTES, userNotes);
  if (bridgeName) {
    saveToStorage(STORAGE_KEYS.BRIDGE_NAME, bridgeName);
  }
}

export function loadAllData() {
  return {
    components: loadFromStorage(STORAGE_KEYS.COMPONENTS, []),
    inspections: loadFromStorage(STORAGE_KEYS.INSPECTIONS, []),
    alarms: loadFromStorage(STORAGE_KEYS.ALARMS, []),
    closures: loadFromStorage(STORAGE_KEYS.CLOSURES, []),
    userOverrides: loadFromStorage(STORAGE_KEYS.USER_OVERRIDES, {}),
    userNotes: loadFromStorage(STORAGE_KEYS.USER_NOTES, {}),
    bridgeName: loadFromStorage(STORAGE_KEYS.BRIDGE_NAME, ''),
  };
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach((key) => removeFromStorage(key));
}

export { STORAGE_KEYS };
