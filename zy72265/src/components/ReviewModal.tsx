import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, RotateCcw, Edit3 } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import type { CoordinatePoint, ReviewPointRequest } from '../../shared/types';
import { formatDate } from '../../shared/utils/formatters';
import { cn } from '../lib/utils';

interface ReviewModalProps {
  isOpen: boolean;
  point: CoordinatePoint | null;
  onClose: () => void;
}

type ReviewAction = 'CONFIRM_LAT_LNG' | 'CONFIRM_METRIC' | 'CORRECT' | 'ROLLBACK';

export function ReviewModal({ isOpen, point, onClose }: ReviewModalProps) {
  const { reviewPoint, loading, currentAuditLogs } = useEnvelopeStore();
  const [action, setAction] = useState<ReviewAction>('CONFIRM_METRIC');
  const [xValue, setXValue] = useState<string>('');
  const [yValue, setYValue] = useState<string>('');
  const [safetyRadius, setSafetyRadius] = useState<string>('');
  const [remark, setRemark] = useState<string>('');

  if (!isOpen || !point) return null;

  const pointAuditLogs = currentAuditLogs.filter(log => log.pointId === point.id);

  const handleSubmit = async () => {
    if (!remark.trim()) {
      return;
    }

    const request: ReviewPointRequest = {
      pointId: point.id,
      action,
      remark: remark.trim(),
      operator: '',
    };

    if (action === 'CORRECT') {
      request.xValue = parseFloat(xValue);
      request.yValue = parseFloat(yValue);
      if (safetyRadius) {
        request.safetyRadius = parseFloat(safetyRadius);
      }
    }

    const success = await reviewPoint(request);
    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    setAction('CONFIRM_METRIC');
    setXValue('');
    setYValue('');
    setSafetyRadius('');
    setRemark('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-800 rounded-lg border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            复核坐标混合记录
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <span className="text-xs text-slate-400">原始行号</span>
                <div className="text-white font-mono">{point.originalLineNumber}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">坐标类型</span>
                <div className="text-amber-400 font-medium">经纬度 + 米制 混合</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">X 坐标</span>
                <div className="text-white font-mono">{point.xValue.toFixed(6)}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Y 坐标</span>
                <div className="text-white font-mono">{point.yValue.toFixed(6)}</div>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400">原始值</span>
              <div className="text-slate-300 font-mono text-sm bg-slate-800 p-2 rounded mt-1 break-all">
                {point.rawValue}
              </div>
            </div>
          </div>

          {pointAuditLogs.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-300 mb-3">历史记录</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pointAuditLogs.map(log => (
                  <div key={log.id} className="bg-slate-900/30 border border-slate-700/50 rounded p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400">{log.actionType === 'IMPORT' ? '导入' : log.actionType}</span>
                      <span className="text-xs text-slate-500">{formatDate(log.timestamp)}</span>
                    </div>
                    {log.remark && <p className="text-slate-300">{log.remark}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                处理方式
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAction('CONFIRM_METRIC')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    action === 'CONFIRM_METRIC'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                >
                  <CheckCircle className={cn('h-5 w-5 mb-2', action === 'CONFIRM_METRIC' ? 'text-emerald-400' : 'text-slate-400')} />
                  <div className={cn('font-medium', action === 'CONFIRM_METRIC' ? 'text-emerald-300' : 'text-slate-300')}>
                    确认为米制
                  </div>
                  <div className="text-xs text-slate-500 mt-1">按米制坐标归一化</div>
                </button>

                <button
                  onClick={() => setAction('CONFIRM_LAT_LNG')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    action === 'CONFIRM_LAT_LNG'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                >
                  <CheckCircle className={cn('h-5 w-5 mb-2', action === 'CONFIRM_LAT_LNG' ? 'text-blue-400' : 'text-slate-400')} />
                  <div className={cn('font-medium', action === 'CONFIRM_LAT_LNG' ? 'text-blue-300' : 'text-slate-300')}>
                    确认为经纬度
                  </div>
                  <div className="text-xs text-slate-500 mt-1">按经纬度坐标归一化</div>
                </button>

                <button
                  onClick={() => setAction('CORRECT')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    action === 'CORRECT'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                >
                  <Edit3 className={cn('h-5 w-5 mb-2', action === 'CORRECT' ? 'text-amber-400' : 'text-slate-400')} />
                  <div className={cn('font-medium', action === 'CORRECT' ? 'text-amber-300' : 'text-slate-300')}>
                    手动修正
                  </div>
                  <div className="text-xs text-slate-500 mt-1">人工输入正确坐标</div>
                </button>

                <button
                  onClick={() => setAction('ROLLBACK')}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    action === 'ROLLBACK'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                  disabled={pointAuditLogs.length < 2}
                >
                  <RotateCcw className={cn('h-5 w-5 mb-2', action === 'ROLLBACK' ? 'text-purple-400' : 'text-slate-400')} />
                  <div className={cn('font-medium', action === 'ROLLBACK' ? 'text-purple-300' : 'text-slate-300')}>
                    回滚
                  </div>
                  <div className="text-xs text-slate-500 mt-1">恢复到上一历史状态</div>
                </button>
              </div>
            </div>

            {action === 'CORRECT' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">X 坐标</label>
                  <input
                    type="number"
                    step="any"
                    value={xValue}
                    onChange={(e) => setXValue(e.target.value)}
                    placeholder={point.xValue.toString()}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Y 坐标</label>
                  <input
                    type="number"
                    step="any"
                    value={yValue}
                    onChange={(e) => setYValue(e.target.value)}
                    placeholder={point.yValue.toString()}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">安全半径</label>
                  <input
                    type="number"
                    step="any"
                    value={safetyRadius}
                    onChange={(e) => setSafetyRadius(e.target.value)}
                    placeholder={point.safetyRadius?.toString() || '可选'}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                复核说明 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="请说明判定依据，例如：经现场核实，该点实际为米制坐标，GPS模块读数错误..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                复核说明将作为审计证据永久保留，请详细填写判定依据
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!remark.trim() || loading}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-all',
              remark.trim() && !loading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            确认提交
          </button>
        </div>
      </div>
    </div>
  );
}
