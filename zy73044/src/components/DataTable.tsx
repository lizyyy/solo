import { useState, useRef, useEffect } from "react";
import { CheckCircle2, Undo2, Eye, Lock, Unlock, Search, ChevronDown, Filter } from "lucide-react";
import StatusBadge from "./StatusBadge";
import type { SpareRecord, RecordStatus, AnomalyType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  records: SpareRecord[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  onConfirm: (ids: string[]) => void;
  onWithdraw: (ids: string[]) => void;
  onRemark: (id: string, remark: string) => void;
  onViewRaw: (r: SpareRecord) => void;
  highlightId: string | null;
  onHighlightClear: () => void;
}

type FilterStatus = "all" | RecordStatus;
type FilterAnomaly = "all" | AnomalyType;

export default function DataTable({
  records,
  selected,
  onSelectedChange,
  onConfirm,
  onWithdraw,
  onRemark,
  onViewRaw,
  highlightId,
  onHighlightClear,
}: Props) {
  const [fStatus, setFStatus] = useState<FilterStatus>("all");
  const [fAnomaly, setFAnomaly] = useState<FilterAnomaly>("all");
  const [query, setQuery] = useState("");
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [remarkDraft, setRemarkDraft] = useState("");
  const remarkRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = records.filter((r) => {
    if (fStatus !== "all" && r.status !== fStatus) return false;
    if (fAnomaly !== "all" && !r.anomalies.includes(fAnomaly)) return false;
    if (!q) return true;
    return (
      r.partNo.toLowerCase().includes(q) ||
      r.partDesc.toLowerCase().includes(q) ||
      r.sourceFile.toLowerCase().includes(q) ||
      (r.remark ?? "").toLowerCase().includes(q)
    );
  });

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someChecked = filtered.some((r) => selected.has(r.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    onSelectedChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const startEdit = (r: SpareRecord) => {
    setEditingRemarkId(r.id);
    setRemarkDraft(r.remark);
  };

  useEffect(() => {
    if (editingRemarkId && remarkRef.current) {
      remarkRef.current.focus();
      remarkRef.current.select();
    }
  }, [editingRemarkId]);

  const commitRemark = () => {
    if (editingRemarkId) {
      onRemark(editingRemarkId, remarkDraft);
      setEditingRemarkId(null);
    }
  };

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(onHighlightClear, 2500);
      return () => clearTimeout(t);
    }
  }, [highlightId, onHighlightClear]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-[2px] bg-slate-900 flex items-center justify-center">
          <Filter className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-sans font-black text-slate-800 tracking-tight text-lg">
          明细区 <span className="text-slate-500">— 交接全部记录</span>
        </h2>
        <span className="ml-2 text-[10px] font-sans text-slate-400 tracking-widest uppercase">
          Ledger · {filtered.length}/{records.length}
        </span>
        <div className="flex-1" />
      </div>

      <div className="flex items-center gap-3 flex-wrap p-3 border-2 border-b-0 border-slate-800 bg-slate-50 rounded-t-[2px]">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索编号 / 描述 / 来源 / 备注"
            className="w-full h-9 pl-9 pr-3 rounded-[2px] border-2 border-slate-800 bg-white font-sans text-sm tracking-tight placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30"
          />
        </div>
        <FilterSelect
          label="状态"
          value={fStatus}
          options={[
            ["all", "全部状态"],
            ["pending", "待确认"],
            ["confirmed", "已确认"],
            ["withdrawn", "已撤回"],
          ]}
          onChange={(v) => setFStatus(v as FilterStatus)}
        />
        <FilterSelect
          label="异常"
          value={fAnomaly}
          options={[
            ["all", "全部异常"],
            ["gap", "采样断档"],
            ["missing", "字段缺失"],
            ["conflict", "状态冲突"],
          ]}
          onChange={(v) => setFAnomaly(v as FilterAnomaly)}
        />
      </div>

      <div className="border-2 border-slate-800 rounded-b-[2px] bg-white max-h-[540px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 border-b-2 border-slate-800">
            <tr className="font-sans text-[11px] tracking-wider uppercase text-slate-700">
              <th className="w-10 px-3 py-2.5 text-left align-middle">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && someChecked;
                  }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded-[2px] accent-[#1E40AF]"
                />
              </th>
              <th className="w-32 px-3 py-2.5 text-left align-middle">备件编号</th>
              <th className="px-3 py-2.5 text-left align-middle">备件描述</th>
              <th className="w-20 px-3 py-2.5 text-left align-middle">采样</th>
              <th className="w-24 px-3 py-2.5 text-left align-middle">状态</th>
              <th className="w-28 px-3 py-2.5 text-left align-middle">异常</th>
              <th className="px-3 py-2.5 text-left align-middle min-w-[220px]">人工备注（锁定）</th>
              <th className="w-44 px-3 py-2.5 text-left align-middle">来源文件</th>
              <th className="w-60 px-3 py-2.5 text-left align-middle">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <div className="font-sans text-slate-400 text-sm tracking-tight">
                    — 无匹配的记录，请调整筛选条件 —
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const isChecked = selected.has(r.id);
                const isEditing = editingRemarkId === r.id;
                const isHL = highlightId === r.id;
                return (
                  <tr
                    key={r.id}
                    ref={isHL ? highlightRef : undefined}
                    className={cn(
                      "border-b border-slate-200 align-top transition-colors",
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                      isChecked && "bg-blue-50/70",
                      isHL && "bg-yellow-100 ring-2 ring-yellow-400 ring-inset"
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(r.id)}
                        className="w-4 h-4 rounded-[2px] accent-[#1E40AF]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <code className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded-[2px]">
                        {r.partNo}
                      </code>
                    </td>
                    <td className="px-3 py-3 font-serif text-slate-800">
                      {r.partDesc || <span className="text-red-500 italic text-xs">（缺描述）</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs tabular-nums text-slate-800">
                      {r.sampling ?? <span className="text-red-500">∅</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      {r.anomalies.length === 0 ? (
                        <span className="text-[10px] font-sans text-slate-400 tracking-wide uppercase">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {r.anomalies.map((a) => (
                            <span
                              key={a}
                              className={cn(
                                "inline-flex items-center w-fit px-1.5 py-0.5 text-[10px] font-sans rounded-[2px] border",
                                a === "gap" && "bg-orange-50 text-[#EA580C] border-orange-300",
                                a === "missing" && "bg-red-50 text-red-700 border-red-300",
                                a === "conflict" && "bg-purple-50 text-purple-700 border-purple-300"
                              )}
                            >
                              {a === "gap" ? "断档" : a === "missing" ? "缺字段" : "冲突"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            ref={remarkRef}
                            value={remarkDraft}
                            onChange={(e) => setRemarkDraft(e.target.value)}
                            onBlur={commitRemark}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitRemark();
                              if (e.key === "Escape") setEditingRemarkId(null);
                            }}
                            rows={3}
                            className="w-full text-xs font-serif border-2 border-[#1E40AF] rounded-[2px] p-2 focus:outline-none resize-y"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingRemarkId(null)}
                              className="px-2 py-1 text-[11px] font-sans border border-slate-400 rounded-[2px] hover:bg-slate-100"
                            >
                              取消
                            </button>
                            <button
                              onClick={commitRemark}
                              className="px-2 py-1 text-[11px] font-sans bg-[#1E40AF] text-white rounded-[2px] hover:bg-blue-700"
                            >
                              ⌘↵ 保存（锁定）
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(r)}
                          className="group text-left block w-full"
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {r.remark ? (
                              <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                            ) : (
                              <Unlock className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span className={cn(
                              "text-[10px] font-sans tracking-wider uppercase",
                              r.remark ? "text-emerald-700" : "text-slate-400"
                            )}>
                              {r.remark ? "已锁定 · 点此编辑" : "空 · 点此加备注"}
                            </span>
                          </div>
                          <div className={cn(
                            "font-serif text-xs leading-relaxed rounded-[2px] px-2 py-1.5 -mx-2 transition-colors group-hover:bg-slate-100",
                            !r.remark && "italic text-slate-400"
                          )}>
                            {r.remark || "（备注在重复导入后不会被覆盖）"}
                          </div>
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-[11px] text-slate-600 break-all leading-tight">
                        {r.sourceFile}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        #{r.sourceBatch.slice(0, 10)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.status !== "confirmed" && (
                          <button
                            onClick={() => onConfirm([r.id])}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[11px] font-sans border-2 border-emerald-700 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            确认
                          </button>
                        )}
                        {r.status !== "pending" && r.status !== "withdrawn" ? (
                          <button
                            onClick={() => onWithdraw([r.id])}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[11px] font-sans border-2 border-slate-500 text-slate-700 bg-white hover:bg-slate-100"
                          >
                            <Undo2 className="w-3 h-3" />
                            撤回
                          </button>
                        ) : null}
                        <button
                          onClick={() => onViewRaw(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] text-[11px] font-sans border-2 border-slate-800 text-slate-800 bg-white hover:bg-slate-100"
                        >
                          <Eye className="w-3 h-3" />
                          原始说法
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  const labelOf = (v: string) => options.find((o) => o[0] === v)?.[1] ?? v;
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-sans text-slate-500 tracking-widest uppercase">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 pl-3 pr-8 rounded-[2px] border-2 border-slate-800 bg-white font-sans text-sm tracking-tight appearance-none focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 cursor-pointer"
        >
          {options.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
      </div>
    </label>
  );
}
