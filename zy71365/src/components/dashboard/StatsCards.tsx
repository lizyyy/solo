import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useFilteredWorks } from '../../store/usePortfolioStore';
import { useTagStats, useMediumStats, useCompletionStats, useDirectionStats } from '../../hooks/useFilter';
import { BookOpen, Palette, Star, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { getScoreColor } from '../../lib/utils';

export default function StatsCards() {
  const works = usePortfolioStore(s => s.works);
  const filteredWorks = useFilteredWorks();
  const selectedIds = usePortfolioStore(s => s.selectedWorkIds);
  const anomalies = usePortfolioStore(s => s.anomalies);
  const currentScore = usePortfolioStore(s => s.currentScore);
  const tagStats = useTagStats(works);
  const mediumStats = useMediumStats(works);
  const completionStats = useCompletionStats(works);
  const directionStats = useDirectionStats(works);

  const highCompletionCount = completionStats.filter(s => s.level >= 4).reduce((sum, s) => sum + s.count, 0);
  const copyrightClearCount = works.filter(w => w.copyright.hasClearance).length;

  const stats = [
    {
      label: '作品总数',
      value: works.length,
      subValue: `${filteredWorks.length} 件符合筛选`,
      icon: BookOpen,
      color: 'text-ochre-400',
      bgColor: 'bg-ochre-500/10',
    },
    {
      label: '主题数量',
      value: tagStats.length,
      subValue: `热门: ${tagStats[0]?.tag || '-'}`,
      icon: Palette,
      color: 'text-moss-500',
      bgColor: 'bg-moss-500/10',
    },
    {
      label: '媒介类型',
      value: mediumStats.length,
      subValue: `最多: ${mediumStats[0]?.medium || '-'}`,
      icon: TrendingUp,
      color: 'text-slateblue-400',
      bgColor: 'bg-slateblue-500/10',
    },
    {
      label: '高完成度',
      value: highCompletionCount,
      subValue: `4-5星作品占 ${Math.round(highCompletionCount / works.length * 100)}%`,
      icon: Star,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: '版权合规',
      value: copyrightClearCount,
      subValue: `${works.length - copyrightClearCount} 件待确认`,
      icon: CheckCircle,
      color: copyrightClearCount === works.length ? 'text-moss-500' : 'text-terracotta-500',
      bgColor: copyrightClearCount === works.length ? 'bg-moss-500/10' : 'bg-terracotta-500/10',
    },
    {
      label: '综合评分',
      value: currentScore?.overall || '-',
      subValue: selectedIds.length > 0 ? `${selectedIds.length} 件已选` : '请选择作品',
      icon: AlertTriangle,
      color: currentScore ? getScoreColor(currentScore.overall) : 'text-cream-400/60',
      bgColor: 'bg-charcoal-700/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`
            stat-card glass-card card-hover rounded-xl p-4
            opacity-0 animate-fadeInUp animate-stagger-${index + 1}
          `}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            {anomalies.length > 0 && stat.label === '综合评分' && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-terracotta-500/20 text-terracotta-500 font-medium animate-pulseSoft">
                {anomalies.length} 异常
              </span>
            )}
          </div>
          <div className={`text-2xl font-display font-semibold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs text-cream-400/70 mt-1">
            {stat.label}
          </div>
          <div className="text-xs text-cream-400/50 mt-0.5">
            {stat.subValue}
          </div>
        </div>
      ))}
    </div>
  );
}
