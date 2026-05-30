import { useState } from 'react';
import {
  Sun,
  Zap,
  Grid3X3,
  Layers,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ConnectionType } from '../types';

export function ConfigPanel() {
  const {
    arrayConfig,
    shadowConfig,
    setArrayConfig,
    setConnectionType,
    setBypassDiode,
    setSunAngle,
    addObstacle,
    removeObstacle,
    clearObstacles,
  } = useStore();

  const [obstacleSize, setObstacleSize] = useState({ width: 80, height: 60 });

  const handleAddObstacle = () => {
    const obstacle = {
      id: `obstacle-${Date.now()}`,
      type: 'rectangle' as const,
      position: {
        x: Math.random() * 200 + 50,
        y: Math.random() * 150 + 30,
      },
      size: { ...obstacleSize },
      opacity: 0.8,
    };
    addObstacle(obstacle);
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary-500" />
          阵列配置
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">行数</label>
              <input
                type="range"
                min="1"
                max="6"
                value={arrayConfig.rows}
                onChange={(e) => setArrayConfig({ rows: Number(e.target.value) })}
                className="slider"
              />
              <div className="text-right text-sm text-neutral-400 mt-1">
                {arrayConfig.rows} 行
              </div>
            </div>
            <div>
              <label className="form-label">列数</label>
              <input
                type="range"
                min="1"
                max="8"
                value={arrayConfig.cols}
                onChange={(e) => setArrayConfig({ cols: Number(e.target.value) })}
                className="slider"
              />
              <div className="text-right text-sm text-neutral-400 mt-1">
                {arrayConfig.cols} 列
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">连接方式</label>
            <div className="grid grid-cols-3 gap-2">
              {(['series', 'parallel', 'hybrid'] as ConnectionType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setConnectionType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      arrayConfig.connectionType === type
                        ? 'bg-primary-500 text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    {type === 'series'
                      ? '串联'
                      : type === 'parallel'
                      ? '并联'
                      : '混联'}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning-500" />
              <span className="text-sm text-neutral-600">旁路二极管</span>
            </div>
            <button
              onClick={() => setBypassDiode(!arrayConfig.modules[0]?.bypassDiode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                arrayConfig.modules[0]?.bypassDiode
                  ? 'bg-solar-500'
                  : 'bg-neutral-200'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  arrayConfig.modules[0]?.bypassDiode
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Sun className="w-5 h-5 text-warning-500" />
          太阳角度
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="form-label">
              高度角: {shadowConfig.sunAltitude}°
            </label>
            <input
              type="range"
              min="0"
              max="90"
              value={shadowConfig.sunAltitude}
              onChange={(e) =>
                setSunAngle(Number(e.target.value), shadowConfig.sunAzimuth)
              }
              className="slider"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>0° 日出</span>
              <span>45° 正午</span>
              <span>90° 直射</span>
            </div>
          </div>

          <div>
            <label className="form-label">
              方位角: {shadowConfig.sunAzimuth}°
            </label>
            <input
              type="range"
              min="0"
              max="360"
              value={shadowConfig.sunAzimuth}
              onChange={(e) =>
                setSunAngle(shadowConfig.sunAltitude, Number(e.target.value))
              }
              className="slider"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>0° 北</span>
              <span>90° 东</span>
              <span>180° 南</span>
              <span>270° 西</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neutral-500" />
            遮挡物
          </div>
          {shadowConfig.obstacles.length > 0 && (
            <button
              onClick={clearObstacles}
              className="text-xs text-danger-500 hover:text-danger-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              清空
            </button>
          )}
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">宽度</label>
              <input
                type="number"
                value={obstacleSize.width}
                onChange={(e) =>
                  setObstacleSize((s) => ({ ...s, width: Number(e.target.value) }))
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">高度</label>
              <input
                type="number"
                value={obstacleSize.height}
                onChange={(e) =>
                  setObstacleSize((s) => ({ ...s, height: Number(e.target.value) }))
                }
                className="form-input"
              />
            </div>
          </div>

          <button
            onClick={handleAddObstacle}
            className="w-full btn-secondary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加遮挡物
          </button>

          {shadowConfig.obstacles.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {shadowConfig.obstacles.map((obs, index) => (
                <div
                  key={obs.id}
                  className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg"
                >
                  <span className="text-sm text-neutral-600">
                    遮挡物 {index + 1}
                  </span>
                  <button
                    onClick={() => removeObstacle(obs.id)}
                    className="p-1 text-danger-500 hover:bg-danger-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
