import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Clock, User, Calendar, RefreshCw, FileText, Eye, Trash2 } from 'lucide-react';
import { getAllAttempts, getAttemptsByPlayer, compareSubmissions, clearAllData, getPlayer } from '../utils/storage';
import { Attempt } from '../types';
import { LEVELS } from '../data/levels';

const History: React.FC = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[]>(getAllAttempts());
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState<{ old: Attempt; new: Attempt } | null>(null);

  const player = getPlayer();

  const groupedByPlayer = React.useMemo(() => {
    const groups: Record<string, Attempt[]> = {};
    attempts.forEach(attempt => {
      if (!groups[attempt.playerName]) {
        groups[attempt.playerName] = [];
      }
      groups[attempt.playerName].push(attempt);
    });
    return groups;
  }, [attempts]);

  const filteredAttempts = React.useMemo(() => {
    if (selectedPlayer) {
      return attempts.filter(a => a.playerName === selectedPlayer).sort((a, b) => b.endTime - a.endTime);
    }
    return attempts.sort((a, b) => b.endTime - a.endTime);
  }, [attempts, selectedPlayer]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start: number, end: number) => {
    const seconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getLevelName = (levelId: string) => {
    return LEVELS.find(l => l.id === levelId)?.name || levelId;
  };

  const handleCompareToggle = (attemptId: string) => {
    if (compareItems.includes(attemptId)) {
      setCompareItems(compareItems.filter(id => id !== attemptId));
    } else if (compareItems.length < 2) {
      setCompareItems([...compareItems, attemptId]);
    }
  };

  const handleShowCompare = () => {
    if (compareItems.length === 2) {
      const old = attempts.find(a => a.id === compareItems[0]);
      const newAttempt = attempts.find(a => a.id === compareItems[1]);
      if (old && newAttempt) {
        const sorted = [old, newAttempt].sort((a, b) => a.endTime - b.endTime);
        setShowDiff({ old: sorted[0], new: sorted[1] });
      }
    }
  };

  const handleClearData = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      clearAllData();
      setAttempts([]);
    }
  };

  const getDiffInfo = (old: Attempt, newAttempt: Attempt) => {
    return compareSubmissions(old, newAttempt);
  };

  return (
    <div className="min-h-screen cyber-grid p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary hover:border-cyber-primary transition-all"
          >
            <ArrowLeft size={18} />
            <span>返回主页</span>
          </button>
          
          <h1 className="text-2xl font-orbitron font-bold text-cyber-primary">
            历史记录
          </h1>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                compareMode
                  ? 'bg-cyber-secondary/20 text-cyber-secondary border border-cyber-secondary'
                  : 'border border-cyber-muted/30 text-cyber-muted hover:text-cyber-secondary'
              }`}
            >
              <RefreshCw size={18} className={compareMode ? 'animate-spin' : ''} />
              <span>对比模式</span>
            </button>
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-danger/30 text-cyber-danger hover:bg-cyber-danger/10 transition-all"
            >
              <Trash2 size={18} />
              <span>清空</span>
            </button>
          </div>
        </div>

        {compareMode && (
          <div className="mb-6 p-4 rounded-xl border border-cyber-secondary bg-cyber-secondary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-cyber-secondary font-bold">对比模式: 已选择 {compareItems.length}/2 条记录</span>
                {compareItems.length === 2 && (
                  <button
                    onClick={handleShowCompare}
                    className="px-4 py-2 rounded-lg bg-cyber-secondary text-cyber-bg font-bold hover:shadow-neon-pink transition-all"
                  >
                    查看对比
                  </button>
                )}
              </div>
              <button
                onClick={() => { setCompareItems([]); setShowDiff(null); }}
                className="text-cyber-muted hover:text-cyber-secondary text-sm"
              >
                清除选择
              </button>
            </div>
          </div>
        )}

        {showDiff && (
          <div className="mb-8 p-6 rounded-xl neon-border bg-cyber-card/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-orbitron text-cyber-primary font-bold text-xl">提交对比</h3>
              <button
                onClick={() => setShowDiff(null)}
                className="text-cyber-muted hover:text-cyber-primary"
              >
                ✕ 关闭
              </button>
            </div>

            {(() => {
              const diff = getDiffInfo(showDiff.old, showDiff.new);
              return (
                <div>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="p-4 rounded-lg border border-cyber-muted/30">
                      <h4 className="font-orbitron text-cyber-muted mb-4">旧提交 ({formatDate(showDiff.old.endTime)})</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">分数:</span>
                          <span className="font-orbitron text-cyber-primary">{showDiff.old.score}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">结果:</span>
                          <span className={showDiff.old.passed ? 'text-cyber-success' : 'text-cyber-danger'}>
                            {showDiff.old.passed ? '通过' : '未通过'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">操作次数:</span>
                          <span className="font-orbitron">{showDiff.old.operationLogs.length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border border-cyber-primary">
                      <h4 className="font-orbitron text-cyber-primary mb-4">新提交 ({formatDate(showDiff.new.endTime)})</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">分数:</span>
                          <span className={`font-orbitron ${diff.changes.score ? 'text-cyber-accent' : 'text-cyber-primary'}`}>
                            {showDiff.new.score}%
                            {diff.changes.score && (
                              <span className="ml-2 text-xs">
                                ({showDiff.new.score > showDiff.old.score ? '+' : ''}{showDiff.new.score - showDiff.old.score})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">结果:</span>
                          <span className={showDiff.new.passed ? 'text-cyber-success' : 'text-cyber-danger'}>
                            {showDiff.new.passed ? '通过' : '未通过'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cyber-muted">操作次数:</span>
                          <span className="font-orbitron">{showDiff.new.operationLogs.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-cyber-bg">
                    <h5 className="font-orbitron text-cyber-accent mb-3">变更详情</h5>
                    {diff.isDuplicate ? (
                      <div className="text-cyber-muted text-sm">此为重复提交，无内容变更</div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {diff.updatedFields.map(field => (
                          <div key={field} className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded bg-cyber-accent/20 text-cyber-accent text-xs">更新</span>
                            <span className="text-cyber-primary">{field}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedPlayer(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-orbitron transition-all ${
              selectedPlayer === null
                ? 'bg-cyber-primary text-cyber-bg shadow-neon-cyan'
                : 'border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary'
            }`}
          >
            全部
          </button>
          {Object.keys(groupedByPlayer).map(playerName => (
            <button
              key={playerName}
              onClick={() => setSelectedPlayer(playerName)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-orbitron transition-all ${
                selectedPlayer === playerName
                  ? 'bg-cyber-primary text-cyber-bg shadow-neon-cyan'
                  : 'border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary'
              }`}
            >
              <User size={16} />
              {playerName}
              <span className="text-xs opacity-70">({groupedByPlayer[playerName].length})</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredAttempts.length === 0 ? (
            <div className="text-center py-16 text-cyber-muted">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无闯关记录</p>
            </div>
          ) : (
            filteredAttempts.map(attempt => (
              <div
                key={attempt.id}
                className={`p-4 rounded-xl transition-all border ${
                  compareItems.includes(attempt.id)
                    ? 'neon-border-pink bg-cyber-secondary/10'
                    : 'neon-border bg-cyber-card/50 hover:bg-cyber-card/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {compareMode && (
                      <button
                        onClick={() => handleCompareToggle(attempt.id)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          compareItems.includes(attempt.id)
                            ? 'bg-cyber-secondary border-cyber-secondary text-cyber-bg'
                            : 'border-cyber-muted/50 hover:border-cyber-secondary'
                        }`}
                      >
                        {compareItems.includes(attempt.id) && '✓'}
                      </button>
                    )}
                    
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      attempt.passed ? 'bg-cyber-success/20' : 'bg-cyber-danger/20'
                    }`}>
                      {attempt.passed ? (
                        <Trophy className="text-cyber-success" size={24} />
                      ) : (
                        <span className="text-cyber-danger text-2xl font-bold">✕</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-orbitron text-cyber-primary font-bold">
                          {getLevelName(attempt.levelId)}
                        </span>
                        <span className={`text-2xl font-orbitron font-bold ${
                          attempt.passed ? 'text-cyber-success' : 'text-cyber-danger'
                        }`}>
                          {attempt.score}%
                        </span>
                        {attempt.isUpdate && (
                          <span className="px-2 py-0.5 rounded bg-cyber-accent/20 text-cyber-accent text-xs">
                            更新
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-cyber-muted mt-1">
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          {attempt.playerName}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(attempt.endTime)} {formatTime(attempt.endTime)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          用时 {formatDuration(attempt.startTime, attempt.endTime)}
                        </div>
                        <div>
                          {attempt.operationLogs.length} 次操作
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-cyber-muted mb-1">批次</div>
                      <div className="font-orbitron text-cyber-primary text-sm">{attempt.submissionBatch}</div>
                    </div>
                    <button
                      onClick={() => navigate(`/result/${attempt.id}`)}
                      className="cyber-btn flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-primary/20 text-cyber-primary hover:bg-cyber-primary/30 transition-all"
                    >
                      <Eye size={16} />
                      <span>查看详情</span>
                    </button>
                  </div>
                </div>

                {attempt.isUpdate && attempt.updatedFields.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-cyber-muted/20">
                    <div className="flex items-center gap-2 text-xs text-cyber-accent">
                      <RefreshCw size={14} />
                      <span>更新内容: {attempt.updatedFields.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
