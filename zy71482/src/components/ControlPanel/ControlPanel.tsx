import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Upload, Trash2, Plus, Minus } from 'lucide-react';
import { useCurlingStore } from '../../store/curlingStore';
import { RotationDirection, StoneParams, ICE_SHEET_LENGTH, MIN_FRICTION, MAX_FRICTION, MAX_VELOCITY } from '../../types';

export const ControlPanel: React.FC = () => {
  const {
    dataSources,
    selectedStoneId,
    simulation,
    setPlaying,
    setCurrentTime,
    setSimulationSpeed,
    runSimulation,
    updateStone,
    addDataSource,
    removeDataSource,
    selectStone
  } = useCurlingStore();

  const [newStoneColor, setNewStoneColor] = useState<'red' | 'yellow'>('yellow');
  const [showAddStone, setShowAddStone] = useState(false);

  const allStones = dataSources.flatMap(s => s.stones);
  const selectedStone = allStones.find(s => s.id === selectedStoneId);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        addDataSource({
          name: file.name,
          contributor: '导入文件',
          type: 'raw',
          stones: data.stones || []
        });
      } catch {
          return;
        }
    };
    reader.readAsText(file);
  };

  const handleAddStone = () => {
    addDataSource({
      name: '手动添加',
      contributor: '当前用户',
      type: 'processed',
      stones: [{
        color: newStoneColor,
        initialVelocity: { x: 0, y: 1.5 },
        rotation: { direction: 'clockwise', speed: 30 },
        friction: 0.015,
        initialPosition: { x: 0, y: -ICE_SHEET_LENGTH / 2 + 1 }
      }]
    });
    setShowAddStone(false);
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">冰壶碰撞路径复盘</h2>
        
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setPlaying(!simulation.isPlaying)}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center gap-2 transition-colors"
          >
            {simulation.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {simulation.isPlaying ? '暂停' : '播放'}
          </button>
          <button
            onClick={() => {
              setCurrentTime(0);
              setPlaying(false);
            }}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="mb-3">
          <label className="text-sm text-gray-400 mb-1 block">
            时间: {simulation.currentTime.toFixed(1)}s / {simulation.maxTime.toFixed(1)}s
          </label>
          <input
            type="range"
            min={0}
            max={simulation.maxTime}
            step={0.1}
            value={simulation.currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="mb-3">
          <label className="text-sm text-gray-400 mb-1 block">
          播放速度: {simulation.speed}x
          </label>
          <div className="flex gap-2">
            {[0.5, 1, 2].map(speed => (
              <button
                key={speed}
                onClick={() => setSimulationSpeed(speed)}
                className={`flex-1 py-1 px-2 rounded text-sm transition-colors ${
                  simulation.speed === speed
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">数据源</h3>
            <div className="flex gap-1">
              <label className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer transition-colors">
                <Upload size={14} />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowAddStone(!showAddStone)}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {showAddStone && (
            <div className="mb-3 p-3 bg-gray-800 rounded border border-gray-600">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setNewStoneColor('yellow')}
                  className={`flex-1 py-1 px-2 rounded text-sm ${
                    newStoneColor === 'yellow' ? 'bg-yellow-600' : 'bg-gray-700'
                  }`}
                >
                  黄壶
                </button>
                <button
                  onClick={() => setNewStoneColor('red')}
                  className={`flex-1 py-1 px-2 rounded text-sm ${
                    newStoneColor === 'red' ? 'bg-red-600' : 'bg-gray-700'
                  }`}
                >
                  红壶
                </button>
              </div>
              <button
                onClick={handleAddStone}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                添加冰壶
              </button>
            </div>
          )}

          {dataSources.map(source => (
            <div
              key={source.id}
              className="mb-3 p-3 bg-gray-800 rounded border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-white">{source.name}</div>
                  <div className="text-xs text-gray-400">
                    {source.contributor} · {source.type === 'raw' ? '原始材料' : '处理结果'}
                  </div>
                </div>
                <button
                  onClick={() => removeDataSource(source.id)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {source.stones.map(stone => (
                    <button
                      key={stone.id}
                      onClick={() => selectStone(stone.id)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        stone.color === 'red' ? 'bg-red-500' : 'bg-yellow-400'
                      } ${
                        selectedStoneId === stone.id
                          ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800'
                          : 'border-gray-600'
                      }`}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>

        {selectedStone && (
          <div className="p-3 bg-gray-800 rounded border border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">
            {selectedStone.color === 'red' ? '🔴 红壶参数' : '🟡 黄壶参数'}
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>出手速度 (m/s)</span>
                <span className="font-mono">
                  {Math.sqrt(selectedStone.initialVelocity.y ** 2 + selectedStone.initialVelocity.x ** 2).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={MAX_VELOCITY}
                step={0.1}
                value={Math.sqrt(selectedStone.initialVelocity.y ** 2 + selectedStone.initialVelocity.x ** 2)}
                onChange={(e) => {
                  const speed = parseFloat(e.target.value);
                  const currentAngle = Math.atan2(selectedStone.initialVelocity.x, selectedStone.initialVelocity.y);
                  updateStone(selectedStone.id, {
                    initialVelocity: {
                      x: Math.sin(currentAngle) * speed,
                      y: Math.cos(currentAngle) * speed
                    }
                  });
                }}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>横向偏移</span>
                <span className="font-mono">{selectedStone.initialVelocity.x.toFixed(3)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateStone(selectedStone.id, {
                    initialVelocity: {
                      ...selectedStone.initialVelocity,
                      x: Math.max(-0.5, selectedStone.initialVelocity.x - 0.02)
                    }
                  })}
                  className="p-1 bg-gray-700 rounded"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="range"
                  min={-0.5}
                  max={0.5}
                  step={0.01}
                  value={selectedStone.initialVelocity.x}
                  onChange={(e) => updateStone(selectedStone.id, {
                    initialVelocity: {
                      ...selectedStone.initialVelocity,
                      x: parseFloat(e.target.value)
                    }
                  })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <button
                  onClick={() => updateStone(selectedStone.id, {
                    initialVelocity: {
                      ...selectedStone.initialVelocity,
                      x: Math.min(0.5, selectedStone.initialVelocity.x + 0.02)
                    }
                  })}
                  className="p-1 bg-gray-700 rounded"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>旋转方向</span>
              </div>
              <div className="flex gap-2">
                {(['clockwise', 'counterclockwise'] as const).map(dir => (
                  <button
                    key={dir}
                    onClick={() => updateStone(selectedStone.id, {
                      rotation: {
                        ...selectedStone.rotation,
                        direction: dir as RotationDirection
                      }
                    })}
                    className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${
                      selectedStone.rotation.direction === dir
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {dir === 'clockwise' ? '顺时针 ↻' : '逆时针 ↺'}
                  </button>
                  ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>旋转强度 (rpm)</span>
                <span className="font-mono">{selectedStone.rotation.speed.toFixed(0)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={selectedStone.rotation.speed}
                onChange={(e) => updateStone(selectedStone.id, {
                  rotation: {
                    ...selectedStone.rotation,
                    speed: parseFloat(e.target.value)
                  }
                })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>冰面摩擦系数</span>
                <span className="font-mono">{selectedStone.friction.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min={MIN_FRICTION}
                max={MAX_FRICTION}
                step={0.001}
                value={selectedStone.friction}
                onChange={(e) => updateStone(selectedStone.id, {
                  friction: parseFloat(e.target.value)
                })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={runSimulation}
            className="w-full mt-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
          >
            重新计算
          </button>
        </div>
        )}
      </div>
    </div>
  );
};
