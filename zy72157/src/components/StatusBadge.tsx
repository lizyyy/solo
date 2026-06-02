import React from 'react';
import { PointStatus, PointType, PointSource } from '../types';

export const statusLabels: Record<PointStatus, string> = {
  pending: '待处理',
  merged: '已归并',
  confirmed: '已确认',
  rejected: '已作废',
};

export const statusColors: Record<PointStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  merged: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export const typeLabels: Record<PointType, string> = {
  smooth: '顺利',
  review: '待确认',
  legacy: '旧口径',
  boundary: '边界',
  duplicate: '重复',
  empty: '空值',
};

export const typeColors: Record<PointType, string> = {
  smooth: 'bg-emerald-100 text-emerald-800',
  review: 'bg-amber-100 text-amber-800',
  legacy: 'bg-slate-100 text-slate-800',
  boundary: 'bg-orange-100 text-orange-800',
  duplicate: 'bg-purple-100 text-purple-800',
  empty: 'bg-rose-100 text-rose-800',
};

export const sourceLabels: Record<PointSource, string> = {
  GIS: 'GIS点位',
  feedback: '居民反馈',
  inspection: '巡检记录',
  street: '街道备注',
};

export const sourceColors: Record<PointSource, string> = {
  GIS: 'bg-primary-100 text-primary-800',
  feedback: 'bg-warm-100 text-warm-700',
  inspection: 'bg-teal-100 text-teal-800',
  street: 'bg-indigo-100 text-indigo-800',
};

interface StatusBadgeProps {
  type: 'status' | 'pointType' | 'source';
  value: string;
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  let label = value;
  let colorClass = 'bg-gray-100 text-gray-800';

  if (type === 'status') {
    label = statusLabels[value as PointStatus] || value;
    colorClass = statusColors[value as PointStatus] || colorClass;
  } else if (type === 'pointType') {
    label = typeLabels[value as PointType] || value;
    colorClass = typeColors[value as PointType] || colorClass;
  } else if (type === 'source') {
    label = sourceLabels[value as PointSource] || value;
    colorClass = sourceColors[value as PointSource] || colorClass;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
