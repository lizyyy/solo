import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameApi } from '../services/api';
import LogView from '../components/LogView';

const GameOverScreen = () => {
  const { currentGame, reset } = useGameStore();
  const [isExporting, setIsExporting] = useState(false);

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const handleExport = async (format: 'markdown' | 'html' | 'json') => {
    if (!currentGame) return;
    setIsExporting(true);
    try {
      await gameApi.exportGame(currentGame.id, format);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const getEndingEmoji = () => {
    if (currentGame.rescueSuccess) return '🎉';
    if (currentGame.gameOverReason?.includes('获救')) return '🎉';
    if (currentGame.gameOverReason?.includes('饥饿') || currentGame.gameOverReason?.includes('缺水'))
      return '💀';
    if (currentGame.gameOverReason?.includes('精神')) return '😔';
    if (currentGame.gameOverReason?.includes('100天')) return '📅';
    return '🏝️';
  };

  const getEndingTitle = () => {
    if (currentGame.rescueSuccess) return '成功获救！';
    if (currentGame.gameOverReason) return currentGame.gameOverReason;
    return '游戏结束';
  };

  const getEndingDescription = () => {
    if (currentGame.rescueSuccess) {
      return '恭喜！你成功地在荒岛上生存下来，并等到了救援。你和星期五（如果有的话）一起离开了这座岛屿，回到了文明世界。这段经历将永远铭刻在你的记忆中。';
    }
    if (currentGame.gameOverReason?.includes('100天')) {
      return '你在岛上坚持了100天，但最终还是没能等到救援。你的故事将成为传说，而你的航海日志将成为后世了解这段历史的珍贵资料。';
    }
    return '你的冒险在这里结束了。但请记住，每一次失败都是学习的机会。下次试试不同的策略，也许就能成功获救！';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean to-sand py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="card text-center mb-6">
          <div className="text-6xl mb-4">{getEndingEmoji()}</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{getEndingTitle()}</h1>
          <p className="text-gray-600 mb-4">
            {currentGame.name} · 第 {currentGame.currentDay} 天
          </p>
          <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto">
            {getEndingDescription()}
          </p>
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 最终状态</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">生存天数</div>
              <div className="text-2xl font-bold text-forest">{currentGame.currentDay}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">获得星期五</div>
              <div className="text-2xl font-bold text-purple-600">
                {currentGame.hasFriday ? '✅' : '❌'}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">建立庇护所</div>
              <div className="text-2xl font-bold text-blue-600">
                {currentGame.hasShelter ? '✅' : '❌'}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">生起火堆</div>
              <div className="text-2xl font-bold text-orange-600">
                {currentGame.hasFire ? '✅' : '❌'}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(currentGame.resources).map(([key, value]) => {
              const max = currentGame.maxResources[key as keyof typeof currentGame.maxResources];
              const percentage = ((value / max) * 100).toFixed(0);
              return (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {key === 'toolDurability' ? '工具' : key}
                    </span>
                    <span className="text-sm text-gray-500">
                      {value}/{max} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        parseInt(percentage) >= 50
                          ? 'bg-green-500'
                          : parseInt(percentage) >= 25
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📥 导出航海日志</h2>
          <p className="text-gray-600 mb-4">
            选择格式导出你的冒险旅程记录：
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExport('markdown')}
              disabled={isExporting}
              className="btn-primary"
            >
              📝 Markdown (.md)
            </button>
            <button
              onClick={() => handleExport('html')}
              disabled={isExporting}
              className="btn-primary"
            >
              🌐 HTML (.html)
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={isExporting}
              className="btn-primary"
            >
              📋 JSON (.json)
            </button>
          </div>
          {isExporting && (
            <p className="text-sm text-gray-500 mt-3">正在导出...</p>
          )}
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📖 完整航海日志</h2>
          <LogView logs={currentGame.logs} />
        </div>

        <div className="text-center">
          <button onClick={reset} className="btn-primary text-lg px-8 py-3">
            🔄 开始新冒险
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
