import { useState } from 'react';
import { AlertTriangle, GitCompare, Lightbulb, CheckCircle, XCircle, Flag, SkipForward, Edit3 } from 'lucide-react';
import type { Conflict, GameSession, ConflictResolution } from '@/types';
import { CONFLICT_TYPE_LABELS } from '@/types';
import { formatNumber } from '@/utils/helpers';

interface ConflictPanelProps {
  conflicts: Conflict[];
  session: GameSession | null;
  onResolve: (
    conflict: Conflict,
    resolution: ConflictResolution,
    resolvedBy: string,
    notes?: string
  ) => void;
  onClose: () => void;
}

export function ConflictPanel({
  conflicts,
  session,
  onResolve,
  onClose,
}: ConflictPanelProps) {
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(
    conflicts.length > 0 ? conflicts[0].id : null
  );
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');

  const selectedConflict = conflicts.find((c) => c.id === selectedConflictId);

  const handleResolve = (resolution: ConflictResolution) => {
    if (!selectedConflict) return;
    if (!resolvedBy.trim()) {
      alert('请输入处理人姓名');
      return;
    }
    onResolve(selectedConflict, resolution, resolvedBy.trim(), resolutionNotes.trim() || undefined);
    setResolutionNotes('');
    if (conflicts.length > 1) {
      const nextIndex = conflicts.findIndex((c) => c.id !== selectedConflictId);
      if (nextIndex >= 0) {
        setSelectedConflictId(conflicts[nextIndex].id);
      }
    }
  };

  const renderEvidence = (data: any, source: string) => {
    if (!data) return <span className="text-white/50">无数据</span>;

    if (typeof data === 'string') {
      return <span className="text-white">{data}</span>;
    }

    if (typeof data === 'object') {
      return (
        <div className="space-y-1">
          {Object.entries(data).map(([key, value]) => {
            if (value === null || value === undefined) {
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-white/60">{key}:</span>
                  <span className="text-danger-400">空值</span>
                </div>
              );
            }
            if (typeof value === 'number') {
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-white/60">{key}:</span>
                  <span className="text-white font-mono">{formatNumber(value)}</span>
                </div>
              );
            }
            return (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-white/60">{key}:</span>
                <span className="text-white">{String(value)}</span>
              </div>
            );
          })}
        </div>
      );
    }

    return <span className="text-white">{String(data)}</span>;
  };

  if (conflicts.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success-400" />
          <p className="text-lg text-white mb-2">没有检测到冲突</p>
          <p className="text-sm text-white/50 mb-6">所有数据已正常处理</p>
          <button onClick={onClose} className="btn-primary">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-accent-400 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-warning-400" />
            数据冲突处理
          </h2>
          <p className="text-sm text-white/60 mt-1">
            共检测到 {conflicts.length} 处冲突，请逐一处理
          </p>
        </div>
        <button onClick={onClose} className="btn-secondary">
          关闭
        </button>
      </div>

      {session && (
        <div className="card p-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/60">玩家：</span>
            <span className="text-white font-medium">{session.playerName}</span>
            <span className="text-white/60 ml-4">关卡：</span>
            <span className="text-white">{session.levelName}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-sm font-medium text-white/80 mb-3">冲突列表</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {conflicts.map((conflict, index) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflictId(conflict.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedConflictId === conflict.id
                      ? 'bg-accent-500/20 border-accent-500'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-warning-500/30 text-warning-300 text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className={`text-sm font-medium ${
                          selectedConflictId === conflict.id ? 'text-accent-400' : 'text-white'
                        }`}>
                          {CONFLICT_TYPE_LABELS[conflict.type]}
                        </span>
                      </div>
                      {conflict.stepIndex !== undefined && (
                        <p className="text-xs text-white/50 mt-1 ml-7">
                          步骤 {conflict.stepIndex + 1}
                        </p>
                      )}
                    </div>
                    {conflict.resolution && (
                      <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedConflict && (
            <>
              <div className="card">
                <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
                  <GitCompare className="w-5 h-5" />
                  冲突详情：{CONFLICT_TYPE_LABELS[selectedConflict.type]}
                </h3>

                {selectedConflict.stepIndex !== undefined && (
                  <p className="text-sm text-white/70 mb-4">
                    发生在第 {selectedConflict.stepIndex + 1} 步
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-primary-900/30 rounded-lg border border-primary-500/30">
                    <h4 className="text-sm font-medium text-primary-400 mb-3">学生记录</h4>
                    {renderEvidence(selectedConflict.studentRecord, 'student')}
                  </div>
                  <div className="p-4 bg-accent-900/30 rounded-lg border border-accent-500/30">
                    <h4 className="text-sm font-medium text-accent-400 mb-3">系统计算</h4>
                    {renderEvidence(selectedConflict.importedData, 'imported')}
                  </div>
                </div>

                {selectedConflict.evidence.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-white/80 mb-2">证据链</h4>
                    <div className="space-y-2">
                      {selectedConflict.evidence.map((evi, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg text-sm">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs mr-2 ${
                            evi.source === 'student' ? 'bg-primary-500/30 text-primary-300' :
                            evi.source === 'imported' ? 'bg-accent-500/30 text-accent-300' :
                            'bg-white/10 text-white/70'
                          }`}>
                            {evi.source === 'student' ? '学生' : evi.source === 'imported' ? '系统' : '系统'}
                          </span>
                          <span className="text-white/80">{evi.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedConflict.suggestedActions.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-warning-400" />
                    建议处理方式
                  </h3>
                  <div className="space-y-3">
                    {selectedConflict.suggestedActions.map((action, index) => (
                      <div key={action.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="font-medium text-white mb-1">{index + 1}. {action.label}</h4>
                        <p className="text-sm text-white/60 mb-2">{action.description}</p>
                        <p className="text-xs text-warning-400">影响：{action.consequence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <h3 className="text-lg font-bold text-accent-400 mb-4">选择处理方式</h3>
                
                <div className="mb-4">
                  <label className="block text-sm text-white/70 mb-2">处理人</label>
                  <input
                    type="text"
                    value={resolvedBy}
                    onChange={(e) => setResolvedBy(e.target.value)}
                    placeholder="请输入处理人姓名"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-white/70 mb-2">处理备注（可选）</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="请输入处理说明..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleResolve('use_student')}
                    className="btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    采用学生记录
                  </button>
                  <button
                    onClick={() => handleResolve('use_imported')}
                    className="btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    采用系统计算
                  </button>
                  <button
                    onClick={() => handleResolve('manual')}
                    className="btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    手动修改
                  </button>
                  <button
                    onClick={() => handleResolve('skip')}
                    className="btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <SkipForward className="w-4 h-4" />
                    跳过
                  </button>
                  <button
                    onClick={() => handleResolve('flag_for_review')}
                    className="btn-accent text-sm flex items-center justify-center gap-1"
                  >
                    <Flag className="w-4 h-4" />
                    标记待复核
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
