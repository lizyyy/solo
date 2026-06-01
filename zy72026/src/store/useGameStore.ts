import { create } from 'zustand';
import type {
  GameState,
  GameSession,
  Level,
  SettlementReport,
  TimelineEvent,
  PlayerChoiceRecord,
  TeacherNote,
  JudgmentResult,
} from '../types';
import { levels } from '../data/levels';
import { judgeProblem, deduplicateChoices, validateChoice } from '../utils/judgmentEngine';
import { generateSettlementReport } from '../utils/reportGenerator';
import { generateEventId, generateSessionId } from '../utils/diffCalculator';
import { exportAsJSON, exportAsText } from '../utils/exportUtils';

const createEmptySession = (levelId: string): GameSession => ({
  id: generateSessionId(),
  levelId,
  status: 'idle',
  startTime: null,
  endTime: null,
  pausedTime: 0,
  totalPausedDuration: 0,
  currentProblemIndex: 0,
  currentProblemStartTime: null,
  remainingTime: 0,
  score: 0,
  events: [],
  judgments: {},
  playerChoices: {},
  notes: [],
  originalNotesCount: 0,
});

const getCurrentLevel = (state: GameState): Level | undefined => {
  if (!state.currentLevelId) return undefined;
  return levels.find((l) => l.id === state.currentLevelId);
};

const getCurrentProblem = (state: GameState) => {
  const level = getCurrentLevel(state);
  if (!level || !state.session) return undefined;
  return level.problems[state.session.currentProblemIndex];
};

const addEvent = (session: GameSession, type: TimelineEvent['type'], data: Record<string, unknown>, problemId?: string): TimelineEvent => {
  const now = Date.now();
  const sessionTime = session.startTime ? now - session.startTime - session.totalPausedDuration : 0;
  const event: TimelineEvent = {
    id: generateEventId(),
    type,
    timestamp: now,
    sessionTime,
    problemId,
    data,
  };
  session.events.push(event);
  return event;
};

const initialLevelId = levels[0]?.id || null;
const initialSession = initialLevelId ? (() => {
  const session = createEmptySession(initialLevelId);
  const level = levels.find((l) => l.id === initialLevelId);
  session.notes = [...(level?.teacherNotes || [])];
  session.originalNotesCount = session.notes.length;
  return session;
})() : null;

