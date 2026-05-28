import { create } from 'zustand';
import type {
  PrintBatch,
  StressResult,
  IssueTrack,
  Correction,
  Suggestion,
  Unit,
  IssueStatus,
} from '../types';
import { MOCK_BATCHES, MOCK_ISSUES, MOCK_CORRECTIONS, MOCK_RESULTS } from '../data/mockBatches';
import { calculateStress } from '../utils/stressCalculator';
import { generateSuggestions } from '../utils/suggestionEngine';
import { validateAll, fixTempDiffSign, fixUnitMixed } from '../utils/dataValidator';
import { getMaterialById } from '../data/materials';
import { convertToMm } from '../utils/unitConverter';

interface PrintState {
  batches: PrintBatch[];
  currentBatch: PrintBatch | null;
  currentResult: StressResult | null;
  issues: IssueTrack[];
  corrections: Correction[];
  suggestions: Suggestion[];
  selectedRowId: string | null;
  selectedPoint: { x: number; y: number } | null;
  currentUser: string;

  setCurrentBatch: (batch: PrintBatch | null) => void;
  updateBatchParam: <K extends keyof PrintBatch>(key: K, value: PrintBatch[K]) => void;
  createNewBatch: () => void;
  runAnalysis: () => void;
  validateCurrentBatch: () => ReturnType<typeof validateAll>;
  fixValidationError: (type: 'temp_diff_sign' | 'material_missing' | 'unit_mixed') => void;
  selectDetailRow: (rowId: string | null, point?: { x: number; y: number }) => void;
  addIssue: (issue: Omit<IssueTrack, 'id' | 'discoveredAt' | 'status'>) => void;
  updateIssueStatus: (issueId: string, status: IssueStatus) => void;
  addCorrection: (
    correction: Omit<Correction, 'id' | 'correctedAt'>,
    issueId: string,
  ) => void;
  confirmCorrection: (
    correctionId: string,
    result: 'pass' | 'fail',
    confirmedBy: string,
    notes?: string,
  ) => void;
  applySuggestion: (suggestion: Suggestion) => void;
  setCurrentUser: (name: string) => void;
  loadBatchById: (id: string) => void;
  getBatchIssues: (batchId: string) => IssueTrack[];
  getBatchCorrections: (batchId: string) => Correction[];
}

const createEmptyBatch = (): PrintBatch => ({
  id: `batch-${Date.now()}`,
  materialId: 'pla',
  bedTemp: 60,
  nozzleTemp: 200,
  ambientTemp: 25,
  modelWidth: 100,
  modelHeight: 100,
  modelDepth: 100,
  widthUnit: 'mm',
  heightUnit: 'mm',
  depthUnit: 'mm',
  coolingFanSpeed: 50,
  layerHeight: 0.2,
  printSpeed: 60,
  createdAt: new Date().toISOString(),
  status: 'draft',
  createdBy: '当前用户',
});

