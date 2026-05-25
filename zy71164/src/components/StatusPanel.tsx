import { useGameStore } from '@/store/gameStore';
import { Target, Battery, Clock, Crosshair, AlertTriangle } from 'lucide-react';

export default function StatusPanel() {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { level, currentTurn, energy, maxEnergy, targets, destroyedTargets, score } = gameState;
  const aliveTargets = targets.filter((t) => !t.isDestroyed && !t.hasEscaped).length;
  const escapedTargets = targets.filter((t) => t.hasEscaped).length;

  const energyPercent = (energy / maxEnergy) * 100;
  const getEnergyColor = () => {
    if (energyPercent > 60) return 'var(--sonar-green)';
    if (energyPercent > 30) return 'var(--sonar-amber)';
    return 'var(--sonar-red)';
  };

  return (
    <div className="panel">
      <h3 className="panel-title">任务状态</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-sonar-dark/50 rounded border border-sonar-green/30">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-sonar-cyan" />
            <span className="text-sonar-cyan font-jetbrains text-xs">当前回合</span>
          </div>
          <div
            className="font-vt323 text-3xl text-sonar-cyan"
            style={{ textShadow: '0 0 10px #00ffff' }}
          >
            {currentTurn}
          </div>
        </div>

        <div className="text-center p-3 bg-sonar-dark/50 rounded border border-sonar-amber/30">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Target className="w-4 h-4 text-sonar-amber" />
            <span className="text-sonar-amber font-jetbrains text-xs">当前得分</span>
          </div>
          <div
            className="font-vt323 text-3xl text-sonar-amber"
            style={{ textShadow: '0 0 10px #ffb000' }}
          >
            {score}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4" style={{ color: getEnergyColor() }} />
            <span className="font-jetbrains text-sm" style={{ color: getEnergyColor() }}>
              能量储备
            </span>
          </div>
          <span className="font-jetbrains text-sm" style={{ color: getEnergyColor() }}>
            {energy} / {maxEnergy}
          </span>
        </div>
        <div className="energy-bar">
          <div
            className="energy-fill"
            style={{
              width: `${energyPercent}%`,
              background: `linear-gradient(90deg, ${getEnergyColor()}88, ${getEnergyColor()})`,
            }}
          />
          <span className="energy-text font-jetbrains">
            {Math.round(energyPercent)}%
          </span>
        </div>
      </div>

      <div className="border-t border-sonar-green/30 pt-4 mb-4">
        <h4 className="font-vt323 text-lg text-sonar-green mb-3 flex items-center gap-2">
          <Crosshair className="w-5 h-5" />
          目标状态
        </h4>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sonar-green/70 font-jetbrains text-sm">海域大小</span>
            <span className="text-sonar-green font-jetbrains text-sm">
              {level.gridSize}x{level.gridSize}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sonar-green/70 font-jetbrains text-sm">目标总数</span>
            <span className="text-sonar-green font-jetbrains text-sm">
              {targets.length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sonar-green/70 font-jetbrains text-sm">已消灭</span>
            <span className="text-sonar-green font-jetbrains text-sm">
              {destroyedTargets}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sonar-green/70 font-jetbrains text-sm">剩余目标</span>
            <span
              className="font-jetbrains text-sm"
              style={{
                color: aliveTargets > 0 ? 'var(--sonar-amber)' : 'var(--sonar-green)',
              }}
            >
              {aliveTargets}
            </span>
          </div>
          {escapedTargets > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sonar-red/70 font-jetbrains text-sm flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                已逃脱
              </span>
              <span className="text-sonar-red font-jetbrains text-sm">
                {escapedTargets}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-sonar-green/30 pt-4">
        <h4 className="font-vt323 text-lg text-sonar-green mb-3">扫描冷却</h4>
        <div className="space-y-2">
          {(['active', 'fan', 'passive', 'attack'] as const).map((type) => {
            const config = level.scanConfigs[type];
            const cooldown = gameState.scanCooldowns[type];
            const isReady = cooldown === 0;

            return (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sonar-green/70 font-jetbrains text-xs">
                  {config.name}
                </span>
                <span
                  className={`font-jetbrains text-xs ${
                    isReady ? 'text-sonar-green' : 'text-sonar-amber'
                  }`}
                >
                  {isReady ? '就绪' : `${cooldown}回合`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
