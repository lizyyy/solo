import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import GameBoard from '@/components/GameBoard';
import ControlPanel from '@/components/ControlPanel';
import StatusPanel from '@/components/StatusPanel';
import SonarLog from '@/components/SonarLog';

export default function GamePage() {
  const { gameState, selectedLevel } = useGameStore();
  const [boardSize, setBoardSize] = useState(600);

  useKeyboardShortcuts();

  useEffect(() => {
    const updateSize = () => {
      const maxWidth = Math.min(window.innerWidth - 340, 700);
      const maxHeight = Math.min(window.innerHeight - 100, 700);
      const size = Math.min(maxWidth, maxHeight);
      setBoardSize(Math.max(400, size));
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (!gameState || !selectedLevel) return null;

  return (
    <div className="min-h-screen bg-sonar-bg crt-effect flex flex-col p-4 relative overflow-hidden">
      <div className="scanline-overlay" />

      <div className="flex items-center justify-between mb-4 z-10">
        <div>
          <h1
            className="font-vt323 text-2xl text-sonar-green"
            style={{ textShadow: '0 0 10px #39ff14' }}
          >
            潜艇声呐 · {selectedLevel.name}
          </h1>
          <p className="text-sonar-green/50 font-jetbrains text-xs">
            快捷键: 1/2/3 扫描 | 空格 攻击 | E 结束回合 | P 暂停 | R 重开
          </p>
        </div>
        <div className="text-right">
          <div className="font-vt323 text-lg text-sonar-cyan">
            {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
          <div className="text-sonar-cyan/50 font-jetbrains text-xs">
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_280px] gap-4 z-10">
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <GameBoard width={boardSize} height={boardSize} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <StatusPanel />
            <SonarLog />
          </div>
        </div>

        <div className="lg:order-last order-first">
          <ControlPanel />
        </div>
      </div>

      <div className="mt-4 text-center text-sonar-green/40 text-xs font-jetbrains z-10">
        <p>声呐网格游戏 v1.0 | 点击网格选择目标 | 绿色回波=真实目标 | 黄色可疑=噪声干扰</p>
      </div>
    </div>
  );
}
