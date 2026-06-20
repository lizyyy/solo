import { useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { parseDraftText, parsedLineToDraft } from "@/utils/parseDraft";
import { seedDrafts, seedParamVersions } from "@/mock/seedData";

export default function DraftImport() {
  const { addDrafts, paramVersions, addParamVersion, setActiveParamVersion } =
    useAppStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasteImport = () => {
    if (!text.trim()) return;
    const parsed = parseDraftText(text);
    const drafts = parsed.map((p, i) =>
      parsedLineToDraft(p, Date.now() + i)
    );
    addDrafts(drafts);
    setText("");
  };

  const handleLoadExample = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    if (paramVersions.length === 0) {
      for (const pv of seedParamVersions) {
        addParamVersion({
          name: pv.name,
          tolerance: pv.tolerance,
          roundingRule: pv.roundingRule,
          sigFigs: pv.sigFigs,
          isActive: pv.isActive,
        });
      }
    } else {
      const active = seedParamVersions.find((p) => p.isActive);
      if (active) {
        const existing = paramVersions.find((p) => p.name === active.name);
        if (existing) setActiveParamVersion(existing.id);
      }
    }
    addDrafts(seedDrafts);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴学生草稿，每行一条；支持格式：题号 | 答案内容 v1 | 备注……"
        className="w-full h-28 p-3 rounded-lg border border-fog-200 bg-fog-50 text-sm text-ink-700 placeholder:text-fog-400 focus:outline-none focus:border-ink-200 focus:ring-2 focus:ring-ink-100 resize-none font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handlePasteImport}
          disabled={!text.trim()}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          <Upload size={15} />
          解析并导入
        </button>
        <button
          onClick={handleLoadExample}
          disabled={loading}
          className="btn-secondary"
          title="载入 8 条示例草稿（含不齐整、重复、冲突）"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          载入示例
        </button>
      </div>
      <p className="text-[11px] text-ink-400 leading-relaxed">
        提示：可粘贴多行，每行一条；题号缺失会自动生成；后补备注缺失会被标记为"待补"，不阻塞验算。
      </p>
    </div>
  );
}
