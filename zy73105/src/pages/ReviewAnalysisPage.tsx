import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Layers3, GitBranch, History, ChevronRight, Building2 } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import { formatDate, hasLateAttachment, hasLayerIssue, STATUS_LABEL } from '../utils/statusMappings';
import { StatusBadge } from '../components/StatusBadge';
import { CausalTimeline } from '../components/CausalTimeline';
import { AttachmentList } from '../components/AttachmentList';
import { LayerIssueTable } from '../components/LayerIssueTable';
import { ConclusionEditor } from '../components/ConclusionEditor';
import { HistoryTimeline } from '../components/HistoryTimeline';

export function ReviewAnalysisPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { getById, updateConclusion } = useReviewStore();
  const r = getById(id);

  if (!r) {
    return (
      <div className="card p-12 text-center">
        <div className="text-lg font-semibold text-slate-700">找不到复核记录</div>
        <div className="mt-2 text-sm text-slate-500">编号 {id} 不存在</div>
        <button onClick={() => navigate('/')} className="btn btn-secondary mt-6">
          返回送审表
        </button>
      </div>
    );
  }

  const late = hasLateAttachment(r.attachments);
  const layer = hasLayerIssue(r.layerIssues);
  const lateCount = r.attachments.filter((a) => a.isLate).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="btn btn-secondary !px-3"
        >
          <ArrowLeft size={14} />
          返回送审表
        </button>
        <nav className="flex items-center gap-1 text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-900">材料送审表</Link>
          <ChevronRight size={12} />
          <span className="text-slate-800 font-medium">分析页 · {r.id}</span>
        </nav>
      </div>

      <div className={`card overflow-hidden ${late && layer ? 'ring-2 ring-offset-1 ring-pink-300/60' : late ? 'ring-2 ring-offset-1 ring-orange-300/60' : layer ? 'ring-2 ring-offset-1 ring-pink-200/60' : ''}`}>
        <div className="card-header flex-wrap gap-4 border-b-0 !pb-0">
          <div className="flex items-start gap-4 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 text-white shadow-inner-border">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-xs font-semibold rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                  {r.id}
                </span>
                <span className="mono text-xs font-medium text-slate-500">{r.drawingNo}</span>
                {late && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-late-bg border border-status-late/30 px-2.5 py-0.5 text-[11px] font-bold text-status-late animate-pulse-subtle">
                    <FileText size={11} />
                    含 {lateCount} 份晚到附件
                  </span>
                )}
                {layer && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-layer-bg border border-status-layer/30 px-2.5 py-0.5 text-[11px] font-bold text-status-layer">
                    <Layers3 size={11} />
                    {r.layerIssues.length} 处图层命名异常
                  </span>
                )}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 tracking-tight">
                {r.projectName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>
                  送审：<span className="mono font-medium text-slate-700">{formatDate(r.submissionDate)}</span>
                </span>
                <span>
                  复核：<span className="mono font-medium text-slate-700">{formatDate(r.reviewDate)}</span>
                </span>
                <span>
                  复核人：<span className="font-semibold text-slate-700">{r.reviewer}</span>
                </span>
                <span>
                  附件：<span className="mono font-semibold text-slate-700">{r.attachments.length}</span> 份
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase font-semibold tracking-wide text-slate-400">当前结论</div>
              <div className="mt-1">
                <StatusBadge status={r.conclusionStatus} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          <div className="rounded-lg border-l-4 border-slate-900/60 bg-slate-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              当前书面意见
            </div>
            <div className="text-sm leading-relaxed text-slate-800">
              {r.currentOpinion || '—'}
            </div>
          </div>
        </div>
      </div>

      <ConclusionEditor
        reviewId={r.id}
        currentStatus={r.conclusionStatus}
        onSubmit={(newStatus, reason) => updateConclusion(r.id, newStatus, reason)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-slate-600" />
              <div className="font-semibold text-slate-800">因果链 · 晚到附件为何影响结论</div>
            </div>
            <span className="text-[11px] text-slate-400">{r.causalChain.length} 步</span>
          </div>
          <div className="card-body">
            <CausalTimeline steps={r.causalChain} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-600" />
              <div className="font-semibold text-slate-800">附件清单 · 晚到件高亮说明</div>
            </div>
            <span className="text-[11px] text-slate-400">共 {r.attachments.length} 份</span>
          </div>
          <div className="card-body">
            <AttachmentList attachments={r.attachments} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Layers3 size={16} className="text-status-layer" />
            <div className="font-semibold text-slate-800">图层命名异常处理</div>
            {r.layerIssues.length > 0 && (
              <span className="rounded-full bg-status-layer/15 px-2 py-0.5 text-[11px] font-bold text-status-layer">
                共 {r.layerIssues.length} 处 · 说明待确认原因和处理去向
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          <LayerIssueTable issues={r.layerIssues} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-600" />
            <div className="font-semibold text-slate-800">结论修改历史 · 老叶当日改过的痕迹可翻</div>
          </div>
          <span className="text-[11px] text-slate-400">{r.history.length} 条修改</span>
        </div>
        <div className="card-body">
          {r.history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
              本记录暂无修改历史 · 可在上方「修改结论」区试改一次，结论会出现在这里。
            </div>
          ) : (
            <HistoryTimeline
              items={r.history.map((h) => ({ ...h, reviewId: r.id, projectName: r.projectName }))}
              highlightToday
            />
          )}
        </div>
      </div>
    </div>
  );
}
