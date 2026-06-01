import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDataStore } from "@/stores/dataStore";
import { ArrowLeft, Save, FileText, AlertCircle } from "lucide-react";

export default function Supplement() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { currentViewSession, currentViewSupplements, currentViewNotes, viewSession, addSupplement } =
    useDataStore();
  const [noteText, setNoteText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (sessionId) viewSession(sessionId);
  }, [sessionId, viewSession]);

  function handleSave() {
    if (!sessionId || !noteText.trim()) return;
    addSupplement(sessionId, noteText.trim());
    setNoteText("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!currentViewSession) {
    return (
      <div className="min-h-screen bg-jazz-bg flex items-center justify-center">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  const teacherContents = currentViewNotes.map((n) => n.content);

  return (
    <div className="min-h-screen bg-jazz-bg">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <button
          onClick={() => navigate(`/settlement/${sessionId}`)}
          className="w-10 h-10 rounded-xl bg-jazz-card flex items-center justify-center hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-white">补录备注</h1>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-jazz-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-jazz-gold" />
            <h2 className="text-white font-semibold">新增备注</h2>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="输入备注内容..."
            className="w-full h-32 bg-jazz-bg rounded-xl p-4 text-sm text-gray-300 resize-none border border-white/10 focus:border-jazz-gold/50 focus:outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-3">
            {saved && (
              <span className="text-sm text-jazz-correct animate-fade-in">已保存</span>
            )}
            {!saved && <span />}
            <button
              onClick={handleSave}
              disabled={!noteText.trim()}
              className="px-5 py-2.5 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Save className="w-4 h-4" />
              保存备注
            </button>
          </div>
        </div>

        {currentViewSupplements.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold text-white">备注差异</h2>
            <div className="space-y-3">
              {currentViewSupplements.map((sup) => {
                const hasConflict = teacherContents.some((tc) => tc === sup.content);
                return (
                  <div key={sup.id} className="bg-jazz-card rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{new Date(sup.createdAt).toLocaleString("zh-CN")}</span>
                      {sup.diffType === "added" && (
                        <span className="px-2 py-0.5 rounded-full bg-jazz-correct/20 text-jazz-correct">
                          新增
                        </span>
                      )}
                      {sup.diffType === "changed" && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                          修改
                        </span>
                      )}
                      {sup.diffType === "conflict" && (
                        <span className="px-2 py-0.5 rounded-full bg-jazz-error/20 text-jazz-error">
                          冲突
                        </span>
                      )}
                      {hasConflict && sup.diffType !== "conflict" && (
                        <span className="px-2 py-0.5 rounded-full bg-jazz-error/20 text-jazz-error flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          与教师备注冲突
                        </span>
                      )}
                    </div>

                    {sup.diffType === "changed" && sup.previousContent && (
                      <div className="text-sm text-gray-500 line-through bg-red-500/5 px-3 py-1.5 rounded-lg">
                        {sup.previousContent}
                      </div>
                    )}

                    <div
                      className={`text-sm text-gray-200 px-3 py-1.5 rounded-lg ${
                        sup.diffType === "added"
                          ? "bg-jazz-correct/10"
                          : sup.diffType === "changed"
                          ? "bg-yellow-500/10"
                          : sup.diffType === "conflict" || hasConflict
                          ? "bg-jazz-error/10"
                          : ""
                      }`}
                    >
                      {sup.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
