import type {
  Customer,
  Pledge,
  MarketData,
  MarginCall,
  SupplementRecord,
  ExtensionRecord,
  DisposalReport,
  HistoryRecord,
} from '../types';

const STORAGE_KEY = 'pledge-warning-system';
const STORAGE_VERSION = '1.0';

export interface StorageData {
  version: string;
  customers: Customer[];
  pledges: Pledge[];
  marketData: Record<string, MarketData>;
  marginCalls: MarginCall[];
  supplements: SupplementRecord[];
  extensions: ExtensionRecord[];
  disposals: DisposalReport[];
  history: HistoryRecord[];
  lastUpdateTime: string;
}

export function getDefaultStorageData(): StorageData {
  return {
    version: STORAGE_VERSION,
    customers: [],
    pledges: [],
    marketData: {},
    marginCalls: [],
    supplements: [],
    extensions: [],
    disposals: [],
    history: [],
    lastUpdateTime: new Date().toISOString(),
  };
}

export function saveToLocalStorage(data: StorageData): boolean {
  try {
    const dataWithTimestamp = {
      ...data,
      lastUpdateTime: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithTimestamp));
    return true;
  } catch (error) {
    console.error('保存到LocalStorage失败:', error);
    return false;
  }
}

export function loadFromLocalStorage(): StorageData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as StorageData;

    if (data.version !== STORAGE_VERSION) {
      console.warn(`存储版本不匹配：预期${STORAGE_VERSION}，实际${data.version}`);
      return migrateStorageData(data);
    }

    return data;
  } catch (error) {
    console.error('从LocalStorage加载失败:', error);
    return null;
  }
}

function migrateStorageData(data: StorageData): StorageData {
  const defaultData = getDefaultStorageData();
  return {
    ...defaultData,
    ...data,
    version: STORAGE_VERSION,
  };
}

export function clearLocalStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('清除LocalStorage失败:', error);
    return false;
  }
}

export function exportStorageData(): string {
  const data = loadFromLocalStorage() || getDefaultStorageData();
  return JSON.stringify(data, null, 2);
}

export function importStorageData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString) as StorageData;
    if (!data.version) {
      throw new Error('无效的备份数据格式');
    }
    return saveToLocalStorage(data);
  } catch (error) {
    console.error('导入备份数据失败:', error);
    return false;
  }
}

export function getStorageStats(): {
  totalSize: string;
  recordCount: Record<string, number>;
  lastUpdateTime?: string;
} {
  const stored = localStorage.getItem(STORAGE_KEY);
  const data = loadFromLocalStorage();

  let totalSize = '0 KB';
  if (stored) {
    const bytes = new Blob([stored]).size;
    totalSize = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KB`;
  }

  return {
    totalSize,
    recordCount: {
      customers: data?.customers.length || 0,
      pledges: data?.pledges.length || 0,
      marketData: Object.keys(data?.marketData || {}).length,
      marginCalls: data?.marginCalls.length || 0,
      supplements: data?.supplements.length || 0,
      extensions: data?.extensions.length || 0,
      disposals: data?.disposals.length || 0,
      history: data?.history.length || 0,
    },
    lastUpdateTime: data?.lastUpdateTime,
  };
}
