import { useState } from "react";
import { MessageSquare, PencilLine, Check, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { formatTime } from "@/utils/export";

export default function NoteTimeline() {
  const { runs, paramVersions, setEditorNoteForRun } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const startEdit = (runId: string, currentNote?: string) => {
    setEditingId(runId);
    setNoteDraft(currentNote || "");
  };

  const save = (runId: string) => {
    setEditorNoteForRun(runId, noteDraft);
    setEditingId(null);
  };

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-ink-300">
        <MessageSquare size={28} className="mx-auto mb-2 opacity-60" />
        <p className="text-sm">暂无验算运行</p>
        <p className="text-xs text-ink-400 mt-1">
          每次验算结束可追加备注，永不覆盖
        </p>
      </div>
    );
  }

  const pvMap = new Map(paramVersions.map((p) => [p.id, p]));
  const sortedRuns = [...runs].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <ol className="relative space-y-4">
      {sortedRuns.map((run, idx) => {
        const pv = pvMap.get(run.paramVersionId);
        const isEditing = editingId === run.id;
        return (
          <li key={run.id} className="relative pl-5">
            <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-ink-500 ring-4 ring-ink-100" />
            {idx < sortedRuns.length - 1 && (
              <span className="absolute left-[5px] top-4 bottom-[-16px] w-px bg-fog-300" />
            )}
            <div className="text-[11px] text-ink-400 font-mono">
              {formatTime(run.startedAt)}
            </div>
            <div className="text-sm font-serif font-semibold text-ink-600 mt-0.5">
              {pv?.name || "（参数版本已删除）"}
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              总草稿 {run.allDraftIds.length} 条 · 有效 {run.validDraftIds.length} 条 · 异常 {run.anomalies.length} 项
            </div>
            <div className="text-xs text-ink-400 mt-0.5 italic">
              {run.summary}
            </div>
            <div className="mt-2">
              {isEditing ? (
                <div className="space-y-1">
                  <textarea
                    autoFocus
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="w-full p-2 rounded border border-fog-300 bg-white text-xs"
                    rows={2}
                    placeholder="追加阿宁的备注…"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => save(run.id)}
                      className="btn-secondary !py-1 !text-xs"
                    >
                      <Check size={12} />
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary !py-1 !text-xs"
                    >
                      <X size={12} />
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  {run.editorNote ? (
                    <div className="p-2 rounded bg-ink-50 border border-ink-100 text-xs text-ink-600 relative">
                      <span className="block">{run.editorNote}</span>
                      <button
                        onClick={() => startEdit(run.id, run.editorNote)}
                        className="absolute right-1 top-1 text-ink-300 group-hover:text-ink-500"
                      >
                        <PencilLine size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(run.id)}
                      className="text-xs text-ink-400 hover:text-ink-600 inline-flex items-center gap-1"
                    >
                      <PencilLine size={11} />
                      追加备注
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
