import { AlertOctagon, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { diffAlarmVsRemark } from '@/utils/diff';
import type { DiffSpan } from '@/types/schedule';

interface ComparePanelProps {
  alarm: string;
  remark: string;
}

function renderSpans(spans: DiffSpan[]) {
  return spans.map((s, i) => (
    <span
      key={i}
      className={s.isDiff ? 'diff-underline rounded px-0.5' : ''}
    >
      {s.text}
    </span>
  ));
}

export default function ComparePanel({ alarm, remark }: ComparePanelProps) {
  const [alarmSpans, remarkSpans] = diffAlarmVsRemark(alarm, remark);
  const diffCount = alarmSpans.filter(s => s.isDiff).length + remarkSpans.filter(s => s.isDiff).length;
  const hasDiff = diffCount > 0;

  return (
    <div className="card p-6">
      <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary-600 rounded" />
        报警内容 vs 人工备注对比
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-600">
            <AlertOctagon size={16} />
            系统报警
          </div>
          <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-4 text-sm leading-7 text-slate-700 min-h-[100px]">
            {renderSpans(alarmSpans)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <ClipboardList size={16} />
            人工备注
          </div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-4 text-sm leading-7 text-slate-700 min-h-[100px]">
            {renderSpans(remarkSpans)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        {hasDiff ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 font-medium">
            <AlertTriangle size={14} />
            检测到 {Math.ceil(diffCount / 2)} 处差异，请注意核对
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium">
            <CheckCircle2 size={14} />
            内容一致
          </div>
        )}
      </div>
    </div>
  );
}
