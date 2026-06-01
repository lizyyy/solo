import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useFilteredData, useReviewForSample, useSampleById } from '@/hooks/useFilteredData';
import ReasoningChain from '@/components/ReasoningChain';
import ManualReview from '@/components/ManualReview';
import OldCaliberCard from '@/components/OldCaliberCard';
import ExportPanel from '@/components/ExportPanel';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReasoningChain as ReasoningChainType, HistoricalSample } from '@/types';

export default function Optimize() {
  const { filteredSamples, filteredChains } = useFilteredData();
  const caliberLabel = useStore((s) => s.caliberLabel);
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sampleMap = new Map<string, HistoricalSample>();
  for (const s of filteredSamples) {
    sampleMap.set(s.id, s);
  }

  const needsReview = filteredChains.filter((c) => c.needsManualReview);
  const oldCaliber = filteredChains.filter((c) => {
    const s = sampleMap.get(c.sampleId);
    return s && s.caliberTag !== 'V2-2025';
  });
  const passed = filteredChains.filter(
    (c) => !c.needsManualReview && !oldCaliber.some((oc) => oc.sampleId === c.sampleId)
  );

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function renderChainCard(chain: ReasoningChainType, idx: number) {
    const sample = sampleMap.get(chain.sampleId);
    if (!sample) return null;
    const isExpanded = expandedId === chain.sampleId;

    const levelColors: Record<string, string> = {
      pass: 'border-l-green-500 bg-green-50/30',
      warn: 'border-l-yellow-500 bg-yellow-50/30',
      fail: 'border-l-red-500 bg-red-50/30',
    };

    return (
      <div
        key={chain.sampleId}
        className={`border-l-4 rounded-lg shadow-sm mb-4 overflow-hidden ${levelColors[chain.level] || 'border-l-gray-300'}`}
      >
        <button
          onClick={() => toggleExpand(chain.sampleId)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/60 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm" style={{ color: '#0F4C5C' }}>
                  {sample.lineName} · {sample.date} · {sample.timePeriod}
                </span>
                {sample.caliberTag !== 'V2-2025' && (
                  <span className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-400 text-gray-500 bg-gray-50">
                    旧口径 {sample.caliberTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                建议：{chain.finalSuggestion}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                chain.level === 'pass'
                  ? 'bg-green-100 text-green-700'
                  : chain.level === 'warn'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {chain.level === 'pass' ? '通过' : chain.level === 'warn' ? '需确认' : '越界驳回'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <ReasoningChain chain={chain} sample={sample} />
            {chain.needsManualReview && (
              <ManualReview sampleId={chain.sampleId} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: '#0F4C5C' }} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#0F4C5C' }}>优化判断</h1>
            <p className="text-xs text-gray-500">当前口径：{caliberLabel}</p>
          </div>
        </div>
        <ExportPanel />
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {needsReview.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              需人工确认（{needsReview.length}条）
            </h2>
            <div className="space-y-3">
              {needsReview.map((c, i) => renderChainCard(c, i))}
            </div>
          </section>
        )}

        {oldCaliber.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              历史旧口径（{oldCaliber.length}条）
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {oldCaliber.map((c) => {
                const sample = sampleMap.get(c.sampleId);
                if (!sample) return null;
                return <OldCaliberCard key={c.sampleId} sample={sample} chain={c} />;
              })}
            </div>
          </section>
        )}

        {passed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              通过（{passed.length}条）
            </h2>
            <div className="space-y-3">
              {passed.map((c, i) => renderChainCard(c, i))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
