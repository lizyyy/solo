import { useSampleStore } from '../store/useSampleStore';
import type { DraftLine } from '../types';

interface Props {
  lines: DraftLine[];
}

export default function DraftSection({ lines }: Props) {
  const hl = useSampleStore((s) => s.ui.highlightedDraftLineId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900">学生草稿 · 现场毛边</h3>
        <span className="label">来源：学生提交原始稿</span>
      </div>
      <div className="paper rounded-lg border border-ink-200 p-5 relative overflow-hidden">
        <div className="absolute top-2 right-3 font-hand text-ink-400/70 text-lg select-none pointer-events-none">
          ~ 草稿 ~
        </div>
        <ol className="space-y-1.5">
          {lines.map((l) => (
            <li
              key={l.id}
              className={`group relative pl-9 pr-20 py-1 rounded -mx-2 transition-colors ${
                hl === l.id ? 'animate-pulseOnce' : ''
              }`}
              style={hl === l.id ? { backgroundColor: 'rgba(245,158,11,0.15)' } : {}}
            >
              <span
                className="absolute left-2 top-1 text-xs font-mono text-ink-400"
                aria-hidden
              >
                L{l.lineNumber}
              </span>
              <span
                className={`block ${l.isWithdrawn ? 'line-through text-ink-400' : ''}`}
                style={{ color: l.isWithdrawn ? undefined : l.clueColor || '#13233c' }}
              >
                <span className="font-hand text-xl leading-tight">{l.content}</span>
              </span>
              {l.isWithdrawn && (
                <span className="absolute right-2 top-1 text-[10px] px-1.5 py-0.5 rounded bg-ink-200/70 text-ink-600 border border-ink-200">
                  已撤回 {l.withdrawnAt}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 pt-3 border-t border-ink-200/60 flex items-center justify-between text-[11px] text-ink-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-ink-300" /> 常规墨迹
            <span className="w-2 h-2 rounded-full bg-amber2-500 ml-2" /> 存疑
            <span className="w-2 h-2 rounded-full bg-emerald2-500 ml-2" /> 自验通过
            <span className="w-2 h-2 rounded-full bg-coral-500 ml-2" /> 系统定位问题
          </span>
          <span className="italic">（划掉的为学生已撤回内容，保留供审核追溯）</span>
        </div>
      </div>
    </div>
  );
}
