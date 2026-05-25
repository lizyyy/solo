import { useMemo } from 'react';
import { useNetworkStore } from '@/store/useNetworkStore';
import { X, Users, MapPin, Layers, AlertTriangle, CheckCircle, ArrowRight, ArrowDown } from 'lucide-react';
import type { Solution } from '@/types';

interface SolutionDiff {
  valveCountDiff: number;
  customerDiff: number;
  zoneDiff: string[];
  uniqueValves: { [solutionId: string]: string[] };
  commonValves: string[];
}

export function SolutionComparison() {
  const { solutions, comparisonSolutionIds, setShowComparison, clearComparison, currentScenario } = useNetworkStore();

  const comparisonSolutions = useMemo(() => {
    return comparisonSolutionIds
      .map((id) => solutions.find((s) => s.id === id))
      .filter(Boolean) as Solution[];
  }, [comparisonSolutionIds, solutions]);

  const diff = useMemo((): SolutionDiff | null => {
    if (comparisonSolutions.length < 2) return null;

    const allValveSets = comparisonSolutions.map((s) =>
      new Set(s.valveActions.filter((a) => a.toStatus === 'closed').map((a) => a.valveId))
    );

    const commonValves = [...allValveSets[0]].filter((v) => allValveSets.every((set) => set.has(v)));
    const uniqueValves: { [key: string]: string[] } = {};

    comparisonSolutions.forEach((s, index) => {
      uniqueValves[s.id] = [...allValveSets[index]].filter((v) => !commonValves.includes(v));
    });

    const customerCounts = comparisonSolutions.map((s) => s.impactAnalysis.affectedCustomerCount);
    const maxCustomers = Math.max(...customerCounts);
    const minCustomers = Math.min(...customerCounts);
    const customerDiff = maxCustomers - minCustomers;

    const allZoneSets = comparisonSolutions.map((s) => new Set(s.impactAnalysis.affectedZoneIds));
    const commonZones = [...allZoneSets[0]].filter((z) => allZoneSets.every((set) => set.has(z)));
    const zoneDiff = comparisonSolutions.flatMap((s) =>
      s.impactAnalysis.affectedZoneIds.filter((z) => !commonZones.includes(z))
    );

    return {
      valveCountDiff: Math.max(...comparisonSolutions.map((s) => s.valveActions.filter((a) => a.toStatus === 'closed').length)) -
        Math.min(...comparisonSolutions.map((s) => s.valveActions.filter((a) => a.toStatus === 'closed').length)),
      customerDiff,
      zoneDiff: [...new Set(zoneDiff)],
      uniqueValves,
      commonValves,
    };
  }, [comparisonSolutions]);

  const getZoneName = (zoneId: string) => {
    return currentScenario.initialNetwork.customerZones.find((z) => z.id === zoneId)?.name || zoneId;
  };

  if (comparisonSolutions.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            方案对比分析
            <span className="text-sm font-normal text-slate-400">
              ({comparisonSolutions.length} 个方案)
            </span>
          </h2>
          <button
            onClick={() => setShowComparison(false)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparisonSolutions.length}, 1fr)` }}>
            {comparisonSolutions.map((solution) => (
              <div
                key={solution.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
              >
                <h3 className="font-bold text-white mb-3 text-center">{solution.name}</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      关闭阀门
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {solution.valveActions.filter((a) => a.toStatus === 'closed').length} 个
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      受影响用户
                    </span>
                    <span className="text-orange-400 font-bold">
                      {solution.impactAnalysis.affectedCustomerCount} 户
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      受影响片区
                    </span>
                    <span className="text-purple-400 font-bold">
                      {solution.impactAnalysis.affectedZoneIds.length} 个
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      {solution.impactAnalysis.hasConflict ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      方案状态
                    </span>
                    <span
                      className={`font-bold ${
                        solution.impactAnalysis.hasConflict ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {solution.impactAnalysis.hasConflict ? '存在冲突' : '有效'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-500 mb-2">关闭的阀门:</div>
                  <div className="flex flex-wrap gap-1">
                    {solution.valveActions
                      .filter((a) => a.toStatus === 'closed')
                      .map((action) => (
                        <span
                          key={action.valveId}
                          className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
                        >
                          {action.valveId}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {diff && comparisonSolutions.length >= 2 && (
            <div className="mt-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl border border-cyan-500/30 p-4">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <ArrowDown className="w-5 h-5 text-cyan-400" />
                差异分析
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                    用户差异:
                    <span className="text-orange-400 font-bold">{diff.customerDiff} 户</span>
                  </div>

                  <div className="text-sm text-slate-300 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                    阀门操作差异:
                    <span className="text-cyan-400 font-bold">{diff.valveCountDiff} 个</span>
                  </div>

                  {diff.commonValves.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">共同关闭的阀门:</div>
                      <div className="flex flex-wrap gap-1">
                        {diff.commonValves.map((v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400 border border-green-500/30"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">差异阀门明细:</div>
                  <div className="space-y-2">
                    {comparisonSolutions.map((s) => (
                      <div key={s.id} className="text-xs">
                        <span className="text-slate-300 font-medium">{s.name}:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {diff.uniqueValves[s.id]?.length > 0 ? (
                            diff.uniqueValves[s.id].map((v) => (
                              <span
                                key={v}
                                className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              >
                                {v}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">无差异</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {diff.zoneDiff.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-2">片区差异 (仅部分方案影响):</div>
                  <div className="flex flex-wrap gap-1">
                    {diff.zoneDiff.map((z) => (
                      <span
                        key={z}
                        className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      >
                        {getZoneName(z)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <button
            onClick={clearComparison}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-all"
          >
            清除对比选择
          </button>
          <button
            onClick={() => setShowComparison(false)}
            className="px-4 py-2 text-sm bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all border border-cyan-500/30"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
