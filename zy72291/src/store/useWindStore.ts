import { create } from 'zustand';
import type {
  PointCloudLog,
  SafetyRadius,
  SafetyReport,
  OperationLog,
  LogStatus,
  UserRole,
  ManualCorrection,
  WindSpeed,
  RadiusVersion,
  ReportResult,
  ReportItem,
  ComplianceStatus,
  RecordType,
  RadiusVersionReport,
  ReportStatus,
} from '../../shared/types';
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
  addManualCorrection: (correction: Omit<ManualCorrection, 'id' | 'timestamp'>) => void;
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

const generateId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}`;

const speedToWindSpeedLevel = (speed: number): WindSpeed => {
  if (speed < 6) return 'low';
  if (speed < 12) return 'medium';
  return 'high';
};

const calculateCompliance = (
  measured: number,
  required: number,
  status: LogStatus
): ComplianceStatus => {
  if (status === 'pending_review') return 'pending';
  const diff: number = measured - required;
  if (diff >= 0) return 'compliant';
  if (diff >= -20) return 'warning';
  return 'non_compliant';
};

const buildReport = (
  logs: PointCloudLog[],
  radiusTable: SafetyRadius[]
): SafetyReport => {
  const results: ReportResult[] = logs.map((log: PointCloudLog): ReportResult => {
    const version: RadiusVersion = log.status === 'legacy' ? 'legacy' : 'new';
    const windDir: number = log.windDirection ?? 180;
    const windSpeedNum: number = log.windSpeed ?? 4.5;
    const windSpeedLevel: WindSpeed = speedToWindSpeedLevel(windSpeedNum);
    const normalizedDir: number = (Math.round(windDir / 45) * 45) % 360;

    const radiusRecord: SafetyRadius | undefined =
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === normalizedDir &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      ) ??
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === 0 &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      );

    const requiredDistance: number = radiusRecord?.radius ?? 200;
    const safetyDistance: number =
      log.measuredDistance ??
      (log.status === 'success'
        ? 185
        : log.status === 'pending_review'
          ? 88
          : 195);
    const recordType: RecordType =
      log.status === 'success'
        ? 'success'
        : log.status === 'legacy'
          ? 'legacy'
          : 'blocked';

    const note: string =
      log.notes ??
      (log.status === 'success'
        ? '数据完整，合规'
        : log.status === 'pending_review'
          ? '截图遮挡，读数存疑，待复核'
          : '旧口径补录，已标注新旧标准差异');

    return {
      id: `RES-${log.id}`,
      recordId: log.id,
      recordType,
      safetyDistance,
      requiredDistance,
      compliance: safetyDistance >= requiredDistance,
      note,
      windDirection: normalizedDir,
      windSpeed: windSpeedLevel,
    };
  });

  const items: ReportItem[] = logs.map((log: PointCloudLog): ReportItem => {
    const version: RadiusVersion = log.status === 'legacy' ? 'legacy' : 'new';
    const windDir: number = log.windDirection ?? 180;
    const windSpeedNum: number = log.windSpeed ?? 4.5;
    const windSpeedLevel: WindSpeed = speedToWindSpeedLevel(windSpeedNum);
    const normalizedDir: number = (Math.round(windDir / 45) * 45) % 360;

    const radiusRecord: SafetyRadius | undefined =
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === normalizedDir &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      ) ??
      radiusTable.find(
        (r: SafetyRadius): boolean =>
          r.windDirection === 0 &&
          r.windSpeed === windSpeedLevel &&
          r.version === version
      );

    const requiredDistance: number = radiusRecord?.radius ?? 200;
    const measuredDistance: number = log.measuredDistance ?? 150;
    const diff: number = measuredDistance - requiredDistance;

    return {
      logId: log.id,
      batchNo: log.batchNo,
      status: log.status,
      windDirection: normalizedDir,
      windSpeed: windSpeedNum,
      measuredDistance,
      requiredDistance,
      diff,
      compliance: calculateCompliance(measuredDistance, requiredDistance, log.status),
      hasScreenshotOcclusion: log.hasScreenshotOcclusion,
      occlusionArea: log.occlusionArea ?? 0,
      version: version === 'new' ? '2024' : '2023',
      notes: log.notes ?? '',
    };
  });

  const stats: {
    total: number;
    compliant: number;
    warning: number;
    nonCompliant: number;
    pendingReview: number;
  } = {
    total: logs.length,
    compliant: items.filter((i: ReportItem): boolean => i.compliance === 'compliant').length,
    warning: items.filter((i: ReportItem): boolean => i.compliance === 'warning').length,
    nonCompliant: items.filter((i: ReportItem): boolean => i.compliance === 'non_compliant').length,
    pendingReview: items.filter((i: ReportItem): boolean => i.compliance === 'pending').length,
  };

  const hasLegacy: boolean = radiusTable.some((r: SafetyRadius): boolean => r.version === 'legacy');
  const hasNew: boolean = radiusTable.some((r: SafetyRadius): boolean => r.version === 'new');
  const radiusVersion: RadiusVersionReport =
    hasLegacy && hasNew ? 'mixed' : (radiusTable[0]?.version ?? 'new');

  const status: ReportStatus = logs.some(
    (l: PointCloudLog): boolean => l.status === 'pending_review'
  )
    ? 'pending_review'
    : 'draft';

  const notes: string = logs.some((l: PointCloudLog): boolean => l.status === 'pending_review')
    ? '报告包含待复核记录，需施工经理确认后才能最终批准'
    : '所有记录已处理完成';

  const summary: string = `共${logs.length}条记录，其中合规${stats.compliant}条，待复核${stats.pendingReview}条，预警${stats.warning}条，不合规${stats.nonCompliant}条`;

  return {
    id: generateId('RPT'),
    generatedAt: new Date().toISOString(),
    generatedBy: '系统自动生成',
    logIds: logs.map((l: PointCloudLog): string => l.id),
    radiusVersion,
    results,
    items,
    stats,
    status,
    notes,
    summary,
  };
};

export const useWindStore = create<WindState>((set, get) => ({
  logs: demoLogs,
  radiusTable: demoRadius,
  report: generateDemoReport(),
  operations: demoOperations,
  currentRole: 'engineer',
  isDemoMode: true,

  setLogs: (logs: PointCloudLog[]): void => set({ logs }),

  addLog: (log: PointCloudLog): void =>
    set((state: WindState) => ({
      logs: [...state.logs, log],
      operations: [
        ...state.operations,
        {
          id: generateId('OP'),
          operator: state.currentRole,
          operatorName: state.currentRole === 'engineer' ? '许工' : '施工经理',
          action: '导入点云抽稀日志',
          timestamp: new Date().toISOString(),
          detail: `导入批次 ${log.batchNo}，点数 ${(log.pointCount / 10000).toFixed(0)}万，抽稀率 ${(log.thinningRate * 100).toFixed(0)}%`,
          targetId: log.id,
        },
      ],
    })),

  updateLogStatus: (logId: string, status: LogStatus, note?: string): void =>
    set((state: WindState) => ({
      logs: state.logs.map((log: PointCloudLog): PointCloudLog =>
        log.id === logId
          ? { ...log, status, screenshotNote: note || log.screenshotNote }
          : log
      ),
      operations: [
        ...state.operations,
        {
          id: generateId('OP'),
          operator: state.currentRole,
          operatorName: state.currentRole === 'engineer' ? '许工' : '施工经理',
          action: status === 'pending_review' ? '标记待复核' : '更新状态',
          timestamp: new Date().toISOString(),
          detail: note || `更新 ${logId} 状态为 ${status}`,
          targetId: logId,
        },
      ],
    })),

  addManualCorrection: (correction: Omit<ManualCorrection, 'id' | 'timestamp'>): void =>
    set((state: WindState) => {
      const newCorrection: ManualCorrection = {
        ...correction,
        id: generateId('CORR'),
        timestamp: new Date().toISOString(),
      };
      return {
        logs: state.logs.map((log: PointCloudLog): PointCloudLog =>
          log.id === correction.logId
            ? {
                ...log,
                manualCorrections: [...(log.manualCorrections ?? []), newCorrection],
              }
            : log
        ),
        operations: [
          ...state.operations,
          {
            id: generateId('OP'),
            operator: state.currentRole,
            operatorName: correction.operator,
            action: '人工修正',
            timestamp: new Date().toISOString(),
            detail: `修正 ${correction.field}: ${String(correction.oldValue)} → ${String(correction.newValue)}，原因：${correction.reason}`,
            targetId: correction.logId,
          },
        ],
      };
    }),

  incrementRerun: (logId: string): void =>
    set((state: WindState) => {
      const targetLog: PointCloudLog | undefined = state.logs.find(
        (l: PointCloudLog): boolean => l.id === logId
      );
      const nextCount: number = targetLog ? targetLog.rerunCount + 1 : 1;
      return {
        logs: state.logs.map((log: PointCloudLog): PointCloudLog =>
          log.id === logId
            ? { ...log, rerunCount: log.rerunCount + 1 }
            : log
        ),
        operations: [
          ...state.operations,
          {
            id: generateId('OP'),
            operator: state.currentRole,
            operatorName: '许工',
            action: '重跑分析',
            timestamp: new Date().toISOString(),
            detail: `${logId} 第 ${nextCount} 次重跑完成`,
            targetId: logId,
          },
        ],
      };
    }),

  setRadiusTable: (table: SafetyRadius[]): void => set({ radiusTable: table }),

  addRadiusEntry: (entry: SafetyRadius): void =>
    set((state: WindState) => ({
      radiusTable: [...state.radiusTable, entry],
      operations: [
        ...state.operations,
        {
          id: generateId('OP'),
          operator: state.currentRole,
          operatorName: '许工',
          action: '补录安全半径表',
          timestamp: new Date().toISOString(),
          detail: `补录 ${entry.windDirection}度 ${entry.windSpeed} 半径 ${entry.radius}米 (${entry.version === 'new' ? '新口径' : '旧口径'})`,
        },
      ],
    })),

  setReport: (report: SafetyReport | null): void => set({ report }),

  generateReport: (): void => {
    const state: WindState = get();
    const newReport: SafetyReport = buildReport(state.logs, state.radiusTable);

    set({
      report: newReport,
      operations: [
        ...state.operations,
        {
          id: generateId('OP'),
          operator: state.currentRole,
          operatorName: '许工',
          action: '生成安全距离报告',
          timestamp: new Date().toISOString(),
          detail: `生成报告 ${newReport.id}，包含 ${state.logs.length} 条记录`,
        },
      ],
    });
  },

  addOperation: (operation: Omit<OperationLog, 'id' | 'timestamp'>): void =>
    set((state: WindState) => ({
      operations: [
        ...state.operations,
        {
          ...operation,
          id: generateId('OP'),
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  setCurrentRole: (role: UserRole): void => set({ currentRole: role }),

  resetToDemo: (): void =>
    set({
      logs: demoLogs,
      radiusTable: demoRadius,
      report: generateDemoReport(),
      operations: demoOperations,
      isDemoMode: true,
    }),

  importLogFile: (fileData: Partial<PointCloudLog>): PointCloudLog => {
    const hasOcclusion: boolean = (fileData.hasScreenshotOcclusion) ?? (Math.random() > 0.6);
    const windDirection: number =
      fileData.windDirection ?? Math.floor(Math.random() * 8) * 45;
    const windSpeed: number =
      fileData.windSpeed ?? +(3 + Math.random() * 10).toFixed(1);
    const measuredDistance: number =
      fileData.measuredDistance ?? Math.floor(80 + Math.random() * 150);
    const occlusionArea: number = hasOcclusion
      ? (fileData.occlusionArea ?? Math.floor(20 + Math.random() * 40))
      : (fileData.occlusionArea ?? 0);

    const baseNotes: string = hasOcclusion
      ? '检测到疑似截图遮挡，需人工确认'
      : '导入成功，数据质量正常';
    const notes: string = fileData.notes ?? baseNotes;

    const newLog: PointCloudLog = {
      id: generateId('LOG'),
      timestamp: new Date().toISOString(),
      batchNo: fileData.batchNo || `PC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-A`,
      pointCount: fileData.pointCount ?? Math.floor(Math.random() * 500000) + 900000,
      thinningRate: fileData.thinningRate ?? 0.8 + Math.random() * 0.1,
      alerts: fileData.alerts ?? [],
      status: hasOcclusion ? 'pending_review' : 'success',
      source: fileData.source ?? '导入',
      hasScreenshotOcclusion: hasOcclusion,
      screenshotNote: hasOcclusion ? '检测到疑似截图遮挡，需人工确认' : undefined,
      rerunCount: 0,
      windDirection,
      windSpeed,
      measuredDistance,
      occlusionArea,
      notes,
      operator: fileData.operator ?? '许工',
    };

    get().addLog(newLog);
    return newLog;
  },
}));
