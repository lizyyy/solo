import { RISK_GRADIENT } from '@/utils/colors';

export function RiskLegend() {
  return (
    <div className="absolute left-4 top-4 bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3 shadow-2xl z-10">
      <div className="text-xs font-medium text-slate-300 mb-2">风险等级图例</div>
      <div className="flex gap-0.5">
        {RISK_GRADIENT.map((item) => (
          <div key={item.level} className="flex flex-col items-center group relative">
            <div
              className="w-6 h-8 first:rounded-l last:rounded-r transition-transform group-hover:scale-110"
              style={{ backgroundColor: item.color }}
              title={`${item.label} (${item.level}级)`}
            />
            <div className="text-[9px] text-slate-400 mt-1 font-mono">{item.level}</div>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 mt-1 px-0.5">
        <span>低风险</span>
        <span>高风险</span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs font-medium text-slate-300 mb-2">标记说明</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-[11px] text-slate-400">存在异常标记</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[11px] text-slate-400">已选中区域</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-8 rounded bg-gradient-to-t from-amber-500 to-red-500" />
            <span className="text-[11px] text-slate-400">柱子高度 = 敞口规模</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="text-xs font-medium text-slate-300 mb-2">操作说明</div>
        <div className="space-y-1 text-[10px] text-slate-500">
          <div>🖱 拖拽: 旋转视角</div>
          <div>⚙ 滚轮: 缩放视图</div>
          <div>🖱 右键拖拽: 平移视图</div>
          <div>👆 点击柱子: 查看明细</div>
        </div>
      </div>
    </div>
  );
}
