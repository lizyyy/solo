import { useGameStore } from "../game/store";

export default function ResourcePanel() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const pending = state.orders.filter(
    (o) => o.status === "queued" || o.status === "imposed",
  ).length;
  const printed = state.orders.filter((o) => o.status === "printed").length;
  const failed = state.orders.filter((o) => o.status === "failed").length;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="text-sm uppercase tracking-widest text-[#0A1F44]/70">资源与状态</div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="关卡" value={state.level.name} />
        <Stat label="回合" value={`D${state.day} / ${state.level.maxDays}`} />
        <Stat label="现金" value={`¥${state.cash}`} />
        <Stat label="分数" value={`${state.score} / ${state.level.targetScore}`} highlight />
        <Stat label="待办" value={String(pending)} />
        <Stat label="已印/失败" value={`${printed} / ${failed}`} />
      </div>
      <div className="rounded border border-[#0A1F44]/20 bg-[#F7F3E9] p-2 text-[11px] text-[#0A1F44]/80">
        <div className="font-semibold mb-1">本关规则</div>
        <div>可用开数：{state.level.formats.join(" / ")}</div>
        <div>换色成本：¥{state.level.inkSwitchCost} / 次</div>
        <div>逾期罚款：¥{state.level.missDeadlinePenalty} / 单</div>
        <div>最低质量：{state.level.minQuality}</div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border border-[#0A1F44]/20 p-2 ${
        highlight ? "bg-[#FFD100]/20" : "bg-white"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[#0A1F44]/60">
        {label}
      </div>
      <div className="font-semibold text-[#0A1F44]">{value}</div>
    </div>
  );
}
