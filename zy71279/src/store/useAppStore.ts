import { create } from 'zustand';
import type {
  MeshData,
  EstimationParams,
  PrintParams,
  Material,
  EstimationTask,
  ErrorAnalysis,
  PrintEstimation,
  ConstraintCheck,
  ViewMode,
  DetailedError
} from '@/types';
import { SimplificationAlgorithm } from '@/types';
import { db } from '@/db';
import { ErrorEstimator, simulateMeshSimplification } from '@/utils/errorEstimator';
import { TopologyChecker } from '@/utils/topologyChecker';
import { ConstraintFilter, defaultConstraints } from '@/utils/constraintFilter';
import { PrintTimeEstimator } from '@/utils/printEstimator';
import { generateUUID } from '@/utils/math';

interface AppState {
  currentMesh: MeshData | null;
  simplifiedMesh: MeshData | null;
  currentParams: EstimationParams;
  currentPrintParams: PrintParams;
  selectedMaterial: Material | null;
  materials: Material[];
  estimationTasks: EstimationTask[];
  currentTaskId: string | null;
  errorAnalysis: ErrorAnalysis | null;
  printEstimation: PrintEstimation | null;
  constraintChecks: ConstraintCheck[];
  qualityErrors: DetailedError[];
  isCalculating: boolean;
  viewMode: ViewMode;
  showErrorOverlay: boolean;
  progress: number;
  errorMessage: string | null;

