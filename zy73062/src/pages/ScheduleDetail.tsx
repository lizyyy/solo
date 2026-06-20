import { useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Home, ChevronRight, Paperclip, Image, FileText, BarChart3, CheckCircle2, AlertTriangle, Wrench, CalendarDays, UserCircle2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import StatusBadge from '@/components/common/StatusBadge';
import ComparePanel from '@/components/detail/ComparePanel';
import PendingReasonBox from '@/components/detail/PendingReasonBox';
import ChangeTimeline from '@/components/detail/ChangeTimeline';
import { useScheduleStore } from '@/store/useScheduleStore';
import { dedupAndAggregate } from '@/utils/dedup';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const evidenceIconMap = {
  photo: Image,
  doc: FileText,
  report: BarChart3,
};

export default function ScheduleDetail() {
  const { bizKey: rawBizKey } = useParams<{ bizKey: string }>();
  const bizKey = useMemo(() => rawBizKey ? decodeURIComponent(rawBizKey) : '', [rawBizKey]);

  const setSelectedBizKey = useScheduleStore((s) => s.setSelectedBizKey);

  const agg = useScheduleStore((s) => {
    if (!bizKey) return null;
    return dedupAndAggregate(s.versions, s.histories, s.evidences).find((a) => a.bizKey === bizKey) || null;
  });

  useEffect(() => {
    if (bizKey) setSelectedBizKey(bizKey);
  }, [bizKey, setSelectedBizKey]);

  if (!agg) {
    return (
      <AppLayout>
        <div className="card p-16 text-center">
          <Home size={48} className="mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">未找到该排程记录</h2>
          <p className="text-sm text-slate-500 mb-6">业务主键可能已变更或不存在</p>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft size={16} />
            返回排程列表
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { latest, versions, changeHistory, evidences, withdrawnCount } = agg;
  const latestStatus = latest.status;
  const hasModelReplace = !!latest.modelReplace && latestStatus === 'pending';

  const confirmedCount = evidences.filter((e) => e.confirmed).length;
  const pendingEvidenceCount = evidences.length - confirmedCount;

  return (
    <AppLayout>
      <nav className="flex items-center gap-1.5 text-sm mb-4 text-slate-500">
        <Link to="/schedule" className="hover:text-primary-600 transition-colors inline-flex items-center gap-1">
          <ArrowLeft size={14} />
          排程列表
        </Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-700 font-medium truncate">
          {latest.pipelineNo} · {latest.partName}
        </span>
      </nav>

      <div className="card p-6 mb-6 bg-gradient-to-r from-white via-blue-50/40 to-indigo-50/40 border-blue-100">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={latestStatus} size="md" />
              {versions.length > 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                  v{versions[0].version}–v{versions[versions.length - 1].version} 共 {versions.length} 个版本
                </span>
              )}
              {withdrawnCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                  含 {withdrawnCount} 条撤回
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {latest.pipelineNo}
              <span className="mx-2 text-slate-300 font-normal">|</span>
              {latest.partName}
              <span className="ml-2 text-lg text-slate-500 font-mono font-normal">
                {latest.partModel}
              </span>
            </h1>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <CalendarDays size={12} />
                计划更换
              </div>
              <div className="font-mono text-slate-800 font-semibold">{latest.planDate}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <UserCircle2 size={12} />
                提交人
              </div>
              <div className="text-slate-800 font-semibold">{latest.submitter}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Wrench size={12} />
                提交时间
              </div>
              <div className="font-mono text-slate-800">{formatDate(latest.submittedAt)}</div>
            </div>
          </div>
        </div>

        {evidences.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-200/60">
            <h4 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <Paperclip size={14} />
              证据材料
              <span className="text-slate-400 font-normal">
                （已确认 {confirmedCount}/{evidences.length}
                {pendingEvidenceCount > 0 && (
                  <span className="text-warning ml-1">· {pendingEvidenceCount} 项待补证据</span>
                )}
                ）
              </span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {evidences.map((ev) => {
                const Ic = evidenceIconMap[ev.type];
                return (
                  <div
                    key={ev.id}
                    className={cn(
                      'relative rounded-lg border p-3 text-xs transition-all duration-200 hover:shadow-md',
                      ev.confirmed
                        ? 'bg-green-50/60 border-green-200'
                        : 'bg-orange-50/60 border-orange-200'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                          ev.confirmed ? 'bg-green-100 text-success' : 'bg-orange-100 text-warning'
                        )}
                      >
                        <Ic size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{ev.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {ev.location}
                        </div>
                        <div className="mt-1.5">
                          {ev.confirmed ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 font-medium">
                              <CheckCircle2 size={10} />
                              已确认
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-700 font-medium">
                              <AlertTriangle size={10} />
                              待补
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2">
          <ComparePanel alarm={latest.alarmContent} remark={latest.manualRemark} />
        </div>
        <div>
          {hasModelReplace && latest.modelReplace ? (
            <PendingReasonBox bizKey={agg.bizKey} modelReplace={latest.modelReplace} />
          ) : (
            <div className="card p-6 h-full flex flex-col items-center justify-center text-center text-sm">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl mb-3 flex items-center justify-center',
                  latestStatus === 'confirmed'
                    ? 'bg-green-100 text-success'
                    : latestStatus === 'withdrawn'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-blue-100 text-primary-600'
                )}
              >
                {latestStatus === 'confirmed' ? (
                  <CheckCircle2 size={28} />
                ) : latestStatus === 'withdrawn' ? (
                  <AlertTriangle size={28} />
                ) : (
                  <Paperclip size={28} />
                )}
              </div>
              <div className="font-bold text-slate-800 mb-1">
                {latestStatus === 'confirmed' && '无需型号替换确认'}
                {latestStatus === 'pending' && '待确认：补充证据'}
                {latestStatus === 'withdrawn' && '该排程已撤回'}
                {latestStatus === 'draft' && '排程草稿状态'}
              </div>
              <p className="text-slate-500 leading-relaxed max-w-xs">
                {latestStatus === 'confirmed' && '备件型号与系统一致，主管已确认通过'}
                {latestStatus === 'pending' && '请巡检员补充现场照片或检测报告等证据'}
                {latestStatus === 'withdrawn' && '提交人或主管标记此记录为无效，已归档保留'}
                {latestStatus === 'draft' && '尚未提交审核，可在排程列表中继续编辑或提交'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ChangeTimeline items={changeHistory} />
    </AppLayout>
  );
}
