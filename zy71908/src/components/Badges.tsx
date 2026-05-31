import React from 'react';
import type { SourceType, ChangeType, RecordStatus } from '../types';
import { SOURCE_LABELS, CHANGE_TYPE_LABELS, STATUS_LABELS } from '../types';
import { Circle, Square, Triangle, FileText, AlertTriangle, Copy } from 'lucide-react';

const SOURCE_ICONS: Record<SourceType, React.ReactNode> = {
  metronome: <Circle className="w-3 h-3" />,
  song_list: <Square className="w-3 h-3" />,
  sheet_music: <Triangle className="w-3 h-3" />,
};

const SOURCE_COLORS: Record<SourceType, string> = {
  metronome: 'bg-primary-100 text-primary-700 border-primary-200',
  song_list: 'bg-warning-100 text-warning-700 border-warning-200',
  sheet_music: 'bg-success-100 text-success-700 border-success-200',
};

export function SourceBadge({ sourceType, showIcon = true }: { sourceType: SourceType; showIcon?: boolean }) {
  return (
    <span className={`badge border ${SOURCE_COLORS[sourceType]}`}>
      {showIcon && SOURCE_ICONS[sourceType]}
      {SOURCE_LABELS[sourceType]}
    </span>
  );
}

export function ChangeTypeBadge({ changeType }: { changeType: ChangeType }) {
  if (changeType === 'revision') {
    return (
      <span className="badge bg-danger-100 text-danger-700 border border-danger-200">
        <AlertTriangle className="w-3 h-3" />
        {CHANGE_TYPE_LABELS[changeType]}
      </span>
    );
  }
  return (
    <span className="badge bg-neutral-100 text-neutral-600 border border-neutral-200">
      <FileText className="w-3 h-3" />
      {CHANGE_TYPE_LABELS[changeType]}
    </span>
  );
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  switch (status) {
    case 'duplicate':
      return (
        <span className="badge bg-warning-100 text-warning-700 border border-warning-200 animate-pulse">
          <Copy className="w-3 h-3" />
          {STATUS_LABELS[status]}
        </span>
      );
    case 'transposition_mismatch':
      return (
        <span className="badge bg-danger-100 text-danger-700 border border-danger-200 animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          {STATUS_LABELS[status]}
        </span>
      );
    default:
      return (
        <span className="badge bg-success-50 text-success-600 border border-success-200">
          {STATUS_LABELS[status]}
        </span>
      );
  }
}

export function BackfillBadge({ isBackfilled }: { isBackfilled: boolean }) {
  if (!isBackfilled) return null;
  return (
    <span className="badge bg-orange-50 text-orange-600 border border-orange-200 text-[10px]">
      补录
    </span>
  );
}
