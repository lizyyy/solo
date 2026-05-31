import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Copy, AlertTriangle } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { api } from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";
import type { ImportResult } from "@/utils/api";

interface DedupResultProps {
  result: ImportResult;
  sessionId?: string;
  onConfirmDone: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  store_name: "门店",
  activity_name: "活动",
  settlement_period: "结算期间",
  serial_number: "流水号",
  amount: "金额",
  handling_fee: "手续费",
  handling_fee_period: "手续费归属期",
  status: "状态",
};

function Section({
  title,
  count,
  color,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-700">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
            {count}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="border-t border-slate-200 px-4 py-3">{children}</div>}
    </div>
  );
}

export default function DedupResult({ result, sessionId, onConfirmDone }: DedupResultProps) {
  const { showToast, setImportResult, fetchRecords } = useSettlementStore();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!sessionId) {
      showToast("无法确认导入，缺少会话标识", "error");
      return;
    }
    setConfirming(true);
    try {
      const res = await api.imports.confirm(sessionId);
      showToast(`导入成功，共导入 ${res.imported_count} 条新记录`);
      setImportResult(null);
      await fetchRecords();
      onConfirmDone();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    } finally {
      setConfirming(false);
    }
  };

  const formatAmount = (val: number) =>
    val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
            {result.new_count}
          </p>
          <p className="text-sm text-emerald-600">新增记录</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <Copy className="mx-auto h-8 w-8 text-amber-600" />
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700">
            {result.duplicate_count}
          </p>
          <p className="text-sm text-amber-600">重复记录</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
          <p className="mt-2 text-2xl font-bold tabular-nums text-red-700">
            {result.conflict_count}
          </p>
          <p className="text-sm text-red-600">冲突记录</p>
        </div>
      </div>

      {result.new_count > 0 && (
        <Section
          title="新增记录"
          count={result.new_count}
          color="bg-emerald-100 text-emerald-700"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          defaultOpen
        >
          <div className="max-h-60 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 pr-3">门店</th>
                  <th className="pb-2 pr-3">活动</th>
                  <th className="pb-2 pr-3">结算期间</th>
                  <th className="pb-2 text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {result.new_records.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-700">{r.store_name}</td>
                    <td className="py-1.5 pr-3 text-slate-700">{r.activity_name}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.settlement_period}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">
                      {formatAmount(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {result.duplicate_records.length > 0 && (
        <Section
          title="重复记录（自动跳过）"
          count={result.duplicate_count}
          color="bg-amber-100 text-amber-700"
          icon={<Copy className="h-4 w-4 text-amber-600" />}
        >
          <div className="space-y-2">
            {result.duplicate_records.map((item, i) => (
              <div key={i} className="rounded-md bg-amber-50 p-3 text-xs">
                <p className="text-slate-700">
                  <span className="font-medium">{item.record.store_name}</span>
                  {" · "}
                  {item.record.activity_name}
                  {" · "}
                  {item.record.settlement_period}
                  {" · "}
                  流水号 {item.record.serial_number}
                </p>
                <p className="mt-1 text-amber-700">{item.reason}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {result.conflict_records.length > 0 && (
        <Section
          title="冲突记录（金额不一致）"
          count={result.conflict_count}
          color="bg-red-100 text-red-700"
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          defaultOpen
        >
          <div className="space-y-3">
            {result.conflict_records.map((item, i) => (
              <div key={i} className="rounded-md border border-red-200 p-3">
                <p className="mb-2 text-xs font-medium text-red-700">
                  门店 {item.existing.store_name} · 活动 {item.existing.activity_name} ·
                  期间 {item.existing.settlement_period} · 流水号{" "}
                  {item.existing.serial_number}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded bg-slate-50 p-2">
                    <p className="mb-1 text-xs text-slate-500">已有记录</p>
                    {item.diff_fields.map((field) => (
                      <p key={field} className="text-red-600">
                        {FIELD_LABELS[field] || field}：{String((item.existing as unknown as Record<string, unknown>)[field] ?? "-")}
                      </p>
                    ))}
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <p className="mb-1 text-xs text-slate-500">导入数据</p>
                    {item.diff_fields.map((field) => (
                      <p key={field} className="text-red-600">
                        {FIELD_LABELS[field] || field}：{String((item.incoming as unknown as Record<string, unknown>)[field] ?? "-")}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {result.new_count > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-6 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {confirming ? "导入中..." : `确认导入 ${result.new_count} 条新记录`}
          </button>
        </div>
      )}
    </div>
  );
}