export const usePrintStore = create<PrintState>((set, get) => ({
  batches: MOCK_BATCHES,
  currentBatch: null,
  currentResult: null,
  issues: MOCK_ISSUES,
  corrections: MOCK_CORRECTIONS,
  suggestions: [],
  selectedRowId: null,
  selectedPoint: null,
  currentUser: '当前用户',

  setCurrentBatch: (batch) => {
    set({
      currentBatch: batch,
      currentResult: batch ? MOCK_RESULTS[batch.id] || null : null,
      suggestions: [],
      selectedRowId: null,
      selectedPoint: null,
    });

    if (batch && MOCK_RESULTS[batch.id]) {
      const suggestions = generateSuggestions(batch, MOCK_RESULTS[batch.id]);
      set({ suggestions });
    }
  },

  updateBatchParam: (key, value) => {
    set((state) => {
      if (!state.currentBatch) return state;
      return {
        currentBatch: {
          ...state.currentBatch,
          [key]: value,
        },
      };
    });
  },

  createNewBatch: () => {
    const newBatch = createEmptyBatch();
    set((state) => ({
      batches: [...state.batches, newBatch],
      currentBatch: newBatch,
      currentResult: null,
      suggestions: [],
      selectedRowId: null,
      selectedPoint: null,
    }));
  },

  runAnalysis: () => {
    const { currentBatch, currentUser } = get();
    if (!currentBatch) return;

    const result = calculateStress(currentBatch);
    const suggestions = generateSuggestions(currentBatch, result);

    const autoIssues: IssueTrack[] = [];
    result.validationErrors.forEach((err, idx) => {
      autoIssues.push({
        id: `issue-auto-${Date.now()}-${idx}`,
        batchId: currentBatch.id,
        issueType: err.type,
        description: err.message,
        detailRowId: `auto-${idx}`,
        discoveredBy: '系统检测',
        discoveredAt: new Date().toISOString(),
        status: 'discovered',
      });
    });

    if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
      const highStressPoints = result.stressDistribution
        .flat()
        .filter((p) => p.riskLevel === 'critical' || p.riskLevel === 'high')
        .slice(0, 3);

      highStressPoints.forEach((point, idx) => {
        autoIssues.push({
          id: `issue-stress-${Date.now()}-${idx}`,
          batchId: currentBatch.id,
          issueType: 'high_stress',
          description: `位置(${point.x},${point.y})应力值过高，${point.value.toFixed(1)}`,
          detailRowId: point.detailRowId,
          stressPoint: { x: point.x, y: point.y },
          discoveredBy: '系统检测',
          discoveredAt: new Date().toISOString(),
          status: 'discovered',
        });
      });
    }

    set((state) => {
      const existingIssues = state.issues.filter((i) => i.batchId !== currentBatch.id);
      return {
        currentResult: result,
        suggestions,
        issues: [...existingIssues, ...autoIssues],
        currentBatch: {
          ...currentBatch,
          status: 'analyzed',
          createdBy: currentUser,
        },
      };
    });
  },

  validateCurrentBatch: () => {
    const { currentBatch } = get();
    if (!currentBatch) return [];
    return validateAll(currentBatch);
  },

  fixValidationError: (type) => {
    const { currentBatch } = get();
    if (!currentBatch) return;

    const material = getMaterialById(currentBatch.materialId);
    let updates: Partial<PrintBatch> = {};

    if (type === 'temp_diff_sign' && material) {
      updates = fixTempDiffSign(currentBatch, material);
    } else if (type === 'unit_mixed') {
      const unitFix = fixUnitMixed(currentBatch);

      if (unitFix.widthUnit !== currentBatch.widthUnit && currentBatch.modelWidth !== undefined) {
        updates.modelWidth = convertToMm(
          currentBatch.modelWidth,
          currentBatch.widthUnit,
        );
      }
      if (unitFix.heightUnit !== currentBatch.heightUnit && currentBatch.modelHeight !== undefined) {
        updates.modelHeight = convertToMm(
          currentBatch.modelHeight,
          currentBatch.heightUnit,
        );
      }
      if (unitFix.depthUnit !== currentBatch.depthUnit && currentBatch.modelDepth !== undefined) {
        updates.modelDepth = convertToMm(
          currentBatch.modelDepth,
          currentBatch.depthUnit,
        );
      }
      updates.widthUnit = 'mm' as Unit;
      updates.heightUnit = 'mm' as Unit;
      updates.depthUnit = 'mm' as Unit;
    }

    if (Object.keys(updates).length > 0) {
      set((state) => ({
        currentBatch: state.currentBatch
          ? { ...state.currentBatch, ...updates }
          : null,
      }));
    }
  },

  selectDetailRow: (rowId, point) => {
    set({ selectedRowId: rowId, selectedPoint: point || null });
  },

  addIssue: (issue) => {
    const newIssue: IssueTrack = {
      ...issue,
      id: `issue-${Date.now()}`,
      discoveredAt: new Date().toISOString(),
      status: 'discovered',
    };
    set((state) => ({
      issues: [...state.issues, newIssue],
    }));
  },

  updateIssueStatus: (issueId, status) => {
    set((state) => ({
      issues: state.issues.map((i) =>
        i.id === issueId ? { ...i, status } : i,
      ),
    }));
  },

  addCorrection: (correction, issueId) => {
    const newCorrection: Correction = {
      ...correction,
      id: `corr-${Date.now()}`,
      correctedAt: new Date().toISOString(),
    };
    set((state) => ({
      corrections: [...state.corrections, newCorrection],
      issues: state.issues.map((i) =>
        i.id === issueId ? { ...i, status: 'corrected', correctionId: newCorrection.id } : i,
      ),
    }));

    const { currentBatch } = get();
    if (currentBatch && correction.adjustedParams) {
      set({
        currentBatch: {
          ...currentBatch,
          ...correction.adjustedParams,
        },
      });
    }
  },

  confirmCorrection: (correctionId, result, confirmedBy, notes) => {
    const now = new Date().toISOString();
    set((state) => {
      const corrections = state.corrections.map((c) =>
        c.id === correctionId
          ? {
              ...c,
              confirmationResult: result,
              confirmedBy,
              confirmedAt: now,
              notes,
            }
          : c,
      );

      const correction = corrections.find((c) => c.id === correctionId);
      const issues = correction
        ? state.issues.map((i) =>
            i.correctionId === correctionId
              ? { ...i, status: 'confirmed' as IssueStatus }
              : i,
          )
        : state.issues;

      const hasUnconfirmed = issues.some(
        (i) => i.status !== 'confirmed' && i.batchId === state.currentBatch?.id,
      );

      const currentBatch = state.currentBatch
        ? ({
            ...state.currentBatch,
            status: (hasUnconfirmed ? 'analyzed' : 'confirmed') as 'draft' | 'analyzed' | 'confirmed',
          } as PrintBatch)
        : null;

      return { corrections, issues, currentBatch };
    });
  },

  applySuggestion: (suggestion) => {
    const { currentBatch } = get();
    if (!currentBatch) return;

    const updates: Partial<PrintBatch> = {};

    if (suggestion.type === 'bed_temp') {
      const match = suggestion.recommendedValue.match(/(\d+)/);
      if (match) {
        if (suggestion.parameter === '床温') {
          updates.bedTemp = parseInt(match[1]);
        } else if (suggestion.parameter === '喷嘴温度') {
          updates.nozzleTemp = parseInt(match[1]);
        }
      }
    } else if (suggestion.type === 'cooling') {
      const match = suggestion.recommendedValue.match(/(\d+)/);
      if (match) {
        updates.coolingFanSpeed = parseInt(match[1]);
      }
    } else if (suggestion.type === 'environment') {
      const match = suggestion.recommendedValue.match(/(\d+)/);
      if (match) {
        updates.ambientTemp = parseInt(match[1]);
      }
    } else if (suggestion.type === 'material') {
      if (suggestion.recommendedValue.includes('PETG')) {
        updates.materialId = 'petg';
      } else if (suggestion.recommendedValue.includes('PLA')) {
        updates.materialId = 'pla';
      }
    }

    if (Object.keys(updates).length > 0) {
      set({
        currentBatch: {
          ...currentBatch,
          ...updates,
        },
      });
    }
  },

  setCurrentUser: (name) => {
    set({ currentUser: name });
  },

  loadBatchById: (id) => {
    const { batches } = get();
    const batch = batches.find((b) => b.id === id);
    if (batch) {
      get().setCurrentBatch(batch);
    }
  },

  getBatchIssues: (batchId) => {
    return get().issues.filter((i) => i.batchId === batchId);
  },

  getBatchCorrections: (batchId) => {
    const { issues, corrections } = get();
    const batchIssueIds = issues.filter((i) => i.batchId === batchId).map((i) => i.id);
    return corrections.filter((c) => batchIssueIds.includes(c.issueTrackId));
  },
}));
