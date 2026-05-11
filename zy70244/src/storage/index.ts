import { AppState, Content, HistoryRecord, PriorityRule, Schedule, Screen, DEFAULT_PRIORITY_RULES } from '../types';

const STORAGE_KEYS = {
  SCREENS: 'mall_screens',
  CONTENTS: 'mall_contents',
  SCHEDULES: 'mall_schedules',
  HISTORY: 'mall_history',
  APP_STATE: 'mall_app_state',
  PRIORITY_RULES: 'mall_priority_rules',
};

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const screenStorage = {
  getAll: (): Screen[] => getFromStorage<Screen[]>(STORAGE_KEYS.SCREENS, []),
  save: (screens: Screen[]): void => setToStorage(STORAGE_KEYS.SCREENS, screens),
  getById: (id: string): Screen | undefined => screenStorage.getAll().find(s => s.id === id),
  getByCode: (code: string): Screen | undefined => screenStorage.getAll().find(s => s.code === code),
};

export const contentStorage = {
  getAll: (): Content[] => getFromStorage<Content[]>(STORAGE_KEYS.CONTENTS, []),
  save: (contents: Content[]): void => setToStorage(STORAGE_KEYS.CONTENTS, contents),
  getById: (id: string): Content | undefined => contentStorage.getAll().find(c => c.id === id),
};

export const scheduleStorage = {
  getAll: (): Schedule[] => getFromStorage<Schedule[]>(STORAGE_KEYS.SCHEDULES, []),
  save: (schedules: Schedule[]): void => setToStorage(STORAGE_KEYS.SCHEDULES, schedules),
  getById: (id: string): Schedule | undefined => scheduleStorage.getAll().find(s => s.id === id),
  getByScreenId: (screenId: string): Schedule[] =>
    scheduleStorage.getAll().filter(s => s.screenIds.includes(screenId)),
};

export const historyStorage = {
  getAll: (): HistoryRecord[] => getFromStorage<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []),
  save: (records: HistoryRecord[]): void => setToStorage(STORAGE_KEYS.HISTORY, records),
  getByEntity: (entityType: HistoryRecord['entityType'], entityId: string): HistoryRecord[] =>
    historyStorage.getAll().filter(h => h.entityType === entityType && h.entityId === entityId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
};

export const appStateStorage = {
  get: (): AppState => getFromStorage<AppState>(STORAGE_KEYS.APP_STATE, { isFrozen: false }),
  save: (state: AppState): void => setToStorage(STORAGE_KEYS.APP_STATE, state),
};

export const priorityRuleStorage = {
  getAll: (): PriorityRule[] => {
    const rules = getFromStorage<PriorityRule[]>(STORAGE_KEYS.PRIORITY_RULES, []);
    if (rules.length === 0) {
      setToStorage(STORAGE_KEYS.PRIORITY_RULES, DEFAULT_PRIORITY_RULES);
      return DEFAULT_PRIORITY_RULES;
    }
    return rules;
  },
  save: (rules: PriorityRule[]): void => setToStorage(STORAGE_KEYS.PRIORITY_RULES, rules),
};
