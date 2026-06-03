import { create } from 'zustand';
import type { PointCloudLog, SafetyRadius, SafetyReport, OperationLog, LogStatus, UserRole } from '../../shared/types';
import { demoLogs, demoRadius, demoOperations, generateDemoReport } from '../data/demoData';

interface WindState {
  logs: PointCloudLog[];
  radiusTable: SafetyRadius[];
  report: SafetyReport | null;
  operations: OperationLog[];
  currentRole: UserRole;
  isDemoMode: boolean;
  
  setLogs: (logs: PointCloudLog[]) => void;
  addLog: (log: PointCloudLog) => void;
  updateLogStatus: (logId: string, status: LogStatus, note?: string) => void;
  addManualCorrection: (logId: string, correction: string) => void;
  incrementRerun: (logId: string) => void;
  
  setRadiusTable: (table: SafetyRadius[]) => void;
  addRadiusEntry: (entry: SafetyRadius) => void;
  
  setReport: (report: SafetyReport | null) => void;
  generateReport: () => void;
  
  addOperation: (operation: Omit<OperationLog, 'id' | 'timestamp'>) => void;
  
  setCurrentRole: (role: UserRole) => void;
  resetToDemo: () => void;
  importLogFile: (fileData: Partial<PointCloudLog>) => PointCloudLog;
}

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

