import { X, Wrench, Gauge, Droplets, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { Drain, Pump, Lowland } from '../engine/types';

export function FacilityPanel() {
  const { state, clearDrain, adjustPumpPower } = useGameStore();
  const selectedCell = state.selectedCell;

  if (!selectedCell) return null;

  const cell = state.grid[selectedCell.y]?.[selectedCell.x];
  if (!cell) return null;

  const facility = cell.facility;

  const handleClose = () => {
    useGameStore.getState().selectCell(-1, -1);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -300 }}
        className="absolute left-4 top-4 z-10 w-80"
      >
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div>
              <h3 className="text-white font-bold">
                {facility ? `${facility.type === 'drain' ? '雨水口' : facility.type === 'pump' ? '泵站' : '低洼点'}详情` : '网格信息'}
              </h3>
              <p className="text-gray-400 text-sm">位置: ({selectedCell.x}, {selectedCell.y})</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">地形类型</div>
              <div className="text-white font-medium">
                {cell.type === 'road' && '道路'}
                {cell.type === 'building' && '建筑'}
                {cell.type === 'drain' && '雨水口'}
                {cell.type === 'pump' && '泵站'}
                {cell.type === 'lowland' && '低洼点'}
                {cell.type === 'empty' && '空地'}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">海拔高度</div>
              <div className="text-white font-medium">{cell.elevation.toFixed(1)} m</div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">积水深度</div>
              <div className={`font-medium ${cell.waterDepth > 2 ? 'text-red-400' : cell.waterDepth > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                {cell.waterDepth.toFixed(2)}
              </div>
            </div>

            {facility && facility.type === 'drain' && (
              <DrainControls drain={facility as Drain} onClear={() => clearDrain(facility.id)} isReplayMode={state.isReplayMode} />
            )}

            {facility && facility.type === 'pump' && (
              <PumpControls
                pump={facility as Pump}
                onAdjustPower={(power) => adjustPumpPower(facility.id, power)}
                isReplayMode={state.isReplayMode}
              />
            )}

            {facility && facility.type === 'lowland' && (
              <LowlandInfo lowland={facility as Lowland} isReplayMode={state.isReplayMode} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DrainControls({ drain, onClear, isReplayMode }: { drain: Drain; onClear: () => void; isReplayMode: boolean }) {
  const blockagePercent = drain.blockage * 100;

  return (
    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Droplets className="text-blue-400" size={18} />
        <span className="text-blue-300 font-medium">雨水口控制</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">堵塞程度</span>
            <span className={`font-medium ${blockagePercent > 70 ? 'text-red-400' : blockagePercent > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
              {blockagePercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${blockagePercent > 70 ? 'bg-red-500' : blockagePercent > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${blockagePercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="text-gray-400 text-xs mb-1">收集效率</div>
          <div className="text-white">{(drain.efficiency * 100).toFixed(0)}%</div>
        </div>

        <div>
          <div className="text-gray-400 text-xs mb-1">本回合收集量</div>
          <div className="text-white">{drain.collectedWater.toFixed(1)}</div>
        </div>

        <button
          onClick={onClear}
          disabled={drain.blockage === 0 || isReplayMode}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Wrench size={16} />
          清理堵塞 (+50分)
        </button>
      </div>
    </div>
  );
}

function PumpControls({ pump, onAdjustPower, isReplayMode }: { pump: Pump; onAdjustPower: (power: number) => void; isReplayMode: boolean }) {
  const isDisabled = pump.status === 'broken';

  return (
    <div className="bg-orange-900/30 rounded-lg p-4 border border-orange-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Power className="text-orange-400" size={18} />
        <span className="text-orange-300 font-medium">泵站控制</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">运行状态</span>
            <span className={`font-medium ${
              pump.status === 'normal' ? 'text-green-400' :
              pump.status === 'warning' ? 'text-yellow-400' :
              pump.status === 'danger' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {pump.status === 'normal' ? '正常' :
               pump.status === 'warning' ? '负载高' :
               pump.status === 'danger' ? '超载' : '已损坏'}
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">功率设置</span>
            <span className="text-white font-medium">{(pump.power * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={pump.power}
            onChange={(e) => onAdjustPower(parseFloat(e.target.value))}
            disabled={isDisabled || isReplayMode}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">当前负载</span>
            <span className={`font-medium ${
              pump.currentLoad > 0.9 ? 'text-red-400' :
              pump.currentLoad > 0.6 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {(pump.currentLoad * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                pump.currentLoad > 0.9 ? 'bg-red-500' :
                pump.currentLoad > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(pump.currentLoad * 100, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="text-gray-400 text-xs mb-1">本回合抽水量</div>
          <div className="text-white">{pump.pumpedWater.toFixed(1)}</div>
        </div>

        {pump.overloadCount > 0 && (
          <div className="text-red-400 text-sm">
            ⚠️ 连续超载 {pump.overloadCount} 回合
          </div>
        )}
      </div>
    </div>
  );
}

function LowlandInfo({ lowland, isReplayMode }: { lowland: Lowland; isReplayMode: boolean }) {
  const { setLowlandWarningThreshold, activateTemporaryDrain } = useGameStore();
  const dangerPercent = (lowland.waterLevel / lowland.maxSafeLevel) * 100;
  const warningPercent = (lowland.warningThreshold / lowland.maxSafeLevel) * 100;

  const handleActivateDrain = () => {
    if (!isReplayMode) {
      activateTemporaryDrain(lowland.id);
    }
  };

  return (
    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="text-purple-400" size={18} />
        <span className="text-purple-300 font-medium">低洼点监测</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">当前水位</span>
            <span className={`font-medium ${dangerPercent > 100 ? 'text-red-400' : dangerPercent > warningPercent ? 'text-yellow-400' : 'text-green-400'}`}>
              {lowland.waterLevel.toFixed(1)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden relative">
            <div
              className="absolute h-full bg-yellow-500/30 transition-all"
              style={{ width: `${warningPercent}%` }}
            />
            <div
              className={`relative h-full transition-all ${dangerPercent > 100 ? 'bg-red-500' : dangerPercent > warningPercent ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(dangerPercent, 150)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>预警线: {lowland.warningThreshold}</span>
            <span>安全阈值: {lowland.maxSafeLevel}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">预警阈值</span>
            <span className="text-yellow-400 font-medium">{lowland.warningThreshold.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="1"
            max={lowland.maxSafeLevel}
            step="0.5"
            value={lowland.warningThreshold}
            onChange={(e) => setLowlandWarningThreshold(lowland.id, parseFloat(e.target.value))}
            disabled={isReplayMode}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 disabled:opacity-50"
          />
        </div>

        {lowland.temporaryDrainRemaining > 0 && (
          <div className="text-green-400 text-sm bg-green-900/30 p-2 rounded">
            💧 临时排水中, 剩余 {lowland.temporaryDrainRemaining} 回合
          </div>
        )}

        {lowland.temporaryDrainRemaining === 0 && (
          <button
            onClick={handleActivateDrain}
            disabled={isReplayMode}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Droplets size={16} />
            启动临时排水 (-100分)
          </button>
        )}

        {lowland.dangerCount > 0 && (
          <div className="text-red-400 text-sm">
            ⚠️ 水位超标 {lowland.dangerCount} 回合
          </div>
        )}
      </div>
    </div>
  );
}
