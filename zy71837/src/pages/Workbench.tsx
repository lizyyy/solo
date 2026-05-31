import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, RefreshCw, Database, Hash, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { FilterPanel } from '@/components/FilterPanel';
import { DataTable } from '@/components/DataTable';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { parseCSV, processImport } from '@/utils/importer';
import { generateSampleCSV } from '@/mock/initialData';

export const Workbench: React.FC = () => {
  const {
    records,
    filteredRecords,
    currentVersion,
    filterConditions,
    filterFingerprint,
    anomalies,
    importRecords,
    exportRecords,
    refreshData,
    initializeMockData,
    versionHistory
  } = useAppStore();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [duplicateResolution, setDuplicateResolution] = useState<'skip' | 'overwrite' | 'keep_both'>('skip');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [includeConsistencyReport, setIncludeConsistencyReport] = useState(true);
  const [exportRemark, setExportRemark] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (versionHistory.length === 0) {
      initializeMockData();
    }
  }, [versionHistory.length, initializeMockData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportContent(content);
      setImportError(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handlePasteSample = () => {
    setImportContent(generateSampleCSV());
    setImportError(null);
    setImportResult(null);
  };

  const handlePreviewImport = () => {
    try {
      const parsed = parseCSV(importContent);
      const result = processImport(parsed, {
        handleDuplicates: duplicateResolution,
        existingRecords: records
      });
      setImportResult(result);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '解析失败');
      setImportResult(null);
    }
  };

  const handleConfirmImport = () => {
    if (!importResult) return;
    importRecords(importResult.records, '用户导入数据');
    setImportDialogOpen(false);
    setImportContent('');
    setImportResult(null);
    setConfirmImport(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportRecords(exportFormat, includeConsistencyReport, exportRemark);
      setExportDialogOpen(false);
      setExportRemark('');
    } catch (error) {
      alert(error instanceof Error ? error.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    refreshData();
    setIsRefreshing(false);
  };

  const displayRecords = filteredRecords.length > 0 || Object.keys(filterConditions).length > 0
    ? filteredRecords
    : records;

  const openAnomalies = anomalies.filter(a => a.status === 'open');
  const criticalAnomalies = openAnomalies.filter(a => a.severity === 'critical' || a.severity === 'high');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary-600" />
            <h1 className="font-mono font-bold text-lg text-primary-800">数据工作台</h1>
          </div>
          {currentVersion && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-primary-400 font-mono">当前版本:</span>
              <span className="font-mono font-medium text-info-600">v{currentVersion.version}</span>
              <span className="text-primary-300">|</span>
              <span className="text-primary-500 font-mono text-xs">{currentVersion.dataFingerprint.substring(0, 12)}...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={() => setImportDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-info-600 text-white hover:bg-info-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      <FilterPanel />

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <DataTable records={displayRecords} anomalies={anomalies} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-primary-200 bg-primary-50 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-primary-400" />
            <span className="text-primary-500 font-mono">
              总记录: <span className="font-medium text-primary-700">{records.length}</span>
            </span>
          </div>
          {Object.keys(filterConditions).length > 0 && (
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-primary-400" />
              <span className="text-primary-500 font-mono">
                筛选后: <span className="font-medium text-info-600">{displayRecords.length}</span>
              </span>
              <span className="text-primary-300">|</span>
              <span className="text-primary-400 font-mono">筛选指纹: {filterFingerprint}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {criticalAnomalies.length > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-danger-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
            )}
            <span className="font-mono">
              {openAnomalies.length > 0 ? (
                <span className={criticalAnomalies.length > 0 ? 'text-danger-600' : 'text-warning-600'}>
                  {openAnomalies.length} 个待处理异常
                </span>
              ) : (
                <span className="text-success-600">数据一致</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {currentVersion && (
            <span className="text-primary-400 font-mono">
              最后更新: {new Date(currentVersion.createdAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={importDialogOpen}
        title="导入战报数据"
        message=""
        confirmText="确认导入"
        onConfirm={() => importResult ? setConfirmImport(true) : handlePreviewImport()}
        onCancel={() => {
          setImportDialogOpen(false);
          setImportContent('');
          setImportResult(null);
          setImportError(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2 font-mono">上传CSV文件</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-primary-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200"
            />
          </div>
          <div className="text-center">
            <button
              onClick={handlePasteSample}
              className="text-xs text-info-600 hover:text-info-700 font-mono"
            >
              或点击此处使用示例数据
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2 font-mono">重复数据处理方式</label>
            <div className="flex gap-4">
              {(['skip', 'overwrite', 'keep_both'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateResolution"
                    value={opt}
                    checked={duplicateResolution === opt}
                    onChange={() => setDuplicateResolution(opt)}
                    className="text-info-600 focus:ring-info-500"
                  />
                  <span className="font-mono">
                    {opt === 'skip' ? '跳过' : opt === 'overwrite' ? '覆盖' : '保留两者'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {importContent && (
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2 font-mono">数据内容</label>
              <textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                className="w-full h-40 px-3 py-2 text-xs font-mono border border-primary-300 bg-white focus:outline-none focus:border-info-500"
              />
            </div>
          )}
          {importError && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-sm text-danger-600 font-mono">
              {importError}
            </div>
          )}
          {importResult && (
            <div className="space-y-2">
              <div className="p-3 bg-primary-50 border border-primary-200">
                <div className="grid grid-cols-3 gap-4 text-sm font-mono">
                  <div>
                    <span className="text-primary-500">待导入:</span>
                    <span className="ml-2 font-medium text-primary-700">{importResult.records.length}</span>
                  </div>
                  <div>
                    <span className="text-primary-500">重复:</span>
                    <span className="ml-2 font-medium text-warning-600">{importResult.duplicates.length}</span>
                  </div>
                  <div>
                    <span className="text-primary-500">错误:</span>
                    <span className="ml-2 font-medium text-danger-600">{importResult.errors.length}</span>
                  </div>
                </div>
              </div>
              {importResult.duplicates.length > 0 && (
                <div className="p-3 bg-warning-50 border border-warning-200 max-h-24 overflow-y-auto">
                  <p className="text-xs text-warning-700 font-mono mb-1">检测到 {importResult.duplicates.length} 条重复数据:</p>
                  {importResult.duplicates.slice(0, 3).map((d: any, i: number) => (
                    <p key={i} className="text-xs font-mono text-warning-600">
                      {d.incoming.battleId} - {d.incoming.playerName}
                    </p>
                  ))}
                  {importResult.duplicates.length > 3 && (
                    <p className="text-xs font-mono text-warning-500">... 还有 {importResult.duplicates.length - 3} 条</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmImport}
        title="确认导入"
        message={`即将导入 ${importResult?.records.length || 0} 条记录，其中 ${importResult?.duplicates.length || 0} 条重复数据将按"${duplicateResolution === 'skip' ? '跳过' : duplicateResolution === 'overwrite' ? '覆盖' : '保留两者'}"处理。\n\n确定继续吗？`}
        variant="warning"
        confirmText="确认导入"
        onConfirm={handleConfirmImport}
        onCancel={() => setConfirmImport(false)}
      />

      <ConfirmDialog
        isOpen={exportDialogOpen}
        title="导出数据"
        message=""
        confirmText={isExporting ? '导出中...' : '开始导出'}
        onConfirm={handleExport}
        onCancel={() => setExportDialogOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2 font-mono">导出格式</label>
            <div className="flex gap-4">
              {(['csv', 'xlsx', 'pdf'] as const).map(format => (
                <label key={format} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="exportFormat"
                    value={format}
                    checked={exportFormat === format}
                    onChange={() => setExportFormat(format)}
                    className="text-info-600 focus:ring-info-500"
                  />
                  <span className="font-mono uppercase">{format}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeConsistencyReport}
                onChange={(e) => setIncludeConsistencyReport(e.target.checked)}
                className="text-info-600 focus:ring-info-500"
              />
              <span className="font-mono text-primary-700">包含一致性校验报告</span>
            </label>
            <p className="text-xs text-primary-400 mt-1 ml-6 font-mono">
              导出前将校验屏幕显示与导出数据的一致性
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2 font-mono">导出备注</label>
            <input
              type="text"
              value={exportRemark}
              onChange={(e) => setExportRemark(e.target.value)}
              placeholder="选填，用于记录导出目的"
              className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
            />
          </div>
          <div className="p-3 bg-info-50 border border-info-200">
            <div className="text-xs font-mono text-info-700 space-y-1">
              <p>将导出 <span className="font-medium">{displayRecords.length}</span> 条记录</p>
              <p>当前版本: v{currentVersion?.version}</p>
              <p>筛选指纹: {filterFingerprint || '(无筛选)'}</p>
              <p className="text-info-500">* 导出前将自动进行一致性校验，不通过则无法导出</p>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
};
