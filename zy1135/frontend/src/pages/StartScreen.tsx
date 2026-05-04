import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

const StartScreen = () => {
  const [gameName, setGameName] = useState('');
  const { createGame, isLoading } = useGameStore();

  const handleCreateGame = async () => {
    if (!gameName.trim()) return;
    await createGame(gameName.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-ocean to-sand p-4">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ocean-dark mb-2">🏝️ 鲁滨逊漂流记</h1>
          <p className="text-gray-600">生存策略游戏</p>
        </div>

        <div className="mb-8">
          <div className="bg-sand rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-gray-800 mb-2">游戏说明</h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 你扮演刚漂到荒岛上的鲁滨逊</li>
              <li>• 每天只有 5 个行动点，合理分配</li>
              <li>• 需要管理：食物、水、体力、精神、工具耐久、安全值</li>
              <li>• 探索岛屿、搭建庇护所、生火、种粮</li>
              <li>• 应对随机事件：暴风雨、疾病、神秘事件</li>
              <li>• 尝试发送救援信号，或等待 21 天的救援机会</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              为你的冒险命名
            </label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="例如：我的荒岛生存"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ocean focus:border-transparent outline-none transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGame()}
            />
          </div>

          <button
            onClick={handleCreateGame}
            disabled={isLoading || !gameName.trim()}
            className="btn-primary w-full py-3 text-lg"
          >
            {isLoading ? '创建中...' : '🚀 开始冒险'}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>提示：游戏进度会自动保存在本地</p>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
