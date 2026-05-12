"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryManager = void 0;
const uuid_1 = require("uuid");
class HistoryManager {
    static createEntry(action, toStatus, actor = 'system', options = {}) {
        return {
            id: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            action,
            actor,
            fromStatus: options.fromStatus,
            toStatus,
            reason: options.reason,
            details: options.details
        };
    }
    static addToRecord(record, action, toStatus, actor = 'system', options = {}) {
        const entry = this.createEntry(action, toStatus, actor, {
            fromStatus: record.status,
            reason: options.reason,
            details: options.details
        });
        return {
            ...record,
            status: toStatus,
            history: [...record.history, entry]
        };
    }
    static getLastEntry(record) {
        return record.history[record.history.length - 1];
    }
    static getHistoryByActor(record, actor) {
        return record.history.filter(h => h.actor === actor);
    }
    static getStatusChanges(record) {
        return record.history
            .filter(h => h.fromStatus !== undefined && h.fromStatus !== h.toStatus)
            .map(h => ({
            from: h.fromStatus,
            to: h.toStatus,
            timestamp: h.timestamp
        }));
    }
    static formatHistory(history) {
        return history.map(entry => {
            const time = new Date(entry.timestamp).toLocaleString('zh-CN');
            const actor = entry.actor === 'system' ? '系统' : entry.actor;
            const from = entry.fromStatus ? `${entry.fromStatus} → ` : '';
            let line = `[${time}] ${actor} - ${entry.action}: ${from}${entry.toStatus}`;
            if (entry.reason) {
                line += ` (原因: ${entry.reason})`;
            }
            return line;
        });
    }
}
exports.HistoryManager = HistoryManager;
