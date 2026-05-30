import { ExceptionRecord } from '../types';
import {
  formatExceptionTimestamp,
  getSeverityLabel,
} from '../utils/exceptionManager';
import { getExceptionTypeLabel, getSeverityColor } from '../utils/obstacleDetector';
import { AlertTriangle, CheckCircle, MapPin, Clock, XCircle } from 'lucide-react';

interface ExceptionListProps {
  exceptions: ExceptionRecord[];
  onConfirm: (exceptionId: string) => void;
}

export const ExceptionList = ({ exceptions, onConfirm }: ExceptionListProps) => {
  const unconfirmed = exceptions.filter((e) => !e.confirmed);
  const confirmed = exceptions.filter((e) => e.confirmed);

  const typeIcons: Record<string, typeof AlertTriangle> = {
    out_of_bounds: MapPin,
    slope_misjudgment: XCircle,
    breakpoint_crossing: AlertTriangle,
  };

  const renderExceptionCard = (exception: ExceptionRecord) => {
    const Icon = typeIcons[exception.type] || AlertTriangle;
    const severityColor = getSeverityColor(exception.severity);

    return (
      <div
        key={exception.id}
        className={`
          p-4 rounded-lg border transition-all
          ${exception.confirmed
            ? 'bg-slate-800/50 border-slate-700/50 opacity-70'
            : 'bg-slate-800/90 border-red-500/30 shadow-lg shadow-red-500/10'
          }
        `}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${severityColor}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: severityColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  {getExceptionTypeLabel(exception.type)}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: `${severityColor}20`,
                    color: severityColor,
                    border: `1px solid ${severityColor}50`,
                  }}
                >
                  {getSeverityLabel(exception.severity)}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {exception.description}
              </p>
            </div>
          </div>
          {exception.confirmed ? (
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <CheckCircle className="w-4 h-4" />
              已确认
            </div>
          ) : (
            <button
              onClick={() => onConfirm(exception.id)}
              className="px-3 py-1 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-500 transition-colors flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              确认
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-900/50 rounded p-2">
            <span className="text-slate-500">位置:</span>
            <span className="text-slate-300 font-mono ml-1">
              ({exception.position.x.toFixed(2)}, {exception.position.y.toFixed(2)})
            </span>
          </div>
          <div className="bg-slate-900/50 rounded p-2">
            <span className="text-slate-500">批次:</span>
            <span className="text-cyan-400 font-mono ml-1">{exception.batchId}</span>
          </div>
          <div className="bg-slate-900/50 rounded p-2">
            <span className="text-slate-500">记录ID:</span>
            <span className="text-slate-400 font-mono ml-1 text-xs">
              {exception.recordId.slice(0, 12)}...
            </span>
          </div>
          <div className="bg-slate-900/50 rounded p-2 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-slate-400">
              {formatExceptionTimestamp(exception.timestamp)}
            </span>
          </div>
        </div>

        {exception.confirmed && exception.confirmedAt && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
            确认时间: {formatExceptionTimestamp(exception.confirmedAt)}
            {exception.confirmedBy && ` · 确认人: ${exception.confirmedBy}`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {unconfirmed.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            待确认异常 ({unconfirmed.length})
          </h3>
          <div className="space-y-3">
            {unconfirmed.map(renderExceptionCard)}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            已确认异常 ({confirmed.length})
          </h3>
          <div className="space-y-3">
            {confirmed.map(renderExceptionCard)}
          </div>
        </div>
      )}

      {exceptions.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无异常记录</p>
        </div>
      )}
    </div>
  );
};
