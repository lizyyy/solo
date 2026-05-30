import type { DataImportWarning } from '../../shared/types';
import { AlertTriangle, AlertCircle, Info, FileText, Hash } from 'lucide-react';

interface AnomalyCardProps {
  warning: DataImportWarning;
  onFix?: () => void;
}

const severityConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    label: '提示',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
    label: '警告',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    label: '错误',
  },
};

export function AnomalyCard({ warning, onFix }: AnomalyCardProps) {
  const config = severityConfig[warning.severity];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor} transition-all hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-white ${config.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.iconColor} bg-white`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500 font-mono">{warning.warningType}</span>
          </div>

          <p className="text-sm font-medium text-gray-800 mb-1">{warning.message}</p>
          
          {warning.suggestion && (
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">建议：</span>
              {warning.suggestion}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {warning.sourceFile && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {warning.sourceFile}
              </span>
            )}
            {warning.rowNumber && (
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                第 {warning.rowNumber} 行
              </span>
            )}
            {warning.objectName && (
              <span className="flex items-center gap-1">
                关联对象：{warning.objectName}
              </span>
            )}
          </div>
        </div>

        {onFix && (
          <button
            onClick={onFix}
            className="flex-shrink-0 px-3 py-1 text-sm font-medium text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
          >
            处理
          </button>
        )}
      </div>
    </div>
  );
}

interface AnomalyListProps {
  warnings: DataImportWarning[];
  title?: string;
  showFixButton?: boolean;
  onFix?: (warning: DataImportWarning) => void;
}

export function AnomalyList({ warnings, title = '异常检测结果', showFixButton = false, onFix }: AnomalyListProps) {
  const errorCount = warnings.filter(w => w.severity === 'error').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;
  const infoCount = warnings.filter(w => w.severity === 'info').length;

  if (warnings.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
            <Info className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-medium text-gray-700">未检测到异常</p>
          <p className="text-sm mt-1">数据质量良好，可以继续操作</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-sm text-red-600 font-medium">
              {errorCount} 个错误
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-sm text-amber-600 font-medium">
              {warningCount} 个警告
            </span>
          )}
          {infoCount > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              {infoCount} 个提示
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-2">
        {warnings.map((warning) => (
          <AnomalyCard
            key={warning.id}
            warning={warning}
            onFix={showFixButton && onFix ? () => onFix(warning) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
