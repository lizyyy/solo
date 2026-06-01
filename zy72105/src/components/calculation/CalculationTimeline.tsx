import { format } from 'date-fns';
import { GitBranch, Zap, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const CalculationTimeline = () => {
  const { currentBatchId, batches } = useAppStore();
  const currentBatch = batches.find((b) => b.id === currentBatchId);

  if (!currentBatch || currentBatch.calculationChain.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
        <GitBranch className="w-10 h-10 mx-auto mb-2" />
        <p>执行计算后将在此展示完整决策链</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">计算决策链追溯</h3>
            <p className="text-teal-200 text-sm">每一步计算和决策完整留痕</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {currentBatch.calculationChain.map((node, idx) => {
              const isRework = node.note?.includes('返工');
              return (
                <div key={node.id} className="relative pl-14">
                  <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isRework
                      ? 'bg-orange-500 border-orange-300'
                      : idx === currentBatch.calculationChain.length - 1
                      ? 'bg-green-500 border-green-300'
                      : 'bg-blue-500 border-blue-300'
                  }`}>
                    <span className="text-white text-[10px] font-bold">{node.step}</span>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    isRework ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isRework ? (
                          <RefreshCw className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Zap className="w-4 h-4 text-blue-500" />
                        )}
                        <span className={`font-semibold text-sm ${isRework ? 'text-orange-700' : 'text-slate-700'}`}>
                          {node.operation}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(new Date(node.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>

                    {node.formula && (
                      <div className="mb-2 px-3 py-1.5 bg-white rounded border border-slate-200 inline-block">
                        <p className="font-mono text-xs text-slate-600">{node.formula}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">输入</p>
                        <div className="space-y-0.5">
                          {Object.entries(node.input).map(([key, val]) => {
                            let display: string;
                            if (typeof val === 'number') {
                              display = val.toFixed(2);
                            } else if (Array.isArray(val)) {
                              display = `[${val.map((v: unknown) => typeof v === 'number' ? v.toFixed(1) : String(v)).join(', ')}]`;
                            } else {
                              display = String(val);
                            }
                            return (
                              <p key={key} className="text-xs font-mono text-slate-600">
                                {key}: <span className="font-semibold">{display}</span>
                              </p>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">输出</p>
                        <div className="space-y-0.5">
                          {Object.entries(node.output).map(([key, val]) => {
                            let display: string;
                            if (typeof val === 'number') {
                              display = val.toFixed(2);
                            } else if (Array.isArray(val)) {
                              display = `[${val.map((v: unknown) => typeof v === 'number' ? v.toFixed(1) : String(v)).join(', ')}]`;
                            } else {
                              display = String(val);
                            }
                            return (
                              <p key={key} className="text-xs font-mono text-slate-600">
                                {key}: <span className="font-semibold text-blue-600">{display}</span>
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {node.note && (
                      <div className={`mt-2 text-xs ${isRework ? 'text-orange-600' : 'text-slate-500'} flex items-center gap-1`}>
                        {isRework && <RefreshCw className="w-3 h-3" />}
                        {node.note}
                      </div>
                    )}

                    {node.operator && (
                      <p className="mt-1 text-[10px] text-slate-400">操作人: {node.operator}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
