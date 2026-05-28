import { create } from 'zustand';
import {
  GameSession,
  PlayerChoice,
  PlayerNote,
  Score,
  GameStep,
  ExportReport,
  Level
} from '../types';
import { levels } from '../data/levels';

interface GameState {
  currentLevel: Level | null;
  currentSession: GameSession | null;
  currentStep: GameStep;
  selectedClueId: string | null;
  replaySessions: GameSession[];
  isReplayMode: boolean;
  replayIndex: number;
  
  startNewGame: (levelId: string) => void;
  loadLevel: (levelId: string) => void;
  selectClue: (clueId: string | null) => void;
  markClueAsAnomaly: (clueId: string, isAnomaly: boolean) => void;
  setRiskRating: (clueId: string, rating: number) => void;
  addNote: (clueId: string, content: string) => void;
  setDynastyGuess: (dynasty: string, reasoning: string) => void;
  setCurrentStep: (step: GameStep) => void;
  submitConclusion: () => void;
  calculateScore: () => Score;
  saveSession: () => void;
  loadSessions: () => void;
  loadReplaySession: (sessionId: string) => void;
  setReplayIndex: (index: number) => void;
  exportReport: (sessionId: string) => ExportReport;
  resetGame: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const calculateGrade = (totalScore: number): Score['grade'] => {
  if (totalScore >= 90) return 'S';
  if (totalScore >= 80) return 'A';
  if (totalScore >= 70) return 'B';
  if (totalScore >= 60) return 'C';
  return 'D';
};

export const useGameStore = create<GameState>((set, get) => ({
  currentLevel: null,
  currentSession: null,
  currentStep: 'intro',
  selectedClueId: null,
  replaySessions: [],
  isReplayMode: false,
  replayIndex: 0,

  loadLevel: (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      set({ currentLevel: level });
    }
  },

  startNewGame: (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    const session: GameSession = {
      id: generateId(),
      levelId,
      startTime: Date.now(),
      status: 'playing',
      playerChoices: [],
      playerNotes: [],
    };

    set({
      currentLevel: level,
      currentSession: session,
      currentStep: 'intro',
      selectedClueId: null,
      isReplayMode: false,
    });
  },

  selectClue: (clueId: string | null) => {
    set({ selectedClueId: clueId });
  },

  markClueAsAnomaly: (clueId: string, isAnomaly: boolean) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const existingChoice = currentSession.playerChoices.find(c => c.clueId === clueId);
    
    let newChoices: PlayerChoice[];
    if (existingChoice) {
      newChoices = currentSession.playerChoices.map(c =>
        c.clueId === clueId
          ? { ...c, markedAsAnomaly: isAnomaly, timestamp: Date.now() }
          : c
      );
    } else {
      const newChoice: PlayerChoice = {
        id: generateId(),
        clueId,
        markedAsAnomaly: isAnomaly,
        timestamp: Date.now(),
      };
      newChoices = [...currentSession.playerChoices, newChoice];
    }

    set({
      currentSession: {
        ...currentSession,
        playerChoices: newChoices,
      },
    });
  },

  setRiskRating: (clueId: string, rating: number) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const newChoices = currentSession.playerChoices.map(c =>
      c.clueId === clueId ? { ...c, riskRating: rating } : c
    );

    set({
      currentSession: {
        ...currentSession,
        playerChoices: newChoices,
      },
    });
  },

  addNote: (clueId: string, content: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    const existingNote = currentSession.playerNotes.find(n => n.clueId === clueId);
    
    let newNotes: PlayerNote[];
    if (existingNote) {
      newNotes = currentSession.playerNotes.map(n =>
        n.clueId === clueId ? { ...n, content, timestamp: Date.now() } : n
      );
    } else {
      const newNote: PlayerNote = {
        id: generateId(),
        clueId,
        content,
        timestamp: Date.now(),
      };
      newNotes = [...currentSession.playerNotes, newNote];
    }

    set({
      currentSession: {
        ...currentSession,
        playerNotes: newNotes,
      },
    });
  },

  setDynastyGuess: (dynasty: string, reasoning: string) => {
    const { currentSession } = get();
    if (!currentSession) return;

    set({
      currentSession: {
        ...currentSession,
        dynastyGuess: dynasty,
        reasoningNotes: reasoning,
      },
    });
  },

