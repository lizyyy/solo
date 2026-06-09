import { Box, Layers } from 'lucide-react';
import { Scene } from './Scene';
import { useUiStore } from '@/store/uiStore';

export function Web3DViewer() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-inner">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
        <Layers className="h-3.5 w-3.5 text-blue-400" />
        <span className="font-bold tracking-wider text-blue-300" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          结构模型 · Web3D
        </span>
        <span className="ml-2 text-[10px] text-slate-500">左键旋转 · 滚轮缩放 · 右键平移 · 点选构件</span>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-md bg-slate-900/80 p-1 text-xs backdrop-blur">
        {(['split', '3d', 'list'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`rounded px-2 py-1 transition-colors ${
              viewMode === m
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {m === 'split' ? '分栏' : m === '3d' ? '仅3D' : '仅列表'}
          </button>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-md bg-slate-900/70 px-3 py-2 text-[10px] text-slate-400 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <Box className="h-3 w-3 text-emerald-500" />
          <span>已对齐</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="h-3 w-3 text-amber-500" />
          <span>口径对不上</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="h-3 w-3 text-orange-500" />
          <span>坐标疑点（呼吸闪烁 · 暂缓报告）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Box className="h-3 w-3 text-slate-500" />
          <span>资料不齐 / 无签证</span>
        </div>
      </div>

      <div className="absolute inset-0">
        <Scene />
      </div>
    </div>
  );
}
