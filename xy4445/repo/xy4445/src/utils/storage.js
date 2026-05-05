const STORAGE_KEYS = {
  HIVES: 'beehive_inspector_hives',
  SENSOR_DATA: 'beehive_inspector_sensor_data',
  INSPECTION_RECORDS: 'beehive_inspector_inspection_records',
  WATERING_SCHEDULES: 'beehive_inspector_watering_schedules',
  REVIEW_NOTES: 'beehive_inspector_review_notes',
  LAST_UPDATE: 'beehive_inspector_last_update'
};

export const saveToStorage = (key, data) => {
  try {
    const jsonData = JSON.stringify(data);
    localStorage.setItem(key, jsonData);
    updateLastUpdate();
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
};

export const loadFromStorage = (key) => {
  try {
    const jsonData = localStorage.getItem(key);
    if (jsonData) {
      return JSON.parse(jsonData);
    }
    return null;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
};

export const clearAllStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
};

const updateLastUpdate = () => {
  const now = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, now);
};

export const getLastUpdateTime = () => {
  return localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
};

export const saveHives = (hives) => {
  return saveToStorage(STORAGE_KEYS.HIVES, hives);
};

export const loadHives = () => {
  return loadFromStorage(STORAGE_KEYS.HIVES) || [];
};

export const saveSensorData = (sensorData) => {
  return saveToStorage(STORAGE_KEYS.SENSOR_DATA, sensorData);
};

export const loadSensorData = () => {
  return loadFromStorage(STORAGE_KEYS.SENSOR_DATA) || [];
};

export const saveInspectionRecords = (inspectionRecords) => {
  return saveToStorage(STORAGE_KEYS.INSPECTION_RECORDS, inspectionRecords);
};

export const loadInspectionRecords = () => {
  return loadFromStorage(STORAGE_KEYS.INSPECTION_RECORDS) || [];
};

export const saveWateringSchedules = (wateringSchedules) => {
  return saveToStorage(STORAGE_KEYS.WATERING_SCHEDULES, wateringSchedules);
};

export const loadWateringSchedules = () => {
  return loadFromStorage(STORAGE_KEYS.WATERING_SCHEDULES) || [];
};

export const saveReviewNotes = (reviewNotes) => {
  return saveToStorage(STORAGE_KEYS.REVIEW_NOTES, reviewNotes);
};

export const loadReviewNotes = () => {
  return loadFromStorage(STORAGE_KEYS.REVIEW_NOTES) || {};
};

export const saveReviewNoteForHive = (hiveId, note) => {
  const reviewNotes = loadReviewNotes();
  reviewNotes[hiveId] = {
    ...reviewNotes[hiveId],
    ...note,
    updatedAt: new Date().toISOString()
  };
  return saveReviewNotes(reviewNotes);
};

export const getReviewNoteForHive = (hiveId) => {
  const reviewNotes = loadReviewNotes();
  return reviewNotes[hiveId] || null;
};
