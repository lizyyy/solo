import { useMemo } from "react";
import { X, Package2, Factory, Calendar, Tag, AlertOctagon, FileWarning, Boxes } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { MATERIAL_BATCHES } from "@/data/mockData";

export function MaterialDrawer() {
  const selectedRecordId = useAppStore((s) => s.selectedRecordId);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const result = useAppStore((s) => s.lastAlgoResult);

  const record = useMemo(() => {
    if (!result || !selectedRecordId) return null;
    return result.records.find((r) => r.id === selectedRecordId) ?? null;
  }, [result, selectedRecordId]);

  const batch = useMemo(() => {
    if (!record) return null;
    return MATERIAL_BATCHES[record.batchId] ?? null;
  }, [record]);

  const sameBatch = useMemo(() => {
    if (!result || !record) return [];
    return result.records.filter(
      (r) => r.batchId === record.batchId && r.id !== record.id && r.status !== "normal",
    );
  }, [result, record]);

  if (!record || !batch) {
    return (
      <aside className="h-full w-[340px] shrink-0 bg-ink-900/50 border-l border-ink-700/50 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-5 py-5 border-b border-ink-700/50">
          <div className="flex items-center gap-2 text-ink-600 text-xs uppercase tracking-widest mb-2">
            <Boxes size={14} /> 材料溯源
          </div>
          <div className="font-serif text-lg text-white/70">
            在明细中点击「查看材料」
          </div>
        </div>
        <div className="flex-1 p-5 text-[12px] text-ink-600 leading-relaxed space-y-3">
          <p>
            运营主管看到异常后，从明细定位到可疑行，再点到这里看批次、供应商、入库情况。
          </p>
          <p className="flex items-start gap-2">
            <AlertOctagon size={13} className="mt-0.5 text-alert-red shrink-0" />
            设备工程师老何的快捷路径：README 第 2 步 → 明细顶部的边界卡 → 批次备注。
          </p>
          <div className="mt-6 rounded border border-ink-700/40 p-3 bg-ink-800/20">
            <div className="text-[11px] text-ink-500 mb-1">最近已入库批次</div>
            <div className="space-y-1.5">
              {Object.values(MATERIAL_BATCHES)
                .sort((a, b) => b.inboundDate.localeCompare(a.inboundDate))
                .slice(0, 6)
                .map((m) => (
                  <div
                    key={m.batchId}
                    className="flex items-center justify-between text-[11px] font-mono"
                  >
                    <span className="text-white/70">{m.batchId}</span>
                    <span
                      className={
                        m.sameBatchAnomalies > 0 ? "text-alert-orange" : "text-ink-500"
                      }
                    >
                      {m.sameBatchAnomalies > 0
                        ? `${m.sameBatchAnomalies} 条异常`
                        : "正常"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      key={record.id}
      className="animate-stagger-in h-full w-[340px] shrink-0 bg-ink-900/70 border-l border-ink-700/60 backdrop-blur-sm overflow-y-auto scrollbar-thin grain"
    >
      <div className="px-5 py-4 border-b border-ink-700/60 flex items-start justify-between sticky top-0 bg-ink-900/90 backdrop-blur z-10">
        <div>
          <div className="flex items-center gap-2 text-ink-600 text-[11px] uppercase tracking-widest mb-1.5">
            <Package2 size={12} /> 材料溯源
          </div>
          <div className="font-serif text-xl text-white leading-tight break-all">
            {batch.batchId}
          </div>
          {record.status !== "normal" && (
            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-alert-red/15 text-alert-red text-[10px] font-mono border border-alert-red/40">
              {record.status === "boundary"
                ? "本记录为边界/脏数据"
                : record.isStrongPull
                  ? "强拉动异常样本"
                  : "异常样本"}
            </div>
          )}
        </div>
        <button
          onClick={() => selectRecord(null)}
          className="p-1.5 rounded border border-ink-700/60 text-ink-600 hover:text-white hover:border-ink-600 transition"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        <section className="rounded border border-ink-700/50 overflow-hidden">
          <InfoRow icon={<Factory size={13} />} label="供应商" value={batch.supplier} />
          <InfoRow
            icon={<Calendar size={13} />}
            label="入库日期"
            value={batch.inboundDate}
          />
          <InfoRow
            icon={<Tag size={13} />}
            label="材料类型"
            value={batch.materialType}
            wrap
          />
          <InfoRow
            icon={<Boxes size={13} />}
            label="同批异常数"
            value={`${batch.sameBatchAnomalies} 条`}
            accent={batch.sameBatchAnomalies > 0 ? "text-alert-orange" : "text-alert-green"}
          />
        </section>

        {batch.notes && (
          <section className="rounded border border-alert-red/40 bg-alert-red/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-alert-red mb-1.5">
              <FileWarning size={12} /> 入库备注
            </div>
            <div className="text-sm text-white/90 leading-relaxed">{batch.notes}</div>
          </section>
        )}

        <section>
          <div className="text-[11px] uppercase tracking-wider text-ink-600 mb-2 font-mono">
            样本详情
          </div>
          <div className="rounded border border-ink-700/50 overflow-hidden text-[12px]">
            <InfoRow label="样本 ID" value={record.id} mono />
            <InfoRow
              label="检测时间"
              value={new Date(record.detectTime).toLocaleString("zh-CN", { hour12: false })}
              mono
            />
            <InfoRow
              label="原始检测值"
              value={`${record.rawValue.toFixed(3)} mm`}
              accent="text-alert-orange"
              mono
            />
            <InfoRow
              label="相对稳健均值偏差"
              value={`${(record.deviation ?? 0) >= 0 ? "+" : ""}${(record.deviation ?? 0).toFixed(3)} mm`}
              accent={
                Math.abs(record.deviation ?? 0) > 0.8 ? "text-alert-red" : "text-alert-green"
              }
              mono
            />
            <InfoRow
              label="拉动贡献占比"
              value={`${((record.contribution ?? 0) * 100).toFixed(1)} %`}
              accent={
                (record.contribution ?? 0) > 0.4 ? "text-alert-orange" : "text-white/80"
              }
              mono
            />
            {record.anomalyReason && (
              <InfoRow label="异常原因" value={record.anomalyReason} wrap />
            )}
          </div>
        </section>

        {sameBatch.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-ink-600 font-mono">
                同批次其他异常
              </div>
              <div className="text-[11px] text-alert-orange font-mono">
                {sameBatch.length} 条
              </div>
            </div>
            <div className="space-y-1.5">
              {sameBatch.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRecord(r.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded border border-ink-700/40 bg-ink-800/30 hover:border-alert-orange/50 hover:bg-ink-800/60 transition text-[11px] font-mono"
                >
                  <span className="text-white/80">
                    {new Date(r.detectTime).toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-alert-orange">{r.rawValue.toFixed(3)} mm</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent,
  mono,
  wrap,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start border-b border-ink-800/70 last:border-0 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-600">
        {icon}
        {label}
      </div>
      <div
        className={`text-sm text-right ${accent ?? "text-white/90"} ${mono ? "font-mono" : ""} ${wrap ? "text-left" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
