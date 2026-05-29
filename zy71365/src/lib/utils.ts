import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getAnomalyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate_theme: '同题材过多',
    low_completion: '低完成度混入',
    missing_copyright: '图片缺版权'
  };
  return labels[type] || type;
}

export function getSeverityLabel(severity: string): string {
  return severity === 'critical' ? '严重' : '警告';
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  if (score >= 55) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500/20';
  if (score >= 70) return 'bg-amber-500/20';
  if (score >= 55) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}
