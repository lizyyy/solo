import { useState, useMemo } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import { useSceneStore } from '@/store/useSceneStore';
import RoofScene from '@/components/scene3d/RoofScene';
import Timeline from '@/components/scene3d/Timeline';
import FilterBar from '@/components/scene3d/FilterBar';
import FieldNormalizer from '@/components/processing/FieldNormalizer';
import MaterialList from '@/components/processing/MaterialList';
import UsageGuide from '@/components/processing/UsageGuide';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Layers, ListChecks, BookOpen, Package, AlertTriangle, CheckCircle, MapPin, Clock, FileText, Lock } from 'lucide-react';
import type { MaterialItem } from '@/types';

type TabKey = 'normalize' | 'materials' | 'guide';

const tabs: { key: TabKey; label: string; Icon: typeof Layers }[] = [
  { key: 'normalize', label: '字段归一化', Icon: Layers },
  { key: 'materials', label: '材料列表', Icon: ListChecks },
  { key: 'guide', label: '使用说明', Icon: BookOpen },
];

const typeLabel: Record<string, string> = {
  pipe: '管道',
  hopper: '雨水斗',
  gutter: '天沟',
  fitting: '管件',
  sealant: '密封',
};

const statusLabel: Record<string, { label: string; className: string }> = {
  confirmed: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: '待处理', className: 'bg-slate-100 text-slate-600' },
  conflicted: { label: '有冲突', className: 'bg-amber-100 text-amber-700' },
  obsolete: { label: '已废弃', className: 'bg-slate-200 text-slate-500' },
};

function SelectedMaterialPanel() {
  const selectedMaterialId = useSceneStore((s) => s.selectedMaterialId);
  const selectedMaterialName = useSceneStore((s) => s.selectedMaterialName);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const materials = useTrackStore((s) => s.materials);
  const collisions = useTrackStore((s) => s.collisions);
  const runs = useTrackStore((s) => s.runs);
  const currentRunId = useTrackStore((s) => s.currentRunId);

  const selectedMaterial = useMemo(() => {
    if (!selectedMaterialId) return null;
    return materials.find((m) => m.materialId === selectedMaterialId) ?? null;
  }, [selectedMaterialId, materials]);

  const collisionInfo = useMemo(() => {
    if (!selectedMaterialId) return null;
    const related = collisions.filter((c) => c.involvedMaterialIds.includes(selectedMaterialId));
    if (related.length === 0) return null;
    const highest = related.reduce((prev, curr) => {
      const order = { high: 3, medium: 2, low: 1 };
      return order[curr.confidence] > order[prev.confidence] ? curr : prev;
    });
    return { count: related.length, highest: highest.confidence, collision: highest };
  }, [selectedMaterialId, collisions]);

  const latestTimelineEvent = useMemo(() => {
    if (!selectedMaterial) return null;
    const relatedRuns = runs
      .filter((r) => r.batchId === selectedMaterial.runId.split('-')[0] || true)
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    return relatedRuns[0] ?? null;
  }, [selectedMaterial, runs]);

  if (!selectedMaterial) {
    return (
      <div className="mb-2 px-6 pt-3">
        <Timeline />
      </div>
    );
  }

  const riskConfig: Record<string, { label: string; className: string; iconColor: string }> = {
    high: { label: '高风险碰撞', className: 'bg-red-50 text-red-700 border-red-200', iconColor: 'text-red-500' },
    medium: { label: '中风险碰撞', className: 'bg-orange-50 text-orange-700 border-orange-200', iconColor: 'text-orange-500' },
    low: { label: '低风险碰撞', className: 'bg-yellow-50 text-yellow-700 border-yellow-200', iconColor: 'text-yellow-500' },
    none: { label: '无碰撞风险', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconColor: 'text-emerald-500' },
  };

  const risk = collisionInfo ? riskConfig[collisionInfo.highest] : riskConfig.none;
  const status = statusLabel[selectedMaterial.processingStatus];

  return (
    <div className="mb-2 px-6 pt-3 space-y-2">
      <div className="relative rounded-xl border border-[#1F3A5F]/20 bg-gradient-to-r from-[#1F3A5F]/5 to-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-[#1F3A5F]" />
              <h2 className="text-base font-bold text-[#1F3A5F]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                {selectedMaterial.standardName}
              </h2>
              {selectedMaterial.lockedFields.length > 0 && (
                <span className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <Lock size={10} />
                  锁定{selectedMaterial.lockedFields.length}字段
                </span>
              )}
              <button
                onClick={clearSelection}
                className="ml-2 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                取消选中
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg bg-white px-3 py-2 border border-slate-100">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                  <Layers size={10} />
                  材料类型
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  {typeLabel[selectedMaterial.materialType] ?? selectedMaterial.materialType}
                </div>
              </div>

              <div className="rounded-lg bg-white px-3 py-2 border border-slate-100">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                  <FileText size={10} />
                  规格说明
                </div>
                <div className="text-sm font-semibold text-slate-800 truncate" title={selectedMaterial.materialName ?? '未指定'}>
                  {selectedMaterial.materialName ?? '未指定'}
                </div>
              </div>

              <div className="rounded-lg bg-white px-3 py-2 border border-slate-100">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                  <MapPin size={10} />
                  来源
                </div>
                <div className="text-sm font-semibold text-slate-800 truncate" title={selectedMaterial.sourceNoteNumber}>
                  {selectedMaterial.sourceNoteNumber}
                </div>
              </div>

              <div className="rounded-lg bg-white px-3 py-2 border border-slate-100">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                  <CheckCircle size={10} />
                  处理状态
                </div>
                <div>
                  <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', status.className)}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className={cn('rounded-lg px-3 py-2 border', risk.className)}>
                <div className="flex items-center gap-1 text-[10px] opacity-80 mb-0.5">
                  <AlertTriangle size={10} className={risk.iconColor} />
                  碰撞风险
                </div>
                <div className="text-sm font-semibold">
                  {collisionInfo ? `${collisionInfo.count}处 · ${risk.label}` : risk.label}
                </div>
              </div>
            </div>

            {latestTimelineEvent && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <Clock size={12} />
                <span>最近时间轴事件：</span>
                <span className="font-medium text-slate-700">
                  {latestTimelineEvent.drawingVersion} · {new Date(latestTimelineEvent.executedAt).toLocaleString('zh-CN')}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-600">{latestTimelineEvent.remark}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Timeline />
    </div>
  );
}

export default function TrackerPage() {
  const currentBatchId = useTrackStore((s) => s.currentBatchId);
  const batches = useTrackStore((s) => s.batches);
  const currentBatch = batches.find((b) => b.batchId === currentBatchId);
  const selectedMaterialId = useSceneStore((s) => s.selectedMaterialId);

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
              {selectedMaterialId && (
                <span className="ml-2 text-[#1F3A5F]">
                  · 已选中材料
                </span>
              )}
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

      <SelectedMaterialPanel />

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
