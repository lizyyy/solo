const STORAGE_KEY = 'trail_elevation_guide_state';

const defaultState = {
  currentTrail: null,
  weather: 'sunny',
  view: 'overview',
  progress: 0,
  filters: {
    supply: true,
    risk: true,
    elevation: true,
    riskLevel: 'all'
  }
};

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const age = Date.now() - (parsed.savedAt || 0);
      if (age < 24 * 60 * 60 * 1000) {
        delete parsed.savedAt;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
  return { ...defaultState };
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear state:', e);
  }
}

export function getDefaultState() {
  return { ...defaultState };
}
