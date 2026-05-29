import { create } from 'zustand';
import {
  CheckResult,
  ExposureLog,
  UserBucket,
  OperationChange,
  ConversionData,
  EvidenceChain,
  LogEntry,
  CheckConfig,
  DEFAULT_CHECK_CONFIG,
  ContaminationType
} from '../types';
import { BucketValidationEngine } from '../engines/BucketValidationEngine';
import { ChangeSlicingEngine, Phase } from '../engines/ChangeSlicingEngine';
import { ContaminationMarkingEngine } from '../engines/ContaminationMarkingEngine';
import { MetricRecalculationEngine } from '../engines/MetricRecalculationEngine';
import { ConsistencyCheckEngine } from '../engines/ConsistencyCheckEngine';
import { EvidenceChainEngine } from '../engines/EvidenceChainEngine';
import { FileParserEngine } from '../engines/FileParserEngine';

interface CheckState {
  isRunning: boolean;
  isChecking: boolean;
  isPaused: boolean;
  currentPhase: string;
  currentStep: number;
  progress: number;
  logs: LogEntry[];
  result: CheckResult | null;
  checkResult: CheckResult | null;
  markedExposures: Map<string, ExposureLog>;
  userBucketsMap: Map<string, UserBucket[]>;
  checkConfig: CheckConfig;
  phases: Phase[];
  startTime: number | null;
  
  setCheckConfig: (config: Partial<CheckConfig>) => void;
  setCheckResult: (result: CheckResult | null) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  
  startCheck: (
    userBuckets: UserBucket[],
    exposureLogs: ExposureLog[],
    operationChanges: OperationChange[],
    conversionData: ConversionData[],
    config?: Partial<CheckConfig>
  ) => Promise<void>;
  pauseCheck: () => void;
  resumeCheck: () => void;
  resetCheck: () => void;
  
  getEvidenceChain: (exposureId: string) => EvidenceChain | null;
  getExposureById: (exposureId: string) => ExposureLog | undefined;
  getExposuresByUserId: (userId: string) => ExposureLog[];
  getExposuresByContaminationType: (type: ContaminationType) => ExposureLog[];
  
  getExposuresArray: () => ExposureLog[];
  searchExposures: (
    query: string,
    filters?: {
      contaminationType?: ContaminationType;
      groupId?: string;
      startTime?: number;
      endTime?: number;
    },
    page?: number,
    pageSize?: number
  ) => {
    results: ExposureLog[];
    total: number;
    page: number;
    pageSize: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const useCheckStore = create<CheckState>((set, get) => ({
  isRunning: false,
  isChecking: false,
  isPaused: false,
  currentPhase: '',
  currentStep: 0,
  progress: 0,
  logs: [],
  result: null,
  checkResult: null,
  markedExposures: new Map(),
  userBucketsMap: new Map(),
  checkConfig: { ...DEFAULT_CHECK_CONFIG },
  phases: [],
  startTime: null,
  
  setCheckConfig: (config) => set((state) => ({
    checkConfig: { ...state.checkConfig, ...config }
  })),
  
  setCheckResult: (result) => set({ result, checkResult: result }),
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log].slice(-500)
  })),
  
  clearLogs: () => set({ logs: [] }),
  
