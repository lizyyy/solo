import { useNavigate } from 'react-router-dom';
import { Bot, Play, BookOpen, Trophy, Clock, Zap, AlertTriangle } from 'lucide-react';
import { levels } from '../game/levels';

const difficultyColors = {
  easy: 'bg-green-600',
  medium: 'bg-yellow-600',
  hard: 'bg-red-600',
};

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10">
              <Bot className="w-20 h-20 text-blue-400" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            仓储机器人
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              避障游戏
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            指挥机器人完成订单拣货任务，避免碰撞，管理电量，挑战你的调度能力！
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">路径规划</h3>
            <p className="text-gray-400 text-sm">
              点击机器人后选择目标位置，系统自动规划最优路径
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">碰撞检测</h3>
            <p className="text-gray-400 text-sm">
              机器人相撞会导致故障，合理安排路径避免事故
            </p>
          </div>
          <div className="p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">时间管理</h3>
            <p className="text-gray-400 text-sm">
              订单有时间限制，超时会扣分，注意机器人电量消耗
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            选择关卡
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {levels.map((level) => (
              <div
                key={level.id}
                className="group p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={() => navigate(`/game/${level.id}`)}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs text-white ${difficultyColors[level.difficulty]}`}>
                    {difficultyLabels[level.difficulty]}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-gray-700 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{level.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{level.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{level.robots.length} 台机器人</span>
                  <span>{level.orders.length} 个订单</span>
                  <span>{level.gridSize.width}×{level.gridSize.height}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-400" />
            游戏规则
          </h2>
          <div className="p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-3">基础操作</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• 点击机器人进行选中</li>
                  <li>• 点击地图空白处指定目标位置</li>
                  <li>• 鼠标拖拽旋转视角，滚轮缩放</li>
                  <li>• 使用控制面板暂停/加速游戏</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-3">计分规则</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• 完成订单: <span className="text-green-400">+100分</span></li>
                  <li>• 效率奖励: <span className="text-green-400">+50分/分钟</span></li>
                  <li>• 机器人碰撞: <span className="text-red-400">-200分</span></li>
                  <li>• 订单超时: <span className="text-red-400">-100分/分钟</span></li>
                  <li>• 电量耗尽: <span className="text-red-400">-150分</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
