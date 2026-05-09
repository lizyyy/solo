import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AppState, TreeRecord, ComplaintRecord, WorkOrder } from '../types';
import { loadFromLocalStorage, saveToLocalStorage, resetToSampleData, generateWorkOrders } from '../utils';

type Action =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'RESET_DATA' }
  | { type: 'UPDATE_TREE'; payload: TreeRecord }
  | { type: 'ADD_COMPLAINT'; payload: ComplaintRecord }
  | { type: 'RESOLVE_COMPLAINT'; payload: { id: string; resolution: string } }
  | { type: 'UPDATE_WORK_ORDER'; payload: WorkOrder }
  | { type: 'START_WORK_ORDER'; payload: { id: string; assignedTo: string } }
  | { type: 'COMPLETE_WORK_ORDER'; payload: { id: string; result: string } }
  | { type: 'PUBLISH_WORK_ORDER'; payload: { id: string } }
  | { type: 'REFRESH_WORK_ORDERS' };

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const appReducer = (state: AppState, action: Action): AppState => {
  let newState: AppState;
  
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;
    
    case 'RESET_DATA':
      return resetToSampleData();
    
    case 'UPDATE_TREE':
      newState = {
        ...state,
        trees: state.trees.map(t => t.id === action.payload.id ? action.payload : t)
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'ADD_COMPLAINT':
      newState = {
        ...state,
        complaints: [...state.complaints, action.payload]
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'RESOLVE_COMPLAINT':
      newState = {
        ...state,
        complaints: state.complaints.map(c =>
          c.id === action.payload.id
            ? { ...c, resolved: true, resolvedAt: new Date().toISOString(), resolution: action.payload.resolution }
            : c
        )
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'UPDATE_WORK_ORDER':
      newState = {
        ...state,
        workOrders: state.workOrders.map(wo => wo.id === action.payload.id ? action.payload : wo)
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'START_WORK_ORDER':
      newState = {
        ...state,
        workOrders: state.workOrders.map(wo =>
          wo.id === action.payload.id
            ? { ...wo, status: 'processing' as const, assignedTo: action.payload.assignedTo, startedAt: new Date().toISOString() }
            : wo
        )
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'COMPLETE_WORK_ORDER':
      const completedWO = state.workOrders.find(wo => wo.id === action.payload.id);
      newState = {
        ...state,
        workOrders: state.workOrders.map(wo =>
          wo.id === action.payload.id
            ? { ...wo, status: 'completed' as const, result: action.payload.result, completedAt: new Date().toISOString() }
            : wo
        ),
        complaints: state.complaints.map(c =>
          completedWO?.complaintIds.includes(c.id)
            ? { ...c, resolved: true, resolvedAt: new Date().toISOString(), resolution: '工单已完成处理' }
            : c
        ),
        trees: state.trees.map(t =>
          t.id === completedWO?.treeId
            ? { ...t, status: 'trimmed' as const, lastTrimDate: new Date().toISOString().split('T')[0] }
            : t
        )
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'PUBLISH_WORK_ORDER':
      newState = {
        ...state,
        workOrders: state.workOrders.map(wo =>
          wo.id === action.payload.id
            ? { ...wo, isPublic: true, publicAt: new Date().toISOString() }
            : wo
        )
      };
      saveToLocalStorage(newState);
      return newState;
    
    case 'REFRESH_WORK_ORDERS':
      const refreshed = generateWorkOrders(state.trees, state.complaints, state.workOrders);
      newState = { ...state, workOrders: refreshed };
      saveToLocalStorage(newState);
      return newState;
    
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, { trees: [], complaints: [], workOrders: [] });
  
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      dispatch({ type: 'LOAD_STATE', payload: saved });
    } else {
      const initial = resetToSampleData();
      dispatch({ type: 'LOAD_STATE', payload: initial });
    }
  }, []);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
