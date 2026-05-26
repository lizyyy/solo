import { Play, Home, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PauseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PauseModal({ isOpen, onClose }: PauseModalProps) {
  const navigate = useNavigate();
  const { gameState, resumeGame, restartGame, reset } = useGameStore();

  const handleResume = () => {
    resumeGame();
    onClose();
  };

  const handleRestart = () => {
    restartGame();
    onClose();
  };

  const handleQuit = () => {
    reset();
    navigate('/');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="游戏暂停" size="sm">
      <div className="space-y-4">
        <div className="text-center py-4">
          <p className="text-slate-400 mb-2">当前关卡</p>
          <p className="text-2xl font-bold text-slate-100 font-mono">
            {gameState.level.name}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-800 p-3">
            <p className="text-xs text-slate-500">得分</p>
            <p className="text-xl font-bold text-yellow-400 font-mono">
              {gameState.score}
            </p>
          </div>
          <div className="bg-slate-800 p-3">
            <p className="text-xs text-slate-500">进度</p>
            <p className="text-xl font-bold text-blue-400 font-mono">
              {gameState.processedCount}/{gameState.level.vehicleCount}
            </p>
          </div>
          <div className="bg-slate-800 p-3">
            <p className="text-xs text-slate-500">准确率</p>
            <p className="text-xl font-bold text-green-400 font-mono">
              {gameState.processedCount > 0
                ? Math.round((gameState.correctCount / gameState.processedCount) * 100)
                : 0}%
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button variant="success" size="lg" onClick={handleResume} className="w-full">
            <Play className="w-5 h-5 mr-2" />
            继续游戏
          </Button>
          <Button variant="warning" size="lg" onClick={handleRestart} className="w-full">
            <RotateCcw className="w-5 h-5 mr-2" />
            重新开始
          </Button>
          <Button variant="secondary" size="lg" onClick={handleQuit} className="w-full">
            <Home className="w-5 h-5 mr-2" />
            返回首页
          </Button>
        </div>
      </div>
    </Modal>
  );
}
