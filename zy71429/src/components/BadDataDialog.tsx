import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  FileWarning,
  Copy,
  Download,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { ImportError } from '@/types/game';
import { cn } from '@/lib/utils';

const ERROR_TYPE_CONFIG: Record<
  ImportError['errorType'],
  { label: string; bg: string; border: string; text: string; badge: string }
> = {
  missing_field: {
    label: '字段缺失',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
  },
  invalid_value: {
    label: '值无效',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-800',
  },
  conflict: {
    label: '数据冲突',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
  format_error: {
    label: '格式错误',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
  out_of_range: {
    label: '超出范围',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
};

interface ErrorItemProps {
  error: ImportError;
  index: number;
  onCopy: (content: string) => void;
}

function ErrorItem({ error, index, onCopy }: ErrorItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = ERROR_TYPE_CONFIG[error.errorType];

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200 overflow-hidden',
        config.bg,
        config.border
      )}
    >
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-white/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/80 text-gray-600 text-xs font-medium flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded', config.badge)}>
                {config.label}
              </span>
              <span className="text-xs text-gray-500">
                {error.file}:{error.line}
              </span>
            </div>
            <p className={cn('text-sm font-medium', config.text)}>{error.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(error.rawContent);
            }}
            className="p-1.5 hover:bg-white/60 rounded transition-colors"
            title="复制原始内容"
          >
            <Copy className="w-4 h-4 text-gray-500" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500 mt-0.5" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 mt-0.5" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-black/5">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">来源文件</div>
              <div className="text-sm text-gray-700 font-mono bg-white/60 rounded px-2 py-1">
                {error.file}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">行号</div>
              <div className="text-sm text-gray-700 font-mono bg-white/60 rounded px-2 py-1">
                {error.line}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-medium text-gray-500 mb-1">原始内容</div>
            <pre className="text-xs bg-white/60 rounded p-2 text-gray-700 overflow-x-auto max-h-24 overflow-y-auto font-mono">
              {error.rawContent || '(空)'}
            </pre>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">修复建议</div>
            <div className="flex items-start gap-2 p-2 bg-white/60 rounded">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{error.suggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BadDataDialog() {
  const showBadDataDialog = useGameStore((state) => state.showBadDataDialog);
  const importErrors = useGameStore((state) => state.importErrors);
  const showBadData = useGameStore((state) => state.showBadData);
  const clearImportErrors = useGameStore((state) => state.clearImportErrors);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    const errorCount = importErrors.length;
    const successCount = importErrors.reduce((acc, err) => {
      const match = err.file.match(/\((\d+)\/(\d+)\)/);
      if (match) {
        return Math.max(acc, parseInt(match[2]) - errorCount);
      }
      return acc;
    }, 0);
    const totalCount = successCount + errorCount;

    const typeCounts = importErrors.reduce(
      (acc, err) => {
        acc[err.errorType]++;
        return acc;
      },
      {
        missing_field: 0,
        invalid_value: 0,
        conflict: 0,
        format_error: 0,
        out_of_range: 0,
      }
    );

    return { errorCount, successCount, totalCount, typeCounts };
  }, [importErrors]);

  const handleCopy = async (content: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(content);
      if (index !== undefined) {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleExportReport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalRecords: stats.totalCount,
        successfulRecords: stats.successCount,
        errorCount: stats.errorCount,
        errorTypes: stats.typeCounts,
      },
      errors: importErrors.map((err) => ({
        file: err.file,
        line: err.line,
        rawContent: err.rawContent,
        errorType: err.errorType,
        message: err.message,
        suggestion: err.suggestion,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    showBadData(false);
    clearImportErrors();
  };

  const handleCancel = () => {
    showBadData(false);
    clearImportErrors();
  };

  if (!showBadDataDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <FileWarning className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">数据导入警告</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                导入数据中存在 {importErrors.length} 条错误记录
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{stats.totalCount}</div>
              <div className="text-xs text-gray-500">总记录数</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.successCount}</div>
              <div className="text-xs text-gray-500">成功导入</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.errorCount}</div>
              <div className="text-xs text-gray-500">错误记录</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalCount > 0
                  ? ((stats.successCount / stats.totalCount) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500">成功率</div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs font-medium text-gray-500">错误类型分布:</div>
            {Object.entries(stats.typeCounts).map(([type, count]) => {
              if (count === 0) return null;
              const config = ERROR_TYPE_CONFIG[type as ImportError['errorType']];
              return (
                <div key={type} className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', config.badge.replace('text-', 'bg-').split(' ')[0])} />
                  <span className="text-xs text-gray-600">
                    {config.label}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-700">错误详情</h3>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出错误报告
            </button>
          </div>

          {importErrors.length > 0 ? (
            <div className="space-y-3">
              {importErrors.map((error, index) => (
                <ErrorItem
                  key={`${error.file}-${error.line}-${index}`}
                  error={error}
                  index={index}
                  onCopy={(content) => handleCopy(content, index)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>所有数据均已成功导入，无错误记录</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消导入
          </button>
          <button
            onClick={handleContinue}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            继续使用有效数据
          </button>
        </div>
      </div>

      {copiedIndex !== null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4 text-green-400" />
          已复制到剪贴板
        </div>
      )}
    </div>
  );
}
