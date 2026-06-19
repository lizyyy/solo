import { useState } from "react";
import { ChevronRight, GitBranch, X } from "lucide-react";
import type { CalcSpec, ScoringNote, NoteSourceType } from "@/types";
import { SOURCE_META } from "@/types";
import { formatTime } from "@/utils/matrix";
import { cn } from "@/lib/utils";

interface ProvenanceChipProps {
  label: string;
  calcSpec?: CalcSpec;
  notes: ScoringNote[];
  sourceType?: NoteSourceType;
  className?: string;
}

// 数字来源线索：口径 → 备注 → 记录
export function ProvenanceChip({ label, calcSpec, notes, sourceType, className }: ProvenanceChipProps) {
  const [open, setOpen] = useState(false);
  const meta = sourceType ? SOURCE_META[sourceType] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-atlas border border-line bg-surface-2 px-1.5 py-0.5 font-mono-data text-[10px] uppercase tracking-wider text-ink-soft transition-colors hover:border-ink-mute hover:text-ink",
          className,
        )}
        title="查看数字来源线索"
      >
        <GitBranch className="h-3 w-3" />
        {label}
        <ChevronRight className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="paper-grain w-full max-w-lg rounded-md border border-line bg-surface shadow-atlas-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-ink-mute" />
                <h3 className="font-display text-base font-semibold">数字来源线索</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-ink-mute hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3 p-4">
              <p className="text-xs text-ink-soft">
                这个数字的来历，沿"<span className="font-semibold">计算口径 → 评分备注 → 记录</span>"逐层展开。
              </p>

              <ol className="space-y-2.5">
                <li className="rounded-md border border-line bg-surface-2 p-3">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
                    第 1 层 · 计算口径
                  </div>
                  {calcSpec ? (
                    <div className="mt-1">
                      <div className="font-semibold text-ink">{calcSpec.name}</div>
                      <div className="mt-0.5 text-xs text-ink-soft">{calcSpec.basis}</div>
                      <div className="mt-1 flex flex-wrap gap-3 font-mono-data text-[11px] text-ink-mute">
                        <span>k={calcSpec.factors}</span>
                        <span>λ={calcSpec.regularization}</span>
                        <span>iter={calcSpec.iterations}</span>
                        <span>lr={calcSpec.learningRate}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-ink-mute">未关联口径</div>
                  )}
                </li>

                <li className="rounded-md border border-line bg-surface-2 p-3">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
                    第 2 层 · 评分备注（{notes.length} 条）
                  </div>
                  {notes.length === 0 ? (
                    <div className="mt-1 text-xs text-ink-mute">该数字无直接关联备注</div>
                  ) : (
                    <ul className="mt-1.5 space-y-1.5">
                      {notes.map((n) => {
                        const m = SOURCE_META[n.sourceType];
                        return (
                          <li key={n.id} className="text-xs">
                            <span
                              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                              style={{ backgroundColor: m.colorVar }}
                            />
                            <span className="text-ink">{n.content}</span>
                            <span className="ml-1 text-ink-mute">
                              — {n.author} · {formatTime(n.createdAt)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>

                <li className="rounded-md border border-line bg-surface-2 p-3">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
                    第 3 层 · 记录来源
                  </div>
                  {meta ? (
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span
                        className="inline-flex items-center gap-1 rounded-atlas border px-1.5 py-0.5 font-mono-data uppercase"
                        style={{ color: meta.colorVar, borderColor: meta.colorVar, backgroundColor: meta.softVar }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-ink-soft">{meta.desc}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-ink-mute">未标注来源类型</div>
                  )}
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
