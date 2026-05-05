import type { AppData } from '../types';

const STORAGE_KEY = 'climbing_route_dashboard_data';
const STORAGE_VERSION = '1.0.0';

interface StorageWrapper {
  version: string;
  data: AppData;
  timestamp: string;
}

export const getInitialAppData = (): AppData => ({
  routes: [],
  memberFlows: [],
  ascents: [],
  incidentNotes: [],
  coachNotes: [],
  gradeOverrides: [],
  alerts: [],
  lastUpdated: new Date().toISOString()
});

export const saveAppData = (data: AppData): boolean => {
  try {
    const wrapper: StorageWrapper = {
      version: STORAGE_VERSION,
      data: {
        ...data,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(wrapper);
    localStorage.setItem(STORAGE_KEY, jsonString);
    return true;
  } catch (error) {
    console.error('保存数据到 localStorage 失败:', error);
    return false;
  }
};

export const loadAppData = (): AppData | null => {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEY);
    
    if (!jsonString) {
      return null;
    }
    
    const wrapper = JSON.parse(jsonString) as StorageWrapper;
    
    if (wrapper.version !== STORAGE_VERSION) {
      console.warn(`存储版本不匹配: 期望 ${STORAGE_VERSION}, 实际 ${wrapper.version}`);
      return migrateData(wrapper);
    }
    
    return wrapper.data;
  } catch (error) {
    console.error('从 localStorage 加载数据失败:', error);
    return null;
  }
};

const migrateData = (wrapper: StorageWrapper): AppData | null => {
  try {
    const { data } = wrapper;
    const initialData = getInitialAppData();
    
    return {
      ...initialData,
      routes: data.routes || [],
      memberFlows: data.memberFlows || [],
      ascents: data.ascents || [],
      incidentNotes: data.incidentNotes || [],
      coachNotes: data.coachNotes || [],
      gradeOverrides: data.gradeOverrides || [],
      alerts: data.alerts || [],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('数据迁移失败:', error);
    return null;
  }
};

export const clearAppData = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('清除 localStorage 数据失败:', error);
    return false;
  }
};

export const getStorageInfo = (): { 
  exists: boolean; 
  size: number; 
  lastUpdated: string | null;
  version: string | null;
} => {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEY);
    
    if (!jsonString) {
      return {
        exists: false,
        size: 0,
        lastUpdated: null,
        version: null
      };
    }
    
    const wrapper = JSON.parse(jsonString) as StorageWrapper;
    
    return {
      exists: true,
      size: jsonString.length,
      lastUpdated: wrapper.timestamp,
      version: wrapper.version
    };
  } catch (error) {
    console.error('获取存储信息失败:', error);
    return {
      exists: false,
      size: 0,
      lastUpdated: null,
      version: null
    };
  }
};

export const exportAppDataJSON = (data: AppData): string => {
  const wrapper: StorageWrapper = {
    version: STORAGE_VERSION,
    data,
    timestamp: new Date().toISOString()
  };
  
  return JSON.stringify(wrapper, null, 2);
};

export const importAppDataJSON = (jsonString: string): { 
  success: boolean; 
  data?: AppData; 
  errors: string[] 
} => {
  const errors: string[] = [];
  
  try {
    const wrapper = JSON.parse(jsonString) as StorageWrapper;
    
    if (!wrapper.data) {
      errors.push('JSON 格式不正确：缺少 data 字段');
      return { success: false, errors };
    }
    
    const requiredFields = ['routes', 'memberFlows', 'ascents', 'incidentNotes'];
    for (const field of requiredFields) {
      if (!Array.isArray((wrapper.data as any)[field])) {
        errors.push(`JSON 格式不正确：${field} 不是数组`);
      }
    }
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    return {
      success: true,
      data: {
        ...getInitialAppData(),
        ...wrapper.data
      },
      errors: []
    };
  } catch (error) {
    errors.push(`JSON 解析失败: ${(error as Error).message}`);
    return { success: false, errors };
  }
};

export const checkStorageAvailability = (): boolean => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

export const estimateStorageUsage = (): {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
} => {
  let usedBytes = 0;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          usedBytes += key.length + value.length;
        }
      }
    }
  } catch (e) {
    console.error('计算存储使用量失败:', e);
  }
  
  const typicalLimit = 5 * 1024 * 1024;
  
  return {
    usedBytes,
    totalBytes: typicalLimit,
    percentage: (usedBytes / typicalLimit) * 100
  };
};
