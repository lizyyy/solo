import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Filter } from 'lucide-react';
import { SuspendedTaskCard } from '@/components/pending/SuspendedTaskCard';
import { Button } from '@/components/common/Button';
import { useAuditStore } from '@/stores/useAuditStore';
import { useSessionStore } from '@/stores/useSessionStore';
import type { SuspendedTask, SuspendedReason, SuspendedStatus } from '@/types';

const PendingQueuePage: React.FC = () => {
  const {
    suspendedTasks,
    loadAllSuspendedTasks,
    resolveSuspendedTask,
  } = useAuditStore();
  const { setCurrentSession } = useSessionStore();
  const [filterReason, setFilterReason] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<SuspendedStatus | 'all'>('all');

  useEffect(() => {
    loadAllSuspendedTasks();
  }, [loadAllSuspendedTasks]);

  const filteredTasks = suspendedTasks.filter((task) => {
    const matchesReason = filterReason === 'all' || task.reason === filterReason;
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    return matchesReason && matchesStatus;
  });

  const handleResolve = async (
    taskId: string,
    action: 'continue' | 'reject' | 'new_session',
    notes: string
  ) => {
    const resolution = action === 'reject' ? 'rejected' : 'confirmed';
    await resolveSuspendedTask(taskId, resolution, '现场老师', notes, action);
    await loadAllSuspendedTasks();
  };

  const handleViewSession = (sessionId: string) => {
    const { sessions } = useSessionStore.getState();
    const session = sessions.find(s => s.id === sessionId) || null;
    setCurrentSession(session);
    window.location.href = '/';
  };

  const reasonFilters: { value: string | SuspendedReason; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'duplicate_sample', label: '重复样本' },
    { value: 'caliber_change', label: '口径变更' },
  ];

  const statusFilters: { value: SuspendedStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'confirmed', label: '已确认' },
    { value: 'rejected', label: '已驳回' },
  ];

  const pendingCount = suspendedTasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-[#4a5568] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => (window.location.href = '/')}
            >
              返回工作台
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl text-[#e2e8f0] tracking-wide">挂起队列</h1>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-[#dd6b20] text-white text-xs font-mono rounded-full">
                  {pendingCount} 待处理
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#718096]" />
              <span className="text-sm text-[#718096]">原因:</span>
              <div className="flex gap-1">
                {reasonFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={filterReason === filter.value ? 'primary' : 'ghost'}
                    onClick={() => setFilterReason(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#718096]">状态:</span>
              <div className="flex gap-1">
                {statusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={filterStatus === filter.value ? 'primary' : 'ghost'}
                    onClick={() => setFilterStatus(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 text-sm text-[#718096]">
            共 {filteredTasks.length} 条挂起记录
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="w-12 h-12 text-[#4a5568] mx-auto mb-4" />
              <p className="font-mono text-[#718096]">暂无挂起任务</p>
              <p className="font-mono text-xs text-[#4a5568] mt-1">
                系统检测到重复样本或口径变更时会自动挂起
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <SuspendedTaskCard
                  key={task.id}
                  task={task}
                  onResolve={handleResolve}
                  onViewSession={handleViewSession}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PendingQueuePage;
