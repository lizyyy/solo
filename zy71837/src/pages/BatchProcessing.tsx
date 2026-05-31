import React, { useState } from 'react';
import { Settings, Play, CheckCircle, XCircle, RefreshCw, Hash, Terminal } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { BatchExecution } from '@/types';

export const BatchProcessing: React.FC = () => {
  const { batchTasks, currentExecution, runBatchTask, idempotentExecutor } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<BatchExecution[]>([]);

  React.useEffect(() => {
    if (idempotentExecutor) {
      setExecutionHistory(idempotentExecutor.getAllExecutions());
    }
  }, [currentExecution, idempotentExecutor]);

  const handleRunTask = (taskId: string) => {
    setConfirmDialog(taskId);
  };

  const confirmRun = async () => {
    if (!confirmDialog) return;
    try {
      await runBatchTask(confirmDialog);
      setExecutionHistory(idempotentExecutor?.getAllExecutions() || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : '执行失败');
    }
    setConfirmDialog(null);
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'import': return 'bg-success-100 text-success-700';
      case 'batch': return 'bg-info-100 text-info-700';
      case 'correct': return 'bg-warning-100 text-warning-700';
      case 'delete': return 'bg-danger-100 text-danger-700';
      default: return 'bg-primary-100 text-primary-700';
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'import': return '导入';
      case 'batch': return '批量';
      case 'correct': return '修正';
      case 'delete': return '删除';
      default: return type;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            <h1 className="font-mono font-bold text-lg text-primary-800">批量处理</h1>
          </div>
          <span className="text-sm text-primary-500 font-mono">
            共 {batchTasks.length} 个任务
          </span>
        </div>
        {currentExecution && currentExecution.status === 'running' && (
          <div className="flex items-center gap-2 text-sm text-info-600 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            任务运行中...
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="grid gap-4">
            {batchTasks.map(task => (
              <div
                key={task.id}
                className={`border border-primary-200 bg-white hover:shadow-sm transition-shadow ${
                  selectedTask === task.id ? 'ring-2 ring-info-500' : ''
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-mono font-semibold text-primary-800">{task.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-mono ${getTaskTypeColor(task.operationType)}`}>
                          {getTaskTypeLabel(task.operationType)}
                        </span>
                        {task.isIdempotent && (
                          <span className="px-2 py-0.5 text-xs font-mono bg-primary-100 text-primary-700">
                            幂等
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-primary-400">配置:</span>
                          <span className="ml-2 text-primary-600">{JSON.stringify(task.config)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-primary-400" />
                          <span className="text-primary-400">幂等键:</span>
                          <span className="ml-1 text-primary-600">{task.idempotencyKey.substring(0, 16)}...</span>
                        </div>
                        <div>
                          <span className="text-primary-400">最大执行:</span>
                          <span className="ml-2 text-primary-600">{task.maxRuns} 次</span>
                        </div>
                        <div>
                          <span className="text-primary-400">创建时间:</span>
                          <span className="ml-2 text-primary-600">{new Date(task.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunTask(task.id);
                        }}
                        disabled={currentExecution?.status === 'running'}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-info-600 text-white hover:bg-info-700 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        执行
                      </button>
                    </div>
                  </div>
                </div>

                {selectedTask === task.id && (
                  <div className="px-4 pb-4 border-t border-primary-100">
                    <div className="pt-4">
                      <h4 className="font-mono text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        执行历史
                      </h4>
                      {executionHistory.filter(e => e.taskId === task.id).length === 0 ? (
                        <p className="text-sm text-primary-400 font-mono">暂无执行记录</p>
                      ) : (
                        <div className="space-y-2">
                          {executionHistory
                            .filter(e => e.taskId === task.id)
                            .map(exec => (
                              <div key={exec.id} className="p-3 bg-primary-50 border border-primary-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={exec.status} size="sm" />
                                    <span className="font-mono text-xs text-primary-500">
                                      {new Date(exec.startTime).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs font-mono">
                                    <span className="text-success-600">成功: {exec.successCount}</span>
                                    <span className="text-danger-600">失败: {exec.failCount}</span>
                                  </div>
                                </div>
                                {exec.status === 'running' && (
                                  <ProgressBar progress={exec.progress} variant="info" />
                                )}
                                <details className="mt-2">
                                  <summary className="text-xs text-info-600 cursor-pointer font-mono">
                                    查看执行日志 ({exec.logs.length} 条)
                                  </summary>
                                  <div className="mt-2 p-2 bg-black text-green-400 text-xs font-mono max-h-40 overflow-y-auto">
                                    {exec.logs.map((log, i) => (
                                      <div key={i}>{log}</div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {currentExecution && (
            <div className="fixed bottom-4 right-4 w-96 bg-white border border-primary-300 shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {currentExecution.status === 'running' ? (
                    <RefreshCw className="w-4 h-4 text-info-500 animate-spin" />
                  ) : currentExecution.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-success-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-danger-500" />
                  )}
                  <span className="font-mono font-medium text-primary-700">
                    {batchTasks.find(t => t.id === currentExecution.taskId)?.name}
                  </span>
                </div>
                <StatusBadge status={currentExecution.status} size="sm" />
              </div>
              
              {currentExecution.status === 'running' && (
                <ProgressBar progress={currentExecution.progress} variant="info" />
              )}
              
              <div className="flex items-center justify-between mt-3 text-xs font-mono">
                <span className="text-success-600">成功: {currentExecution.successCount}</span>
                <span className="text-danger-600">失败: {currentExecution.failCount}</span>
              </div>
              
              <details className="mt-3">
                <summary className="text-xs text-info-600 cursor-pointer font-mono">
                  实时日志
                </summary>
                <div className="mt-2 p-2 bg-black text-green-400 text-xs font-mono max-h-32 overflow-y-auto">
                  {currentExecution.logs.slice(-10).map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="确认执行批量任务"
        message={(() => {
          const task = batchTasks.find(t => t.id === confirmDialog);
          if (!task) return '';
          let msg = `任务名称: ${task.name}\n`;
          msg += `操作类型: ${getTaskTypeLabel(task.operationType)}\n`;
          if (task.isIdempotent) {
            msg += `\n此任务启用了幂等保护，相同参数重复执行不会产生副作用。\n`;
            msg += `幂等键: ${task.idempotencyKey.substring(0, 24)}...\n`;
          } else {
            msg += `\n警告: 此任务未启用幂等保护，重复执行可能产生累积影响！\n`;
          }
          msg += `\n确定要执行此任务吗？`;
          return msg;
        })()}
        variant={batchTasks.find(t => t.id === confirmDialog)?.isIdempotent ? 'default' : 'warning'}
        confirmText="确认执行"
        onConfirm={confirmRun}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};
