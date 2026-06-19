import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Material, FilterCriteria, TimelineEvent, ExportRecord, FittingResult, JumpCause } from './types';
import { mockMaterials, mockFilterCriterias, mockTimeline, mockExports, mockHandoverNote } from './mockData';
import { fitMaterial, analyzeJumpCauses, computeDataHash } from './utils/fitting';
import TopBar from './components/TopBar';
import MaterialsPanel from './components/MaterialsPanel';
import FittingChart from './components/FittingChart';
import TimelinePanel from './components/TimelinePanel';
import JumpAnalysis from './components/JumpAnalysis';
import HandoverPanel from './components/HandoverPanel';
import ExportPanel from './components/ExportPanel';
import ScreenSnapshot from './components/ScreenSnapshot';
import DraftTraceModal from './components/DraftTraceModal';

type TabKey = 'fitting' | 'timeline' | 'handover' | 'anomaly';

export default function App() {
  const [materials, setMaterials] = useState<Material[]>(mockMaterials);
  const [filterCriterias] = useState<FilterCriteria[]>(mockFilterCriterias);
  const [activeFilterId, setActiveFilterId] = useState<string>(mockFilterCriterias[0].id);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(mockTimeline);
  const [exports, setExports] = useState<ExportRecord[]>(mockExports);
  const [activeTab, setActiveTab] = useState<TabKey>('fitting');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(mockMaterials[0].id);
  const [traceModal, setTraceModal] = useState<{ material: Material } | null>(null);
  const [previousFittingMap, setPreviousFittingMap] = useState<Record<string, FittingResult> | undefined>(undefined);

  const activeFilter = useMemo(
    () => filterCriterias.find(f => f.id === activeFilterId) || filterCriterias[0],
    [filterCriterias, activeFilterId],
  );

  const filteredMaterials = useMemo(
    () => materials.filter(m => activeFilter.materialIds.includes(m.id)),
    [materials, activeFilter],
  );

  const selectedMaterial = useMemo(
    () => materials.find(m => m.id === selectedMaterialId) || null,
    [materials, selectedMaterialId],
  );

  const fittingResults = useMemo(() => {
    const map: Record<string, FittingResult> = {};
    for (const m of filteredMaterials) {
      map[m.id] = fitMaterial(m, activeFilter);
    }
    return map;
  }, [filteredMaterials, activeFilter]);

  useEffect(() => {
    if (!previousFittingMap && Object.keys(fittingResults).length > 0) {
      const saved = sessionStorage.getItem('prev-fitting');
      if (saved) {
        try { setPreviousFittingMap(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
  }, [fittingResults, previousFittingMap]);

  const jumpCauses: JumpCause[] = useMemo(() => {
    const prevFilter = filterCriterias.find((_, idx) => filterCriterias.findIndex(f => f.id === activeFilterId) > 0
      ? idx === filterCriterias.findIndex(f => f.id === activeFilterId) - 1
      : false);
    return analyzeJumpCauses(fittingResults, previousFittingMap, filteredMaterials, activeFilter, prevFilter);
  }, [fittingResults, previousFittingMap, filteredMaterials, activeFilter, filterCriterias, activeFilterId]);

  const screenSnapshot = useMemo(() => {
    const rSquaredValues: Record<string, number> = {};
    const boundaryWarnings: string[] = [];
    let totalPoints = 0;
    for (const m of filteredMaterials) {
      const r = fittingResults[m.id];
      if (r) {
        rSquaredValues[m.id] = r.rSquared;
        totalPoints += m.dataPoints.length;
        if (r.boundaryWarning) {
          boundaryWarnings.push(`${m.id}: 边界样本不足(${r.boundarySampleCount}份，要求${activeFilter.boundarySampleMinCount})`);
        }
      }
      if (m.status === 'missing') {
        boundaryWarnings.push(`${m.id}: 材料状态为"缺材料"`);
      }
    }
    return {
      materialCount: filteredMaterials.length,
      totalPoints,
      rSquaredValues,
      boundaryWarnings,
    };
  }, [filteredMaterials, fittingResults, activeFilter]);

  const handleExport = useCallback(() => {
    const hash = computeDataHash(screenSnapshot);
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const record: ExportRecord = {
      id: 'exp-' + now,
      timestamp: now,
      operator: '当前用户',
      filterCriteriaId: activeFilterId,
      dataHash: hash,
      onScreenSnapshot: screenSnapshot,
      fileName: `boundary_review_${dateStr}_${hash}.xlsx`,
    };
    setExports(prev => [record, ...prev]);
    setTimeline(prev => [{
      id: 't-' + now,
      type: 'export',
      timestamp: now,
      operator: '当前用户',
      description: `导出报告 - ${record.fileName}`,
      detail: { hash, pointCount: screenSnapshot.totalPoints },
    }, ...prev]);

    sessionStorage.setItem('prev-fitting', JSON.stringify(fittingResults));
    setPreviousFittingMap({ ...fittingResults });

    alert(`导出成功！\n文件名：${record.fileName}\n数据哈希：${hash}\n\n(绑定屏幕快照，导入时可校验一致性)`);
  }, [screenSnapshot, activeFilterId, fittingResults]);

  const handleRenameMaterial = (materialId: string, newName: string, reason: string) => {
    setMaterials(prev => prev.map(m => {
      if (m.id !== materialId) return m;
      const now = Date.now();
      return {
        ...m,
        currentName: newName,
        nameHistory: [...m.nameHistory, {
          id: 'nh-' + now,
          materialId: m.id,
          name: newName,
          timestamp: now,
          operator: '当前用户',
          reason,
        }],
        updatedAt: now,
      };
    }));
    const now = Date.now();
    setTimeline(prev => [{
      id: 't-' + now,
      type: 'rename',
      timestamp: now,
      operator: '当前用户',
      description: `材料改名：${materials.find(m => m.id === materialId)?.currentName || ''} → ${newName}`,
      detail: { materialId, reason },
    }, ...prev]);
  };

  const handleStatusChange = (materialId: string, status: Material['status']) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, status, updatedAt: Date.now() } : m));
    const now = Date.now();
    const m = materials.find(mm => mm.id === materialId);
    setTimeline(prev => [{
      id: 't-' + now,
      type: 'status_change',
      timestamp: now,
      operator: '当前用户',
      description: `【状态变更】${m?.currentName}：${statusToLabel(m?.status || 'pending')} → ${statusToLabel(status)}`,
      detail: { materialId, fromStatus: m?.status, toStatus: status },
    }, ...prev]);
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'fitting', label: '拟合复核', icon: '📈' },
    { key: 'anomaly', label: `异常与跳变${jumpCauses.length > 0 ? ` (${jumpCauses.length})` : ''}`, icon: '⚠️' },
    { key: 'timeline', label: '历史时间线', icon: '🕒' },
    { key: 'handover', label: '交接面板', icon: '🤝' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        filterCriterias={filterCriterias}
        activeFilterId={activeFilterId}
        onFilterChange={setActiveFilterId}
        onExport={handleExport}
        exportsCount={exports.length}
      />

      <div className="px-6 py-3 border-b border-slate-200 bg-white flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === t.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'fitting' && (
          <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-auto">
            <div className="col-span-12 xl:col-span-4 space-y-4">
              <MaterialsPanel
                materials={filteredMaterials}
                allMaterials={materials}
                fittingResults={fittingResults}
                selectedMaterialId={selectedMaterialId}
                onSelect={setSelectedMaterialId}
                onRename={handleRenameMaterial}
                onStatusChange={handleStatusChange}
                onTraceDraft={(m) => setTraceModal({ material: m })}
              />
              <ScreenSnapshot snapshot={screenSnapshot} hash={computeDataHash(screenSnapshot)} />
            </div>
            <div className="col-span-12 xl:col-span-8 space-y-4">
              <FittingChart
                material={selectedMaterial}
                result={selectedMaterialId ? fittingResults[selectedMaterialId] : undefined}
              />
              <ExportPanel exports={exports} screenSnapshot={screenSnapshot} currentHash={computeDataHash(screenSnapshot)} />
            </div>
          </div>
        )}

        {activeTab === 'anomaly' && (
          <div className="flex-1 overflow-auto p-6">
            <JumpAnalysis
              causes={jumpCauses}
              materials={filteredMaterials}
              fittingResults={fittingResults}
            />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="flex-1 overflow-auto p-6">
            <TimelinePanel events={timeline} exports={exports} />
          </div>
        )}

        {activeTab === 'handover' && (
          <div className="flex-1 overflow-auto p-6">
            <HandoverPanel
              note={mockHandoverNote}
              materials={materials}
              fittingResults={fittingResults}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>

      {traceModal && (
        <DraftTraceModal
          material={traceModal.material}
          fittingResult={fittingResults[traceModal.material.id]}
          onClose={() => setTraceModal(null)}
        />
      )}
    </div>
  );
}

function statusToLabel(s: string): string {
  switch (s) {
    case 'pending': return '待处理';
    case 'processed': return '已处理';
    case 'missing': return '缺材料';
    case 'reviewed': return '已复核';
    default: return s;
  }
}
