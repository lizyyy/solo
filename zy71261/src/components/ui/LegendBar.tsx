import { useTermWallStore } from "@/store/useTermWallStore";

export default function LegendBar() {
  const blockCount = useTermWallStore((s) => s.aggregatedBlocks.length);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-[#111827]/80 backdrop-blur border-t border-[#1e293b] flex items-center px-4 gap-6 z-40">
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ff6b35]" />
          多头
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#00d4aa]" />
          空头
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-600" />
          方向缺失
        </span>
      </div>

      <div className="h-3 w-px bg-[#1e293b]" />

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-1 h-3 bg-slate-500 rounded-sm" />
        方块高度 = 保证金
      </div>

      <div className="h-3 w-px bg-[#1e293b]" />

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 border border-amber-400" />
        缺失字段标记
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60 border border-red-400" />
        保证金重复
      </div>

      <div className="h-3 w-px bg-[#1e293b]" />

      <div className="text-xs text-slate-500">
        方块数: <span className="text-slate-300">{blockCount}</span>
      </div>
    </div>
  );
}
