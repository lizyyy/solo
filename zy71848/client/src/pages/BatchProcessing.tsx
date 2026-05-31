import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import StatusBadge from '../components/StatusBadge';
import ChangeTypeBadge from '../components/ChangeTypeBadge';
import { Play, RefreshCw, CheckCircle, AlertTriangle, Layers, Clock, Hash } from 'lucide-react';

export default function BatchProcessing() {
  const {
    batchTasks,
    inspections,
    loading,
    error,
    fetchBatchTasks,
    fetchInspections,
    runBatchTask,
  } = useStore();

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchBatchTasks();
    fetchInspections();
  }, [fetchBatchTasks, fetchInspections]);

  const getInspectionName = (id: string) => {
    const inspection = inspections.find((i) => i.id === id);
    return inspection ? inspection.name : `记录 ${id}`;
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const handleRunTask = async (taskId: string) => {
    await runBatchTask(taskId);
    setExpandedTaskId(taskId);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">批量处理</h1>
        <p className="text-slate-600 mt-1">幂等校验确保重复运行不会越跑越多、越改越乱</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {batchTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded flex items-center justify-center">
                    <Layers size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{task.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Hash size={14} />
                        {task.inspectionIds.length} 条记录
                      </span>
                      <span className="flex items-center gap-1">
                        <RefreshCw size={14} />
                        已运行 {task.runCount} 次
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDateTime(task.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <div className="text-slate-500">累计变更</div>
                    <div className="font-mono font-semibold">
                      <span className="text-red-600">{task.conclusionChanges}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-600">{task.materialOnlyChanges}</span>
                      <span className="text-slate-400 ml-1 text-xs">改结论/补材料</span>
                    </div>
                  </div>
                  <StatusBadge status={task.status} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunTask(task.id);
                    }}
                    disabled={loading || task.status === 'running'}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded border-2 border-primary-700 hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    运行
                  </button>
                </div>
              </div>
            </div>

            {expandedTaskId === task.id && (
              <div className="border-t-2 border-slate-100 p-4 bg-slate-50">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">运行记录</h4>
                  <div className="space-y-3">
                    {task.runs.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                        暂无运行记录，点击「运行」开始处理
                      </div>
                    ) : (
                      task.runs.map((run) => (
                        <div
                          key={run.id}
                          className="bg-white border-2 border-slate-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-mono text-sm font-bold text-slate-600">
                                #{run.runNumber}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">
                                  第 {run.runNumber} 次运行
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatDateTime(run.startTime)} - {formatDateTime(run.endTime)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {run.idempotentCheckPassed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                                  <CheckCircle size={12} />
                                  幂等校验通过
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                                  <AlertTriangle size={12} />
                                  校验异常
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="bg-slate-50 rounded p-3 text-center">
                              <div className="text-2xl font-mono font-bold text-slate-900">
                                {run.processedCount}
                              </div>
                              <div className="text-xs text-slate-500">处理总数</div>
                            </div>
                            <div className="bg-amber-50 rounded p-3 text-center">
                              <div className="text-2xl font-mono font-bold text-amber-600">
                                {run.skippedCount}
                              </div>
                              <div className="text-xs text-slate-500">跳过（未变更）</div>
                            </div>
                            <div className="bg-primary-50 rounded p-3 text-center">
                              <div className="text-2xl font-mono font-bold text-primary-600">
                                {run.changedCount}
                              </div>
                              <div className="text-xs text-slate-500">实际变更</div>
                            </div>
                          </div>

                          {run.changes.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-slate-600 mb-2">
                                变更明细
                              </div>
                              <div className="space-y-2">
                                {run.changes.map((change, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded text-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <ChangeTypeBadge type={change.changeType as any} />
                                      <span className="text-slate-700">
                                        {getInspectionName(change.inspectionId)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500 text-xs">
                                        {change.description}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          change.affectsConclusion
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-slate-200 text-slate-600'
                                        }`}
                                      >
                                        {change.affectsConclusion ? '改结论' : '补材料'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {run.changes.length === 0 && run.skippedCount > 0 && (
                            <div className="text-center py-3 text-slate-500 text-sm bg-slate-50 rounded">
                              本次运行所有记录均未变更，已全部跳过
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">包含记录</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.inspectionIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center px-3 py-1 bg-white border-2 border-slate-200 rounded text-sm text-slate-700"
                      >
                        {getInspectionName(id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {batchTasks.length === 0 && (
          <div className="text-center py-12 bg-white border-2 border-dashed border-slate-200 rounded-lg">
            <Layers size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">暂无批量任务</p>
            <p className="text-sm text-slate-400 mt-1">在检查工作台选择记录后创建批量任务</p>
          </div>
        )}
      </div>

      <div className="mt-6 bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">幂等性说明</h3>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>• <strong>内容哈希校验：</strong>每次运行计算记录内容哈希，与上次运行比对</li>
          <li>• <strong>未变更跳过：</strong>哈希一致的记录直接跳过，不会重复处理</li>
          <li>• <strong>变更分类统计：</strong>自动区分「改结论」和「补材料」两类变更</li>
          <li>• <strong>运行轨迹可追溯：</strong>每次运行的处理、跳过、变更数量完整记录</li>
        </ul>
      </div>
    </div>
  );
}
