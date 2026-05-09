import type { Workspace, Action } from '../types';
import { generateId } from '../utils/hash';

export function createInitialWorkspace(): Workspace {
  return {
    id: generateId(),
    name: '新工作区',
    scriptName: '未命名剧本',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [],
    clues: [],
    conflicts: [],
    gaps: [],
  };
}

export function workspaceReducer(state: Workspace, action: Action): Workspace {
  switch (action.type) {
    case 'ADD_PLAYER':
      return {
        ...state,
        players: [...state.players, { ...action.payload, id: generateId() }],
        updatedAt: Date.now(),
      };

    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
        updatedAt: Date.now(),
      };

    case 'REMOVE_PLAYER':
      return {
        ...state,
        players: state.players.filter(p => p.id !== action.payload),
        clues: state.clues.filter(c => c.playerId !== action.payload),
        updatedAt: Date.now(),
      };

    case 'ADD_CLUE':
      return {
        ...state,
        clues: [
          ...state.clues,
          {
            ...action.payload,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };

    case 'UPDATE_CLUE':
      return {
        ...state,
        clues: state.clues.map(c =>
          c.id === action.payload.id
            ? { ...action.payload, updatedAt: Date.now() }
            : c
        ),
        updatedAt: Date.now(),
      };

    case 'REMOVE_CLUE':
      return {
        ...state,
        clues: state.clues.filter(c => c.id !== action.payload),
        updatedAt: Date.now(),
      };

    case 'BATCH_ADD_CLUES':
      return {
        ...state,
        clues: [
          ...state.clues,
          ...action.payload.map(clue => ({
            ...clue,
            id: generateId(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })),
        ],
        updatedAt: Date.now(),
      };

    case 'RESOLVE_CONFLICT':
      return {
        ...state,
        conflicts: state.conflicts.map(c =>
          c.id === action.payload.id
            ? { ...c, resolved: true, resolvedNotes: action.payload.notes }
            : c
        ),
        updatedAt: Date.now(),
      };

    case 'SET_WORKSPACE':
      return action.payload;

    case 'LOAD_SAMPLE':
      return action.payload;

    case 'RESET_WORKSPACE':
      return createInitialWorkspace();

    case 'IMPORT_DATA':
      return action.payload;

    case 'UPDATE_WORKSPACE_INFO':
      return {
        ...state,
        name: action.payload.name,
        scriptName: action.payload.scriptName,
        updatedAt: Date.now(),
      };

    default:
      return state;
  }
}
