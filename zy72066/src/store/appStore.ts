import { create } from 'zustand';
import {
  AppState,
  AppActions,
  Solution,
  ParameterConfig,
  DeviceData,
  DiffSnapshot,
  OperationType,
  OperationLog,
  ANOMALY_TYPE_LABELS,
} from '../types';
import { defaultConfig, sampleSolutions, sampleDevicesSmooth } from '../data/mockData';
import { detectAllAnomalies } from '../utils/anomalyDetector';
import { v4 as uuidv4 } from 'uuid';

type AppStore = AppState & AppActions;

const countAnomaliesByType = (solution: Solution): Record<string, number> => {
  const result: Record<string, number> = {};
  solution.anomalies.forEach((a) => {
    result[a.type] = (result[a.type] || 0) + 1;
  });
  return result;
};

const initialState: AppState = {
  currentSolution: null,
  currentConfig: defaultConfig,
  solutions: sampleSolutions,
  selectedFloor: null,
  selectedDevice: null,
  selectedAnomalyId: null,
  filterConditions: { showResolved: true },
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setCurrentSolution: (solution) => {
    if (solution) {
      const anomalies = detectAllAnomalies(solution.devices, get().currentConfig);
      const merged = { ...solution, anomalies };
      const snapshot = {
        timestamp: new Date().toISOString(),
        deviceCount: merged.devices.length,
        anomalyCount: merged.anomalies.length,
        unresolvedAnomalyCount: merged.anomalies.filter((a) => !a.resolved).length,
        resolvedAnomalyCount: merged.anomalies.filter((a) => a.resolved).length,
        anomaliesByType: countAnomaliesByType(merged),
        totalEnergy: merged.devices.reduce((s, d) => s + d.energyConsumption, 0),
        remarksCount: merged.remarks.length,
      };
      if (!merged.snapshots || merged.snapshots.length === 0) {
        merged.snapshots = [snapshot];
      }
      set({
        currentSolution: merged,
        selectedFloor: null,
        selectedDevice: null,
        selectedAnomalyId: null,
      });
    } else {
      set({ currentSolution: null, selectedFloor: null, selectedDevice: null, selectedAnomalyId: null });
    }
  },

  setCurrentConfig: (config) => {
    set({ currentConfig: config });
    const { currentSolution } = get();
    if (currentSolution) {
      const anomalies = detectAllAnomalies(currentSolution.devices, config);
      set({ currentSolution: { ...currentSolution, anomalies } });
    }
  },

  updateConfig: (updates) => {
    const newConfig = {
      ...get().currentConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    set({ currentConfig: newConfig });
    const { currentSolution } = get();
    if (currentSolution) {
      const anomalies = detectAllAnomalies(currentSolution.devices, newConfig);
      const updatedSolution = { ...currentSolution, anomalies, updatedAt: new Date().toISOString() };
      set({
        currentSolution: updatedSolution,
        solutions: get().solutions.map((s) => (s.id === currentSolution.id ? updatedSolution : s)),
      });
      get().addOperationLog('config_updated', `检测参数已更新`, updates);
    }
  },

  addSolution: (solution) => {
    set((state) => ({
      solutions: [...state.solutions, solution],
    }));
  },

  updateSolution: (id, updates) => {
    set((state) => ({
      solutions: state.solutions.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
      currentSolution:
        state.currentSolution?.id === id
          ? { ...state.currentSolution, ...updates, updatedAt: new Date().toISOString() }
          : state.currentSolution,
    }));
  },

  setSelectedFloor: (floor) => {
    set({ selectedFloor: floor, selectedDevice: null });
  },

  setSelectedDevice: (device) => {
    set({ selectedDevice: device });
  },

  setSelectedAnomalyId: (id) => {
    set({ selectedAnomalyId: id });
  },

  setFilterConditions: (conditions) => {
    set((state) => ({
      filterConditions: { ...state.filterConditions, ...conditions },
    }));
  },

  resolveAnomaly: (anomalyId, remark) => {
    const { currentSolution, solutions } = get();
    if (!currentSolution) return;

    const anomaly = currentSolution.anomalies.find((a) => a.id === anomalyId);
    if (!anomaly) return;

    const now = new Date().toISOString();
    const updatedAnomalies = currentSolution.anomalies.map((a) =>
      a.id === anomalyId
        ? { ...a, resolved: true, remark, resolvedAt: now, resolvedBy: '林老师' }
        : a
    );

    const operationLog: OperationLog = {
      id: uuidv4(),
      type: 'anomaly_resolved',
      timestamp: now,
      operator: '林老师',
      description: `处理异常：${ANOMALY_TYPE_LABELS[anomaly.type]} - ${anomaly.description.slice(0, 40)}${anomaly.description.length > 40 ? '...' : ''}`,
      details: {
        anomalyId,
        anomalyType: anomaly.type,
        deviceId: anomaly.deviceId,
        remark: remark || '',
      },
    };

    const updatedSolution = {
      ...currentSolution,
      anomalies: updatedAnomalies,
      operationLogs: [...(currentSolution.operationLogs || []), operationLog],
      updatedAt: now,
    };

    const snap = get().takeSnapshot.call({ ...get(), currentSolution: updatedSolution });
    if (snap) {
      updatedSolution.snapshots = [...(currentSolution.snapshots || []), snap];
    }

    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) => (s.id === currentSolution.id ? updatedSolution : s)),
    });
  },

  addRemark: (remark) => {
    const { currentSolution, solutions } = get();
    if (!currentSolution) return;

    const now = new Date().toISOString();
    const log: OperationLog = {
      id: uuidv4(),
      type: 'remark_added',
      timestamp: now,
      operator: '林老师',
      description: remark.slice(0, 60) + (remark.length > 60 ? '...' : ''),
      details: { text: remark },
    };

    const updatedSolution = {
      ...currentSolution,
      remarks: [...currentSolution.remarks, remark],
      operationLogs: [...(currentSolution.operationLogs || []), log],
      updatedAt: now,
    };

    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) => (s.id === currentSolution.id ? updatedSolution : s)),
    });
  },

  detectAnomalies: () => {
    const { currentSolution, currentConfig } = get();
    if (!currentSolution) return [];
    return detectAllAnomalies(currentSolution.devices, currentConfig);
  },

  mergeSameDevice: (sourceDeviceId, targetDeviceId, canonicalName) => {
    const { currentSolution, solutions, currentConfig } = get();
    if (!currentSolution) return;

    const sourceDevice = currentSolution.devices.find((d) => d.id === sourceDeviceId);
    const targetDevice = currentSolution.devices.find((d) => d.id === targetDeviceId);
    if (!sourceDevice || !targetDevice) return;

    const now = new Date().toISOString();

    const updatedDevices = currentSolution.devices
      .map((d) => {
        if (d.id === sourceDeviceId) {
          return {
            ...d,
            isDuplicate: true,
            mergedFromId: sourceDeviceId,
            name: canonicalName,
          };
        }
        if (d.id === targetDeviceId) {
          const aliases = [...(d.aliasNames || []), sourceDevice.name];
          if (!aliases.includes(canonicalName) && canonicalName !== d.name) {
            aliases.push(d.name);
          }
          return {
            ...d,
            name: canonicalName,
            aliasNames: aliases.filter((n) => n !== canonicalName),
          };
        }
        return d;
      })
      .filter((d) => d.id !== sourceDeviceId);

    const newAnomalies = detectAllAnomalies(updatedDevices, currentConfig);

    const log: OperationLog = {
      id: uuidv4(),
      type: 'device_merged',
      timestamp: now,
      operator: '林老师',
      description: `设备合并："${sourceDevice.name}" 并入 "${targetDevice.name}"，规范名：${canonicalName}`,
      details: {
        sourceDeviceId,
        sourceDeviceName: sourceDevice.name,
        targetDeviceId,
        targetDeviceName: targetDevice.name,
        canonicalName,
      },
    };

    const mergedRecord = { sourceId: sourceDeviceId, targetId: targetDeviceId, timestamp: now };

    const updatedSolution = {
      ...currentSolution,
      devices: updatedDevices,
      anomalies: newAnomalies,
      mergedDevices: [...(currentSolution.mergedDevices || []), mergedRecord],
      operationLogs: [...(currentSolution.operationLogs || []), log],
      updatedAt: now,
    };

    const snap = get().takeSnapshot.call({ ...get(), currentSolution: updatedSolution });
    if (snap) {
      updatedSolution.snapshots = [...(currentSolution.snapshots || []), snap];
    }

    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) => (s.id === currentSolution.id ? updatedSolution : s)),
      selectedDevice: updatedDevices.find((d) => d.id === targetDeviceId) || null,
    });
  },

  takeSnapshot: () => {
    const { currentSolution } = get();
    if (!currentSolution) return null;
    return {
      timestamp: new Date().toISOString(),
      deviceCount: currentSolution.devices.length,
      anomalyCount: currentSolution.anomalies.length,
      unresolvedAnomalyCount: currentSolution.anomalies.filter((a) => !a.resolved).length,
      resolvedAnomalyCount: currentSolution.anomalies.filter((a) => a.resolved).length,
      anomaliesByType: countAnomaliesByType(currentSolution),
      totalEnergy: currentSolution.devices.reduce((s, d) => s + d.energyConsumption, 0),
      remarksCount: currentSolution.remarks.length,
    };
  },

  addOperationLog: (type, description, details) => {
    const { currentSolution, solutions } = get();
    if (!currentSolution) return;
    const log: OperationLog = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      operator: '林老师',
      description,
      details,
    };
    const updatedSolution = {
      ...currentSolution,
      operationLogs: [...(currentSolution.operationLogs || []), log],
    };
    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) => (s.id === currentSolution.id ? updatedSolution : s)),
    });
  },

  exportStructuredReport: () => {
    const { currentSolution, currentConfig } = get();
    if (!currentSolution) return null;

    const devicesInfo = currentSolution.devices.map((d) => {
      const deviceAnomalies = currentSolution.anomalies.filter((a) => a.deviceId === d.id);
      return {
        设备ID: d.id,
        设备名称: d.name,
        楼层: d.floor + 'F',
        坐标: `X:${d.position.x.toFixed(2)}, Y:${d.position.y.toFixed(2)}, Z:${d.position.z.toFixed(2)}`,
        能耗kWh: d.energyConsumption,
        状态: d.status === 'normal' ? '正常' : d.status === 'warning' ? '警告' : '错误',
        别名记录: d.aliasNames?.join('、') || '-',
        是否被合并: d.isDuplicate ? '是' : '否',
        异常数: deviceAnomalies.length,
        待处理异常数: deviceAnomalies.filter((a) => !a.resolved).length,
      };
    });

    const anomaliesInfo = currentSolution.anomalies.map((a) => {
      const dev = currentSolution.devices.find((d) => d.id === a.deviceId);
      const relDev = a.relatedDeviceId
        ? currentSolution.devices.find((d) => d.id === a.relatedDeviceId)
        : null;
      return {
        异常ID: a.id,
        异常类型: ANOMALY_TYPE_LABELS[a.type] || a.type,
        所属设备: dev?.name || '未知',
        设备ID: a.deviceId,
        关联设备: relDev?.name || '-',
        关联设备ID: a.relatedDeviceId || '-',
        描述: a.description,
        严重程度: a.severity === 'low' ? '低' : a.severity === 'medium' ? '中' : '高',
        是否已处理: a.resolved ? '是' : '否',
        处理备注: a.remark || '-',
        处理时间: a.resolvedAt || '-',
        处理人: a.resolvedBy || '-',
      };
    });

    const diffComparison: any[] = [];
    const snaps = currentSolution.snapshots || [];
    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1];
      const curr = snaps[i];
      diffComparison.push({
        对比时间点: `${new Date(prev.timestamp).toLocaleString()} → ${new Date(curr.timestamp).toLocaleString()}`,
        设备数变化: `${prev.deviceCount} → ${curr.deviceCount}（${curr.deviceCount - prev.deviceCount >= 0 ? '+' : ''}${curr.deviceCount - prev.deviceCount}）`,
        异常总数变化: `${prev.anomalyCount} → ${curr.anomalyCount}（${curr.anomalyCount - prev.anomalyCount >= 0 ? '+' : ''}${curr.anomalyCount - prev.anomalyCount}）`,
        待处理变化: `${prev.unresolvedAnomalyCount} → ${curr.unresolvedAnomalyCount}（${curr.unresolvedAnomalyCount - prev.unresolvedAnomalyCount >= 0 ? '+' : ''}${curr.unresolvedAnomalyCount - prev.unresolvedAnomalyCount}）`,
        已处理变化: `${prev.resolvedAnomalyCount} → ${curr.resolvedAnomalyCount}（${curr.resolvedAnomalyCount - prev.resolvedAnomalyCount >= 0 ? '+' : ''}${curr.resolvedAnomalyCount - prev.resolvedAnomalyCount}）`,
        总能耗变化: `${prev.totalEnergy.toFixed(1)} → ${curr.totalEnergy.toFixed(1)} kWh`,
        备注数变化: `${prev.remarksCount} → ${curr.remarksCount}`,
      });
    }

    const operationLogs = (currentSolution.operationLogs || []).map((l) => ({
      时间: new Date(l.timestamp).toLocaleString(),
      操作类型: {
        anomaly_resolved: '异常处理',
        remark_added: '添加备注',
        device_merged: '设备合并',
        device_renamed: '设备重命名',
        config_updated: '参数更新',
        solution_created: '方案创建',
      }[l.type] || l.type,
      操作人: l.operator,
      描述: l.description,
      详情: JSON.stringify(l.details || {}),
    }));

    const report = {
      基本信息: {
        方案名称: currentSolution.name,
        方案状态: {
          draft: '草稿',
          reviewing: '审核中',
          approved: '已批准',
          rework: '返工中',
        }[currentSolution.status] || currentSolution.status,
        操作人: currentSolution.operator,
        创建时间: new Date(currentSolution.createdAt).toLocaleString(),
        更新时间: new Date(currentSolution.updatedAt).toLocaleString(),
        导出时间: new Date().toLocaleString(),
      },
      检测参数配置: {
        配置名称: currentConfig.name,
        警告阈值kWh: currentConfig.energyThreshold.warning,
        错误阈值kWh: currentConfig.energyThreshold.error,
        坐标容差m: currentConfig.coordinateTolerance,
        同设备位置容差m: currentConfig.sameDevicePositionTolerance,
        同设备能耗容差: (currentConfig.sameDeviceEnergyTolerance * 100).toFixed(1) + '%',
      },
      汇总统计: {
        设备总数: currentSolution.devices.length,
        异常总数: currentSolution.anomalies.length,
        已处理: currentSolution.anomalies.filter((a) => a.resolved).length,
        待处理: currentSolution.anomalies.filter((a) => !a.resolved).length,
        处理进度:
          currentSolution.anomalies.length > 0
            ? (
                (currentSolution.anomalies.filter((a) => a.resolved).length /
                  currentSolution.anomalies.length) *
                100
              ).toFixed(1) + '%'
            : '0%',
        总能耗kWh: currentSolution.devices.reduce((s, d) => s + d.energyConsumption, 0).toFixed(2),
        合并记录数: (currentSolution.mergedDevices || []).length,
        操作日志数: (currentSolution.operationLogs || []).length,
      },
      异常类型统计: Object.entries(countAnomaliesByType(currentSolution)).map(([type, count]) => ({
        异常类型: ANOMALY_TYPE_LABELS[type as keyof typeof ANOMALY_TYPE_LABELS] || type,
        数量: count,
      })),
      设备明细: devicesInfo,
      异常明细: anomaliesInfo,
      补录前后差异对比: diffComparison,
      操作历史记录: operationLogs,
      备注列表: currentSolution.remarks.map((r, idx) => ({ 序号: idx + 1, 内容: r })),
      合并记录: (currentSolution.mergedDevices || []).map((m) => {
        const srcDev = currentSolution.devices.find((d) => d.id === m.targetId);
        return {
          时间: new Date(m.timestamp).toLocaleString(),
          被合并设备ID: m.sourceId,
          并入目标设备ID: m.targetId,
          目标设备当前名称: srcDev?.name || '-',
        };
      }),
    };

    return report;
  },
}));

export function createNewSolution(
  name: string,
  devices: DeviceData[],
  config: ParameterConfig
): Solution {
  const now = new Date().toISOString();
  const anomalies = detectAllAnomalies(devices, config);
  return {
    id: uuidv4(),
    name,
    configId: config.id,
    devices,
    anomalies,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    operator: '林老师',
    remarks: [],
    operationLogs: [],
    snapshots: [
      {
        timestamp: now,
        deviceCount: devices.length,
        anomalyCount: anomalies.length,
        unresolvedAnomalyCount: anomalies.filter((a) => !a.resolved).length,
        resolvedAnomalyCount: anomalies.filter((a) => a.resolved).length,
        anomaliesByType: countAnomaliesByType({ anomalies } as Solution),
        totalEnergy: devices.reduce((s, d) => s + d.energyConsumption, 0),
        remarksCount: 0,
      },
    ],
    mergedDevices: [],
  };
}