  startCheck: async (userBuckets, exposureLogs, operationChanges, conversionData, config) => {
    const { checkConfig: currentConfig, addLog, setCheckConfig } = get();
    
    if (config) {
      setCheckConfig(config);
    }
    
    const checkConfig = { ...currentConfig, ...config };
    
    set({
      isRunning: true,
      isChecking: true,
      isPaused: false,
      progress: 0,
      currentPhase: '初始化',
      currentStep: 0,
      result: null,
      checkResult: null,
      markedExposures: new Map(),
      phases: [],
      startTime: Date.now()
    });
    
    addLog(FileParserEngine.createLogEntry(
      'info',
      '开始污染检查流程',
      `曝光记录: ${exposureLogs.length}条, 用户分桶: ${userBuckets.length}条, 运营变更: ${operationChanges.length}条, 转化数据: ${conversionData.length}条`
    ));
    
    await sleep(300);
    
    set({ currentPhase: '分桶校验', currentStep: 1, progress: 10 });
    addLog(FileParserEngine.createLogEntry(
      'info',
      '步骤1/5: 执行分桶校验',
      '检测用户串组情况...'
    ));
    
    const bucketResult = BucketValidationEngine.validate(userBuckets);
    
    const userBucketsMap = new Map<string, UserBucket[]>();
    userBuckets.forEach(bucket => {
      const key = `${bucket.userId}_${bucket.experimentId}`;
      if (!userBucketsMap.has(key)) {
        userBucketsMap.set(key, []);
      }
      userBucketsMap.get(key)!.push(bucket);
    });
    
    addLog(FileParserEngine.createLogEntry(
      bucketResult.crossGroupRate > 0 ? 'warn' : 'success',
      '分桶校验完成',
      `发现 ${bucketResult.crossGroupUserIds.length} 个串组用户, 串组率: ${(bucketResult.crossGroupRate * 100).toFixed(2)}%`
    ));
    
    await sleep(200);
    
    if (get().isPaused) {
      addLog(FileParserEngine.createLogEntry('warn', '检查已暂停'));
      return;
    }
    
    set({ currentPhase: '变更切片', currentStep: 2, progress: 30 });
    addLog(FileParserEngine.createLogEntry(
      'info',
      '步骤2/5: 执行变更切片',
      '根据运营变更时间点切分实验周期...'
    ));
    
    const sortedExposures = [...exposureLogs].sort((a, b) => a.exposureTime - b.exposureTime);
    const experimentStartTime = sortedExposures[0]?.exposureTime || Date.now();
    const experimentEndTime = sortedExposures[sortedExposures.length - 1]?.exposureTime || Date.now();
    
    const phases = ChangeSlicingEngine.createPhases(
      operationChanges,
      experimentStartTime,
      experimentEndTime + 1
    );
    
    addLog(FileParserEngine.createLogEntry(
      'success',
      '变更切片完成',
      `实验周期被切分为 ${phases.length} 个阶段`
    ));
    
    set({ phases });
    
    await sleep(200);
    
    if (get().isPaused) {
      addLog(FileParserEngine.createLogEntry('warn', '检查已暂停'));
      return;
    }
    
    set({ currentPhase: '污染标记', currentStep: 3, progress: 50 });
    addLog(FileParserEngine.createLogEntry(
      'info',
      '步骤3/5: 执行污染标记',
      '标记串组、重复曝光、配置变更污染...'
    ));
    
    const markingResult = ContaminationMarkingEngine.markAll(
      exposureLogs,
      userBuckets,
      operationChanges,
      checkConfig
    );
    
    const markedExposures = new Map<string, ExposureLog>();
    markingResult.markedExposures.forEach(exp => {
      markedExposures.set(exp.exposureId, exp);
    });
    
    const affectedUsers = ContaminationMarkingEngine.getAffectedUsers(markingResult.markedExposures);
    const contaminatedExposures = ContaminationMarkingEngine.getContaminatedExposures(markingResult.markedExposures);
    const summary = ContaminationMarkingEngine.getContaminationSummary(markingResult.markedExposures);
    
    addLog(FileParserEngine.createLogEntry(
      summary[ContaminationType.NONE] < markingResult.markedExposures.length ? 'warn' : 'success',
      '污染标记完成',
      `串组: ${summary[ContaminationType.CROSS_GROUP]}条, 重复曝光: ${summary[ContaminationType.DUPLICATE_EXPOSURE]}条, 配置变更: ${summary[ContaminationType.CONFIG_CHANGE]}条, 正常: ${summary[ContaminationType.NONE]}条`
    ));
    
    set({ markedExposures, userBucketsMap });
    
    await sleep(200);
    
    if (get().isPaused) {
      addLog(FileParserEngine.createLogEntry('warn', '检查已暂停'));
      return;
    }
    
    set({ currentPhase: '指标重算', currentStep: 4, progress: 70 });
    addLog(FileParserEngine.createLogEntry(
      'info',
      '步骤4/5: 执行指标重算',
      '排除污染数据后重新计算核心指标...'
    ));
    
    const originalMetrics = MetricRecalculationEngine.calculateOriginalMetrics(
      markingResult.markedExposures,
      conversionData
    );
    
    const recalculatedMetrics = MetricRecalculationEngine.calculateRecalculatedMetrics(
      markingResult.markedExposures,
      conversionData
    );
    
    const phaseResults = ChangeSlicingEngine.generatePhaseResults(
      phases,
      markingResult.markedExposures,
      conversionData
    );
    
    const comparison = MetricRecalculationEngine.calculateMetricsComparison(
      originalMetrics,
      recalculatedMetrics
    );
    
    addLog(FileParserEngine.createLogEntry(
      'success',
      '指标重算完成',
      `原始转化率: ${(originalMetrics.conversionRate * 100).toFixed(2)}%, ` +
      `修正转化率: ${(recalculatedMetrics.conversionRate * 100).toFixed(2)}%, ` +
      `变化: ${comparison.conversionRateDiffPercent >= 0 ? '+' : ''}${comparison.conversionRateDiffPercent.toFixed(2)}%`
    ));
    
    await sleep(200);
    
    if (get().isPaused) {
      addLog(FileParserEngine.createLogEntry('warn', '检查已暂停'));
      return;
    }
    
    set({ currentPhase: '一致性校验', currentStep: 5, progress: 90 });
    addLog(FileParserEngine.createLogEntry(
      'info',
      '步骤5/5: 执行一致性校验',
      '确保统计、详情、导出数据三者一致...'
    ));
    
    const consistencyChecksum = ConsistencyCheckEngine.generateChecksum(
      markingResult.markedExposures,
      conversionData
    );
    
    const totalExposures = markingResult.markedExposures.length;
    const contaminatedCount = markingResult.markedExposures.filter(e => e.isContaminated).length;
    
    const result: CheckResult = {
      totalExposures,
      contaminatedCount,
      crossGroupCount: markingResult.crossGroupCount,
      duplicateExposureCount: markingResult.duplicateCount,
      configChangeCount: markingResult.configChangeCount,
      contaminationRate: totalExposures > 0 ? contaminatedCount / totalExposures : 0,
      crossGroupRate: totalExposures > 0 ? markingResult.crossGroupCount / totalExposures : 0,
      duplicateRate: totalExposures > 0 ? markingResult.duplicateCount / totalExposures : 0,
      configChangeRate: totalExposures > 0 ? markingResult.configChangeCount / totalExposures : 0,
      affectedUsers,
      contaminatedExposures,
      phaseResults,
      recalculatedMetrics,
      originalMetrics,
      consistencyChecksum,
      processedAt: Date.now()
    };
    
    const consistencyReport = ConsistencyCheckEngine.performConsistencyCheck(
      markingResult.markedExposures,
      conversionData,
      result
    );
    
    addLog(FileParserEngine.createLogEntry(
      consistencyReport.isConsistent ? 'success' : 'error',
      '一致性校验完成',
      consistencyReport.summary + `, 校验和: ${consistencyChecksum}`
    ));
    
    set({
      isRunning: false,
      isChecking: false,
      currentPhase: '完成',
      currentStep: 6,
      progress: 100,
      result,
      checkResult: result
    });
    
    addLog(FileParserEngine.createLogEntry(
      'success',
      '污染检查流程全部完成',
      `总曝光: ${totalExposures}, 污染: ${contaminatedCount}, 污染率: ${(result.contaminationRate * 100).toFixed(2)}%`
    ));
  },
  
