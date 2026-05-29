import { useState } from 'react';
import type { StudentWork } from '../../types';
import { usePortfolioStore, useHasAnomalyWorks } from '../../store/usePortfolioStore';
import { Star, Check, AlertTriangle, FileWarning, Copy, Eye, Paperclip } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';

interface WorkCardProps {
  work: StudentWork;
  index: number;
}

export default function WorkCard({ work, index }: WorkCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isSelected = usePortfolioStore(s => s.selectedWorkIds.includes(work.id));
  const toggleSelection = usePortfolioStore(s => s.toggleWorkSelection);
  const hasAnomaly = useHasAnomalyWorks(work.id);

  const completionStars = Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={cn(
        'w-3 h-3',
        i < work.completion ? 'text-amber-400 fill-amber-400' : 'text-charcoal-500'
      )}
    />
  ));

  return (
    <div
      className={cn(
        'glass-card card-hover rounded-xl overflow-hidden group',
        'opacity-0 animate-fadeInUp',
        isSelected && 'ring-2 ring-ochre-500/50 ring-offset-2 ring-offset-charcoal-800',
        hasAnomaly && 'animate-pulseSoft'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden cursor-pointer"
        onClick={() => toggleSelection(work.id)}
      >
        <img
          src={work.thumbnail}
          alt={work.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/20 to-transparent" />
        
        <div className="absolute top-3 left-3 flex gap-2">
          {hasAnomaly && (
            <div className="px-2 py-1 rounded-md bg-terracotta-500/90 backdrop-blur-sm flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-white" />
              <span className="text-xs font-medium text-white">异常</span>
            </div>
          )}
          {!work.copyright.hasClearance && (
            <div className="px-2 py-1 rounded-md bg-orange-500/90 backdrop-blur-sm flex items-center gap-1">
              <FileWarning className="w-3 h-3 text-white" />
              <span className="text-xs font-medium text-white">版权待确认</span>
            </div>
          )}
        </div>

        <div className="absolute top-3 right-3">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all',
              isSelected
                ? 'bg-ochre-500 text-white scale-100'
                : 'bg-charcoal-900/60 text-cream-400/0 group-hover:text-cream-400/60 scale-90 group-hover:scale-100'
            )}
          >
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="font-display text-base font-semibold text-cream-100 line-clamp-1">
            {work.title}
          </h4>
          <p className="text-xs text-cream-400/80 mt-0.5">{work.studentName}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-0.5">{completionStars}</div>
          <span className="text-xs text-cream-400/60">{formatDate(work.createdAt)}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {work.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-charcoal-700/60 text-cream-300"
            >
              {tag}
            </span>
          ))}
          {work.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-charcoal-700/60 text-cream-400/60">
              +{work.tags.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-cream-400/80 hover:text-ochre-400 transition-colors rounded-lg hover:bg-charcoal-700/50"
          >
            <Eye className="w-3.5 h-3.5" />
            详情
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(work.id);
            }}
            className="flex items-center justify-center w-8 h-8 text-xs text-cream-400/80 hover:text-ochre-400 transition-colors rounded-lg hover:bg-charcoal-700/50"
            title="复制作品ID"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-white/5 animate-slideIn">
            <p className="text-sm text-cream-300/90 mb-3 leading-relaxed">
              {work.description}
            </p>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-cream-400/60 w-16 shrink-0">媒介</span>
                <span className="text-cream-300">{work.mediums.join('、')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cream-400/60 w-16 shrink-0">适配方向</span>
                <span className="text-cream-300">{work.applicationDirection.join('、')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cream-400/60 w-16 shrink-0">版权</span>
                <span className={work.copyright.hasClearance ? 'text-moss-500' : 'text-terracotta-500'}>
                  {work.copyright.hasClearance ? '已授权' : '待确认'}
                  {work.copyright.notes && ` · ${work.copyright.notes}`}
                </span>
              </div>
              {work.sourceMaterials.length > 0 && (
                <div className="flex items-start gap-2 pt-2 border-t border-white/5 mt-2">
                  <span className="text-cream-400/60 w-16 shrink-0 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    来源材料
                  </span>
                  <div className="flex-1 space-y-1">
                    {work.sourceMaterials.map(mat => (
                      <a
                        key={mat.id}
                        href={mat.url}
                        className="block text-ochre-400 hover:text-ochre-300 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {mat.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
