import { useState } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import RoofScene from '@/components/scene3d/RoofScene';
import Timeline from '@/components/scene3d/Timeline';
import FilterBar from '@/components/scene3d/FilterBar';
import FieldNormalizer from '@/components/processing/FieldNormalizer';
import MaterialList from '@/components/processing/MaterialList';
import UsageGuide from '@/components/processing/UsageGuide';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Layers, ListChecks, BookOpen } from 'lucide-react';

type TabKey = 'normalize' | 'materials' | 'guide';

const tabs: { key: TabKey; label: string; Icon: typeof Layers }[] = [
  { key: 'normalize', label: '字段归一化', Icon: Layers },
  { key: 'materials', label: '材料列表', Icon: ListChecks },
  { key: 'guide', label: '使用说明', Icon: BookOpen },
];

export default function TrackerPage() {
  const currentBatchId = useTrackStore((s) => s.currentBatchId);
  const batches = useTrackStore((s) => s.batches);
  const currentBatch = batches.find((b) => b.batchId === currentBatchId);

  const [activeTab, setActiveTab] = useState<TabKey>('normalize');
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F3A5F] text-white">
            <Layers size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1F3A5F]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              追踪工作台
            </h1>
            <p className="text-[11px] text-slate-500">
              当前批次：
              <span className="font-medium text-slate-700">
                {currentBatch ? `${currentBatch.batchId} · ${currentBatch.name}` : '未选择'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanelCollapsed((c) => !c)}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {panelCollapsed ? (
              <>展开面板 <ChevronLeft size={13} /></>
            ) : (
              <>折叠面板 <ChevronRight size={13} /></>
            )}
          </button>
        </div>
      </header>

      <div className="mb-2 px-6 pt-3">
        <Timeline />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-6 pb-4">
        <div className="flex w-64 shrink-0 flex-col gap-3">
          <FilterBar />
        </div>

        <div className="min-w-0 flex-1">
          <RoofScene />
        </div>

        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300',
            panelCollapsed ? 'w-0 border-0' : 'w-80'
          )}
        >
          <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-1.5 py-1.5">
            {tabs.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'bg-[#1F3A5F] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-700'
                  )}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'normalize' && <FieldNormalizer />}
            {activeTab === 'materials' && <MaterialList />}
            {activeTab === 'guide' && <UsageGuide />}
          </div>
        </aside>
      </div>
    </div>
  );
}
