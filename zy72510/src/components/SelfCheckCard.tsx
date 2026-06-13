import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { SelfCheckItem } from '../../shared/types';
import { useAppStore } from '@/store/app';

interface SelfCheckCardProps {
  item: SelfCheckItem;
}

const keyLabels: Record<string, string> = {
  dedupe: 'MD5 去重校验',
  lowconf_visible: '低置信度可见性',
  recalc_consistency: '重算一致性',
  export_match: '导出一致性',
};

export default function SelfCheckCard({ item }: SelfCheckCardProps) {
  const navigate = useNavigate();
  const { setCurrentBatchId, setCurrentSampleId, setDrawerOpen } = useAppStore();

  function jumpToSample(sampleId: string) {
    setCurrentSampleId(sampleId);
    setDrawerOpen(true);
    navigate('/review');
  }

  return (
    <div className={`border rounded-sm p-4 ${item.pass ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {item.pass ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : (
            <XCircle size={18} className="text-red-500" />
          )}
          <span className="text-sm font-medium text-white">{keyLabels[item.key] ?? item.key}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-sm font-medium ${
            item.pass
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}
        >
          {item.pass ? '通过' : '未通过'}
        </span>
      </div>
      <p className="text-sm text-slate-300 mb-3 leading-relaxed">{item.reason}</p>
      {item.relatedSampleIds.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">关联样本：</p>
          <div className="flex flex-wrap gap-1.5">
            {item.relatedSampleIds.map((id) => (
              <button
                key={id}
                onClick={() => jumpToSample(id)}
                className="text-xs px-2 py-0.5 rounded-sm bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono transition-colors"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
