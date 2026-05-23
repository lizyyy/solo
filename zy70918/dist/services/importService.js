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
exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const csv = require('csv-parser');
class ImportService {
    async importServiceOrdersFromCSV(filePath) {
        const results = [];
        const errors = [];
        let lineNumber = 0;
        return new Promise((resolve) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                lineNumber++;
                try {
                    const order = this.parseServiceOrder(data, lineNumber);
                    if (order)
                        results.push(order);
                }
                catch (e) {
                    errors.push(`行 ${lineNumber}: ${e.message}`);
                }
            })
                .on('end', () => {
                sults;
            });
            resolve({ success: errors.length === 0, data: results, errors, totalCount: lineNumber, validCount: results.length });
        })
            .on('error', (err) => {
            errors.push(`文件读取错误: ${err.message}`);
            resolve({ success: false, data: results, errors, totalCount: lineNumber, validCount: results.length });
        });
    }
    ;
}
exports.ImportService = ImportService;
parseServiceOrder(data, (Record), lineNumber, number);
types_1.ServiceOrder | null;
{
    const requiredFields = ['orderNo', 'elderId', 'elderName', 'nurseId', 'nurseName', 'serviceDate', 'serviceTime', 'serviceItems', 'actualDuration', 'status'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0)
        throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    const statusMap = { '已完成': 'completed', '待处理': 'pending', '已取消': 'cancelled' };
    const status = statusMap[data.status];
    if (!status)
        throw new Error(`无效的状态值: ${data.status}`);
    return {
        id: (0, uuid_1.v4)(),
        orderNo: data.orderNo,
        elderId: data.elderId,
        elderName: data.elderName,
        nurseId: data.nurseId,
        nurseName: data.nurseName,
        serviceDate: data.serviceDate,
        serviceTime: data.serviceTime,
        serviceItems: (data.serviceItems || '').split(/[,，;；]/).map((s) => s.trim()).filter(Boolean),
        actualDuration: parseInt(data.actualDuration, 10) || 0,
        status,
        cancelReason: data.cancelReason,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        signedBy: data.signedBy,
    };
}
exports.default = new ImportService();
