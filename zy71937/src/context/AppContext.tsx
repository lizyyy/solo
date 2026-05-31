import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { DisplayTask, FilterState, ExportSpec } from '../types';
import { mockTasks, mockExportSpecs, currentUser } from '../data/mockData';
import { createHistoryRecord } from '../utils/helpers';

interface AppState {
  tasks: DisplayTask[];
  exportSpecs: ExportSpec[];
  filters: FilterState;
  selectedTaskId: string | null;
  isValidationModalOpen: boolean;
  user: typeof currentUser;
}

type AppAction =
  | { type: 'SET_FILTERS'; payload: Partial<FilterState> }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'UPDATE_TASK_STATUS'; payload: { taskId: string; status: DisplayTask['status'] } }
  | { type: 'RESOLVE_ANOMALY'; payload: { taskId: string; anomalyId: string; reviewNote: string } }
  | { type: 'WITHDRAW_TASK'; payload: { taskId: string; reason: string } }
  | { type: 'UPDATE_EXPORT_SPEC'; payload: { taskId: string; specId: string } }
  | { type: 'OPEN_VALIDATION'; payload: boolean }
  | { type: 'ADD_TASK'; payload: DisplayTask }
  | { type: 'IMPORT_ITEMS'; payload: { taskId: string; items: DisplayTask['items'] } };

const initialState: AppState = {
  tasks: mockTasks,
  exportSpecs: mockExportSpecs,
  filters: {},
  selectedTaskId: null,
  isValidationModalOpen: false,
  user: currentUser,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };

    case 'SELECT_TASK':
      return { ...state, selectedTaskId: action.payload };

    case 'UPDATE_TASK_STATUS': {
      const { taskId, status } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                status,
                updatedAt: new Date().toISOString(),
                confirmedAt: status === 'confirmed' ? new Date().toISOString() : task.confirmedAt,
                confirmedBy: status === 'confirmed' ? state.user.name : task.confirmedBy,
                exportedAt: status === 'exported' ? new Date().toISOString() : task.exportedAt,
                exportedBy: status === 'exported' ? state.user.name : task.exportedBy,
                history: [
                  ...task.history,
                  createHistoryRecord(taskId, '状态变更', `状态变更为: ${status}`, state.user.name),
                ],
              }
            : task
        ),
      };
    }

    case 'RESOLVE_ANOMALY': {
      const { taskId, anomalyId, reviewNote } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                anomalies: task.anomalies.map(a =>
                  a.id === anomalyId
                    ? {
                        ...a,
                        isResolved: true,
                        reviewNote,
                        resolvedAt: new Date().toISOString(),
                        resolvedBy: state.user.name,
                      }
                    : a
                ),
                updatedAt: new Date().toISOString(),
                history: [
                  ...task.history,
                  createHistoryRecord(taskId, '异常处理', `处理异常: ${anomalyId}`, state.user.name),
                ],
              }
            : task
        ),
      };
    }

    case 'WITHDRAW_TASK': {
      const { taskId, reason } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                status: 'withdrawn',
                updatedAt: new Date().toISOString(),
                history: [
                  ...task.history,
                  createHistoryRecord(taskId, '撤回', `撤回原因: ${reason}`, state.user.name),
                ],
              }
            : task
        ),
      };
    }

    case 'UPDATE_EXPORT_SPEC': {
      const { taskId, specId } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                exportSpecId: specId,
                updatedAt: new Date().toISOString(),
                history: [
                  ...task.history,
                  createHistoryRecord(taskId, '规格更新', `更新导出规格为: ${specId}`, state.user.name),
                ],
              }
            : task
        ),
      };
    }

    case 'OPEN_VALIDATION':
      return { ...state, isValidationModalOpen: action.payload };

    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };

    case 'IMPORT_ITEMS': {
      const { taskId, items } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                items: [...task.items, ...items],
                updatedAt: new Date().toISOString(),
                history: [
                  ...task.history,
                  createHistoryRecord(taskId, '导入', `导入 ${items.length} 个商品`, state.user.name),
                ],
              }
            : task
        ),
      };
    }

    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  getFilteredTasks: () => DisplayTask[];
  getSelectedTask: () => DisplayTask | undefined;
} | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const getFilteredTasks = () => {
    let result = [...state.tasks];
    
    if (state.filters.status?.length) {
      result = result.filter(t => state.filters.status!.includes(t.status));
    }
    if (state.filters.department?.length) {
      result = result.filter(t => state.filters.department!.includes(t.department));
    }
    if (state.filters.season?.length) {
      result = result.filter(t => state.filters.season!.includes(t.season));
    }
    if (state.filters.hasAnomalies !== undefined) {
      result = result.filter(t => 
        state.filters.hasAnomalies 
          ? t.anomalies.some(a => !a.isResolved)
          : true
      );
    }
    if (state.filters.searchText) {
      const search = state.filters.searchText.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.items.some(i => i.sku.toLowerCase().includes(search))
      );
    }
    
    return result;
  };

  const getSelectedTask = () => {
    return state.tasks.find(t => t.id === state.selectedTaskId);
  };

  return (
    <AppContext.Provider value={{ state, dispatch, getFilteredTasks, getSelectedTask }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
