import { Orbit, Compass, Eye } from 'lucide-react';
import { useTidalStore, type ViewPreset } from '@/store/useTidalStore';
import { cn } from '@/lib/utils';

const PRESETS: { id: ViewPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '俯瞰', icon: <Compass className="h-4 w-4" /> },
  { id: 'side', label: '侧视', icon: <Eye className="h-4 w-4" /> },
  { id: 'orbit', label: '环绕', icon: <Orbit className="h-4 w-4" /> },
];

export function ViewControls() {
  const viewPreset = useTidalStore((s) => s.viewPreset);
  const setViewPreset = useTidalStore((s) => s.setViewPreset);

  return (
    <div className="absolute bottom-5 left-5 z-10 flex flex-col gap-2">
      <div className="rounded-xl border border-glow-teal/30 bg-abyss-800/85 p-1 backdrop-blur-md">
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewPreset(p.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] transition-all',
                viewPreset === p.id
                  ? 'bg-glow-cyan/20 text-glow-cyan shadow-glow'
                  : 'text-signal-moon/60 hover:bg-glow-deep/20 hover:text-signal-moon',
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="px-1 font-mono text-[10px] text-signal-moon/40">拖拽旋转 · 滚轮缩放 · 点选浮标查看原始日志</p>
    </div>
  );
}
