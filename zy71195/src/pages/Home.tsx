import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Star, Lock, Trophy, History, BookOpen } from 'lucide-react';
import { LEVELS } from '../data/levels';
import { getBestScores, getUnlockedLevels } from '../utils/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Home() {
  const navigate = useNavigate();
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);

  useEffect(() => {
    setBestScores(getBestScores());
    setUnlockedLevels(getUnlockedLevels());
  }, []);

  const isLevelUnlocked = (levelId: number) => unlockedLevels.includes(levelId);

  const handleStartGame = (levelId: number) => {
    if (isLevelUnlocked(levelId)) {
      navigate(`/game/${levelId}`);
    }
  };

  const renderStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < difficulty ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 font-mono tracking-wider">
            <span className="text-blue-400">码头闸口</span>
            <span className="text-yellow-400">验放游戏</span>
          </h1>
          <p className="text-slate-400 text-lg">
            训练你的箱号识别能力，成为最优秀的闸口验放员！
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {LEVELS.map((level) => {
            const unlocked = isLevelUnlocked(level.id);
            const bestScore = bestScores[level.id] || 0;
            const passed = bestScore >= level.passScore;

            return (
              <Card
                key={level.id}
                className={`relative overflow-hidden transition-all duration-200 ${
                  unlocked
                    ? 'hover:border-blue-500 hover:shadow-lg hover:shadow-blue-900/20 cursor-pointer'
                    : 'opacity-60'
                }`}
                onClick={() => handleStartGame(level.id)}
              >
                {!unlocked && (
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
                    <div className="text-center">
                      <Lock className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">通过前一关卡解锁</p>
                    </div>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      关卡 {level.id}
                    </span>
                    <div className="flex gap-1">{renderStars(level.difficulty)}</div>
                  </div>
                  <CardTitle className="text-xl">{level.name}</CardTitle>
                  <CardDescription>{level.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-slate-500">车辆数</span>
                      <p className="font-mono text-lg text-slate-200">
                        {level.vehicleCount}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">时限/车</span>
                      <p className="font-mono text-lg text-slate-200">
                        {level.timePerVehicle}秒
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">危品率</span>
                      <p className="font-mono text-lg text-orange-400">
                        {Math.round(level.dangerousRate * 100)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">及格分</span>
                      <p className="font-mono text-lg text-green-400">
                        {level.passScore}
                      </p>
                    </div>
                  </div>

                  {bestScore > 0 && (
                    <div className="bg-slate-800 p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Trophy
                          className={`w-5 h-5 ${passed ? 'text-yellow-400' : 'text-slate-500'}`}
                        />
                        <span className="text-sm text-slate-400">最高分</span>
                        <span
                          className={`ml-auto font-mono font-bold ${passed ? 'text-yellow-400' : 'text-slate-400'}`}
                        >
                          {bestScore}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant={unlocked ? 'primary' : 'secondary'}
                    size="lg"
                    className="w-full"
                    disabled={!unlocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartGame(level.id);
                    }}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {unlocked ? '开始游戏' : '未解锁'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/history')}
          >
            <History className="w-5 h-5 mr-2" />
            历史记录
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/rules')}
          >
            <BookOpen className="w-5 h-5 mr-2" />
            游戏规则
          </Button>
        </div>

        <div className="max-w-2xl mx-auto text-center text-slate-500 text-sm">
          <p className="mb-2">💡 游戏提示</p>
          <p>
            仔细核对箱号、车牌是否与预约单一致，注意检查危品标记。
            发现任何异常请立即拦截！队列拥挤会额外扣分。
          </p>
        </div>
      </div>
    </div>
  );
}
