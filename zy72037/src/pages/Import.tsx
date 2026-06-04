import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDataStore } from "@/stores/dataStore";
import {
  ArrowLeft,
  Upload,
  FileJson,
  ClipboardPaste,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

type ImportSection = "levels" | "records" | "notes";

export default function Import() {
  const navigate = useNavigate();
  const { importData, conflicts, pendingImport, resolveConflict, applyImport, clearPendingImport } =
    useDataStore();

  const [levelJson, setLevelJson] = useState("");
  const [recordJson, setRecordJson] = useState("");
  const [noteJson, setNoteJson] = useState("");
  const [activeSection, setActiveSection] = useState<ImportSection | null>(null);
  const [checkResult, setCheckResult] = useState<{ success: boolean; message: string } | null>(null);

  const levelFileRef = useRef<HTMLInputElement>(null);
  const recordFileRef = useRef<HTMLInputElement>(null);
  const noteFileRef = useRef<HTMLInputElement>(null);

  function handleFileRead(file: File, setter: (v: string) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") setter(text);
    };
    reader.readAsText(file);
  }

  function handleCheck() {
    const combined = buildCombinedJson();
    if (!combined.trim()) {
      setCheckResult({ success: false, message: "请先输入或上传数据" });
      return;
    }
    const result = importData(combined);
    setCheckResult(result);
  }

  function buildCombinedJson(): string {
    const data: Record<string, unknown> = {};
    if (levelJson.trim()) {
      try {
        const parsed = JSON.parse(levelJson);
        if (Array.isArray(parsed.levelGroups) || Array.isArray(parsed.levels)) {
          data.levelGroups = parsed.levelGroups || [];
          data.levels = parsed.levels || [];
        } else if (Array.isArray(parsed)) {
          data.levels = parsed;
        } else {
          data.levelGroups = parsed.levelGroups || [];
          data.levels = parsed.levels || [];
        }
      } catch { /* empty */ }
    }
    if (recordJson.trim()) {
      try {
        const parsed = JSON.parse(recordJson);
        data.sessions = parsed.sessions ?? parsed;
        data.steps = parsed.steps ?? {};
      } catch { /* empty */ }
    }
    if (noteJson.trim()) {
      try {
        const parsed = JSON.parse(noteJson);
        data.notes = parsed.notes ?? parsed;
      } catch { /* empty */ }
    }
    return Object.keys(data).length > 0 ? JSON.stringify(data) : "";
  }

  function handleApply() {
    applyImport();
    setCheckResult(null);
    setLevelJson("");
    setRecordJson("");
    setNoteJson("");
    navigate("/");
  }

  function handleCancel() {
    clearPendingImport();
    setCheckResult(null);
  }

  const sections: { key: ImportSection; label: string; json: string; setter: (v: string) => void; fileRef: React.RefObject<HTMLInputElement | null> }[] = [
    { key: "levels", label: "关卡参数", json: levelJson, setter: setLevelJson, fileRef: levelFileRef },
    { key: "records", label: "玩家选择记录", json: recordJson, setter: setRecordJson, fileRef: recordFileRef },
    { key: "notes", label: "评分备注", json: noteJson, setter: setNoteJson, fileRef: noteFileRef },
  ];

  return (
    <div className="min-h-screen bg-jazz-bg">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-jazz-card flex items-center justify-center hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-white">数据导入</h1>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {sections.map((section) => (
          <div key={section.key} className="bg-jazz-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === section.key ? null : section.key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-jazz-card/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileJson className="w-5 h-5 text-jazz-gold" />
                <span className="text-white font-medium">{section.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {section.json.trim() && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-jazz-gold/20 text-jazz-gold">
                    已输入
                  </span>
                )}
              </div>
            </button>

            {activeSection === section.key && (
              <div className="px-5 pb-5 space-y-3 animate-fade-in">
                <textarea
                  value={section.json}
                  onChange={(e) => section.setter(e.target.value)}
                  placeholder={`粘贴 ${section.label} JSON 数据...`}
                  className="w-full h-40 bg-jazz-bg rounded-xl p-4 text-sm text-gray-300 font-mono resize-none border border-white/10 focus:border-jazz-gold/50 focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => section.fileRef.current?.click()}
                    className="px-4 py-2 bg-jazz-bg rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-2 border border-white/10"
                  >
                    <Upload className="w-4 h-4" />
                    选择文件
                  </button>
                  <input
                    ref={section.fileRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileRead(file, section.setter);
                    }}
                  />
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        section.setter(text);
                      } catch { /* empty */ }
                    }}
                    className="px-4 py-2 bg-jazz-bg rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-2 border border-white/10"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    从剪贴板粘贴
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCheck}
            className="flex-1 px-5 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            检查导入
          </button>
        </div>

        {checkResult && (
          <div
            className={`rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-in ${
              checkResult.success
                ? "bg-jazz-correct/10 border border-jazz-correct/30"
                : "bg-jazz-error/10 border border-jazz-error/30"
            }`}
          >
            {checkResult.success ? (
              <Check className="w-5 h-5 text-jazz-correct flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-jazz-error flex-shrink-0" />
            )}
            <span className={checkResult.success ? "text-jazz-correct" : "text-jazz-error"}>
              {checkResult.message}
            </span>
          </div>
        )}

        {conflicts.length > 0 && pendingImport && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-jazz-gold" />
              <h2 className="text-lg font-bold text-white">冲突处理</h2>
            </div>
            <div className="bg-jazz-card rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 gap-0 border-b border-white/10">
                <div className="px-4 py-3 text-sm font-semibold text-gray-400">字段</div>
                <div className="px-4 py-3 text-sm font-semibold text-gray-400 text-center">原始记录</div>
                <div className="px-4 py-3 text-sm font-semibold text-gray-400 text-center">导入数据</div>
              </div>
              {conflicts.map((conflict, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-0 border-b border-white/5 last:border-b-0"
                >
                  <div className="px-4 py-3 text-sm text-white">{conflict.field}</div>
                  <div className="px-4 py-3 flex flex-col items-center gap-1">
                    <span className="text-sm text-gray-300">{conflict.originalValue}</span>
                    <button
                      onClick={() => resolveConflict(index, "keep_original")}
                      className={`text-xs px-3 py-1 rounded-full transition-all ${
                        conflict.resolution === "keep_original"
                          ? "bg-jazz-correct/20 text-jazz-correct"
                          : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      保留原值
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col items-center gap-1">
                    <span className="text-sm text-gray-300">{conflict.importValue}</span>
                    <button
                      onClick={() => resolveConflict(index, "use_import")}
                      className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        conflict.resolution === "use_import"
                          ? "bg-jazz-gold/20 text-jazz-gold"
                          : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      采用导入值 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApply}
                className="flex-1 px-5 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                确认导入
              </button>
              <button
                onClick={handleCancel}
                className="px-5 py-3 bg-jazz-card text-gray-300 rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                取消
              </button>
            </div>
          </div>
        )}

        {checkResult?.success && conflicts.length === 0 && pendingImport && (
          <div className="flex gap-3 animate-fade-in">
            <button
              onClick={handleApply}
              className="flex-1 px-5 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              确认导入
            </button>
            <button
              onClick={handleCancel}
              className="px-5 py-3 bg-jazz-card text-gray-300 rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
