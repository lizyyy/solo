import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type {
  GameState,
  TrainingActivity,
  ActivityResult,
  KeyDecision,
  CorrectionAction,
  Problem,
  Contest,
  Member,
} from '../types';
import type { TrainingActivity as Activity } from '../types';
import {
  createInitialState,
  executeActivity,
  executeContest,
  analyzeProblems,
  suggestCorrection,
  createReplayStep,
  applyKnowledgeDecay,
  checkGameEnd,
  recordKeyDecision,
  generateId,
} from '../utils/gameLogic';

type GameAction =
  | { type: 'SCHEDULE_ACTIVITY'; activity: TrainingActivity }
  | { type: 'UNSCHEDULE_ACTIVITY'; activityId: string }
  | { type: 'CLEAR_SCHEDULE' }
  | { type: 'EXECUTE_DAY' }
  | { type: 'ADD_KEY_DECISION'; decision: Omit<KeyDecision, 'day' | 'timestamp'> }
  | { type: 'CONFIRM_CORRECTION'; correctionId: string; confirmedBy: string }
  | { type: 'ADD_CORRECTION'; correction: CorrectionAction }
  | { type: 'RESTART_GAME' }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'UPDATE_VERSION' };

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  scheduleActivity: (activity: Omit<TrainingActivity, 'id' | 'timestamp' | 'day'>) => void;
  unscheduleActivity: (activityId: string) => void;
  clearSchedule: () => void;
  executeDay: () => void;
  addKeyDecision: (decision: Omit<KeyDecision, 'day' | 'timestamp'>) => void;
  confirmCorrection: (correctionId: string, confirmedBy: string) => void;
  restartGame: () => void;
  exportReplay: () => string;
  loadReplay: (replayData: string) => void;
  exportReport: () => string;
  getAvailableProblems: () => Problem[];
  getUpcomingContest: () => Contest | undefined;
  getMemberById: (id: string) => Member | undefined;
}

