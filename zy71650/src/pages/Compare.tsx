import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GitCompare } from 'lucide-react';
import { useAppStore } from '@/store';
import RecordSelector from '@/components/RecordSelector';
import CompareTable from '@/components/CompareTable';
import TrendChart from '@/components/TrendChart';
import CoverageWarning from '@/components/CoverageWarning';

const TABS = [
  { path: '/', label: '工作台' },
  { path: '/detail', label: '数据明细' },
  { path: '/compare', label: '历史对比' },
];

export default function Compare() {
  const location = useLocation();
  const allRecords = useAppStore((s) => s.allRecords);
  const selectedRecordIds = useAppStore((s) => s.selectedRecordIds);
  const compareResult = useAppStore((s) => s.compareResult);
  const fetchRecords = useAppStore((s) => s.fetchRecords);
  const compareRecords = useAppStore((s) => s.compareRecords);
  const setSelectedRecordIds = useAppStore((s) => s.setSelectedRecordIds);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleCompare = () => {
    if (selectedRecordIds.length < 2) return;
    compareRecords(selectedRecordIds);
  };

  const selectedRecords = allRecords.filter((r) => selectedRecordIds.includes(r.id));

  return (
    <div className="min-h-screen bg-synth-bg text-gray-100 font-sans">
      <header className="flex items-center justify-between px-4 h-12 border-b border-synth-border shrink-0">
        <h1 className="font-mono text-sm tracking-widest text-synth-accent">
          ENVELOPE FITTER
        </h1>
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                location.pathname === tab.path
                  ? 'bg-synth-selected text-white'
                  : 'text-synth-muted hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex gap-4 p-4 max-w-7xl mx-auto">
        <aside className="w-72 shrink-0">
          <RecordSelector
            records={allRecords}
            selectedIds={selectedRecordIds}
            onSelectionChange={setSelectedRecordIds}
          />

          <button
            onClick={handleCompare}
            disabled={selectedRecordIds.length < 2}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm bg-synth-accent text-black hover:shadow-glow-green transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <GitCompare className="w-4 h-4" />
            开始对比
          </button>

          {selectedRecordIds.length > 0 && selectedRecordIds.length < 2 && (
            <p className="mt-2 text-center text-[10px] text-synth-amber font-mono">
              需要至少选择 2 条记录
            </p>
          )}
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          {compareResult && (
            <CoverageWarning
              warnings={compareResult.coverageWarnings}
              allRecords={compareResult.records}
            />
          )}

          <CompareTable
            records={compareResult?.records ?? selectedRecords}
            differences={compareResult?.differences ?? []}
          />

          <TrendChart records={compareResult?.records ?? selectedRecords} />
        </main>
      </div>
    </div>
  );
}
