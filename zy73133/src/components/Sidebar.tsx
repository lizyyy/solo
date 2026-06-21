import { useState } from 'react';
import { Info, MessageSquarePlus, Table2 } from 'lucide-react';
import { StationPanel } from './StationPanel';
import { RemarkPanel } from './RemarkPanel';
import { CsvPanel } from './CsvPanel';
import { useTidalStore } from '@/store/useTidalStore';
import { cn } from '@/lib/utils';

type Tab = 'station' | 'remark' | 'csv';

export function Sidebar() {
  const [tab, setTab] = useState<Tab>('station');
  const remarkTargetId = useTidalStore((s) => s.remarkTargetId);
  const lastVersion = useTidalStore((s) => s.lastVersion);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: 'station', label: '站点详情', icon: <Info className="h-3.5 w-3.5" /> },
    { id: 'remark', label: '备注重跑', icon: <MessageSquarePlus className="h-3.5 w-3.5" />, badge: !!remarkTargetId || !!lastVersion },
    { id: 'csv', label: 'CSV 明细', icon: <Table2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside className="flex h-full w-[400px] shrink-0 flex-col border-l border-glow-teal/20 bg-abyss-800/50 backdrop-blur-md">
      <div className="flex border-b border-glow-teal/20">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-[11px] transition-all',
              tab === t.id
                ? 'bg-glow-cyan/10 text-glow-cyan'
                : 'text-signal-moon/50 hover:bg-glow-deep/15 hover:text-signal-moon',
            )}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-signal-amber animate-breathe" />
            )}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-glow-cyan shadow-glow" />}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'station' && <StationPanel />}
        {tab === 'remark' && <RemarkPanel />}
        {tab === 'csv' && <CsvPanel />}
      </div>
    </aside>
  );
}