const GameContext = createContext<GameContextType | null>(null);

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SCHEDULE_ACTIVITY': {
      const newState = { ...state };
      newState.scheduledActivities = [
        ...newState.scheduledActivities,
        {
          ...action.activity,
          id: generateId('act'),
          day: state.currentDay,
          timestamp: Date.now(),
        } as TrainingActivity,
      ];
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'UNSCHEDULE_ACTIVITY': {
      const newState = { ...state };
      newState.scheduledActivities = newState.scheduledActivities.filter(
        a => a.id !== action.activityId
      );
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'CLEAR_SCHEDULE': {
      const newState = { ...state };
      newState.scheduledActivities = [];
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'EXECUTE_DAY': {
      if (state.phase !== 'planning') return state;

      let newState = { ...state };
      newState.phase = 'executing';

      const dayResults: ActivityResult[] = [];
      const dayDecisions: KeyDecision[] = [];
      let updatedMembers = [...newState.members];

      for (const activity of newState.scheduledActivities) {
        const member = updatedMembers.find(m => m.id === activity.memberId);
        if (!member) continue;

        const { result, updatedMember } = executeActivity(
          activity,
          member,
          newState.problems,
          newState.settings
        );

        dayResults.push(result);
        updatedMembers = updatedMembers.map(m =>
          m.id === updatedMember.id ? updatedMember : m
        );

        const problem = activity.problemId
          ? newState.problems.find(p => p.id === activity.problemId)
          : null;

        dayDecisions.push(
          recordKeyDecision(
            newState,
            'activity',
            `安排「${member.name}」${
              activity.type === 'practice'
                ? `刷题「${problem?.title || '未知题目'}」`
                : activity.type === 'review'
                ? `复盘知识点`
                : '休息'
            }`,
            result.success ? '能力提升' : result.isCrash ? '⚠️ 崩盘！' : '效果一般',
            result.isCrash ? 'high' : activity.type === 'rest' ? 'low' : 'medium'
          )
        );

        if (result.isCrash) {
          dayDecisions.push(
            recordKeyDecision(
              newState,
              'adjustment',
              `「${member.name}」疲劳过度崩盘，需要强制休息`,
              '训练效率严重下降，未来几天需要优先安排休息',
              'high'
            )
          );
        }
      }

      newState.members = updatedMembers;
      newState.activityResults = [...newState.activityResults, ...dayResults];
      newState.keyDecisions = [...newState.keyDecisions, ...dayDecisions];

      const contest = newState.contests.find(c => c.day === newState.currentDay);
      if (contest) {
        newState.phase = 'contest';
        const { result: contestResult, updatedMembers: contestMembers } = executeContest(
          contest,
          newState.members,
          newState.settings
        );

        newState.members = contestMembers;
        newState.completedContests = [...newState.completedContests, contestResult];
        newState.totalScore += contestResult.totalScore;

        newState.keyDecisions.push(
          recordKeyDecision(
            newState,
            'strategy',
            `参加「${contest.name}」`,
            contestResult.passed
              ? `✅ 通过！获得 ${contestResult.totalScore} 分，排名第 ${contestResult.rank} 名`
              : `❌ 未通过！仅获得 ${contestResult.totalScore}/${contest.targetScore} 分`,
            contestResult.passed ? 'medium' : 'high'
          )
        );
      }

      newState.members = applyKnowledgeDecay(newState.members, newState.settings.knowledgeDecayRate);

      const discoveries = analyzeProblems(
        newState.members,
        newState.activityResults,
        newState.currentDay
      );
      newState.problemDiscoveries = [...newState.problemDiscoveries, ...discoveries];

      for (const discovery of discoveries) {
        const suggestion = suggestCorrection(discovery);
        newState.correctionActions = [...newState.correctionActions, suggestion];

        if (discovery.severity === 'high') {
          newState.keyDecisions.push(
            recordKeyDecision(
              newState,
              'adjustment',
              `发现严重问题：${discovery.description}`,
              suggestion.description,
              'high'
            )
          );
        }
      }

      newState.replay.steps.push(
        createReplayStep(newState, dayDecisions, dayResults)
      );

      newState.scheduledActivities = [];
      newState.currentDay++;
      newState.phase = 'planning';

      newState = checkGameEnd(newState);
      newState.updatedAt = Date.now();

      return newState;
    }

    case 'ADD_KEY_DECISION': {
      const newState = { ...state };
      newState.keyDecisions = [
        ...newState.keyDecisions,
        {
          ...action.decision,
          day: state.currentDay,
          timestamp: Date.now(),
        },
      ];
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'CONFIRM_CORRECTION': {
      const newState = { ...state };
      newState.correctionActions = newState.correctionActions.map(c =>
        c.id === action.correctionId
          ? { ...c, confirmedBy: action.confirmedBy, confirmedAt: Date.now() }
          : c
      );
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'ADD_CORRECTION': {
      const newState = { ...state };
      newState.correctionActions = [...newState.correctionActions, action.correction];
      newState.updatedAt = Date.now();
      return newState;
    }

    case 'RESTART_GAME': {
      return createInitialState();
    }

    case 'LOAD_STATE': {
      return action.state;
    }

    case 'UPDATE_VERSION': {
      const newState = { ...state };
      newState.version = {
        ...newState.version,
        lastUpdated: Date.now(),
      };
      return newState;
    }

    default:
      return state;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, null, () => {
    const saved = localStorage.getItem('algorithm-training-island-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return createInitialState();
      }
    }
    return createInitialState();
  });

  useEffect(() => {
    localStorage.setItem('algorithm-training-island-state', JSON.stringify(state));
  }, [state]);

  const scheduleActivity = (
    activity: Omit<TrainingActivity, 'id' | 'timestamp' | 'day'>
  ) => {
    dispatch({ type: 'SCHEDULE_ACTIVITY', activity: activity as Activity });
  };

  const unscheduleActivity = (activityId: string) => {
    dispatch({ type: 'UNSCHEDULE_ACTIVITY', activityId });
  };

  const clearSchedule = () => {
    dispatch({ type: 'CLEAR_SCHEDULE' });
  };

  const executeDay = () => {
    dispatch({ type: 'EXECUTE_DAY' });
  };

  const addKeyDecision = (decision: Omit<KeyDecision, 'day' | 'timestamp'>) => {
    dispatch({ type: 'ADD_KEY_DECISION', decision });
  };

  const confirmCorrection = (correctionId: string, confirmedBy: string) => {
    dispatch({ type: 'CONFIRM_CORRECTION', correctionId, confirmedBy });
  };

  const restartGame = () => {
    dispatch({ type: 'RESTART_GAME' });
  };

  const exportReplay = () => {
    return JSON.stringify(state.replay, null, 2);
  };

  const loadReplay = (replayData: string) => {
    try {
      const replay = JSON.parse(replayData);
      const newState = createInitialState();
      newState.replay = replay;
      dispatch({ type: 'LOAD_STATE', state: newState });
    } catch (e) {
      console.error('Failed to load replay:', e);
    }
  };

  const exportReport = () => {
    const report = {
      gameId: state.id,
      version: state.version.dataVersion,
      generatedAt: Date.now(),
      duration: state.currentDay - 1,
      finalStatus: state.status,
      finalScore: state.totalScore,
      problemDiscoveries: state.problemDiscoveries,
      correctionActions: state.correctionActions,
      keyDecisions: state.keyDecisions,
      memberStats: state.members.map(m => ({
        memberId: m.id,
        name: m.name,
        finalAbility: m.overallAbility,
        finalFatigue: m.fatigue,
        practiceCount: m.practiceCount,
        reviewCount: m.reviewCount,
        crashCount: m.crashCount,
      })),
      acknowledgers: [],
    };
    return JSON.stringify(report, null, 2);
  };

  const getAvailableProblems = () => {
    return state.problems.filter(p => p.availableFromDay <= state.currentDay);
  };

  const getUpcomingContest = () => {
    return state.contests.find(c => c.day >= state.currentDay);
  };

  const getMemberById = (id: string) => {
    return state.members.find(m => m.id === id);
  };

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        scheduleActivity,
        unscheduleActivity,
        clearSchedule,
        executeDay,
        addKeyDecision,
        confirmCorrection,
        restartGame,
        exportReplay,
        loadReplay,
        exportReport,
        getAvailableProblems,
        getUpcomingContest,
        getMemberById,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
