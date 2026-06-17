import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { ValidationResult } from '../types';

interface ValidationAlertProps {
  validation: ValidationResult | null;
  showSuccess?: boolean;
}

export function ValidationAlert({ validation, showSuccess = false }: ValidationAlertProps) {
  if (!validation) return null;

  const { isValid, errors, warnings } = validation;

  if (isValid && warnings.length === 0 && !showSuccess) return null;

  return (
    <div className="space-y-3">
      {isValid && showSuccess && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">配置验证通过</p>
            <p className="text-sm text-green-600">材料包配置正确，可以开始游戏。</p>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3 mb-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">配置错误 ({errors.length})</p>
              <p className="text-sm text-red-600">请修复以下问题后再使用此材料包：</p>
            </div>
          </div>
          <ul className="space-y-2 ml-8">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                <span className="font-medium">{index + 1}. {error.message}</span>
                <div className="text-xs text-red-500 mt-1">
                  <span className="font-medium">位置：</span>{error.location || '未知'}
                  <br />
                  <span className="font-medium">建议：</span>{error.suggestion}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">配置警告 ({warnings.length})</p>
              <p className="text-sm text-yellow-600">建议注意以下事项：</p>
            </div>
          </div>
          <ul className="space-y-2 ml-8">
            {warnings.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-700">
                {index + 1}. {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
