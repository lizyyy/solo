"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escortService = exports.EscortService = void 0;
const uuid_1 = require("uuid");
const storage_1 = require("./storage");
const sensitiveMask_1 = require("../utils/sensitiveMask");
const logger = (0, sensitiveMask_1.createSensitiveLogger)();
class EscortService {
    createEscort(name, phone, employeeId) {
        const existingEscort = storage_1.storage.getEscorts().find(e => e.employeeId === employeeId);
        if (existingEscort) {
            throw new Error('该工号的陪检员已存在');
        }
        const escort = {
            id: (0, uuid_1.v4)(),
            name,
            phone,
            employeeId,
            status: 'available'
        };
        storage_1.storage.saveEscort(escort);
        logger.info('陪检员创建成功', { escortId: escort.id });
        return escort;
    }
    updateEscort(escortId, updates) {
        const escort = storage_1.storage.getEscortById(escortId);
        if (!escort) {
            throw new Error('陪检员不存在');
        }
        const updatedEscort = { ...escort, ...updates };
        storage_1.storage.saveEscort(updatedEscort);
        logger.info('陪检员信息已更新', { escortId });
        return updatedEscort;
    }
    getEscortById(escortId) {
        return storage_1.storage.getEscortById(escortId);
    }
    getEscortByEmployeeId(employeeId) {
        return storage_1.storage.getEscorts().find(e => e.employeeId === employeeId);
    }
    getAllEscorts() {
        return storage_1.storage.getEscorts();
    }
    getAvailableEscorts() {
        return storage_1.storage.getEscorts().filter(e => e.status === 'available');
    }
    deleteEscort(escortId) {
        const escort = storage_1.storage.getEscortById(escortId);
        if (!escort) {
            throw new Error('陪检员不存在');
        }
        if (escort.currentTaskId) {
            throw new Error('该陪检员有正在进行的任务，无法删除');
        }
        const db = storage_1.storage.load();
        db.escorts = db.escorts.filter(e => e.id !== escortId);
        storage_1.storage.save(db);
        logger.info('陪检员已删除', { escortId });
    }
}
exports.EscortService = EscortService;
exports.escortService = new EscortService();
