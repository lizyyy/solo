import {
  DeviceState,
  ServerState,
  ChangeSet,
  SyncLogEntry,
  AppState,
  InspectionForm,
  InspectionItem,
  Conflict
} from '../types';
import { generateId } from './index';
import { checkConflict, incrementVersion, mergeChanges } from './versionControl';

export const createInitialForm = (): InspectionForm => {
  const now = Date.now();
  const itemId1 = generateId();
  const itemId2 = generateId();
  const itemId3 = generateId();

  return {
    id: generateId(),
    title: '外勤巡检表 - 设备检查',
    items: [
      {
        id: itemId1,
        name: '设备A - 电源检查',
        riskLevel: 'low',
        status: 'pending',
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now
      },
      {
        id: itemId2,
        name: '设备B - 温度监测',
        riskLevel: 'medium',
        status: 'pending',
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now
      },
      {
        id: itemId3,
        name: '设备C - 安全检查',
        riskLevel: 'high',
        status: 'pending',
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now
      }
    ],
    createdAt: now,
    createdBy: 'system'
  };
};

export const createInitialState = (): AppState => {
  const initialForm = createInitialForm();
  const now = Date.now();

  const device1: DeviceState = {
    id: 'device-1',
    name: '设备A - 张三',
    userId: 'zhangsan',
    isOnline: true,
    localVersion: 1,
    pendingChanges: [],
    localForm: JSON.parse(JSON.stringify(initialForm))
  };

  const device2: DeviceState = {
    id: 'device-2',
    name: '设备B - 李四',
    userId: 'lisi',
    isOnline: true,
    localVersion: 1,
    pendingChanges: [],
    localForm: JSON.parse(JSON.stringify(initialForm))
  };

  const server: ServerState = {
    currentVersion: 1,
    form: JSON.parse(JSON.stringify(initialForm)),
    changeHistory: [],
    conflicts: []
  };

  const initialLog: SyncLogEntry = {
    id: generateId(),
    timestamp: now,
    type: 'change',
    deviceId: 'system',
    userId: 'system',
    description: '系统初始化，创建初始巡检表',
    details: {
      formId: initialForm.id,
      version: 1
    }
  };

  return {
    devices: [device1, device2],
    server,
    logs: [initialLog]
  };
};

export const createChangeSet = (
  device: DeviceState,
  itemId: string,
  field: keyof InspectionItem,
  oldValue: unknown,
  newValue: unknown
): ChangeSet => {
  const now = Date.now();
  return {
    id: generateId(),
    formId: device.localForm.id,
    itemId,
    field,
    oldValue,
    newValue,
    version: device.localVersion,
    timestamp: now,
    deviceId: device.id,
    userId: device.userId
  };
};

export const addPendingChange = (
  device: DeviceState,
  change: ChangeSet
): DeviceState => {
  const updatedForm = { ...device.localForm };
  const itemIndex = updatedForm.items.findIndex(item => item.id === change.itemId);
  
  if (itemIndex !== -1) {
    const updatedItem = { ...updatedForm.items[itemIndex] };
    (updatedItem as Record<string, unknown>)[change.field] = change.newValue;
    updatedItem.lastModifiedBy = device.userId;
    updatedItem.lastModifiedAt = Date.now();
    updatedForm.items = [...updatedForm.items];
    updatedForm.items[itemIndex] = updatedItem;
  }

  return {
    ...device,
    localForm: updatedForm,
    pendingChanges: [...device.pendingChanges, change]
  };
};

export const createLogEntry = (
  type: SyncLogEntry['type'],
  deviceId: string,
  userId: string,
  description: string,
  details?: Record<string, unknown>
): SyncLogEntry => {
  return {
    id: generateId(),
    timestamp: Date.now(),
    type,
    deviceId,
    userId,
    description,
    details
  };
};

export interface SyncResult {
  updatedDevice: DeviceState;
  updatedServer: ServerState;
  newLogs: SyncLogEntry[];
  newConflicts: Conflict[];
}

