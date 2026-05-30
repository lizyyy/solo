import { useEffect, useState, useCallback } from 'react';
import { Download, X } from 'lucide-react';
import { useAppStore } from '@/store';
import AnomalyFilter from '@/components/AnomalyFilter';
import ThreeLayerTable from '@/components/ThreeLayerTable';
import AuditTimeline from '@/components/AuditTimeline';
import NoteEditor from '@/components/NoteEditor';

const tabs = [
  { key: 'workstation' as const, label: '工作台' },
  { key: 'detail' as const, label: '数据明细' },
  { key: 'compare' as const, label: '历史对比' },
];

function exportCSV(records: ReturnType<typeof useAppStore.getState>['allRecords'], anomalyFilter: string) {
  const filtered = anomalyFilter === 'all'
    ? records
    : records.filter((r) => r.anomalies.some((a) => a.type === anomalyFilter));

  const header = '时间,乐器标签,Attack,Decay,Sustain,Release,异常标记';
  const rows = filtered.map((r) => {
    const anomalyLabels = r.anomalies.map((a) => {
      const map: Record<string, string> = {
        onset_misjudgment: '起音点误判',
        noise_interference: '噪声干扰',
        parameter_out_of_bounds: '参数越界',
      };
      return map[a.type] ?? a.type;
    }).join(';');
    return `${r.createdAt},${r.instrumentLabel},${r.conclusion.attack},${r.conclusion.decay},${r.conclusion.sustain},${r.conclusion.release},${anomalyLabels}`;
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fitting_records_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Detail() {
  const { allRecords, anomalyFilter, setAnomalyFilter, setActiveTab, fetchRecords } = useAppStore();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const selectedRecord = allRecords.find((r) => r.id === selectedRecordId) ?? null;

  const handleSelectRecord = useCallback((id: string) => {
    setSelectedRecordId(id);
  }, []);

  const handleViewAudit = useCallback((id: string) => {
    setSelectedRecordId(id);
    setShowAuditPanel(true);
    setShowNotesPanel(false);
  }, []);

  const handleViewNotes = useCallback((id: string) => {
    setSelectedRecordId(id);
    setShowNotesPanel(true);
    setShowAuditPanel(false);
  }, []);

  return (
    <div className="min-h-screen bg-synth-bg text-gray-100">
      <nav className="border-b border-white/5 bg-synth-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-6">
            <span className="font-mono-display text-sm font-bold tracking-wider text-synth-green">
              SYNTH FITTER
            </span>
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    tab.key === 'detail'
                      ? 'bg-synth-green/10 text-synth-green'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <AnomalyFilter
            currentFilter={anomalyFilter}
            onFilterChange={setAnomalyFilter}
            records={allRecords}
          />
          <button
            onClick={() => exportCSV(allRecords, anomalyFilter)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:border-synth-green/30 hover:text-synth-green transition-colors"
          >
            <Download size={12} />
            导出
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <ThreeLayerTable
              records={allRecords}
              anomalyFilter={anomalyFilter}
              onSelectRecord={handleSelectRecord}
              onViewAudit={handleViewAudit}
              onViewNotes={handleViewNotes}
            />
          </div>

          {(showAuditPanel || showNotesPanel) && selectedRecord && (
            <div className="w-80 shrink-0 space-y-4">
              <div className="rounded-xl border border-white/5 bg-synth-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-gray-200">
                    {showAuditPanel ? '审计记录' : '备注编辑'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAuditPanel(false);
                      setShowNotesPanel(false);
                    }}
                    className="rounded-md p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {showAuditPanel && <AuditTimeline entries={selectedRecord.auditEntries} />}
                  {showNotesPanel && (
                    <NoteEditor recordId={selectedRecord.id} notes={selectedRecord.notes} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
