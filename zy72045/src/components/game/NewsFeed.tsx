import { useEffect, useState } from 'react';
import { Newspaper, AlertTriangle, History } from 'lucide-react';
import { SourceCard } from '../common/SourceCard';
import { StatusBadge } from '../common/StatusBadge';
import { useGameLogic } from '../../hooks/useGameLogic';
import { useSourceTracker } from '../../hooks/useSourceTracker';
import type { NewsConfig } from '../../types/game';
import { formatTime } from '../../utils/formatters';

interface NewsItemProps {
  news: NewsConfig;
  index: number;
  onTrade: (news: NewsConfig) => void;
  canTrade: boolean;
}

function NewsItem({ news, index, onTrade, canTrade }: NewsItemProps) {
  const { getSourceTypeColor, getSourceTypeLabel, getImpactScoreColor, shouldHighlight } = useSourceTracker();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 300);
    return () => clearTimeout(timer);
  }, [index]);

  const isHighlighted = shouldHighlight(news);

  return (
    <div
      className={`relative pl-8 pb-6 border-l-2 border-neutral-200 last:border-l-0 last:pb-0 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
        isHighlighted ? 'bg-warning-500 animate-pulse-border' : 'bg-primary-500'
      }`} />

      <div
        className={`card ml-4 ${
          isHighlighted ? 'border-warning-300 bg-warning-50/50' : ''
        }`}
        id={`source-${news.id}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${getSourceTypeColor(news.sourceType)}`}>
              {getSourceTypeLabel(news.sourceType)}
            </span>
            <StatusBadge status={news.confidence} type="confidence" />
            {news.sourceType === 'projection_old' && (
              <span className="badge bg-warning-100 text-warning-700 flex items-center gap-1">
                <History size={10} />
                旧口径
              </span>
            )}
            {news.confidence === 'need_confirm' && (
              <span className="badge bg-warning-100 text-warning-700 flex items-center gap-1">
                <AlertTriangle size={10} />
                待确认
              </span>
            )}
          </div>
          <span className="text-xs text-neutral-400 font-mono flex-shrink-0">
            {formatTime(news.publishTime)}
          </span>
        </div>

        <h4 className="font-serif font-semibold text-base mb-2 leading-snug">
          {news.title}
        </h4>
        <p className="text-sm text-neutral-600 mb-3 leading-relaxed">
          {news.content}
        </p>

        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${getImpactScoreColor(news.impactScore)}`}>
            影响指数：{news.impactScore > 0 ? '+' : ''}{news.impactScore}
          </span>
          {canTrade && (
            <button
              onClick={() => onTrade(news)}
              className="btn-primary text-xs py-1 px-3"
            >
              基于此新闻交易
            </button>
          )}
        </div>

        <SourceCard sourceInfo={news} />
      </div>
    </div>
  );
}

interface NewsFeedProps {
  onSelectNews: (news: NewsConfig) => void;
}

export function NewsFeed({ onSelectNews }: NewsFeedProps) {
  const { currentNews, canTrade, handleNewsPublish, status } = useGameLogic();

  useEffect(() => {
    if (status === 'playing') {
      currentNews.forEach((news) => {
        handleNewsPublish(news);
      });
    }
  }, [currentNews, status, handleNewsPublish]);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-neutral-100">
        <Newspaper size={20} className="text-primary-500" />
        <h3 className="font-serif text-lg font-semibold">新闻播报</h3>
        <span className="text-xs text-neutral-400 ml-auto">
          本回合 {currentNews.length} 条新闻
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
        {currentNews.length > 0 ? (
          <div className="relative">
            {currentNews.map((news, index) => (
              <NewsItem
                key={news.id}
                news={news}
                index={index}
                onTrade={onSelectNews}
                canTrade={canTrade}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
            <Newspaper size={40} className="mb-2 opacity-30" />
            <p className="text-sm">暂无新闻</p>
          </div>
        )}
      </div>
    </div>
  );
}
