import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AppState, InputData } from '../types';
import { DEFAULT_INPUT_DATA } from '../config/defaults';
import { validateInputData, calculateTileRequirements, processDirtyData } from '../utils/calculationEngine';

// 初始状态
const initialState: AppState = {
  inputData: DEFAULT_INPUT_DATA,
  calculationSteps: [],
  dirtyDataRecords: [],
  validationErrors: [],
  result: undefined,
  currentStep: 0,
};

// Action 类型
type Action =
  | { type: 'UPDATE_INPUT_DATA'; payload: Partial<InputData> }
  | { type: 'SET_FIELD_VALUE'; payload: { field: string; value: string | number | boolean; source: string } }
  | { type: 'VALIDATE_INPUT' }
  | { type: 'CALCULATE' }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'ADD_OPENING' }
  | { type: 'REMOVE_OPENING'; payload: string }
  | { type: 'UPDATE_OPENING'; payload: { id: string; field: string; value: string | number | boolean; source: string } }
  | { type: 'RESET' };

// Reducer
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'UPDATE_INPUT_DATA':
      return {
        ...state,
        inputData: { ...state.inputData, ...action.payload },
      };

    case 'SET_FIELD_VALUE': {
      const { field, value, source } = action.payload;
      
      // 处理脏数据
      const { cleaned, record } = processDirtyData(field, value, source);
      
      // 更新字段
      const fieldParts = field.split('.');
      let newInputData = { ...state.inputData };
      
      if (fieldParts.length === 1) {
        (newInputData as Record<string, unknown>)[fieldParts[0]] = cleaned;
      } else if (fieldParts.length === 2) {
        const [parent, child] = fieldParts;
        newInputData = {
          ...newInputData,
          [parent]: {
            ...(newInputData[parent as keyof InputData] as Record<string, unknown>),
            [child]: cleaned,
          },
        };
      }

      const newRecords = record
        ? [...state.dirtyDataRecords, record]
        : state.dirtyDataRecords;

      return {
        ...state,
        inputData: newInputData,
        dirtyDataRecords: newRecords,
        result: undefined,
      };
    }

    case 'VALIDATE_INPUT': {
      const errors = validateInputData(state.inputData);
      return {
        ...state,
        validationErrors: errors,
      };
    }

    case 'CALCULATE': {
      // 首先验证
      const errors = validateInputData(state.inputData);
      
      // 检查是否有严重错误
      const hasCriticalErrors = errors.some(e => e.severity === 'error');
      
      if (hasCriticalErrors) {
        return {
          ...state,
          validationErrors: errors,
          result: undefined,
        };
      }

      // 执行计算
      const { result, steps } = calculateTileRequirements(state.inputData);

      return {
        ...state,
        result,
        calculationSteps: steps,
        validationErrors: errors,
      };
    }

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'ADD_OPENING': {
      const newOpening = {
        id: `opening-${Date.now()}`,
        type: 'door' as const,
        width: 90,
        height: 210,
        offsetX: 0,
        offsetY: 0,
      };

      return {
        ...state,
        inputData: {
          ...state.inputData,
          openings: [...state.inputData.openings, newOpening],
        },
        result: undefined,
      };
    }

    case 'REMOVE_OPENING': {
      return {
        ...state,
        inputData: {
          ...state.inputData,
          openings: state.inputData.openings.filter(o => o.id !== action.payload),
        },
        result: undefined,
      };
    }

    case 'UPDATE_OPENING': {
      const { id, field, value, source } = action.payload;
      
      // 处理脏数据
      const { cleaned, record } = processDirtyData(`openings[${id}].${field}`, value, source);

      const openings = state.inputData.openings.map(opening => {
        if (opening.id === id) {
          return {
            ...opening,
            [field]: cleaned,
          };
        }
        return opening;
      });

      const newRecords = record
        ? [...state.dirtyDataRecords, record]
        : state.dirtyDataRecords;

      return {
        ...state,
        inputData: {
          ...state.inputData,
          openings,
        },
        dirtyDataRecords: newRecords,
        result: undefined,
      };
    }

    case 'RESET':
      return {
        ...initialState,
        dirtyDataRecords: state.dirtyDataRecords,
      };

    default:
      return state;
  }
};

// Context 类型
interface AppContextType {
  state: AppState;
  updateInputData: (data: Partial<InputData>) => void;
  setFieldValue: (field: string, value: string | number | boolean, source: string) => void;
  validateInput: () => void;
  calculate: () => void;
  setCurrentStep: (step: number) => void;
  addOpening: () => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, field: string, value: string | number | boolean, source: string) => void;
  reset: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider 组件
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const updateInputData = useCallback((data: Partial<InputData>) => {
    dispatch({ type: 'UPDATE_INPUT_DATA', payload: data });
  }, []);

  const setFieldValue = useCallback((field: string, value: string | number | boolean, source: string) => {
    dispatch({ type: 'SET_FIELD_VALUE', payload: { field, value, source } });
  }, []);

  const validateInput = useCallback(() => {
    dispatch({ type: 'VALIDATE_INPUT' });
  }, []);

  const calculate = useCallback(() => {
    dispatch({ type: 'CALCULATE' });
  }, []);

  const setCurrentStep = useCallback((step: number) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
  }, []);

  const addOpening = useCallback(() => {
    dispatch({ type: 'ADD_OPENING' });
  }, []);

  const removeOpening = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_OPENING', payload: id });
  }, []);

  const updateOpening = useCallback((id: string, field: string, value: string | number | boolean, source: string) => {
    dispatch({ type: 'UPDATE_OPENING', payload: { id, field, value, source } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: AppContextType = {
    state,
    updateInputData,
    setFieldValue,
    validateInput,
    calculate,
    setCurrentStep,
    addOpening,
    removeOpening,
    updateOpening,
    reset,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
