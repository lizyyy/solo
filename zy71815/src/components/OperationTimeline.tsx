import {
  Upload,
  CheckCircle2,
  Undo2,
  PenLine,
} from "lucide-react";
import type { OperationLog } from "@/utils/api";

const TYPE_CONFIG = {
  import: { icon: Upload, color: "bg-blue-500", label: "导入" },
  confirm: { icon: CheckCircle2, color: "bg-emerald-500", label: "确认" },
  withdraw: { icon: Undo2, color: "bg-amber-500", label: "撤回" },
  modify: { icon: PenLine, color: "bg-purple-500", label: "修正" },
};

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

interface OperationTimelineProps {
  logs: OperationLog[];
}

export default function OperationTimeline({ logs }: OperationTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        暂无操作记录
      </div>
    );
  }

  return (
    <div className="relative ml-4">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

      <div className="space-y-6">
        {logs.map((log) => {
          const config = TYPE_CONFIG[log.operation_type] || TYPE_CONFIG.modify;
          const Icon = config.icon;

          const beforeEntries = Object.entries(log.before_value || {});
          const afterEntries = Object.entries(log.after_value || {});
          const changedFields = beforeEntries.filter(([key]) =>
            afterEntries.some(([k]) => k === key)
          );

          return (
            <div key={log.id} className="relative flex gap-4">
              <div
                className={`z-10 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${config.color} ring-4 ring-white`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>

              <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-800">
                      {config.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {log.operator}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-slate-400">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>

                {changedFields.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {changedFields.map(([key, beforeVal]) => {
                      const afterVal = log.after_value?.[key as keyof typeof log.after_value];
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">
                            {FIELD_LABELS[key] || key}
                          </span>
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600 line-through">
                            {String(beforeVal ?? "-")}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                            {String(afterVal ?? "-")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {log.reason && (
                  <p className="mt-2 text-xs text-slate-500">
                    原因：{log.reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
