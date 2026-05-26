import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoomScene } from '../components/game3d/RoomScene';
import { HUD } from '../components/ui/HUD';
import { ControlPanel } from '../components/ui/ControlPanel';
import { RackDetail } from '../components/ui/RackDetail';
import { useGameStore } from '../store/useGameStore';
import { useUISTore } from '../store/useUISTore';

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();

  const {
    racks,
    acUnits,
    gamePhase,
    initGame,
    resetGame,
  } = useGameStore();

  const {
    showHeatmap,
    showLabels,
    selectedRackId,
    resetUI,
  } = useUISTore();

  useEffect(() => {
    if (levelId) {
      initGame(levelId);
      resetUI();
    }

    return () => {
      resetUI();
    };
  }, [levelId, initGame, resetUI]);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <RoomScene
          racks={racks}
          acUnits={acUnits}
          showHeatmap={showHeatmap}
          showLabels={showLabels}
          interactive={gamePhase === 'playing' || gamePhase === 'paused'}
        />
      </div>

      <HUD />
      <ControlPanel />
      {selectedRackId && <RackDetail />}

      {(gamePhase === 'won' || gamePhase === 'lost') && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-700/50 p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className={`text-6xl mb-4 ${gamePhase === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                {gamePhase === 'won' ? '🎉' : '💥'}
              </div>
              <h2 className={`text-3xl font-bold mb-2 ${gamePhase === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                {gamePhase === 'won' ? '挑战成功！' : '挑战失败'}
              </h2>
              <p className="text-slate-400">
                {gamePhase === 'won'
                  ? '恭喜你成功完成所有回合！'
                  : useGameStore.getState().failReason}
              </p>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-slate-400 text-sm">最终得分</div>
                  <div className="text-3xl font-bold text-cyan-400">
                    {useGameStore.getState().turnState.score}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">累计电费</div>
                  <div className="text-3xl font-bold text-green-400">
                    ¥{useGameStore.getState().turnState.totalCost.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  resetGame();
                  resetUI();
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 rounded-xl transition-colors"
              >
                重新开始
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-xl transition-colors"
              >
                返回主菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
