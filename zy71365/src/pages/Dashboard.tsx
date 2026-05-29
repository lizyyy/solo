import StatsCards from '../components/dashboard/StatsCards';
import FilterPanel from '../components/dashboard/FilterPanel';
import WorkCard from '../components/dashboard/WorkCard';
import AnomalyPanel from '../components/dashboard/AnomalyPanel';
import { useFilteredWorks } from '../store/usePortfolioStore';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import type { StudentWork } from '../types';

type SortOption = 'date-desc' | 'date-asc' | 'completion-desc' | 'completion-asc';

export default function Dashboard() {
  const filteredWorks = useFilteredWorks();
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  const sortedWorks = [...filteredWorks].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'completion-desc':
        return b.completion - a.completion;
      case 'completion-asc':
        return a.completion - b.completion;
      default:
        return 0;
    }
  });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream-100 tracking-tight">
          分析看板
        </h1>
        <p className="text-cream-400/70 mt-2">
          按主题、媒介和完成度筛选作品，实时检测异常，为投递组合提供数据支持
        </p>
      </div>

      <div className="mb-8">
        <StatsCards />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <FilterPanel />
          <AnomalyPanel />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-semibold text-cream-200">
                作品列表
              </h2>
              <span className="px-2.5 py-1 rounded-full bg-charcoal-700/50 text-xs text-cream-400">
                {filteredWorks.length} 件符合条件
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-cream-400/60" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-charcoal-700/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-cream-200 focus:outline-none focus:border-ochre-500/50 cursor-pointer"
              >
                <option value="date-desc">最新上传</option>
                <option value="date-asc">最早上传</option>
                <option value="completion-desc">完成度从高到低</option>
                <option value="completion-asc">完成度从低到高</option>
              </select>
            </div>
          </div>

          {sortedWorks.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-cream-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-display text-lg font-semibold text-cream-200 mb-2">没有符合条件的作品</h4>
              <p className="text-sm text-cream-400/60">
                请尝试调整筛选条件
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedWorks.map((work, index) => (
                <WorkCard key={work.id} work={work} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
