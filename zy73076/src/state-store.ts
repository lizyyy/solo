import * as fs from 'fs';
import * as path from 'path';
import { InspectionRecord, AnomalyQueueItem, DuplicateIdConfirmation } from './types';

// ============================================================
// 本地 JSON 持久化层
// 保证 remark / confirm / queue / changes 等独立命令读到同一份状态
//
// 状态文件结构:
// {
//   version: 1,
//   inspections: InspectionRecord[],            // 巡检记录（含 remark 更新）
//   anomalyQueue: AnomalyQueueItem[],           // 异常队列（含状态流转）
//   duplicateConfirmations: DuplicateIdConfirmation[], // 设备编号重复待确认事项
//   operationLog: OperationLogEntry[],
//   updatedAt: string
// }
// ============================================================

export interface OperationLogEntry {
  timestamp: string;
  operator: 'assistant_xiaolin' | 'project_manager' | 'developer' | 'system';
  action: string;           // 'remark_update' | 'queue_confirm' | 'queue_resolve' | 'dc_confirm' 等
  targetId: string;         // 记录ID / 队列ID / 待确认事项ID
  payload?: Record<string, unknown>;
}

export interface AppState {
  version: number;
  inspections: InspectionRecord[];
  anomalyQueue: AnomalyQueueItem[];
  duplicateConfirmations: DuplicateIdConfirmation[];
  operationLog: OperationLogEntry[];
  updatedAt: string;
}

const DEFAULT_STATE_PATH = path.join(process.cwd(), '.shield-warning-state.json');
const STATE_VERSION = 1;

export class AppStateStore {
  private filePath: string;
  private inMemory?: AppState; // 单进程内缓存，避免重复读文件

  constructor(filePath: string = DEFAULT_STATE_PATH) {
    this.filePath = filePath;
  }

  // 初始化：如果文件不存在，用给定初始数据创建
  initIfEmpty(initialInspections: InspectionRecord[]): AppState {
    if (!fs.existsSync(this.filePath)) {
      const initial: AppState = {
        version: STATE_VERSION,
        inspections: initialInspections,
        anomalyQueue: [],
        duplicateConfirmations: [],
        operationLog: [],
        updatedAt: new Date().toISOString(),
      };
      this.write(initial);
      return initial;
    }
    return this.read();
  }

  // 读取状态
  read(): AppState {
    if (this.inMemory) return this.inMemory;
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== STATE_VERSION) {
      throw new Error(
        `状态文件版本不匹配: expected ${STATE_VERSION}, got ${parsed.version}`
      );
    }
    this.inMemory = parsed;
    return parsed;
  }

  // 写入状态
  write(state: AppState): void {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    this.inMemory = state;
  }

  // 便捷更新：基于当前状态应用变更函数
  update(mutator: (state: AppState) => void): AppState {
    const state = this.read();
    mutator(state);
    this.write(state);
    return state;
  }

  // 重置为初始状态（测试/演示用）
  reset(initialInspections: InspectionRecord[]): AppState {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    this.inMemory = undefined;
    return this.initIfEmpty(initialInspections);
  }

  // 记录操作日志
  log(
    state: AppState,
    operator: OperationLogEntry['operator'],
    action: string,
    targetId: string,
    payload?: Record<string, unknown>
  ): void {
    state.operationLog.push({
      timestamp: new Date().toISOString(),
      operator,
      action,
      targetId,
      payload,
    });
  }

  // ---------- 巡检记录便捷操作 ----------

  updateRemark(state: AppState, recordId: string, remark: string): InspectionRecord | null {
    const idx = state.inspections.findIndex(r => r.id === recordId);
    if (idx === -1) return null;
    const oldRemark = state.inspections[idx].remark ?? '';
    state.inspections[idx] = {
      ...state.inspections[idx],
      remark,
    };
    this.log(
      state,
      'assistant_xiaolin',
      'remark_update',
      recordId,
      { oldRemark, newRemark: remark }
    );
    return state.inspections[idx];
  }

  findInspection(state: AppState, recordId: string): InspectionRecord | null {
    return state.inspections.find(r => r.id === recordId) ?? null;
  }

  // ---------- 异常队列 + 待确认事项 便捷操作 ----------

  // 全量替换引擎计算结果（每次重新生成预警时用）
  // 策略：保留已确认状态，合并新生成的关联记录
  replaceComputedState(
    state: AppState,
    newQueue: AnomalyQueueItem[],
    newConfirmations: DuplicateIdConfirmation[]
  ): void {
    // 1. 合并 anomalyQueue：已有 ID 的保留历史状态和流转记录
    const existingQueueById = new Map(state.anomalyQueue.map(q => [q.id, q]));
    const mergedQueue = newQueue.map(q => {
      const existing = existingQueueById.get(q.id);
      if (existing && existing.status !== 'pending_confirmation') {
        // 已被项目经理处理过的，保留最终状态，只更新关联记录
        return {
          ...existing,
          warningDetailId: q.warningDetailId,
          rawEquipmentIds: Array.from(
            new Set([...existing.rawEquipmentIds, ...q.rawEquipmentIds])
          ),
          updatedAt: q.updatedAt,
        };
      }
      return q;
    });
    state.anomalyQueue = mergedQueue;

    // 2. 合并 duplicateConfirmations：已有 ID 的保留历史状态和流转记录
    const existingDCById = new Map(state.duplicateConfirmations.map(dc => [dc.id, dc]));
    const mergedDCs = newConfirmations.map(dc => {
      const existing = existingDCById.get(dc.id);
      if (existing && existing.status !== 'pending') {
        // 已被项目经理处理过的，保留最终状态，只更新关联记录
        return {
          ...existing,
          affectedRecordIds: Array.from(
            new Set([...existing.affectedRecordIds, ...dc.affectedRecordIds])
          ),
          rawVariants: Array.from(
            new Set([...existing.rawVariants, ...dc.rawVariants])
          ),
          affectedWarningCount: dc.affectedWarningCount,
          updatedAt: dc.updatedAt,
        };
      }
      return dc;
    });
    state.duplicateConfirmations = mergedDCs;
  }

  updateQueue(state: AppState, queueId: string, mutator: (q: AnomalyQueueItem) => AnomalyQueueItem): boolean {
    const idx = state.anomalyQueue.findIndex(q => q.id === queueId);
    if (idx === -1) return false;
    state.anomalyQueue[idx] = mutator(state.anomalyQueue[idx]);
    return true;
  }

  updateDuplicateConfirmation(
    state: AppState,
    dcId: string,
    mutator: (dc: DuplicateIdConfirmation) => DuplicateIdConfirmation
  ): boolean {
    const idx = state.duplicateConfirmations.findIndex(dc => dc.id === dcId);
    if (idx === -1) return false;
    state.duplicateConfirmations[idx] = mutator(state.duplicateConfirmations[idx]);
    return true;
  }

  findQueue(state: AppState, queueId: string): AnomalyQueueItem | null {
    return state.anomalyQueue.find(q => q.id === queueId) ?? null;
  }

  findDuplicateConfirmation(state: AppState, dcId: string): DuplicateIdConfirmation | null {
    return state.duplicateConfirmations.find(dc => dc.id === dcId) ?? null;
  }

  // 取得状态文件路径（用于提示用户）
  getFilePath(): string {
    return this.filePath;
  }
}
