import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HardHat, LayoutDashboard, DatabaseZap, History } from 'lucide-react';
import { Web3DViewer } from '@/components/Web3DViewer';
import { FilterBar } from '@/components/FilterBar';
import { TimelineSlider } from '@/components/TimelineSlider';
import { ChecklistTable } from '@/components/ChecklistTable';
import { SourcePanel } from '@/components/SourcePanel';
import { IssuePanel } from '@/components/IssuePanel';
import { RemarkRerunBar } from '@/components/RemarkRerunBar';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';

export function Checklist() {
  const { batchId } = useParams();
  const nav = useNavigate();
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const setCurrentBatchId = useChecklistStore((s) => s.setCurrentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const viewMode = useUiStore((s) => s.viewMode);

  useEffect(() => {
    if (batchId && batches[batchId] && currentBatchId !== batchId) {
      setCurrentBatchId(batchId);
    }
    if (batchId && !batches[batchId]) {
      nav('/', { replace: true });
    }
  }, [batchId, batches, currentBatchId, setCurrentBatchId, nav]);

  const batch = batchId ? batches[batchId] : null;

  return (
    <div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-slate-100">
      <header
        className="flex items-center justify-between border-b border-blue-900/30 px-5 py-3"
        style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E3A8A 100%)' }}
      >
        <div className="flex items-center gap-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-400/40 bg-blue-500/20">
            <HardHat className="h-4.5 w-4.5" />
          </div>
          <div>
            <Link to="/" className="text-sm font-bold hover:text-blue-200" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              结构加固交底清单
            </Link>
            {batch && (
              <div className="text-[10.5px] text-blue-200">
                {batch.batchId} · {batch.name} · {batch.runType === 'rerun' ? '补备注重跑' : '首次跑'}
              </div>
            )}
          </div>
        </div>
        <nav className="flex items-center gap-1 text-[12px] text-blue-100">
          <Link to="/" className="rounded-md px-3 py-1.5 hover:bg-white/10">
            <LayoutDashboard className="inline h-3.5 w-3.5 mr-1" /> 工作台
          </Link>
          <Link to="/sample" className="rounded-md px-3 py-1.5 hover:bg-white/10">
            <DatabaseZap className="inline h-3.5 w-3.5 mr-1" /> 样例
          </Link>
          <Link to="/history" className="rounded-md px-3 py-1.5 hover:bg-white/10">
            <History className="inline h-3.5 w-3.5 mr-1" /> 历史时间线
          </Link>
        </nav>
      </header>

      <div className="flex-1 overflow-hidden p-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <FilterBar />
          <TimelineSlider />
        </div>

        <div className="grid h-[calc(100%-168px)] grid-cols-1 gap-3 lg:grid-cols-2">
          {viewMode !== 'list' && (
            <div className="min-h-[420px] lg:min-h-0">
              <Web3DViewer />
            </div>
          )}
          {viewMode !== '3d' && (
            <div className="min-h-[460px] lg:min-h-0">
              <ChecklistTable />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="xl:col-span-1 max-h-[380px] overflow-hidden">
            <IssuePanel />
          </div>
          <div className="xl:col-span-1 max-h-[380px] overflow-hidden">
            <SourcePanel />
          </div>
          <div className="xl:col-span-1">
            <RemarkRerunBar />
            {batch && batch.parentBatchId && (
              <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-[11px] text-indigo-700">
                <div className="font-bold">✓ 本批次为「补备注重跑」产物</div>
                <div className="mt-1">
                  父批次：
                  <Link
                    to={`/checklist/${batch.parentBatchId}`}
                    className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-indigo-600 hover:bg-indigo-100"
                  >
                    {batch.parentBatchId}
                  </Link>
                  · 前往【历史时间线】查看前后对照
                </div>
                {batch.remark && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-white/70 p-2 font-mono text-[10.5px] leading-relaxed text-slate-700">
                    {batch.remark}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
