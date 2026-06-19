import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { NoteSourceType } from "@/types";
import { SOURCE_META } from "@/types";
import { useExplanationStore } from "@/store/useExplanationStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface NoteEditorProps {
  open: boolean;
  onClose: () => void;
}

export function NoteEditor({ open, onClose }: NoteEditorProps) {
  const addNote = useExplanationStore((s) => s.addNote);
  const currentCalcSpecId = useExplanationStore((s) => s.currentCalcSpecId);

  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<NoteSourceType>("normal");
  const [sourceLabel, setSourceLabel] = useState("");
  const [author, setAuthor] = useState("老叶");
  const [cellKey, setCellKey] = useState("");
  const [influences, setInfluences] = useState(false);

  if (!open) return null;

  const submit = () => {
    if (!content.trim()) return;
    addNote({
      content: content.trim(),
      sourceType,
      sourceLabel: sourceLabel.trim() || SOURCE_META[sourceType].label,
      calcSpecId: currentCalcSpecId,
      influencesConclusion: influences,
      author: author.trim() || "匿名",
      cellKey: cellKey.trim() || undefined,
    });
    setContent("");
    setSourceLabel("");
    setCellKey("");
    setInfluences(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="paper-grain w-full max-w-lg rounded-md border border-line bg-surface shadow-atlas-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-display text-base font-semibold">新增评分备注</h3>
          <button onClick={onClose} className="rounded p-1 text-ink-mute hover:bg-surface-2 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-4">
          <Field label="来源类型">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SOURCE_META) as NoteSourceType[]).map((s) => {
                const m = SOURCE_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSourceType(s)}
                    className={cn(
                      "rounded-atlas border px-2 py-1 font-mono-data text-[11px] uppercase tracking-wider transition-colors",
                      sourceType === s ? "text-bg" : "text-ink-soft hover:text-ink",
                    )}
                    style={{
                      backgroundColor: sourceType === s ? m.colorVar : "transparent",
                      borderColor: m.colorVar,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="备注内容">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="写清这条备注说明了什么……"
              className="w-full resize-none rounded-atlas border border-line bg-surface-2 px-2.5 py-2 text-sm text-ink focus:border-ink-mute focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="说话人 / 作者">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-atlas border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink focus:border-ink-mute focus:outline-none"
              />
            </Field>
            <Field label="来源标签（可选）">
              <input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder={SOURCE_META[sourceType].label}
                className="w-full rounded-atlas border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink focus:border-ink-mute focus:outline-none"
              />
            </Field>
          </div>

          <Field label="关联单元（可选，如 U01:I04）">
            <input
              value={cellKey}
              onChange={(e) => setCellKey(e.target.value)}
              placeholder="U01:I04"
              className="w-full rounded-atlas border border-line bg-surface-2 px-2.5 py-1.5 font-mono-data text-sm text-ink focus:border-ink-mute focus:outline-none"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={influences}
              onChange={(e) => setInfluences(e.target.checked)}
              className="h-4 w-4 accent-anomaly"
            />
            标记为"影响本次结论"
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={submit}>
            保存备注
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