  setMesh: (mesh: MeshData | null) => void;
  setParams: (params: Partial<EstimationParams>) => void;
  setPrintParams: (params: Partial<PrintParams>) => void;
  setSelectedMaterial: (material: Material | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setShowErrorOverlay: (show: boolean) => void;
  loadMaterials: () => Promise<void>;
  addMaterial: (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isDuplicateWarning'>) => Promise<Material>;
  updateMaterial: (id: string, updates: Partial<Material>) => Promise<Material | undefined>;
  deleteMaterial: (id: string) => Promise<void>;
  runEstimation: () => Promise<void>;
  loadTaskHistory: (filters?: { status?: string[]; materialId?: string }) => Promise<void>;
  loadTaskDetails: (taskId: string) => Promise<void>;
  clearCurrent: () => void;
  initSampleData: () => Promise<void>;
  exportReport: (taskId: string, format: 'pdf' | 'xlsx' | 'json') => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentMesh: null,
  simplifiedMesh: null,
  currentParams: {
    algorithm: SimplificationAlgorithm.QUADRIC_EDGE_COLLAPSE,
    targetFaceCount: 10000,
    errorThreshold: 0.1,
    preserveBorders: true,
    preserveNormals: true
  },
  currentPrintParams: {
    layerHeight: 0.2,
    infillRate: 20,
    printSpeed: 50,
    wallThickness: 1.2,
    nozzleDiameter: 0.4
  },
  selectedMaterial: null,
  materials: [],
  estimationTasks: [],
  currentTaskId: null,
  errorAnalysis: null,
  printEstimation: null,
  constraintChecks: [],
  qualityErrors: [],
  isCalculating: false,
  viewMode: 'solid',
  showErrorOverlay: true,
  progress: 0,
  errorMessage: null,

  setMesh: (mesh) => set({ currentMesh: mesh }),

  setParams: (params) => set(state => ({
    currentParams: { ...state.currentParams, ...params }
  })),

  setPrintParams: (params) => set(state => ({
    currentPrintParams: { ...state.currentPrintParams, ...params }
  })),

  setSelectedMaterial: (material) => set({ selectedMaterial: material }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setShowErrorOverlay: (show) => set({ showErrorOverlay: show }),

  loadMaterials: async () => {
    const materials = await db.getAllMaterials();
    set({ materials });
    if (materials.length > 0 && !get().selectedMaterial) {
      set({ selectedMaterial: materials[0] });
    }
  },

  addMaterial: async (material) => {
    const newMaterial = await db.addMaterial(material);
    await get().loadMaterials();
    return newMaterial;
  },

  updateMaterial: async (id, updates) => {
    const updated = await db.updateMaterial(id, updates);
    await get().loadMaterials();
    return updated;
  },

  deleteMaterial: async (id) => {
    await db.deleteMaterial(id);
    await get().loadMaterials();
  },

  runEstimation: async () => {
    const state = get();
    if (!state.currentMesh || !state.selectedMaterial) {
      set({ errorMessage: '请先上传模型并选择材料' });
      return;
    }

    set({ isCalculating: true, progress: 0, errorMessage: null, qualityErrors: [] });

    try {
      set({ progress: 10 });

      const originalMesh = state.currentMesh;
      const topologyChecker = new TopologyChecker(originalMesh);
      const qualityResult = topologyChecker.checkAll();

      set({
        qualityErrors: qualityResult.errors,
        progress: 30
      });

      const simplifiedMesh = simulateMeshSimplification(
        originalMesh,
        state.currentParams.targetFaceCount,
        state.currentParams.algorithm
      );
      set({ simplifiedMesh, progress: 50 });

      const errorEstimator = new ErrorEstimator(originalMesh, simplifiedMesh);
      const scaleValidation = errorEstimator.validateErrorScale(state.currentParams.errorThreshold);

      if (!scaleValidation.valid) {
        set(state => ({
          qualityErrors: [...state.qualityErrors, ...scaleValidation.errors]
        }));
      }

      const errorAnalysis = errorEstimator.generateAnalysis('temp');
      errorAnalysis.hasNormalFlip = qualityResult.hasNormalFlip;
      errorAnalysis.normalFlipCount = qualityResult.normalFlipFaces.length;
      errorAnalysis.hasHoles = qualityResult.hasHoles;
      errorAnalysis.holeCount = qualityResult.holeBoundaries.length;
      errorAnalysis.qualityResult = qualityResult;

      set({ errorAnalysis, progress: 70 });

      const printEstimator = new PrintTimeEstimator();
      const printEstimation = printEstimator.estimate(
        errorAnalysis.volume,
        errorAnalysis.surfaceArea,
        state.currentPrintParams,
        state.selectedMaterial,
        'temp'
      );

      set({ printEstimation, progress: 85 });

      const constraintFilter = new ConstraintFilter(defaultConstraints);
      const customThresholds = new Map<string, number>();
      customThresholds.set('最大误差阈值', state.currentParams.errorThreshold);

      const { checks, allErrors } = constraintFilter.validateWithErrors(
        errorAnalysis,
        printEstimation,
        [...qualityResult.errors, ...scaleValidation.errors],
        customThresholds
      );

      set({ constraintChecks: checks, qualityErrors: allErrors, progress: 95 });

      const task: Omit<EstimationTask, 'id' | 'createdAt'> = {
        modelName: originalMesh.name,
        originalFaces: originalMesh.faceCount,
        simplifiedFaces: simplifiedMesh.faceCount,
        simplificationRatio: simplifiedMesh.faceCount / originalMesh.faceCount,
        algorithm: state.currentParams.algorithm,
        errorThreshold: state.currentParams.errorThreshold,
        layerHeight: state.currentPrintParams.layerHeight,
        infillRate: state.currentPrintParams.infillRate,
        materialId: state.selectedMaterial.id,
        status: scaleValidation.valid && qualityResult.errors.filter(e => e.severity === 'error').length === 0 ? 'completed' : 'failed',
        errorMessage: allErrors.filter(e => e.severity === 'error').map(e => e.message).join('; '),
        duplicateCheckHash: '',
        isDuplicate: false
      };

      const savedTask = await db.addEstimationTask(
        task,
        { errorThreshold: state.currentParams.errorThreshold },
        { layerHeight: state.currentPrintParams.layerHeight, infillRate: state.currentPrintParams.infillRate }
      );

      if (savedTask.status === 'duplicate') {
        set({
          errorMessage: `检测到重复任务，原始任务ID: ${savedTask.originalTaskId}`,
          isCalculating: false,
          progress: 100
        });
        return;
      }

      errorAnalysis.taskId = savedTask.id;
      printEstimation.taskId = savedTask.id;
      checks.forEach(c => c.taskId = savedTask.id);

      await Promise.all([
        db.saveErrorAnalysis(errorAnalysis),
        db.savePrintEstimation(printEstimation),
        db.saveConstraintChecks(checks)
      ]);

      set({
        currentTaskId: savedTask.id,
        progress: 100,
        isCalculating: false
      });

      await get().loadTaskHistory();

    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : '计算过程中发生错误',
        isCalculating: false,
        progress: 0
      });
    }
  },

  loadTaskHistory: async (filters) => {
    const tasks = await db.getEstimationTasks(filters);
    set({ estimationTasks: tasks });
  },

  loadTaskDetails: async (taskId) => {
    const details = await db.getTaskWithDetails(taskId);
    if (details) {
      set({
        currentTaskId: taskId,
        errorAnalysis: details.errorAnalysis || null,
        printEstimation: details.printEstimation || null,
        constraintChecks: details.constraintChecks,
        qualityErrors: details.errorAnalysis?.qualityResult.errors || []
      });

      if (details.material) {
        set({ selectedMaterial: details.material });
      }
    }
  },

  clearCurrent: () => set({
    currentMesh: null,
    simplifiedMesh: null,
    currentTaskId: null,
    errorAnalysis: null,
    printEstimation: null,
    constraintChecks: [],
    qualityErrors: [],
    errorMessage: null,
    progress: 0
  }),

  initSampleData: async () => {
    await db.initSampleData();
    await get().loadMaterials();
  },

  exportReport: async (taskId, format) => {
    // 报告导出在ReportExporter组件中处理
  }
}));
