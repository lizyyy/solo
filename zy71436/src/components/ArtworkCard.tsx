import type { Artwork, Valuation } from '../types';
import { AlertTriangle, Eye, TrendingUp } from 'lucide-react';

interface Props {
  artwork: Artwork;
  valuation: Valuation;
  conflictCount: number;
}

export default function ArtworkCard({ artwork, valuation, conflictCount }: Props) {
  return (
    <div className="bg-[#1e1e30] border border-[#c9a84c]/20 rounded-xl overflow-hidden">
      <div className="relative">
        <img
          src={artwork.imageUrl}
          alt={artwork.name}
          className="w-full h-56 object-cover"
          loading="lazy"
        />
        {conflictCount > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#8b2252]/90 backdrop-blur-sm rounded-full text-xs text-[#f5f0e8] font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {conflictCount}处信息冲突
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#1e1e30] to-transparent" />
      </div>

      <div className="p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#f5f0e8] font-display">{artwork.name}</h2>
          <p className="text-[#c9a84c] text-sm mt-1">{artwork.artist} · {artwork.year}</p>
        </div>

        <p className="text-[#f5f0e8]/70 text-sm leading-relaxed">{artwork.description}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#12121e] rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#c9a84c]">
              <TrendingUp className="w-3.5 h-3.5" />
              估价区间
            </div>
            <p className="text-[#f5f0e8] text-sm font-bold tabular-nums">
              ¥{(valuation.lowEstimate / 10000).toFixed(0)}-{(valuation.highEstimate / 10000).toFixed(0)}万
            </p>
            <p className="text-[#f5f0e8]/40 text-xs">{valuation.source}</p>
          </div>
          <div className="bg-[#12121e] rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#c9a84c]">
              <Eye className="w-3.5 h-3.5" />
              置信度
            </div>
            <p className={`text-sm font-bold ${valuation.confidence >= 0.8 ? 'text-[#2d5a3d]' : valuation.confidence >= 0.7 ? 'text-[#c9a84c]' : 'text-[#8b2252]'}`}>
              {Math.round(valuation.confidence * 100)}%
            </p>
            <p className="text-[#f5f0e8]/40 text-xs">
              {valuation.confidence >= 0.8 ? '高置信度' : valuation.confidence >= 0.7 ? '中等置信度' : '低置信度 · 注意风险'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
