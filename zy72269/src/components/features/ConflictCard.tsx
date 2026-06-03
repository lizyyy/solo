import { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ConflictRecord } from '@/types';
import Button from '@/components/ui/Button';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';
import { getConflictTypeLabel, getConflictStatusLabel } from '@/services/conflictDetectionService';
import { useAppStore } from '@/store';

interface ConflictCardProps {
  conflict: ConflictRecord;
  markSequenceNo?: number;
  sketchFloorLevel?: string;
}

export default function ConflictCard({ conflict, markSequenceNo, sketchFloorLevel }: ConflictCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showDecision, setShowDecision] = useState(false);
  const [decision, setDecision] = useState<'confirm' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const currentTask = useAppStore((state) => state.getCurrentTask());
  const updateConflict = useAppStore((state) => state.updateConflict);
  const updateTask = useAppStore((state) => state.updateTask);

  const handleResolve = () => {
    if (!decision || !reason.trim() || !currentTask) return;

    const updatedConflict = {
      ...conflict,
      status: (decision === 'confirm' ? 'confirmed' : 'rejected') as 'confirmed' | 'rejected',
      decision: {
        id: '',
        conflictId: conflict.id,
        decisionType: decision,
        reason: reason.trim(),
        engineerName: '许工',
        decidedAt: new Date().toISOString()
      }
    };

    updateConflict(currentTask.id, conflict.id, updatedConflict);

    const allResolved = currentTask.conflicts.every(
      c => c.id === conflict.id || c.status !== 'pending'
    );
    if (allResolved && currentTask.conflicts.length > 0) {
      updateTask(currentTask.id, { status: 'reviewing' });
    }

    setShowDecision(false);
    setDecision(null);
    setReason('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-accent-warning border-accent-warning/50';
      case 'confirmed': return 'text-accent-success border-accent-success/50';
      case 'rejected': return 'text-primary-400 border-primary-400';
      default: return 'text-primary-300 border-primary-500';
    }
  };

  const currentTask2 = useAppStore((state) => state.getCurrentTask());
  const mark = currentTask2?.marks.find(m => m.id === conflict.markId);

  return (
    <div className="card-industrial mb-4">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-primary-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <AlertTriangle className="text-accent-warning" size={20} />
          <div>
            <h4 className="font-mono text-sm text-primary-200">
              冲突 #{markSequenceNo || '?'} - {getConflictTypeLabel(conflict.conflictType)}
            </h4>
            <p className="font-mono text-xs text-primary-400 mt-1">
              {sketchFloorLevel && `楼层: ${sketchFloorLevel} | `}
              检测于 {new Date(conflict.detectedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 text-xs font-mono border tracking-wider ${getStatusColor(conflict.status)}`}>
            {getConflictStatusLabel(conflict.status)}
          </span>
          {expanded ? <ChevronUp size={18} className="text-primary-400" /> : <ChevronDown size={18} className="text-primary-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="conflict-evidence">
              <h5 className="font-mono text-xs font-semibold text-accent-warning mb-3 tracking-wider">
                巡检标记证据
              </h5>
              <p className="text-sm text-neutral-light leading-relaxed">
                {conflict.evidenceFromMark}
              </p>
              {mark && <OriginalNoteDisplay notes={mark.originalNotes} showSource={false} />}
            </div>

            <div className="conflict-evidence">
              <h5 className="font-mono text-xs font-semibold text-accent-warning mb-3 tracking-wider">
                楼层剖面草图证据
              </h5>
              <p className="text-sm text-neutral-light leading-relaxed">
                {conflict.evidenceFromSketch}
              </p>
            </div>
          </div>

          {conflict.decision && (
            <div className="bg-primary-700/30 border-2 border-primary-600 p-4 mb-4">
              <h5 className="font-mono text-xs font-semibold text-primary-300 mb-2 tracking-wider">
                裁决记录
              </h5>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs font-mono border ${conflict.decision.decisionType === 'confirm' ? 'text-accent-success border-accent-success/50' : 'text-primary-400 border-primary-400'}`}>
                  {conflict.decision.decisionType === 'confirm' ? '确认冲突' : '驳回冲突'}
                </span>
                <span className="font-mono text-xs text-primary-400">
                  裁决人: {conflict.decision.engineerName}
                </span>
                <span className="font-mono text-xs text-primary-400">
                  {new Date(conflict.decision.decidedAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="text-sm text-primary-200">
                {conflict.decision.reason}
              </p>
            </div>
          )}

          {conflict.status === 'pending' && !showDecision && (
            <Button variant="warning" onClick={(e) => { e.stopPropagation(); setShowDecision(true); }}>
              处理冲突
            </Button>
          )}

          {showDecision && (
            <div className="bg-primary-700/30 border-2 border-accent-warning/50 p-4">
              <h5 className="font-mono text-xs font-semibold text-accent-warning mb-4 tracking-wider">
                请设备工程师许工进行裁决
              </h5>
              <div className="flex gap-4 mb-4">
                <Button
                  variant="success"
                  onClick={(e) => { e.stopPropagation(); setDecision('confirm'); }}
                  className={decision === 'confirm' ? 'ring-2 ring-accent-success ring-offset-2 ring-offset-primary-800' : ''}
                >
                  <Check size={16} className="mr-2 inline" />
                  确认冲突
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); setDecision('reject'); }}
                  className={decision === 'reject' ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-primary-800' : ''}
                >
                  <X size={16} className="mr-2 inline" />
                  驳回冲突
                </Button>
              </div>
              <div className="mb-4">
                <label className="block font-mono text-xs text-primary-300 mb-2">
                  裁决理由 <span className="text-accent-warning">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-industrial min-h-[100px] resize-none"
                  placeholder="请填写裁决理由，此记录将永久保存..."
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex gap-4">
                <Button
                  variant="primary"
                  onClick={(e) => { e.stopPropagation(); handleResolve(); }}
                  disabled={!decision || !reason.trim()}
                >
                  提交裁决
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); setShowDecision(false); setDecision(null); setReason(''); }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
