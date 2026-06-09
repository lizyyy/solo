import { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, User, Calendar } from 'lucide-react';
import type { ModelReplaceReason, ChangeHistoryItem, ScheduleStatus } from '@/types/schedule';
import { useScheduleStore } from '@/store/useScheduleStore';

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface PendingReasonBoxProps {
  bizKey: string;
  modelReplace: ModelReplaceReason;
}

export default function PendingReasonBox({ bizKey, modelReplace }: PendingReasonBoxProps) {
  const [confirmed, setConfirmed] = useState(false);
  const versions = useScheduleStore((s) => s.versions);
  const histories = useScheduleStore((s) => s.histories);

  const handleConfirm = () => {
    const aggs = useScheduleStore.getState().aggregates();
    const agg = aggs.find((a) => a.bizKey === bizKey);
    if (!agg) return;

    const targetId = agg.latest.id;
    useScheduleStore.setState((s) => ({
      versions: s.versions.map((v) =>
        v.id === targetId ? { ...v, status: 'confirmed' as ScheduleStatus } : v
      ),
      histories: [
        ...s.histories,
        {
          id: `HIST-CONFIRM-${Date.now()}`,
          scheduleId: targetId,
          changeType: 'confirm',
          timestamp: formatNow(),
          operator: '维保主管-阿敏',
          reason: `型号替换确认：原型号可由 ${modelReplace.newModel} 兼容替代，已现场核对`,
          newRemark: '主管确认通过，允许使用新型号',
        } as ChangeHistoryItem,
      ],
    }));
    setConfirmed(true);
  };

  return (
    <div
      className={`relative rounded-xl p-5 border transition-all duration-300 ${
        confirmed
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
          : 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-300'
      }`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
          confirmed ? 'bg-success' : 'bg-warning'
        }`}
      />

      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            confirmed ? 'bg-green-100 text-success' : 'bg-orange-100 text-warning'
          }`}
        >
          {confirmed ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`text-base font-bold ${
              confirmed ? 'text-green-800' : 'text-orange-800'
            }`}
          >
            {confirmed ? '备件型号替换 — 已确认' : '待确认：备件型号替换'}
          </h3>
          <p className={`text-xs mt-0.5 ${confirmed ? 'text-green-600' : 'text-orange-600'}`}>
            {confirmed
              ? '维保主管已现场核对，新型号兼容可用'
              : '请主管核对兼容性后确认，或要求补充证据'}
          </p>

          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-white/80 border border-slate-200 text-slate-600 font-mono text-xs">
                {modelReplace.oldModel}
              </span>
              <ArrowRight
                size={16}
                className={confirmed ? 'text-green-500' : 'text-orange-500'}
              />
              <span
                className={`px-2 py-1 rounded font-mono text-xs font-semibold ${
                  confirmed
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-orange-100 text-orange-700 border border-orange-200'
                }`}
              >
                {modelReplace.newModel}
              </span>
            </div>

            <div className="bg-white/70 rounded-lg p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">替换原因</div>
              <div className="text-slate-800 leading-relaxed">{modelReplace.reason}</div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <User size={12} />
                {modelReplace.reportedBy}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {modelReplace.reportedAt}
              </span>
            </div>
          </div>

          {!confirmed && (
            <button
              onClick={handleConfirm}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <CheckCircle2 size={16} />
              模拟主管确认通过
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
