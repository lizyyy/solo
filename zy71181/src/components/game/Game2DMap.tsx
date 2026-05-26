import { useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { SLOPE_COLORS, INJURY_COLORS } from '../../game/types';

export function Game2DMap() {
  const { gameState, selectVictim, selectPatroller } = useGameStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const mapWidth = 400;
  const mapHeight = 300;
  const scale = 2;
  const offsetX = 200;
  const offsetY = 50;

  const transformX = (x: number) => offsetX + x * scale;
  const transformZ = (z: number) => offsetY + Math.abs(z) * scale;

  return (
    <div className="bg-slate-900/80 rounded-lg p-3 backdrop-blur-sm">
      <h3 className="text-white text-sm font-semibold mb-2">雪场地图</h3>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className="w-full h-auto"
        style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gameState.slopes.map((slope) => (
          <line
            key={slope.id}
            x1={transformX(slope.start.x)}
            y1={transformZ(slope.start.z)}
            x2={transformX(slope.end.x)}
            y2={transformZ(slope.end.z)}
            stroke={slope.isOpen ? SLOPE_COLORS[slope.difficulty] : '#4a5568'}
            strokeWidth={slope.isOpen ? 4 : 2}
            strokeDasharray={slope.isOpen ? 'none' : '5,5'}
            opacity={slope.isOpen ? 0.9 : 0.5}
          />
        ))}

        {gameState.patrollers.map((patroller) => (
          <g key={patroller.id}>
            <circle
              cx={transformX(patroller.position.x)}
              cy={transformZ(patroller.position.z)}
              r={gameState.selectedPatrollerId === patroller.id ? 10 : 7}
              fill={
                patroller.status === 'idle'
                  ? '#22c55e'
                  : patroller.status === 'dispatched'
                  ? '#3b82f6'
                  : '#f59e0b'
              }
              stroke={gameState.selectedPatrollerId === patroller.id ? '#ffff00' : 'none'}
              strokeWidth={2}
              filter={gameState.selectedPatrollerId === patroller.id ? 'url(#glow)' : 'none'}
              className="cursor-pointer transition-all"
              onClick={() => patroller.status === 'idle' && selectPatroller(patroller.id)}
            />
            <text
              x={transformX(patroller.position.x)}
              y={transformZ(patroller.position.z) + 15}
              fill="white"
              fontSize="8"
              textAnchor="middle"
            >
              {patroller.name.slice(0, 2)}
            </text>
          </g>
        ))}

        {gameState.victims.map((victim) => {
          if (victim.isRescued) return null;
          return (
            <g key={victim.id}>
              <rect
                x={transformX(victim.position.x) - 6}
                y={transformZ(victim.position.z) - 6}
                width={12}
                height={12}
                fill={INJURY_COLORS[victim.injury]}
                stroke={gameState.selectedVictimId === victim.id ? '#ffff00' : 'none'}
                strokeWidth={2}
                filter={gameState.selectedVictimId === victim.id ? 'url(#glow)' : 'none'}
                className="cursor-pointer"
                onClick={() => selectVictim(victim.id)}
              />
              <circle
                cx={transformX(victim.position.x)}
                cy={transformZ(victim.position.z) - 12}
                r={4}
                fill={INJURY_COLORS[victim.injury]}
              />
            </g>
          );
        })}

        <circle cx={transformX(0)} cy={transformZ(0)} r={5} fill="#ffffff" stroke="#165DFF" strokeWidth={2} />
        <text x={transformX(0)} y={transformZ(0) + 15} fill="white" fontSize="8" textAnchor="middle">
          救护站
        </text>

        <g transform="translate(10, 10)">
          <text fill="white" fontSize="10" fontWeight="bold">图例</text>
          <circle cx={5} cy={15} r={4} fill="#22c55e" />
          <text x={15} y={18} fill="white" fontSize="8">待命巡逻员</text>
          <circle cx={5} cy={30} r={4} fill="#3b82f6" />
          <text x={15} y={33} fill="white" fontSize="8">执行任务</text>
          <rect x={1} y={40} width={8} height={8} fill="#ef4444" />
          <text x={15} y={48} fill="white" fontSize="8">伤员</text>
        </g>
      </svg>
    </div>
  );
}
