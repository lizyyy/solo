const STORAGE_KEY = 'approval-system:v1';

type PersistedState = {
  records: string;
  history: string;
  exportLogs: string;
  currentUser: { name: string; role: string };
  savedAt: number;
};

export function persistToLocalStorage(state: {
  records: unknown;
  history: unknown;
  exportLogs: unknown;
  currentUser: { name: string; role: string };
}): void {
  try {
    const payload: PersistedState = {
      records: JSON.stringify(state.records),
      history: JSON.stringify(state.history),
      exportLogs: JSON.stringify(state.exportLogs),
      currentUser: state.currentUser,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[persist] 保存失败', e);
  }
}

function reviveDateFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => reviveDateFields(item));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
        out[k] = new Date(v);
      } else if (typeof v === 'string' && /^\d{4}\/\d{2}\/\d{2}/.test(v) && !Number.isNaN(new Date(v).getTime())) {
        out[k] = new Date(v);
      } else {
        out[k] = reviveDateFields(v);
      }
    }
    return out;
  }
  return obj;
}

export function restoreFromLocalStorage():
  | { records: unknown; history: unknown; exportLogs: unknown; currentUser: { name: string; role: string } }
  | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.records || !parsed.history) return null;
    return {
      records: reviveDateFields(JSON.parse(parsed.records)),
      history: reviveDateFields(JSON.parse(parsed.history)),
      exportLogs: parsed.exportLogs ? reviveDateFields(JSON.parse(parsed.exportLogs)) : [],
      currentUser: parsed.currentUser || { name: '阿宁', role: 'aning' },
    };
  } catch (e) {
    console.warn('[persist] 读取失败，将使用默认数据', e);
    return null;
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[persist] 清除失败', e);
  }
}
