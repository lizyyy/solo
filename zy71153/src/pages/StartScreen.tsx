import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../game/levels';
import { Difficulty } from '../types';
import { getHistory } from '../store/useGameStore';
import { Play, History, BookOpen } from 'lucide-react';
import { useState } from 'react';

export const StartScreen = () => {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);
  const history = getHistory();

  const getDifficultyColor = (difficulty: Difficulty) => {
    const colors = {
      easy: 'bg-green-500',
      medium: 'bg-yellow-500',
      hard: 'bg-red-500',
    };
    return colors[difficulty];
  };

  const getDifficultyText = (difficulty: Difficulty) => {
    const texts = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
    };
    return texts[difficulty];
  };

  const handleStartGame = (levelId: string) => {
    navigate(`/game?level=${levelId}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚑 灾后物资配送
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            模拟灾后物资配送场景，训练志愿者合理分配物资、规划路线、应对突发事件的能力
          </p>
        </div>

        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setShowHistory(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                !showHistory 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Play size={18} /> 选择关卡
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showHistory 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <History size={18} /> 历史记录
            </button>
          </div>

          {!showHistory ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {LEVELS.map((level) => (
                <div
                  key={level.id}
                  className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-all cursor-pointer group"
                  onClick={() => handleStartGame(level.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs text-white ${getDifficultyColor(level.difficulty)}`}>
                      {getDifficultyText(level.difficulty)}
                    </span>
                    <span className="text-2xl">🎮</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {level.name}
                  </h3>
                  
                  <p className="text-slate-400 text-sm mb-4">
                    {level.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>🚚 {level.vehicles.length} 辆车</span>
                    <span>🏠 {level.nodes.filter(n => n.type === 'shelter').length} 个安置点</span>
                    <span>⏱️ {level.maxTurns} 回合</span>
                  </div>
                  
                  <button className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors opacity-0 group-hover:opacity-100">
                    开始游戏
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {history.length > 0 ? (
                <div className="divide-y divide-slate-700">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 hover:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between"
                      onClick={() => navigate(`/replay?id=${record.id}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{record.levelName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${getDifficultyColor(record.difficulty)}`}>
                            {getDifficultyText(record.difficulty)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            record.isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {record.isWin ? '胜利' : '失败'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          回合 {record.turns} | 得分 {record.score} | {new Date(record.completedAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        {record.score}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无游戏记录</p>
                  <p className="text-sm mt-2">完成游戏后，记录将显示在这里</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-12 max-w-3xl w-full">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen size={20} /> 游戏说明
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-medium text-white">游戏目标</p>
                  <p>在规定回合内将物资送达所有安置点</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">📦</span>
                <div>
                  <p className="font-medium text-white">物资管理</p>
                  <p>在仓库装载水、药品、帐篷，注意载重限制</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🗺️</span>
                <div>
                  <p className="font-medium text-white">路线规划</p>
                  <p>点击地图节点规划配送路线</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-medium text-white">应对事件</p>
                  <p>处理道路中断、天气变化等突发事件</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
