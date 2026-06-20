import { useEffect, useMemo, useState, useCallback } from "react";
import Toolbar from "@/components/Toolbar";
import SampleCard from "@/components/SampleCard";
import AlertsPanel from "@/components/AlertsPanel";
import DataTable from "@/components/DataTable";
import RawRowDrawer from "@/components/RawRowDrawer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { SpareRecord, ImportBatch, SchemaMap, RecordStatus } from "@/lib/types";
import { STORAGE_KEYS, CURRENT_VERSION } from "@/lib/types";
import { parseCsv, getCsvHeaders, exportCsv, downloadCsv } from "@/lib/csv";
import { buildMapping, fileSignature } from "@/lib/mapping";
import type { StandardField } from "@/lib/mapping";
import { mergeRecords, type IncomingRecord } from "@/lib/dedup";
import { detectAnomalies } from "@/lib/detect";
import { seedRecords, SEED_SAMPLE_ID } from "@/data/seed";

const BATCH_PREFIX = (t: number) => `B${t.toString(36)}`;

export default function Home() {
  const [version] = useLocalStorage<string>(STORAGE_KEYS.version, CURRENT_VERSION);
  const [storedRecords, setStoredRecords] = useLocalStorage<SpareRecord[]>(STORAGE_KEYS.records, []);
  const [batches, setBatches] = useLocalStorage<ImportBatch[]>(STORAGE_KEYS.batches, []);
  const [schemas, setSchemas] = useLocalStorage<SchemaMap[]>(STORAGE_KEYS.schemas, []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerRecord, setDrawerRecord] = useState<SpareRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (storedRecords.length === 0) {
      const seeded = seedRecords();
      const { records: withAnom } = detectAnomalies(seeded);
      setStoredRecords(withAnom);
    }
    void version;
    void schemas;
  }, []);

  const { records, gapCount, missingCount, conflictCount } = useMemo(
    () => detectAnomalies(storedRecords),
    [storedRecords]
  );

  const confirmedCount = useMemo(() => records.filter((r) => r.status === "confirmed").length, [records]);
  const pendingCount = useMemo(() => records.filter((r) => r.status === "pending").length, [records]);

  const sampleRecord = useMemo(() => {
    const withGap = records.find((r) => r.anomalies.includes("gap"));
    if (withGap) return withGap;
    const seeded = records.find((r) => r.id === SEED_SAMPLE_ID);
    if (seeded) return seeded;
    return records[0] ?? null;
  }, [records]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  };

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const headers = getCsvHeaders(text);
      if (headers.length === 0) {
        showToast("❌ 无法读取CSV表头，请检查文件编码");
        return;
      }
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showToast("⚠ CSV没有可读数据行");
        return;
      }

      const sig = fileSignature(headers);
      const existing = schemas.find((s) => s.fileSignature === sig);

      const { mapping, warnings } = existing
        ? { mapping: existing.mapping as Record<StandardField, string | null>, warnings: [] as string[] }
        : buildMapping(headers);

      if (!existing) {
        setSchemas([
          ...schemas,
          { fileSignature: sig, mapping: mapping as unknown as Record<string, string>, usedCount: 1 },
        ]);
      } else {
        setSchemas(
          schemas.map((s) =>
            s.fileSignature === sig ? { ...s, usedCount: s.usedCount + 1 } : s
          )
        );
      }

      const batchId = BATCH_PREFIX(Date.now());
      const incoming: IncomingRecord[] = rows.map((row) => ({
        partNo: mapping.partNo ? row.values[mapping.partNo] ?? "" : "",
        partDesc: mapping.partDesc ? row.values[mapping.partDesc] ?? "" : "",
        status: mapping.status ? row.values[mapping.status] : null,
        remark: mapping.remark ? row.values[mapping.remark] : null,
        sampling: mapping.sampling ? row.values[mapping.sampling] : null,
        rawRow: row.rawRow,
        sourceFile: file.name,
        sourceBatch: batchId,
        mappedFields: Object.fromEntries(
          Object.entries(mapping).filter(([, col]) => col != null).map(([k, col]) => [k, row.values[col!] ?? ""])
        ),
      }));

      const { records: merged, createdCount, mergedCount, skippedCount, decisions } = mergeRecords(records, incoming);
      const { records: finalRecords } = detectAnomalies(merged);
      setStoredRecords(finalRecords);

      const batch: ImportBatch = {
        batchId,
        fileName: file.name,
        rowCount: rows.length,
        createdCount,
        mergedCount,
        skippedCount,
        importedAt: Date.now(),
      };
      setBatches([batch, ...batches]);

      const parts: string[] = [`✅ 导入完成：${file.name}`];
      parts.push(`新增 ${createdCount} · 合并 ${mergedCount} · 跳过 ${skippedCount}`);

      let statusProtected = 0;
      let remarkProtected = 0;
      for (const recDecisions of decisions.values()) {
        for (const d of recDecisions) {
          if (d.field === "status" && d.action === "keep_old" && d.reason.includes("人工处理结果")) {
            statusProtected++;
          }
          if (d.field === "remark" && (d.action === "keep_old" || d.action === "append_history")) {
            remarkProtected++;
          }
        }
      }
      if (statusProtected > 0) parts.push(`🔒 保住状态 ${statusProtected} 条（确认/撤回不被覆盖）`);
      if (remarkProtected > 0) parts.push(`🔒 保住备注 ${remarkProtected} 条（人工备注不被覆盖）`);

      if (warnings.length) parts.push(`⚠ ${warnings[0]}`);
      showToast(parts.join(" · "));
    } catch (e) {
      console.error(e);
      showToast("❌ 导入失败：" + (e instanceof Error ? e.message : String(e)));
    }
  }, [records, schemas, batches, setStoredRecords, setBatches, setSchemas]);

  const setStatuses = useCallback(
    (ids: string[], next: RecordStatus) => {
      if (ids.length === 0) return;
      const now = Date.now();
      const set = new Set(ids);
      setStoredRecords(
        records.map((r) => (set.has(r.id) ? { ...r, status: next, updatedAt: now } : r))
      );
      showToast(next === "confirmed" ? `已确认 ${ids.length} 条` : `已撤回 ${ids.length} 条`);
    },
    [records, setStoredRecords]
  );

  const handleBatchConfirm = useCallback(() => {
    setStatuses(Array.from(selected), "confirmed");
    setSelected(new Set());
  }, [selected, setStatuses]);

  const handleBatchWithdraw = useCallback(() => {
    setStatuses(Array.from(selected), "withdrawn");
    setSelected(new Set());
  }, [selected, setStatuses]);

  const handleConfirm = useCallback((ids: string[]) => setStatuses(ids, "confirmed"), [setStatuses]);
  const handleWithdraw = useCallback((ids: string[]) => setStatuses(ids, "withdrawn"), [setStatuses]);

  const handleRemark = useCallback((id: string, remark: string) => {
    setStoredRecords(
      records.map((r) =>
        r.id === id ? { ...r, remark: remark.trim(), updatedAt: Date.now() } : r
      )
    );
    showToast("✅ 备注已锁定保存（重复导入不会覆盖）");
  }, [records, setStoredRecords]);

  const handleExport = useCallback(() => {
    if (records.length === 0) {
      showToast("⚠ 暂无可导出的记录");
      return;
    }
    const csv = exportCsv(records);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `泵站巡检异常归因-${stamp}.csv`);
    showToast(`✅ 已导出 ${records.length} 条记录`);
  }, [records]);

  const handleViewRaw = useCallback((r: SpareRecord) => {
    setDrawerRecord(r);
    setDrawerOpen(true);
  }, []);

  const handleLocate = useCallback((r: SpareRecord) => {
    setHighlightId(r.id);
    const next = new Set(selected);
    next.add(r.id);
    setSelected(next);
  }, [selected]);

  const anomalyCount = gapCount + missingCount + conflictCount;

  return (
    <div className="min-h-screen bg-slate-100 relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,64,175,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-[1280px] mx-auto px-6 pb-20">
        <header className="pt-8 pb-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[2px] bg-[#1E40AF] flex items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h3l3-8 4 16 3-8h5" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-sans font-black text-2xl tracking-tight text-slate-900">
                    泵站巡检异常归因
                  </h1>
                  <p className="font-serif text-sm text-slate-600 mt-0.5">
                    顺着备件清单说清 <b className="text-[#1E40AF]">上一班改了什么</b> · 导入 → 看异常 → 确认 → 导出
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge color="blue" label="来源文件" value={new Set(records.map((r) => r.sourceFile)).size} />
              <Badge color="orange" label="异常总数" value={anomalyCount} />
              <Badge color="slate" label="导入批次" value={batches.length || (records.length > 0 ? 1 : 0)} />
            </div>
          </div>
        </header>

        <Toolbar
          onImport={handleImport}
          onConfirm={handleBatchConfirm}
          onWithdraw={handleBatchWithdraw}
          onExport={handleExport}
          selectedCount={selected.size}
          totalCount={records.length}
          confirmedCount={confirmedCount}
          pendingCount={pendingCount}
        />

        <main className="mt-8 space-y-10">
          <SampleCard sample={sampleRecord} />
          <AlertsPanel records={records} onViewRaw={handleViewRaw} onLocate={handleLocate} />
          <DataTable
            records={records}
            selected={selected}
            onSelectedChange={setSelected}
            onConfirm={handleConfirm}
            onWithdraw={handleWithdraw}
            onRemark={handleRemark}
            onViewRaw={handleViewRaw}
            highlightId={highlightId}
            onHighlightClear={() => setHighlightId(null)}
          />
        </main>

        <footer className="mt-14 pt-6 border-t-2 border-slate-300">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <div className="text-[11px] font-sans font-bold tracking-widest uppercase text-slate-600">
                小宋接班速查
              </div>
              <ol className="space-y-1 font-serif text-xs text-slate-600 leading-relaxed">
                <li>① <b>样例在哪</b>：页面上方「接班样例」卡片，点开「查看原始说法」看CSV原文。</li>
                <li>② <b>异常在哪</b>：「异常区」三个标签—采样断档/字段缺失/状态冲突，点「找它」跳到明细。</li>
                <li>③ <b>结果怎么导出</b>：右上角「导出CSV」，含处理状态、人工备注、来源文件、原始行。</li>
              </ol>
            </div>
            <div className="font-mono text-[10px] text-slate-400 leading-relaxed text-right max-w-xs">
              本地存储 · 不上传服务器<br />
              v{version} · 人工备注永不覆盖<br />
              Keys: {Object.values(STORAGE_KEYS).join(" / ")}
            </div>
          </div>
        </footer>
      </div>

      <RawRowDrawer
        open={drawerOpen}
        record={drawerRecord}
        onClose={() => setDrawerOpen(false)}
      />

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-[2px] shadow-2xl border-2 border-slate-900 font-sans text-sm tracking-tight max-w-[560px]">
          {toast}
        </div>
      </div>
    </div>
  );
}

function Badge({
  color,
  label,
  value,
}: {
  color: "blue" | "orange" | "slate";
  label: string;
  value: number;
}) {
  const map = {
    blue: "border-[#1E40AF] text-[#1E40AF] bg-blue-50",
    orange: "border-[#EA580C] text-[#EA580C] bg-orange-50",
    slate: "border-slate-800 text-slate-800 bg-slate-50",
  } as const;
  return (
    <div
      className={`flex flex-col items-center px-3 py-1.5 rounded-[2px] border-2 min-w-[84px] ${map[color]}`}
    >
      <span className="text-[9px] font-sans tracking-widest uppercase">{label}</span>
      <span className="font-sans text-xl font-black tabular-nums">{value}</span>
    </div>
  );
}
