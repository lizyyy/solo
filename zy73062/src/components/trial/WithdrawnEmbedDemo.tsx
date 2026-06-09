import { Info, CheckCircle2, Ban } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';
import type { ScheduleVersion } from '@/types/schedule';
import { cn } from '@/lib/utils';

function StatusBadge({ status }: { status: ScheduleVersion['status'] }) {
  const config = {
    confirmed: { label: '已确认', cls: 'bg-green-100 text-green-700 border-green-200', Icon: CheckCircle2 },
    pending: { label: '待补证据', cls: 'bg-orange-100 text-orange-700 border-orange-200', Icon: CheckCircle2 },
    withdrawn: { label: '已撤回', cls: 'bg-gray-200 text-gray-600 border-gray-300', Icon: Ban },
    draft: { label: '草稿', cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: CheckCircle2 },
  };
  const { label, cls, Icon } = config[status];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border', cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function WithdrawnEmbedDemo() {
  const trialAggregates = useScheduleStore((s) => s.trialAggregates());
  const trialWithdrawnEmbedVersion = useScheduleStore((s) => s.trialWithdrawnEmbedVersion);

  const normalRecord = trialAggregates.find((a) => a.latest.status === 'confirmed');

  const confirmedCount = trialAggregates.filter((a) => a.latest.status === 'confirmed').length;
  const withdrawnCount = trialAggregates.filter((a) => a.latest.status === 'withdrawn').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-lg font-semibold text-gray-800">真实场景：撤回记录不被挑走</h3>
        <div className="flex items-center gap-1 text-blue-500" title="撤回记录在聚合列表中不计入有效确认数">
          <Info className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {normalRecord && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-200 hover:shadow-sm transition-all">
            <div className="flex items-start gap-3">
              <StatusBadge status={normalRecord.latest.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{normalRecord.latest.pipelineNo}</span>
                  <span className="text-sm text-gray-600">
                    {normalRecord.latest.partName} · {normalRecord.latest.partModel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  {normalRecord.latest.manualRemark || normalRecord.latest.alarmContent}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-xs text-gray-400">v{normalRecord.latest.version}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <StatusBadge status="withdrawn" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 italic line-through text-gray-500">
                <span className="font-semibold">🚫 已撤回：</span>
                <span className="text-sm font-medium">{trialWithdrawnEmbedVersion.pipelineNo}</span>
                <span className="text-sm">
                  {trialWithdrawnEmbedVersion.partName} · {trialWithdrawnEmbedVersion.partModel}
                </span>
              </div>
              <p className="text-xs text-gray-400 italic line-through">
                {trialWithdrawnEmbedVersion.manualRemark || trialWithdrawnEmbedVersion.alarmContent}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-xs text-gray-400 italic">v{trialWithdrawnEmbedVersion.version}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              已确认计数含 {confirmedCount} 条，撤回记录 {withdrawnCount} 条
            </p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>撤回记录不计入确认数</strong> — 挑单逻辑会自动过滤掉 status = withdrawn 的版本
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
