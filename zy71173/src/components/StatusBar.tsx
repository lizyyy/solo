import { useGameStore } from '@/store/useGameStore';
import {
  Map,
  Target,
  Trophy,
  KeyRound,
  Droplets,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Route,
} from 'lucide-react';
import type { GamePhase, CardType } from '@/game/types';

const difficultyMap = {
  easy: { label: '简单', color: 'text-museum-success' },
  medium: { label: '中等', color: 'text-museum-warning' },
  hard: { label: '困难', color: 'text-museum-danger' },
};

const phaseMap: Record<GamePhase, { label: string; icon: typeof Play; color: string }> = {
  planning: { label: '规划中', icon: Route, color: 'text-museum-info' },
  executing: { label: '执行中', icon: Play, color: 'text-museum-success animate-pulse' },
  paused: { label: '已暂停', icon: Pause, color: 'text-museum-warning' },
  completed: { label: '已完成', icon: CheckCircle2, color: 'text-museum-success' },
  failed: { label: '已失败', icon: XCircle, color: 'text-museum-danger' },
};

const cardColorMap: Record<CardType, string> = {
  A: 'text-red-400',
  B: 'text-blue-400',
  C: 'text-green-400',
};

export default function StatusBar() {
  const {
    phase,
    currentLevel,
    currentRound,
    score,
    availableCards,
    desiccantCount,
  } = useGameStore();

  const phaseInfo = phaseMap[phase];
  const PhaseIcon = phaseInfo.icon;

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-museum-success';
    if (score >= 500) return 'text-museum-warning';
    if (score >= 0) return 'text-white';
    return 'text-museum-danger';
  };

  return (
    <div className="hud-panel w-full flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        {currentLevel && (
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-museum-accent" />
            <span className="font-semibold text-white">{currentLevel.name}</span>
            <span className={`text-sm ${difficultyMap[currentLevel.difficulty].color}`}>
              [{difficultyMap[currentLevel.difficulty].label}]
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-museum-info">
          <Target className="w-5 h-5" />
          <span>
            回合 <span className="text-white font-semibold">{currentRound}</span>
            <span className="text-museum-bgLighter"> / </span>
            <span className="text-museum-bgLighter">{currentLevel?.maxRounds ?? 0}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-museum-accent" />
          <span className={`font-bold text-lg ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-museum-bgLighter text-sm">分</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-museum-accent" />
          <div className="flex gap-1">
            {availableCards.length > 0 ? (
              availableCards.map((card, idx) => (
                <span
                  key={idx}
                  className={`w-7 h-7 flex items-center justify-center rounded border font-bold text-sm ${cardColorMap[card]} border-current`}
                >
                  {card}
                </span>
              ))
            ) : (
              <span className="text-museum-bgLighter text-sm">无</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-museum-humidity" />
          <span className="text-white font-semibold">{desiccantCount}</span>
          <span className="text-museum-bgLighter text-sm">袋</span>
        </div>

        <div className={`flex items-center gap-2 ${phaseInfo.color}`}>
          <PhaseIcon className="w-5 h-5" />
          <span className="font-medium">{phaseInfo.label}</span>
        </div>
      </div>
    </div>
  );
}
