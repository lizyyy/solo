import React from 'react';
import { Level, LevelProgress } from '../game/types';
import { LEVELS } from '../game/levels';
import { HistoryRecorder } from '../game/recorder';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Star, Play, BookOpen, History, TrendingUp } from 'lucide-react';

interface MainMenuProps {
  onSelectLevel: (levelId: number) => void;
  onShowHistory: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectLevel, onShowHistory }) => {
  const getProgress = (levelId: number): LevelProgress | undefined => {
    return HistoryRecorder.getLevelProgressById(levelId);
  };

  const renderStars = (count: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3].map(i => (
          <Star
            key={i}
            className={`w-5 h-5 ${
              i <= count ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            工厂换线排程游戏
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            通过模拟工厂生产排程场景，学习如何合理安排订单顺序，
            优化模具切换和清洗时间，最小化换线成本。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {LEVELS.map((level, index) => {
            const progress = getProgress(level.id);
            const isLocked = index > 0 && !getProgress(LEVELS[index - 1].id)?.completed;

            return (
              <Card
                key={level.id}
                className={`transform transition-all duration-300 hover:scale-105 ${
                  isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'
                }`}
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{level.id}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">
                    {level.name}
                  </h3>
                  
                  <p className="text-gray-400 text-sm mb-4">
                    {level.description}
                  </p>

                  {progress && (
                    <div className="mb-4">
                      {renderStars(progress.stars)}
                      <p className="text-sm text-gray-400 mt-2">
                        最佳成本: <span className="text-green-400 font-mono">¥{progress.bestCost}</span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge variant="info">{level.orders.length} 订单</Badge>
                    <Badge variant="warning">{level.molds.length} 模具</Badge>
                  </div>

                  <Button
                    onClick={() => !isLocked && onSelectLevel(level.id)}
                    disabled={isLocked}
                    className="w-full"
                    variant={progress?.completed ? 'success' : 'primary'}
                  >
                    {isLocked ? (
                      <span>🔒 锁定</span>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        {progress?.completed ? '重玩' : '开始'}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card title="游戏规则">
            <div className="space-y-3 text-gray-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400">1</span>
                </div>
                <p className="text-sm">
                  <span className="text-white font-medium">拖拽排程</span> - 
                  将待排程订单拖拽到排程队列中，调整生产顺序
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400">2</span>
                </div>
                <p className="text-sm">
                  <span className="text-white font-medium">换线成本</span> - 
                  每次切换模具都会产生固定成本和清洗时间成本
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400">3</span>
                </div>
                <p className="text-sm">
                  <span className="text-white font-medium">交期延迟</span> - 
                  订单超时交付会按分钟计算罚款
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-green-400">4</span>
                </div>
                <p className="text-sm">
                  <span className="text-white font-medium">目标</span> - 
                  总成本不超过目标成本，所有订单按时完成
                </p>
              </div>
            </div>
          </Card>

          <Card title="成本计算">
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">换线成本公式</p>
                <code className="text-green-400 text-sm font-mono">
                  总成本 = 固定成本 + 清洗时间 × 工时成本
                </code>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">延迟成本</p>
                <code className="text-red-400 text-sm font-mono">
                  延迟成本 = 超时分钟数 × 每分钟罚款
                </code>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">评分标准</p>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-green-900/50 rounded p-2">
                    <p className="text-green-400 font-bold">S</p>
                    <p className="text-gray-400">≤70%</p>
                  </div>
                  <div className="bg-blue-900/50 rounded p-2">
                    <p className="text-blue-400 font-bold">A</p>
                    <p className="text-gray-400">≤85%</p>
                  </div>
                  <div className="bg-amber-900/50 rounded p-2">
                    <p className="text-amber-400 font-bold">B</p>
                    <p className="text-gray-400">≤100%</p>
                  </div>
                  <div className="bg-orange-900/50 rounded p-2">
                    <p className="text-orange-400 font-bold">C</p>
                    <p className="text-gray-400">≤120%</p>
                  </div>
                  <div className="bg-red-900/50 rounded p-2">
                    <p className="text-red-400 font-bold">D</p>
                    <p className="text-gray-400">{'>'}120%</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button onClick={onShowHistory} variant="ghost" size="lg">
            <History className="w-5 h-5 mr-2" />
            查看历史记录
          </Button>
        </div>
      </div>
    </div>
  );
};
