import { usePlaybackStore } from '@/store/usePlaybackStore';
import { CheckCircle, AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react';

export default function WorkOrderSidebar() {
  const workOrders = usePlaybackStore((s) => s.workOrders);
  const selectedId = usePlaybackStore((s) => s.selectedOrderId);
  const selectOrder = usePlaybackStore((s) => s.selectOrder);

  const statusConfig = {
    smooth: { label: '顺利', icon: CheckCircle, color: 'text-jade-500', bg: 'bg-jade-50', bar: 'bg-jade-400', border: 'border-jade-200' },
    supplement: { label: '补录', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', bar: 'bg-amber-400', border: 'border-amber-200' },
    abnormal: { label: '异常', icon: AlertTriangle, color: 'text-coral-500', bg: 'bg-coral-50', bar: 'bg-coral-400', border: 'border-coral-200' },
  };

  const counts = {
    smooth: workOrders.filter((o) => o.status === 'smooth').length,
    supplement: workOrders.filter((o) => o.status === 'supplement').length,
    abnormal: workOrders.filter((o) => o.status === 'abnormal').length,
  };

  return (
    <aside className="w-72 shrink-0 flex flex-col gap-4">
      <div className="card p-4">
        <h2 className="section-title mb-3">
          <FileText className="w-4 h-4" />
          工单分类
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {(['smooth', 'supplement', 'abnormal'] as const).map((k) => {
            const cfg = statusConfig[k];
            const Icon = cfg.icon;
            return (
              <div key={k} className={`${cfg.bg} rounded-sm p-2 text-center border ${cfg.border}`}>
                <div className="text-2xl font-black" style={{ color: cfg.color.includes('jade') ? '#24A85D' : cfg.color.includes('amber') ? '#CD8511' : '#E85538' }}>
                  {counts[k]}
                </div>
                <div className={`text-[10px] font-medium uppercase tracking-wider mt-0.5 ${cfg.color}`}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4 flex-1 overflow-y-auto">
        <h2 className="section-title mb-3">工单列表</h2>
        <div className="space-y-2.5">
          {workOrders.map((o) => {
            const cfg = statusConfig[o.status];
            const Icon = cfg.icon;
            const isSel = o.id === selectedId;
            const delayedCount = o.spareParts.filter((s) => s.status === 'delayed').length;
            const blockedCount = o.spareParts.filter((s) => s.status === 'replaced_blocked').length;
            const pendingCount = o.evidences.filter((e) => e.status === 'pending').length;
            const lastVer = o.versions[o.versions.length - 1];

            return (
              <button
                key={o.id}
                onClick={() => selectOrder(o.id)}
                className={`w-full text-left rounded-md border transition-all duration-200 relative overflow-hidden ${
                  isSel
                    ? 'border-navy-400 bg-navy-50 shadow-card-hover'
                    : 'border-coolgray-200 bg-white hover:border-navy-200 hover:bg-coolgray-50 hover:shadow-card'
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} />
                <div className="px-3.5 py-3 pl-4.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${cfg.color}`} strokeWidth={2.2} />
                      <span className="text-xs font-bold text-coolgray-700 font-mono">{o.orderNo}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSel ? 'text-navy-500 translate-x-0.5' : 'text-coolgray-300'}`} />
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-coolgray-800">{o.pumpStationName}</div>
                  <div className="mt-1 text-[11px] text-coolgray-500 font-mono">
                    {o.plannedStartTime.slice(5, 16)} ~ {o.plannedEndTime.slice(11, 16)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {delayedCount > 0 && (
                      <span className="tag bg-coral-100 text-coral-600 border border-coral-200">延误×{delayedCount}</span>
                    )}
                    {blockedCount > 0 && (
                      <span className="tag bg-navy-50 text-navy-500 border border-navy-200">拦截×{blockedCount}</span>
                    )}
                    {pendingCount > 0 && (
                      <span className="tag bg-amber-100 text-amber-600 border border-amber-200">待补×{pendingCount}</span>
                    )}
                    <span className={`tag ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                  </div>
                  {lastVer && (
                    <div className="mt-2 pt-2 border-t border-coolgray-100 flex items-center justify-between text-[10px] text-coolgray-400 font-mono">
                      <span>{lastVer.version}</span>
                      <span>{lastVer.runAt.slice(5, 16)}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
