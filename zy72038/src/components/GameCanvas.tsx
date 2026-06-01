import React, { useCallback } from 'react';
import { Shield, Lock, Database, Eye } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useGameEngine } from '@/hooks/useGameEngine';
import { TowerType } from '@/types/game';
import { TOWER_CONFIG, ENEMY_CONFIG } from '@/utils/gameUtils';

const towerIcons: Record<TowerType, React.ReactNode> = {
  firewall: <Shield className="w-6 h-6" />,
  encryption: <Lock className="w-6 h-6" />,
  backup: <Database className="w-6 h-6" />,
  monitor: <Eye className="w-6 h-6" />,
};

export const GameCanvas: React.FC = () => {
  const { towers, enemies, selectedTowerType, status } = useGameStore();
  const { buildTower, GRID_SIZE, CELL_SIZE } = useGameEngine();

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (status !== 'playing' || !selectedTowerType) return;
      buildTower(selectedTowerType, x, y);
    },
    [status, selectedTowerType, buildTower]
  );

  const canvasWidth = GRID_SIZE * CELL_SIZE;
  const canvasHeight = GRID_SIZE * CELL_SIZE;

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const x = index % GRID_SIZE;
          const y = Math.floor(index / GRID_SIZE);
          const isPath = y === Math.floor(GRID_SIZE / 2);

          return (
            <div
              key={`cell-${x}-${y}`}
              className={`
                border border-slate-800 flex items-center justify-center
                cursor-pointer transition-all duration-200
                ${isPath ? 'bg-slate-800/50' : 'bg-slate-900/50 hover:bg-slate-800/30'}
                ${selectedTowerType && status === 'playing' ? 'hover:ring-2 hover:ring-blue-500/50' : ''}
              `}
              onClick={() => handleCellClick(x, y)}
            />
          );
        })}

        {towers.map((tower) => (
          <div
            key={tower.id}
            className="absolute flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-lg animate-pulse"
            style={{
              left: tower.position.x * CELL_SIZE + 4,
              top: tower.position.y * CELL_SIZE + 4,
              width: CELL_SIZE - 8,
              height: CELL_SIZE - 8,
            }}
          >
            <div className="text-white">
              {towerIcons[tower.type]}
            </div>
          </div>
        ))}

        {enemies.map((enemy) => {
          const config = ENEMY_CONFIG[enemy.type];
          const healthPercent = (enemy.health / enemy.maxHealth) * 100;

          return (
            <div
              key={enemy.id}
              className="absolute transition-all duration-100 ease-linear"
              style={{
                left: enemy.position.x * CELL_SIZE + 8,
                top: enemy.position.y * CELL_SIZE + 8,
                width: CELL_SIZE - 16,
                height: CELL_SIZE - 16,
              }}
            >
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xs font-bold">
                  {config.name.charAt(0)}
                </span>
              </div>
              <div className="absolute -bottom-2 left-0 w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-100"
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute top-2 left-2 bg-slate-800/90 px-3 py-1 rounded text-sm text-slate-300">
        入口 →
      </div>
      <div
        className="absolute top-2 bg-slate-800/90 px-3 py-1 rounded text-sm text-slate-300"
        style={{ right: '8px' }}
      >
        钱包
      </div>

      <div
        className="absolute top-0 bottom-0 w-1 bg-gradient-to-r from-red-500/50 to-transparent"
        style={{ left: CELL_SIZE * Math.floor(GRID_SIZE / 2) }}
      />
    </div>
  );
};
