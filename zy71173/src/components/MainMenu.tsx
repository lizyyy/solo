import { useNavigate } from 'react-router-dom';
import { Play, History, Trophy, Info } from 'lucide-react';
import { LEVELS } from '@/game/levels';
import { loadRecords } from '@/game/replay';

const difficultyMap = {
  easy: { label: '简单', color: 'text-museum-success', bgColor: 'bg-museum-success/10' },
  medium: { label: '中等', color: 'text-museum-warning', bgColor: 'bg-museum-warning/10' },
  hard: { label: '困难', color: 'text-museum-danger', bgColor: 'bg-museum-danger/10' },
};

export default function MainMenu() {
  const navigate = useNavigate();
  const records = loadRecords();

  const handleStartGame = (levelId: number) => {
    navigate(`/game/${levelId}`);
  };

  const handleViewReplay = (recordId: string) => {
    navigate(`/replay/${recordId}`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4 tracking-wider">
          博物馆护卫
        </h1>
        <p className="text-museum-bgLighter text-lg">
          护送珍贵展品，穿越风险重重的展区
        </p>
      </div>

      <div className="grid gap-8">
        <div className="hud-panel">
          <div className="flex items-center gap-3 mb-6">
            <Play className="w-6 h-6 text-museum-accent" />
            <h2 className="text-xl font-semibold text-white">选择关卡</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => handleStartGame(level.id)}
                className="group relative p-5 rounded-xl bg-museum-bg/50 border border-museum-bgLighter hover:border-museum-accent transition-all duration-300 hover:scale-105 text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-museum-accent transition-colors">
                      {level.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${difficultyMap[level.difficulty].bgColor} ${difficultyMap[level.difficulty].color}`}>
                      {difficultyMap[level.difficulty].label}
                    </span>
                  </div>
                  <Trophy className="w-5 h-5 text-museum-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-1 text-sm text-museum-bgLighter">
                  <div className="flex justify-between">
                    <span>展品价值</span>
                    <span className="text-museum-accent">${level.exhibit.value.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最大回合</span>
                    <span className="text-white">{level.maxRounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>安保数量</span>
                    <span className="text-white">{level.guards.length}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="hud-panel">
          <div className="flex items-center gap-3 mb-6">
            <History className="w-6 h-6 text-museum-accent" />
            <h2 className="text-xl font-semibold text-white">历史记录</h2>
          </div>
          {records.length === 0 ? (
            <div className="text-center py-8 text-museum-bgLighter">
              <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无游戏记录</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {records.map((record) => {
                const level = LEVELS.find((l) => l.id.toString() === record.levelId);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-museum-bg/30 border border-museum-bgLighter/50 hover:border-museum-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        record.success ? 'bg-museum-success/20 text-museum-success' : 'bg-museum-danger/20 text-museum-danger'
                      }`}>
                        {record.success ? <Trophy className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {level?.name || `关卡 ${record.levelId}`}
                        </h4>
                        <p className="text-sm text-museum-bgLighter">
                          {new Date(record.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-museum-accent font-bold text-lg">{record.totalScore}</div>
                        <div className="text-xs text-museum-bgLighter">评分: {record.rating}</div>
                      </div>
                      <button
                        onClick={() => handleViewReplay(record.id)}
                        className="btn-secondary text-sm"
                      >
                        查看回放
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
