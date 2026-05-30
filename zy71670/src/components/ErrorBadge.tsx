import React from 'react';
import { X, Check } from 'lucide-react';
import { ErrorTag, ERROR_TYPE_LABELS } from '../types';
import { formatDate } from '../utils/tension';

interface ErrorBadgeProps {
  tag: ErrorTag;
  onResolve?: () => void;
}

export const ErrorBadge: React.FC<ErrorBadgeProps> = ({ tag, onResolve }) => {
  const getColorClass = () => {
    if (tag.resolved) return 'badge-success';
    switch (tag.type) {
      case 'tension_exceeded':
        return 'badge-danger';
      case 'pitch_mapping':
      case 'spec_mismatch':
        return 'badge-warning';
      case 'unit_error':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md ${tag.resolved ? 'bg-success-50' : 'bg-warning-50'} ${!tag.resolved ? 'animate-pulse-slow' : ''}`}
    >
      <span className={`badge ${getColorClass()}`}>
        {ERROR_TYPE_LABELS[tag.type]}
      </span>
      <span className="text-xs text-gray-600 flex-1">{tag.description}</span>
      <span className="text-xs text-gray-400">{formatDate(tag.createdAt)}</span>
      {!tag.resolved && onResolve && (
        <button
          onClick={onResolve}
          className="p-1 rounded hover:bg-success-100 text-success-600 transition-colors"
          title="标记为已解决"
        >
          <Check size={14} />
        </button>
      )}
      {tag.resolved && (
        <span className="text-success-600">
          <Check size={14} />
        </span>
      )}
    </div>
  );
};
