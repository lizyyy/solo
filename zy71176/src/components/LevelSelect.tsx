import { levels } from '../game/levels';
import { initializeGame } from '../game/engine';
import { Star, Play } from 'lucide-react';

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-600',
  medium: 'bg-yellow-600',
  hard: 'bg-red-600',
};

const difficultyText: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function LevelSelect() {
  const handleSelectLevel = (levelId: number) => {
    initializeGame(levelId);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🏨</div>
          <h1 className="text-4xl font-bold text-white mb-3">
            酒店客房调度游戏
          </h1>
          <p className="text-gray-400 text-lg">
            模拟酒店前台运营，合理分配客房、处理客人需求、调度保洁人员
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" /> 选择关卡
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {levels.map((level) => (
              <div
                key={level.id}
                className="bg-gray-800/70 rounded-xl p-6 border border-gray-700 hover:border-secondary/50 transition-all duration-300 cursor-pointer group"
                onClick={() => handleSelectLevel(level.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-white">
                        {level.id}
                      </span>
                      <h3 className="text-xl font-semibold text-white">
                        {level.name}
                      </h3>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {level.description}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${difficultyColors[level.difficulty]}`}>
                    {difficultyText[level.difficulty]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-400">{level.roomCount}</div>
                    <div className="text-xs text-gray-400">房间数</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-400">{level.cleanerCount}</div>
                    <div className="text-xs text-gray-400">保洁员</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-400">{level.duration}</div>
                    <div className="text-xs text-gray-400">时长(分)</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    目标: 满意度≥{level.winConditions.minSatisfaction}% | 客诉≤{level.winConditions.maxComplaints}次
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-yellow-600 rounded-lg font-medium text-gray-900 transition-colors opacity-0 group-hover:opacity-100">
                    <Play className="w-4 h-4" /> 开始
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📖 游戏说明</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div>
              <h4 className="font-medium text-white mb-2">基本操作</h4>
              <ul className="space-y-2">
                <li>• 点击等待的客人选中</li>
                <li>• 点击空房为选中的客人分配房间</li>
                <li>• 点击脏房自动派遣保洁清洁</li>
                <li>• 及时处理续住申请避免客诉</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">游戏规则</h4>
              <ul className="space-y-2">
                <li>• 脏房不能直接分配给客人</li>
                <li>• 维修中的房间不可使用</li>
                <li>• 客人等待太久会产生客诉</li>
                <li>• 客诉过多或满意度过低会失败</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
