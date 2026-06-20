import { X, FileText, Calculator, GitBranch, UserPlus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ScoreNoteTab } from '../trace/ScoreNoteTab';
import { FormulaTab } from '../trace/FormulaTab';
import { ClueTimeline } from '../trace/ClueTimeline';
import { generateClues } from '@/utils/clueGenerator';
import { NoteInput } from '@/components/common/NoteInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'score' as const, label: '评分备注', icon: FileText },
  { id: 'formula' as const, label: '计算口径', icon: Calculator },
  { id: 'clue' as const, label: '线索链', icon: GitBranch },
];

export function TracePanel() {
  const {
    selectedSampleId,
    tracePanelOpen,
    activeTraceTab,
    setTracePanelOpen,
    setActiveTraceTab,
    samples,
    notes,
    getCurrentParamVersion,
    getSampleNotes,
  } = useAppStore();

  const sample = samples.find((s) => s.id === selectedSampleId);
  const currentVersion = getCurrentParamVersion();

  if (!tracePanelOpen || !sample || !currentVersion) {
    return null;
  }

  const sampleNotes = getSampleNotes(sample.id);
  const clues = generateClues(sample, notes, currentVersion);

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-40 h-full w-[480px] transform border-l border-slate-200 bg-[#F8F5F0] shadow-2xl transition-transform duration-300 ease-in-out',
        tracePanelOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                {sample.sampleCode}
              </h2>
              <StatusBadge status={sample.status} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              偏差 {sample.deviation.toFixed(2)}% · 版本 {currentVersion.name}
            </p>
          </div>
          <button
            onClick={() => setTracePanelOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-white">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTraceTab(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeTraceTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTraceTab === 'score' && <ScoreNoteTab sample={sample} />}
          {activeTraceTab === 'formula' && (
            <FormulaTab sample={sample} paramVersion={currentVersion} />
          )}
          {activeTraceTab === 'clue' && <ClueTimeline clues={clues} />}
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
            <UserPlus size={14} />
            <span>追加后补备注</span>
          </div>
          <NoteInput sampleId={sample.id} />
          {sampleNotes.length > 0 && (
            <div className="mt-3 rounded-lg bg-slate-50 p-2">
              <div className="text-xs text-slate-500">
                历史备注 ({sampleNotes.length})：
              </div>
              <div className="mt-1 space-y-1">
                {sampleNotes.slice(-2).map((note) => (
                  <div key={note.id} className="text-xs text-slate-600">
                    <span className="font-medium text-slate-500">[{note.createdAt}]</span>{' '}
                    {note.content.slice(0, 50)}
                    {note.content.length > 50 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
