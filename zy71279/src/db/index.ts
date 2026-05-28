import Dexie, { Table } from 'dexie';
import type { Material, EstimationTask, ErrorAnalysis, PrintEstimation, ConstraintCheck } from '@/types';
import { generateUUID } from '@/utils/math';
import { DuplicateChecker } from '@/utils/duplicateChecker';

export class AppDatabase extends Dexie {
  materials!: Table<Material, string>;
  estimationTasks!: Table<EstimationTask, string>;
  errorAnalyses!: Table<ErrorAnalysis, string>;
  printEstimations!: Table<PrintEstimation, string>;
  constraintChecks!: Table<ConstraintCheck, string>;

  constructor() {
    super('MeshErrorEstimatorDB');

    this.version(1).stores({
      materials: 'id, code, name, type, createdAt, updatedAt',
      estimationTasks: 'id, modelName, materialId, status, createdAt, duplicateCheckHash',
      errorAnalyses: 'id, taskId',
      printEstimations: 'id, taskId',
      constraintChecks: 'id, taskId, constraintName'
    });
  }

  async addMaterial(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isDuplicateWarning'>): Promise<Material> {
    const existing = await this.materials.toArray();
    const codeCheck = DuplicateChecker.checkMaterialCodeDuplicate(material.code, existing);

    if (codeCheck.isDuplicate) {
      const existingMaterial = codeCheck.duplicates[0];
      return {
        ...existingMaterial,
        ...material,
        id: existingMaterial.id,
        updatedAt: new Date(),
        isDuplicateWarning: true
      };
    }

    const duplicateCheck = DuplicateChecker.checkMaterialDuplicate(material, existing);
    const newMaterial: Material = {
      ...material,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDuplicateWarning: duplicateCheck.isDuplicate
    };

    await this.materials.add(newMaterial);
    return newMaterial;
  }

  async updateMaterial(id: string, updates: Partial<Material>): Promise<Material | undefined> {
    const existing = await this.materials.get(id);
    if (!existing) return undefined;

    const allMaterials = await this.materials.filter(m => m.id !== id).toArray();
    if (updates.code) {
      const codeCheck = DuplicateChecker.checkMaterialCodeDuplicate(updates.code, allMaterials);
      if (codeCheck.isDuplicate) {
        updates.isDuplicateWarning = true;
      }
    }

    const updated: Material = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    await this.materials.put(updated);
    return updated;
  }

  async getAllMaterials(): Promise<Material[]> {
    const materials = await this.materials.orderBy('createdAt').reverse().toArray();
    const { merged, warnings } = DuplicateChecker.mergeDuplicateMaterials(materials);

    for (const warning of warnings) {
      console.warn(`材料编号 "${warning.code}" 存在 ${warning.count} 条重复记录，已合并`);
    }

    return merged;
  }

  async getMaterialById(id: string): Promise<Material | undefined> {
    return this.materials.get(id);
  }

  async deleteMaterial(id: string): Promise<void> {
    await this.materials.delete(id);
  }

  async addEstimationTask(
    task: Omit<EstimationTask, 'id' | 'createdAt'>,
    params: { errorThreshold: number },
    printParams: { layerHeight: number; infillRate: number }
  ): Promise<EstimationTask> {
    const existingTasks = await this.estimationTasks.toArray();
    const hash = DuplicateChecker.generateTaskHash(
      task,
      {
        algorithm: task.algorithm,
        targetFaceCount: task.simplifiedFaces,
        errorThreshold: params.errorThreshold,
        preserveBorders: false,
        preserveNormals: false
      },
      {
        layerHeight: printParams.layerHeight,
        infillRate: printParams.infillRate,
        printSpeed: 50,
        wallThickness: 1.2,
        nozzleDiameter: 0.4
      },
      task.materialId
    );

    const duplicateCheck = DuplicateChecker.checkTaskDuplicate(hash, existingTasks);

    if (duplicateCheck.isDuplicate && duplicateCheck.originalTask) {
      const duplicateTask: EstimationTask = {
        ...task,
        id: generateUUID(),
        createdAt: new Date(),
        duplicateCheckHash: hash,
        isDuplicate: true,
        status: 'duplicate',
        originalTaskId: duplicateCheck.originalTask.id,
        errorMessage: `检测到重复任务，原始任务ID: ${duplicateCheck.originalTask.id}`
      };
      await this.estimationTasks.add(duplicateTask);
      return duplicateTask;
    }

    const newTask: EstimationTask = {
      ...task,
      id: generateUUID(),
      createdAt: new Date(),
      duplicateCheckHash: hash,
      isDuplicate: false
    };

    await this.estimationTasks.add(newTask);
    return newTask;
  }

  async getTaskWithDetails(taskId: string): Promise<{
    task: EstimationTask;
    errorAnalysis?: ErrorAnalysis;
    printEstimation?: PrintEstimation;
    constraintChecks: ConstraintCheck[];
    material?: Material;
  } | undefined> {
    const task = await this.estimationTasks.get(taskId);
    if (!task) return undefined;

    const [errorAnalysis, printEstimation, constraintChecks, material] = await Promise.all([
      this.errorAnalyses.where('taskId').equals(taskId).first(),
      this.printEstimations.where('taskId').equals(taskId).first(),
      this.constraintChecks.where('taskId').equals(taskId).toArray(),
      this.materials.get(task.materialId)
    ]);

    return { task, errorAnalysis, printEstimation, constraintChecks, material };
  }

