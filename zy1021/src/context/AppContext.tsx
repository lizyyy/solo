import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, SyncLogEntry, InspectionItem } from '../types';
import { storage } from '../utils/storage';
import { createInitialState, createChangeSet, addPendingChange, syncDeviceToServer, toggleDeviceOnlineStatus, createLogEntry } from '../utils/syncEngine';
import { resolveConflict } from '../utils/versionControl';

type Action =
  | { type: 'TOGGLE_DEVICE_ONLINE'; payload: { deviceId: string } }
  | { type: 'UPDATE_FORM_FIELD'; payload: { deviceId: string; itemId: string; field: keyof InspectionItem; newValue: unknown } }
  | { type: 'SYNC_DEVICE'; payload: { deviceId: string } }
  | { type: 'RESOLVE_CONFLICT'; payload: { conflictId: string; selectedValue: unknown; resolvedBy: string } }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'RESET_STATE' }
  | { type: 'ADD_LOG'; payload: SyncLogEntry };

const initialState: AppState = createInitialState();

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'TOGGLE_DEVICE_ONLINE': {
      const deviceIndex = state.devices.findIndex(d => d.id === action.payload.deviceId);
      if (deviceIndex === -1) return state;

      const updatedDevice = toggleDeviceOnlineStatus(state.devices[deviceIndex]);
      const newDevices = [...state.devices];
      newDevices[deviceIndex] = updatedDevice;

      const statusLog = createLogEntry(
        'change',
        updatedDevice.id,
        updatedDevice.userId,
        `${updatedDevice.name} 状态变更：${updatedDevice.isOnline ? '联网' : '断网'}`,
        { deviceId: updatedDevice.id, isOnline: updatedDevice.isOnline }
      );

      return {
        ...state,
        devices: newDevices,
        logs: [...state.logs, statusLog]
      };
    }

    case 'UPDATE_FORM_FIELD': {
      const deviceIndex = state.devices.findIndex(d => d.id === action.payload.deviceId);
      if (deviceIndex === -1) return state;

      const device = state.devices[deviceIndex];
      const item = device.localForm.items.find(i => i.id === action.payload.itemId);
      if (!item) return state;

      const oldValue = item[action.payload.field];
      if (oldValue === action.payload.newValue) return state;

      const changeSet = createChangeSet(
        device,
        action.payload.itemId,
        action.payload.field,
        oldValue,
        action.payload.newValue
      );

      const updatedDevice = addPendingChange(device, changeSet);
      const newDevices = [...state.devices];
      newDevices[deviceIndex] = updatedDevice;

      const fieldNames: Record<string, string> = {
        riskLevel: '风险等级',
        status: '处理状态',
        notes: '备注',
        photoPlaceholder: '照片备注'
      };

      const changeLog = createLogEntry(
        'change',
        device.id,
        device.userId,
        `${device.name} 修改了 ${item.name} 的 ${fieldNames[action.payload.field] || action.payload.field}：${oldValue} → ${action.payload.newValue}`,
        {
          deviceId: device.id,
          itemId: action.payload.itemId,
          itemName: item.name,
          field: action.payload.field,
          oldValue,
          newValue: action.payload.newValue,
          isOnline: device.isOnline
        }
      );

      return {
        ...state,
        devices: newDevices,
        logs: [...state.logs, changeLog]
      };
    }

    case 'SYNC_DEVICE': {
      const deviceIndex = state.devices.findIndex(d => d.id === action.payload.deviceId);
      if (deviceIndex === -1) return state;

      const device = state.devices[deviceIndex];
      const result = syncDeviceToServer(device, state.server);

      const newDevices = [...state.devices];
      newDevices[deviceIndex] = result.updatedDevice;

      return {
        ...state,
        devices: newDevices,
        server: result.updatedServer,
        logs: [...state.logs, ...result.newLogs]
      };
    }

    case 'RESOLVE_CONFLICT': {
      const conflictIndex = state.server.conflicts.findIndex(c => c.id === action.payload.conflictId);
      if (conflictIndex === -1) return state;

      const conflict = state.server.conflicts[conflictIndex];
      const resolvedConflict = resolveConflict(conflict, action.payload.selectedValue, action.payload.resolvedBy);

      const newConflicts = [...state.server.conflicts];
      newConflicts[conflictIndex] = resolvedConflict;

      const resolveLog = createLogEntry(
        'resolve',
        conflict.clientChange.deviceId,
        action.payload.resolvedBy,
        `冲突已解决：选择了 ${action.payload.selectedValue}`,
        {
          conflictId: conflict.id,
          conflictType: conflict.type,
          selectedValue: action.payload.selectedValue,
          clientValue: conflict.clientChange.newValue,
          serverValue: conflict.serverChange.newValue,
          resolvedBy: action.payload.resolvedBy
        }
      );

      return {
        ...state,
        server: {
          ...state.server,
          conflicts: newConflicts
        },
        logs: [...state.logs, resolveLog]
      };
    }

    case 'LOAD_STATE': {
      return action.payload;
    }

    case 'RESET_STATE': {
      return createInitialState();
    }

    case 'ADD_LOG': {
      return {
        ...state,
        logs: [...state.logs, action.payload]
      };
    }

    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  toggleDeviceOnline: (deviceId: string) => void;
  updateFormField: (deviceId: string, itemId: string, field: keyof InspectionItem, newValue: unknown) => void;
  syncDevice: (deviceId: string) => void;
  resolveConflict: (conflictId: string, selectedValue: unknown, resolvedBy: string) => void;
  loadState: (state: AppState) => void;
  resetState: () => void;
  addLog: (log: SyncLogEntry) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (initial) => {
    const saved = storage.load();
    return saved || initial;
  });

  useEffect(() => {
    storage.save(state);
  }, [state]);

  const toggleDeviceOnline = (deviceId: string) => {
    dispatch({ type: 'TOGGLE_DEVICE_ONLINE', payload: { deviceId } });
  };

  const updateFormField = (deviceId: string, itemId: string, field: keyof InspectionItem, newValue: unknown) => {
    dispatch({ type: 'UPDATE_FORM_FIELD', payload: { deviceId, itemId, field, newValue } });
  };

  const syncDevice = (deviceId: string) => {
    dispatch({ type: 'SYNC_DEVICE', payload: { deviceId } });
  };

  const resolveConflict = (conflictId: string, selectedValue: unknown, resolvedBy: string) => {
    dispatch({ type: 'RESOLVE_CONFLICT', payload: { conflictId, selectedValue, resolvedBy } });
  };

  const loadState = (newState: AppState) => {
    dispatch({ type: 'LOAD_STATE', payload: newState });
  };

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  const addLog = (log: SyncLogEntry) => {
    dispatch({ type: 'ADD_LOG', payload: log });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        toggleDeviceOnline,
        updateFormField,
        syncDevice,
        resolveConflict,
        loadState,
        resetState,
        addLog
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
