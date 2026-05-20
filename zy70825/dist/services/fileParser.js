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
exports.FileParserService = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const uuid_1 = require("uuid");
class FileParserService {
    async parseShipmentCSV(filePath, batchId) {
        const results = [];
        const now = new Date().toISOString();
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                const item = {
                    id: (0, uuid_1.v4)(),
                    batchId,
                    sampleId: data.sampleId || data['样品ID'] || '',
                    sampleName: data.sampleName || data['样品名称'] || '',
                    sampleBrand: data.sampleBrand || data['品牌'] || '',
                    sampleValue: parseFloat(data.sampleValue || data['样品价值'] || '0'),
                    influencerId: data.influencerId || data['达人ID'] || '',
                    influencerName: data.influencerName || data['达人姓名'] || '',
                    shipDate: data.shipDate || data['寄送日期'] || '',
                    expectedReturnDate: data.expectedReturnDate || data['预计归还日期'] || '',
                    actualReturnDate: data.actualReturnDate || data['实际归还日期'] || undefined,
                    status: this.parseStatus(data.status || data['状态'] || 'shipped'),
                    returnPhotos: data.returnPhotos ? data.returnPhotos.split(',') : undefined,
                    damageDescription: data.damageDescription || data['损坏描述'] || undefined,
                    createdAt: now,
                    updatedAt: now
                };
                results.push(item);
            })
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    }
    async parseInfluencerJSON(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const influencers = JSON.parse(content);
        const map = new Map();
        influencers.forEach(inf => {
            map.set(inf.id, inf);
        });
        return map;
    }
    parseStatus(status) {
        const statusMap = {
            'shipped': 'shipped',
            '已寄送': 'shipped',
            'returned': 'returned',
            '已归还': 'returned',
            'damaged': 'damaged',
            '损坏': 'damaged',
            'overdue': 'overdue',
            '超期': 'overdue'
        };
        return statusMap[status.toLowerCase()] || 'shipped';
    }
}
exports.FileParserService = FileParserService;
