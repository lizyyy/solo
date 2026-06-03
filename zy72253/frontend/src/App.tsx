import React, { useState, useCallback } from 'react';
import ImportPanel from './components/ImportPanel';
import RecordList from './components/RecordList';
import RecordDetail from './components/RecordDetail';
import View3D from './components/View3D';
import ViewChart from './components/ViewChart';
import { listRecords, RecordListItem } from './utils/api';

type ViewMode = 'list' | '3d' | 'chart';

interface ContainerBox {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  coordType: string;
  needsReview: boolean;
  recordId: string;
}

const COLORS = ['#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];

export default function App() {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [containers3D, setContainers3D] = useState<ContainerBox[]>([]);
  const [chartData, setChartData] = useState<{ id: string; coordType: string; needsReview: boolean; distance: number | null; recordId: string }[]>([]);

  const handleImported = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSelectRecord = useCallback((id: string) => {
    setSelectedRecordId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRecordId(null);
  }, []);

  const loadVisualizationData = useCallback(async () => {
    const records: RecordListItem[] = await listRecords();
    const boxes: ContainerBox[] = records.map((r, i) => ({
      id: r.id,
      position: [
        (i % 8) * 2.5 - 8,
        1,
        Math.floor(i / 8) * 2.5 - 8,
      ] as [number, number, number],
      size: [2, 2, 2] as [number, number, number],
      color: COLORS[i % COLORS.length],
      coordType: r.coord_type,
      needsReview: r.needs_review,
      recordId: r.id,
    }));
    setContainers3D(boxes);
    setChartData(
      records.map((r) => ({
        id: r.id.slice(0, 8),
        coordType: r.coord_type,
        needsReview: r.needs_review,
        distance: r.distance,
        recordId: r.id,
      }))
    );
  }, []);

  const switchView = useCallback(async (mode: ViewMode) => {
    if (mode !== 'list') {
      await loadVisualizationData();
    }
    setViewMode(mode);
  }, [loadVisualizationData]);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ background: '#1e293b', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>港口堆场箱位回放</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['list', '3d', 'chart'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchView(m)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === m ? '#3b82f6' : '#334155',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {m === 'list' ? '列表' : m === '3d' ? '3D' : '图表'}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        {selectedRecordId ? (
          <RecordDetail recordId={selectedRecordId} onBack={handleBack} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ImportPanel onImported={handleImported} />

            {viewMode === 'list' && (
              <RecordList onSelectRecord={handleSelectRecord} refreshKey={refreshKey} />
            )}
            {viewMode === '3d' && (
              <View3D containers={containers3D} onClickContainer={handleSelectRecord} />
            )}
            {viewMode === 'chart' && (
              <ViewChart data={chartData} onClickBar={handleSelectRecord} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
