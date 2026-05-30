
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, RotateCcw, FileBarChart, BookOpen } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { StatusBar } from '../components/game/StatusBar';
import { MineGrid } from '../components/game/MineGrid';
import { SpectrumAnalyzer } from '../components/game/SpectrumAnalyzer';
import { EquipmentPanel } from '../components/game/EquipmentPanel';
import { Inventory } from '../components/game/Inventory';
import { MessageToast } from '../components/game/MessageToast';
import { MineCell } from '../types';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCell, selectCell, phase, endGame, resetGame } = useGameStore();
  const [showRules, setShowRules] = useState(false);

  const selectedCellData = useGameStore((state) =>
    state.mineGrid.flat().find((c) => c.id === selectedCell) || null
  );

  const handleCellClick = (cell: MineCell) => {
    selectCell(cell.id === selectedCell ? null : cell.id);
  };

  const handleEndGame = () => {
    endGame();
    navigate('/report');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <MessageToast />

      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">光谱采矿经营赛</h1>
                <p className="text-xs text-slate-400">地质科普实践游戏</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRules(!showRules)}
                className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                规则
              </button>
              <button
                onClick={resetGame}
                className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
              {phase === 'playing' && (
                <button
                  onClick={handleEndGame}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                >
                  <FileBarChart className="w-4 h-4" />
                  结算
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <StatusBar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <MineGrid onCellClick={handleCellClick} />
          </div>

          <div className="lg:col-span-5">
            <SpectrumAnalyzer selectedCell={selectedCellData} />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <EquipmentPanel selectedCell={selectedCellData} />
            <Inventory />
          </div>
        </div>
      </main>

      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold text-white mb-4">游戏规则</h2>

            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">🎯 游戏目标</h3>
                <p>在有限电量内，通过光谱分析识别矿石类型并开采，获得尽可能高的分数。</p>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">🔍 操作流程</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>选择扫描设备，点击未探测的格子进行扫描</li>
                  <li>分析光谱曲线，判断矿石类型</li>
                  <li>选择开采设备，对已识别的矿石进行开采</li>
                  <li>矿石自动入库，积累分数</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">⚠️ 注意事项</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><span className="text-red-400">光谱误判</span>：识别错误将扣除10分，且开采收益减半</li>
                  <li><span className="text-yellow-400">电量耗尽</span>：电量为0时游戏结束，额外扣除20分</li>
                  <li><span className="text-orange-400">库存混放</span>：不同矿石混放会降低价值</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">💎 矿石价值</h3>
                <ul className="space-y-1">
                  <li>石英：8分/单位</li>
                  <li>赤铁矿：15分/单位</li>
                  <li>萤石：20分/单位</li>
                  <li>黄铁矿：25分/单位</li>
                  <li>孔雀石：35分/单位</li>
                  <li>方铅矿：40分/单位</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">📊 评分标准</h3>
                <p>正确识别并开采：矿石价值 × 产量 × 设备效率 × 10</p>
                <p>及格线：150分</p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="mt-6 w-full py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-colors"
            >
              知道了
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};
