import { useState, useEffect, useRef } from 'react';
import { importApi } from '../services/apiClient';
import { useFileUpload } from '../hooks/useFileUpload';
import { useBatchTask } from '../hooks/useBatchTask';
import { useAppStore, formatDate, getRiskLevelText } from '../store';
import { PageLoading } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { AnomalyCard } from '../components/AnomalyCard';
import { DataTable } from '../components/DataTable';
import { RiskBadge } from '../components/RiskBadge';
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Plus,
  Trash2,
  History,
  Database,
  Eye,
  Play,
  Loader2,
} from 'lucide-react';
import type {
  FileSourceType,
  DataImportWarning,
  ImportBatch,
  ImportPreviewResponse,
} from '../../shared/types';

const sourceTypeLabels: Record<FileSourceType, string> = {
  customer: '客户信息',
  guarantee: '担保合同',
  credit: '授信余额',
  counterGuarantee: '反担保材料',
  approval: '审批意见',
  exposureReport: '暴露报告',
};

const sourceTypeColors: Record<FileSourceType, string> = {
  customer: 'bg-blue-100 text-blue-700',
  guarantee: 'bg-green-100 text-green-700',
  credit: 'bg-amber-100 text-amber-700',
  counterGuarantee: 'bg-purple-100 text-purple-700',
  approval: 'bg-indigo-100 text-indigo-700',
  exposureReport: 'bg-rose-100 text-rose-700',
};

interface UploadedFile {
  id: string;
  file: File;
  sourceType: FileSourceType;
  content?: string;
  status: 'pending' | 'parsing' | 'ready' | 'error';
  error?: string;
  rowCount?: number;
}

