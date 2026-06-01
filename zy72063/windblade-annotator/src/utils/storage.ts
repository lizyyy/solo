import type { CrackRecord, Scheme, CameraState } from '../types';

const STORAGE_KEYS = {
  RECORDS: 'windblade_records',
  SCHEMES: 'windblade_schemes',
  CAMERA_STATE: 'windblade_camera',
  UI_STATE: 'windblade_ui',
  ACTIVE_SCHEME: 'windblade_active_scheme'
};

export const saveRecords = (records: CrackRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records:', e);
  }
};

export const loadRecords = (): CrackRecord[] | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load records:', e);
    return null;
  }
};

export const saveSchemes = (schemes: Scheme[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SCHEMES, JSON.stringify(schemes));
  } catch (e) {
    console.error('Failed to save schemes:', e);
  }
};

export const loadSchemes = (): Scheme[] | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEMES);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load schemes:', e);
    return null;
  }
};

export const saveCameraState = (state: CameraState): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CAMERA_STATE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save camera state:', e);
  }
};

export const loadCameraState = (): CameraState | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CAMERA_STATE);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load camera state:', e);
    return null;
  }
};

export const saveUIState = (state: {
  showCompleted: boolean;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  selectedRecordId: string | null;
}): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.UI_STATE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save UI state:', e);
  }
};

export const loadUIState = (): {
  showCompleted: boolean;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  selectedRecordId: string | null;
} | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UI_STATE);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load UI state:', e);
    return null;
  }
};

export const saveActiveScheme = (schemeId: string | null): void => {
  try {
    if (schemeId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SCHEME, schemeId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SCHEME);
    }
  } catch (e) {
    console.error('Failed to save active scheme:', e);
  }
};

export const loadActiveScheme = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SCHEME);
  } catch (e) {
    console.error('Failed to load active scheme:', e);
    return null;
  }
};

export const clearAllStorage = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};
