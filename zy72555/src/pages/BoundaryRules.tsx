import { BOUNDARY_RULES } from '@/utils/boundaryRules';
import { ShieldAlert, AlertTriangle, ArrowRight, FileCode, RotateCcw } from 'lucide-react';

export function BoundaryRules() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert size={24} className="text-red-400" />
          边界规则中心
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          所有边界规则在代码和文档中双重记录，杜绝口头约定。规则变更需同步更新两侧。
        </p>
      </div>

      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-300">核心原则</h3>
            <p className="text-xs text-red-200/80 mt-1">
              边界规则必须代码可执行、文档可查阅。任何规则变更必须同时更新代码实现和本文档。
              少数类样本被总指标盖住等异常情况，一律标记待复核，不得自动归为正常。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {BOUNDARY_RULES.map((rule) => (
          <div
            key={rule.id}
            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-0.5 bg-red-900/50 text-red-300 rounded text-sm font-mono">
                      {rule.id}
                    </code>
                    <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{rule.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">
                  <FileCode size={12} />
                  {rule.codeReference}
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-3">
                <RotateCcw size={14} />
                回滚流程
              </div>
              <ol className="space-y-2">
                {rule.rollbackSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-mono">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ArrowRight size={12} />
                  <span>代码与文档双向同步，任何一侧变更需同时更新另一侧</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">代码内嵌规则示例</h3>
        <pre className="bg-slate-900/80 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto">
{`// 规则编号: BR-001
// 规则名称: 少数类样本被总指标盖住
// 触发条件: overallMetric >= 0.85 && minorityMetric < 0.85 * 0.8
// 处理动作: isBoundaryCase = true, status = 'reviewing'
// 回滚路径: 算法工程师复核后，可手动确认或驳回
// 代码位置: src/utils/boundaryRules.ts#L8-L11
export function checkMinorityClassMasked(log: TrainingLog): boolean {
  return log.overallMetric >= OVERALL_THRESHOLD && 
         log.minorityMetric < OVERALL_THRESHOLD * MINORITY_RATIO_THRESHOLD;
}`}
        </pre>
      </div>
    </div>
  );
}
