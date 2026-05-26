import { useGameStore } from "../game/store";
import { COLOR_LABELS, Order } from "../game/types";
import { cn } from "../lib/utils";

const statusLabel: Record<Order["status"], string> = {
  queued: "待排",
  imposed: "已拼",
  printing: "印刷中",
  printed: "已印",
  failed: "失败",
};

export default function OrderQueue() {
  const state = useGameStore((s) => s.state);
  const selectOrder = useGameStore((s) => s.selectOrder);
  const cancelOrder = useGameStore((s) => s.cancelOrder);

  if (!state) return null;

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="text-sm uppercase tracking-widest text-[#0A1F44]/70">订单队列</div>
      <div className="flex flex-col gap-2 max-h-[560px] overflow-y-auto pr-1">
        {state.orders.map((o) => {
          const overdue = state.day >= o.deadline && (o.status === "queued" || o.status === "imposed");
          const selected = state.selectedOrderId === o.id;
          return (
            <div
              key={o.id}
              className={cn(
                "border rounded p-2 text-xs bg-white transition cursor-pointer",
                selected
                  ? "border-[#E60012] shadow"
                  : "border-[#0A1F44]/20 hover:border-[#0A1F44]/60",
                o.status === "failed" && "opacity-50 line-through",
                o.status === "printed" && "opacity-70",
              )}
              onClick={() => selectOrder(selected ? null : o.id)}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[#0A1F44]">
                  {o.id} {o.name}
                </div>
                <span
                  className="text-[10px] px-1 rounded"
                  style={{
                    background: COLOR_LABELS[o.colors].css + "22",
                    color: COLOR_LABELS[o.colors].css,
                  }}
                >
                  {COLOR_LABELS[o.colors].label}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[#0A1F44]/70">
                <div>尺寸：{o.sizeW}×{o.sizeH}</div>
                <div>数量：{o.copies}</div>
                <div>交期：D{o.deadline} {overdue && <span className="text-[#E60012]">逾期</span>}</div>
                <div>单价：{o.price}</div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={cn(
                    "text-[10px] px-1 rounded",
                    o.status === "failed" && "bg-[#E60012]/20 text-[#E60012]",
                    o.status === "printed" && "bg-[#4a9d6d]/20 text-[#2e7a4e]",
                    (o.status === "queued" || o.status === "imposed") && "bg-[#0A1F44]/10 text-[#0A1F44]",
                  )}
                >
                  {statusLabel[o.status]}
                  {o.failedReason ? ` · ${o.failedReason}` : ""}
                </span>
                {o.status === "queued" && (
                  <button
                    className="text-[10px] text-[#E60012] hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelOrder(o.id);
                    }}
                  >
                    放弃
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
