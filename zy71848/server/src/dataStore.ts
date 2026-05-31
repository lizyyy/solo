import type {
  InspectionRecord,
  BatchTask,
  ExportRecord,
  AppSettings,
  ConsistencyCheckResult,
  ConsistencyIssue,
} from '../../shared/types';
import { mockInspections, mockBatchTasks, mockExportRecords, defaultSettings } from '../../shared/mockData';
import { flipCoordinates, idempotentCheck, generateId, calculateContentHash } from '../../shared/utils/coordinateUtils';
import fs from 'fs';
import path from 'path';

interface DataState {
  inspections: InspectionRecord[];
  batchTasks: BatchTask[];
  exportRecords: ExportRecord[];
  settings: AppSettings;
}

const DATA_FILE = path.join(process.cwd(), 'data.json');

let state: DataState = {
  inspections: [...mockInspections],
  batchTasks: [...mockBatchTasks],
  exportRecords: [...mockExportRecords],
  settings: { ...defaultSettings },
};

function loadFromFile(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      state = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load data file, using mock data:', e);
  }
}

function saveToFile(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save data file:', e);
  }
}

loadFromFile();

export const dataStore = {
  getInspections: (): InspectionRecord[] => state.inspections,

  getInspectionById: (id: string): InspectionRecord | undefined =>
    state.inspections.find((i) => i.id === id),

  updateInspection: (inspection: InspectionRecord): void => {
    const index = state.inspections.findIndex((i) => i.id === inspection.id);
    if (index !== -1) {
      state.inspections[index] = { ...inspection, updatedAt: new Date().toISOString() };
      saveToFile();
    }
  },

  addChangeRecord: (inspectionId: string, change: Omit<import('../../shared/types').ChangeRecord, 'id' | 'inspectionId'>): void => {
    const inspection = state.inspections.find((i) => i.id === inspectionId);
    if (inspection) {
      inspection.changeHistory.push({
        ...change,
        id: generateId(),
        inspectionId,
      });
      inspection.updatedAt = new Date().toISOString();
      saveToFile();
    }
  },

  updateInspectionStatus: (id: string, status: InspectionRecord['status']): void => {
    const inspection = state.inspections.find((i) => i.id === id);
    if (inspection) {
      inspection.status = status;
      inspection.updatedAt = new Date().toISOString();
      saveToFile();
    }
  },

  performFlip: (id: string, flipType: 'x' | 'y' | 'origin'): { flipped: InspectionRecord; deviation: number } | null => {
    const inspection = state.inspections.find((i) => i.id === id);
    if (!inspection) return null;

    const { flipped, deviation } = flipCoordinates(inspection.coordinates, flipType);
    inspection.flippedCoordinates = flipped;
    inspection.flipDeviation = deviation;
    inspection.updatedAt = new Date().toISOString();

    const threshold = state.settings.flipRules.deviationThreshold;
    inspection.status = deviation > threshold ? 'exception' : inspection.status;

    inspection.changeHistory.push({
      id: generateId(),
      inspectionId: id,
      type: 'flip',
      affectsConclusion: deviation > threshold,
      description: `坐标轴${flipType === 'x' ? 'X轴' : flipType === 'y' ? 'Y轴' : '原点'}翻转，偏差${(deviation * 100).toFixed(1)}%${deviation > threshold ? '，需确认' : ''}`,
      operator: '系统',
      timestamp: new Date().toISOString(),
    });

    saveToFile();
    return { flipped: inspection, deviation };
  },

  getBatchTasks: (): BatchTask[] => state.batchTasks,

  getBatchTaskById: (id: string): BatchTask | undefined => state.batchTasks.find((t) => t.id === id),

  createBatchTask: (inspectionIds: string[], taskName: string): BatchTask => {
    const task: BatchTask = {
      id: generateId(),
      name: taskName,
      inspectionIds,
      status: 'pending',
      runCount: 0,
      totalChanges: 0,
      conclusionChanges: 0,
      materialOnlyChanges: 0,
      createdAt: new Date().toISOString(),
      runs: [],
      lastRunHashes: {},
    };
    state.batchTasks.push(task);
    saveToFile();
    return task;
  },

  runBatchTask: (taskId: string): BatchTask | null => {
    const task = state.batchTasks.find((t) => t.id === taskId);
    if (!task) return null;

    const runNumber = task.runCount + 1;
    const startTime = new Date();

    let processedCount = 0;
    let skippedCount = 0;
    let changedCount = 0;
    const changes: import('../../shared/types').BatchChange[] = [];
    const newHashes: Record<string, string> = {};

    task.inspectionIds.forEach((inspectionId) => {
      const inspection = state.inspections.find((i) => i.id === inspectionId);
      if (!inspection) return;

      processedCount++;
      const lastHash = task.lastRunHashes?.[inspectionId];
      const { shouldProcess, currentHash } = idempotentCheck(
        { coordinates: inspection.coordinates, name: inspection.name, status: inspection.status },
        lastHash
      );
      newHashes[inspectionId] = currentHash;

      if (!shouldProcess) {
        skippedCount++;
        return;
      }

      if (inspection.changeHistory.length > 0) {
        const lastChange = inspection.changeHistory[inspection.changeHistory.length - 1];
        if (!lastChange.batchRunId) {
          changedCount++;
          changes.push({
            inspectionId,
            changeType: lastChange.type,
            affectsConclusion: lastChange.affectsConclusion,
            description: lastChange.description,
          });

          if (lastChange.affectsConclusion) {
            task.conclusionChanges++;
          } else {
            task.materialOnlyChanges++;
          }

          lastChange.batchRunId = `br${taskId}-${runNumber}`;
        }
      }
    });

    const run: import('../../shared/types').BatchRun = {
      id: generateId(),
      taskId,
      runNumber,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      processedCount,
      skippedCount,
      changedCount,
      idempotentCheckPassed: true,
      changes,
    };

    task.runs.push(run);
    task.runCount = runNumber;
    task.totalChanges += changedCount;
    task.lastRunHashes = newHashes;
    task.status = 'completed';

    saveToFile();
    return task;
  },

  getExportRecords: (): ExportRecord[] => state.exportRecords,

  performConsistencyCheck: (inspectionIds: string[]): ConsistencyCheckResult => {
    const issues: ConsistencyIssue[] = [];

    inspectionIds.forEach((id) => {
      const inspection = state.inspections.find((i) => i.id === id);
      if (!inspection) {
        issues.push({
          inspectionId: id,
          field: 'existence',
          message: '检查记录不存在',
          severity: 'error',
        });
        return;
      }

      if (inspection.coordinates.points.length === 0) {
        issues.push({
          inspectionId: id,
          field: 'coordinates',
          message: '坐标数据为空',
          severity: 'error',
        });
      }

      if (inspection.status === 'exception' && inspection.changeHistory.filter((c) => c.type === 'flip').length === 0) {
        issues.push({
          inspectionId: id,
          field: 'status',
          message: '异常状态但无翻转记录，请确认',
          severity: 'warning',
        });
      }

      if (inspection.changeHistory.length === 0) {
        issues.push({
          inspectionId: id,
          field: 'changeHistory',
          message: '无变更历史记录',
          severity: 'warning',
        });
      }

      const conclusionChanges = inspection.changeHistory.filter((c) => c.affectsConclusion);
      if (conclusionChanges.length > 0 && inspection.status === 'approved') {
        issues.push({
          inspectionId: id,
          field: 'status',
          message: `存在${conclusionChanges.length}条影响结论的变更，但状态为已通过`,
          severity: 'warning',
        });
      }
    });

    return {
      passed: issues.filter((i) => i.severity === 'error').length === 0,
      totalItems: inspectionIds.length,
      issues,
    };
  },

  createExport: (inspectionIds: string[], template: 'standard' | 'detailed', performCheck: boolean): ExportRecord | null => {
    let consistencyCheck: ConsistencyCheckResult = {
      passed: true,
      totalItems: inspectionIds.length,
      issues: [],
    };

    if (performCheck) {
      consistencyCheck = this.performConsistencyCheck(inspectionIds);
    }

    const record: ExportRecord = {
      id: generateId(),
      inspectionIds,
      template,
      consistencyCheck,
      exportedAt: new Date().toISOString(),
      exportedBy: '当前用户',
      fileHash: calculateContentHash({ inspectionIds, template, timestamp: Date.now() }),
    };

    state.exportRecords.unshift(record);

    inspectionIds.forEach((id) => {
      this.addChangeRecord(id, {
        type: 'export',
        affectsConclusion: false,
        description: `导出巡检单（${template === 'standard' ? '标准' : '详细'}模板）`,
        operator: '当前用户',
        timestamp: new Date().toISOString(),
      });
    });

    saveToFile();
    return record;
  },

  generateExportContent: (exportId: string): string => {
    const record = state.exportRecords.find((r) => r.id === exportId);
    if (!record) return '';

    const inspections = record.inspectionIds
      .map((id) => state.inspections.find((i) => i.id === id))
      .filter(Boolean) as InspectionRecord[];

    if (record.template === 'standard') {
      return this.generateStandardTemplate(inspections, record);
    } else {
      return this.generateDetailedTemplate(inspections, record);
    }
  },

  generateStandardTemplate: (inspections: InspectionRecord[], record: ExportRecord): string => {
    const lines: string[] = [];
    lines.push('=== 停车楼坡道巡检单（标准模板）===');
    lines.push(`导出时间：${new Date(record.exportedAt).toLocaleString('zh-CN')}`);
    lines.push(`导出人：${record.exportedBy}`);
    lines.push(`文件哈希：${record.fileHash}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('');

    inspections.forEach((inspection, idx) => {
      lines.push(`${idx + 1}. ${inspection.name}`);
      lines.push(`   坡道编号：${inspection.rampNumber}`);
      lines.push(`   状态：${this.getStatusLabel(inspection.status)}`);
      lines.push(`   点位数：${inspection.coordinates.points.length}`);
      lines.push(`   变更次数：${inspection.changeHistory.length}`);
      lines.push(`   创建时间：${new Date(inspection.createdAt).toLocaleDateString('zh-CN')}`);
      lines.push('');
    });

    if (record.consistencyCheck.issues.length > 0) {
      lines.push('----------------------------------------');
      lines.push('一致性校验问题：');
      record.consistencyCheck.issues.forEach((issue) => {
        lines.push(`  [${issue.severity === 'error' ? '错误' : '警告'}] ${issue.message}`);
      });
    }

    return lines.join('\n');
  },

  generateDetailedTemplate: (inspections: InspectionRecord[], record: ExportRecord): string => {
    const lines: string[] = [];
    lines.push('=== 停车楼坡道巡检单（详细模板）===');
    lines.push(`导出时间：${new Date(record.exportedAt).toLocaleString('zh-CN')}`);
    lines.push(`导出人：${record.exportedBy}`);
    lines.push(`文件哈希：${record.fileHash}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('');

    inspections.forEach((inspection, idx) => {
      lines.push(`${idx + 1}. ${inspection.name}`);
      lines.push(`   坡道编号：${inspection.rampNumber}`);
      lines.push(`   停车楼：${inspection.parkingLot}`);
      lines.push(`   状态：${this.getStatusLabel(inspection.status)}`);
      lines.push(`   创建人：${inspection.createdBy}`);
      lines.push(`   创建时间：${new Date(inspection.createdAt).toLocaleString('zh-CN')}`);
      lines.push(`   更新时间：${new Date(inspection.updatedAt).toLocaleString('zh-CN')}`);
      lines.push('');
      lines.push('   坐标点位：');
      inspection.coordinates.points.forEach((p) => {
        lines.push(`     - ${p.label} (${p.x}, ${p.y}) [${p.type}]`);
      });
      if (inspection.flipDeviation !== undefined) {
        lines.push('');
        lines.push(`   翻转偏差：${(inspection.flipDeviation * 100).toFixed(1)}%`);
      }
      lines.push('');
      lines.push('   变更历史：');
      inspection.changeHistory.forEach((change) => {
        const affectsLabel = change.affectsConclusion ? '[影响结论]' : '[仅补材料]';
        lines.push(`     - ${new Date(change.timestamp).toLocaleString('zh-CN')} ${this.getChangeTypeLabel(change.type)} ${affectsLabel}`);
        lines.push(`       ${change.description} (操作人：${change.operator})`);
      });
      lines.push('');
      lines.push('----------------------------------------');
      lines.push('');
    });

    return lines.join('\n');
  },

  getStatusLabel: (status: string): string => {
    const labels: Record<string, string> = {
      pending: '待确认',
      approved: '已通过',
      exception: '有异常',
      material_only: '仅补材料',
    };
    return labels[status] || status;
  },

  getChangeTypeLabel: (type: string): string => {
    const labels: Record<string, string> = {
      route_early: '讲解路线早到',
      note_late: '设备备注晚补',
      cad_manual: 'CAD点位改动',
      flip: '坐标轴翻转',
      export: '导出记录',
    };
    return labels[type] || type;
  },

  getSettings: (): AppSettings => state.settings,

  updateSettings: (settings: Partial<AppSettings>): AppSettings => {
    state.settings = { ...state.settings, ...settings };
    saveToFile();
    return state.settings;
  },
};
