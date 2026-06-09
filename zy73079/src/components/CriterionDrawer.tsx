import { X, Ruler, CalendarClock, User, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatTime } from '../utils';

export default function CriterionDrawer() {
  const { showCriterion, toggleCriterion, criterion } = useAppStore();
  if (!showCriterion) return null;

  const lines = criterion.formulaDescription.split('\n').filter(Boolean);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={toggleCriterion}
      />
      <div className="w-[460px] max-w-[92vw] h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler size={16} className="text-blue-400" />
            <h3 className="text-slate-100 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              异常判定计算口径
            </h3>
          </div>
          <button
            onClick={toggleCriterion}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-mono font-semibold">
                {criterion.version}
              </span>
              {criterion.isActive && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  <CheckCircle2 size={10} /> 当前生效
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
              <span className="inline-flex items-center gap-0.5">
                <User size={10} /> {criterion.updatedBy}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <CalendarClock size={10} /> {formatTime(criterion.updatedAt)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 font-medium">判定阈值</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-orange-500/30 bg-slate-800/60 p-2.5">
                <div className="text-[10px] text-orange-400 mb-1">温度阈值</div>
                <div className="text-lg font-mono text-slate-100">
                  {criterion.temperatureThreshold}
                  <span className="text-xs text-slate-500 ml-0.5">℃</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  预警 ≥ {(criterion.temperatureThreshold * 0.8).toFixed(0)}℃
                </div>
              </div>
              <div className="rounded border border-purple-500/30 bg-slate-800/60 p-2.5">
                <div className="text-[10px] text-purple-400 mb-1">振动阈值</div>
                <div className="text-lg font-mono text-slate-100">
                  {criterion.vibrationThreshold}
                  <span className="text-xs text-slate-500 ml-0.5">mm/s</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  预警 ≥ {(criterion.vibrationThreshold * 0.8).toFixed(1)}
                </div>
              </div>
              <div className="rounded border border-blue-500/30 bg-slate-800/60 p-2.5">
                <div className="text-[10px] text-blue-400 mb-1">磨损阈值</div>
                <div className="text-lg font-mono text-slate-100">
                  {criterion.wearThreshold}
                  <span className="text-xs text-slate-500 ml-0.5">mm</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  预警 ≥ {(criterion.wearThreshold * 0.8).toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 font-medium">判定公式说明</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 font-mono text-xs leading-relaxed">
              {lines.map((line, i) => (
                <div key={i} className="text-slate-300">
                  {line.startsWith('-') ? (
                    <span className="text-slate-400">{line.replace(/^-\s*/, '  • ')}</span>
                  ) : (
                    <span className="text-blue-300">{line}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-medium">状态映射</div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-center">
                <div className="text-emerald-400 font-semibold">正常</div>
                <div className="text-emerald-300/70 text-[10px] mt-0.5">＜ 80%阈值</div>
              </div>
              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-center">
                <div className="text-amber-400 font-semibold">预警</div>
                <div className="text-amber-300/70 text-[10px] mt-0.5">80%~100%阈值</div>
              </div>
              <div className="rounded bg-red-500/10 border border-red-500/30 p-2 text-center">
                <div className="text-red-400 font-semibold">异常</div>
                <div className="text-red-300/70 text-[10px] mt-0.5">≥ 100%阈值</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 text-[11px] text-slate-400">
            <div className="font-medium text-slate-300 mb-1">📍 如何回到"计算口径"？</div>
            <p>
              在"异常归因列表"中每条记录右侧标注了所使用的口径版本号；
              在巡检表详情中点击任一"备注→报告"关联链时，报告中也会引用本口径说明。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