export const syncDeviceToServer = (
  device: DeviceState,
  server: ServerState
): SyncResult => {
  if (!device.isOnline) {
    return {
      updatedDevice: device,
      updatedServer: server,
      newLogs: [],
      newConflicts: []
    };
  }

  if (device.pendingChanges.length === 0) {
    return {
      updatedDevice: device,
      updatedServer: server,
      newLogs: [],
      newConflicts: []
    };
  }

  const newLogs: SyncLogEntry[] = [];
  const newConflicts: Conflict[] = [];
  let updatedServer = { ...server };
  let updatedDevice = { ...device };
  const processedChanges: string[] = [];

  newLogs.push(
    createLogEntry(
      'sync',
      device.id,
      device.userId,
      `开始同步，待同步更改数量: ${device.pendingChanges.length}`,
      {
        deviceId: device.id,
        pendingChangesCount: device.pendingChanges.length
      }
    )
  );

  for (const change of device.pendingChanges) {
    const { conflict, serverChange } = checkConflict(change, updatedServer.changeHistory);

    if (conflict) {
      newConflicts.push(conflict);
      updatedServer.conflicts = [...updatedServer.conflicts, conflict];

      newLogs.push(
        createLogEntry(
          'conflict',
          device.id,
          device.userId,
          `检测到冲突: ${conflict.type === 'same_field_conflict' ? '同一字段冲突' : '旧版本提交'}`,
          {
            conflictId: conflict.id,
            conflictType: conflict.type,
            clientChange: {
              itemId: change.itemId,
              field: change.field,
              value: change.newValue,
              version: change.version
            },
            serverChange: serverChange ? {
              itemId: serverChange.itemId,
              field: serverChange.field,
              value: serverChange.newValue,
              version: serverChange.version
            } : null
          }
        )
      );
    } else {
      const newVersion = incrementVersion(updatedServer.currentVersion);
      const changeWithNewVersion = { ...change, version: newVersion };

      updatedServer.currentVersion = newVersion;
      updatedServer.changeHistory = [...updatedServer.changeHistory, changeWithNewVersion];

      const itemIndex = updatedServer.form.items.findIndex(item => item.id === change.itemId);
      if (itemIndex !== -1) {
        const updatedItem = { ...updatedServer.form.items[itemIndex] };
        (updatedItem as Record<string, unknown>)[change.field] = change.newValue;
        updatedItem.lastModifiedBy = device.userId;
        updatedItem.lastModifiedAt = Date.now();
        updatedServer.form = {
          ...updatedServer.form,
          items: [...updatedServer.form.items]
        };
        updatedServer.form.items[itemIndex] = updatedItem;
      }

      processedChanges.push(change.id);

      newLogs.push(
        createLogEntry(
          'sync',
          device.id,
          device.userId,
          `同步成功: 修改了 ${change.field} 字段，新版本: ${newVersion}`,
          {
            changeId: change.id,
            itemId: change.itemId,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            newVersion
          }
        )
      );
    }
  }

  updatedDevice = {
    ...updatedDevice,
    localVersion: updatedServer.currentVersion,
    pendingChanges: updatedDevice.pendingChanges.filter(
      change => !processedChanges.includes(change.id)
    )
  };

  const localUpdatedItems = updatedDevice.localForm.items.map(item => {
    const serverItem = updatedServer.form.items.find(si => si.id === item.id);
    if (serverItem) {
      return mergeChanges(item, updatedServer.changeHistory.filter(
        c => c.itemId === item.id && !processedChanges.includes(c.id)
      ));
    }
    return item;
  });

  updatedDevice.localForm = {
    ...updatedDevice.localForm,
    items: localUpdatedItems
  };

  newLogs.push(
    createLogEntry(
      'sync',
      device.id,
      device.userId,
      `同步完成，成功同步: ${processedChanges.length} 项，冲突: ${newConflicts.length} 项`,
      {
        deviceId: device.id,
        successCount: processedChanges.length,
        conflictCount: newConflicts.length,
        currentVersion: updatedServer.currentVersion
      }
    )
  );

  return {
    updatedDevice,
    updatedServer,
    newLogs,
    newConflicts
  };
};

export const toggleDeviceOnlineStatus = (device: DeviceState): DeviceState => {
  return {
    ...device,
    isOnline: !device.isOnline
  };
};
