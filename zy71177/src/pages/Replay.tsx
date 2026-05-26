import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameRecord, WaterQuality } from '../types';
import { getGameRecordById } from '../utils/scoring';
import { getLevelById } from '../data/levels';
import { TankSimulation } from '../components/game/TankSimulation';
import { QualityChart } from '../components/game/QualityChart';
import { ReplayTimeline } from '../components/replay/ReplayTimeline';
import { ScoreBoard } from '../components/game/ScoreBoard';

export const Replay: React.FC = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (gameId) {
      const gameRecord = getGameRecordById(gameId);
      if (gameRecord) {
        setRecord(gameRecord);
      } else {
        navigate('/');
      }
    }
  }, [gameId, navigate]);

  useEffect(() => {
    if (isPlaying && record) {
      playIntervalRef.current = window.setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= record.qualityHistory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, record]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  
  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (record) {
      setCurrentIndex(prev => Math.min(record.qualityHistory.length - 1, prev + 1));
    }
  };

  const handleSeek = (index: number) => {
    setIsPlaying(false);
    setCurrentIndex(index);
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const level = getLevelById(record.levelId);
  if (!level) {
    navigate('/');
    return null;
  }

  const currentQuality: WaterQuality = record.qualityHistory[currentIndex] || record.qualityHistory[0];

  const displayHistory = record.qualityHistory.slice(0, currentIndex + 1);
  const currentActions = record.actions.filter(a => a.round <= Math.ceil((currentIndex + 1) / 2));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                {record.levelName}
                <span className="text-slate-400 text-base font-normal ml-2">历史回放</span>
              </h1>
              <p className="text-sm text-slate-400">
                游戏时间: {new Date(record.startTime).toLocaleString('zh-CN')}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg ${
              record.success 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {record.success ? '✓ 成功通关' : '✗ 未通过'} · 最终得分: {record.score}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-4">
            <ScoreBoard
              round={Math.ceil((currentIndex + 1) / 2)}
              maxRounds={record.maxRounds}
              score={Math.round((currentIndex / record.qualityHistory.length) * record.score)}
              totalCost={currentActions.reduce((sum, a) => sum + a.cost, 0)}
              successCount={record.successCount}
              insufficientStirringCount={record.insufficientStirringCount}
              overdoseCount={record.overdoseCount}
              levelName={record.levelName}
            />
            <ReplayTimeline
              currentIndex={currentIndex}
              totalPoints={record.qualityHistory.length}
              actions={record.actions}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onPause={handlePause}
              onPrev={handlePrev}
              onNext={handleNext}
              onSeek={handleSeek}
              onBackToMenu={handleBackToMenu}
            />
          </div>

          <div className="col-span-5">
            <TankSimulation
              waterQuality={currentQuality}
              level={level}
              isProcessing={isPlaying}
              isStirring={isPlaying}
            />
          </div>

          <div className="col-span-4">
            <QualityChart
              qualityHistory={displayHistory}
              level={level}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
