import { useEffect } from 'react';
import { TidalScene } from '@/three/TidalScene';
import { StatusBar } from '@/components/StatusBar';
import { LoadBar } from '@/components/LoadBar';
import { ViewControls } from '@/components/ViewControls';
import { Sidebar } from '@/components/Sidebar';
import { useTidalStore } from '@/store/useTidalStore';

export default function Home() {
  const batch = useTidalStore((s) => s.batch);
  const loadLogs = useTidalStore((s) => s.loadLogs);

  useEffect(() => {
    if (!batch) loadLogs();
  }, [batch, loadLogs]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden">
      <div className="grain" />
      <StatusBar />
      <LoadBar />
      <main className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <div className="abyss-grid absolute inset-0 opacity-40" />
          <div className="absolute inset-0">
            <TidalScene />
          </div>
          <SceneLegend />
          <ViewControls />
        </div>
        <Sidebar />
      </main>
    </div>
  );
}

function SceneLegend() {
  const items = [
    { color: 'bg-glow-cyan', label: '正常解析' },
    { color: 'bg-glow-teal', label: '备注修正后' },
    { color: 'bg-signal-amber', label: '待核查' },
    { color: 'bg-signal-coral', label: '异常·原始保留' },
  ];
  return (
    <div className="absolute right-4 top-4 z-10 rounded-xl border border-glow-teal/30 bg-abyss-800/85 px-3 py-2 backdrop-blur-md">
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-signal-moon/40">标注图例</p>
      <div className="space-y-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5 font-mono text-[10px] text-signal-moon/70">
            <span className={`h-2 w-2 rounded-full ${it.color} shadow-glow`} />
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}
