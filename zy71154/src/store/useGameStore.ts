import { create } from 'zustand';
import type { GameState, LevelConfig } from '../game/types';
import { initializeGameState, processTurn, createEvent } from '../game/engine';
import { DEFAULT_LEVEL, LEVELS } from '../game/levels';

interface GameStore extends GameState {
  currentLevel: LevelConfig;
  setCurrentLevel: (level: LevelConfig) => void;
  initializeGame: (level?: LevelConfig) => void;
  selectNode: (nodeId: string | null) => void;
  selectTeam: (teamId: string | null) => void;
  assignTeamToNode: (teamId: string, nodeId: string) => boolean;
  endTurn: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  exportReport: () => string;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initializeGameState(DEFAULT_LEVEL),
  currentLevel: DEFAULT_LEVEL,

  setCurrentLevel: (level: LevelConfig) => {
    set({ currentLevel: level });
  },

  initializeGame: (level?: LevelConfig) => {
    const gameLevel = level || get().currentLevel;
    set({
      ...initializeGameState(gameLevel),
      currentLevel: gameLevel
    });
  },

  selectNode: (nodeId: string | null) => {
    set({ selectedNode: nodeId });
  },

  selectTeam: (teamId: string | null) => {
    set({ selectedTeam: teamId });
  },

  assignTeamToNode: (teamId: string, nodeId: string) => {
    const state = get();
    const team = state.teams.find(t => t.id === teamId);
    const node = state.nodes.find(n => n.id === nodeId);

    if (!team || !node) return false;
    if (team.status !== 'idle') return false;
    if (node.status === 'operational') return false;
    if (node.status === 'destroyed') return false;
    if (node.type === 'user') return false;

    const isAlreadyAssigned = state.teams.some(
      t => t.currentTarget === nodeId && t.status === 'repairing'
    );
    if (isAlreadyAssigned) return false;

    const updatedTeams = state.teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          status: 'repairing' as const,
          currentTarget: nodeId,
          position: node.position
        };
      }
      return t;
    });

    const updatedNodes = state.nodes.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          status: 'repairing' as const
        };
      }
      return n;
    });

    const newEvent = createEvent(
      state.turn,
      'repair_start',
      `🔧 ${team.name} 开始抢修 ${node.name}`
    );

    const action = {
      type: 'assign_team' as const,
      teamId,
      nodeId,
      timestamp: Date.now()
    };

    set({
      teams: updatedTeams,
      nodes: updatedNodes,
      events: [...state.events, newEvent],
      currentTurnActions: [...state.currentTurnActions, action],
      selectedNode: null,
      selectedTeam: null
    });

    return true;
  },

  endTurn: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const newState = processTurn(state);
    
    const endTurnAction = {
      type: 'end_turn' as const,
      timestamp: Date.now()
    };

    set({
      ...newState,
      currentTurnActions: []
    });
  },

  pauseGame: () => {
    const state = get();
    if (state.status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    const state = get();
    if (state.status === 'paused') {
      set({ status: 'playing' });
    }
  },

  restartGame: () => {
    const state = get();
    get().initializeGame(state.currentLevel);
  },

  exportReport: () => {
    const state = get();
    const report = {
      gameId: Date.now(),
      level: state.currentLevel.name,
      difficulty: state.difficulty,
      finalScore: state.score,
      scoreBreakdown: state.scoreBreakdown,
      result: state.status,
      defeatReason: state.defeatReason,
      totalTurns: state.turn,
      maxTurns: state.maxTurns,
      events: state.events,
      history: state.history.map(h => ({
        turn: h.turn,
        score: h.score,
        weather: h.weather.description,
        actionCount: h.actions.length
      }))
    };
    return JSON.stringify(report, null, 2);
  }
}));
