import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Anomaly } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface AnomalyAlertProps {
  anomaly: Anomaly;
  onConfirm?: (id: string) => void;
  showConfirm?: boolean;
}

const anomalyTypeLabels: Record<string, string> = {
  lighting_overridden: '灯光方案覆盖',
  dimension_unit_error: '尺寸单位错误',
  artwork_replaced_no_trace: '作品调换无记录',
  note_silently_overwritten: '备注静默覆盖',
  unit_mismatch: '单位不一致',
};

export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({ anomaly, onConfirm, showConfirm = true }) => {
  return (
    <div className={`p-4 rounded-lg border ${
      anomaly.severity === 'danger' 
        ? 'bg-red-50 border-red-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${anomaly.severity === 'danger' ? 'text-red-500' : 'text-yellow-500'}`}>
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              anomaly.severity === 'danger' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {anomaly.severity === 'danger' ? '严重' : '警告'}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {anomalyTypeLabels[anomaly.type] || anomaly.type}
            </span>
            {anomaly.confirmed && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> 已确认
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{anomaly.description}</p>
          <div className="text-xs text-gray-400">
            发现时间：{format(new Date(anomaly.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </div>
        </div>
        {showConfirm && !anomaly.confirmed && onConfirm && (
          <button
            onClick={() => onConfirm(anomaly.id)}
            className="btn btn-success text-xs py-1 px-3"
          >
            确认
          </button>
        )}
      </div>
    </div>
  );
};
