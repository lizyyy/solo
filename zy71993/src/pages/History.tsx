import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { SEVERITY_LABEL, ISSUE_TYPE_LABEL, SEVERITY_COLORS } from '@/types';
import type { VerificationIssue } from '@/types';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export default function History() {
  const { history, resolveHistoryIssue, result } = useStore();
  const machineIds = Object.keys(history);

  const [selectedMachine, setSelectedMachine] = useState<string>(machineIds[0] || '');

  const records = selectedMachine ? (history[selectedMachine] || []) : [];

  const currentMachineId = result?.machineId || selectedMachine;

  const allRecords = currentMachineId ? (history[currentMachineId] || []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">历史对比</h2>
        <p className="text-sm text-slate-500 mt-1">跨周核验时查看上次遗留问题</p>
      </div>

      <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-4">
        <label className="block text-xs font-medium text-slate-400 mb-2">选择机器</label>
        <div className="flex items-center gap-3">
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="bg-navy-900 border border-navy-500/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-cyan/50"
          >
            {machineIds.length === 0 && <option value="">暂无历史记录</option>}
            {machineIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
            {result && !machineIds.includes(result.machineId) && (
              <option value={result.machineId}>{result.machineId} (当前)</option>
            )}
          </select>
          {result && (
            <button
              onClick={() => setSelectedMachine(result.machineId)}
              className="text-xs text-accent-cyan hover:underline"
            >
              切换到当前核验机器
            </button>
          )}
        </div>
      </div>

      {allRecords.length === 0 ? (
        <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-12 text-center">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">该机器尚无历史核验记录</p>
          <p className="text-slate-600 text-xs mt-1">执行核验后，结果将自动保存</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allRecords.map((record, ri) => {
            const isLatest = ri === allRecords.length - 1;
            const unresolvedIssues = record.issues.filter(
              (issue) => !record.resolvedIssueIds.includes(issue.id)
            );
            const resolvedIssues = record.issues.filter((issue) =>
              record.resolvedIssueIds.includes(issue.id)
            );

            return (
              <div
                key={record.verificationDate}
                className={`bg-navy-800/80 rounded-xl border overflow-hidden ${
                  isLatest ? 'border-accent-cyan/20' : 'border-navy-500/30'
                }`}
              >
                <div className="px-5 py-3 border-b border-navy-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isLatest && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
                        最近
                      </span>
                    )}
                    <span className="text-sm text-white font-medium">
                      {new Date(record.verificationDate).toLocaleString('zh-CN')}
                    </span>
                    <span className="text-xs text-slate-500">
                      共 {record.issues.length} 个问题
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-accent-green">{resolvedIssues.length} 已处理</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-accent-amber">{unresolvedIssues.length} 遗留</span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {unresolvedIssues.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-accent-amber font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> 遗留问题
                      </p>
                      {unresolvedIssues.map((issue: VerificationIssue) => (
                        <div
                          key={issue.id}
                          className="flex items-start gap-3 bg-accent-amber/5 border border-accent-amber/20 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs font-medium ${SEVERITY_COLORS[issue.severity]}`}>
                                {SEVERITY_LABEL[issue.severity]}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {ISSUE_TYPE_LABEL[issue.type]}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{issue.description}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{issue.path}</p>
                          </div>
                          <button
                            onClick={() => resolveHistoryIssue(currentMachineId, record.verificationDate, issue.id)}
                            className="text-[10px] px-2 py-1 rounded bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 transition-colors flex-shrink-0"
                          >
                            标记已处理
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {resolvedIssues.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-accent-green font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已处理
                      </p>
                      {resolvedIssues.map((issue: VerificationIssue) => (
                        <div
                          key={issue.id}
                          className="flex items-center gap-3 bg-accent-green/5 border border-accent-green/20 rounded-lg px-3 py-2 opacity-60"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
                          <p className="text-xs text-slate-400 line-through">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {record.issues.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-2">本次核验无异常</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
