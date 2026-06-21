import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { MealPoint, MergeSuggestion, AppState, AppContextType, AuditRecord, DiffRecord, FieldDiff, ManualResolveInput, ManualResolveSnapshot, PointType } from '../types';
import { saveToLocalStorage, loadFromLocalStorage, clearLocalStorage, generateId } from '../utils/storage';
import { calculateSimilarity, getMergeReason, SIMILARITY_THRESHOLDS } from '../utils/similarity';
import { sampleMealPoints } from '../data/sampleData';

const initialState: AppState = {
  points: [],
  suggestions: [],
  diffs: [],
  currentStep: 'import',
};

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'ADD_POINTS'; payload: MealPoint[] }
  | { type: 'UPDATE_POINT'; payload: MealPoint }
  | { type: 'REMOVE_POINT'; payload: string }
  | { type: 'SET_SUGGESTIONS'; payload: MergeSuggestion[] }
  | { type: 'UPDATE_SUGGESTION'; payload: MergeSuggestion }
  | { type: 'SET_DIFFS'; payload: DiffRecord[] }
  | { type: 'UPDATE_DIFF'; payload: DiffRecord }
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
    case 'SET_DIFFS':
      return { ...state, diffs: action.payload };
    case 'UPDATE_DIFF':
      return {
        ...state,
        diffs: state.diffs.map((d) =>
          d.id === action.payload.id ? action.payload : d
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
          diffs: saved.diffs || [],
          currentStep: saved.currentStep,
        },
      });
    }
  }, []);

  useEffect(() => {
    saveToLocalStorage({
      points: state.points,
      suggestions: state.suggestions,
      diffs: state.diffs,
      currentStep: state.currentStep,
    });
  }, [state.points, state.suggestions, state.diffs, state.currentStep]);

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

  const detectDiffs = () => {
    const { points } = state;
    const diffs: DiffRecord[] = [];
    const processedPairs = new Set<string>();

    const compareFields: Array<{ key: keyof MealPoint; label: string }> = [
      { key: 'name', label: '点位名称' },
      { key: 'address', label: '详细地址' },
      { key: 'lat', label: '纬度' },
      { key: 'lng', label: '经度' },
      { key: 'source', label: '数据来源' },
      { key: 'notes', label: '备注' },
    ];

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];
        const pairKey = [p1.id, p2.id].sort().join('-');
        if (processedPairs.has(pairKey)) continue;

        const similarity = calculateSimilarity(
          p1.name, p1.address, p1.lat, p1.lng,
          p2.name, p2.address, p2.lat, p2.lng
        );

        if (similarity.overall >= SIMILARITY_THRESHOLDS.MANUAL_REVIEW * 0.6 && similarity.breakdown.distance > 0.3) {
          const diffFields: FieldDiff[] = [];
          for (const f of compareFields) {
            const v1 = String(p1[f.key] ?? '').trim();
            const v2 = String(p2[f.key] ?? '').trim();
            if (v1 !== v2 && (v1 || v2)) {
              diffFields.push({ field: f.label, valueA: v1 || '(空)', valueB: v2 || '(空)' });
            }
          }
          if (diffFields.length > 0) {
            diffs.push({
              id: generateId(),
              pointIds: [p1.id, p2.id],
              diffFields,
              status: 'pending',
              detectedAt: new Date(),
            });
            processedPairs.add(pairKey);
          }
        }
      }
    }
    dispatch({ type: 'SET_DIFFS', payload: diffs });
  };

  const resolveDiff = (diffId: string, resolvedFields: FieldDiff[], note?: string) => {
    const diff = state.diffs.find((d) => d.id === diffId);
    if (!diff) return;

    const updatedDiff: DiffRecord = {
      ...diff,
      diffFields: resolvedFields,
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedNote: note,
    };
    dispatch({ type: 'UPDATE_DIFF', payload: updatedDiff });

    const [p1Id, p2Id] = diff.pointIds;
    const p1 = state.points.find((p) => p.id === p1Id);
    const p2 = state.points.find((p) => p.id === p2Id);
    if (p1) {
      const labels: Record<string, keyof MealPoint> = {
        '点位名称': 'name', '详细地址': 'address', '纬度': 'lat', '经度': 'lng', '数据来源': 'source', '备注': 'notes',
      };
      const mergedPoint: any = { ...p1 };
      for (const f of resolvedFields) {
        const key = labels[f.field];
        if (!key) continue;
        if (f.chosen === 'A') mergedPoint[key] = p1[key];
        else if (f.chosen === 'B' && p2) mergedPoint[key] = p2[key];
        else if (f.chosen === 'custom' && f.customValue) mergedPoint[key] = f.customValue;
      }
      dispatch({
        type: 'UPDATE_POINT',
        payload: addAuditRecord(mergedPoint as MealPoint, 'diffResolve', `补录差异已处理，涉及${resolvedFields.length}个字段${note ? '：' + note : ''}`),
      });
    }
  };

  const skipDiff = (diffId: string) => {
    const diff = state.diffs.find((d) => d.id === diffId);
    if (!diff) return;
    dispatch({
      type: 'UPDATE_DIFF',
      payload: { ...diff, status: 'skipped', resolvedAt: new Date() },
    });
  };

  const manuallyResolvePoint = (pointId: string, input: ManualResolveInput) => {
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    const snapshots: ManualResolveSnapshot[] = [];
    const originalValues: Partial<Record<'name' | 'address' | 'type', string>> = { ...point.originalValues };
    const fieldLabels: Record<string, string> = { name: '点位名称', address: '详细地址', type: '点位类型' };

    let updatedPoint: any = { ...point };

    if (input.name !== undefined && input.name !== point.name) {
      if (!originalValues.name) originalValues.name = point.name;
      snapshots.push({ field: '点位名称', originalValue: point.name, resolvedValue: input.name });
      updatedPoint.name = input.name;
    }
    if (input.address !== undefined && input.address !== point.address) {
      if (!originalValues.address) originalValues.address = point.address;
      snapshots.push({ field: '详细地址', originalValue: point.address, resolvedValue: input.address });
      updatedPoint.address = input.address;
    }
    if (input.type !== undefined && input.type !== point.type) {
      if (!originalValues.type) originalValues.type = point.type;
      snapshots.push({ field: '点位类型', originalValue: point.type, resolvedValue: input.type });
      updatedPoint.type = input.type;
    }

    if (input.zhoujieNote !== undefined) {
      updatedPoint.zhoujieNote = input.zhoujieNote;
    }
    if (input.feedback !== undefined) {
      updatedPoint.feedback = input.feedback;
    }
    if (input.photoNotes !== undefined) {
      updatedPoint.photoNotes = input.photoNotes;
    }

    if (snapshots.length > 0) {
      updatedPoint.manualResolveHistory = [...(point.manualResolveHistory || []), ...snapshots];
    }
    updatedPoint.originalValues = originalValues;

    const extraNotes: string[] = [];
    if (input.zhoujieNote) extraNotes.push(`周姐备注：${input.zhoujieNote}`);
    if (input.feedback) extraNotes.push(`居民反馈：${input.feedback}`);
    if (input.photoNotes) extraNotes.push(`照片说明：${input.photoNotes}`);
    if (extraNotes.length > 0) {
      updatedPoint.notes = point.notes ? `${point.notes} | ${extraNotes.join(' | ')}` : extraNotes.join(' | ');
    }

    const remarkParts: string[] = [];
    if (snapshots.length > 0) {
      remarkParts.push(`手动处理${snapshots.length}个字段：` + snapshots.map((s) => `${s.field}[${s.originalValue}→${s.resolvedValue}]`).join('，'));
    }
    if (input.operationNote) remarkParts.push(input.operationNote);
    const finalRemark = remarkParts.length > 0 ? remarkParts.join('；') : '手动处理';

    updatedPoint = addAuditRecord(updatedPoint as MealPoint, 'manualResolve', finalRemark);
    updatedPoint.status = 'confirmed';

    dispatch({ type: 'UPDATE_POINT', payload: updatedPoint as MealPoint });
  };

  const exportToCSV = (): string => {
    const headers = [
      '点位名称', '地址', '纬度', '经度', '数据来源', '状态', '类型',
      '周姐备注', '居民反馈', '巡检照片说明',
      '备注', '来源文件', '原始行号', '原始行数据',
      '原始名称(冲突前)', '原始地址(冲突前)', '原始类型(冲突前)',
      '人工处理痕迹',
      '审核记录数', '审核意见历史', '涉及补录差异数'
    ];
    const rows = state.points.map((p) => {
      const relatedDiffs = state.diffs.filter((d) => d.pointIds.includes(p.id));
      const manualTraces = (p.manualResolveHistory || [])
        .map((s) => `${s.field}:${s.originalValue}→${s.resolvedValue}`)
        .join(' | ');
      const auditHistory = p.auditTrail
        .map((r) => `[${new Date(r.timestamp).toLocaleString('zh-CN')}]${r.operator}-${r.action}:${r.remark}`)
        .join(' || ');
      return [
        p.name || '(空)',
        p.address,
        p.lat,
        p.lng,
        p.source,
        p.status,
        p.type,
        p.zhoujieNote || '',
        p.feedback || '',
        p.photoNotes || '',
        p.notes,
        p.fileName,
        p.sourceRowNumber,
        Object.entries(p.sourceRow).map(([k, v]) => `${k}=${v}`).join('; '),
        p.originalValues?.name || '',
        p.originalValues?.address || '',
        p.originalValues?.type || '',
        manualTraces,
        p.auditTrail.length,
        auditHistory,
        relatedDiffs.length,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    if (state.diffs.length > 0) {
      return csvContent + '\n\n===补录差异记录===\n' +
        ['差异ID', '涉及点位ID', '差异字段数', '状态', '处理备注', '检测时间', '处理时间', '字段明细']
          .map((c) => `"${c}"`).join(',') + '\n' +
        state.diffs.map((d) => [
          d.id,
          d.pointIds.join('|'),
          d.diffFields.length,
          d.status,
          d.resolvedNote || '',
          new Date(d.detectedAt).toLocaleString('zh-CN'),
          d.resolvedAt ? new Date(d.resolvedAt).toLocaleString('zh-CN') : '',
          d.diffFields.map((f) => `${f.field}[A:${f.valueA}|B:${f.valueB}]${f.chosen ? '(取' + (f.chosen === 'custom' ? '自定义:' + f.customValue : f.chosen) + ')' : ''}`).join('；'),
        ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    }

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
    detectDiffs,
    resolveDiff,
    skipDiff,
    manuallyResolvePoint,
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
