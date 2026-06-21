import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function DraftImport() {
  const {
    parseAndStageDrafts,
    addStagedDrafts,
    paramVersions,
    loading,
    error,
    setError,
  } = useAppStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error, setError]);

  const handlePasteImport = () => {
    if (!text.trim()) return;
    const drafts = parseAndStageDrafts(text);
    addStagedDrafts(drafts);
    setText("");
  };

  const handleLoadExample = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 200));
    const sample = `3-1 | 重力加速度 g = 9.80 ± 0.02 m/s²，有效数字 3 位 v1 备注：学生 A，第 2 次修改
3-1 | 重力加速度 g = 9.79 ± 0.03 m/s²，按 v2 标准取位 v2 备注：学生 B，参考新版答案册
3-2 | 长度 L = 25.40 ± 0.05 mm，千分尺读数 v1 备注：学生 C，草稿纸扫描版
3-2 | 长度 L = 25.40 ± 0.05 mm，千分尺读数 v1 备注：学生 C，草稿纸扫描版
3-3 | 密度 ρ = 7.85 ± 0.04 g/cm³，由质量和体积合成 v1
3-4 | 周期 T = 2.015 ± 0.008 s，秒表平均 10 次 v1 备注：学生 D，缺原始记录
3-4 | 周期 T = 2.016 ± 0.007 s，秒表平均 10 次测量 v1 备注：学生 E，疑似参考同组
3-5 | 相对误差 δ = 1.2%，合成不确定度取方和根 v2 备注：学生 F，按 v2 标准`;
    const drafts = parseAndStageDrafts(sample);
    addStagedDrafts(drafts);
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-2 rounded bg-ochre-50 border border-ochre-200 text-ochre-700 text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴学生草稿，每行一条；支持格式：题号 | 答案内容 v1 | 备注……"
        className="w-full h-28 p-3 rounded-lg border border-fog-200 bg-fog-50 text-sm text-ink-700 placeholder:text-fog-400 focus:outline-none focus:border-ink-200 focus:ring-2 focus:ring-ink-100 resize-none font-mono"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handlePasteImport}
          disabled={!text.trim() || loading}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          <Upload size={15} />
          解析到暂存区
        </button>
        <button
          onClick={handleLoadExample}
          disabled={busy || loading}
          className="btn-secondary"
          title={`载入 8 条示例草稿（含答案版本冲突、重复提交、重复样本、不齐整）`}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          载入示例
        </button>
      </div>
      <p className="text-[11px] text-ink-400 leading-relaxed">
        提示：暂存区的草稿只在本页保存，点击"启动验算"才通过 API 写入后端；参数版本 {paramVersions.length} 套。
      </p>
    </div>
  );
}
