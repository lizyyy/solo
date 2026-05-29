import React, { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  File,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
  Database,
  Link,
  Copy,
  Filter
} from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/layout/MainLayout';
import { MetricCard } from '../components/common/MetricCard';
import { useCheckStore } from '../stores/checkStore';
import { useFileStore } from '../stores/fileStore';
import { useExportStore } from '../stores/exportStore';
import { ExportFormat, ExportContent } from '../types';
import { formatNumber, formatPercent, formatTimestamp, formatFileSize } from '../utils/format';
import { Link as RouterLink } from 'react-router-dom';
import { ConsistencyCheckEngine } from '../engines/ConsistencyCheckEngine';

export const ExportPage: React.FC = () => {
  const { checkResult, getExposuresArray } = useCheckStore();
  const { userBuckets, exposureLogs, conversionData, operationChanges } = useFileStore();
  const { exportHistory, isExporting, currentProgress, exportData, clearHistory, removeExportRecord } = useExportStore();
  
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>(['csv', 'xlsx']);
  const [selectedContent, setSelectedContent] = useState<ExportContent[]>([
    'summary', 'contamination_detail', 'phase_metrics', 'group_metrics', 'consistency_report'
  ]);
  const [showPreview, setShowPreview] = useState(false);
  
  const hasResult = checkResult !== null;
  const markedExposures = getExposuresArray();
  
  const consistencyInfo = useMemo(() => {
    if (!checkResult || markedExposures.length === 0) return null;
    return ConsistencyCheckEngine.performConsistencyCheck(
      markedExposures,
      conversionData,
      checkResult
    );
  }, [checkResult, conversionData, markedExposures]);
  
  const toggleFormat = (format: ExportFormat) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };
  
  const toggleContent = (content: ExportContent) => {
    setSelectedContent(prev =>
      prev.includes(content)
        ? prev.filter(c => c !== content)
        : [...prev, content]
    );
  };
  
  const handleExport = async () => {
    if (!checkResult || selectedFormats.length === 0 || selectedContent.length === 0) return;
    
    for (const format of selectedFormats) {
      for (const content of selectedContent) {
        await exportData(format, content, markedExposures, conversionData, checkResult);
      }
    }
  };
  
  const formatOptions = [
    { value: 'csv' as ExportFormat, label: 'CSV', icon: <FileText className="w-5 h-5" />, description: '逗号分隔，适合数据分析' },
    { value: 'xlsx' as ExportFormat, label: 'Excel', icon: <FileSpreadsheet className="w-5 h-5" />, description: '多工作表，适合业务用户' },
    { value: 'json' as ExportFormat, label: 'JSON', icon: <FileJson className="w-5 h-5" />, description: '结构化，适合开发集成' },
    { value: 'pdf' as ExportFormat, label: 'PDF', icon: <File className="w-5 h-5" />, description: '固定格式，适合归档留存' }
  ];
  
  const contentOptions = [
    { value: 'summary' as ExportContent, label: '检查摘要', icon: <FileText className="w-4 h-4" />, description: '整体统计结论' },
    { value: 'contamination_detail' as ExportContent, label: '污染明细', icon: <AlertTriangle className="w-4 h-4" />, description: '每条污染记录详情' },
    { value: 'phase_metrics' as ExportContent, label: '阶段指标', icon: <Clock className="w-4 h-4" />, description: '各阶段指标对比' },
    { value: 'group_metrics' as ExportContent, label: '分组指标', icon: <Database className="w-4 h-4" />, description: '实验组对照组对比' },
    { value: 'consistency_report' as ExportContent, label: '一致性报告', icon: <CheckCircle className="w-4 h-4" />, description: '数据一致性校验结果' },
    { value: 'evidence_chain' as ExportContent, label: '证据链', icon: <Link className="w-4 h-4" />, description: '单条记录完整证据' }
  ];
  
  if (!hasResult) {
    return (
      <div>
        <PageHeader
          title="导出中心"
          description="导出污染检查报告，支持CSV、Excel、JSON、PDF多种格式"
          breadcrumbs={[{ label: '首页', path: '/' }, { label: '导出中心' }]}
        />
        <Card>
          <EmptyState
            icon={<Download className="w-12 h-12" />}
            title="暂无检查结果"
            description="请先执行污染检查，检查完成后即可导出报告"
            action={
              <RouterLink
                to="/check"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                去检查
              </RouterLink>
            }
          />
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <PageHeader
        title="导出中心"
        description="导出污染检查报告，支持CSV、Excel、JSON、PDF多种格式"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '导出中心' }]}
      />
      
      {/* Consistency Check Banner */}
      {consistencyInfo && (
        <Card className={`mb-6 ${consistencyInfo.isConsistent ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-danger-200'}`}>
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-lg ${consistencyInfo.isConsistent ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'}`}>
              {consistencyInfo.isConsistent ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold ${consistencyInfo.isConsistent ? 'text-success-900' : 'text-danger-900'}`}>
                数据一致性校验 {consistencyInfo.isConsistent ? '通过' : '失败'}
              </h4>
              <p className={`text-sm mt-1 ${consistencyInfo.isConsistent ? 'text-success-700' : 'text-danger-700'}`}>
                {consistencyInfo.isConsistent
                  ? '统计数据、详情列表、导出文件将保持一致，可以安全导出。'
                  : '检测到数据不一致，请先检查数据完整性再导出。'
                }
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">校验和:</span>
                <code className={`text-xs font-mono px-2 py-0.5 rounded ${consistencyInfo.isConsistent ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>
                  {checkResult?.consistencyChecksum?.substring(0, 24)}...
                </code>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? '隐藏详情' : '查看详情'}
            </button>
          </div>
          
          {showPreview && consistencyInfo.details && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {consistencyInfo.details.map((detail) => (
                  <div key={detail.name} className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{detail.name}</p>
                    <div className="flex items-center gap-2">
                      {detail.match ? (
                        <CheckCircle className="w-4 h-4 text-success-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-danger-500" />
                      )}
                      <code className="text-xs font-mono text-gray-700">{detail.expected} vs {detail.actual}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Format Selection */}
          <Card title="选择导出格式" subtitle="可同时选择多种格式">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleFormat(option.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedFormats.includes(option.value)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`mb-2 ${selectedFormats.includes(option.value) ? 'text-primary-600' : 'text-gray-400'}`}>
                    {option.icon}
                  </div>
                  <p className={`font-medium ${selectedFormats.includes(option.value) ? 'text-primary-900' : 'text-gray-900'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </Card>
          
          {/* Content Selection */}
          <Card title="选择导出内容" subtitle="可勾选需要的报告模块">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contentOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedContent.includes(option.value)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedContent.includes(option.value)}
                    onChange={() => toggleContent(option.value)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div className={`${selectedContent.includes(option.value) ? 'text-primary-600' : 'text-gray-400'}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${selectedContent.includes(option.value) ? 'text-primary-900' : 'text-gray-900'}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>
          
          {/* Export Preview */}
          <Card title="导出预览" subtitle="本次导出的内容概览">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">总曝光数</p>
                <p className="text-lg font-bold font-mono text-gray-900">{formatNumber(checkResult.totalExposures)}</p>
              </div>
              <div className="bg-danger-50 rounded-lg p-3">
                <p className="text-xs text-danger-600 mb-1">污染记录</p>
                <p className="text-lg font-bold font-mono text-danger-600">{formatNumber(checkResult.contaminatedCount)}</p>
              </div>
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-xs text-primary-600 mb-1">实验阶段</p>
                <p className="text-lg font-bold font-mono text-primary-600">{checkResult.phaseResults?.length || 0}</p>
              </div>
              <div className="bg-success-50 rounded-lg p-3">
                <p className="text-xs text-success-600 mb-1">分组数</p>
                <p className="text-lg font-bold font-mono text-success-600">{new Set(markedExposures.map(e => e.groupId)).size}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">导出格式</span>
                <span className="text-gray-900">{selectedFormats.map(f => f.toUpperCase()).join(', ')}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-500">导出内容</span>
                <span className="text-gray-900">{selectedContent.length} 个模块</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-500">检查时间</span>
                <span className="text-gray-900">{formatTimestamp(checkResult.processedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-500">校验和</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-700">{checkResult.consistencyChecksum?.substring(0, 16)}...</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(checkResult.consistencyChecksum || '')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Export Actions */}
        <div className="space-y-6">
          {/* Export Button */}
          <Card>
            <button
              onClick={handleExport}
              disabled={selectedFormats.length === 0 || selectedContent.length === 0 || isExporting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  导出中... {Math.round(currentProgress)}%
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  开始导出
                </>
              )}
            </button>
            
            {isExporting && (
              <div className="mt-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${currentProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {(selectedFormats.length === 0 || selectedContent.length === 0) && (
              <p className="text-xs text-danger-600 mt-2 text-center">
                请至少选择一种导出格式和一项导出内容
              </p>
            )}
          </Card>
          
          {/* Quick Stats */}
          <Card title="快速统计">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">污染率</span>
                <span className={`text-sm font-semibold font-mono ${checkResult.contaminationRate > 0.05 ? 'text-danger-600' : checkResult.contaminationRate > 0.01 ? 'text-warning-600' : 'text-success-600'}`}>
                  {formatPercent(checkResult.contaminationRate, 2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">用户串组</span>
                <span className="text-sm font-semibold font-mono text-danger-600">{formatNumber(checkResult.crossGroupCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">重复曝光</span>
                <span className="text-sm font-semibold font-mono text-warning-600">{formatNumber(checkResult.duplicateExposureCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">配置变更影响</span>
                <span className="text-sm font-semibold font-mono text-primary-600">{formatNumber(checkResult.configChangeCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">一致性校验</span>
                <span className={`text-sm font-semibold ${consistencyInfo?.isConsistent ? 'text-success-600' : 'text-danger-600'}`}>
                  {consistencyInfo?.isConsistent ? '通过' : '失败'}
                </span>
              </div>
            </div>
          </Card>
          
          {/* Export History */}
          <Card
            title="导出历史"
            subtitle={`${exportHistory.length} 条记录`}
            actions={
              exportHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-danger-600 hover:text-danger-700 font-medium"
                >
                  清空
                </button>
              )
            }
          >
            {exportHistory.length === 0 ? (
              <EmptyState
                icon={<Download className="w-8 h-8" />}
                title="暂无导出记录"
                description="导出的文件将显示在这里"
              />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[...exportHistory].reverse().map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${
                      record.format === 'csv' ? 'bg-success-100 text-success-600' :
                      record.format === 'xlsx' ? 'bg-primary-100 text-primary-600' :
                      record.format === 'json' ? 'bg-info-100 text-info-600' :
                      'bg-warning-100 text-warning-600'
                    }`}>
                      {record.format === 'csv' && <FileText className="w-4 h-4" />}
                      {record.format === 'xlsx' && <FileSpreadsheet className="w-4 h-4" />}
                      {record.format === 'json' && <FileJson className="w-4 h-4" />}
                      {record.format === 'pdf' && <File className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{record.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatTimestamp(record.timestamp, 'HH:mm:ss')}</span>
                        <span>·</span>
                        <span>{record.recordCount} 条记录</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-success-500" />
                      <button
                        onClick={() => removeExportRecord(record.id)}
                        className="p-1 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
