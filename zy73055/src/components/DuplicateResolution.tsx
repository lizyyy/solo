import { useState } from 'react';
import { AlertTriangle, SkipForward, Combine, Eraser, ShieldCheck, ArrowRight } from 'lucide-react';
import type { DuplicateWarning } from '../types';

interface DuplicateResolutionProps {
  warnings: DuplicateWarning[];
  actionMap: Record<string, 'skip' | 'merge' | 'overwrite'>;
  onChange: (key: string, action: 'skip' | 'merge' | 'overwrite') => void;
}

export function DuplicateResolution({ warnings, actionMap, onChange }: DuplicateResolutionProps) {
  const [expanded, setExpanded] = useState<string | null>(warnings[0]?.deviceNo ?? null);

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm mb-1">
              检测到 <span className="text-blue-700">{warnings.length}</span> 条设备编号重复
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <b>未报错阻断</b>，请选择处理方式。<b className="text-blue-700">默认跳过可避免正常记录翻倍、人工备注也不被覆盖</b>。
              如需其他策略，可逐条选择。
            </div>
          </div>
        </div>
      </div>

      {warnings.map((w) => {
        const key = `${w.deviceNo}::${w.newOrderId}`;
        const action = actionMap[key] ?? w.suggestion;
        const isExpanded = expanded === w.deviceNo;
        return (
          <div key={key} className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => setExpanded(isExpanded ? null : w.deviceNo)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className={`p-1.5 rounded-md ${
                action === 'skip' ? 'bg-slate-100 text-slate-600'
                  : action === 'merge' ? 'bg-amber-100 text-amber-700'
                  : 'bg-violet-100 text-violet-700'
              }`}>
                {action === 'skip' ? <SkipForward className="w-4 h-4" />
                  : action === 'merge' ? <Combine className="w-4 h-4" />
                  : <Eraser className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-slate-800">{w.deviceNo}</span>
                  <span className="text-[11px] text-slate-500">
                    已有：<span className="font-mono">{w.existingOrderNo}</span>
                    <ArrowRight className="w-3 h-3 inline mx-1 align-middle" />
                    新导入：<span className="font-mono">{w.newOrderNo}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{w.nextStepText}</div>
              </div>
              <div className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                action === 'skip' ? 'bg-slate-50 text-slate-700 border-slate-200'
                  : action === 'merge' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'
              }`}>
                {action === 'skip' ? '跳过（不翻倍）'
                  : action === 'merge' ? '合并'
                  : '覆盖字段'}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-200 p-4 bg-slate-50/60 space-y-3">
                <div className="text-xs text-slate-700 bg-white rounded-md border border-slate-200 p-3 leading-relaxed">
                  <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    下一步处理建议
                  </div>
                  {w.nextStepText}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    { k: 'skip' as const, label: '跳过（不导入）', desc: '不产生重复记录', icon: <SkipForward className="w-4 h-4" />, cls: 'bg-slate-600' },
                    { k: 'merge' as const, label: '合并到现有工单', desc: '合并照片/附件', icon: <Combine className="w-4 h-4" />, cls: 'bg-amber-500' },
                    { k: 'overwrite' as const, label: '覆盖字段', desc: '除人工备注外全更新', icon: <Eraser className="w-4 h-4" />, cls: 'bg-violet-500' },
                  ]).map(opt => {
                    const active = action === opt.k;
                    return (
                      <button
                        key={opt.k}
                        onClick={() => onChange(key, opt.k)}
                        className={`p-3 rounded-md border-2 text-left transition-all ${
                          active
                            ? `${opt.cls} text-white border-transparent shadow-md`
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {opt.icon}
                          <span className="text-xs font-bold">{opt.label}</span>
                        </div>
                        <div className={`text-[10px] ${active ? 'text-white/90' : 'text-slate-500'}`}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-2 text-[11px] text-emerald-700 bg-emerald-50 rounded border border-emerald-200 p-2.5">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <b>人工备注安全承诺：</b>无论选择哪种策略，现有人工备注<b>永不被覆盖</b>（跳过 / 合并均保留，覆盖时只更新其他字段、唯独跳过 manualRemark 字段）。
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
