import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Copy,
  StickyNote,
  UserCheck,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import TraceBreadcrumb from '@/components/TraceBreadcrumb';
import SourceRowsTable from '@/components/SourceRowsTable';
import Timeline from '@/components/Timeline';
import type { TimelineItem } from '@/components/Timeline';
import { cn } from '@/lib/utils';
import type { AnomalyDetailType } from '@/types';

const typeConfig: Record<
  AnomalyDetailType,
  { label: string; icon: typeof Clock; gradient: string; bgLight: string }
> = {
  delayed: {
    label: '晚到数据',
    icon: Clock,
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
  },
  duplicate: {
    label: '采样瓶重复',
    icon: Copy,
    gradient: 'from-rose-500 to-red-600',
    bgLight: 'bg-rose-50',
  },
  remark: {
    label: '临时备注',
    icon: StickyNote,
    gradient: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-50',
  },
};

export default function AnomalyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getAnomalyDetail } = useReportStore();

  const detail = id ? getAnomalyDetail(id) : null;

  if (!detail) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            未找到异常记录
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            该异常记录可能已被删除或不存在
          </p>
          <button
            onClick={() => navigate('/trace')}
            className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回追溯分析页
          </button>
        </div>
      </div>
    );
  }

  const config = typeConfig[detail.type];
  const Icon = config.icon;

  const timelineItems: TimelineItem[] = detail.tracePath.map((step, index) => ({
    id: `step-${step.step}`,
    title: step.name,
    description: step.description,
    time: step.time,
    type: index === detail.tracePath.length - 1 ? 'current' : index === 0 ? 'milestone' : 'normal',
  }));

  const breadcrumbItems = [
    { label: '首页', onClick: () => navigate('/') },
    { label: '追溯分析', onClick: () => navigate('/trace') },
    { label: detail.title, isLast: true },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <TraceBreadcrumb items={breadcrumbItems} />
      </div>

      <button
        onClick={() => navigate('/trace')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回追溯分析
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0',
              config.gradient
            )}
          >
            <Icon className="w-7 h-7 text-white" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-slate-800">{detail.title}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                  config.bgLight,
                  detail.type === 'delayed' && 'text-amber-700',
                  detail.type === 'duplicate' && 'text-rose-700',
                  detail.type === 'remark' && 'text-purple-700'
                )}
              >
                {config.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              从汇总结论一路追溯到具体异常记录的完整路径
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-8">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">变动链路</h3>
            </div>
            <div className="p-5">
              <Timeline items={timelineItems} />
            </div>
          </div>
        </div>

        <div className="col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">人工确认前后对比</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-rose-50/50 rounded-lg border border-rose-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <span className="text-sm font-semibold text-rose-700">
                      确认前
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(detail.beforeData).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between items-start text-sm pb-2 border-b border-rose-100/50 last:border-0 last:pb-0"
                      >
                        <span className="text-rose-600/70 flex-shrink-0 w-24">
                          {key}
                        </span>
                        <span className="text-rose-800 font-medium text-right">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">
                      确认后
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(detail.afterData).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between items-start text-sm pb-2 border-b border-emerald-100/50 last:border-0 last:pb-0"
                      >
                        <span className="text-emerald-600/70 flex-shrink-0 w-24">
                          {key}
                        </span>
                        <span className="text-emerald-800 font-medium text-right">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {detail.manualConfirm && (
            <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="px-5 py-3 border-b border-emerald-200/50 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-700">
                  人工确认信息
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">确认人</p>
                    <p className="text-sm font-medium text-slate-700">
                      {detail.manualConfirm.operator}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">确认时间</p>
                    <p className="text-sm font-medium text-slate-700">
                      {detail.manualConfirm.time}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-white/60 rounded-lg border border-emerald-100">
                  <p className="text-xs text-slate-500 mb-1.5">确认说明</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {detail.manualConfirm.comment}
                  </p>
                </div>
              </div>
            </div>
          )}

          <SourceRowsTable rows={detail.sourceRows} title="来源行追踪" />
        </div>
      </div>
    </div>
  );
}
