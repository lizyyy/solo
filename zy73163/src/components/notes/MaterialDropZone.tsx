import { useState } from "react";
import { FolderInput, Plus, Trash2, Paperclip } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";

export function MaterialDropZone() {
  const materials = useExplanationStore((s) => s.materials);
  const currentCalcSpecId = useExplanationStore((s) => s.currentCalcSpecId);
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const addMaterial = useExplanationStore((s) => s.addMaterial);
  const removeMaterial = useExplanationStore((s) => s.removeMaterial);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);

  const calcSpec = calcSpecs.find((c) => c.id === currentCalcSpecId);

  const submit = () => {
    if (!title.trim()) return;
    addMaterial({
      title: title.trim(),
      content: content.trim(),
      calcSpecId: currentCalcSpecId,
    });
    setTitle("");
    setContent("");
    setOpen(false);
  };

  return (
    <SectionCard
      title="材料投放区"
      subtitle={`放材料的地方 · 绑定当前口径「${calcSpec?.name ?? ""}」`}
      icon={<FolderInput className="h-4 w-4" />}
      action={
        <Button
          size="sm"
          variant="outline"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setOpen((v) => !v)}
        >
          投放材料
        </Button>
      }
    >
      {open && (
        <div className="mb-3 space-y-2 rounded-md border border-dashed border-line-strong bg-surface-2/50 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="材料标题（如：评分口径对照表）"
            className="w-full rounded-atlas border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-ink-mute focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="材料内容或要点……"
            className="w-full resize-none rounded-atlas border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-ink-mute focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button size="sm" variant="primary" onClick={submit}>
              保存
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {materials.map((m) => (
          <li
            key={m.id}
            className="group flex items-start gap-2.5 rounded-md border border-line bg-surface-2/50 p-3"
          >
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{m.title}</span>
                <span className="font-mono-data text-[10px] text-ink-mute">
                  {formatTime(m.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">{m.content}</p>
            </div>
            <button
              onClick={() => removeMaterial(m.id)}
              className="rounded p-1 text-ink-mute opacity-0 transition-opacity hover:text-unit-missing group-hover:opacity-100"
              title="移除材料"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {materials.length === 0 && (
          <li className="rounded-md border border-dashed border-line py-6 text-center text-xs text-ink-mute">
            还没有材料，点"投放材料"添加
          </li>
        )}
      </ul>
    </SectionCard>
  );
}
