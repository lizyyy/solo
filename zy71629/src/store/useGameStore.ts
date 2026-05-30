import { create } from 'zustand';
import type {
  Game,
  GameSession,
  Phrase,
  Move,
  FeedbackMessage,
  Score,
} from '@/types/music';
import {
  createGameContext,
  createSession,
  createMove,
  calculateFinalScore,
  isGameComplete,
  getNextMeasure,
  type GameContext,
} from '@/engine/gameEngine';
import { SAMPLE_GAMES, getCompletedSampleSessions } from '@/data/sample';

interface GameStore {
  games: Game[];
  sessions: GameSession[];
  currentGame: Game | null;
  currentSession: GameSession | null;
  currentContext: GameContext | null;
  currentMeasure: number;
  selectedPhrase: Phrase | null;
  usedPhraseIds: Set<string>;
  feedback: FeedbackMessage | null;
  isLoading: boolean;

  loadGames: () => void;
  loadSessions: () => void;
  startGame: (gameId: string, studentId: string, studentName: string) => void;
  selectPhrase: (phrase: Phrase | null) => void;
  confirmPhrase: () => void;
  completeGame: () => Score | null;
  setFeedback: (feedback: FeedbackMessage | null) => void;
  clearCurrentGame: () => void;
  updateSession: (session: GameSession) => void;
  getSessionById: (sessionId: string) => GameSession | undefined;
  getSessionsByGame: (gameId: string) => GameSession[];
  getSessionsByStudent: (studentId: string) => GameSession[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  sessions: [],
  currentGame: null,
  currentSession: null,
  currentContext: null,
  currentMeasure: 1,
  selectedPhrase: null,
  usedPhraseIds: new Set(),
  feedback: null,
  isLoading: false,

  loadGames: () => {
    const stored = localStorage.getItem('jazz_games');
    const games: Game[] = stored ? JSON.parse(stored) : SAMPLE_GAMES;
    set({ games });
  },

  loadSessions: () => {
    const stored = localStorage.getItem('jazz_sessions');
    const sessions: GameSession[] = stored ? JSON.parse(stored) : getCompletedSampleSessions();
    set({ sessions });
  },

  startGame: (gameId: string, studentId: string, studentName: string) => {
    const { games } = get();
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    const context = createGameContext(game);
    if (!context) return;

    const session = createSession(gameId, studentId, studentName);

    set({
      currentGame: game,
      currentSession: session,
      currentContext: context,
      currentMeasure: 1,
      selectedPhrase: null,
      usedPhraseIds: new Set(),
    });
  },

  selectPhrase: (phrase: Phrase | null) => {
    set({ selectedPhrase: phrase });
  },

  confirmPhrase: () => {
    const { currentSession, currentContext, currentMeasure, selectedPhrase, usedPhraseIds, sessions } = get();
    
    if (!currentSession || !currentContext || !selectedPhrase) return;

    const move = createMove(currentMeasure, selectedPhrase, currentContext, usedPhraseIds);
    
    const newUsedPhraseIds = new Set(usedPhraseIds);
    newUsedPhraseIds.add(selectedPhrase.id);

    const updatedSession: GameSession = {
      ...currentSession,
      moves: [...currentSession.moves, move],
    };

    const complete = isGameComplete(updatedSession, currentContext);
    const nextMeasure = complete ? currentMeasure : getNextMeasure(updatedSession, currentContext);

    const feedback: FeedbackMessage = move.isCorrect
      ? {
          type: 'success',
          title: '很好！',
          message: `第 ${currentMeasure} 小节选择正确，和弦得分 ${move.chordScore}，节拍得分 ${move.rhythmScore}`,
          duration: 2500,
        }
      : {
          type: move.errors.some((e) => e.type === 'rule' && e.deduction > 0) ? 'error' : 'warning',
          title: '需要注意',
          message: move.errors.find((e) => e.deduction > 0)?.description || '请检查你的选择',
          duration: 3000,
        };

    const updatedSessions = [...sessions.filter((s) => s.id !== updatedSession.id), updatedSession];
    
    set({
      currentSession: updatedSession,
      sessions: updatedSessions,
      currentMeasure: nextMeasure,
      selectedPhrase: null,
      usedPhraseIds: newUsedPhraseIds,
      feedback,
    });

    localStorage.setItem('jazz_sessions', JSON.stringify(updatedSessions));
  },

  completeGame: (): Score | null => {
    const { currentSession, currentContext, sessions } = get();
    if (!currentSession || !currentContext) return null;

    const score = calculateFinalScore(currentSession, currentContext);
    const completedSession: GameSession = {
      ...currentSession,
      endTime: Date.now(),
      score,
    };

    const updatedSessions = [...sessions.filter((s) => s.id !== completedSession.id), completedSession];
    
    set({
      currentSession: completedSession,
      sessions: updatedSessions,
    });

    localStorage.setItem('jazz_sessions', JSON.stringify(updatedSessions));
    
    return score;
  },

  setFeedback: (feedback: FeedbackMessage | null) => {
    set({ feedback });
  },

  clearCurrentGame: () => {
    set({
      currentGame: null,
      currentSession: null,
      currentContext: null,
      currentMeasure: 1,
      selectedPhrase: null,
      usedPhraseIds: new Set(),
    });
  },

  updateSession: (session: GameSession) => {
    const { sessions } = get();
    const updatedSessions = [...sessions.filter((s) => s.id !== session.id), session];
    set({ sessions: updatedSessions });
    localStorage.setItem('jazz_sessions', JSON.stringify(updatedSessions));
  },

  getSessionById: (sessionId: string) => {
    return get().sessions.find((s) => s.id === sessionId);
  },

  getSessionsByGame: (gameId: string) => {
    return get().sessions.filter((s) => s.gameId === gameId);
  },

  getSessionsByStudent: (studentId: string) => {
    return get().sessions.filter((s) => s.studentId === studentId);
  },
}));

export function initializeGameData(): void {
  if (!localStorage.getItem('jazz_games')) {
    localStorage.setItem('jazz_games', JSON.stringify(SAMPLE_GAMES));
  }
  if (!localStorage.getItem('jazz_sessions')) {
    localStorage.setItem('jazz_sessions', JSON.stringify(getCompletedSampleSessions()));
  }
  useGameStore.getState().loadGames();
  useGameStore.getState().loadSessions();
}
