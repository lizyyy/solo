import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useMainStore } from '@/store/mainStore';
import RiskCard from './RiskCard';
import type { RiskType } from '@/types';

const RISK_TYPE_FILTERS: { type: RiskType | 'all'; label: string; color: string }[] = [
  { type: 'all', label: '全部', color: '#C9A962' },
  { type: 'over_illumination', label: '照度超标', color: '#E5484D' },
  { type: 'cumulative_leak', label: '累计漏光', color: '#F2994A' },
  { type: 'light_penetration', label: '光线穿透', color: '#9B51E0' },
];

export default function RiskBar() {
  const risks = useMainStore((state) => state.risks);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<RiskType | 'all'>('all');

  const filteredRisks = activeFilter === 'all'
    ? risks
    : risks.filter((r) => r.type === activeFilter);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const criticalCount = risks.filter((r) => r.severity === 'critical' || r.severity === 'high').length;
  const unresolvedCount = risks.filter((r) => r.status !== 'resolved').length;

  return (
    <div className="bg-[#121418] border-t border-[#2A2D34]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2A2D34]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#E5484D]" />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: "'Noto Serif SC', serif", color: '#C9A962' }}
            >
              风险监测
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-[#8B8D93]">
              共 <span className="text-[#C9A962]">{risks.length}</span> 项
            </span>
            {unresolvedCount > 0 && (
              <span className="text-[#8B8D93]">
                待处理 <span className="text-[#E5484D]">{unresolvedCount}</span>
              </span>
            )}
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#E5484D]/20 text-[#E5484D]">
                高风险 {criticalCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {RISK_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.type}
              onClick={() => setActiveFilter(filter.type)}
              className={cn(
                'px-3 py-1 text-xs rounded-md font-mono transition-all duration-200',
                activeFilter === filter.type
                  ? 'bg-[#1A1D24] border border-current'
                  : 'text-[#8B8D93] hover:text-[#B0B2B8] hover:bg-[#16181D]'
              )}
              style={{ color: activeFilter === filter.type ? filter.color : undefined }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 p-2 bg-gradient-to-r from-[#121418] to-transparent text-[#8B8D93] hover:text-[#C9A962] transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 px-10 py-4 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredRisks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-4 text-[#5A5D63] text-sm font-mono">
              暂无风险数据
            </div>
          ) : (
            filteredRisks.map((risk) => (
              <div key={risk.id} className="flex-shrink-0 w-80">
                <RiskCard risk={risk} />
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 p-2 bg-gradient-to-l from-[#121418] to-transparent text-[#8B8D93] hover:text-[#C9A962] transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