export function ImportPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [createNewVersion, setCreateNewVersion] = useState(true);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBatchHistory, setShowBatchHistory] = useState(false);
  const [batchHistory, setBatchHistory] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { taskId, status, progress, failedItems, startPolling, stopPolling } = useBatchTask(
    (taskId) => importApi.getTask(taskId)
  );

  const versions = useAppStore((state) => state.versions);
  const activeVersion = useAppStore((state) => state.activeVersion);
  const addNotification = useAppStore((state) => state.addNotification);
  const setVersions = useAppStore((state) => state.setVersions);
  const setActiveVersion = useAppStore((state) => state.setActiveVersion);

  useEffect(() => {
    if (!versionName && activeVersion) {
      const date = new Date();
      const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
      setVersionName(`数据导入_${dateStr}`);
    }
  }, [activeVersion]);

  useEffect(() => {
    if (status === 'completed') {
      addNotification({
        type: 'success',
        title: '数据导入完成',
        message: `成功导入 ${previewData?.validRows || 0} 条数据`,
      });
      stopPolling();
      refreshVersions();
      setPreviewData(null);
      setUploadedFiles([]);
    } else if (status === 'failed') {
      addNotification({
        type: 'error',
        title: '数据导入失败',
        message: failedItems?.[0]?.errorMessage || '请检查数据格式后重试',
      });
      stopPolling();
    }
  }, [status]);

  const refreshVersions = async () => {
    try {
      const [allVersionsRes, activeVersionRes] = await Promise.all([
        import('./../services/apiClient').then(m => m.versionApi.listSnapshots(50)),
        import('./../services/apiClient').then(m => m.versionApi.getActiveSnapshot()),
      ]);
      if (allVersionsRes.success && allVersionsRes.data) {
        setVersions(allVersionsRes.data);
      }
      if (activeVersionRes.success && activeVersionRes.data) {
        setActiveVersion(activeVersionRes.data);
      }
    } catch (error) {
      console.error('Failed to refresh versions:', error);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      sourceType: inferSourceType(file.name),
      status: 'pending',
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    for (const fileItem of newFiles) {
      await parseFile(fileItem);
    }
  };

  const inferSourceType = (fileName: string): FileSourceType => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('客户') || lowerName.includes('customer')) return 'customer';
    if (lowerName.includes('担保') || lowerName.includes('guarantee')) return 'guarantee';
    if (lowerName.includes('授信') || lowerName.includes('credit')) return 'credit';
    if (lowerName.includes('反担保') || lowerName.includes('counter')) return 'counterGuarantee';
    if (lowerName.includes('审批') || lowerName.includes('approval')) return 'approval';
    if (lowerName.includes('暴露') || lowerName.includes('exposure')) return 'exposureReport';
    return 'customer';
  };

  const parseFile = async (fileItem: UploadedFile) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileItem.id ? { ...f, status: 'parsing' } : f))
    );

    try {
      const content = await readFileContent(fileItem.file);
      const rowCount = estimateRowCount(content, fileItem.file.name);

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, content, status: 'ready', rowCount }
            : f
        )
      );
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: 'error', error: '文件解析失败' }
            : f
        )
      );
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else if (result instanceof ArrayBuffer) {
          const decoder = new TextDecoder('utf-8');
          resolve(decoder.decode(result));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  };

  const estimateRowCount = (content: string, fileName: string): number => {
    if (fileName.endsWith('.json')) {
      try {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data.length : 1;
      } catch {
        return 0;
      }
    }
    return content.split('\n').filter((l) => l.trim()).length - 1;
  };

  const handleSourceTypeChange = (fileId: string, sourceType: FileSourceType) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, sourceType } : f))
    );
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handlePreview = async () => {
    if (uploadedFiles.filter((f) => f.status === 'ready').length === 0) {
      addNotification({
        type: 'warning',
        title: '请先上传文件',
        message: '至少需要一个已成功解析的文件',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await importApi.preview({
        files: uploadedFiles
          .filter((f) => f.status === 'ready' && f.content)
          .map((f) => ({
            name: f.file.name,
            sourceType: f.sourceType,
            content: f.content!,
          })),
        createNewVersion,
        versionName,
        versionDescription,
      });

      if (res.success && res.data) {
        setPreviewData(res.data);
        setShowPreviewModal(true);
      } else {
        addNotification({
          type: 'error',
          title: '预览失败',
          message: res.error || '请检查数据格式',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '预览失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!previewData) return;

    setShowPreviewModal(false);
    setLoading(true);

    try {
      const res = await importApi.execute({
        files: uploadedFiles
          .filter((f) => f.status === 'ready' && f.content)
          .map((f) => ({
            name: f.file.name,
            sourceType: f.sourceType,
            content: f.content!,
          })),
        createNewVersion,
        versionName,
        versionDescription,
      });

      if (res.success && res.data) {
        startPolling(res.data.taskId);
        addNotification({
          type: 'info',
          title: '开始导入',
          message: '数据导入任务已启动，正在处理...',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '导入失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBatchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await importApi.listBatches(20);
      if (res.success && res.data) {
        setBatchHistory(res.data);
      }
      setShowBatchHistory(true);
    } catch (error) {
      console.error('Failed to load batch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const readyFilesCount = uploadedFiles.filter((f) => f.status === 'ready').length;
  const totalRows = uploadedFiles.reduce((sum, f) => sum + (f.rowCount || 0), 0);

  const historyColumns = [
    { key: 'name', header: '批次名称', sortable: true, width: '200px' },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      align: 'center' as const,
      render: (row: ImportBatch) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            row.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : row.status === 'processing'
              ? 'bg-blue-100 text-blue-700'
              : row.status === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.status === 'completed'
            ? '已完成'
            : row.status === 'processing'
            ? '处理中'
            : row.status === 'error'
            ? '失败'
            : row.status === 'partial'
            ? '部分完成'
            : '待处理'}
        </span>
      ),
    },
    { key: 'totalRows', header: '总行数', sortable: true, width: '100px', align: 'center' as const },
    { key: 'validRows', header: '有效行', sortable: true, width: '100px', align: 'center' as const },
    { key: 'errorRows', header: '错误行', sortable: true, width: '100px', align: 'center' as const },
    { key: 'uploader', header: '上传人', width: '100px' },
    {
      key: 'uploadTime',
      header: '上传时间',
      sortable: true,
      width: '160px',
      render: (row: ImportBatch) => formatDate(row.uploadTime),
    },
    {
      key: 'actions',
      header: '操作',
      width: '100px',
      align: 'center' as const,
      render: (row: ImportBatch) => (
        <button
          onClick={() => console.log('View batch:', row.id)}
          className="text-primary-600 hover:text-primary-700 text-sm"
        >
          查看详情
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据导入</h1>
          <p className="text-gray-500 mt-1">上传客户、担保、授信等多源数据，支持多版本管理和异常检测</p>
        </div>
        <button
          onClick={loadBatchHistory}
          className="btn btn-secondary flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          导入历史
        </button>
      </div>

      {status === 'running' && (
        <div className="card border-blue-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-blue-900">数据导入中...</p>
                <p className="text-sm text-blue-700">{progress}%</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">上传文件</h2>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">点击或拖拽文件到此处</p>
              <p className="text-xs text-gray-500 mt-1">支持 Excel (.xlsx, .xls) 和 JSON 格式</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.json,.csv"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />

            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {fileItem.file.name.endsWith('.json') ? (
                      <FileJson className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fileItem.rowCount !== undefined
                          ? `${fileItem.rowCount} 行数据`
                          : fileItem.status === 'parsing'
                          ? '解析中...'
                          : fileItem.status === 'error'
                          ? fileItem.error
                          : ''}
                      </p>
                    </div>
                    <select
                      value={fileItem.sourceType}
                      onChange={(e) =>
                        handleSourceTypeChange(
                          fileItem.id,
                          e.target.value as FileSourceType
                        )
                      }
                      className={`px-2 py-1 text-xs font-medium rounded ${sourceTypeColors[fileItem.sourceType]}`}
                    >
                      {(Object.keys(sourceTypeLabels) as FileSourceType[]).map((type) => (
                        <option key={type} value={type}>
                          {sourceTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      {fileItem.status === 'ready' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {fileItem.status === 'parsing' && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      {fileItem.status === 'error' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <button
                        onClick={() => handleRemoveFile(fileItem.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">版本设置</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createNewVersion}
                  onChange={(e) => setCreateNewVersion(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">创建新版本</span>
              </label>

              {createNewVersion && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      版本名称
                    </label>
                    <input
                      type="text"
                      value={versionName}
                      onChange={(e) => setVersionName(e.target.value)}
                      placeholder="请输入版本名称"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      版本说明（可选）
                    </label>
                    <textarea
                      value={versionDescription}
                      onChange={(e) => setVersionDescription(e.target.value)}
                      placeholder="请输入版本说明，如数据来源、更新内容等"
                      rows={3}
                      className="input w-full resize-none"
                    />
                  </div>
                </>
              )}

              {!createNewVersion && activeVersion && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        将追加到当前版本：{activeVersion.name}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        新数据将与现有数据合并，旧数据不会被覆盖
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">导入概览</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">待上传文件</span>
                <span className="text-sm font-medium text-gray-900">
                  {readyFilesCount} / {uploadedFiles.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">预计数据行数</span>
                <span className="text-sm font-medium text-gray-900">{totalRows}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">创建新版本</span>
                <span className="text-sm font-medium text-gray-900">
                  {createNewVersion ? '是' : '否'}
                </span>
              </div>
              {createNewVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">版本名称</span>
                  <span className="text-sm font-medium text-primary-600 truncate max-w-[150px]">
                    {versionName || '-'}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <button
                onClick={handlePreview}
                disabled={readyFilesCount === 0 || loading || status === 'running'}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                预览并检测异常
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full btn btn-secondary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                继续添加文件
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">支持的数据类型</h3>
            <div className="space-y-2">
              {(Object.keys(sourceTypeLabels) as FileSourceType[]).map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${sourceTypeColors[type].split(' ')[0]}`} />
                  <span className="text-sm text-gray-700">{sourceTypeLabels[type]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <div className="flex items-start gap-2">
              <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">数据保留策略</p>
                <p className="text-xs text-blue-700 mt-1">
                  所有历史版本数据都会完整保留，支持随时切换和撤回。旧口径数据不会被直接覆盖。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="数据预览与异常检测"
        size="xl"
      >
        {previewData && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{previewData.totalRows}</p>
                <p className="text-xs text-gray-500">总行数</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{previewData.validRows}</p>
                <p className="text-xs text-gray-500">有效行</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{previewData.errorRows}</p>
                <p className="text-xs text-gray-500">错误行</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {previewData.warnings.filter((w) => w.severity === 'warning').length}
                </p>
                <p className="text-xs text-gray-500">警告数</p>
              </div>
            </div>

            {previewData.warnings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">检测到的异常</h3>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {previewData.warnings.map((warning, index) => (
                    <AnomalyCard key={index} warning={warning} />
                  ))}
                </div>
              </div>
            )}

            {previewData.sampleData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">数据样例</h3>
                <div className="max-h-48 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(previewData.sampleData[0]).map((key) => (
                          <th
                            key={key}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.sampleData.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value, colIndex) => (
                            <td key={colIndex} className="px-3 py-2 text-gray-700">
                              {String(value ?? '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleExecute}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                确认导入
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showBatchHistory}
        onClose={() => setShowBatchHistory(false)}
        title="导入历史"
        size="xl"
      >
        {historyLoading ? (
          <PageLoading message="加载历史记录..." />
        ) : (
          <div>
            <DataTable
              columns={historyColumns}
              data={batchHistory}
              pageSize={10}
              emptyMessage="暂无导入历史记录"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
