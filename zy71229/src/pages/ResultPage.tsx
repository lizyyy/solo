import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RotateCcw, Play, Home, CheckCircle, XCircle, Clock, Target, FileText, Shield } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { exportToJSON, exportToCSV, downloadFile, generateReportFilename } from '../utils/export';
import { SourceBadge } from '../components/common/SourceBadge';
import { ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS, DataSource } from '../game/types';
import { formatGameTime, formatVirtualTime } from '../game/engine';

export const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, resetGame } = useGameStore();
  const { history } = useHistoryStore();
  const [showExportOptions, setShowExportOptions] = useState(false);

  useEffect(() => {
    if (!state.isGameOver || state.score.length === 0) {
      navigate('/');
    }
  }, [state.isGameOver, state.score.length, navigate]);

  const currentRecord = history.find(h => h.gameId === state.id);

  const handleExportJSON = () => {
    const content = exportToJSON(state);
    const filename = generateReportFilename(state, 'json');
    downloadFile(content, filename, 'application/json');
    setShowExportOptions(false);
  };

  const handleExportCSV = () => {
    const content = exportToCSV(state);
    const filename = generateReportFilename(state, 'csv');
    downloadFile(content, filename, 'text/csv');
    setShowExportOptions(false);
  };

  const handleNewGame = () => {
    resetGame();
    navigate('/game');
  };

  const handleReplay = () => {
    if (currentRecord) {
      navigate(`/replay/${currentRecord.replayDataId}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-alert-green';
    if (score >= 60) return 'text-alert-yellow';
    return 'text-alert-red';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { grade: 'S', color: 'text-alert-green', desc: '优秀' };
    if (score >= 80) return { grade: 'A', color: 'text-alert-green', desc: '良好' };
    if (score >= 70) return { grade: 'B', color: 'text-alert-blue', desc: '合格' };
    if (score >= 60) return { grade: 'C', color: 'text-alert-yellow', desc: '需改进' };
    return { grade: 'D', color: 'text-alert-red', desc: '不合格' };
  };

  const grade = getScoreGrade(state.totalScore);

  const correctDecisions = state.decisions.filter(d => d.isCorrect).length;
  const accuracy = state.decisions.length > 0 ? Math.round((correctDecisions / state.decisions.length) * 100) : 0;
  const patrolledCorners = state.corners.filter(c => c.isPatrolled).length;
  const coverage = Math.round((patrolledCorners / state.corners.length) * 100);

  const getEvidenceUsedText = (sources: DataSource[]) => {
    if (sources.length === 0) return '未查看任何数据源';
    if (sources.length >= 3) return `交叉验证 ${sources.length} 个数据源`;
    return `查看了 ${sources.length} 个数据源`;
  };

  return (
    <div className="min-h-screen bg-night-700 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-mono text-white mb-2">夜巡任务结算</h1>
          <p className="text-gray-400">
            {new Date(state.startTime).toLocaleString('zh-CN')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="panel p-6 text-center">
            <div className={`text-7xl font-bold font-mono ${grade.color} mb-2`}>
              {grade.grade}
            </div>
            <div className="text-gray-400">{grade.desc}</div>
            <div className={`mt-4 text-4xl font-bold font-mono ${getScoreColor(state.totalScore)}`}>
              {state.totalScore}
            </div>
            <div className="text-xs text-gray-500">总分 100</div>
          </div>

          <div className="panel p-6">
            <h3 className="panel-title mb-4">核心指标</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircle size={16} />
                  <span>决策准确率</span>
                </div>
                <span className={`font-mono font-bold ${accuracy >= 70 ? 'text-alert-green' : 'text-alert-red'}`}>
                  {accuracy}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Target size={16} />
                  <span>巡逻覆盖率</span>
                </div>
                <span className={`font-mono font-bold ${coverage >= 80 ? 'text-alert-green' : 'text-alert-red'}`}>
                  {coverage}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock size={16} />
                  <span>用时</span>
                </div>
                <span className="font-mono font-bold text-gray-300">
                  {formatGameTime(state.gameTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <Shield size={16} />
                  <span>异常处理</span>
                </div>
                <span className="font-mono font-bold text-gray-300">
                  {correctDecisions}/{state.decisions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <h3 className="panel-title mb-4">操作</h3>
            <div className="space-y-3">
              <button
                onClick={handleNewGame}
                className="w-full glow-btn-primary py-3 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                重新开局
              </button>
              <button
                onClick={handleReplay}
                className="w-full glow-btn py-3 flex items-center justify-center gap-2"
                disabled={!currentRecord}
              >
                <Play size={18} />
                复盘回放
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className="w-full glow-btn py-3 flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  导出报告
                </button>
                {showExportOptions && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-night-500 border border-gray-600 z-10">
                    <button
                      onClick={handleExportJSON}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-night-400 transition-colors"
                    >
                      导出 JSON 格式
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-night-400 transition-colors"
                    >
                      导出 CSV 格式
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full glow-btn py-3 flex items-center justify-center gap-2"
              >
                <Home size={18} />
                返回主页
              </button>
            </div>
          </div>
        </div>

        <div className="panel mb-8">
          <div className="panel-header">
            <span className="panel-title">评分明细</span>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {state.score.map((item, index) => (
                <div key={index} className="border-b border-gray-700/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-200">{item.category}</span>
                    <span className={`font-mono font-bold ${
                      item.points >= item.maxPoints * 0.7 ? 'text-alert-green' : 
                      item.points >= item.maxPoints * 0.4 ? 'text-alert-yellow' : 'text-alert-red'
                    }`}>
                      {item.points} / {item.maxPoints}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-night-700 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full transition-all ${
                        item.points >= item.maxPoints * 0.7 ? 'bg-alert-green' : 
                        item.points >= item.maxPoints * 0.4 ? 'bg-alert-yellow' : 'bg-alert-red'
                      }`}
                      style={{ width: `${(item.points / item.maxPoints) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel mb-8">
          <div className="panel-header">
            <span className="panel-title">关键选择时间线</span>
            <span className="text-xs text-gray-500">
              共 {state.decisions.length} 个决策记录
            </span>
          </div>
          <div className="p-4">
            {state.decisions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p>无决策记录</p>
              </div>
            ) : (
              <div className="relative">
                {state.decisions.map((decision, index) => {
                  const anomaly = state.anomalies.find(a => a.id === decision.anomalyId);
                  if (!anomaly) return null;

                  return (
                    <div
                      key={decision.id}
                      className={`timeline-node ${decision.isCorrect ? 'correct' : 'incorrect'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {decision.isCorrect ? (
                              <CheckCircle size={16} className="text-alert-green" />
                            ) : (
                              <XCircle size={16} className="text-alert-red" />
                            )}
                            <span className="font-medium text-gray-200">
                              {ANOMALY_TYPE_LABELS[anomaly.type]}
                            </span>
                            <SourceBadge source={anomaly.source} />
                          </div>
                          <p className="text-sm text-gray-400 ml-6">{anomaly.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-gray-400">
                            {formatVirtualTime(decision.timestamp)}
                          </div>
                          <div className="font-mono text-xs text-gray-500">
                            {formatGameTime(decision.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div className="ml-6 space-y-1">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">玩家选择:</span>
                          <span className={decision.isCorrect ? 'text-alert-green' : 'text-alert-red'}>
                            {ANOMALY_STATUS_LABELS[decision.choice]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">正确动作:</span>
                          <span className="text-alert-green">
                            {ANOMALY_STATUS_LABELS[anomaly.correctAction]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">决策耗时:</span>
                          <span className="text-gray-300 font-mono">{decision.timeSpent} 秒</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">证据查阅:</span>
                          <span className={`font-mono text-xs ${
                            decision.evidenceUsed.length >= 3 ? 'text-alert-green' :
                            decision.evidenceUsed.length === 0 ? 'text-alert-red' : 'text-alert-yellow'
                          }`}>
                            {getEvidenceUsedText(decision.evidenceUsed)}
                          </span>
                        </div>
                        {!decision.isCorrect && (
                          <div className="mt-2 p-3 bg-night-700 border-l-2 border-alert-yellow">
                            <div className="text-xs text-alert-yellow font-medium mb-1">培训注解</div>
                            <p className="text-sm text-gray-400">{anomaly.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">夜巡报告草稿</span>
          </div>
          <div className="p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-night-700 p-4 min-h-32 font-sans">
              {state.reportDraft || '（无报告内容）'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