  pauseCheck: () => {
    set({ isPaused: true });
    get().addLog(FileParserEngine.createLogEntry('warn', '检查已暂停'));
  },
  
  resumeCheck: () => {
    set({ isPaused: false });
    get().addLog(FileParserEngine.createLogEntry('info', '检查已恢复'));
  },
  
  resetCheck: () => set({
    isRunning: false,
    isChecking: false,
    isPaused: false,
    currentPhase: '',
    currentStep: 0,
    progress: 0,
    result: null,
    checkResult: null,
    markedExposures: new Map(),
    userBucketsMap: new Map(),
    phases: [],
    startTime: null
  }),
  
  getEvidenceChain: (exposureId) => {
    const { markedExposures, userBucketsMap } = get();
    const fileStore = useFileStore.getState();
    
    return EvidenceChainEngine.getEvidenceChain(
      exposureId,
      markedExposures,
      userBucketsMap,
      fileStore.operationChanges,
      fileStore.conversionData
    );
  },
  
  getExposureById: (exposureId) => {
    return get().markedExposures.get(exposureId);
  },
  
  getExposuresByUserId: (userId) => {
    const exposures = Array.from(get().markedExposures.values());
    return exposures
      .filter(e => e.userId === userId)
      .sort((a, b) => a.exposureTime - b.exposureTime);
  },
  
  getExposuresByContaminationType: (type) => {
    const exposures = Array.from(get().markedExposures.values());
    return exposures.filter(e => e.contaminationType === type);
  },
  
  getExposuresArray: () => {
    return Array.from(get().markedExposures.values());
  },
  
  searchExposures: (query, filters, page = 1, pageSize = 50) => {
    const exposures = Array.from(get().markedExposures.values());
    
    let filtered = exposures;
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(e => 
        e.exposureId.toLowerCase().includes(lowerQuery) ||
        e.userId.toLowerCase().includes(lowerQuery) ||
        e.groupId.toLowerCase().includes(lowerQuery) ||
        e.configVersion.toLowerCase().includes(lowerQuery) ||
        e.contaminationReason?.toLowerCase().includes(lowerQuery)
      );
    }
    
    if (filters) {
      if (filters.contaminationType !== undefined) {
        filtered = filtered.filter(e => e.contaminationType === filters.contaminationType);
      }
      if (filters.groupId) {
        filtered = filtered.filter(e => e.groupId === filters.groupId);
      }
      if (filters.startTime) {
        filtered = filtered.filter(e => e.exposureTime >= filters.startTime!);
      }
      if (filters.endTime) {
        filtered = filtered.filter(e => e.exposureTime < filters.endTime!);
      }
    }
    
    const sorted = filtered.sort((a, b) => b.exposureTime - a.exposureTime);
    const total = sorted.length;
    const startIndex = (page - 1) * pageSize;
    const results = sorted.slice(startIndex, startIndex + pageSize);
    
    return { results, total, page, pageSize };
  }
}));

import { useFileStore } from './fileStore';
