import React, { useState } from 'react';
import { AlertTriangle, Clock, User, Check, X, Eye, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SuspendedTask } from '@/types';
import { SUSPENDED_REASON_LABELS, SUSPENDED_STATUS_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { DuplicateCompare } from './DuplicateCompare';

interface SuspendedTaskCardProps {
  task: SuspendedTask;
  onResolve: (taskId: string, action: 'continue' | 'reject' | 'new_session', notes: string) => Promise<void>;
  onViewSession: (sessionId: string) => void;
}

export const SuspendedTaskCard: React.FC<SuspendedTaskCardProps> = ({
  task,
  onResolve,
  onViewSession,
}) => {
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [resolveAction, setResolveAction] = useState<'continue' | 'reject' | 'new_session'>('continue');
  const [resolveNotes, setResolveNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'duplicate_sample':
        return 'text-[#dd6b20] bg-[#dd6b20]/20';
      case 'caliber_change':
        return 'text-[#c53030] bg-[#c53030]/20';
      default:
        return 'text-[#718096] bg-[#2d3748]';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-[#dd6b20]';
      case 'resolved':
        return 'text-[#38a169]';
      case 'rejected':
        return 'text-[#c53030]';
      default:
        return 'text-[#718096]';
    }
  };

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await onResolve(task.id, resolveAction, resolveNotes);
      setShowResolveModal(false);
      setResolveNotes('');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'p-5 bg-[#1a202c] border rounded-lg transition-all',
          task.status === 'pending'
            ? 'border-[#dd6b20] hover:border-[#f6ad55]'
            : 'border-[#4a5568]'
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                task.reason === 'duplicate_sample' ? 'bg-[#dd6b20]/20' : 'bg-[#c53030]/20'
              )}
            >
              <AlertTriangle
                className={cn(
                  'w-5 h-5',
                  task.reason === 'duplicate_sample' ? 'text-[#dd6b20]' : 'text-[#c53030]'
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#e2e8f0]">
                  #{shortHash(task.id, 8)}
                </span>
                <span className={cn('px-2 py-0.5 text-xs rounded', getReasonColor(task.reason))}>
                  {SUSPENDED_REASON_LABELS[task.reason]}
                </span>
                <span className={cn('text-xs font-mono', getStatusColor(task.status))}>
                  {SUSPENDED_STATUS_LABELS[task.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#718096]">
                <Clock className="w-3 h-3" />
                <span>挂起于 {formatTime(task.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Eye className="w-3.5 h-3.5" />}
              onClick={() => onViewSession(task.sessionId)}
            >
              查看会话
            </Button>
            {task.reason === 'duplicate_sample' && task.duplicateInfo && (
              <Button
                size="sm"
                variant="secondary"
                icon={<GitCompare className="w-3.5 h-3.5" />}
                onClick={() => setShowCompareModal(true)}
              >
                对比样本
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-[#a0aec0] mb-3">{task.description}</p>

        {task.reason === 'duplicate_sample' && task.duplicateInfo && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-2 bg-[#0d1117] rounded border border-[#4a5568]">
              <div className="text-xs font-mono text-[#718096] mb-1">当前会话</div>
              <div className="text-sm font-mono text-[#63b3ed]">
                #{shortHash(task.sessionId, 8)}
              </div>
            </div>
            <div className="p-2 bg-[#0d1117] rounded border border-[#4a5568]">
              <div className="text-xs font-mono text-[#718096] mb-1">历史会话</div>
              <div className="text-sm font-mono text-[#dd6b20]">
                #{shortHash(task.duplicateInfo.existingSessionId, 8)}
              </div>
              <div className="text-xs text-[#718096] mt-0.5">
                相似度: {(task.duplicateInfo.similarity * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {task.reason === 'caliber_change' && task.caliberChangeInfo && (
          <div className="p-3 bg-[#c53030]/10 border border-[#c53030]/30 rounded mb-3">
            <div className="text-xs font-mono text-[#fc8181] mb-1">口径变更检测</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="text-[#718096]">
                材料: <span className="text-[#a0aec0]">{task.caliberChangeInfo.materialName}</span>
              </div>
              <div className="text-[#718096]">
                版本: <span className="text-[#a0aec0]">v{task.caliberChangeInfo.fromVersion} → v{task.caliberChangeInfo.toVersion}</span>
              </div>
              <div className="text-[#718096]">
                变化率: <span className="text-[#fc8181]">{task.caliberChangeInfo.changeRate.toFixed(1)}%</span>
              </div>
              <div className="text-[#718096]">
                变更人: <span className="text-[#a0aec0]">{task.caliberChangeInfo.changedBy}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#4a5568]">
          <div className="flex items-center gap-2 text-xs text-[#718096]">
            <User className="w-3 h-3" />
            <span>挂起人: {task.createdBy}</span>
          </div>

          {task.status === 'pending' && (
            <Button
              size="sm"
              variant="primary"
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={() => setShowResolveModal(true)}
            >
              处理
            </Button>
          )}

          {task.status !== 'pending' && task.resolution && (
            <div className="text-xs text-[#718096]">
              处理结果: <span className="text-[#38a169]">{task.resolution.action === 'continue' ? '继续处理' : task.resolution.action === 'reject' ? '已驳回' : '新会话'}</span>
              {task.resolution.resolvedAt && (
                <span className="ml-2">· {formatTime(task.resolution.resolvedAt)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showResolveModal}
        onClose={() => !isResolving && setShowResolveModal(false)}
        title="处理挂起任务"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowResolveModal(false)}
              disabled={isResolving}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleResolve}
              loading={isResolving}
              disabled={!resolveNotes.trim()}
            >
              确认处理
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-mono text-[#a0aec0] mb-3">
              选择处理方式
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 bg-[#0d1117] border border-[#4a5568] rounded cursor-pointer hover:border-[#3182ce] transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="continue"
                  checked={resolveAction === 'continue'}
                  onChange={() => setResolveAction('continue')}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-mono text-sm text-[#e2e8f0]">继续处理</div>
                  <div className="text-xs text-[#718096]">忽略重复/变更，在当前会话继续处理</div>
                </div>
              </label>
              <label className="flex items-center p-3 bg-[#0d1117] border border-[#4a5568] rounded cursor-pointer hover:border-[#3182ce] transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="new_session"
                  checked={resolveAction === 'new_session'}
                  onChange={() => setResolveAction('new_session')}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-mono text-sm text-[#e2e8f0]">新建会话</div>
                  <div className="text-xs text-[#718096]">创建新的会话独立处理此样本</div>
                </div>
              </label>
              <label className="flex items-center p-3 bg-[#0d1117] border border-[#4a5568] rounded cursor-pointer hover:border-[#c53030] transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={resolveAction === 'reject'}
                  onChange={() => setResolveAction('reject')}
                  className="mr-3 w-4 h-4"
                />
                <div>
                  <div className="font-mono text-sm text-[#e2e8f0]">驳回</div>
                  <div className="text-xs text-[#718096]">拒绝该样本，终止处理</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-mono text-[#a0aec0] mb-2">
              处理说明（必填）
            </label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="请说明处理原因和依据..."
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce] resize-none"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        title="样本对比"
        size="xl"
      >
        {task.duplicateInfo && (
          <DuplicateCompare
            newSampleHash={task.duplicateInfo.newSampleHash}
            existingSampleHash={task.duplicateInfo.existingSampleHash}
            similarity={task.duplicateInfo.similarity}
            onClose={() => setShowCompareModal(false)}
          />
        )}
      </Modal>
    </>
  );
};
