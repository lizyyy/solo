import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { validatePath, getPathLength } from '@/game/pathfinding';
import type { Card } from '@/game/types';
import {
  Undo2,
  RotateCcw,
  Play,
  Pause,
  StepForward,
  RefreshCw,
  FileText,
  Home,
  Droplets,
  CheckCircle2,
  XCircle,
  Route,
  ShieldCheck,
} from 'lucide-react';

export default function ControlPanel() {
  const navigate = useNavigate();

  const {
    phase,
    currentLevel,
    plannedPath,
    availableCards,
    desiccantCount,
    isDesiccantActive,
    undoPath,
    clearPath,
    startExecution,
    pause,
    resume,
    executeStep,
    restart,
    useDesiccant,
  } = useGameStore();

  const cards: Card[] = useMemo(
    () => availableCards.map((type) => ({ id: type, type })),
    [availableCards]
  );

  const pathValidation = useMemo(() => {
    if (!currentLevel || plannedPath.length === 0) {
      return { valid: false, errors: ['请先规划路径'] };
    }
    return validatePath(plannedPath, currentLevel, cards);
  }, [plannedPath, currentLevel, cards]);

  const pathLength = getPathLength(plannedPath);
  const estimatedRounds = pathLength;

  const canUndo = phase === 'planning' && plannedPath.length > 0;
  const canClear = phase === 'planning' && plannedPath.length > 0;
  const canStart = phase === 'planning' && pathValidation.valid;
  const canPause = phase === 'executing';
  const canResume = phase === 'paused';
  const canStep = phase === 'executing';
  const canUseDesiccant = phase === 'executing' && desiccantCount > 0 && !isDesiccantActive;
  const canRestart = phase !== 'planning';
  const isFinished = phase === 'completed' || phase === 'failed';

  const handleViewReport = () => {
    console.log('查看报告');
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  return (
    <div className="hud-panel w-full">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          {phase === 'planning' && (
            <>
              <button
                onClick={undoPath}
                disabled={!canUndo}
                className="btn-secondary flex items-center gap-2"
              >
                <Undo2 className="w-4 h-4" />
                撤销路径
              </button>
              <button
                onClick={clearPath}
                disabled={!canClear}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重置路径
              </button>
              <button
                onClick={startExecution}
                disabled={!canStart}
                className="btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                确认开始
              </button>
            </>
          )}

          {phase === 'executing' && (
            <>
              <button
                onClick={pause}
                disabled={!canPause}
                className="btn-secondary flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                暂停
              </button>
              <button
                onClick={executeStep}
                disabled={!canStep}
                className="btn-primary flex items-center gap-2"
              >
                <StepForward className="w-4 h-4" />
                单步执行
              </button>
              <button
                onClick={restart}
                disabled={!canRestart}
                className="btn-danger flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新开始
              </button>
            </>
          )}

          {phase === 'paused' && (
            <>
              <button
                onClick={resume}
                disabled={!canResume}
                className="btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                继续
              </button>
              <button
                onClick={restart}
                disabled={!canRestart}
                className="btn-danger flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新开始
              </button>
            </>
          )}

          {isFinished && (
            <>
              <button
                onClick={restart}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新开始
              </button>
              <button
                onClick={handleViewReport}
                className="btn-secondary flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                查看报告
              </button>
              <button
                onClick={handleBackToMenu}
                className="btn-secondary flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                返回主菜单
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={useDesiccant}
              disabled={!canUseDesiccant}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                isDesiccantActive
                  ? 'bg-museum-humidity/20 border-museum-humidity text-museum-humidity'
                  : canUseDesiccant
                  ? 'bg-museum-bgLight border-museum-bgLighter text-museum-humidity hover:bg-museum-bgLighter cursor-pointer'
                  : 'bg-museum-bgLight border-museum-bgLighter text-museum-bgLighter cursor-not-allowed opacity-50'
              }`}
            >
              <Droplets className="w-5 h-5" />
              <span className="font-semibold">{desiccantCount}</span>
              <span className="text-sm">干燥剂</span>
              {isDesiccantActive && (
                <span className="text-xs bg-museum-humidity text-white px-2 py-0.5 rounded">
                  使用中
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-6 pl-6 border-l border-museum-bgLighter">
            <div className="flex items-center gap-2 text-museum-info">
              <Route className="w-5 h-5" />
              <span>
                路线长度 <span className="text-white font-semibold">{pathLength}</span>
              </span>
              <span className="text-museum-bgLighter">/</span>
              <span>
                预计回合 <span className="text-white font-semibold">{estimatedRounds}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${pathValidation.valid ? 'text-museum-success' : 'text-museum-danger'}`} />
              {pathValidation.valid ? (
                <span className="text-museum-success flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  路线合法
                </span>
              ) : (
                <span className="text-museum-danger flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {pathValidation.errors[0]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
