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
exports.FileReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
class FileReader {
    static async readReturnOrders(filePath) {
        return this.readCsvFile(filePath, (row) => ({
            returnOrderNo: row['返厂单号'] || row['returnOrderNo'] || '',
            partCode: row['备件编码'] || row['partCode'] || '',
            partName: row['备件名称'] || row['partName'] || '',
            returnDate: row['返厂日期'] || row['returnDate'] || '',
            returnReason: row['返厂原因'] || row['returnReason'] || '',
            returnStatus: row['返厂状态'] || row['returnStatus'] || '',
            carrier: row['承运商'] || row['carrier'] || '',
            trackingNo: row['运单号'] || row['trackingNo'] || '',
            quantity: parseInt(row['数量'] || row['quantity'] || '0', 10),
        }));
    }
    static async readInventory(filePath) {
        return this.readCsvFile(filePath, (row) => ({
            partCode: row['备件编码'] || row['partCode'] || '',
            partName: row['备件名称'] || row['partName'] || '',
            warehouseLocation: row['库位'] || row['warehouseLocation'] || '',
            quantity: parseInt(row['数量'] || row['quantity'] || '0', 10),
            status: row['状态'] || row['库存状态'] || row['status'] || '',
            lastUpdateDate: row['更新日期'] || row['lastUpdateDate'] || '',
        }));
    }
    static async readInspectionResults(filePath) {
        return this.readCsvFile(filePath, (row) => ({
            returnOrderNo: row['返厂单号'] || row['returnOrderNo'] || '',
            partCode: row['备件编码'] || row['partCode'] || '',
            inspectionDate: row['检测日期'] || row['inspectionDate'] || '',
            inspectionResult: row['检测结果'] || row['inspectionResult'] || '',
            inspectionConclusion: row['检测结论'] || row['inspectionConclusion'] || '',
            inspector: row['检测人'] || row['inspector'] || '',
            repairStatus: row['维修状态'] || row['repairStatus'] || '',
        }));
    }
    static async readCsvFile(filePath, mapper) {
        const results = [];
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`文件不存在: ${absolutePath}`);
        }
        return new Promise((resolve, reject) => {
            fs.createReadStream(absolutePath, { encoding: 'utf-8' })
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                results.push(mapper(row));
            })
                .on('end', () => {
                resolve(results);
            })
                .on('error', (error) => {
                reject(new Error(`读取文件失败: ${error.message}`));
            });
        });
    }
}
exports.FileReader = FileReader;