export const useWindStore = create<WindState>((set, get) => ({
  logs: demoLogs,
  radiusTable: demoRadius,
  report: generateDemoReport(),
  operations: demoOperations,
  currentRole: 'engineer',
  isDemoMode: true,

  setLogs: (logs) => set({ logs }),
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log],
    operations: [...state.operations, {
      id: generateId('OP'),
      operator: state.currentRole,
      operatorName: state.currentRole === 'engineer' ? '许工' : '施工经理',
      action: '导入点云抽稀日志',
      timestamp: new Date().toISOString(),
      detail: `导入批次 ${log.batchNo}，点数 ${(log.pointCount / 10000).toFixed(0)}万，抽稀率 ${(log.thinningRate * 100).toFixed(0)}%`,
      targetId: log.id
    }]
  })),

  updateLogStatus: (logId, status, note) => set((state) => ({
    logs: state.logs.map(log => 
      log.id === logId 
        ? { ...log, status, screenshotNote: note || log.screenshotNote }
        : log
    ),
    operations: [...state.operations, {
      id: generateId('OP'),
      operator: state.currentRole,
      operatorName: state.currentRole === 'engineer' ? '许工' : '施工经理',
      action: status === 'pending_review' ? '标记待复核' : '更新状态',
      timestamp: new Date().toISOString(),
      detail: note || `更新 ${logId} 状态为 ${status}`,
      targetId: logId
    }]
  })),

  addManualCorrection: (logId, correction) => set((state) => ({
    logs: state.logs.map(log =>
      log.id === logId
        ? { ...log, manualCorrection: correction }
        : log
    ),
    operations: [...state.operations, {
      id: generateId('OP'),
      operator: state.currentRole,
      operatorName: '许工',
      action: '人工修正',
      timestamp: new Date().toISOString(),
      detail: correction,
      targetId: logId
    }]
  })),

  incrementRerun: (logId) => set((state) => ({
    logs: state.logs.map(log =>
      log.id === logId
        ? { ...log, rerunCount: log.rerunCount + 1 }
        : log
    ),
    operations: [...state.operations, {
      id: generateId('OP'),
      operator: state.currentRole,
      operatorName: '许工',
      action: '重跑分析',
      timestamp: new Date().toISOString(),
      detail: `${logId} 第 ${state.logs.find(l => l.id === logId)?.rerunCount! + 1} 次重跑完成`,
      targetId: logId
    }]
  })),

  setRadiusTable: (table) => set({ radiusTable: table }),
  
  addRadiusEntry: (entry) => set((state) => ({
    radiusTable: [...state.radiusTable, entry],
    operations: [...state.operations, {
      id: generateId('OP'),
      operator: state.currentRole,
      operatorName: '许工',
      action: '补录安全半径表',
      timestamp: new Date().toISOString(),
      detail: `补录 ${entry.windDirection}度 ${entry.windSpeed} 半径 ${entry.radius}米 (${entry.version === 'new' ? '新口径' : '旧口径'})`,
    }]
  })),

  setReport: (report) => set({ report }),
  
  generateReport: () => {
    const state = get();
    const newReport: SafetyReport = {
      id: generateId('RPT'),
      generatedAt: new Date().toISOString(),
      logIds: state.logs.map(l => l.id),
      radiusVersion: state.radiusTable.some(r => r.version === 'legacy') && state.radiusTable.some(r => r.version === 'new')
        ? 'mixed'
        : state.radiusTable[0]?.version || 'new',
      status: state.logs.some(l => l.status === 'pending_review') ? 'pending_review' : 'draft',
      notes: state.logs.some(l => l.status === 'pending_review') 
        ? '报告包含待复核记录，需施工经理确认后才能最终批准'
        : '所有记录已处理完成',
      results: state.logs.map(log => {
        const windDir = log.alerts[0]?.position.x > 0 ? (log.alerts[0].position.y > 0 ? 45 : 315) : (log.alerts[0].position.y > 0 ? 135 : 225);
        const windSpeed = log.pointCount > 1100000 ? 'high' : log.pointCount > 1000000 ? 'medium' : 'low';
        const requiredRadius = state.radiusTable.find(r => 
          r.windDirection === windDir && r.windSpeed === windSpeed && r.version === 'new'
        )?.radius || 200;
        
        const safetyDistance = log.status === 'success' ? 185 : log.status === 'pending_review' ? 88 : 195;
        const recordType = log.status === 'success' ? 'success' : log.status === 'legacy' ? 'legacy' : 'blocked';
        
        return {
          id: generateId('RES'),
          recordId: log.id,
          recordType,
          safetyDistance,
          requiredDistance: requiredRadius,
          compliance: safetyDistance >= requiredRadius,
          note: log.status === 'success' 
            ? '数据完整，合规' 
            : log.status === 'pending_review'
              ? '截图遮挡，读数存疑，待复核'
              : '旧口径补录，已标注新旧标准差异',
          windDirection: windDir,
          windSpeed
        };
      })
    };
    
    set({
      report: newReport,
      operations: [...state.operations, {
        id: generateId('OP'),
        operator: state.currentRole,
        operatorName: '许工',
        action: '生成安全距离报告',
        timestamp: new Date().toISOString(),
        detail: `生成报告 ${newReport.id}，包含 ${state.logs.length} 条记录`,
      }]
    });
  },

  addOperation: (operation) => set((state) => ({
    operations: [...state.operations, {
      ...operation,
      id: generateId('OP'),
      timestamp: new Date().toISOString()
    }]
  })),

  setCurrentRole: (role) => set({ currentRole: role }),

  resetToDemo: () => set({
    logs: demoLogs,
    radiusTable: demoRadius,
    report: generateDemoReport(),
    operations: demoOperations,
    isDemoMode: true
  }),

  importLogFile: (fileData) => {
    const hasOcclusion = Math.random() > 0.6;
    const newLog: PointCloudLog = {
      id: generateId('LOG'),
      timestamp: new Date().toISOString(),
      batchNo: fileData.batchNo || `PC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-A`,
      pointCount: fileData.pointCount || Math.floor(Math.random() * 500000) + 900000,
      thinningRate: fileData.thinningRate || 0.8 + Math.random() * 0.1,
      alerts: fileData.alerts || [],
      status: hasOcclusion ? 'pending_review' : 'success',
      source: fileData.source || '导入',
      hasScreenshotOcclusion: hasOcclusion,
      screenshotNote: hasOcclusion ? '检测到疑似截图遮挡，需人工确认' : undefined,
      rerunCount: 0
    };
    
    get().addLog(newLog);
    return newLog;
  }
}));
