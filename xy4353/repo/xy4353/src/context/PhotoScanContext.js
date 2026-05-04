import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

const PhotoScanContext = createContext();

// 修复状态枚举
export const REPAIR_STATUS = {
  NOT_REPAIRED: 'not_repaired',
  IN_PROGRESS: 'in_progress',
  REPAIRED: 'repaired'
};

export const REPAIR_STATUS_LABELS = {
  [REPAIR_STATUS.NOT_REPAIRED]: '未修复',
  [REPAIR_STATUS.IN_PROGRESS]: '修复中',
  [REPAIR_STATUS.REPAIRED]: '已修复'
};

// 风险状态枚举
export const RISK_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RESOLVED: 'resolved',
  IGNORED: 'ignored'
};

export const RISK_STATUS_LABELS = {
  [RISK_STATUS.PENDING]: '待处理',
  [RISK_STATUS.CONFIRMED]: '已确认',
  [RISK_STATUS.RESOLVED]: '已解决',
  [RISK_STATUS.IGNORED]: '已忽略'
};

// 风险类型枚举
export const RISK_TYPE = {
  MISSING_FILE: 'missing_file',
  DUPLICATE_ID: 'duplicate_id',
  LOW_RESOLUTION: 'low_resolution',
  REPAIRED_NO_DELIVERY: 'repaired_no_delivery'
};

export const RISK_TYPE_LABELS = {
  [RISK_TYPE.MISSING_FILE]: '缺文件',
  [RISK_TYPE.DUPLICATE_ID]: '重复编号',
  [RISK_TYPE.LOW_RESOLUTION]: '分辨率不足',
  [RISK_TYPE.REPAIRED_NO_DELIVERY]: '已修复未生成交付图'
};

// 初始状态
const initialState = {
  records: [],
  risks: [],
  settings: {
    minResolution: 300, // 最小DPI要求
    scanExtensions: ['.tif', '.tiff', '.jpg', '.jpeg', '.png', '.raw'],
    deliveryExtensions: ['.jpg', '.jpeg', '.png']
  },
  importInfo: {
    csvPath: '',
    scanFolder: '',
    deliveryFolder: '',
    importTime: ''
  }
};

// Action 类型
const ACTION_TYPES = {
  SET_RECORDS: 'SET_RECORDS',
  ADD_RECORD: 'ADD_RECORD',
  UPDATE_RECORD: 'UPDATE_RECORD',
  DELETE_RECORD: 'DELETE_RECORD',
  SET_RISKS: 'SET_RISKS',
  ADD_RISK: 'ADD_RISK',
  UPDATE_RISK: 'UPDATE_RISK',
  CLEAR_RISKS: 'CLEAR_RISKS',
  SET_IMPORT_INFO: 'SET_IMPORT_INFO',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  LOAD_STATE: 'LOAD_STATE'
};

// Reducer
function photoScanReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.SET_RECORDS:
      return { ...state, records: action.payload };
    case ACTION_TYPES.ADD_RECORD:
      const newRecord = {
        id: uuidv4(),
        createdTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        updatedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        ...action.payload
      };
      return { ...state, records: [...state.records, newRecord] };
    case ACTION_TYPES.UPDATE_RECORD:
      return {
        ...state,
        records: state.records.map(record =>
          record.id === action.payload.id
            ? { ...record, ...action.payload, updatedTime: moment().format('YYYY-MM-DD HH:mm:ss') }
            : record
        )
      };
    case ACTION_TYPES.DELETE_RECORD:
      return {
        ...state,
        records: state.records.filter(record => record.id !== action.payload)
      };
    case ACTION_TYPES.SET_RISKS:
      return { ...state, risks: action.payload };
    case ACTION_TYPES.ADD_RISK:
      const newRisk = {
        id: uuidv4(),
        createdTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        status: RISK_STATUS.PENDING,
        ...action.payload
      };
      return { ...state, risks: [...state.risks, newRisk] };
    case ACTION_TYPES.UPDATE_RISK:
      return {
        ...state,
        risks: state.risks.map(risk =>
          risk.id === action.payload.id
            ? { ...risk, ...action.payload, handledTime: moment().format('YYYY-MM-DD HH:mm:ss') }
            : risk
        )
      };
    case ACTION_TYPES.CLEAR_RISKS:
      return { ...state, risks: [] };
    case ACTION_TYPES.SET_IMPORT_INFO:
      return { ...state, importInfo: { ...state.importInfo, ...action.payload } };
    case ACTION_TYPES.UPDATE_SETTINGS:
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case ACTION_TYPES.LOAD_STATE:
      return { ...initialState, ...action.payload };
    default:
      return state;
  }
}

// Provider 组件
export function PhotoScanProvider({ children }) {
  const [state, dispatch] = useReducer(photoScanReducer, initialState);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedState = localStorage.getItem('photoScanState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: parsed });
      } catch (e) {
        console.error('加载保存的状态失败', e);
      }
    }
  }, []);

  // 保存到 localStorage
  useEffect(() => {
    // 避免保存初始空状态
    if (state.records.length > 0 || state.risks.length > 0) {
      localStorage.setItem('photoScanState', JSON.stringify(state));
    }
  }, [state]);

  const value = {
    state,
    dispatch,
    ACTION_TYPES,
    // 辅助方法
    addRecord: (record) => dispatch({ type: ACTION_TYPES.ADD_RECORD, payload: record }),
    updateRecord: (record) => dispatch({ type: ACTION_TYPES.UPDATE_RECORD, payload: record }),
    deleteRecord: (id) => dispatch({ type: ACTION_TYPES.DELETE_RECORD, payload: id }),
    setRecords: (records) => dispatch({ type: ACTION_TYPES.SET_RECORDS, payload: records }),
    addRisk: (risk) => dispatch({ type: ACTION_TYPES.ADD_RISK, payload: risk }),
    updateRisk: (risk) => dispatch({ type: ACTION_TYPES.UPDATE_RISK, payload: risk }),
    setRisks: (risks) => dispatch({ type: ACTION_TYPES.SET_RISKS, payload: risks }),
    clearRisks: () => dispatch({ type: ACTION_TYPES.CLEAR_RISKS }),
    setImportInfo: (info) => dispatch({ type: ACTION_TYPES.SET_IMPORT_INFO, payload: info }),
    updateSettings: (settings) => dispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: settings }),
    loadState: (state) => dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: state })
  };

  return (
    <PhotoScanContext.Provider value={value}>
      {children}
    </PhotoScanContext.Provider>
  );
}

// Hook
export function usePhotoScan() {
  const context = useContext(PhotoScanContext);
  if (!context) {
    throw new Error('usePhotoScan 必须在 PhotoScanProvider 内部使用');
  }
  return context;
}
