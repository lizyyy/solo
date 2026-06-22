"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStateStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_STATE_PATH = path.join(process.cwd(), '.shield-warning-state.json');
const STATE_VERSION = 1;
class AppStateStore {
    filePath;
    inMemory; // 单进程内缓存，避免重复读文件
    constructor(filePath = DEFAULT_STATE_PATH) {
        this.filePath = filePath;
    }
    // 初始化：如果文件不存在，用给定初始数据创建
    initIfEmpty(initialInspections) {
        if (!fs.existsSync(this.filePath)) {
            const initial = {
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
    read() {
        if (this.inMemory)
            return this.inMemory;
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version !== STATE_VERSION) {
            throw new Error(`状态文件版本不匹配: expected ${STATE_VERSION}, got ${parsed.version}`);
        }
        this.inMemory = parsed;
        return parsed;
    }
    // 写入状态
    write(state) {
        state.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
        this.inMemory = state;
    }
    // 便捷更新：基于当前状态应用变更函数
    update(mutator) {
        const state = this.read();
        mutator(state);
        this.write(state);
        return state;
    }
    // 重置为初始状态（测试/演示用）
    reset(initialInspections) {
        if (fs.existsSync(this.filePath)) {
            fs.unlinkSync(this.filePath);
        }
        this.inMemory = undefined;
        return this.initIfEmpty(initialInspections);
    }
    // 记录操作日志
    log(state, operator, action, targetId, payload) {
        state.operationLog.push({
            timestamp: new Date().toISOString(),
            operator,
            action,
            targetId,
            payload,
        });
    }
    // ---------- 巡检记录便捷操作 ----------
    updateRemark(state, recordId, remark) {
        const idx = state.inspections.findIndex(r => r.id === recordId);
        if (idx === -1)
            return null;
        const oldRemark = state.inspections[idx].remark ?? '';
        state.inspections[idx] = {
            ...state.inspections[idx],
            remark,
        };
        this.log(state, 'assistant_xiaolin', 'remark_update', recordId, { oldRemark, newRemark: remark });
        return state.inspections[idx];
    }
    findInspection(state, recordId) {
        return state.inspections.find(r => r.id === recordId) ?? null;
    }
    // ---------- 异常队列 + 待确认事项 便捷操作 ----------
    // 全量替换引擎计算结果（每次重新生成预警时用）
    // 策略：保留已确认状态，合并新生成的关联记录
    replaceComputedState(state, newQueue, newConfirmations) {
        // 1. 合并 anomalyQueue：已有 ID 的保留历史状态和流转记录
        const existingQueueById = new Map(state.anomalyQueue.map(q => [q.id, q]));
        const mergedQueue = newQueue.map(q => {
            const existing = existingQueueById.get(q.id);
            if (existing && existing.status !== 'pending_confirmation') {
                // 已被项目经理处理过的，保留最终状态，只更新关联记录
                return {
                    ...existing,
                    warningDetailId: q.warningDetailId,
                    rawEquipmentIds: Array.from(new Set([...existing.rawEquipmentIds, ...q.rawEquipmentIds])),
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
                    affectedRecordIds: Array.from(new Set([...existing.affectedRecordIds, ...dc.affectedRecordIds])),
                    rawVariants: Array.from(new Set([...existing.rawVariants, ...dc.rawVariants])),
                    affectedWarningCount: dc.affectedWarningCount,
                    updatedAt: dc.updatedAt,
                };
            }
            return dc;
        });
        state.duplicateConfirmations = mergedDCs;
    }
    updateQueue(state, queueId, mutator) {
        const idx = state.anomalyQueue.findIndex(q => q.id === queueId);
        if (idx === -1)
            return false;
        state.anomalyQueue[idx] = mutator(state.anomalyQueue[idx]);
        return true;
    }
    updateDuplicateConfirmation(state, dcId, mutator) {
        const idx = state.duplicateConfirmations.findIndex(dc => dc.id === dcId);
        if (idx === -1)
            return false;
        state.duplicateConfirmations[idx] = mutator(state.duplicateConfirmations[idx]);
        return true;
    }
    findQueue(state, queueId) {
        return state.anomalyQueue.find(q => q.id === queueId) ?? null;
    }
    findDuplicateConfirmation(state, dcId) {
        return state.duplicateConfirmations.find(dc => dc.id === dcId) ?? null;
    }
    // 取得状态文件路径（用于提示用户）
    getFilePath() {
        return this.filePath;
    }
}
exports.AppStateStore = AppStateStore;
//# sourceMappingURL=state-store.js.map