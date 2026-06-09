import { useEffect, useMemo, useState, useRef } from 'react';
import type { Filters, ResultBundle, VersionedState } from './types';
import { buildResultBundle, buildBatchSignature } from './dataService';
import {
  loadState,
  saveState,
  snapshotFromBundle,
  pushSnapshot,
  upsertNote,
  upsertSummary,
  getSummary,
  getNote,
} from './storage';
import FilterBar from './components/FilterBar';
import StatsCards from './components/StatsCards';
import RecordTable from './components/RecordTable';
import ConclusionPanel from './components/ConclusionPanel';
import SummaryPanel from './components/SummaryPanel';

const DEFAULT_FILTERS: Filters = {
  dateFrom: '2026-06-01',
  dateTo: '2026-06-09',
  craneIds: [],
  categories: [],
  statuses: [],
  onlyAnomaly: false,
};

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [state, setState] = useState<VersionedState>(() => loadState());
  const [bundle, setBundle] = useState<ResultBundle | null>(null);
  const [running, setRunning] = useState(false);
  const [hlRec, setHlRec] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!bundle) return;
    const sig = buildBatchSignature(bundle.filters);
    if (!getSummary(state, bundle.filters)) {
      setState((s) => upsertSummary(s, bundle.filters, bundle.pageSummary, bundle.generatedAt));
    }
  }, [bundle?.batchId]);

  const runBundle = (f: Filters = filters) => {
    setRunning(true);
    setTimeout(() => {
      const b = buildResultBundle(f);
      setBundle(b);
      setState((s) => pushSnapshot(s, snapshotFromBundle(b)));
      setFilters(f);
      setRunning(false);
    }, 120);
  };

  useEffect(() => {
    runBundle(DEFAULT_FILTERS);
  }, []);

  const handleNoteChange = (recordId: string, content: string) => {
    setState((s) => upsertNote(s, recordId, content, bundle?.batchId));
  };

  const handleSummarySave = (content: string) => {
    if (!bundle) return;
    setState((s) => upsertSummary(s, bundle.filters, content, bundle.generatedAt));
  };

  const drillToRecord = (recordId: string) => {
    setHlRec(recordId);
    setTimeout(() => setHlRec(null), 2400);
    const el = document.querySelector(`[data-rec-id="${recordId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const restoreSnapshot = (id: string) => {
    const snap = state.snapshots.find((s) => s.id === id);
    if (!snap) return;
    setFilters(snap.filters);
    runBundle(snap.filters);
  };

  const currentSummary = bundle ? getSummary(state, bundle.filters) : undefined;
  const notesByRecord = state.notes;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>塔吊维保备件排程</h1>
          <p className="subtitle">
            同一结果集驱动筛选 / 统计 / 明细 / 摘要 · 异常单独拎出 · 线索可追溯 · 重跑不丢备注
          </p>
        </div>
        {bundle && (
          <div className="batch-tag">
            批次 <code>{bundle.batchId}</code> · 生成于{' '}
            {new Date(bundle.generatedAt).toLocaleString('zh-CN', { hour12: false })}
          </div>
        )}
      </header>

      <FilterBar filters={filters} onChange={setFilters} onRun={() => runBundle()} running={running} />

      {bundle && (
        <>
          <SummaryPanel
            autoSummary={bundle.pageSummary}
            persisted={currentSummary}
            onSave={handleSummarySave}
            snapshots={state.snapshots}
            onRestore={restoreSnapshot}
          />
          <StatsCards bundle={bundle} />
          <ConclusionPanel
            conclusions={bundle.conclusions}
            anomalies={bundle.anomalies}
            records={bundle.records}
            onDrillToRecord={drillToRecord}
          />
          <div ref={tableRef}>
            <RecordTable
              records={bundle.records}
              anomalies={bundle.anomalies}
              conclusions={bundle.conclusions}
              notes={notesByRecord}
              onNoteChange={handleNoteChange}
              highlightRecordId={hlRec}
            />
          </div>
        </>
      )}

      <footer className="app-footer">
        <span className="muted">
          💡 坏材料来了先看：<strong>页面摘要</strong> → <strong>异常单独拎出</strong> → 点结论里的关联记录 → 展开行看<strong>异常证据</strong> &amp; <strong>结论变化说明</strong>
        </span>
      </footer>
    </div>
  );
}