  async getEstimationTasks(filters?: {
    status?: string[];
    materialId?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<EstimationTask[]> {
    let query = this.estimationTasks.orderBy('createdAt').reverse();

    if (filters?.status && filters.status.length > 0) {
      query = query.filter(task => filters.status!.includes(task.status));
    }

    if (filters?.materialId) {
      query = query.filter(task => task.materialId === filters.materialId);
    }

    if (filters?.dateRange) {
      query = query.filter(task => {
        const date = new Date(task.createdAt);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }

    return query.toArray();
  }

  async saveErrorAnalysis(analysis: Omit<ErrorAnalysis, 'id'>): Promise<ErrorAnalysis> {
    const existing = await this.errorAnalyses.where('taskId').equals(analysis.taskId).first();
    if (existing) {
      const updated = { ...analysis, id: existing.id };
      await this.errorAnalyses.put(updated);
      return updated;
    }

    const newAnalysis: ErrorAnalysis = {
      ...analysis,
      id: generateUUID()
    };
    await this.errorAnalyses.add(newAnalysis);
    return newAnalysis;
  }

  async savePrintEstimation(estimation: Omit<PrintEstimation, 'id'>): Promise<PrintEstimation> {
    const existing = await this.printEstimations.where('taskId').equals(estimation.taskId).first();
    if (existing) {
      const updated = { ...estimation, id: existing.id };
      await this.printEstimations.put(updated);
      return updated;
    }

    const newEstimation: PrintEstimation = {
      ...estimation,
      id: generateUUID()
    };
    await this.printEstimations.add(newEstimation);
    return newEstimation;
  }

  async saveConstraintChecks(checks: Omit<ConstraintCheck, 'id'>[]): Promise<ConstraintCheck[]> {
    const taskId = checks[0]?.taskId;
    if (taskId) {
      await this.constraintChecks.where('taskId').equals(taskId).delete();
    }

    const newChecks: ConstraintCheck[] = checks.map(c => ({ ...c, id: generateUUID() }));
    await this.constraintChecks.bulkAdd(newChecks);
    return newChecks;
  }

  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    duplicates: number;
    byMaterial: { materialId: string; count: number }[];
  }> {
    const tasks = await this.estimationTasks.toArray();
    const materials = await this.materials.toArray();

    const byMaterial = materials.map(m => ({
      materialId: m.id,
      count: tasks.filter(t => t.materialId === m.id).length
    }));

    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      duplicates: tasks.filter(t => t.status === 'duplicate').length,
      byMaterial
    };
  }

  async initSampleData(): Promise<void> {
    const materialsCount = await this.materials.count();
    if (materialsCount > 0) return;

    const sampleMaterials: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isDuplicateWarning'>[] = [
      {
        code: 'PLA-001',
        name: '普通PLA',
        type: 'PLA',
        density: 1.24,
        costPerGram: 0.05,
        printSpeed: 60,
        nozzleTemp: 200,
        bedTemp: 60
      },
      {
        code: 'PLA-002',
        name: '高韧性PLA',
        type: 'PLA',
        density: 1.27,
        costPerGram: 0.08,
        printSpeed: 50,
        nozzleTemp: 210,
        bedTemp: 60
      },
      {
        code: 'ABS-001',
        name: '标准ABS',
        type: 'ABS',
        density: 1.04,
        costPerGram: 0.06,
        printSpeed: 40,
        nozzleTemp: 240,
        bedTemp: 100
      },
      {
        code: 'PETG-001',
        name: '透明PETG',
        type: 'PETG',
        density: 1.27,
        costPerGram: 0.07,
        printSpeed: 45,
        nozzleTemp: 230,
        bedTemp: 80
      },
      {
        code: 'TPU-001',
        name: '柔性TPU',
        type: 'TPU',
        density: 1.20,
        costPerGram: 0.12,
        printSpeed: 25,
        nozzleTemp: 220,
        bedTemp: 50
      }
    ];

    for (const material of sampleMaterials) {
      await this.addMaterial(material);
    }

    console.log('示例数据初始化完成');
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      this.materials.clear(),
      this.estimationTasks.clear(),
      this.errorAnalyses.clear(),
      this.printEstimations.clear(),
      this.constraintChecks.clear()
    ]);
  }

  async exportAllData(): Promise<{
    materials: Material[];
    tasks: EstimationTask[];
    analyses: ErrorAnalysis[];
    estimations: PrintEstimation[];
    checks: ConstraintCheck[];
    exportDate: Date;
  }> {
    const [materials, tasks, analyses, estimations, checks] = await Promise.all([
      this.materials.toArray(),
      this.estimationTasks.toArray(),
      this.errorAnalyses.toArray(),
      this.printEstimations.toArray(),
      this.constraintChecks.toArray()
    ]);

    return {
      materials,
      tasks,
      analyses,
      estimations,
      checks,
      exportDate: new Date()
    };
  }
}

export const db = new AppDatabase();
