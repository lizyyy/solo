import { AlertTriangle, XCircle, Lightbulb } from 'lucide-react';
import type { ValidationError, ValidationWarning } from '@/types';
import { useEstimationStore } from '@/store/useEstimationStore';
import { cn } from '@/lib/utils';

interface ValidationItemProps {
  type: 'error' | 'warning';
  message: string;
  suggestion: string;
  delay: number;
}

function ValidationItem({ type, message, suggestion, delay }: ValidationItemProps) {
  const isError = type === 'error';
  
  return (
    <div
      className={cn(
        'p-4 rounded-lg border animate-fade-in',
        isError
          ? 'bg-alert-500/10 border-alert-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-1.5 rounded-md flex-shrink-0 mt-0.5',
            isError ? 'bg-alert-500/20' : 'bg-yellow-500/20'
          )}
        >
          {isError ? (
            <XCircle className="w-4 h-4 text-alert-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium',
              isError ? 'text-alert-500' : 'text-yellow-400'
            )}
          >
            {message}
          </p>
          <div className="mt-2 flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-tech-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ocean-200">{suggestion}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ValidationPanel() {
  const { validation } = useEstimationStore();
  const { errors, warnings, valid } = validation;

  if (valid && errors.length === 0 && warnings.length === 0) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-6 animate-fade-in">
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="p-2 rounded-full bg-success-500/20">
            <AlertTriangle className="w-5 h-5 text-success-500" />
          </div>
          <div>
            <p className="text-success-500 font-medium">参数校验通过</p>
            <p className="text-xs text-ocean-300 mt-0.5">所有输入参数均符合要求</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-tech-400" />
          校验结果
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-alert-500">
              <XCircle className="w-3 h-3" />
              {errors.length} 项错误
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-3 h-3" />
              {warnings.length} 项警告
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {errors.map((error: ValidationError, index: number) => (
          <ValidationItem
            key={`error-${error.code}-${index}`}
            type="error"
            message={error.message}
            suggestion={error.suggestion}
            delay={index * 80}
          />
        ))}
        {warnings.map((warning: ValidationWarning, index: number) => (
          <ValidationItem
            key={`warning-${warning.code}-${index}`}
            type="warning"
            message={warning.message}
            suggestion={warning.suggestion}
            delay={(errors.length + index) * 80}
          />
        ))}
      </div>
    </div>
  );
}
