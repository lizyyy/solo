
import React from 'react';
import { SampleStatus, SourceType, EvidenceType } from '../types';

export const getStatusLabel = (status: SampleStatus): string => {
  const labels: Record<SampleStatus, string> = {
    pending: '待检测',
    detected: '已检测',
    reviewing: '待复核',
    completed: '已完成',
  };
  return labels[status];
};

export const getStatusColor = (status: SampleStatus): string => {
  const colors: Record<SampleStatus, string> = {
    pending: 'bg-gray-100 text-gray-700',
    detected: 'bg-blue-100 text-blue-700',
    reviewing: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  };
  return colors[status];
};

export const getSourceLabel = (source: SourceType): string => {
  const labels: Record<SourceType, string> = {
    model: '模型输出',
    manual: '人工标注',
    online: '线上反馈',
  };
  return labels[source];
};

export const getSourceColor = (source: SourceType): string => {
  const colors: Record<SourceType, string> = {
    model: 'bg-purple-100 text-purple-700',
    manual: 'bg-emerald-100 text-emerald-700',
    online: 'bg-sky-100 text-sky-700',
  };
  return colors[source];
};

export const getEvidenceTypeLabel = (type: EvidenceType): string => {
  const labels: Record<EvidenceType, string> = {
    model_output: '模型输出',
    manual_label: '人工标注',
    threshold_config: '阈值配置',
  };
  return labels[type];
};

export const getEvidenceTypeColor = (type: EvidenceType): string => {
  const colors: Record<EvidenceType, string> = {
    model_output: 'border-l-blue-500 bg-blue-50',
    manual_label: 'border-l-emerald-500 bg-emerald-50',
    threshold_config: 'border-l-amber-500 bg-amber-50',
  };
  return colors[type];
};

export const highlightText = (text: string, highlights?: string[]): React.ReactNode => {
  if (!highlights || highlights.length === 0) return text;

  let result: React.ReactNode[] = [text];
  
  highlights.forEach((word) => {
    result = result.flatMap((part) => {
      if (typeof part === 'string') {
        const parts = part.split(new RegExp(`(${word})`, 'gi'));
        return parts.map((p, i) =>
          p.toLowerCase() === word.toLowerCase() ? (
            <mark key={`${word}-${i}`} className="bg-yellow-200 px-0.5 rounded font-medium">
              {p}
            </mark>
          ) : (
            p
          )
        );
      }
      return part;
    });
  });

  return result;
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const exportToCSV = (data: Record<string, any>[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const getDriftLevel = (score: number): { label: string; color: string } => {
  if (score >= 0.6) return { label: '严重漂移', color: 'text-red-600 bg-red-100' };
  if (score >= 0.3) return { label: '疑似漂移', color: 'text-amber-600 bg-amber-100' };
  return { label: '正常', color: 'text-green-600 bg-green-100' };
};
