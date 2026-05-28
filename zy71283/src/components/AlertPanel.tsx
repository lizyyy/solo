import type { DirtyDataAlert } from '@/data/types';
import { useStore } from '@/store/useStore';
import { AlertTriangle, XCircle, Info, Check } from 'lucide-react';

const iconMap = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  critical: 'border-critical/40 bg-critical/10 text-critical',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
};

const issueLabelMap = {
  same_color_different_name: '同色不同名',
  background_contamination: '背景色混入',
  distance_scale_error: '距离尺度错',
};

export default function AlertPanel() {
  const alerts = useStore(s => s.dirtyAlerts);
  const resolveAlert = useStore(s => s.resolveAlert);
  const unresolved = alerts.filter(a => !a.resolved);

  if (unresolved.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          脏数据预警
          <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
            {unresolved.length}
          </span>
        </h3>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {unresolved.map(alert => (
          <AlertCard key={alert.id} alert={alert} onResolve={() => resolveAlert(alert.id)} />
        ))}
      </div>
    </div>
  );
}

function AlertCard({ alert, onResolve }: { alert: DirtyDataAlert; onResolve: () => void }) {
  const Icon = iconMap[alert.severity];
  const colors = colorMap[alert.severity];

  return (
    <div className={`rounded-lg border p-3 text-xs ${colors} transition-all`}>
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{issueLabelMap[alert.issueType]}</span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">{alert.description}</p>
          <p className="text-[11px] opacity-70 mt-1 italic">建议：{alert.suggestion}</p>
        </div>
        <button
          onClick={onResolve}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          title="标记已处理"
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
