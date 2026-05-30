import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Anomaly } from '../../shared/types';
import { ANOMALY_TYPE_LABELS, SEVERITY_COLORS, SEVERITY_LABELS } from '../../shared/types';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

interface AnomalyAlertProps {
  anomaly: Anomaly;
  onResolve?: () => void;
}

export default function AnomalyAlert({ anomaly, onResolve }: AnomalyAlertProps) {
  const [expanded, setExpanded] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const resolveAnomaly = useStore((state) => state.resolveAnomaly);
  const loading = useStore((state) => state.loading[`resolveAnomaly:${anomaly.id}`]);

  const severityColor = SEVERITY_COLORS[anomaly.severity];
  const severityLabel = SEVERITY_LABELS[anomaly.severity];
  const typeLabel = ANOMALY_TYPE_LABELS[anomaly.type];

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    const result = await resolveAnomaly(anomaly.id, resolution);
    if (result) {
      setShowResolveForm(false);
      setResolution('');
      onResolve?.();
    }
  };

  return (
    <div
      className={cn(
        'card border-l-4 transition-all duration-200',
        anomaly.resolved ? 'border-dark-300 opacity-60' : 'border-danger'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${severityColor}20` }}
          >
            {anomaly.resolved ? (
              <CheckCircle className="w-5 h-5 text-dark-300" />
            ) : (
              <AlertTriangle className="w-5 h-5" style={{ color: severityColor }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: `${severityColor}20`, color: severityColor }}
              >
                {severityLabel}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-dark-200 text-slate-300">
                {typeLabel}
              </span>
              {anomaly.resolved && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-dark-200 text-slate-400">
                  已解决
                </span>
              )}
            </div>
            <h4 className="text-white font-medium mb-1">{anomaly.message}</h4>
            <p className="text-sm text-slate-400 mb-2">
              影响实体: {anomaly.affectedEntities.join(', ')}
            </p>

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-primary-light hover:text-primary transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  收起详情
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  查看详情
                </>
              )}
            </button>
          </div>

          {!anomaly.resolved && (
            <button
              onClick={() => setShowResolveForm(!showResolveForm)}
              className="px-3 py-1.5 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
            >
              标记解决
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-dark-200">
            <div className="mb-3">
              <h5 className="text-sm font-medium text-white mb-1">建议处理方案</h5>
              <p className="text-sm text-slate-400">{anomaly.recommendation}</p>
            </div>
            {anomaly.resolved && anomaly.resolution && (
              <div>
                <h5 className="text-sm font-medium text-white mb-1">处理结论</h5>
                <p className="text-sm text-slate-400">{anomaly.resolution}</p>
              </div>
            )}
          </div>
        )}

        {showResolveForm && (
          <div className="mt-4 pt-4 border-t border-dark-200">
            <div className="mb-3">
              <label className="block text-sm font-medium text-white mb-2">
                处理结论
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="请输入处理结论..."
                className="w-full px-4 py-2 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResolveForm(false)}
                className="px-4 py-2 rounded-lg bg-dark-200 text-white hover:bg-dark-300 transition-colors"
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolution.trim() || loading}
                className="px-4 py-2 rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                确认解决
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
