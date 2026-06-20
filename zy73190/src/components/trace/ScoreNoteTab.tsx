import { FileText, User, Clock } from 'lucide-react';
import type { Sample } from '@/types';
import { highlightKeywords } from '@/utils/clueGenerator';

interface ScoreNoteTabProps {
  sample: Sample;
}

export function ScoreNoteTab({ sample }: ScoreNoteTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-800">原始评分备注</h4>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p
            className="text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: highlightKeywords(sample.scoreNote) }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <User size={12} />
            <span>记录人：小岑</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{sample.createdAt}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-700">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <h4 className="text-sm font-semibold">关键词高亮说明</h4>
        </div>
        <p className="text-xs text-amber-700">
          黄色高亮词汇为系统自动识别的风险关键词，复核时请重点关注这些内容与验算结果的关联。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">样本基本信息</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="样本编号" value={sample.sampleCode} />
          <InfoRow label="参数版本" value={sample.paramVersionId} />
          <InfoRow label="递推序列" value={`[${sample.sequence.join(', ')}]`} mono />
          <InfoRow label="预期值" value={sample.expected.toString()} mono />
          <InfoRow label="计算值" value={sample.actual.toFixed(2)} mono />
          <InfoRow
            label="偏差"
            value={`${sample.deviation.toFixed(2)}%`}
            highlight={sample.deviation > 5}
          />
          <InfoRow label="创建时间" value={sample.createdAt} />
          <InfoRow label="更新时间" value={sample.updatedAt} />
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

function InfoRow({ label, value, mono, highlight }: InfoRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={
          mono
            ? `font-mono text-sm ${highlight ? 'text-red-600 font-semibold' : 'text-slate-700'}`
            : `text-sm ${highlight ? 'text-red-600 font-semibold' : 'text-slate-700'}`
        }
      >
        {value}
      </span>
    </div>
  );
}
