import { useGameStore } from '@/store/gameStore';
import type { ScanType } from '@/types/game';
import { Radio, Eye, EyeOff, Zap } from 'lucide-react';

export default function ControlPanel() {
  const {
    gameState,
    performScan,
    performAttack,
    endTurn,
    pauseGame,
    resumeGame,
    restartGame,
    resetStore,
    canPerformAction,
    renderOptions,
    setRenderOption,
    addLogMessages,
  } = useGameStore();

  if (!gameState) return null;

  const isPlaying = gameState.gameStatus === 'playing';
  const isPaused = gameState.gameStatus === 'paused';

  const handleScan = (type: 'active' | 'fan' | 'passive') => {
    if (!isPlaying) return;
    const check = canPerformAction(type);
    if (!check.allowed) {
      addLogMessages([`[错误] ${check.reason}`]);
      return;
    }
    performScan(type);
  };

  const handleAttack = () => {
    if (!isPlaying) return;
    const check = canPerformAction('attack');
    if (!check.allowed) {
      addLogMessages([`[错误] ${check.reason}`]);
      return;
    }
    performAttack();
  };

  const handleEndTurn = () => {
    if (!isPlaying) return;
    endTurn();
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeGame();
    } else if (isPlaying) {
      pauseGame();
    }
  };

  const handleRestart = () => {
    if (window.confirm('确定要重新开始游戏吗？当前进度将丢失。')) {
      restartGame();
    }
  };

  const handleQuit = () => {
    if (window.confirm('确定要退出游戏吗？当前进度将丢失。')) {
      resetStore();
    }
  };

  const renderScanButton = (
    type: 'active' | 'fan' | 'passive',
    label: string,
    icon: string,
    shortcut: string,
    colorClass: string
  ) => {
    const config = gameState.level.scanConfigs[type];
    const cooldown = gameState.scanCooldowns[type];
    const check = canPerformAction(type);
    const isOnCooldown = cooldown > 0;
    const canUse = check.allowed;

    return (
      <button
        key={type}
        onClick={() => handleScan(type)}
        disabled={!canUse || isPaused}
        className={`military-btn w-full text-left ${
          isOnCooldown ? 'opacity-60' : ''
        } ${colorClass}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </span>
          <span className="text-xs opacity-70">[{shortcut}]</span>
        </div>
        <div className="text-xs opacity-70">
          能量: {config.energyCost} | 范围: {config.range}
          {isOnCooldown && <span className="text-sonar-amber ml-2">冷却: {cooldown}</span>}
        </div>
        {isOnCooldown && (
          <div className="cooldown-bar">
            <div
              className="cooldown-fill"
              style={{ width: `${(1 - cooldown / config.cooldown) * 100}%` }}
            />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="panel h-full flex flex-col">
      <h3 className="panel-title">声呐控制台</h3>

      <div className="space-y-3 mb-4">
        {renderScanButton('active', '主动扫描', '📡', '1', '')}
        {renderScanButton('fan', '扇形扫描', '🔍', '2', 'amber')}
        {renderScanButton('passive', '被动监听', '👂', '3', 'amber')}
      </div>

      <div className="space-y-3 mb-4">
        <button
          onClick={handleAttack}
          disabled={!canPerformAction('attack').allowed || isPaused}
          className="military-btn red w-full text-left"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2">
              <span className="text-xl">💣</span>
              <span>深水炸弹</span>
            </span>
            <span className="text-xs opacity-70">[空格]</span>
          </div>
          <div className="text-xs opacity-70">
            能量: {gameState.level.scanConfigs.attack.energyCost}
            {!gameState.selectedPosition && (
              <span className="text-sonar-amber ml-2">请选择目标</span>
            )}
          </div>
        </button>

        <button
          onClick={handleEndTurn}
          disabled={!isPlaying || isPaused}
          className="military-btn w-full"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>结束回合</span>
            </span>
            <span className="text-xs opacity-70">[E]</span>
          </div>
        </button>
      </div>

      <div className="border-t border-sonar-green/30 pt-4 mb-4">
        <h4 className="font-vt323 text-lg text-sonar-green mb-3">显示选项</h4>
        <div className="space-y-2">
          <button
            onClick={() => setRenderOption('showNoiseSources', !renderOptions.showNoiseSources)}
            className={`w-full flex items-center justify-between p-2 rounded border ${
              renderOptions.showNoiseSources
                ? 'border-sonar-green bg-sonar-green/10'
                : 'border-sonar-green/30'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-jetbrains text-sonar-green">
              {renderOptions.showNoiseSources ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4 opacity-50" />
              )}
              显示噪声源
            </span>
            <span className="text-sonar-amber text-xs">N</span>
          </button>

          <button
            onClick={() => setRenderOption('showTrajectories', !renderOptions.showTrajectories)}
            className={`w-full flex items-center justify-between p-2 rounded border ${
              renderOptions.showTrajectories
                ? 'border-sonar-green bg-sonar-green/10'
                : 'border-sonar-green/30'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-jetbrains text-sonar-green">
              {renderOptions.showTrajectories ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4 opacity-50" />
              )}
              显示轨迹线
            </span>
            <span className="text-sonar-amber text-xs">T</span>
          </button>
        </div>
      </div>

      <div className="border-t border-sonar-green/30 pt-4 mt-auto">
        <h4 className="font-vt323 text-lg text-sonar-green mb-3">游戏控制</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePauseResume}
            disabled={gameState.gameStatus === 'victory' || gameState.gameStatus === 'defeat'}
            className="military-btn text-xs"
          >
            {isPaused ? '继续' : '暂停'} [P]
          </button>
          <button onClick={handleRestart} className="military-btn amber text-xs">
            重开 [R]
          </button>
          <button onClick={handleQuit} className="military-btn red text-xs col-span-2">
            退出到主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
