import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  FilePlus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Hash,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import type { ImportItem, ImportPreviewItem, ImportResult } from "@/types";
import { useMaterialStore } from "@/store/materialStore";

interface Props {
  operator: string;
  onResult: (result: ImportResult) => void;
}

const DEMO_ITEMS: ImportItem[] = [
  {
    materialNo: "MS-2026-0046",
    title: "D栋遮阳百叶 - 叶片间距调整",
    content: "材料送审：百叶间距从 100 加密到 80mm，综合遮阳系数提升 0.08。",
  },
  {
    materialNo: "MS-2026-0042",
    title: "A栋西翼幕墙玻璃 - 厚度变更 6mm→8mm",
    content: "重复导入测试：这条记录应被识别为重复并跳过。",
  },
  {
    materialNo: "MS-2026-0047",
    title: "E栋屋顶女儿墙加高 200mm（晚到变更）",
    content: "上周遗漏的变更单：女儿墙加高用于遮挡评估，原结果已出。",
    isLateChange: true,
  },
];

export const ImportPanel = ({ operator, onResult }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textDraft, setTextDraft] = useState("");
  const [rawItems, setRawItems] = useState<ImportItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const previewImport = useMaterialStore((s) => s.previewImport);
  const importRecords = useMaterialStore((s) => s.importRecords);

  const preview: ImportPreviewItem[] = useMemo(
    () => previewImport(rawItems),
    [rawItems, previewImport]
  );

  const stats = useMemo(() => {
    const dup = preview.filter((p) => p._isDuplicate).length;
    const sup = preview.filter((p) => p._isSupplement).length;
    return {
      total: preview.length,
      dup,
      sup,
      toImport: preview.length - dup,
    };
  }, [preview]);

  const parseText = (text: string): ImportItem[] => {
    const lines = text.trim();
    if (!lines) return [];
    try {
      const json = JSON.parse(lines);
      if (Array.isArray(json)) {
        return json.filter(
          (x) => x && (x.materialNo || x.title)
        ) as ImportItem[];
      }
    } catch {
      /* not JSON, try CSV-ish */
    }
    return lines
      .split(/\n\n+/)
      .map((block, i) => {
        const m = block.match(/编号[:：]\s*(\S+)/);
        const t = block.match(/标题[:：]\s*(.+)/);
        const c = block.match(/内容[:：]\s*(.+)/s);
        const materialNo = m?.[1] || `AUTO-${i + 1}`;
        const title = t?.[1] || block.split("\n")[0]?.slice(0, 30) || `未命名条目`;
        const content = c?.[1] || block;
        return { materialNo, title, content };
      })
      .filter((x) => x.materialNo && x.title);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const items = parseText(String(reader.result || ""));
      if (items.length) {
        setRawItems((prev) => [...prev, ...items]);
        setIsOpen(true);
      }
    };
    reader.readAsText(file);
  };

  const addDemo = () => {
    setRawItems(DEMO_ITEMS);
    setIsOpen(true);
  };

  const addManualRow = () => {
    setRawItems((prev) => [
      ...prev,
      { materialNo: "", title: "", content: "" },
    ]);
    setIsOpen(true);
  };

  const updateRow = (i: number, patch: Partial<ImportItem>) => {
    setRawItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    );
  };

  const removeRow = (i: number) => {
    setRawItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleParseText = () => {
    const items = parseText(textDraft);
    if (items.length) {
      setRawItems((prev) => [...prev, ...items]);
      setTextDraft("");
    }
  };

  const handleImport = () => {
    const toImport = preview
      .filter((p) => !p._isDuplicate)
      .map(({ _key, _isDuplicate, _duplicateReason, _isSupplement, _previousVersion, _previousId, ...rest }: ImportPreviewItem) => rest as ImportItem);
    if (toImport.length === 0) return;
    const op = operator.trim() || "未命名操作员";
    const result = importRecords(toImport, op);
    onResult(result);
    setRawItems([]);
    setIsOpen(false);
  };

  return (
    <section className="card p-5 animate-fadeIn">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif font-semibold text-ink text-lg">
          导入材料送审表
        </h2>
          <p className="text-xs text-ink-500 mt-0.5">
          后端入口收紧：格式校验 + 重复检测 + 后补版本链自动建立
        </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addDemo} className="btn-ghost">
            <Sparkles size={15} />
            加载演示数据
          </button>
          <button onClick={addManualRow} className="btn-secondary">
            <FilePlus size={15} />
            手动添加行
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json,.txt,.csv"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost"
          >
            <FileText size={15} />
            选择文件
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative mb-4 border-2 border-dashed rounded-md px-6 py-8 text-center transition-all ${
          dragOver
            ? "border-ink-400 bg-ink-50"
            : "border-paper-line bg-paper/50"
        }`}
      >
        <Upload
          size={28}
          className="mx-auto text-ink-400 mb-2"
        />
        <p className="text-sm text-ink-600 font-medium">
          拖拽 JSON / CSV / TXT 文件到此处
        </p>
        <p className="text-xs text-ink-400 mt-1">
          或在下方直接粘贴内容（按"编号/标题/内容"格式）
        </p>
      </div>

      <textarea
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        placeholder={`示例：\n\n编号: MS-2026-0046\n标题: D栋遮阳百叶 - 叶片间距调整\n内容: 百叶间距从 100 加密到 80mm\n\n编号: MS-2026-0047\n标题: 另一项变更`}
        rows={4}
        className="input font-mono text-xs mb-2"
      />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-ink-400">
          {textDraft.length > 0 ? `${textDraft.length} 字符` : " "}
        </span>
        <button
          onClick={handleParseText}
          disabled={!textDraft.trim()}
          className="btn-primary disabled:opacity-40"
        >
          解析并加入待导入
        </button>
      </div>

      {isOpen || rawItems.length > 0 ? (
        <div className="border-t border-paper-line pt-4 animate-slideIn">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="chip-ink">
                <Eye size={12} /> 预览 {stats.total}
              </span>
              <span className="chip-moss">
                <CheckCircle2 size={12} /> 将导入 {stats.toImport}
              </span>
              {stats.dup > 0 && (
                <span className="chip-ember">
                  <XCircle size={12} /> 重复跳过 {stats.dup}
                </span>
              )}
              {stats.sup > 0 && (
                <span className="chip-neutral">
                  <Hash size={12} /> 后补新版本 {stats.sup}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setRawItems([]);
                setIsOpen(false);
              }}
              className="btn-ghost text-xs"
            >
              <X size={14} /> 清空
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {preview.map((p, i) => (
              <div
                key={i}
                className={`p-3 rounded border transition-colors ${
                  p._isDuplicate
                    ? "border-ember-200 bg-ember-50/60"
                    : p._isSupplement
                    ? "border-ink-100 bg-ink-50/60"
                    : "border-paper-line bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={p.materialNo}
                        onChange={(e) =>
                          updateRow(i, { materialNo: e.target.value })
                        }
                        className="input !py-1 !w-40 text-xs font-mono"
                        placeholder="材料编号"
                      />
                      <input
                        value={p.title}
                        onChange={(e) => updateRow(i, { title: e.target.value })}
                        className="input !py-1 text-xs flex-1 min-w-[200px]"
                        placeholder="标题"
                      />
                      <div className="flex items-center gap-1.5">
                        {p._isDuplicate ? (
                          <span className="chip-ember" title={p._duplicateReason}>
                            <AlertTriangle size={11} /> 重复，将跳过
                          </span>
                        ) : p._isSupplement ? (
                          <span className="chip-ink">
                            后补 v{p._previousVersion! + 1}
                          </span>
                        ) : (
                          <span className="chip-moss">新记录</span>
                        )}
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={!!p.isLateChange}
                            onChange={(e) =>
                              updateRow(i, { isLateChange: e.target.checked })
                            }
                            className="accent-ember-500"
                          />
                          <span className="text-ember-500 text-xs">晚到</span>
                        </label>
                      </div>
                    </div>
                    <textarea
                      value={p.content}
                      onChange={(e) =>
                        updateRow(i, { content: e.target.value })
                      }
                      className="input !py-1 text-xs min-h-[48px]"
                      placeholder="材料内容摘要..."
                    />
                    {p._duplicateReason && (
                      <p className="text-[11px] text-ember-600 -mt-1">
                        {p._duplicateReason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeRow(i)}
                    className="btn-ghost !p-1.5"
                  >
                    <Trash2 size={14} className="text-ink-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-paper-line">
            <button
              onClick={() => setIsOpen(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={stats.toImport === 0}
              className="btn-primary disabled:opacity-40"
            >
              <CheckCircle2 size={15} />
              确认导入（{stats.toImport}
              条）
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
