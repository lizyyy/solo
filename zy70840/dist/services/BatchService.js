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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Batch_1 = __importStar(require("../models/Batch"));
const dayjs_1 = __importDefault(require("dayjs"));
class BatchService {
    async createBatch(name, importedBy, remark) {
        const batchNo = `BATCH${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}`;
        const batch = await Batch_1.default.create({
            batchNo,
            name,
            status: Batch_1.BatchStatus.PENDING,
            importedBy,
            importedAt: new Date(),
            remark,
        });
        return batch;
    }
    async getBatchById(id) {
        return await Batch_1.default.findByPk(id);
    }
    async getBatchByNo(batchNo) {
        return await Batch_1.default.findOne({ where: { batchNo } });
    }
    async listBatches(page = 1, pageSize = 20, status) {
        const where = {};
        if (status) {
            where.status = status;
        }
        const { count, rows } = await Batch_1.default.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });
        return { total: count, list: rows, page, pageSize };
    }
    async updateBatchStatus(id, status, successCount, failCount) {
        const batch = await Batch_1.default.findByPk(id);
        if (!batch) {
            throw new Error('批次不存在');
        }
        const updateData = { status };
        if (successCount !== undefined) {
            updateData.successCount = successCount;
        }
        if (failCount !== undefined) {
            updateData.failCount = failCount;
        }
        await batch.update(updateData);
        return batch;
    }
    async incrementCounts(id, successIncrement = 0, failIncrement = 0) {
        const batch = await Batch_1.default.findByPk(id);
        if (!batch) {
            throw new Error('批次不存在');
        }
        await batch.update({
            successCount: batch.successCount + successIncrement,
            failCount: batch.failCount + failIncrement,
            totalCount: batch.totalCount + successIncrement + failIncrement,
        });
    }
}
exports.default = new BatchService();
