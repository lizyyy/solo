import { GameCanvas } from './components/game/GameCanvas';
import { TopBar } from './components/ui/TopBar';
import { LeftPanel } from './components/ui/LeftPanel';
import { RightPanel } from './components/ui/RightPanel';
import { BottomBar } from './components/ui/BottomBar';
import { NodeTooltip } from './components/ui/NodeTooltip';
import { ResultModal } from './components/modals/ResultModal';
import { Pause } from 'lucide-react';
import { useGameStore } from './store/useGameStore';

function App() {
  const { status } = useGameStore();

  return (
    <div className="w-screen h-screen bg-slate-950 overflow-hidden relative">
      <GameCanvas />

      <TopBar />
      <LeftPanel />
      <RightPanel />
      <BottomBar />
      <NodeTooltip />
      <ResultModal />

      {status === 'paused' && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="text-center">
            <Pause className="w-16 h-16 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">游戏暂停</h2>
            <p className="text-slate-400">点击底部播放按钮继续</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
