import { useState } from 'react';
import { Map, Clock, FileText, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { useUILayoutStore } from '../../store/useUILayoutStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { STATION_NAME } from '../../data/stationConfig';

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const toggleReportModal = useUILayoutStore((state) => state.toggleReportModal);
  const showBottleneckPanel = useUILayoutStore((state) => state.showBottleneckPanel);
  const showConflictPanel = useUILayoutStore((state) => state.showConflictPanel);
  const toggleBottleneckPanel = useUILayoutStore((state) => state.toggleBottleneckPanel);
  const toggleConflictPanel = useUILayoutStore((state) => state.toggleConflictPanel);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const menuItems = [
    { id: 'sandbox', icon: Map, label: '沙盘', options: [
      { label: '显示全局视角', action: () => useUILayoutStore.getState().setViewPreset('overview') },
      { label: '重置视角', action: () => useUILayoutStore.getState().setViewPreset('overview') },
    ]},
    { id: 'time', icon: Clock, label: '时间', options: [
      { label: '跳转到7:30', action: () => useSimulationStore.getState().setTime('07:30') },
      { label: '跳转到8:15', action: () => useSimulationStore.getState().setTime('08:15') },
      { label: '跳转到9:00', action: () => useSimulationStore.getState().setTime('09:00') },
    ]},
    { id: 'report', icon: FileText, label: '报告', options: [
      { label: '生成当前报告', action: () => toggleReportModal() },
      { label: showBottleneckPanel ? '隐藏瓶颈面板' : '显示瓶颈面板', action: () => toggleBottleneckPanel() },
      { label: showConflictPanel ? '隐藏冲突面板' : '显示冲突面板', action: () => toggleConflictPanel() },
    ]},
    { id: 'settings', icon: Settings, label: '设置', options: [
      { label: '切换全屏', action: () => toggleFullscreen() },
    ]},
  ];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/30 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Map className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-cyan-400 font-bold text-lg tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  地铁换乘人流沙盘
                </h1>
                <p className="text-slate-500 text-xs">{STATION_NAME}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setActiveMenu(item.id)}
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      activeMenu === item.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>

                  {activeMenu === item.id && (
                    <div className="absolute top-full left-0 mt-1 bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-lg py-2 min-w-48 shadow-xl">
                      {item.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            option.action();
                            setActiveMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
