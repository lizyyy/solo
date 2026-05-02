import { AppState, PresetScene } from '../types';

export const exportState = (state: AppState): string => {
  return JSON.stringify(state, null, 2);
};

export const importState = (jsonString: string): AppState | null => {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (isValidAppState(parsed)) {
      return parsed as AppState;
    }
    return null;
  } catch (error) {
    console.error('Failed to parse imported state:', error);
    return null;
  }
};

const isValidAppState = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  
  const state = obj as Record<string, unknown>;
  
  if (!Array.isArray(state.devices)) return false;
  if (!state.server || typeof state.server !== 'object') return false;
  if (!Array.isArray(state.logs)) return false;
  
  return true;
};

export const downloadStateAsFile = (state: AppState): void => {
  const jsonString = exportState(state);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `sync-simulator-state-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const loadStateFromFile = (file: File): Promise<AppState | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const state = importState(content);
      resolve(state);
    };
    
    reader.onerror = () => {
      console.error('Failed to read file');
      resolve(null);
    };
    
    reader.readAsText(file);
  });
};

export const presetScenes: PresetScene[] = [
  {
    name: '典型冲突场景 - 同一字段修改',
    description: '两台设备同时离线修改同一条巡检项的同一字段（风险等级），联网同步时产生冲突',
    initialState: createTypicalConflictScene()
  },
  {
    name: '自动合并场景 - 不同字段修改',
    description: '两台设备同时离线修改同一条巡检项的不同字段（一台改风险等级，一台改状态），联网同步时自动合并',
    initialState: createAutoMergeScene()
  },
  {
    name: '旧版本提交场景',
    description: '设备A在线修改并同步，设备B离线基于旧版本修改，联网同步时检测到旧版本提交冲突',
    initialState: createOldVersionScene()
  }
];

function createTypicalConflictScene(): AppState {
  const now = Date.now();
  const itemId = 'conflict-item-1';
  const formId = 'conflict-form-1';

  const baseForm = {
    id: formId,
    title: '冲突演练表 - 典型冲突场景',
    items: [
      {
        id: itemId,
        name: '关键设备检查',
        riskLevel: 'low' as const,
        status: 'pending' as const,
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now - 60000
      }
    ],
    createdAt: now - 120000,
    createdBy: 'system'
  };

  const device1Form = JSON.parse(JSON.stringify(baseForm));
  device1Form.items[0].riskLevel = 'high';
  device1Form.items[0].lastModifiedBy = 'zhangsan';
  device1Form.items[0].lastModifiedAt = now - 30000;

  const device2Form = JSON.parse(JSON.stringify(baseForm));
  device2Form.items[0].riskLevel = 'medium';
  device2Form.items[0].lastModifiedBy = 'lisi';
  device2Form.items[0].lastModifiedAt = now - 20000;

  return {
    devices: [
      {
        id: 'device-1',
        name: '设备A - 张三',
        userId: 'zhangsan',
        isOnline: true,
        localVersion: 1,
        pendingChanges: [
          {
            id: 'change-1',
            formId,
            itemId,
            field: 'riskLevel',
            oldValue: 'low',
            newValue: 'high',
            version: 1,
            timestamp: now - 30000,
            deviceId: 'device-1',
            userId: 'zhangsan'
          }
        ],
        localForm: device1Form
      },
      {
        id: 'device-2',
        name: '设备B - 李四',
        userId: 'lisi',
        isOnline: true,
        localVersion: 1,
        pendingChanges: [
          {
            id: 'change-2',
            formId,
            itemId,
            field: 'riskLevel',
            oldValue: 'low',
            newValue: 'medium',
            version: 1,
            timestamp: now - 20000,
            deviceId: 'device-2',
            userId: 'lisi'
          }
        ],
        localForm: device2Form
      }
    ],
    server: {
      currentVersion: 1,
      form: baseForm,
      changeHistory: [],
      conflicts: []
    },
    logs: [
      {
        id: 'log-1',
        timestamp: now - 120000,
        type: 'change',
        deviceId: 'system',
        userId: 'system',
        description: '系统初始化，创建典型冲突场景巡检表',
        details: { formId, version: 1 }
      },
      {
        id: 'log-2',
        timestamp: now - 30000,
        type: 'change',
        deviceId: 'device-1',
        userId: 'zhangsan',
        description: '张三离线修改风险等级：low → high',
        details: { itemId, field: 'riskLevel', oldValue: 'low', newValue: 'high' }
      },
      {
        id: 'log-3',
        timestamp: now - 20000,
        type: 'change',
        deviceId: 'device-2',
        userId: 'lisi',
        description: '李四离线修改风险等级：low → medium',
        details: { itemId, field: 'riskLevel', oldValue: 'low', newValue: 'medium' }
      },
      {
        id: 'log-4',
        timestamp: now,
        type: 'sync',
        deviceId: 'system',
        userId: 'system',
        description: '场景已加载：两台设备都有待同步更改，点击同步按钮观察冲突处理',
        details: { scene: 'typical_conflict' }
      }
    ]
  };
}

function createAutoMergeScene(): AppState {
  const now = Date.now();
  const itemId = 'merge-item-1';
  const formId = 'merge-form-1';

  const baseForm = {
    id: formId,
    title: '合并演练表 - 自动合并场景',
    items: [
      {
        id: itemId,
        name: '常规设备检查',
        riskLevel: 'low' as const,
        status: 'pending' as const,
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now - 60000
      }
    ],
    createdAt: now - 120000,
    createdBy: 'system'
  };

  const device1Form = JSON.parse(JSON.stringify(baseForm));
  device1Form.items[0].riskLevel = 'medium';
  device1Form.items[0].lastModifiedBy = 'zhangsan';
  device1Form.items[0].lastModifiedAt = now - 30000;

  const device2Form = JSON.parse(JSON.stringify(baseForm));
  device2Form.items[0].status = 'in_progress';
  device2Form.items[0].lastModifiedBy = 'lisi';
  device2Form.items[0].lastModifiedAt = now - 20000;

  return {
    devices: [
      {
        id: 'device-1',
        name: '设备A - 张三',
        userId: 'zhangsan',
        isOnline: true,
        localVersion: 1,
        pendingChanges: [
          {
            id: 'change-1',
            formId,
            itemId,
            field: 'riskLevel',
            oldValue: 'low',
            newValue: 'medium',
            version: 1,
            timestamp: now - 30000,
            deviceId: 'device-1',
            userId: 'zhangsan'
          }
        ],
        localForm: device1Form
      },
      {
        id: 'device-2',
        name: '设备B - 李四',
        userId: 'lisi',
        isOnline: true,
        localVersion: 1,
        pendingChanges: [
          {
            id: 'change-2',
            formId,
            itemId,
            field: 'status',
            oldValue: 'pending',
            newValue: 'in_progress',
            version: 1,
            timestamp: now - 20000,
            deviceId: 'device-2',
            userId: 'lisi'
          }
        ],
        localForm: device2Form
      }
    ],
    server: {
      currentVersion: 1,
      form: baseForm,
      changeHistory: [],
      conflicts: []
    },
    logs: [
      {
        id: 'log-1',
        timestamp: now - 120000,
        type: 'change',
        deviceId: 'system',
        userId: 'system',
        description: '系统初始化，创建自动合并场景巡检表',
        details: { formId, version: 1 }
      },
      {
        id: 'log-2',
        timestamp: now - 30000,
        type: 'change',
        deviceId: 'device-1',
        userId: 'zhangsan',
        description: '张三离线修改风险等级：low → medium',
        details: { itemId, field: 'riskLevel', oldValue: 'low', newValue: 'medium' }
      },
      {
        id: 'log-3',
        timestamp: now - 20000,
        type: 'change',
        deviceId: 'device-2',
        userId: 'lisi',
        description: '李四离线修改状态：pending → in_progress',
        details: { itemId, field: 'status', oldValue: 'pending', newValue: 'in_progress' }
      },
      {
        id: 'log-4',
        timestamp: now,
        type: 'sync',
        deviceId: 'system',
        userId: 'system',
        description: '场景已加载：两台设备修改不同字段，点击同步按钮观察自动合并',
        details: { scene: 'auto_merge' }
      }
    ]
  };
}

function createOldVersionScene(): AppState {
  const now = Date.now();
  const itemId = 'old-version-item-1';
  const formId = 'old-version-form-1';

  const baseForm = {
    id: formId,
    title: '版本演练表 - 旧版本提交场景',
    items: [
      {
        id: itemId,
        name: '安全设备检查',
        riskLevel: 'low' as const,
        status: 'pending' as const,
        notes: '',
        photoPlaceholder: '',
        lastModifiedBy: 'system',
        lastModifiedAt: now - 120000
      }
    ],
    createdAt: now - 180000,
    createdBy: 'system'
  };

  const serverForm = JSON.parse(JSON.stringify(baseForm));
  serverForm.items[0].riskLevel = 'high';
  serverForm.items[0].status = 'in_progress';
  serverForm.items[0].lastModifiedBy = 'zhangsan';
  serverForm.items[0].lastModifiedAt = now - 60000;

  const device1Form = JSON.parse(JSON.stringify(serverForm));

  const device2Form = JSON.parse(JSON.stringify(baseForm));
  device2Form.items[0].notes = '设备离线期间添加的备注';
  device2Form.items[0].lastModifiedBy = 'lisi';
  device2Form.items[0].lastModifiedAt = now - 30000;

  return {
    devices: [
      {
        id: 'device-1',
        name: '设备A - 张三',
        userId: 'zhangsan',
        isOnline: true,
        localVersion: 3,
        pendingChanges: [],
        localForm: device1Form
      },
      {
        id: 'device-2',
        name: '设备B - 李四（离线修改）',
        userId: 'lisi',
        isOnline: false,
        localVersion: 1,
        pendingChanges: [
          {
            id: 'change-2',
            formId,
            itemId,
            field: 'notes',
            oldValue: '',
            newValue: '设备离线期间添加的备注',
            version: 1,
            timestamp: now - 30000,
            deviceId: 'device-2',
            userId: 'lisi'
          }
        ],
        localForm: device2Form
      }
    ],
    server: {
      currentVersion: 3,
      form: serverForm,
      changeHistory: [
        {
          id: 'change-1',
          formId,
          itemId,
          field: 'riskLevel',
          oldValue: 'low',
          newValue: 'high',
          version: 2,
          timestamp: now - 90000,
          deviceId: 'device-1',
          userId: 'zhangsan'
        },
        {
          id: 'change-2',
          formId,
          itemId,
          field: 'status',
          oldValue: 'pending',
          newValue: 'in_progress',
          version: 3,
          timestamp: now - 60000,
          deviceId: 'device-1',
          userId: 'zhangsan'
        }
      ],
      conflicts: []
    },
    logs: [
      {
        id: 'log-1',
        timestamp: now - 180000,
        type: 'change',
        deviceId: 'system',
        userId: 'system',
        description: '系统初始化，创建旧版本提交场景巡检表（版本1）',
        details: { formId, version: 1 }
      },
      {
        id: 'log-2',
        timestamp: now - 90000,
        type: 'sync',
        deviceId: 'device-1',
        userId: 'zhangsan',
        description: '张三修改风险等级：low → high（版本2）',
        details: { itemId, field: 'riskLevel', oldValue: 'low', newValue: 'high', version: 2 }
      },
      {
        id: 'log-3',
        timestamp: now - 60000,
        type: 'sync',
        deviceId: 'device-1',
        userId: 'zhangsan',
        description: '张三修改状态：pending → in_progress（版本3）',
        details: { itemId, field: 'status', oldValue: 'pending', newValue: 'in_progress', version: 3 }
      },
      {
        id: 'log-4',
        timestamp: now - 30000,
        type: 'change',
        deviceId: 'device-2',
        userId: 'lisi',
        description: '李四离线基于版本1添加备注（设备仍在离线状态）',
        details: { itemId, field: 'notes', oldValue: '', newValue: '设备离线期间添加的备注', basedOnVersion: 1 }
      },
      {
        id: 'log-5',
        timestamp: now,
        type: 'sync',
        deviceId: 'system',
        userId: 'system',
        description: '场景已加载：设备B基于旧版本修改，联网后将检测到旧版本提交冲突。先让设备B联网，再点击同步观察冲突处理。',
        details: { scene: 'old_version', currentServerVersion: 3, deviceBVersion: 1 }
      }
    ]
  };
}
