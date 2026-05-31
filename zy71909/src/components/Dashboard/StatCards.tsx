import { TrendingDown, Zap, Clock, CheckCircle2 } from 'lucide-react';
import { useAppStore, useSelectedBatch } from '../../store/useAppStore';
import { getCategoryStats } from '../../utils/calculations';
import { getCategoryColor, getCategoryLabel } from '../../utils/classification';

export function StatCards() {
  const { deviations, selectedBatchId, setFilters } = useAppStore();
  const selectedBatch = useSelectedBatch();

  const stats = selectedBatchId ? getCategoryStats(deviations, selectedBatchId) : null;

  if (!stats || !selectedBatch) return null;

  const total = stats.persistent + stats.occasional + stats.unreviewed + stats.normal;

  const cards = [
    {
      key: 'persistent',
      label: getCategoryLabel('persistent'),
      value: stats.persistent,
      icon: TrendingDown,
      description: '连续3次以上偏差>50音分',
      color: getCategoryColor('persistent'),
    },
    {
      key: 'occasional',
      label: getCategoryLabel('occasional'),
      value: stats.occasional,
      icon: Zap,
      description: '单次偏差>50音分，前后正常',
      color: getCategoryColor('occasional'),
    },
    {
      key: 'unreviewed',
      label: getCategoryLabel('unreviewed'),
      value: stats.unreviewed,
      icon: Clock,
      description: '偏差>30音分，待老师复核',
      color: getCategoryColor('unreviewed'),
    },
    {
      key: 'normal',
      label: getCategoryLabel('normal'),
      value: stats.normal,
      icon: CheckCircle2,
      description: '音准在正常范围内',
      color: getCategoryColor('normal'),
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const percentage = total > 0 ? Math.round((card.value / total) * 100) : 0;
        
        return (
          <button
            key={card.key}
            onClick={() => setFilters({ category: card.key as any })}
            className="card p-4 text-left animate-slide-up animate-stagger-1 group"
            style={{ animationDelay: `${index * 50 + 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${card.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <span className="text-xs text-primary-400">{percentage}%</span>
            </div>
            
            <div className="flex items-baseline gap-2 mb-1">
              <span 
                className="text-2xl font-bold font-mono"
                style={{ color: card.color }}
              >
                {card.value}
              </span>
              <span className="text-xs text-primary-500">处</span>
            </div>
            
            <h4 className="text-sm font-semibold text-primary mb-0.5" style={{ color: card.color }}>
              {card.label}
            </h4>
            <p className="text-xs text-primary-400 line-clamp-1">
              {card.description}
            </p>

            <div className="mt-3 h-1 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: card.color,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
