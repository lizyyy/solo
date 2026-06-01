import type { SourceType, SourceInfo, NewsConfig } from '../types/game';

export function useSourceTracker() {
  const getSourceTypeLabel = (type: SourceType): string => {
    const labels: Record<SourceType, string> = {
      reuters: '路透社',
      bloomberg: '彭博社',
      projection_old: '旧口径-投影大屏',
      manual: '人工录入',
      other: '其他来源',
    };
    return labels[type] || type;
  };

  const getSourceTypeColor = (type: SourceType): string => {
    const colors: Record<SourceType, string> = {
      reuters: 'bg-primary-100 text-primary-700',
      bloomberg: 'bg-success-100 text-success-700',
      projection_old: 'bg-warning-100 text-warning-700',
      manual: 'bg-neutral-100 text-neutral-700',
      other: 'bg-neutral-200 text-neutral-600',
    };
    return colors[type] || 'bg-neutral-100 text-neutral-700';
  };

  const getConfidenceLabel = (confidence: string): string => {
    const labels: Record<string, string> = {
      auto: '自动处理',
      need_confirm: '待人工确认',
      manual: '人工处理',
    };
    return labels[confidence] || confidence;
  };

  const getConfidenceColor = (confidence: string): string => {
    const colors: Record<string, string> = {
      auto: 'bg-success-50 text-success-600 border-success-200',
      need_confirm: 'bg-warning-50 text-warning-600 border-warning-200',
      manual: 'bg-primary-50 text-primary-600 border-primary-200',
    };
    return colors[confidence] || 'bg-neutral-50 text-neutral-600 border-neutral-200';
  };

  const formatSourceInfo = (info: SourceInfo): string => {
    return `来源：${info.originalSource} | 处理人：${info.processor} | 处理时间：${info.processTime}`;
  };

  const getSourceTraceLink = (news: NewsConfig): string => {
    return `#source-${news.id}`;
  };

  const shouldHighlight = (news: NewsConfig): boolean => {
    return news.confidence === 'need_confirm' || news.sourceType === 'projection_old';
  };

  const getImpactScoreColor = (score: number): string => {
    if (score >= 60) return 'text-danger-500';
    if (score >= 30) return 'text-warning-500';
    if (score >= 0) return 'text-success-500';
    if (score >= -30) return 'text-primary-500';
    return 'text-danger-500';
  };

  return {
    getSourceTypeLabel,
    getSourceTypeColor,
    getConfidenceLabel,
    getConfidenceColor,
    formatSourceInfo,
    getSourceTraceLink,
    shouldHighlight,
    getImpactScoreColor,
  };
}