  setCurrentStep: (step: GameStep) => {
    set({ currentStep: step });
  },

  calculateScore: (): Score => {
    const { currentLevel, currentSession } = get();
    if (!currentLevel || !currentSession) {
      return { accuracyScore: 0, discoveryScore: 0, logicScore: 0, totalScore: 0, grade: 'D' };
    }

    const anomalyClues = currentLevel.clues.filter(c => c.isAnomaly);

    let truePositives = 0;
    let falsePositives = 0;

    currentSession.playerChoices.forEach(choice => {
      const clue = currentLevel.clues.find(c => c.id === choice.clueId);
      if (!clue) return;

      if (choice.markedAsAnomaly) {
        if (clue.isAnomaly) {
          truePositives++;
        } else {
          falsePositives++;
        }
      }
    });

    const accuracy = anomalyClues.length > 0 
      ? (truePositives / anomalyClues.length) * 100
      : 0;

    const discovery = (truePositives / (truePositives + falsePositives + 0.001)) * 100;

    let logicScore = 50;
    if (currentSession.dynastyGuess === currentLevel.correctDynasty) {
      logicScore += 30;
    }
    if (currentSession.reasoningNotes && currentSession.reasoningNotes.length > 20) {
      logicScore += 20;
    }

    const accuracyScore = Math.round(accuracy * 0.4);
    const discoveryScore = Math.round(discovery * 0.3);
    const finalLogicScore = Math.round(logicScore * 0.3);
    const totalScore = accuracyScore + discoveryScore + finalLogicScore;

    return {
      accuracyScore,
      discoveryScore,
      logicScore: finalLogicScore,
      totalScore,
      grade: calculateGrade(totalScore),
    };
  },

  submitConclusion: () => {
    const { currentSession, calculateScore } = get();
    if (!currentSession) return;

    const score = calculateScore();
    const updatedSession: GameSession = {
      ...currentSession,
      endTime: Date.now(),
      status: 'completed',
      score,
    };

    set({ currentSession: updatedSession });
    get().saveSession();
  },

  saveSession: () => {
    const { currentSession } = get();
    if (!currentSession) return;

    const sessions = JSON.parse(localStorage.getItem('paintingSessions') || '[]');
    const existingIndex = sessions.findIndex((s: GameSession) => s.id === currentSession.id);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = currentSession;
    } else {
      sessions.unshift(currentSession);
    }

    localStorage.setItem('paintingSessions', JSON.stringify(sessions.slice(0, 20)));
  },

  loadSessions: () => {
    const sessions = JSON.parse(localStorage.getItem('paintingSessions') || '[]');
    set({ replaySessions: sessions });
  },

  loadReplaySession: (sessionId: string) => {
    const { replaySessions } = get();
    const session = replaySessions.find(s => s.id === sessionId);
    if (!session) return;

    const level = levels.find(l => l.id === session.levelId);
    if (!level) return;

    set({
      currentSession: session,
      currentLevel: level,
      isReplayMode: true,
      replayIndex: 0,
    });
  },

  setReplayIndex: (index: number) => {
    set({ replayIndex: index });
  },

  exportReport: (sessionId: string): ExportReport => {
    const { replaySessions } = get();
    const session = replaySessions.find(s => s.id === sessionId);
    const level = levels.find(l => l.id === session?.levelId);
    
    if (!session || !level) {
      throw new Error('Session or level not found');
    }

    const keyFindings = session.playerChoices
      .filter(c => c.markedAsAnomaly)
      .map(c => {
        const clue = level.clues.find(cl => cl.id === c.clueId);
        return clue?.title || '';
      })
      .filter(Boolean);

    const learningPoints = level.anomalies.map(a => a.name);

    const playTime = session.endTime 
      ? Math.round((session.endTime - session.startTime) / 1000)
      : 0;

    return {
      summary: {
        levelTitle: level.title,
        playTime,
        totalScore: session.score?.totalScore || 0,
        grade: session.score?.grade || 'D',
        keyFindings,
        learningPoints,
      },
      details: {
        ...session,
        levelData: level,
        timestamp: Date.now(),
      },
    };
  },

  resetGame: () => {
    set({
      currentSession: null,
      currentLevel: null,
      currentStep: 'intro',
      selectedClueId: null,
      isReplayMode: false,
      replayIndex: 0,
    });
  },
}));
