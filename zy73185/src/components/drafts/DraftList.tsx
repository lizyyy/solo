import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  PencilLine,
  Check,
  X,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { anomalyLabel, formatTime } from "@/utils/export";

export default function DraftList() {
  const {
    drafts,
    currentAnomalies,
    removeStagedDraft,
    updateStagedDraftNote,
    currentRunId,
    runs,
  } = useAppStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const currentRun = runs.find((r) => r.id === currentRunId);
  const validIds = new Set(currentRun?.validDraftIds ?? []);
  const anomaliesByDraft = new Map<string, string[]>();
  for (const a of currentAnomalies) {
    for (const id of a.relatedDraftIds) {
      if (!anomaliesByDraft.has(id)) anomaliesByDraft.set(id, []);
      anomaliesByDraft.get(id)!.push(anomalyLabel(a.type));
    }
  }

  const startEditNote = (draftId: string, currentNote?: string) => {
    setEditingNote(draftId);
    setNoteDraft(currentNote || "");
  };

  const saveNote = (draftId: string) => {
    updateStagedDraftNote(draftId, noteDraft);
    setEditingNote(null);
  };

  if (drafts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-6">
        <div className="text-ink-300 text-sm">
          <p>暂存区为空</p>
          <p className="text-xs text-ink-400 mt-1">
            上方粘贴或载入示例
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {drafts.map((d) => {
        const flags = anomaliesByDraft.get(d.id) || [];
        const isOpen = !!expanded[d.id];
        const isEditingNote = editingNote === d.id;
        const isExcluded =
          currentRun && !validIds.has(d.id) && !!anomaliesByDraft.get(d.id);
        return (
          <li
            key={d.id}
            className={`rounded-lg border bg-fog-50 overflow-hidden ${
              isExcluded ? "border-ochre-300 bg-ochre-50/40" : "border-fog-200"
            }`}
          >
            <button
              onClick={() =>
                setExpanded((s) => ({ ...s, [d.id]: !isOpen }))
              }
              className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-fog-100/60 transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={14} className="text-ink-400" />
              ) : (
                <ChevronRight size={14} className="text-ink-400" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-ink-600">
                    {d.questionNo}
                  </span>
                  {d.answerVersion && (
                    <span className="chip bg-ink-100 text-ink-600">
                      {d.answerVersion}
                    </span>
                  )}
                  {flags.map((f, i) => (
                    <span
                      key={i}
                      className="chip bg-ochre-50 text-ochre-500 border border-ochre-200"
                    >
                      {f}
                    </span>
                  ))}
                  {!d.supplementaryNote && (
                    <span className="chip bg-fog-200 text-ink-500">
                      待补备注
                    </span>
                  )}
                  {isExcluded && (
                    <span className="chip bg-ochre-100 text-ochre-700 border border-ochre-300">
                      已排除 · 不纳入汇总
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500 truncate mt-0.5">
                  {d.answerContent}
                </p>
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2 text-xs border-t border-fog-200 bg-fog-100/40">
                <div className="pt-2">
                  <p className="label mb-1">答案内容</p>
                  <p className="font-mono text-ink-700 break-words">
                    {d.answerContent}
                  </p>
                </div>
                <div>
                  <p className="label mb-1 flex items-center justify-between">
                    <span>后补备注</span>
                    {!isEditingNote ? (
                      <button
                        onClick={() => startEditNote(d.id, d.supplementaryNote)}
                        className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-700"
                      >
                        <PencilLine size={11} />
                        编辑
                      </button>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => saveNote(d.id)}
                          className="inline-flex items-center gap-1 text-moss-500 hover:text-moss-700"
                        >
                          <Check size={11} />
                          保存
                        </button>
                        <button
                          onClick={() => setEditingNote(null)}
                          className="inline-flex items-center gap-1 text-ochre-500 hover:text-ochre-700"
                        >
                          <X size={11} />
                          取消
                        </button>
                      </span>
                    )}
                  </p>
                  {isEditingNote ? (
                    <textarea
                      autoFocus
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="w-full p-2 rounded border border-fog-300 bg-white text-xs"
                      rows={2}
                    />
                  ) : (
                    <p className="text-ink-600">
                      {d.supplementaryNote || (
                        <span className="text-ink-400">（待补）</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-400 font-mono">
                    {formatTime(d.submittedAt)}
                  </span>
                  <button
                    onClick={() => removeStagedDraft(d.id)}
                    className="inline-flex items-center gap-1 text-ochre-500 hover:text-ochre-700"
                  >
                    <Trash2 size={12} />
                    从暂存区移除
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
