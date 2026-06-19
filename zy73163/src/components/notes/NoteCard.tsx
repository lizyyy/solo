import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  StickyNote,
  AlertOctagon,
  Quote,
  User,
  History,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { ScoringNote } from "@/types";
import { useExplanationStore } from "@/store/useExplanationStore";
import { formatTime } from "@/utils/matrix";
import { SourceTag } from "@/components/ui/SourceTag";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface NoteCardProps {
  note: ScoringNote;
}

export function NoteCard({ note }: NoteCardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const toggleInfluence = useExplanationStore((s) => s.toggleInfluence);
  const focus = useExplanationStore((s) => s.focus);
  const clearFocus = useExplanationStore((s) => s.clearFocus);
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const calcSpec = calcSpecs.find((c) => c.id === note.calcSpecId);

  const isFocused = focus.noteId === note.id || focus.cellKey === note.cellKey;

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current.classList.add("ring-2", "ring-ink");
      const t = window.setTimeout(() => {
        ref.current?.classList.remove("ring-2", "ring-ink");
        clearFocus();
      }, 2000);
      return () => window.clearTimeout(t);
    }
  }, [isFocused, clearFocus]);

  return (
    <article
      ref={ref}
      className={cn(
        "rounded-md border bg-surface p-3 transition-shadow",
        note.influencesConclusion ? "border-line-strong shadow-atlas" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag type={note.sourceType} />
          {note.cellKey && (
            <span className="font-mono-data text-[11px] text-ink-soft">{note.cellKey}</span>
          )}
          {note.version > 1 && (
            <span className="inline-flex items-center gap-1 rounded-atlas border border-old-version/40 bg-old-version-soft px-1.5 py-0.5 font-mono-data text-[10px] uppercase text-old-version">
              <History className="h-2.5 w-2.5" />
              v{note.version}
            </span>
          )}
        </div>
        <button
          onClick={() => toggleInfluence(note.id)}
          className={cn(
            "flex items-center gap-1 rounded-atlas border px-2 py-1 font-mono-data text-[10px] uppercase tracking-wider transition-colors",
            note.influencesConclusion
              ? "border-anomaly/40 bg-anomaly-soft text-anomaly"
              : "border-line text-ink-mute hover:text-ink",
          )}
          title="标记是否影响本次结论"
        >
          {note.influencesConclusion ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
          {note.influencesConclusion ? "影响结论" : "不影响"}
        </button>
      </div>

      <p className="mt-2 flex gap-1.5 text-sm text-ink">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
        <span className="leading-relaxed">{note.content}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-data text-[11px] text-ink-mute">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {note.author}
        </span>
        <span className="flex items-center gap-1">
          <StickyNote className="h-3 w-3" />
          {note.sourceLabel}
        </span>
        <span>{formatTime(note.createdAt)}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        {note.cellKey && (
          <Button
            size="sm"
            variant="ghost"
            icon={<AlertOctagon className="h-3.5 w-3.5" />}
            onClick={() => {
              useExplanationStore.getState().setFocus({ cellKey: note.cellKey });
              navigate("/");
            }}
          >
            看异常
          </Button>
        )}
        <ProvenanceChip
          label="数字来源"
          calcSpec={calcSpec}
          notes={[note]}
          sourceType={note.sourceType}
        />
      </div>
    </article>
  );
}
