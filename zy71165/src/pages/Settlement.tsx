import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Trophy,
  XCircle,
  Download,
  RotateCcw,
  Home,
  Play,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getLevelById } from '../data/levels';
import { downloadReport, downloadReplayData, getFailureTypeLabel } from '../utils/report';
import type { SettlementResult } from '../engine/types';

export const Settlement: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { levelId?: string; settlementResult?: SettlementResult } || {};
  const { levelId, settlementResult: settlementResultFromRoute } = locationState;

  const { settlementResult: settlementResultFromStore, currentLevel, gameRecords } = useGameStore();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const settlementResult = settlementResultFromRoute || settlementResultFromStore;
  const level = levelId ? getLevelById(levelId) : currentLevel;

  if (!settlementResult || !level) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">
          <p>没有找到结算数据</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const { success, score, breakdown, failureReasons, report } = settlementResult;
  const latestRecord = gameRecords[0];

  const handleRestart = () => {
    navigate(`/game/${level.id}`);
  };

  const handleBackHome = () => {
    navigate('/');
  };

  const handleViewReplay = () => {
    if (latestRecord) {
      navigate(`/replay/${latestRecord.id}`);
    }
  };

  const handleDownloadReport = () => {
    downloadReport(report, level);
  };

  const handleDownloadReplay = () => {
    downloadReplayData(settlementResult, level);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
              success
                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                : 'bg-gradient-to-br from-red-500 to-rose-600'
            }`}
          >
            {success ? (
              <Trophy className="w-12 h-12 text-white" />
            ) : (
              <XCircle className="w-12 h-12 text-white" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {success ? '🎉 挑战成功！' : '😔 挑战失败'}
          </h1>
          <p className="text-slate-400 text-lg">
            {level.name} - 结算报告
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                {score}
              </div>
              <div className="text-slate-400 text-sm mt-1">最终得分</div>
            </div>
            <div className="w-px h-16 bg-slate-600" />
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {report.isolatedLeaks.length}/{level.targetIsolatedLeaks}
              </div>
              <div className="text-slate-400 text-sm mt-1">已隔离漏点</div>
            </div>
            <div className="w-px h-16 bg-slate-600" />
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">
                {report.affectedUserAreas.length}
              </div>
              <div className="text-slate-400 text-sm mt-1">受影响区域</div>
            </div>
          </div>

          <div
            className="bg-slate-700/50 rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                得分明细
              </h3>
              {showBreakdown ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
            {showBreakdown && (
              <div className="px-4 pb-4 space-y-2">
                <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                  <span className="text-slate-400">基础分</span>
                  <span className="text-white font-mono">+{breakdown.baseScore}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                  <span className="text-slate-400">漏点隔离奖励</span>
                  <span className="text-green-400 font-mono">+{breakdown.leakBonus}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                  <span className="text-slate-400">用户影响惩罚</span>
                  <span className="text-red-400 font-mono">-{breakdown.userPenalty}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                  <span className="text-slate-400">压力不足惩罚</span>
                  <span className="text-red-400 font-mono">-{breakdown.pressurePenalty}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                  <span className="text-slate-400">步数超额惩罚</span>
                  <span className="text-red-400 font-mono">-{breakdown.stepPenalty}</span>
                </div>
                {breakdown.timeBonus > 0 && (
                  <div className="flex justify-between text-sm py-2 border-b border-slate-600">
                    <span className="text-slate-400">时间奖励</span>
                    <span className="text-green-400 font-mono">+{breakdown.timeBonus}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm py-2 font-bold">
                  <span className="text-white">最终得分</span>
                  <span className="text-yellow-400 font-mono text-lg">{score}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {failureReasons.length > 0 && (
          <div className="bg-red-900/30 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-red-800">
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5" />
              失败原因分析
            </h3>
            <div className="space-y-3">
              {failureReasons.map((reason, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-red-900/30 rounded-lg p-4"
                >
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-red-400 font-medium">
                      {getFailureTypeLabel(reason.type)}
                    </div>
                    <div className="text-slate-300 text-sm mt-1">{reason.message}</div>
                    {reason.location && (
                      <div className="text-slate-400 text-xs mt-2">
                        位置: {reason.location.nodeId || reason.location.valveId}
                        {reason.operationIndex !== undefined && (
                          <span className="ml-2">
                            (第 {reason.operationIndex + 1} 步操作)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-700"
        >
          <div
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => setShowReport(!showReport)}
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              评估建议
            </h3>
            {showReport ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          {showReport && (
            <div className="space-y-2">
              {report.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-slate-700/30 rounded-lg p-3"
                >
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-slate-300 text-sm">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-medium transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            重新挑战
          </button>
          <button
            onClick={handleViewReplay}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-medium transition-all"
          >
            <Play className="w-5 h-5" />
            查看回放
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-all"
          >
            <Download className="w-5 h-5" />
            导出报告
          </button>
          <button
            onClick={handleDownloadReplay}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-all"
          >
            <Download className="w-5 h-5" />
            导出回放数据
          </button>
          <button
            onClick={handleBackHome}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-all"
          >
            <Home className="w-5 h-5" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
};
