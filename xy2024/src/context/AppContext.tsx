import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Question, ReviewRecord, Familiarity, ReviewSettings, MindMap, MindMapNode, Subject } from '../types';
import { loadFromStorage, saveToStorage } from '../utils/storage';
import { calculateNextReviewDate } from '../utils/reviewAlgorithm';

type Action =
  | { type: 'ADD_QUESTION'; payload: Omit<Question, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_QUESTION'; payload: Question }
  | { type: 'DELETE_QUESTION'; payload: string }
  | { type: 'ADD_REVIEW_RECORD'; payload: { questionId: string; familiarity: Familiarity } }
  | { type: 'UPDATE_REVIEW_SETTINGS'; payload: Partial<ReviewSettings> }
  | { type: 'ADD_MIND_MAP'; payload: { title: string; type: 'curve' | 'tree'; rootLabel: string } }
  | { type: 'UPDATE_MIND_MAP'; payload: MindMap }
  | { type: 'DELETE_MIND_MAP'; payload: string }
  | { type: 'ADD_MIND_MAP_NODE'; payload: { mindMapId: string; parentNodeId: string; node: Omit<MindMapNode, 'id' | 'children'> } }
  | { type: 'UPDATE_MIND_MAP_NODE'; payload: { mindMapId: string; nodeId: string; label: string } }
  | { type: 'DELETE_MIND_MAP_NODE'; payload: { mindMapId: string; nodeId: string } }
  | { type: 'UPDATE_USER'; payload: Partial<AppState['user']> }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: AppState = loadFromStorage();

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  let newState: AppState;

  switch (action.type) {
    case 'ADD_QUESTION':
      const newQuestion: Question = {
        ...action.payload,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      newState = {
        ...state,
        questions: [...state.questions, newQuestion],
        user: { ...state.user, totalQuestions: state.user.totalQuestions + 1 }
      };
      break;

    case 'UPDATE_QUESTION':
      newState = {
        ...state,
        questions: state.questions.map(q =>
          q.id === action.payload.id ? { ...action.payload, updatedAt: new Date().toISOString() } : q
        )
      };
      break;

    case 'DELETE_QUESTION':
      newState = {
        ...state,
        questions: state.questions.filter(q => q.id !== action.payload),
        reviewRecords: state.reviewRecords.filter(r => r.questionId !== action.payload),
        user: { ...state.user, totalQuestions: Math.max(0, state.user.totalQuestions - 1) }
      };
      break;

    case 'ADD_REVIEW_RECORD': {
      const existingRecord = state.reviewRecords.find(r => r.questionId === action.payload.questionId);
      
      if (existingRecord) {
        const result = calculateNextReviewDate(existingRecord, action.payload.familiarity);
        const updatedRecord: ReviewRecord = {
          ...existingRecord,
          familiarity: action.payload.familiarity,
          reviewedAt: new Date().toISOString(),
          nextReviewDate: result.nextReviewDate,
          reviewCount: existingRecord.reviewCount + 1,
          easeFactor: result.easeFactor,
          interval: result.interval
        };
        newState = {
          ...state,
          reviewRecords: state.reviewRecords.map(r =>
            r.id === updatedRecord.id ? updatedRecord : r
          )
        };
      } else {
        const defaultRecord: ReviewRecord = {
          id: uuidv4(),
          questionId: action.payload.questionId,
          familiarity: action.payload.familiarity,
          reviewedAt: new Date().toISOString(),
          nextReviewDate: new Date().toISOString(),
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1
        };
        const result = calculateNextReviewDate(defaultRecord, action.payload.familiarity);
        const newRecord: ReviewRecord = {
          ...defaultRecord,
          nextReviewDate: result.nextReviewDate,
          reviewCount: 1,
          easeFactor: result.easeFactor,
          interval: result.interval
        };
        newState = {
          ...state,
          reviewRecords: [...state.reviewRecords, newRecord],
          user: { ...state.user, reviewedQuestions: state.user.reviewedQuestions + 1 }
        };
      }
      break;
    }

    case 'UPDATE_REVIEW_SETTINGS':
      newState = {
        ...state,
        reviewSettings: {
          ...state.reviewSettings,
          ...action.payload,
          updatedAt: new Date().toISOString()
        }
      };
      break;

    case 'ADD_MIND_MAP': {
      const root: MindMapNode = {
        id: uuidv4(),
        label: action.payload.rootLabel,
        type: 'root',
        questionIds: [],
        children: []
      };
      const newMindMap: MindMap = {
        id: uuidv4(),
        title: action.payload.title,
        type: action.payload.type,
        root,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      newState = {
        ...state,
        mindMaps: [...state.mindMaps, newMindMap]
      };
      break;
    }

    case 'UPDATE_MIND_MAP':
      newState = {
        ...state,
        mindMaps: state.mindMaps.map(m =>
          m.id === action.payload.id ? { ...action.payload, updatedAt: new Date().toISOString() } : m
        )
      };
      break;

    case 'DELETE_MIND_MAP':
      newState = {
        ...state,
        mindMaps: state.mindMaps.filter(m => m.id !== action.payload)
      };
      break;

    case 'ADD_MIND_MAP_NODE': {
      const addNode = (node: MindMapNode): MindMapNode => {
        if (node.id === action.payload.parentNodeId) {
          const newNode: MindMapNode = {
            ...action.payload.node,
            id: uuidv4(),
            children: []
          };
          return { ...node, children: [...node.children, newNode] };
        }
        return { ...node, children: node.children.map(addNode) };
      };
      newState = {
        ...state,
        mindMaps: state.mindMaps.map(m =>
          m.id === action.payload.mindMapId
            ? { ...m, root: addNode(m.root), updatedAt: new Date().toISOString() }
            : m
        )
      };
      break;
    }

    case 'UPDATE_MIND_MAP_NODE': {
      const updateNode = (node: MindMapNode): MindMapNode => {
        if (node.id === action.payload.nodeId) {
          return { ...node, label: action.payload.label };
        }
        return { ...node, children: node.children.map(updateNode) };
      };
      newState = {
        ...state,
        mindMaps: state.mindMaps.map(m =>
          m.id === action.payload.mindMapId
            ? { ...m, root: updateNode(m.root), updatedAt: new Date().toISOString() }
            : m
        )
      };
      break;
    }

    case 'DELETE_MIND_MAP_NODE': {
      const deleteNode = (node: MindMapNode): MindMapNode => {
        return {
          ...node,
          children: node.children
            .filter(child => child.id !== action.payload.nodeId)
            .map(deleteNode)
        };
      };
      newState = {
        ...state,
        mindMaps: state.mindMaps.map(m =>
          m.id === action.payload.mindMapId
            ? { ...m, root: deleteNode(m.root), updatedAt: new Date().toISOString() }
            : m
        )
      };
      break;
    }

    case 'UPDATE_USER':
      newState = {
        ...state,
        user: { ...state.user, ...action.payload }
      };
      break;

    case 'SET_THEME':
      newState = {
        ...state,
        theme: action.payload
      };
      break;

    case 'LOAD_STATE':
      newState = action.payload;
      break;

    case 'SET_LOADING':
      newState = { ...state, loading: action.payload };
      break;

    case 'SET_ERROR':
      newState = { ...state, error: action.payload };
      break;

    default:
      return state;
  }

  return newState;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export function useQuestions() {
  const { state, dispatch } = useAppContext();
  
  const addQuestion = (question: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch({ type: 'ADD_QUESTION', payload: question });
  };

  const updateQuestion = (question: Question) => {
    dispatch({ type: 'UPDATE_QUESTION', payload: question });
  };

  const deleteQuestion = (id: string) => {
    dispatch({ type: 'DELETE_QUESTION', payload: id });
  };

  const getQuestionsBySubject = (subject: Subject) => {
    return state.questions.filter(q => q.subject === subject);
  };

  const getQuestionById = (id: string) => {
    return state.questions.find(q => q.id === id);
  };

  const searchQuestions = (query: string) => {
    const lowerQuery = query.toLowerCase();
    return state.questions.filter(q =>
      q.content.toLowerCase().includes(lowerQuery) ||
      q.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  };

  return {
    questions: state.questions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionsBySubject,
    getQuestionById,
    searchQuestions
  };
}

export function useReview() {
  const { state, dispatch } = useAppContext();

  const addReviewRecord = (questionId: string, familiarity: Familiarity) => {
    dispatch({ type: 'ADD_REVIEW_RECORD', payload: { questionId, familiarity } });
  };

  const updateReviewSettings = (settings: Partial<ReviewSettings>) => {
    dispatch({ type: 'UPDATE_REVIEW_SETTINGS', payload: settings });
  };

  const getReviewRecordByQuestionId = (questionId: string) => {
    return state.reviewRecords.find(r => r.questionId === questionId);
  };

  const getDueQuestions = () => {
    const now = new Date();
    return state.questions.filter(q => {
      const record = state.reviewRecords.find(r => r.questionId === q.id);
      if (!record) return true;
      return new Date(record.nextReviewDate) <= now;
    });
  };

  return {
    reviewRecords: state.reviewRecords,
    reviewSettings: state.reviewSettings,
    addReviewRecord,
    updateReviewSettings,
    getReviewRecordByQuestionId,
    getDueQuestions
  };
}

export function useMindMaps() {
  const { state, dispatch } = useAppContext();

  const addMindMap = (title: string, type: 'curve' | 'tree', rootLabel: string) => {
    dispatch({ type: 'ADD_MIND_MAP', payload: { title, type, rootLabel } });
  };

  const updateMindMap = (mindMap: MindMap) => {
    dispatch({ type: 'UPDATE_MIND_MAP', payload: mindMap });
  };

  const deleteMindMap = (id: string) => {
    dispatch({ type: 'DELETE_MIND_MAP', payload: id });
  };

  const addNode = (mindMapId: string, parentNodeId: string, node: Omit<MindMapNode, 'id' | 'children'>) => {
    dispatch({ type: 'ADD_MIND_MAP_NODE', payload: { mindMapId, parentNodeId, node } });
  };

  const updateNode = (mindMapId: string, nodeId: string, label: string) => {
    dispatch({ type: 'UPDATE_MIND_MAP_NODE', payload: { mindMapId, nodeId, label } });
  };

  const deleteNode = (mindMapId: string, nodeId: string) => {
    dispatch({ type: 'DELETE_MIND_MAP_NODE', payload: { mindMapId, nodeId } });
  };

  const getMindMapById = (id: string) => {
    return state.mindMaps.find(m => m.id === id);
  };

  return {
    mindMaps: state.mindMaps,
    addMindMap,
    updateMindMap,
    deleteMindMap,
    addNode,
    updateNode,
    deleteNode,
    getMindMapById
  };
}

export function useUser() {
  const { state, dispatch } = useAppContext();

  const updateUser = (user: Partial<AppState['user']>) => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  return {
    user: state.user,
    updateUser
  };
}

export function useTheme() {
  const { state, dispatch } = useAppContext();

  const setTheme = (theme: 'light' | 'dark') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const toggleTheme = () => {
    setTheme(state.theme === 'light' ? 'dark' : 'light');
  };

  return {
    theme: state.theme,
    setTheme,
    toggleTheme
  };
}
