import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Undo2,
  Clock4,
  GitBranchPlus,
  CheckSquare,
  Square,
  Info,
} from "lucide-react";
import { ImportPanel } from "@/components/ImportPanel";
import { RecordCard } from "@/components/RecordCard";
import { FilterBar } from "@/components/FilterBar";
import { useMaterialStore } from "@/store/materialStore";
import type {
  FilterOptions,
  ImportResult,
  MaterialRecord,
  RecordStatus,
} from "@/types";

interface Props {
  operator: string;
}

const COLUMNS: { status: RecordStatus | "late"; title: string; cls: string; icon: any }[] = [
  {
    status: "pending",
    title: "待确认",
    cls: "border-l-ink-300 bg-ink-50/40",
    icon: Clock4,
  },
  {
    status: "confirmed",
    title: "已确认（正常结果）",
    cls: "border-l-moss-400 bg-moss-50/40",
    icon: CheckCircle2,
  },
  {
    status: "revoked",
    title: "已撤回",
    cls: "border-l-ember-300 bg-ember-50/40",
    icon: Undo2,
  },
];

export const Home = ({ operator }: Props) => {
  const [filter, setFilter] = useState<FilterOptions>({
    isLateChange: false,
  });
  const [lateFilter, setLateFilter] = useState<FilterOptions>({
    isLateChange: true,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultLevel, setResultLevel] = useState<"info" | "success" | "warn">(
    "info"
  );

  const filterRecords = useMaterialStore((s) => s.filterRecords);
  const batchConfirm = useMaterialStore((s) => s.batchConfirm);
  const batchRevoke = useMaterialStore((s) => s.batchRevoke);
  const batchMarkLate = useMaterialStore((s) => s.batchMarkLate);
  const listBatchNos = useMaterialStore((s) => s.listBatchNos);
  const listOperators = useMaterialStore((s) => s.listOperators);
  const records = useMaterialStore((s) => s.records);

  const batches = listBatchNos();
  const operators = listOperators();

  const normalRecords = useMemo(
    () => filterRecords(filter),
    [filter, filterRecords, records]
  );
  const lateRecords = useMemo(
    () => filterRecords(lateFilter),
    [lateFilter, filterRecords, records]
  );

  const grouped = useMemo(() => {
    const g: Record<RecordStatus, MaterialRecord[]> = {
      pending: [],
      confirmed: [],
      revoked: [],
    };
    normalRecords.forEach((r) => {
      if (!r.isLateChange) g[r.status].push(r);
    });
    g.pending.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    g.confirmed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    g.revoked.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return g;
  }, [normalRecords]);

  const totalCount = records.length;
  const normalCount = normalRecords.length;
  const lateCount = lateRecords.length;
  const supplementedCount = records.filter((r) => r.parentId).length;

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedIds = Array.from(selected);

  const handleImportResult = (result: ImportResult) => {
    const parts: string[] = [];
    if (result.imported.length > 0) {
      parts.push(`成功导入 ${result.imported.length} 条`);
    }
    if (result.skipped.length > 0) {
      parts.push(`跳过 ${result.skipped.length} 条（不翻倍）`);
    }
    if (result.supplemented.length > 0) {
      parts.push(`建立 ${result.supplemented.length} 条后补版本链（不覆盖）`);
    }
    setResultMsg(
      `批次 ${result.batchNo}：${parts.join("，")}。`
    );
    setResultLevel(result.skipped.length > 0 ? "warn" : "success");
    setTimeout(() => setResultMsg(null), 8000);
  };

  const op = operator || "未命名操作员";

  const runBatch = (kind: "confirm" | "revoke" | "late") => {
    if (selectedIds.length === 0) return;
    let n = 0;
    if (kind === "confirm") n = batchConfirm(selectedIds, op);
    if (kind === "revoke") n = batchRevoke(selectedIds, op);
    if (kind === "late") n = batchMarkLate(selectedIds, op);
    const label = {
      confirm: "确认",
      revoke: "撤回",
      late: "标记晚到变更",
    }[kind];
    setResultMsg(`批量${label}完成，影响 ${n} 条记录。`);
    setResultLevel("success");
    setSelected(new Set());
    setTimeout(() => setResultMsg(null), 5000);
  };

  const LevelCls = {
    info: "border-ink-200 bg-ink-50 text-ink-700",
    success: "border-moss-300 bg-moss-50 text-moss-700",
    warn: "border-ember-300 bg-ember-50 text-ember-700",
  };

  return (
    <div className="container max-w-[1400px] px-6 py-6 space-y-5">
      <section className="grid grid-cols-4 gap-3 animate-fadeIn">
        <div className="card p-3.5">
          <p className="text-xs text-ink-500 mb-1.5">全部记录</p>
          <p className="text-2xl font-serif font-semibold text-ink">
            {totalCount}
            <span className="ml-2 text-xs text-ink-400 font-sans font-normal">
              条
            </span>
          </p>
        </div>
        <div className="card p-3.5">
          <p className="text-xs text-ink-500 mb-1.5">正常结果</p>
          <p className="text-2xl font-serif font-semibold text-moss-600">
            {normalCount}
          </p>
        </div>
        <div className="card p-3.5 border-ember-200">
          <p className="text-xs text-ember-600 mb-1.5 flex items-center gap-1">
            <AlertTriangle size={11} /> 晚到变更（单独拎出）
          </p>
          <p className="text-2xl font-serif font-semibold text-ember-500">
            {lateCount}
          </p>
        </div>
        <div className="card p-3.5">
          <p className="text-xs text-ink-500 mb-1.5 flex items-center gap-1">
            <GitBranchPlus size={11} /> 后补新版本
          </p>
          <p className="text-2xl font-serif font-semibold text-ink">
            {supplementedCount}
            <span className="ml-2 text-xs text-ink-400 font-sans font-normal">
              v1 均保留
            </span>
          </p>
        </div>
      </section>

      {resultMsg && (
        <div
          className={`rounded-md border px-4 py-2.5 text-sm flex items-start gap-2 animate-slideIn ${LevelCls[resultLevel]}`}
        >
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">{resultMsg}</div>
        </div>
      )}

      <ImportPanel operator={operator} onResult={handleImportResult} />

      <FilterBar
        filter={filter}
        onChange={setFilter}
        batchNos={batches}
        operators={operators}
      />

      {selectedIds.length > 0 && (
        <div className="card px-4 py-3 flex items-center justify-between animate-slideIn border-ink-200 bg-ink-50/60">
          <div className="flex items-center gap-2 text-sm text-ink-700">
            <CheckSquare size={15} /> 已选中 {selectedIds.length} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="btn-ghost !text-xs !py-1"
            >
              取消全选
            </button>
            <button
              onClick={() => runBatch("late")}
              className="btn-danger !text-xs !py-1"
            >
              <AlertTriangle size={12} /> 批量标记晚到变更
            </button>
            <button
              onClick={() => runBatch("revoke")}
              className="btn-secondary !text-xs !py-1"
            >
              <Undo2 size={12} /> 批量撤回
            </button>
            <button
              onClick={() => runBatch("confirm")}
              className="btn-success !text-xs !py-1"
            >
              <CheckCircle2 size={12} /> 批量确认
            </button>
          </div>
        </div>
      )}

      {lateRecords.length > 0 && (
        <section className="card p-0 overflow-hidden animate-slideIn border-ember-300">
          <header className="bg-ember-500/90 text-white px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <h3 className="font-serif font-semibold text-sm tracking-wide">
                晚到变更专区（已单独拎出，不进入正常结果）
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() =>
                  selectAll(lateRecords.map((r) => r.id))
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-white/40 hover:bg-white/10 transition-colors"
              >
                <Square size={12} /> 全选
              </button>
              <span className="chip bg-white/15 !text-white !border-white/30 !py-0">
                {lateRecords.length} 条待算法值班人独立评估
              </span>
            </div>
          </header>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-ember-50/40">
            {lateRecords
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((r) => (
                <RecordCard
                  key={r.id}
                  record={r}
                  operator={operator}
                  selected={selected.has(r.id)}
                  onSelect={toggleSelect}
                />
              ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const list = grouped[col.status as RecordStatus] || [];
          const allIds = list.map((r) => r.id);
          const allChecked =
            allIds.length > 0 && allIds.every((id) => selected.has(id));
          const Icon = col.icon;
          return (
            <div
              key={col.status}
              className={`card p-0 overflow-hidden flex flex-col ${col.cls} border-t-4 border-l-0 border-r-0 border-b-0`}
            >
              <header className="px-4 py-2.5 flex items-center justify-between border-b border-paper-line bg-white/60">
                <div className="flex items-center gap-2">
                  <Icon
                    size={14}
                    className={
                      col.status === "confirmed"
                        ? "text-moss-600"
                        : col.status === "revoked"
                        ? "text-ember-500"
                        : "text-ink-500"
                    }
                  />
                  <h3 className="font-serif font-semibold text-sm text-ink">
                    {col.title}
                  </h3>
                  <span className="chip-neutral !py-0 !text-[10px] font-mono">
                    {list.length}
                  </span>
                </div>
                {list.length > 0 && (
                  <label className="inline-flex items-center gap-1 text-[11px] text-ink-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => selectAll(allIds)}
                      className="w-3 h-3 accent-ink rounded"
                    />
                    全选
                  </label>
                )}
              </header>
              <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-420px)] min-h-[200px]">
                {list.length === 0 ? (
                  <p className="text-xs text-ink-400 text-center py-10">
                    暂无{col.title}记录
                  </p>
                ) : (
                  list.map((r) => (
                    <RecordCard
                      key={r.id}
                      record={r}
                      operator={operator}
                      selected={selected.has(r.id)}
                      onSelect={toggleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
