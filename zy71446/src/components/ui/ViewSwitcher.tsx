import { Home, MapPin, ArrowUpDown, TicketCheck, Train } from 'lucide-react';
import { useUILayoutStore } from '../../store/useUILayoutStore';

type ViewPreset = 'overview' | 'concourse' | 'platform' | 'escalators' | 'turnstiles';

export function ViewSwitcher() {
  const currentView = useUILayoutStore((state) => state.currentView);
  const setViewPreset = useUILayoutStore((state) => state.setViewPreset);

  const views: { id: ViewPreset; icon: typeof Home; label: string }[] = [
    { id: 'overview', icon: Home, label: '全局' },
    { id: 'concourse', icon: MapPin, label: '站厅' },
    { id: 'platform', icon: Train, label: '站台' },
    { id: 'escalators', icon: ArrowUpDown, label: '扶梯' },
    { id: 'turnstiles', icon: TicketCheck, label: '闸机' },
  ];

  return (
    <div className="fixed left-4 top-20 z-40">
      <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl p-1.5 shadow-xl">
        <div className="flex flex-col gap-1">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setViewPreset(view.id)}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                currentView === view.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
              }`}
              title={view.label}
            >
              <view.icon size={18} />
              <span className="text-xs font-medium">{view.label}</span>

              {currentView === view.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-400 rounded-r-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 shadow-xl max-w-48">
        <div className="text-slate-400 text-xs mb-2 font-medium">操作提示</div>
        <div className="space-y-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-cyan-500/30 flex items-center justify-center text-cyan-400">🖱</span>
            <span>左键拖拽旋转</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-cyan-500/30 flex items-center justify-center text-cyan-400">🖱</span>
            <span>右键拖拽平移</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-cyan-500/30 flex items-center justify-center text-cyan-400">🖱</span>
            <span>滚轮缩放</span>
          </div>
        </div>
      </div>
    </div>
  );
}
