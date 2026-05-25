import { useNetworkStore } from '@/store/useNetworkStore';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function ImpactAnalysisPanel() {
  const { network, impactAnalysis } = useNetworkStore();

  const affectedZones = network.customerZones.filter((z) =>
    impactAnalysis.affectedZoneIds.includes(z.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <AlertTriangle className="w-4 h-4 text-cyan-400" />
        <span>影响分析</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">受影响片区</div>
          <div className="text-xl font-bold text-cyan-400">
            {impactAnalysis.affectedZoneIds.length}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">受影响用户</div>
          <div className="text-xl font-bold text-orange-400">
            {impactAnalysis.affectedCustomerCount}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">隔离管线</div>
          <div className="text-xl font-bold text-purple-400">
            {impactAnalysis.isolatedPipes.length}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">隔离节点</div>
          <div className="text-xl font-bold text-green-400">
            {impactAnalysis.isolatedNodes.length}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-400">状态检测</div>
        <div
          className={`flex items-center gap-2 p-2 rounded-lg ${
            impactAnalysis.hasConflict
              ? 'bg-red-500/20 border border-red-500/30'
              : 'bg-green-500/20 border border-green-500/30'
          }`}
        >
          {impactAnalysis.hasConflict ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-400" />
          )}
          <span
            className={`text-sm ${
              impactAnalysis.hasConflict ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {impactAnalysis.hasConflict ? '存在冲突' : '方案有效'}
          </span>
        </div>

        {impactAnalysis.hasConflict && (
          <div className="space-y-1">
            {impactAnalysis.conflictDetails.map((detail, index) => (
              <div
                key={index}
                className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20"
              >
                ⚠️ {detail}
              </div>
            ))}
          </div>
        )}
      </div>

      {affectedZones.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">受影响片区详情</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {affectedZones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between p-2 bg-slate-800/50 rounded text-sm border border-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="text-slate-300">{zone.name}</span>
                </div>
                <span className="text-slate-400">
                  {zone.customerCount}户
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
