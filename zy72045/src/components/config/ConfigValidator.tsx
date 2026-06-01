import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { ValidationError, ValidationResult } from '../../types/game';

interface ConfigValidatorProps {
  result: ValidationResult;
  onConfirm: (errorPath: string) => void;
  confirmedErrors: string[];
}

const errorTypeConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  empty_level: {
    label: '空关卡',
    color: 'text-warning-600 bg-warning-50 border-warning-200',
    icon: AlertTriangle,
  },
  duplicate_event: {
    label: '重复事件',
    color: 'text-warning-600 bg-warning-50 border-warning-200',
    icon: AlertTriangle,
  },
  boundary_violation: {
    label: '边界异常',
    color: 'text-danger-600 bg-danger-50 border-danger-200',
    icon: XCircle,
  },
};

export function ConfigValidator({ result, onConfirm, confirmedErrors }: ConfigValidatorProps) {
  if (result.isValid) {
    return (
      <div className="card bg-success-50 border-success-200">
        <div className="flex items-center gap-3">
          <CheckCircle size={24} className="text-success-500" />
          <div>
            <h3 className="font-serif font-semibold text-success-700">配置校验通过</h3>
            <p className="text-sm text-success-600">关卡配置没有发现问题，可以开始对局</p>
          </div>
        </div>
      </div>
    );
  }

  const unconfirmedErrors = result.errors.filter((e) => !confirmedErrors.includes(e.path));
  const allConfirmed = unconfirmedErrors.length === 0;

  return (
    <div className="space-y-4">
      <div className={`card ${allConfirmed ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'}`}>
        <div className="flex items-center gap-3">
          {allConfirmed ? (
            <CheckCircle size={24} className="text-success-500" />
          ) : (
            <AlertTriangle size={24} className="text-warning-500" />
          )}
          <div>
            <h3 className={`font-serif font-semibold ${allConfirmed ? 'text-success-700' : 'text-warning-700'}`}>
              发现 {result.errors.length} 个配置问题
            </h3>
            <p className={`text-sm ${allConfirmed ? 'text-success-600' : 'text-warning-600'}`}>
              {allConfirmed
                ? '所有问题已确认，可以开始对局'
                : `请确认这些问题后继续，还有 ${unconfirmedErrors.length} 个问题待确认`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {result.errors.map((error, index) => (
          <ErrorItem
            key={error.path}
            error={error}
            index={index}
            confirmed={confirmedErrors.includes(error.path)}
            onConfirm={() => onConfirm(error.path)}
          />
        ))}
      </div>
    </div>
  );
}

interface ErrorItemProps {
  error: ValidationError;
  index: number;
  confirmed: boolean;
  onConfirm: () => void;
}

function ErrorItem({ error, index, confirmed, onConfirm }: ErrorItemProps) {
  const config = errorTypeConfig[error.type] || {
    label: error.type,
    color: 'text-neutral-600 bg-neutral-50 border-neutral-200',
    icon: Info,
  };

  const Icon = config.icon;

  return (
    <div className={`card border ${config.color} ${confirmed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Icon size={20} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge bg-white/50 text-xs">#{index + 1}</span>
              <span className="badge bg-white/50 text-xs">{config.label}</span>
            </div>
            <p className="text-sm font-medium">{error.message}</p>
            <p className="text-xs mt-1 opacity-75">位置：{error.path}</p>
            {error.value !== undefined && (
              <p className="text-xs mt-1 opacity-75">
                当前值：{JSON.stringify(error.value)}
                {error.boundary && ` (范围: [${error.boundary.min}, ${error.boundary.max}])`}
              </p>
            )}
          </div>
        </div>

        {confirmed ? (
          <span className="badge bg-success-100 text-success-700 flex items-center gap-1">
            <CheckCircle size={12} />
            已确认
          </span>
        ) : (
          <button
            onClick={onConfirm}
            className="btn-primary text-xs py-1 px-3 whitespace-nowrap"
          >
            确认无误
          </button>
        )}
      </div>
    </div>
  );
}
