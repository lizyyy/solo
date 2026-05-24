import { RouteValidation } from '../../types';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ValidationInfoProps {
  validation: RouteValidation;
}

export const ValidationInfo = ({ validation }: ValidationInfoProps) => {
  const getStatusBadge = () => {
    if (!validation.isValid) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-lg border border-red-500/30">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">路线存在问题</span>
        </div>
      );
    }

    if (validation.warnings.length > 0) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 rounded-lg border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-orange-400">需要注意</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-lg border border-green-500/30">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm font-medium text-green-400">路线安全</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">路线校验</span>
        {getStatusBadge()}
      </div>

      {validation.errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            错误 ({validation.errors.length})
          </div>
          <div className="space-y-1.5">
            {validation.errors.map((error, i) => (
              <div
                key={i}
                className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300"
              >
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            警告 ({validation.warnings.length})
          </div>
          <div className="space-y-1.5">
            {validation.warnings.map((warning, i) => (
              <div
                key={i}
                className="p-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-300"
              >
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {validation.isValid && validation.warnings.length === 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span>路线规划完成，所有检查项通过</span>
          </div>
        </div>
      )}
    </div>
  );
};
