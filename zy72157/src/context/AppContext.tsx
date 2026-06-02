import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { MealPoint, MergeSuggestion, AppState, AppContextType, AuditRecord } from '../types';
import { saveToLocalStorage, loadFromLocalStorage, clearLocalStorage, generateId } from '../utils/storage';
import { calculateSimilarity, getMergeReason, SIMILARITY_THRESHOLDS } from '../utils/similarity';
import { sampleMealPoints } from '../data/sampleData';

const initialState: AppState = {
  points: [],
  suggestions: [],
  currentStep: 'import',
};

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'ADD_POINTS'; payload: MealPoint[] }
  | { type: 'UPDATE_POINT'; payload: MealPoint }
  | { type: 'REMOVE_POINT'; payload: string }
  | { type: 'SET_SUGGESTIONS'; payload: MergeSuggestion[] }
  | { type: 'UPDATE_SUGGESTION'; payload: MergeSuggestion }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_STEP'; payload: AppState['currentStep'] };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'ADD_POINTS':
      return { ...state, points: [...state.points, ...action.payload] };
    case 'UPDATE_POINT':
      return {
        ...state,
        points: state.points.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'REMOVE_POINT':
      return {
        ...state,
        points: state.points.filter((p) => p.id !== action.payload),
      };
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload };
    case 'UPDATE_SUGGESTION':
      return {
        ...state,
        suggestions: state.suggestions.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'CLEAR_ALL':
      return initialState;
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          points: saved.points,
          suggestions: saved.suggestions,
          currentStep: saved.currentStep,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (state.points.length > 0) {
      saveToLocalStorage({
        points: state.points,
        suggestions: state.suggestions,
        currentStep: state.currentStep,
      });
    }
  }, [state.points, state.suggestions, state.currentStep]);

  const addAuditRecord = (point: MealPoint, action: AuditRecord['action'], remark: string, operator: string = '老曹'): MealPoint => {
    const newRecord: AuditRecord = {
      id: generateId(),
      action,
      operator,
      remark,
      timestamp: new Date(),
    };
    return {
      ...point,
      auditTrail: [...point.auditTrail, newRecord],
      updatedAt: new Date(),
    };
  };

  const addPoints = (points: MealPoint[]) => {
    dispatch({ type: 'ADD_POINTS', payload: points });
  };

  const generateSuggestions = () => {
    const { points } = state;
    const suggestions: MergeSuggestion[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];
        const pairKey = [p1.id, p2.id].sort().join('-');

        if (processedPairs.has(pairKey)) continue;
        if (p1.status === 'merged' || p2.status === 'merged') continue;

        const similarity = calculateSimilarity(
          p1.name, p1.address, p1.lat, p1.lng,
          p2.name, p2.address, p2.lat, p2.lng
        );

        if (similarity.overall >= SIMILARITY_THRESHOLDS.MANUAL_REVIEW) {
          suggestions.push({
            id: generateId(),
            pointId1: p1.id,
            pointId2: p2.id,
            similarityScore: similarity.overall,
            similarityBreakdown: similarity.breakdown,
            reason: getMergeReason(similarity, p1.name, p2.name),
            status: 'pending',
            suggestedAt: new Date(),
          });
          processedPairs.add(pairKey);
        }
      }
    }

    dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
  };

  const approveSuggestion = (suggestionId: string) => {
    const suggestion = state.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const point1 = state.points.find((p) => p.id === suggestion.pointId1);
    const point2 = state.points.find((p) => p.id === suggestion.pointId2);
    if (!point1 || !point2) return;

    const mergedPoint: MealPoint = {
      ...point1,
      name: point1.name.length >= point2.name.length ? point1.name : point2.name,
      address: point1.address.length >= point2.address.length ? point1.address : point2.address,
      status: 'merged',
      mergeHistory: [...point1.mergeHistory, ...point2.mergeHistory, point2.id],
      notes: [point1.notes, point2.notes].filter(Boolean).join(' | '),
      auditTrail: [
        ...point1.auditTrail,
        ...point2.auditTrail,
        {
          id: generateId(),
          action: 'merge',
          operator: '老曹',
          remark: `与点位"${point2.name}"合并，相似度${(suggestion.similarityScore * 100).toFixed(1)}%`,
          timestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    dispatch({ type: 'UPDATE_POINT', payload: mergedPoint });
    dispatch({ type: 'REMOVE_POINT', payload: point2.id });
    dispatch({
      type: 'UPDATE_SUGGESTION',
      payload: { ...suggestion, status: 'approved' },
    });
  };

  const rejectSuggestion = (suggestionId: string, reason: string) => {
    const suggestion = state.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    dispatch({
      type: 'UPDATE_SUGGESTION',
      payload: { ...suggestion, status: 'rejected' },
    });

    const point1 = state.points.find((p) => p.id === suggestion.pointId1);
    const point2 = state.points.find((p) => p.id === suggestion.pointId2);
    if (point1) {
      dispatch({
        type: 'UPDATE_POINT',
        payload: addAuditRecord(point1, 'reject', `拒绝与"${point2?.name || '未知'}"合并：${reason}`),
      });
    }
  };

  const confirmPoint = (pointId: string, note?: string) => {
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    let updatedPoint = addAuditRecord(point, 'confirm', note || '人工确认通过');
    updatedPoint = { ...updatedPoint, status: 'confirmed' };
    if (note) {
      updatedPoint.notes = point.notes ? `${point.notes} | ${note}` : note;
    }

    dispatch({ type: 'UPDATE_POINT', payload: updatedPoint });
  };

  const rejectPoint = (pointId: string, reason: string) => {
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    const updatedPoint = addAuditRecord(point, 'reject', `点位作废：${reason}`);
    dispatch({
      type: 'UPDATE_POINT',
      payload: { ...updatedPoint, status: 'rejected' },
    });
  };

  const addNoteToPoint = (pointId: string, note: string) => {
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    const updatedPoint = addAuditRecord(point, 'note', note);
    updatedPoint.notes = point.notes ? `${point.notes} | ${note}` : note;

    dispatch({ type: 'UPDATE_POINT', payload: updatedPoint });
  };

  const loadSampleData = () => {
    dispatch({ type: 'CLEAR_ALL' });
    setTimeout(() => {
      dispatch({ type: 'ADD_POINTS', payload: sampleMealPoints });
    }, 100);
  };

  const clearAllData = () => {
    clearLocalStorage();
    dispatch({ type: 'CLEAR_ALL' });
  };

  const setCurrentStep = (step: AppState['currentStep']) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const exportToCSV = (): string => {
    const headers = ['点位名称', '地址', '纬度', '经度', '数据来源', '状态', '类型', '备注', '审核记录数'];
    const rows = state.points.map((p) => [
      p.name || '(空)',
      p.address,
      p.lat,
      p.lng,
      p.source,
      p.status,
      p.type,
      p.notes,
      p.auditTrail.length,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  };

  const value: AppContextType = {
    ...state,
    addPoints,
    approveSuggestion,
    rejectSuggestion,
    confirmPoint,
    rejectPoint,
    addNoteToPoint,
    generateSuggestions,
    loadSampleData,
    clearAllData,
    setCurrentStep,
    exportToCSV,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
