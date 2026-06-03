import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  History,
  Ruler,
  FileText,
  Layers,
  Camera,
} from 'lucide-react';
import type { InspectionRecord } from '../../shared/types';
import { RecordStatus, STATUS_LABELS, RECORD_TYPE_LABELS } from '../../shared/types';
import { RECORD_DESCRIPTIONS } from '../core/mockData';
import { EvidenceTimeline } from './EvidenceTimeline';
import { DataCompareTable } from './DataCompareTable';

interface RecordCardProps {
  record: InspectionRecord;
  isActive: boolean;
  onToggle: () => void;
  delay?: number;
}

const getStatusStyle = (status: RecordStatus) => {
  switch (status) {
    case RecordStatus.NORMAL:
      return 'card-status-normal';
    case RecordStatus.PENDING_REVIEW:
      return 'card-status-pending';
    case RecordStatus.OLD_CALIBER:
      return 'card-status-old';
    default:
      return 'card-status-pending-default';
  }
};

const getStatusBadge = (status: RecordStatus) => {
  switch (status) {
    case RecordStatus.NORMAL:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-status-normal/20 text-status-normal text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          {STATUS_LABELS[status]}
        </span>
      );
    case RecordStatus.PENDING_REVIEW:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-status-pending/20 text-status-pending text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          {STATUS_LABELS[status]}
        </span>
      );
    case RecordStatus.OLD_CALIBER:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-status-oldCaliber/20 text-status-oldCaliber text-sm font-medium">
          <History className="w-4 h-4" />
          {STATUS_LABELS[status]}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-industrial-border text-industrial-muted text-sm font-medium">
          <FileText className="w-4 h-4" />
          {STATUS_LABELS[status]}
        </span>
      );
  }
};

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  isActive,
  onToggle,
  delay = 0,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const statusStyle = getStatusStyle(record.status);
  const typeLabel = RECORD_TYPE_LABELS[record.recordType];
  const description = RECORD_DESCRIPTIONS[record.id] || '';

  return (
    <div
      className={`bg-industrial-card rounded-xl overflow-hidden transition-all duration-500 ${statusStyle} ${
        isActive ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-industrial-bg' : ''
      }`}
      style={{
        animationDelay: `${delay}ms`,
        animation: record.photoNo ? 'slide-up 0.5s ease-out forwards' : 'none',
        opacity: record.photoNo ? 1 : 0.7,
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-bold text-industrial-text font-mono">
                {record.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-primary-600/30 text-primary-300">
                {typeLabel}
              </span>
            </div>
            {getStatusBadge(record.status)}
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 rounded-lg hover:bg-industrial-border transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="w-5 h-5 text-industrial-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-industrial-muted" />
            )}
          </button>
        </div>

        <p className="text-sm text-industrial-muted mb-4">{description}</p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Camera className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-industrial-muted mb-0.5">巡检照片编号</div>
              <div className="data-field text-industrial-text">
                {record.photoNo || '未导入'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-industrial-muted mb-0.5">CAD图层名</div>
              <div className="data-field text-industrial-text">
                {record.cadLayerName || '未补录'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Ruler className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-industrial-muted mb-0.5">路线长度</div>
              <div className="data-field text-industrial-text">
                {record.routeLength !== null ? `${record.routeLength} m` : '未计算'}
                {record.correctedLength !== null && (
                  <span className="text-status-normal ml-2">(已修正)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <History className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-industrial-muted mb-0.5">数据口径</div>
              <div className="data-field text-industrial-text">{record.caliber}</div>
            </div>
          </div>
        </div>

        {record.status === RecordStatus.PENDING_REVIEW && (
          <div
            className="mt-4 p-3 rounded-lg bg-status-pending/10 border border-status-pending/30"
            title="此记录补录路线后未重算长度，请客户复核"
          >
            <div className="flex items-center gap-2 text-status-pending text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>补录路线未重新计算长度，待客户复核</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-xs text-industrial-muted">
          {record.hasManualCorrection && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-primary-400" />
              含人工修正
            </span>
          )}
          {record.hasRerun && (
            <span className="flex items-center gap-1">
              <History className="w-3 h-3 text-primary-400" />
              已重跑
            </span>
          )}
          {!record.lengthRecalculated && record.photoNo && (
            <span className="flex items-center gap-1 text-status-pending">
              <AlertTriangle className="w-3 h-3" />
              长度未重算
            </span>
          )}
        </div>

        <button
          onClick={onToggle}
          className="mt-4 w-full py-2 text-sm text-primary-400 hover:text-primary-300 hover:bg-primary-600/10 rounded-lg transition-colors"
        >
          {isActive ? '收起证据链' : '展开证据链'}
        </button>
      </div>

      {showDetails && (
        <div className="border-t border-industrial-border p-5 bg-industrial-bg/50 animate-fade-in">
          <DataCompareTable record={record} />
        </div>
      )}

      {isActive && (
        <div className="border-t border-industrial-border p-5 bg-industrial-bg animate-fade-in">
          <EvidenceTimeline recordId={record.id} />
        </div>
      )}
    </div>
  );
};