export const useGameStore = create<GameState>((set, get) => ({
  levels,
  rules: levels[0]?.rules || [],

  currentLevelId: initialLevelId,
  session: initialSession,

  replayMode: false,
  replayEventIndex: 0,

  showSettlement: false,
  showNoteEditor: false,
  selectedEventId: null,

  settlementReport: null,

  loadLevel: (levelId: string) => {
    const level = levels.find((l) => l.id === levelId);
    if (!level) return;

    const session = createEmptySession(levelId);
    session.notes = [...(level.teacherNotes || [])];
    session.originalNotesCount = session.notes.length;

    set({
      currentLevelId: levelId,
      session,
      rules: level.rules,
      showSettlement: false,
      replayMode: false,
    });
  },

  startSession: () => {
    const state = get();
    if (!state.session || !state.currentLevelId) return;

    const level = getCurrentLevel(state);
    if (!level) return;

    const now = Date.now();
    const firstProblem = level.problems[0];

    const session: GameSession = {
      ...state.session,
      status: 'running',
      startTime: now,
      currentProblemStartTime: now,
      remainingTime: firstProblem.timeLimit * 1000,
      events: [],
      judgments: {},
      playerChoices: {},
      score: 0,
      currentProblemIndex: 0,
    };

    addEvent(session, 'session_start', { action: '开始演练' });
    addEvent(session, 'problem_start', {
      problemId: firstProblem.id,
      problemTitle: firstProblem.title,
      timeLimit: firstProblem.timeLimit,
    }, firstProblem.id);

    set({ session, showSettlement: false });
  },

  pauseSession: () => {
    const state = get();
    if (!state.session || state.session.status !== 'running') return;

    const now = Date.now();
    const session: GameSession = {
      ...state.session,
      status: 'paused',
      pausedTime: now,
    };

    addEvent(session, 'control_action', { action: '暂停' });

    set({ session });
  },

  resumeSession: () => {
    const state = get();
    if (!state.session || state.session.status !== 'paused') return;

    const now = Date.now();
    const pausedDuration = now - state.session.pausedTime;

    const session: GameSession = {
      ...state.session,
      status: 'running',
      totalPausedDuration: state.session.totalPausedDuration + pausedDuration,
      currentProblemStartTime: (state.session.currentProblemStartTime || 0) + pausedDuration,
    };

    addEvent(session, 'control_action', { action: '恢复', pausedDuration });

    set({ session });
  },

  restartSession: () => {
    const state = get();
    if (!state.currentLevelId) return;

    const level = getCurrentLevel(state);
    if (!level) return;

    const session = createEmptySession(state.currentLevelId);
    session.notes = [...(level.teacherNotes || [])];
    session.originalNotesCount = session.notes.length;

    set({
      session,
      showSettlement: false,
      replayMode: false,
      selectedEventId: null,
    });
  },

  settleSession: (): SettlementReport | null => {
    const state = get();
    if (!state.session || !state.currentLevelId) return null;

    const level = getCurrentLevel(state);
    if (!level) return null;

    const session: GameSession = {
      ...state.session,
      status: 'completed',
      endTime: Date.now(),
    };

    addEvent(session, 'session_end', { action: '结算', finalScore: session.score });

    const report = generateSettlementReport(session, level);

    set({
      session,
      showSettlement: true,
      settlementReport: report,
    });

    return report;
  },

  makeChoice: (optionId: string) => {
    const state = get();
    if (!state.session || state.session.status !== 'running') return;

    const level = getCurrentLevel(state);
    const problem = getCurrentProblem(state);
    if (!level || !problem) return;

    const now = Date.now();
    const responseTime = state.session.currentProblemStartTime
      ? now - state.session.currentProblemStartTime
      : 0;

    const choice: PlayerChoiceRecord = {
      problemId: problem.id,
      optionId,
      responseTime,
      timestamp: now,
    };

    if (!validateChoice(choice)) return;

    const judgment = judgeProblem(problem, choice, state.rules);

    const session: GameSession = {
      ...state.session,
      score: state.session.score + judgment.scoreChange,
      playerChoices: {
        ...state.session.playerChoices,
        [problem.id]: choice,
      },
      judgments: {
        ...state.session.judgments,
        [problem.id]: judgment,
      },
    };

    addEvent(session, 'player_choice', {
      optionId,
      optionLabel: problem.options.find((o) => o.id === optionId)?.label,
      responseTime,
    }, problem.id);

    addEvent(session, 'judgment', {
      isCorrect: judgment.isCorrect,
      failureType: judgment.failureType,
      scoreChange: judgment.scoreChange,
      reasons: judgment.reasons,
      rules: judgment.ruleReferences,
      judgmentChain: judgment.judgmentChain,
    }, problem.id);

    set({ session });

    setTimeout(() => {
      get().nextProblem();
    }, 1500);
  },

  addNote: (problemId: string | null, content: string): string => {
    const state = get();
    if (!state.session) return '';

    const note: TeacherNote = {
      problemId: problemId || undefined,
      timestamp: Date.now(),
      content,
      author: '讲解员小夏',
      isSupplementary: true,
    };

    const session: GameSession = {
      ...state.session,
      notes: [...state.session.notes, note],
    };

    addEvent(session, 'note_added', {
      content,
      author: note.author,
      isSupplementary: true,
    }, problemId || undefined);

    const noteId = `note_${note.timestamp}`;
    set({ session, showNoteEditor: false });

    return noteId;
  },

  nextProblem: () => {
    const state = get();
    if (!state.session || !state.currentLevelId) return;

    const level = getCurrentLevel(state);
    if (!level) return;

    const nextIndex = state.session.currentProblemIndex + 1;

    if (nextIndex >= level.problems.length) {
      get().settleSession();
      return;
    }

    const nextProblem = level.problems[nextIndex];
    const now = Date.now();

    const session: GameSession = {
      ...state.session,
      currentProblemIndex: nextIndex,
      currentProblemStartTime: now,
      remainingTime: nextProblem.timeLimit * 1000,
    };

    addEvent(session, 'problem_start', {
      problemId: nextProblem.id,
      problemTitle: nextProblem.title,
      timeLimit: nextProblem.timeLimit,
    }, nextProblem.id);

    set({ session });
  },

  tickTimer: () => {
    const state = get();
    if (!state.session || state.session.status !== 'running') return;

    const level = getCurrentLevel(state);
    const problem = getCurrentProblem(state);
    if (!level || !problem) return;

    const newRemainingTime = state.session.remainingTime - 100;

    if (newRemainingTime <= 0) {
      const timeoutChoice: PlayerChoiceRecord = {
        problemId: problem.id,
        optionId: null,
        responseTime: problem.timeLimit * 1000,
        timestamp: Date.now(),
      };

      const judgment = judgeProblem(problem, timeoutChoice, state.rules);

      const session: GameSession = {
        ...state.session,
        remainingTime: 0,
        score: state.session.score + judgment.scoreChange,
        playerChoices: {
          ...state.session.playerChoices,
          [problem.id]: timeoutChoice,
        },
        judgments: {
          ...state.session.judgments,
          [problem.id]: judgment,
        },
      };

      addEvent(session, 'timeout', {
        timeLimit: problem.timeLimit,
      }, problem.id);

      addEvent(session, 'judgment', {
        isCorrect: judgment.isCorrect,
        failureType: judgment.failureType,
        scoreChange: judgment.scoreChange,
        reasons: judgment.reasons,
        rules: judgment.ruleReferences,
        judgmentChain: judgment.judgmentChain,
      }, problem.id);

      set({ session });

      setTimeout(() => {
        get().nextProblem();
      }, 1500);

      return;
    }

    set({
      session: {
        ...state.session,
        remainingTime: newRemainingTime,
      },
    });
  },

  runPreRecorded: () => {
    const state = get();
    const level = getCurrentLevel(state);
    if (!level || !level.preRecordedChoices || !state.session) return;

    const dedupedChoices = deduplicateChoices(level.preRecordedChoices);

    let delay = 0;
    let currentProblemIndex = 0;

    const processNextProblem = () => {
      if (currentProblemIndex >= level.problems.length) {
        setTimeout(() => get().settleSession(), 500);
        return;
      }

      const problem = level.problems[currentProblemIndex];
      const choice = dedupedChoices.find((c) => c.problemId === problem.id);

      setTimeout(() => {
        if (choice) {
          if (choice.optionId !== null) {
            const judgment = judgeProblem(problem, choice, state.rules);

            const now = Date.now();
            const session = get().session;
            if (session) {
              const updatedSession: GameSession = {
                ...session,
                score: session.score + judgment.scoreChange,
                playerChoices: {
                  ...session.playerChoices,
                  [problem.id]: choice,
                },
                judgments: {
                  ...session.judgments,
                  [problem.id]: judgment,
                },
                remainingTime: Math.max(0, problem.timeLimit * 1000 - choice.responseTime),
              };

              addEvent(updatedSession, 'player_choice', {
                optionId: choice.optionId,
                optionLabel: problem.options.find((o) => o.id === choice.optionId)?.label,
                responseTime: choice.responseTime,
              }, problem.id);

              addEvent(updatedSession, 'judgment', {
                isCorrect: judgment.isCorrect,
                failureType: judgment.failureType,
                scoreChange: judgment.scoreChange,
                reasons: judgment.reasons,
                rules: judgment.ruleReferences,
                judgmentChain: judgment.judgmentChain,
              }, problem.id);

              set({ session: updatedSession });
            }
          } else {
            const now = Date.now();
            const session = get().session;
            if (session) {
              const judgment = judgeProblem(problem, null, state.rules);
              const updatedSession: GameSession = {
                ...session,
                score: session.score + judgment.scoreChange,
                playerChoices: {
                  ...session.playerChoices,
                  [problem.id]: choice,
                },
                judgments: {
                  ...session.judgments,
                  [problem.id]: judgment,
                },
                remainingTime: 0,
              };

              addEvent(updatedSession, 'timeout', {
                timeLimit: problem.timeLimit,
                note: '空值测试 - optionId 为 null',
              }, problem.id);

              addEvent(updatedSession, 'judgment', {
                isCorrect: judgment.isCorrect,
                failureType: judgment.failureType,
                scoreChange: judgment.scoreChange,
                reasons: judgment.reasons,
                rules: judgment.ruleReferences,
                judgmentChain: judgment.judgmentChain,
                note: '空值处理',
              }, problem.id);

              set({ session: updatedSession });
            }
          }
        }

        currentProblemIndex++;

        setTimeout(() => {
          if (currentProblemIndex < level.problems.length) {
            const nextProblem = level.problems[currentProblemIndex];
            const session = get().session;
            if (session) {
              const updatedSession: GameSession = {
                ...session,
                currentProblemIndex,
                currentProblemStartTime: Date.now(),
                remainingTime: nextProblem.timeLimit * 1000,
              };

              addEvent(updatedSession, 'problem_start', {
                problemId: nextProblem.id,
                problemTitle: nextProblem.title,
                timeLimit: nextProblem.timeLimit,
              }, nextProblem.id);

              set({ session: updatedSession });
            }
          }
          processNextProblem();
        }, 1000);
      }, 800);
    };

    processNextProblem();
  },

  startReplay: (sessionId: string) => {
    set({ replayMode: true, replayEventIndex: 0 });
  },

  replayNext: () => {
    const state = get();
    if (!state.session) return;
    const nextIndex = Math.min(state.replayEventIndex + 1, state.session.events.length - 1);
    set({ replayEventIndex: nextIndex });
  },

  replayPrev: () => {
    const state = get();
    const prevIndex = Math.max(state.replayEventIndex - 1, 0);
    set({ replayEventIndex: prevIndex });
  },

  exportReport: (format: 'json' | 'text'): string => {
    const state = get();
    if (!state.settlementReport) return '';

    return format === 'json' ? exportAsJSON(state.settlementReport) : exportAsText(state.settlementReport);
  },

  setShowNoteEditor: (show: boolean) => set({ showNoteEditor: show }),
  setShowSettlement: (show: boolean) => set({ showSettlement: show }),
  setSelectedEventId: (id: string | null) => set({ selectedEventId: id }),

  reset: () => {
    const firstLevel = levels[0];
    const session = firstLevel ? createEmptySession(firstLevel.id) : null;
    if (session && firstLevel) {
      session.notes = [...(firstLevel.teacherNotes || [])];
      session.originalNotesCount = session.notes.length;
    }

    set({
      currentLevelId: firstLevel?.id || null,
      session,
      rules: firstLevel?.rules || [],
      showSettlement: false,
      showNoteEditor: false,
      selectedEventId: null,
      replayMode: false,
      replayEventIndex: 0,
      settlementReport: null,
    });
  },
}));

declare module '../types' {
  interface GameState {
    settlementReport: SettlementReport | null;
    runPreRecorded: () => void;
    setShowNoteEditor: (show: boolean) => void;
    setShowSettlement: (show: boolean) => void;
    setSelectedEventId: (id: string | null) => void;
  }
}
