import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LEVELS } from '../data/levels';
import { useGameStore } from '../store/useGameStore';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { GameCanvas } from '../components/game/GameCanvas';
import { InspectionPanel } from '../components/game/InspectionPanel';
import { StatusBar } from '../components/game/StatusBar';
import { OperationButtons } from '../components/game/OperationButtons';
import { PauseModal } from '../components/game/PauseModal';
import { ActionFeedback } from '../components/game/ActionFeedback';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function Game() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const { gameState, startGame, reset } = useGameStore();
  const [showPauseModal, setShowPauseModal] = useState(false);

  useKeyboardControls();

  useEffect(() => {
    const level = LEVELS.find((l) => l.id === Number(levelId));
    if (level) {
      startGame(level);
    } else {
      navigate('/');
    }

    return () => {
      const currentState = useGameStore.getState().gameState;
      if (currentState.status !== 'finished') {
        reset();
      }
    };
  }, [levelId, startGame, navigate, reset]);

  useEffect(() => {
    if (gameState.status === 'paused') {
      setShowPauseModal(true);
    } else if (gameState.status === 'playing') {
      setShowPauseModal(false);
    }
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.status === 'finished') {
      navigate('/result');
    }
  }, [gameState.status, navigate]);

  if (gameState.status === 'idle') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
          <h1 className="text-xl font-bold font-mono">
            关卡 {levelId}：{gameState.level.name}
          </h1>
          <div className="w-24" />
        </div>

        <div className="space-y-4">
          <StatusBar />

          <GameCanvas />

          <InspectionPanel />

          <OperationButtons />
        </div>
      </div>

      <PauseModal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
      />

      <ActionFeedback />
    </div>
  );
}
