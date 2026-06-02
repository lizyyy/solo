import { useState } from 'react';
import { Conflict, ConflictResolution } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatDateTimeShort } from '@/utils/dateUtils';
import { AlertTriangle, CheckCircle, User, Clock, Lightbulb } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ConflictCardProps {
  conflict: Conflict;
  trackName?: string;
}

export function ConflictCard({ conflict, trackName }: ConflictCardProps) {
  const { resolveConflict } = useAppStore();
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const isResolved = conflict.resolution !== 'unresolved';

  const handleResolve = () => {
    if (!selectedResolution || !resolutionNote.trim()) return;
    
    resolveConflict(
      conflict.id,
      selectedResolution,
      '老许',
      resolutionNote.trim()
    );
    setShowResolveForm(false);
    setSelectedResolution(null);
    setResolutionNote('');
  };

  const typeLabels: Record<string, string> = {
    duration_mismatch: '时长不一致',
    name_mismatch: '名称不一致',
    status_conflict: '状态冲突',
    annotation_conflict: '批注冲突',
  };

  return (
    <div className={`
      card border-2 transition-all duration-300
      ${!isResolved ? 'border-studio-danger/40 animate-pulse-soft' : 'border-studio-success/30'}
    `}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`
            p-1.5 rounded-lg
            ${!isResolved ? 'bg-studio-danger/10 text-studio-danger' : 'bg-studio-success/10 text-studio-success'}
          `}>
            {!isResolved ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </div>
          <div>
            <p className="font-medium text-studio-text">
              {trackName || '未知曲目'}
            </p>
            <p className="text-xs text-studio-textMuted">
              {typeLabels[conflict.type] || conflict.type}
            </p>
          </div>
        </div>
        <StatusBadge status={conflict.resolution} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-xs font-medium text-blue-700 mb-1">
            A：{conflict.sideA.source}
          </div>
          <p className="text-sm text-studio-text">{conflict.sideA.value}</p>
          {conflict.sideA.evidence && (
            <p className="text-xs text-blue-600/70 mt-1">
              证据：{conflict.sideA.evidence}
            </p>
          )}
        </div>

        <div className="relative p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-studio-bg text-white text-xs flex items-center justify-center font-bold z-10">
            VS
          </div>
          <div className="text-xs font-medium text-red-700 mb-1">
            B：{conflict.sideB.source}
          </div>
          <p className="text-sm text-studio-text">{conflict.sideB.value}</p>
          {conflict.sideB.evidence && (
            <p className="text-xs text-red-600/70 mt-1">
              证据：{conflict.sideB.evidence}
            </p>
          )}
        </div>
      </div>

      <div className="p-3 bg-studio-amber/5 rounded-lg border border-studio-amber/20 mb-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-studio-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-studio-amber mb-0.5">建议</p>
            <p className="text-sm text-studio-text">{conflict.suggestion}</p>
          </div>
        </div>
      </div>

      {isResolved ? (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-2 text-xs text-green-700 mb-1">
            <User className="w-3.5 h-3.5" />
            <span className="font-medium">{conflict.resolvedBy}</span>
            <span>·</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{conflict.resolvedAt && formatDateTimeShort(conflict.resolvedAt)}</span>
          </div>
          <p className="text-sm text-studio-text">
            <span className="font-medium">处理理由：</span>
            {conflict.resolutionNote}
          </p>
        </div>
      ) : (
        <div>
          {!showResolveForm ? (
            <button
              onClick={() => setShowResolveForm(true)}
              className="btn-primary w-full text-sm"
            >
              处理这个冲突
            </button>
          ) : (
            <div className="space-y-3 animate-slide-in">
              <div className="flex flex-wrap gap-2">
                {(['use_a', 'use_b', 'keep_both'] as ConflictResolution[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResolution(res)}
                    className={`
                      px-3 py-1.5 rounded text-sm transition-all duration-200
                      ${selectedResolution === res
                        ? 'bg-studio-amber text-studio-bg font-medium'
                        : 'bg-gray-100 text-studio-text hover:bg-gray-200'
                      }
                    `}
                  >
                    {res === 'use_a' && `采用A（${conflict.sideA.source}）`}
                    {res === 'use_b' && `采用B（${conflict.sideB.source}）`}
                    {res === 'keep_both' && '两边都保留'}
                  </button>
                ))}
              </div>
              
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="写一下为什么这么判吧，下次接手的同事会感谢你的..."
                className="input-field text-sm min-h-[80px] resize-none"
              />
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowResolveForm(false);
                    setSelectedResolution(null);
                    setResolutionNote('');
                  }}
                  className="btn-ghost flex-1"
                >
                  取消
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!selectedResolution || !resolutionNote.trim()}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认处理
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
