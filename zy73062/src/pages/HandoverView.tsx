import { useMemo } from 'react';
import {
  Handshake,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Camera,
  FileCheck,
  CircleDot,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useScheduleStore } from '@/store/useScheduleStore';
import { splitForHandover } from '@/utils/dedup';
import type { ScheduleAggregate, EvidenceItem } from '@/types/schedule';
import { cn } from '@/lib/utils';
import LocationGuideCard from '@/components/handover/LocationGuideCard';

function EvidenceDot({ type, confirmed }: { type: EvidenceItem['type']; confirmed: boolean }) {
  const config = {
    photo: { label: '现场照片', Icon: Camera },
    doc: { label: '文档说明', Icon: FileText },
    report: { label: '检测报告', Icon: FileCheck },
  };
  const { label, Icon } = config[type];
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border',
      confirmed
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-orange-50 text-orange-700 border-orange-200'
    )}>
      {confirmed ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <CircleDot className="w-3 h-3" />
      )}
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

function ConfirmedCard({ agg }: { agg: ScheduleAggregate }) {
  const confirmedEvidences = agg.evidences.filter((e) => e.confirmed);
  const confirmedCount = confirmedEvidences.length;

  return (
    <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-bold text-green-700">{agg.latest.pipelineNo}</span>
            <span className="text-sm text-gray-700">
              {agg.latest.partName} · {agg.latest.partModel}
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">
            {agg.latest.manualRemark || agg.latest.alarmContent}
          </p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {agg.latest.planDate}
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {agg.latest.submitter}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
          v{agg.latest.version}
        </span>
      </div>

      {confirmedCount > 0 && (
        <div className="pt-3 border-t border-green-100">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium text-green-700">
              已确认证据 × {confirmedCount}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {confirmedEvidences.slice(0, 3).map((evi) => (
              <EvidenceDot key={evi.id} type={evi.type} confirmed={true} />
            ))}
            {confirmedCount === 0 && (
              <span className="text-xs text-green-600 italic">系统自动核验通过</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingCard({ agg }: { agg: ScheduleAggregate }) {
  const allEvidences = agg.evidences;
  const missingEvidenceReasons: { label: string; type: EvidenceItem['type'] }[] = [];

  if (agg.latest.status === 'draft') {
    missingEvidenceReasons.push({ label: '尚未正式提交，需补充基本信息', type: 'doc' });
  }
  if (allEvidences.filter((e) => e.type === 'photo').length === 0) {
    missingEvidenceReasons.push({ label: '缺少现场照片', type: 'photo' });
  }
  if (allEvidences.filter((e) => e.type === 'report').length === 0 && agg.latest.status !== 'draft') {
    missingEvidenceReasons.push({ label: '缺少检测报告', type: 'report' });
  }
  if (allEvidences.filter((e) => !e.confirmed).length > 0) {
    missingEvidenceReasons.push({ label: '部分证据待审核确认', type: 'doc' });
  }
  if (missingEvidenceReasons.length === 0 && agg.latest.status === 'pending') {
    missingEvidenceReasons.push({ label: '等待主管最终审批', type: 'report' });
  }

  return (
    <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm font-bold text-orange-700">{agg.latest.pipelineNo}</span>
                <span className="text-sm text-gray-700">
                  {agg.latest.partName} · {agg.latest.partModel}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">
                {agg.latest.manualRemark || agg.latest.alarmContent}
              </p>
            </div>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {agg.latest.planDate}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {agg.latest.submitter}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              v{agg.latest.version}
            </span>
          </div>

          <div className="pt-2 border-t border-orange-100">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-xs font-medium text-orange-700">
                需补充证据 ({missingEvidenceReasons.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingEvidenceReasons.map((item, idx) => (
                <EvidenceDot key={idx} type={item.type} confirmed={false} />
              ))}
            </div>
            {allEvidences.filter((e) => e.type === 'photo' || e.type === 'report').length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 pt-1.5 border-t border-orange-50">
                {allEvidences.map((evi) => (
                  <EvidenceDot key={evi.id} type={evi.type} confirmed={evi.confirmed} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden sm:block w-[180px] flex-shrink-0">
          <LocationGuideCard partModel={agg.latest.partModel} compact />
        </div>
      </div>

      <div className="sm:hidden mt-3 pt-3 border-t border-orange-100">
        <LocationGuideCard partModel={agg.latest.partModel} compact />
      </div>
    </div>
  );
}

export default function HandoverView() {
  const aggregates = useScheduleStore((s) => s.aggregates());
  const split = useMemo(() => splitForHandover(aggregates), [aggregates]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Handshake className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">工作交接视图</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                按已确认/待补证据分区，接手同事无需再问材料放哪
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-green-800 text-lg">✅ 已确认（可执行）</h2>
                  <p className="text-xs text-green-600">信息完整，可直接安排领料</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white text-lg font-bold shadow-sm">
                {split.confirmed.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
              {split.confirmed.length === 0 && (
                <div className="py-12 text-center text-green-600/60">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无已确认记录</p>
                </div>
              )}
              {split.confirmed.map((agg) => (
                <ConfirmedCard key={agg.bizKey} agg={agg} />
              ))}
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-orange-800 text-lg">⚠️ 待补证据</h2>
                  <p className="text-xs text-orange-600">需补充材料后才能执行</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 text-white text-lg font-bold shadow-sm">
                {split.pending.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
              {split.pending.length === 0 && (
                <div className="py-12 text-center text-orange-600/60">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">全部确认完成 🎉</p>
                </div>
              )}
              {split.pending.map((agg) => (
                <PendingCard key={agg.bizKey} agg={agg} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
