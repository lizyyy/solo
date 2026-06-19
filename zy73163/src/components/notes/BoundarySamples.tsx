import { Sparkles, Link2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useExplanationStore } from "@/store/useExplanationStore";
import { SectionCard } from "@/components/ui/SectionCard";
import { Pill } from "@/components/ui/Pill";

export function BoundarySamples() {
  const navigate = useNavigate();
  const samples = useExplanationStore((s) => s.boundarySamples);
  const notes = useExplanationStore((s) => s.notes);
  const setFocus = useExplanationStore((s) => s.setFocus);

  return (
    <SectionCard
      title="边界样本 · 凭感觉的关系"
      subtitle="样本太少时靠直觉补的评分，老叶希望把这种关系留下来"
      icon={<Sparkles className="h-4 w-4" />}
    >
      <ul className="space-y-2.5">
        {samples.map((s) => {
          const linked = notes.filter((n) => s.noteIds.includes(n.id));
          return (
            <li
              key={s.id}
              className="rounded-md border border-line bg-surface-2/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-data text-sm font-semibold text-ink">{s.label}</span>
                    {s.intuitionBased ? (
                      <Pill tone="verbal" title="样本少，凭感觉补分">凭感觉</Pill>
                    ) : (
                      <Pill tone="neutral">待补样本</Pill>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{s.description}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="flex items-center gap-1 font-mono-data text-[11px] text-ink-mute">
                  <Link2 className="h-3 w-3" />
                  关联备注 {linked.length} 条
                </span>
                {linked[0] && (
                  <button
                    onClick={() => {
                      setFocus({ noteId: linked[0].id });
                      navigate("/notes");
                    }}
                    className="flex items-center gap-1 font-mono-data text-[11px] text-ink-soft hover:text-ink"
                  >
                    看备注 <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
