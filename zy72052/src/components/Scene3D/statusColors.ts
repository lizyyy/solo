import { PointStatus } from '@/types';

export function getStatusColor(status: PointStatus): string {
  const colors: Record<PointStatus, string> = {
    normal: '#d4762a',
    warning: '#f39c12',
    error: '#c0392b',
    empty: '#7f8c8d',
    duplicate: '#8e44ad',
    boundary: '#e74c3c'
  };
  return colors[status];
}

export function getStatusBgClass(status: PointStatus): string {
  const classes: Record<PointStatus, string> = {
    normal: 'bg-amber-600/20 text-amber-400 border-amber-600/40',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    error: 'bg-red-600/20 text-red-400 border-red-600/40',
    empty: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    duplicate: 'bg-purple-600/20 text-purple-400 border-purple-600/40',
    boundary: 'bg-orange-600/20 text-orange-400 border-orange-600/40'
  };
  return classes[status];
}
