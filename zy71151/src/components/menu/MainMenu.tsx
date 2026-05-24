import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { levels } from '../../data/levels';

const difficultyLabels: Record<number, string> = {
  1: '新手',
  2: '中等',
  3: '困难',
};

const difficultyColors: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-red-500',
};

export default function MainMenu() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(false);

  const handleLevelSelect = (levelId: string) => {
    navigate(`/game/${levelId}`);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 flex flex-col items-center justify-center p-8 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <h1 className="text-6xl font-oswald font-bold text-white mb-4 tracking-wider">
          <span className="text-warning-500">港口</span>拖轮调度模拟器
        </h1>
        <p className="text-harbor-300 text-xl font-mono">
          PORT TUG BOAT DISPATCH SIMULATOR
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-4xl"
      >
        <h2 className="text-2xl font-oswald font-semibold text-harbor-200 mb-6 text-center">
          选择关卡
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {levels.map((level, index) => (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="relative cursor-pointer"
              onClick={() => handleLevelSelect(level.id)}
            >
              <div className="glass-panel rounded-lg p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`${difficultyColors[level.difficulty]} text-white text-xs font-bold px-3 py-1 rounded`}
                  >
                    {difficultyLabels[level.difficulty]}
                  </span>
                  <span className="text-harbor-400 text-sm font-mono">
                    {Math.floor(level.duration / 60)}分钟
                  </span>
                </div>

                <h3 className="text-xl font-oswald font-bold text-white mb-2">
                  {level.name}
                </h3>

                <p className="text-harbor-300 text-sm mb-4">
                  {level.description}
                </p>

                <div className="flex items-center justify-between text-xs text-harbor-400">
                  <span>🚢 {level.initialShips.length} 艘船舶</span>
                  <span>⚓ {level.berths.length} 个泊位</span>
                </div>

                <div className="mt-4 pt-4 border-t border-harbor-600">
                  <div className="text-warning-500 font-oswald font-semibold text-sm">
                    开始任务 →
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        onClick={() => setShowInstructions(true)}
        className="mt-12 btn-industrial bg-navy-600 text-white border-navy-400 hover:bg-navy-500"
      >
        📖 游戏说明
      </motion.button>

      {showInstructions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
          onClick={() => setShowInstructions(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass-panel rounded-xl p-8 max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-oswald font-bold text-white mb-6">
              游戏说明
            </h2>

            <div className="space-y-6 text-harbor-200">
              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  🎯 游戏目标
                </h3>
                <p>调度拖轮协助大船安全、准时靠泊和离泊，在规定时间内完成所有任务。</p>
              </div>

              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  🌊 潮汐系统
                </h3>
                <p>
                  潮汐水位会周期性变化。大船吃水深度超过当前水位时无法进出港。必须在潮汐窗口内完成作业。
                </p>
              </div>

              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  🚢 调度操作
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>点击船舶选中，再点击拖轮分配任务</li>
                  <li>或先点击拖轮，再点击船舶进行分配</li>
                  <li>每艘大船需要指定数量的拖轮才能移动</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  ⛽ 燃油管理
                </h3>
                <p>拖轮作业时消耗燃油。燃油耗尽时拖轮无法工作。</p>
              </div>

              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  ⚠️ 碰撞警告
                </h3>
                <p>船舶和拖轮距离过近会触发警告，实际碰撞将导致游戏失败。</p>
              </div>

              <div>
                <h3 className="text-xl font-oswald font-semibold text-warning-500 mb-2">
                  ⏱️ 时间控制
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>空格键：暂停/继续</li>
                  <li>1/2/3键：调整游戏速度</li>
                  <li>鼠标拖拽：旋转视角</li>
                  <li>滚轮：缩放</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="mt-8 w-full btn-industrial bg-warning-500 text-white border-warning-400 hover:bg-warning-400"
            >
              知道了
            </button>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="mt-8 text-harbor-500 text-sm"
      >
        新人培训专用 · 港口调度模拟系统 v1.0
      </motion.div>
    </div>
  );
}
