import React, { useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Settings,
  Users,
  Eye,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  SlidersHorizontal,
  Database
} from 'lucide-react';
import { PageHeader, Card } from '../components/layout/MainLayout';
import { MetricCard } from '../components/common/MetricCard';
import { StepProgress, ProgressBar } from '../components/common/ProgressBar';
import { LogViewer } from '../components/common/LogViewer';
import { useFileStore } from '../stores/fileStore';
import { useCheckStore } from '../stores/checkStore';
import { CheckConfig, ContaminationType, LogEntry, ProcessStatus, DEFAULT_CHECK_CONFIG, FileType } from '../types';
import { formatNumber, formatPercent, formatDuration, formatTimestamp } from '../utils/format';
import { mockUserBuckets, mockExposureLogs, mockOperationChanges, mockConversionData } from '../data/mockData';
import { FileParserEngine } from '../engines/FileParserEngine';

export const CheckPage: React.FC = () => {
  const { userBuckets, exposureLogs, operationChanges, conversionData, setUserBuckets, setExposureLogs, setOperationChanges, setConversionData, addFile, fileObjects } = useFileStore();
  const {
    isChecking,
    progress,
    currentStep,
    checkResult,
    logs,
    startCheck,
    pauseCheck,
    resumeCheck,
    resetCheck,
    startTime,
    setCheckConfig
  } = useCheckStore();
  
  const [config, setConfig] = useState<CheckConfig>({
    ...DEFAULT_CHECK_CONFIG
  });
  
  const [showConfig, setShowConfig] = useState(false);
  
  const stepDefinitions = [
    { label: '分桶校验', status: 'pending' as const },
    { label: '变更切片', status: 'pending' as const },
    { label: '污染标记', status: 'pending' as const },
    { label: '指标重算', status: 'pending' as const },
    { label: '一致性校验', status: 'pending' as const }
  ];
  
  const stepsWithStatus = useMemo(() => {
    return stepDefinitions.map((step, index) => {
      let status: 'pending' | 'current' | 'completed' = 'pending';
      if (currentStep > 0 && index < currentStep - 1) status = 'completed';
      else if (index === currentStep - 1) status = 'current';
      else if (currentStep === 6 && index < stepDefinitions.length) status = 'completed';
      return { ...step, status };
    });
  }, [currentStep]);
  
  const canStart = !isChecking && (
    userBuckets.length > 0 &&
    exposureLogs.length > 0
  );
  
  const handleLoadMockData = useCallback(() => {
    setUserBuckets(mockUserBuckets);
    setExposureLogs(mockExposureLogs.map(e => ({ ...e, isContaminated: false, contaminationType: ContaminationType.NONE })));
    setOperationChanges(mockOperationChanges);
    setConversionData(mockConversionData);
    
    const fileTypes = [FileType.USER_BUCKET, FileType.EXPOSURE_LOG, FileType.OPERATION_CHANGE, FileType.CONVERSION_DATA];
    const fileNames = ['user_buckets', 'exposure_logs', 'operation_changes', 'conversion_data'];
    const mockData = [mockUserBuckets, mockExposureLogs, mockOperationChanges, mockConversionData];
    
    for (let i = 0; i < 4; i++) {
      const id = FileParserEngine.generateId();
      addFile({
        id,
        name: `mock_${fileNames[i]}.csv`,
        path: `mock_${fileNames[i]}.csv`,
        type: fileTypes[i],
        size: Math.floor(Math.random() * 10000) + 1000,
        status: ProcessStatus.SUCCESS,
        rowCount: mockData[i].length,
        createdAt: Date.now(),
        processedAt: Date.now()
      });
    }
  }, [setUserBuckets, setExposureLogs, setOperationChanges, setConversionData, addFile]);
  
  const handleUpdateConfig = useCallback((updates: Partial<CheckConfig>) => {
    setConfig(c => ({ ...c, ...updates }));
    setCheckConfig(updates);
  }, [setCheckConfig]);
  
  const handleStartCheck = useCallback(async () => {
    if (!canStart) return;
    
    await startCheck(
      userBuckets,
      exposureLogs,
      operationChanges,
      conversionData,
      config
    );
  }, [canStart, userBuckets, exposureLogs, operationChanges, conversionData, config, startCheck]);
  
  const handleCheckWithMock = useCallback(async () => {
    handleLoadMockData();
    
    setTimeout(async () => {
      const state = useFileStore.getState();
      await startCheck(
        state.userBuckets,
        state.exposureLogs,
        state.operationChanges,
        state.conversionData,
        config
      );
    }, 500);
  }, [handleLoadMockData, config, startCheck]);
  
  const elapsedTime = startTime && isChecking ? Date.now() - startTime : 0;
  
  return (
    <div>
      <PageHeader
        title="污染检查"
        description="执行数据污染检测，包括分桶校验、变更切片、污染标记、指标重算和一致性校验"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '污染检查' }]}
        actions={
          <>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              检查配置
            </button>
            <button
              onClick={handleLoadMockData}
              disabled={isChecking}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              加载模拟数据
            </button>
            <button
              onClick={handleCheckWithMock}
              disabled={isChecking}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              使用模拟数据运行
            </button>
            <button
              onClick={handleStartCheck}
              disabled={!canStart}
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isChecking ? '检查中...' : '开始检查'}
            </button>
          </>
        }
      />
      
      {/* Configuration Panel */}
      {showConfig && (
        <Card
          title="检查配置"
          subtitle="自定义污染检查的参数和选项"
          className="mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">检测选项</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.enableCrossGroupCheck}
                    onChange={(e) => handleUpdateConfig({ enableCrossGroupCheck: e.target.checked, markCrossGroup: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">用户串组检测</p>
                    <p className="text-xs text-gray-500">检测用户是否在实验过程中更换分组</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.enableDuplicateCheck}
                    onChange={(e) => handleUpdateConfig({ enableDuplicateCheck: e.target.checked, markDuplicate: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">重复曝光检测</p>
                    <p className="text-xs text-gray-500">检测同一用户在短时间内的多次曝光</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.enableConfigChangeCheck}
                    onChange={(e) => handleUpdateConfig({ enableConfigChangeCheck: e.target.checked, markConfigChange: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">配置变更检测</p>
                    <p className="text-xs text-gray-500">检测运营配置变更对实验的影响</p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">时间窗口</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    重复曝光窗口（分钟）
                  </label>
                  <input
                    type="number"
                    value={config.duplicateWindowMinutes}
                    onChange={(e) => handleUpdateConfig({ 
                      duplicateWindowMinutes: parseInt(e.target.value) || 0,
                      duplicateExposureThresholdMinutes: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">在此时间内的多次曝光视为重复</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    串组宽限时间（分钟）
                  </label>
                  <input
                    type="number"
                    value={config.crossGroupGraceMinutes}
                    onChange={(e) => handleUpdateConfig({ crossGroupGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">分桶后此时间内的曝光不视为串组</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">数据阈值</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最少记录数
                </label>
                <input
                  type="number"
                  value={config.minimumRecords}
                  onChange={(e) => handleUpdateConfig({ minimumRecords: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">曝光记录少于此数时发出警告</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  配置变更窗口（分钟）
                </label>
                <input
                  type="number"
                  value={config.configChangeWindowMinutes}
                  onChange={(e) => handleUpdateConfig({ configChangeWindowMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">配置变更前后此时间内的曝光受影响</p>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Data Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="分桶用户数"
          value={userBuckets.length}
          icon={<Users className="w-5 h-5" />}
          color="primary"
        />
        <MetricCard
          title="曝光记录数"
          value={exposureLogs.length}
          icon={<Eye className="w-5 h-5" />}
          color="primary"
        />
        <MetricCard
          title="转化记录数"
          value={conversionData.length}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="success"
        />
        <MetricCard
          title="运营变更数"
          value={operationChanges.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="warning"
        />
      </div>
      
      {/* Progress Section */}
      {(isChecking || checkResult) && (
        <Card className="mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">检查进度</span>
              <div className="flex items-center gap-4">
                {isChecking && (
                  <span className="text-sm text-gray-500">
                    已耗时 {formatDuration(elapsedTime)}
                  </span>
                )}
                <span className="text-sm font-mono text-gray-900">{Math.round(progress)}%</span>
              </div>
            </div>
            <ProgressBar progress={progress} />
          </div>
          
          <StepProgress steps={stepsWithStatus} currentStep={currentStep} />
          
          {checkResult && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-900">检查完成</h4>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  处理时间 {formatTimestamp(checkResult.processedAt)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">总曝光数</p>
                  <p className="text-xl font-bold font-mono text-gray-900">{formatNumber(checkResult.totalExposures)}</p>
                </div>
                <div className="bg-danger-50 rounded-lg p-4">
                  <p className="text-xs text-danger-600 mb-1">污染记录</p>
                  <p className="text-xl font-bold font-mono text-danger-600">{formatNumber(checkResult.contaminatedCount)}</p>
                </div>
                <div className="bg-warning-50 rounded-lg p-4">
                  <p className="text-xs text-warning-600 mb-1">污染率</p>
                  <p className="text-xl font-bold font-mono text-warning-600">{formatPercent(checkResult.contaminationRate, 2)}</p>
                </div>
                <div className="bg-success-50 rounded-lg p-4">
                  <p className="text-xs text-success-600 mb-1">数据校验和</p>
                  <p className="text-xs font-mono text-success-600 truncate" title={checkResult.consistencyChecksum}>
                    {checkResult.consistencyChecksum.slice(0, 16)}...
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
      
      {/* Contamination Results */}
      {checkResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card
            title="用户串组"
            subtitle={`${checkResult.crossGroupCount} 条串组曝光`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">串组曝光数</span>
                <span className="text-lg font-bold font-mono text-danger-600">{formatNumber(checkResult.crossGroupCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">影响用户数</span>
                <span className="text-sm font-mono text-gray-900">{formatNumber(checkResult.affectedUsers.length)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-danger-500 rounded-full"
                  style={{ width: `${Math.min(checkResult.crossGroupRate * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                串组率: {formatPercent(checkResult.crossGroupRate, 2)}
              </p>
            </div>
          </Card>
          
          <Card
            title="重复曝光"
            subtitle={`${checkResult.duplicateExposureCount} 条重复曝光`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">重复曝光数</span>
                <span className="text-lg font-bold font-mono text-warning-600">{formatNumber(checkResult.duplicateExposureCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">重复率</span>
                <span className="text-sm font-mono text-gray-900">{formatPercent(checkResult.duplicateRate, 2)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning-500 rounded-full"
                  style={{ width: `${Math.min(checkResult.duplicateRate * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                检测窗口: {config.duplicateWindowMinutes} 分钟
              </p>
            </div>
          </Card>
          
          <Card
            title="配置变更"
            subtitle={`${checkResult.configChangeCount} 条受变更影响`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">受影响曝光</span>
                <span className="text-lg font-bold font-mono text-primary-600">{formatNumber(checkResult.configChangeCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">变更次数</span>
                <span className="text-sm font-mono text-gray-900">{formatNumber(operationChanges.length)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${Math.min(checkResult.configChangeRate * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                已切分 {checkResult.phaseResults.length} 个实验阶段
              </p>
            </div>
          </Card>
        </div>
      )}
      
      {/* Log Viewer */}
      <LogViewer logs={logs} title="检查日志" maxHeight="400px" />
    </div>
  );
};
