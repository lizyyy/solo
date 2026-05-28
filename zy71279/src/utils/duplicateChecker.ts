import type { EstimationTask, EstimationParams, PrintParams, Material } from '@/types';
import { generateUUID } from './math';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalTask?: EstimationTask;
  similarity: number;
  matchingFields: string[];
}

export class DuplicateChecker {
  private static HASH_PRECISION = 4;

  static generateTaskHash(
    task: Partial<EstimationTask>,
    params: EstimationParams,
    printParams: PrintParams,
    materialId: string
  ): string {
    const hashComponents = [
      task.modelName || '',
      task.originalFaces?.toString() || '',
      params.algorithm,
      params.targetFaceCount.toString(),
      this.roundToPrecision(params.errorThreshold),
      this.roundToPrecision(printParams.layerHeight),
      this.roundToPrecision(printParams.infillRate),
      materialId,
      this.roundToPrecision(params.preserveBorders ? 1 : 0),
      this.roundToPrecision(params.preserveNormals ? 1 : 0)
    ];

    return this.simpleHash(hashComponents.join('|'));
  }

  static generateMaterialHash(material: Partial<Material>): string {
    const hashComponents = [
      material.code?.trim().toLowerCase() || '',
      material.name?.trim().toLowerCase() || '',
      material.type?.trim().toLowerCase() || '',
      this.roundToPrecision(material.density || 0),
      this.roundToPrecision(material.costPerGram || 0),
      this.roundToPrecision(material.printSpeed || 0),
      this.roundToPrecision(material.nozzleTemp || 0),
      this.roundToPrecision(material.bedTemp || 0)
    ];

    return this.simpleHash(hashComponents.join('|'));
  }

  static checkTaskDuplicate(
    hash: string,
    existingTasks: EstimationTask[]
  ): DuplicateCheckResult {
    for (const task of existingTasks) {
      if (task.duplicateCheckHash === hash && task.status !== 'duplicate') {
        return {
          isDuplicate: true,
          originalTask: task,
          similarity: 1.0,
          matchingFields: ['完整参数匹配']
        };
      }
    }

    return {
      isDuplicate: false,
      similarity: 0,
      matchingFields: []
    };
  }

  static checkMaterialCodeDuplicate(
    code: string,
    existingMaterials: Material[],
    excludeId?: string
  ): { isDuplicate: boolean; duplicates: Material[] } {
    const normalizedCode = code.trim().toLowerCase();
    const duplicates = existingMaterials.filter(m => {
      if (excludeId && m.id === excludeId) return false;
      return m.code.trim().toLowerCase() === normalizedCode;
    });

    return {
      isDuplicate: duplicates.length > 0,
      duplicates
    };
  }

  static checkMaterialDuplicate(
    material: Partial<Material>,
    existingMaterials: Material[],
    excludeId?: string
  ): DuplicateCheckResult {
    const hash = this.generateMaterialHash(material);

    for (const m of existingMaterials) {
      if (excludeId && m.id === excludeId) continue;

      const matchingFields: string[] = [];
      let matchCount = 0;
      const totalFields = 8;

      if (material.code && m.code.toLowerCase() === material.code.toLowerCase()) {
        matchingFields.push('材料编号');
        matchCount++;
      }
      if (material.name && m.name.toLowerCase() === material.name.toLowerCase()) {
        matchingFields.push('材料名称');
        matchCount++;
      }
      if (material.type && m.type.toLowerCase() === material.type.toLowerCase()) {
        matchingFields.push('材料类型');
        matchCount++;
      }
      if (material.density !== undefined && Math.abs(m.density - material.density) < 0.001) {
        matchingFields.push('密度');
        matchCount++;
      }
      if (material.costPerGram !== undefined && Math.abs(m.costPerGram - material.costPerGram) < 0.001) {
        matchingFields.push('成本');
        matchCount++;
      }
      if (material.printSpeed !== undefined && Math.abs(m.printSpeed - material.printSpeed) < 0.1) {
        matchingFields.push('打印速度');
        matchCount++;
      }
      if (material.nozzleTemp !== undefined && Math.abs(m.nozzleTemp - material.nozzleTemp) < 1) {
        matchingFields.push('喷嘴温度');
        matchCount++;
      }
      if (material.bedTemp !== undefined && Math.abs(m.bedTemp - material.bedTemp) < 1) {
        matchingFields.push('热床温度');
        matchCount++;
      }

      const similarity = matchCount / totalFields;
      if (similarity >= 0.9) {
        return {
          isDuplicate: true,
          originalTask: undefined,
          similarity,
          matchingFields
        };
      }
    }

    return {
      isDuplicate: false,
      similarity: 0,
      matchingFields: []
    };
  }

