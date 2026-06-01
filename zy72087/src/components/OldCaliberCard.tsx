import type { HistoricalSample, ReasoningChain } from '@/types';
import { Archive } from 'lucide-react';

interface OldCaliberCardProps {
  sample: HistoricalSample;
  chain: ReasoningChain;
}

export default function OldCaliberCard({ sample, chain }: OldCaliberCardProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-dashed border-gray-400 text-gray-500 bg-gray-100">
          旧口径
        </span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
        <span>来源：{sample.source}</span>
        <span>口径：{sample.caliberTag}</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        该记录来自旧数据标准（{sample.caliberTag}），与当前主口径 V2-2025 存在口径差异，结论仅供参考。
      </p>

      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-medium text-gray-400">参考建议</span>
        </div>
        <p className="text-sm font-semibold text-gray-600">{chain.finalSuggestion}</p>
        <p className="text-xs text-gray-400 mt-1">{chain.suggestionReason}</p>
      </div>

      <p className="text-xs text-gray-300 mt-3 text-right">
        原始数据时间：{sample.date}
      </p>
    </div>
  );
}
