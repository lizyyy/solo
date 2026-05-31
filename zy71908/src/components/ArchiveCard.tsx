import React from 'react';
import { Link } from 'react-router-dom';
import type { ArchiveRecord } from '../types';
import { SourceBadge, ChangeTypeBadge, StatusBadge, BackfillBadge } from './Badges';
import { TranspositionValidator } from '../services/TranspositionValidator';
import { DuplicateDetector } from '../services/DuplicateDetector';
import { format } from 'date-fns';
import { Clock, User, ChevronRight, AlertTriangle, Music } from 'lucide-react';

interface ArchiveCardProps {
  record: ArchiveRecord;
}

export function ArchiveCard({ record }: ArchiveCardProps) {
  const [showDuplicateDetail, setShowDuplicateDetail] = React.useState(false);
  const transpositionResult = TranspositionValidator.validate(record);
  const hasIssue = record.status !== 'normal';

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden card-hover
        ${hasIssue
          ? record.status === 'duplicate'
            ? 'border-warning-300 shadow-warning-100 shadow-sm'
            : 'border-danger-300 shadow-danger-100 shadow-sm'
          : 'border-neutral-200'
        }`}
    >
      {record.changeType === 'revision' && (
        <div className="h-1 bg-gradient-to-r from-danger-400 to-danger-500" />
      )}
      {record.changeType === 'supplement' && (
        <div className="h-1 bg-gradient-to-r from-neutral-300 to-neutral-400" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif font-semibold text-base text-neutral-900 truncate">
                {record.pieceName}
              </h3>
              <ChangeTypeBadge changeType={record.changeType} />
              <StatusBadge status={record.status} />
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500">
              <User className="w-3.5 h-3.5" />
              <span>{record.student.name}</span>
              <span className="text-neutral-300">|</span>
              <span>{record.student.grade}</span>
            </div>
          </div>
          <Link
            to={`/archive/${record.id}`}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-primary-600"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {record.sources.map(source => (
            <span key={source.id} className="flex items-center gap-1">
              <SourceBadge sourceType={source.sourceType} />
              <BackfillBadge isBackfilled={source.isBackfilled} />
            </span>
          ))}
        </div>

        {transpositionResult && !transpositionResult.isSynced && (
          <div className="mt-3 p-2.5 bg-danger-50 border border-danger-100 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-danger-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              转调未同步
            </div>
            <p className="text-xs text-danger-600 mt-1 whitespace-pre-line leading-relaxed">
              {transpositionResult.humanMessage}
            </p>
          </div>
        )}

        {transpositionResult && transpositionResult.isSynced && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-success-600">
            <Music className="w-3.5 h-3.5" />
            转调已同步：{TranspositionValidator.getHumanReadableKey(transpositionResult.expectedKey)}调
          </div>
        )}

        {record.duplicateInfo && (
          <div className="mt-3">
            <button
              onClick={() => setShowDuplicateDetail(!showDuplicateDetail)}
              className="flex items-center gap-1.5 text-xs text-warning-700 hover:text-warning-800 transition-colors w-full text-left"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>发现重复记录，点击查看详情</span>
              <ChevronRight className={`w-3 h-3 transition-transform ${showDuplicateDetail ? 'rotate-90' : ''}`} />
            </button>
            {showDuplicateDetail && (
              <div className="mt-2 p-3 bg-warning-50 border border-warning-100 rounded-lg animate-fade-in">
                <div className="text-xs space-y-2 text-warning-800">
                  <div>
                    <span className="font-medium">来源对比：</span>
                    <span>记录1来自 {DuplicateDetector.getSourceDescriptions(record.duplicateInfo.sourceComparison.record1Sources)}</span>
                    <span className="mx-1">·</span>
                    <span>记录2来自 {DuplicateDetector.getSourceDescriptions(record.duplicateInfo.sourceComparison.record2Sources)}</span>
                  </div>
                  {record.duplicateInfo.conflictFields.length > 0 && (
                    <div>
                      <span className="font-medium">冲突字段：</span>
                      {record.duplicateInfo.conflictFields.map(f => 
                        f.replace('transposition.', '').replace('Key', '')
                      ).join('、')}
                    </div>
                  )}
                  <div className="flex items-center gap-1 pt-1 border-t border-warning-200">
                    <span className="font-medium">下一步：</span>
                    联系 <span className="font-semibold">{record.duplicateInfo.suggestedHandler}</span> 确认并合并
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(record.updatedAt), 'MM-dd HH:mm')}
            </span>
            <span>{record.createdBy}</span>
          </div>
          <span className="text-xs text-neutral-400">
            v{record.versions.length}
          </span>
        </div>
      </div>
    </div>
  );
}
