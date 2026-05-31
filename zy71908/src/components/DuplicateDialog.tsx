import React from 'react';
import type { DuplicateResult } from '../types';
import { DuplicateDetector } from '../services/DuplicateDetector';
import { SourceBadge, ChangeTypeBadge } from './Badges';
import { format } from 'date-fns';
import { GitMerge, Trash2, X, Clock, User, ArrowRight } from 'lucide-react';
import { useArchiveStore } from '../store/archiveStore';

interface DuplicateDialogProps {
  duplicate: DuplicateResult;
  onClose: () => void;
}

export function DuplicateDialog({ duplicate, onClose }: DuplicateDialogProps) {
  const { resolveDuplicate } = useArchiveStore();
  const [selectedRecord, setSelectedRecord] = React.useState<string | null>(null);
  const [mergeData, setMergeData] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const { record1, record2, conflictFields, sourceComparison, suggestedHandler, suggestedAction } = duplicate;
  const timeGap = DuplicateDetector.formatTimeGap(sourceComparison.timeGapMinutes);

  const handleResolve = () => {
    if (!selectedRecord) return;
    setIsProcessing(true);
    setTimeout(() => {
      resolveDuplicate(duplicate, selectedRecord, mergeData);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-bounce-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-100">
          <h2 className="font-serif text-lg font-bold text-neutral-900">重复记录对比</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <p className="text-sm text-warning-800 leading-relaxed">{suggestedAction}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { record: record1, label: '记录1' },
              { record: record2, label: '记录2' },
            ].map(({ record, label }) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${selectedRecord === record.id
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-neutral-200 hover:border-neutral-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-500">{label}</span>
                  <ChangeTypeBadge changeType={record.changeType} />
                </div>
                <h4 className="font-serif font-semibold text-neutral-900">{record.pieceName}</h4>
                <p className="text-sm text-neutral-600 mt-1">{record.student.name}</p>
                
                <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                  <Clock className="w-3 h-3" />
                  {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500">
                  <User className="w-3 h-3" />
                  {record.createdBy}
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {record.sources.map(s => (
                    <SourceBadge key={s.id} sourceType={s.sourceType} showIcon={false} />
                  ))}
                </div>

                {record.transposition && (
                  <div className="mt-2 text-xs text-neutral-600">
                    转调：{record.transposition.metronomeKey !== undefined ? `节拍器${record.transposition.metronomeKey} ` : ''}
                    {record.transposition.songListKey !== undefined ? `选曲表${record.transposition.songListKey} ` : ''}
                    {record.transposition.sheetMusicKey !== undefined ? `曲谱${record.transposition.sheetMusicKey}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4 p-3 bg-neutral-50 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">时间差：</span>
              <span className="font-medium text-neutral-700">{timeGap}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">冲突字段：</span>
              <span className="font-medium text-danger-600">
                {conflictFields.length > 0
                  ? conflictFields.map(f => f.replace('transposition.', '').replace('Key', '')).join('、')
                  : '无'
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">建议联系：</span>
              <span className="font-medium text-primary-600">{suggestedHandler}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={mergeData}
                onChange={(e) => setMergeData(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">合并两条记录的数据（保留所有来源信息）</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">
              取消
            </button>
            <button
              onClick={handleResolve}
              disabled={!selectedRecord || isProcessing}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {mergeData ? (
                <>
                  <GitMerge className="w-4 h-4" />
                  {isProcessing ? '处理中...' : '合并记录'}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {isProcessing ? '处理中...' : '保留选中，删除另一条'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
