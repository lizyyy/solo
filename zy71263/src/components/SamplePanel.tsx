import { useState } from 'react';
import { samplePacks } from '@/utils/samples';
import { useAppStore } from '@/store/useAppStore';
import DataTag from './DataTag';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function SamplePanel() {
  const selectedSampleId = useAppStore((s) => s.selectedSampleId);
  const loadSample = useAppStore((s) => s.loadSample);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReportId, setShowReportId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-sm text-[#94a3b8]">样例包</span>
      {samplePacks.map((pack) => {
        const isSelected = pack.id === selectedSampleId;
        const isExpanded = expandedId === pack.id;
        const isReportOpen = showReportId === pack.id;

        return (
          <div
            key={pack.id}
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: isSelected ? 'rgba(0,229,199,0.08)' : 'rgba(10,14,39,0.6)',
              border: `1px solid ${
                isSelected ? 'rgba(0,229,199,0.4)' : 'rgba(148,163,184,0.1)'
              }`,
            }}
          >
            <button
              onClick={() => loadSample(pack.id)}
              className="w-full px-3 py-2.5 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-mono"
                  style={{ color: isSelected ? '#00e5c7' : '#e2e8f0' }}
                >
                  {pack.name}
                </span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: '#94a3b8' }}
                >
                  {pack.attitudeModel}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-[#94a3b8]/70 leading-relaxed">
                {pack.description}
              </p>
            </button>

            <div className="px-3 pb-1 flex items-center gap-2">
              <button
                onClick={() => setExpandedId(isExpanded ? null : pack.id)}
                className="flex items-center gap-1 text-[10px] font-mono transition-colors hover:opacity-80"
                style={{ color: '#94a3b8' }}
              >
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {isExpanded ? '收起详情' : '展开详情'}
              </button>
              <span className="text-[#94a3b8]/30">|</span>
              <button
                onClick={() => setShowReportId(isReportOpen ? null : pack.id)}
                className="flex items-center gap-1 text-[10px] font-mono transition-colors hover:opacity-80"
                style={{ color: '#00e5c7' }}
              >
                <FileText size={10} />
                课堂报告
              </button>
            </div>

            {isReportOpen && (
              <div
                className="mx-3 mb-2 rounded px-3 py-2"
                style={{
                  backgroundColor: 'rgba(0,229,199,0.05)',
                  border: '1px solid rgba(0,229,199,0.15)',
                }}
              >
                <p className="text-[10px] font-mono leading-relaxed" style={{ color: '#e2e8f0' }}>
                  {pack.report}
                </p>
              </div>
            )}

            {isExpanded && (
              <div className="px-3 pb-2.5 flex flex-col gap-1">
                {pack.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start gap-2 rounded px-2 py-1.5"
                    style={{
                      backgroundColor:
                        item.tag === 'raw'
                          ? 'rgba(0,229,199,0.03)'
                          : 'rgba(251,191,36,0.03)',
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <DataTag tag={item.tag} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-mono text-[#94a3b8]/80">{item.label}</span>
                      <span
                        className="text-[10px] font-mono break-all"
                        style={{ color: item.tag === 'raw' ? '#00e5c7' : '#fbbf24' }}
                      >
                        {formatValue(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
