import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Gamepad2 } from 'lucide-react';
import levelsData from '../data/levels.json';
import type { LevelConfig } from '../types';
import { LevelCard } from '../components/menu/LevelCard';
import { Instructions } from '../components/menu/Instructions';
import { getHighScore } from '../utils/storage';

export function HomePage() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(true);
  const [highScores, setHighScores] = useState<Record<string, number>>({});

  const levels = levelsData as LevelConfig[];

  useEffect(() => {
    const scores: Record<string, number> = {};
    levels.forEach(level => {
      scores[level.id] = getHighScore(level.id);
    });
    setHighScores(scores);
  }, [levels]);

  const handleLevelSelect = (levelId: string) => {
    navigate(`/game/${levelId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-12 h-12 text-industrial-yellow" />
            <h1 className="text-4xl font-bold text-white">
              配电房巡检游戏
            </h1>
            <Zap className="w-12 h-12 text-industrial-yellow" />
          </div>
          <p className="text-slate-400 text-lg">
            物业培训模拟器 - 掌握标准巡检流程，正确处理异常事件
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-industrial-blue">
            <Gamepad2 className="w-5 h-5" />
            <span>选择关卡开始挑战</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-8">
          <Instructions 
            isOpen={showInstructions} 
            onToggle={() => setShowInstructions(!showInstructions)} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {levels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              highScore={highScores[level.id] || 0}
              onSelect={handleLevelSelect}
            />
          ))}
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>配电房巡检培训系统 v1.0</p>
          <p>正确顺序巡检 | 异常及时处理 | 完整生成报告</p>
        </div>
      </div>
    </div>
  );
}
