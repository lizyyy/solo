import { useGameStore } from '../store/gameStore';

export default function BudgetBar() {
  const { totalBudget, remainingBudget } = useGameStore();
  const spent = totalBudget - remainingBudget;
  const percentage = (remainingBudget / totalBudget) * 100;
  const isLow = percentage < 30;
  const isCritical = percentage < 10;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#f5f0e8]/70">剩余预算</span>
        <span className={`font-bold tabular-nums ${isCritical ? 'text-[#8b2252] animate-pulse' : isLow ? 'text-[#c9a84c]' : 'text-[#f5f0e8]'}`}>
          ¥{(remainingBudget / 10000).toFixed(0)}万
        </span>
      </div>
      <div className="w-full h-2.5 bg-[#2a2a3e] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-[#8b2252]' : isLow ? 'bg-[#c9a84c]' : 'bg-gradient-to-r from-[#2d5a3d] to-[#4a9a6a]'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[#f5f0e8]/40">
        <span>已花费 ¥{(spent / 10000).toFixed(0)}万</span>
        <span>总预算 ¥{(totalBudget / 10000).toFixed(0)}万</span>
      </div>
    </div>
  );
}
