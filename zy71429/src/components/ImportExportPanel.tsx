import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';
import {
  Upload,
  Download,
  FileJson,
  FileText,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { parseFile } from '@/utils/importer';
import {
  generateExportData,
  exportToJSON,
  exportToCSV,
  exportReportToMarkdown,
} from '@/utils/exporter';
import { ImportResult, ImportError, Ship, Berth, Tug, Weather } from '@/types/game';

type ImportType = 'ships' | 'berths' | 'tugs' | 'weather';
type ExportFormat = 'json' | 'csv' | 'markdown';
type TabType = 'import' | 'export';

interface PreviewData {
  type: ImportType | 'unknown';
  result: ImportResult<unknown>;
  fileName: string;
}

const typeLabels: Record<ImportType, string> = {
  ships: '船舶数据',
  berths: '泊位数据',
  tugs: '拖轮数据',
  weather: '天气预报',
};

const formatLabels: Record<ExportFormat, { label: string; icon: typeof FileJson }> = {
  json: { label: 'JSON', icon: FileJson },
  csv: { label: 'CSV', icon: FileSpreadsheet },
  markdown: { label: 'Markdown', icon: FileText },
};

const errorTypeLabels: Record<ImportError['errorType'], string> = {
  missing_field: '缺少字段',
  invalid_value: '无效值',
  conflict: '数据冲突',
  format_error: '格式错误',
  out_of_range: '超出范围',
};

interface ImportExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportExportPanel({ isOpen, onClose }: ImportExportPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<{ format: ExportFormat; success: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importData, timelineSnapshots } = useGameStore();
  const gameState = useGameStore((state) => state);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setPreviewData({
        type: 'unknown',
        result: {
          data: [],
          errors: [{
            file: file.name,
            line: 0,
            rawContent: '',
            errorType: 'format_error',
            message: '仅支持 CSV 格式文件',
            suggestion: '请上传 .csv 格式的文件',
          }],
          successCount: 0,
          errorCount: 1,
        },
        fileName: file.name,
      });
      return;
    }

    const importTimestamp = new Date();
    const { type, result } = await parseFile(file, importTimestamp);
    
    setPreviewData({
      type,
      result,
      fileName: file.name,
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, [processFile]);

  const handleImport = useCallback(() => {
    if (!previewData || previewData.type === 'unknown') return;

    const result = importData(previewData.type, previewData.result);
    
    if (result.success) {
      setPreviewData(null);
      onClose();
    }
  }, [previewData, importData, onClose]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportProgress(0);
    setExportResult(null);

    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 50);

    try {
      const exportData = generateExportData(gameState, timelineSnapshots);
      
      await new Promise(resolve => setTimeout(resolve, 300));

      switch (format) {
        case 'json':
          exportToJSON(exportData);
          break;
        case 'csv':
          exportToCSV(exportData);
          break;
        case 'markdown':
          exportReportToMarkdown(exportData);
          break;
      }

      setExportProgress(100);
      setExportResult({ format, success: true });
    } catch {
      setExportResult({ format, success: false });
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setExportProgress(0);
        setExportResult(null);
      }, 3000);
    }
  }, [gameState, timelineSnapshots]);

  const clearPreview = useCallback(() => {
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const renderPreviewTable = () => {
    if (!previewData || previewData.type === 'unknown') return null;

    const { type, result } = previewData;
    const data = result.data as unknown[];

    const renderRow = (item: unknown, index: number) => {
      switch (type) {
        case 'ships': {
          const ship = item as Ship;
          return (
            <tr key={index} className="border-t border-ocean-700/30">
              <td className="px-3 py-2 font-mono text-xs">{ship.id}</td>
              <td className="px-3 py-2 text-sm">{ship.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{ship.length}m</td>
              <td className="px-3 py-2 font-mono text-xs">{ship.draft}m</td>
              <td className="px-3 py-2 font-mono text-xs">{ship.priority}</td>
              <td className="px-3 py-2 font-mono text-xs">{ship.tugRequired}</td>
              <td className="px-3 py-2 font-mono text-xs">{ship.eta.toLocaleString()}</td>
            </tr>
          );
        }
        case 'berths': {
          const berth = item as Berth;
          return (
            <tr key={index} className="border-t border-ocean-700/30">
              <td className="px-3 py-2 font-mono text-xs">{berth.id}</td>
              <td className="px-3 py-2 text-sm">{berth.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{berth.maxLength}m</td>
              <td className="px-3 py-2 font-mono text-xs">{berth.maxDraft}m</td>
              <td className="px-3 py-2 font-mono text-xs">{berth.status}</td>
            </tr>
          );
        }
        case 'tugs': {
          const tug = item as Tug;
          return (
            <tr key={index} className="border-t border-ocean-700/30">
              <td className="px-3 py-2 font-mono text-xs">{tug.id}</td>
              <td className="px-3 py-2 text-sm">{tug.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{tug.power}</td>
              <td className="px-3 py-2 font-mono text-xs">{tug.fuelLevel}%</td>
              <td className="px-3 py-2 font-mono text-xs">{tug.status}</td>
            </tr>
          );
        }
        case 'weather': {
          const weather = item as Weather;
          return (
            <tr key={index} className="border-t border-ocean-700/30">
              <td className="px-3 py-2 font-mono text-xs">{weather.id}</td>
              <td className="px-3 py-2 font-mono text-xs">{weather.timestamp.toLocaleString()}</td>
              <td className="px-3 py-2 font-mono text-xs">{weather.windLevel}</td>
              <td className="px-3 py-2 font-mono text-xs">{weather.waveHeight}m</td>
              <td className="px-3 py-2 font-mono text-xs">{weather.windowType}</td>
            </tr>
          );
        }
      }
    };

    const headers = {
      ships: ['ID', '船名', '船长', '吃水', '优先级', '拖力需求', 'ETA'],
      berths: ['ID', '名称', '最大长度', '最大吃水', '状态'],
      tugs: ['ID', '名称', '功率', '燃油', '状态'],
      weather: ['ID', '时间', '风力', '浪高', '窗口类型'],
    };

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ocean-300">数据预览</span>
            <span className="px-2 py-0.5 bg-ocean-700/50 rounded text-xs font-mono">
              {typeLabels[type]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-alert-success/20 text-alert-success rounded text-xs font-mono">
              {result.successCount} 条有效
            </span>
            {result.errorCount > 0 && (
              <span className="px-2 py-0.5 bg-alert-missed/20 text-alert-missed rounded text-xs font-mono">
                {result.errorCount} 条错误
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto max-h-48 overflow-y-auto bg-ocean-900/30 rounded-lg">
          <table className="w-full text-left">
            <thead className="bg-ocean-800/50 sticky top-0">
              <tr>
                {headers[type].map((header, idx) => (
                  <th key={idx} className="px-3 py-2 text-xs font-mono text-ocean-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ocean-200">
              {data.slice(0, 10).map((item, index) => renderRow(item, index))}
            </tbody>
          </table>
          {data.length > 10 && (
            <div className="text-center py-2 text-xs text-ocean-500">
              还有 {data.length - 10} 条数据未显示
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderErrors = () => {
    if (!previewData || previewData.result.errors.length === 0) return null;

    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-alert-missed" />
          <span className="text-sm text-alert-missed">数据验证错误</span>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-2">
          {previewData.result.errors.map((error, index) => (
            <div
              key={index}
              className="p-2 bg-alert-missed/10 border border-alert-missed/30 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-1.5 py-0.5 bg-alert-missed/20 text-alert-missed rounded text-xs font-mono mr-2">
                    {errorTypeLabels[error.errorType]}
                  </span>
                  <span className="text-xs text-ocean-300">
                    第 {error.line} 行: {error.message}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-xs text-ocean-500">
                建议: {error.suggestion}
              </div>
              {error.rawContent && (
                <div className="mt-1 text-xs font-mono text-ocean-600 truncate">
                  原始内容: {error.rawContent}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('import')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm transition-colors',
                activeTab === 'import'
                  ? 'bg-ocean-600 text-white'
                  : 'text-ocean-400 hover:text-ocean-200 hover:bg-ocean-700/50'
              )}
            >
              <Upload className="w-4 h-4" />
              导入数据
            </button>
            <button
            onClick={() => setActiveTab('export')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm transition-colors',
              activeTab === 'export'
                ? 'bg-ocean-600 text-white'
                : 'text-ocean-400 hover:text-ocean-200 hover:bg-ocean-700/50'
            )}
          >
            <Download className="w-4 h-4" />
            导出结果
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-ocean-700/50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-ocean-400" />
        </button>
      </div>

      <div className="card-body overflow-y-auto flex-1">
        {activeTab === 'import' && (
          <div>
            {!previewData ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                  isDragging
                    ? 'border-ocean-400 bg-ocean-700/30'
                    : 'border-ocean-600/50 hover:border-ocean-500 hover:bg-ocean-800/50'
                )}
              >
                <Upload className={cn(
                  'w-12 h-12 mx-auto mb-4 transition-colors',
                  isDragging ? 'text-ocean-400' : 'text-ocean-500'
                )} />
                <p className="text-ocean-200 font-mono mb-2">
                  拖放 CSV 文件到此处，或点击选择文件
                </p>
                <p className="text-ocean-500 text-sm">
                  支持船舶、泊位、拖轮、天气预报数据
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-ocean-400" />
                    <div>
                      <p className="font-mono text-ocean-200">{previewData.fileName}</p>
                      <p className="text-sm text-ocean-500">
                        {previewData.type !== 'unknown'
                          ? `检测到: ${typeLabels[previewData.type]}`
                          : '未知文件类型'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearPreview}
                    className="p-2 hover:bg-ocean-700/50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-ocean-400" />
                  </button>
                </div>

                {renderPreviewTable()}
                {renderErrors()}

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-ocean-700/50">
                  <button
                    onClick={clearPreview}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={previewData.type === 'unknown' || previewData.result.data.length === 0}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    确认导入
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div>
            <div className="mb-4 p-4 bg-ocean-900/30 rounded-lg">
              <p className="text-sm text-ocean-300 mb-2">导出内容包含：</p>
              <ul className="text-sm text-ocean-500 space-y-1 font-mono">
                <li>• 最终状态 - 所有资源和调度的当前状态</li>
                <li>• 时间线快照 - 完整的游戏过程记录</li>
                <li>• 数据源信息 - 每条数据的来源追溯</li>
                <li>• 分析报告 - 效率指标和决策链分析</li>
              </ul>
            </div>

            {exportProgress > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ocean-400 font-mono">导出进度</span>
                  <span className="text-ocean-200 font-mono">{exportProgress}%</span>
                </div>
                <div className="h-2 bg-ocean-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ocean-500 transition-all duration-200"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}

            {exportResult && (
              <div className={cn(
                'mb-4 p-3 rounded-lg flex items-center gap-2',
                exportResult.success
                  ? 'bg-alert-success/20 border border-alert-success/30'
                  : 'bg-alert-missed/20 border border-alert-missed/30'
              )}>
                {exportResult.success ? (
                  <Check className="w-5 h-5 text-alert-success" />
                ) : (
                  <X className="w-5 h-5 text-alert-missed" />
                )}
                <span className={cn(
                  'font-mono text-sm',
                  exportResult.success ? 'text-alert-success' : 'text-alert-missed'
                )}>
                  {exportResult.success
                    ? `${formatLabels[exportResult.format].label} 格式导出成功`
                    : '导出失败，请重试'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {(Object.keys(formatLabels) as ExportFormat[]).map((format) => {
                const { label, icon: Icon } = formatLabels[format];
                return (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={exportProgress > 0 && exportProgress < 100}
                    className="flex flex-col items-center gap-2 p-6 bg-ocean-800/50 border border-ocean-600/50 rounded-xl hover:bg-ocean-700/50 hover:border-ocean-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon className="w-10 h-10 text-ocean-400" />
                    <span className="font-mono text-ocean-200">{label}</span>
                    <span className="text-xs text-ocean-500">
                      {format === 'json' && '完整数据'}
                      {format === 'csv' && '表格格式'}
                      {format === 'markdown' && '分析报告'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
