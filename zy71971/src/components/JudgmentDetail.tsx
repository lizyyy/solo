import type { QARecord } from '@/types';
import { REVIEW_TYPE_LABELS } from '@/types';
import { Link2Off, AlertTriangle, ShieldOff } from 'lucide-react';

export default function JudgmentDetail({ record }: { record: QARecord }) {
  return (
    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-[#2a3548]">
      <SourceColumn record={record} />
      <GrayColumn record={record} />
      <SensitiveColumn record={record} />
    </div>
  );
}

function SourceColumn({ record }: { record: QARecord }) {
  return (
    <div className={`rounded-lg p-3 ${record.isSourceBroken ? 'bg-rose-400/5 border border-rose-400/20' : 'bg-[#1e2a3a]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Link2Off className={`w-4 h-4 ${record.isSourceBroken ? 'text-rose-400' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-300">来源链路</span>
        {record.isSourceBroken && (
          <span className="text-[10px] px-1.5 py-0.5 bg-rose-400/20 text-rose-400 rounded">{REVIEW_TYPE_LABELS.source_broken}</span>
        )}
      </div>
      <p className={`text-xs leading-relaxed ${record.isSourceBroken ? 'text-rose-300' : 'text-gray-500'}`}>
        {record.isSourceBroken ? '来源链接无效或为空，无法验证出处' : '来源链路正常，文档可访问'}
      </p>
    </div>
  );
}

function GrayColumn({ record }: { record: QARecord }) {
  return (
    <div className={`rounded-lg p-3 ${record.isGrayConflict ? 'bg-amber-400/5 border border-amber-400/20' : 'bg-[#1e2a3a]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className={`w-4 h-4 ${record.isGrayConflict ? 'text-amber-400' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-300">灰度对比</span>
        {record.isGrayConflict && (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/20 text-amber-400 rounded">{REVIEW_TYPE_LABELS.gray_conflict}</span>
        )}
      </div>
      {record.isGrayConflict ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 w-10">灰度:</span>
            <span className="text-amber-300">{record.grayConclusion}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 w-10">报表:</span>
            <span className="text-blue-300">{record.reportConclusion}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">灰度结论与报表一致</p>
      )}
    </div>
  );
}

function SensitiveColumn({ record }: { record: QARecord }) {
  return (
    <div className={`rounded-lg p-3 ${record.isSensitiveLeak ? 'bg-rose-400/5 border border-rose-400/20' : 'bg-[#1e2a3a]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldOff className={`w-4 h-4 ${record.isSensitiveLeak ? 'text-rose-400' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-300">敏感词检测</span>
        {record.isSensitiveLeak && (
          <span className="text-[10px] px-1.5 py-0.5 bg-rose-400/20 text-rose-400 rounded">{REVIEW_TYPE_LABELS.sensitive_leak}</span>
        )}
      </div>
      {record.isSensitiveLeak ? (
        <div className="flex flex-wrap gap-1">
          {record.sensitiveWordsFound.map((w) => (
            <span key={w} className="text-[10px] px-1.5 py-0.5 bg-rose-400/15 text-rose-300 rounded border border-rose-400/20">{w}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">未检出敏感词漏脱敏</p>
      )}
    </div>
  );
}
