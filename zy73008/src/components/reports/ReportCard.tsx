import type { DogRecord } from '@/types';
import { PawPrint, Calendar, CheckCircle2, AlertOctagon, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { statusChipClass } from '@/utils/dataUtils';

interface Props {
  record: DogRecord;
  selected: boolean;
  onClick: () => void;
}

export default function ReportCard({ record, selected, onClick }: Props) {
  const status = record.statusTag;
  const Icon =
    status === 'normal' ? CheckCircle2 :
    status === 'supplement' ? ArrowRightLeft :
    status === 'anomaly' ? AlertTriangle : AlertOctagon;

  const versions = record.versionHistory.length;
  const anomalies = record.versionHistory.filter(h => h.anomaly).length;

  return (
    <div
      onClick={onClick}
      className={`card p-5 cursor-pointer border-2 transition-all animate-fade-in-up ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-300/40 shadow-card-hover scale-[1.01]'
          : 'border-transparent'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white flex items-center justify-center shadow-sm">
            <PawPrint className="w-5 h-5" />
          </div>
          <div>
            <div className="font-serif font-bold text-lg text-brand-800 leading-none">
              {record.current.dogName}
            </div>
            <div className="text-xs text-brand-500 mt-1.5">{record.current.breed} · {record.current.age}</div>
          </div>
        </div>
        <span className={statusChipClass(status)}>
          <Icon className="w-3 h-3" /> {record.statusLabel}
        </span>
      </div>

      <div className="text-xs text-brand-500 space-y-1 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" /> 创建于 {record.createdAt}
        </div>
        <div>{record.caseType}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-lg bg-brand-50/60 py-2">
          <div className="font-mono font-bold text-brand-700 text-base">{versions}</div>
          <div className="text-[10px] text-brand-500 mt-0.5">版本历史</div>
        </div>
        <div className="rounded-lg bg-anomaly-50/60 py-2">
          <div className="font-mono font-bold text-anomaly-600 text-base">{anomalies}</div>
          <div className="text-[10px] text-anomaly-500 mt-0.5">异常标注</div>
        </div>
        <div className="rounded-lg bg-cream-100/60 py-2">
          <div className="font-mono font-bold text-brand-700 text-base">{record.supplements.length}</div>
          <div className="text-[10px] text-brand-500 mt-0.5">补录备注</div>
        </div>
      </div>

      <div className="text-xs pt-3 border-t border-brand-50">
        <div className="flex items-center justify-between">
          <span className="text-brand-500">当前结论</span>
          <span className={`font-semibold ${
            record.currentConclusion === '疫苗合格 可寄养' ? 'text-emerald-600' :
            record.currentConclusion === '待审核' ? 'text-anomaly-500' :
            'text-verdict-600'
          }`}>
            {record.currentConclusion}
          </span>
        </div>
      </div>
    </div>
  );
}
