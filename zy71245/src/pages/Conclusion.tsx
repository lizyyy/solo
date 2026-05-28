import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Play, RotateCcw, Download, CheckCircle, XCircle, Clock, Target, Brain, Award, FileText, FileJson, Search } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ExportReport } from '../types';

export default function Conclusion() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const { 
    currentLevel, 
    currentSession, 
    loadSessions, 
    replaySessions,
    exportReport 
  } = useGameStore();
  
  const [showExplanations, setShowExplanations] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'choices' | 'expert'>('overview');

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const session = currentSession || replaySessions.find(s => s.levelId === levelId);

  if (!currentLevel || !session || !session.score) {
    return (
      <div className="min-h-screen bg-paper-100 flex items-center justify-center">
        <div className="text-ink-200 font-kai">加载中...</div>
      </div>
    );
  }

  const score = session.score;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-amber-500';
      case 'A': return 'text-seal-300';
      case 'B': return 'text-lapis-300';
      case 'C': return 'text-bronze-300';
      default: return 'text-ink-200';
    }
  };

  const getGradeBg = (grade: string) => {
    switch (grade) {
      case 'S': return 'bg-amber-50 border-amber-300';
      case 'A': return 'bg-seal-50 border-seal-300';
      case 'B': return 'bg-lapis-50 border-lapis-300';
      case 'C': return 'bg-bronze-50 border-bronze-300';
      default: return 'bg-paper-100 border-paper-300';
    }
  };

  const handleExportSummary = () => {
    const report = exportReport(session.id);
    const summaryText = generateSummaryText(report);
    
    const blob = new Blob([summaryText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `鉴定报告_摘要_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDetails = () => {
    const report = exportReport(session.id);
    const jsonStr = JSON.stringify(report, null, 2);
    
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `鉴定报告_明细_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateSummaryText = (report: ExportReport): string => {
    const { summary } = report;
    return `# 古画鉴定报告 - ${summary.levelTitle}

## 一、鉴定概况

**鉴定日期**：${new Date(report.details.timestamp).toLocaleDateString('zh-CN')}
**用时**：${Math.floor(summary.playTime / 60)}分${summary.playTime % 60}秒
**最终得分**：${summary.totalScore}分（${summary.grade}级）

## 二、鉴定人发现的关键疑点

${summary.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 三、专家鉴定结论要点

${summary.learningPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## 四、专家点评

${currentLevel.expertComments.map(c => `> **${c.expertName}**：${c.content}`).join('\n\n')}

---
*此报告由古画鉴定线索局系统自动生成*
`;
  };

  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-paper-100 bg-paper-texture">
      <div className="h-16 bg-gradient-to-r from-paper-200 via-paper-100 to-paper-200 border-b-2 border-paper-300 flex items-center px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-ink-200 hover:text-ink-300 transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="font-kai">返回首页</span>
        </button>

        <div className="flex-1 flex justify-center">
          <h1 className="font-kai text-xl text-ink-300">鉴定结论</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/game/${levelId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-lapis-100 text-lapis-300 rounded-lg font-kai hover:bg-lapis-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重新鉴定
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className={`inline-block p-8 rounded-2xl border-4 ${getGradeBg(score.grade)} mb-4`}>
            <div className={`text-8xl font-kai ${getGradeColor(score.grade)} mb-2`}>
              {score.grade}
            </div>
            <div className="font-kai text-2xl text-ink-300">
              {score.totalScore} 分
            </div>
          </div>
          <h2 className="text-3xl font-kai text-ink-300 mb-2">
            {score.grade === 'S' || score.grade === 'A' ? '鉴定大师！' : 
             score.grade === 'B' ? '鉴定高手！' : 
             score.grade === 'C' ? '初窥门径' : '继续努力'}
          </h2>
          <p className="text-ink-200 font-song">
            {currentLevel.title}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 text-center">
            <div className="w-12 h-12 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-3">
              <Target className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-3xl font-bold text-ink-300 mb-1">{score.accuracyScore}</div>
            <div className="font-kai text-ink-200">准确度分</div>
          </div>
          <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 text-center">
            <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-ink-300 mb-1">{score.discoveryScore}</div>
            <div className="font-kai text-ink-200">发现率分</div>
          </div>
          <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 text-center">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-ink-300 mb-1">{score.logicScore}</div>
            <div className="font-kai text-ink-200">逻辑分</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-paper-50 rounded-lg border border-paper-300 mb-8"
        >
          <div className="flex border-b border-paper-300">
            {[
              { id: 'overview', label: '概览', icon: <Award className="w-4 h-4" /> },
              { id: 'choices', label: '选择回顾', icon: <Play className="w-4 h-4" /> },
              { id: 'expert', label: '专家解析', icon: <FileText className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-kai transition-all ${
                  activeTab === tab.id
                    ? 'bg-paper-100 text-seal-300 border-b-2 border-seal-300'
                    : 'text-ink-200 hover:bg-paper-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-kai text-lg text-ink-300 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      游戏统计
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-ink-200 font-song">游戏用时</span>
                        <span className="font-kai text-ink-300">
                          {formatTime((session.endTime || Date.now()) - session.startTime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-200 font-song">标记疑点数量</span>
                        <span className="font-kai text-ink-300">
                          {session.playerChoices.filter(c => c.markedAsAnomaly).length} 个
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-200 font-song">记录笔记数量</span>
                        <span className="font-kai text-ink-300">
                          {session.playerNotes.length} 条
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-200 font-song">年代推断</span>
                        <span className="font-kai text-ink-300">
                          {session.dynastyGuess === currentLevel.correctDynasty ? (
                            <span className="text-bronze-300">✓ 正确</span>
                          ) : (
                            <span className="text-seal-300">✗ 错误</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-kai text-lg text-ink-300 mb-4">导出报告</h3>
                    <div className="space-y-3">
                      <button
                        onClick={handleExportSummary}
                        className="w-full flex items-center gap-3 p-4 bg-paper-100 rounded-lg border border-paper-300 hover:border-lapis-200 transition-colors"
                      >
                        <div className="w-10 h-10 bg-lapis-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-lapis-300" />
                        </div>
                        <div className="text-left">
                          <div className="font-kai text-ink-300">人读摘要 (Markdown)</div>
                          <div className="text-xs text-ink-200 font-song">适合阅读、打印、分享</div>
                        </div>
                        <Download className="w-5 h-5 text-ink-200 ml-auto" />
                      </button>
                      <button
                        onClick={handleExportDetails}
                        className="w-full flex items-center gap-3 p-4 bg-paper-100 rounded-lg border border-paper-300 hover:border-bronze-200 transition-colors"
                      >
                        <div className="w-10 h-10 bg-bronze-100 rounded-lg flex items-center justify-center">
                          <FileJson className="w-5 h-5 text-bronze-300" />
                        </div>
                        <div className="text-left">
                          <div className="font-kai text-ink-300">结构化明细 (JSON)</div>
                          <div className="text-xs text-ink-200 font-song">完整数据、便于后续分析处理</div>
                        </div>
                        <Download className="w-5 h-5 text-ink-200 ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'choices' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-kai text-ink-300">关键选择时间线</span>
                    <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showExplanations}
                        onChange={(e) => setShowExplanations(e.target.checked)}
                        className="rounded"
                      />
                      显示正确答案
                    </label>
                  </div>
                  
                  {session.playerChoices
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((choice) => {
                      const clue = currentLevel.clues.find(c => c.id === choice.clueId);
                      if (!clue) return null;
                      
                      const isCorrect = choice.markedAsAnomaly === clue.isAnomaly;

                      return (
                        <div
                          key={choice.id}
                          className="p-4 bg-paper-100 rounded-lg border border-paper-300"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCorrect ? 'bg-bronze-100' : 'bg-seal-100'
                            }`}>
                              {isCorrect ? (
                                <CheckCircle className="w-5 h-5 text-bronze-300" />
                              ) : (
                                <XCircle className="w-5 h-5 text-seal-300" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-kai text-ink-300">{clue.title}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  choice.markedAsAnomaly
                                    ? 'bg-seal-100 text-seal-300'
                                    : 'bg-paper-200 text-ink-200'
                                }`}>
                                  {choice.markedAsAnomaly ? '标记疑点' : '标记正常'}
                                </span>
                                {showExplanations && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    clue.isAnomaly
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    实际：{clue.isAnomaly ? '确有疑点' : '正常'}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-ink-200 font-song mb-2">
                                {clue.originalValue}
                              </p>
                              <div className="text-xs text-ink-200">
                                {new Date(choice.timestamp).toLocaleTimeString('zh-CN')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {activeTab === 'expert' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="space-y-6">
                  <h3 className="font-kai text-lg text-ink-300 mb-4">专家鉴定结论</h3>
                  
                  {currentLevel.anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="p-4 bg-paper-100 rounded-lg border border-paper-300">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          anomaly.riskLevel === 3 ? 'bg-seal-100' :
                          anomaly.riskLevel === 2 ? 'bg-amber-100' : 'bg-bronze-100'
                        }`}>
                          <span className="text-sm font-bold">
                            {anomaly.riskLevel === 3 ? '高' : anomaly.riskLevel === 2 ? '中' : '低'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-kai text-ink-300">{anomaly.name}</h4>
                          <p className="text-sm text-ink-200 font-song">{anomaly.description}</p>
                        </div>
                      </div>
                      <div className="p-3 bg-paper-50 rounded border border-paper-200">
                        <p className="text-sm text-ink-200 font-song">
                          <span className="font-kai text-ink-300">专家解析：</span>
                          {anomaly.correctExplanation}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="mt-8 p-6 bg-lapis-50 rounded-lg border border-lapis-200">
                    <h4 className="font-kai text-lg text-lapis-300 mb-4">专家点评</h4>
                    {currentLevel.expertComments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-lapis-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lapis-300 font-kai">{comment.expertName[0]}</span>
                        </div>
                        <div>
                          <p className="font-kai text-ink-300">{comment.expertName}</p>
                          <p className="text-ink-200 font-song">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-4"
        >
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-paper-200 text-ink-200 rounded-lg font-kai hover:bg-paper-300 transition-colors"
          >
            返回首页
          </button>
          <button
            onClick={() => navigate(`/game/${levelId}`)}
            className="px-8 py-3 bg-seal-300 text-white rounded-lg font-kai hover:bg-seal-200 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            再玩一次
          </button>
        </motion.div>
      </div>
    </div>
  );
}
