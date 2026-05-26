import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameRecord, ScoreBreakdown } from '../types';
import { getGameRecordById, calculateScore, calculateOptimalCost } from '../utils/scoring';
import { getLevelById } from '../data/levels';
import { ScoreDisplay } from '../components/result/ScoreDisplay';
import { FailureAnalysis } from '../components/result/FailureAnalysis';
import { ReportExport } from '../components/result/ReportExport';
import { useGameStore } from '../store/useGameStore';

export const Result: React.FC = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { currentLevel, startGame } = useGameStore();
  
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);

  useEffect(() => {
    if (gameId) {
      const gameRecord = getGameRecordById(gameId);
      if (gameRecord) {
        setRecord(gameRecord);
        
        const level = getLevelById(gameRecord.levelId);
        if (level) {
          const optimalCost = calculateOptimalCost(level);
          const breakdown = calculateScore(
            gameRecord.successCount,
            gameRecord.maxRounds,
            gameRecord.totalCost,
            optimalCost,
            gameRecord.insufficientStirringCount,
            gameRecord.overdoseCount
          );
          setScoreBreakdown(breakdown);
        }
      } else {
        navigate('/');
      }
    }
  }, [gameId, navigate]);

  const handleRestart = () => {
    if (record) {
      const level = getLevelById(record.levelId);
      if (level) {
        startGame(level);
        navigate(`/game/${level.id}`);
      }
    }
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  const handleReplay = () => {
    if (gameId) {
      navigate(`/replay/${gameId}`);
    }
  };

  if (!record || !scoreBreakdown) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          游戏<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">结算</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <ScoreDisplay
              score={record.score}
              scoreBreakdown={scoreBreakdown}
              success={record.success}
              levelName={record.levelName}
            />
          </div>

          <div className="md:col-span-1">
            <FailureAnalysis
              failReason={record.failReason}
              success={record.success}
              totalCost={record.totalCost}
              roundsCompleted={record.roundsCompleted}
              successCount={record.successCount}
              insufficientStirringCount={record.insufficientStirringCount}
              overdoseCount={record.overdoseCount}
            />
          </div>

          <div className="md:col-span-1">
            <ReportExport
              record={record}
              scoreBreakdown={scoreBreakdown}
              onRestart={handleRestart}
              onBackToMenu={handleBackToMenu}
              onReplay={handleReplay}
            />
          </div>
        </div>

        <div className="mt-8 bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">操作历史</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">回合</th>
                  <th className="pb-3 font-medium">投加量</th>
                  <th className="pb-3 font-medium">搅拌时间</th>
                  <th className="pb-3 font-medium">成本</th>
                  <th className="pb-3 font-medium">处理后 COD</th>
                  <th className="pb-3 font-medium">处理后 氨氮</th>
                  <th className="pb-3 font-medium">处理后 总磷</th>
                  <th className="pb-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {record.actions.map((action, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
                    <td className="py-3 text-slate-300">{action.round}</td>
                    <td className="py-3 font-mono text-blue-400">{action.chemicalAmount?.toFixed(0)} 单位</td>
                    <td className="py-3 font-mono text-green-400">{action.stirringTime?.toFixed(0)} 秒</td>
                    <td className="py-3 font-mono text-cyan-400">¥{action.cost.toFixed(0)}</td>
                    <td className="py-3 font-mono">{action.afterQuality.cod.toFixed(1)}</td>
                    <td className="py-3 font-mono">{action.afterQuality.nh3n.toFixed(1)}</td>
                    <td className="py-3 font-mono">{action.afterQuality.tp.toFixed(2)}</td>
                    <td className="py-3">
                      {action.afterQuality.cod <= 50 && action.afterQuality.nh3n <= 8 && action.afterQuality.tp <= 0.5
                        ? <span className="text-green-400">✓ 达标</span>
                        : <span className="text-red-400">✗ 未达标</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