  static markDuplicateTask(
    duplicateTask: EstimationTask,
    originalTaskId: string
  ): EstimationTask {
    return {
      ...duplicateTask,
      id: duplicateTask.id || generateUUID(),
      status: 'duplicate',
      isDuplicate: true,
      originalTaskId,
      errorMessage: `检测到重复任务，原始任务ID: ${originalTaskId}`,
      createdAt: duplicateTask.createdAt || new Date()
    };
  }

  static mergeDuplicateMaterials(
    materials: Material[]
  ): { merged: Material[]; warnings: { code: string; count: number }[] } {
    const codeGroups = new Map<string, Material[]>();

    for (const m of materials) {
      const code = m.code.trim().toLowerCase();
      if (!codeGroups.has(code)) {
        codeGroups.set(code, []);
      }
      codeGroups.get(code)!.push(m);
    }

    const merged: Material[] = [];
    const warnings: { code: string; count: number }[] = [];

    for (const [code, group] of codeGroups) {
      if (group.length > 1) {
        warnings.push({ code, count: group.length });

        const latest = group.reduce((prev, curr) =>
          new Date(curr.updatedAt) > new Date(prev.updatedAt) ? curr : prev
        );

        merged.push({
          ...latest,
          isDuplicateWarning: true
        });
      } else {
        merged.push({
          ...group[0],
          isDuplicateWarning: false
        });
      }
    }

    return { merged, warnings };
  }

  private static roundToPrecision(value: number): string {
    return value.toFixed(this.HASH_PRECISION);
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  static findSimilarTasks(
    targetTask: EstimationTask,
    allTasks: EstimationTask[],
    threshold: number = 0.7
  ): { task: EstimationTask; similarity: number; matchingFields: string[] }[] {
    const results: { task: EstimationTask; similarity: number; matchingFields: string[] }[] = [];

    for (const task of allTasks) {
      if (task.id === targetTask.id) continue;

      const matchingFields: string[] = [];
      let score = 0;
      let maxScore = 0;

      if (targetTask.modelName && task.modelName) {
        maxScore++;
        if (targetTask.modelName === task.modelName) {
          score++;
          matchingFields.push('模型名称');
        }
      }

      maxScore++;
      if (targetTask.originalFaces === task.originalFaces) {
        score++;
        matchingFields.push('原始面数');
      }

      maxScore++;
      if (targetTask.algorithm === task.algorithm) {
        score++;
        matchingFields.push('简化算法');
      }

      maxScore++;
      if (Math.abs(targetTask.simplificationRatio - task.simplificationRatio) < 0.01) {
        score++;
        matchingFields.push('简化比例');
      }

      maxScore++;
      if (Math.abs(targetTask.errorThreshold - task.errorThreshold) < 0.001) {
        score++;
        matchingFields.push('误差阈值');
      }

      maxScore++;
      if (targetTask.materialId === task.materialId) {
        score++;
        matchingFields.push('材料');
      }

      const similarity = maxScore > 0 ? score / maxScore : 0;
      if (similarity >= threshold) {
        results.push({ task, similarity, matchingFields });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }
}

export function getDuplicateWarningMessage(count: number, code?: string): string {
  if (code) {
    return `检测到 ${count} 条编号为 "${code}" 的重复材料记录，已自动合并保留最新版本`;
  }
  return `检测到 ${count} 条重复记录`;
}
