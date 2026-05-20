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
exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const types_1 = require("./types");
class ImportService {
    async parseShipmentCSV(filePath) {
        const results = [];
        const shipments = new Map();
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                try {
                    results.forEach(row => {
                        const shipmentId = row.shipmentId || (0, types_1.generateId)();
                        if (!shipments.has(shipmentId)) {
                            const shipment = {
                                id: shipmentId,
                                batchCode: row.batchCode,
                                batchName: row.batchName,
                                brand: row.brand,
                                influencerId: row.influencerId,
                                influencerName: row.influencerName,
                                shipDate: row.shipDate,
                                dueDate: row.dueDate,
                                returnDate: row.returnDate || undefined,
                                status: this.parseStatus(row.status),
                                items: [],
                                totalValue: 0,
                                photoProof: row.photoProof ? row.photoProof.split(';') : undefined,
                                notes: row.notes || undefined
                            };
                            shipments.set(shipmentId, shipment);
                        }
                        const shipment = shipments.get(shipmentId);
                        const itemValue = parseFloat(row.unitValue) * parseInt(row.quantity);
                        const item = {
                            id: (0, types_1.generateId)(),
                            shipmentId: shipmentId,
                            sampleCode: row.sampleCode,
                            sampleName: row.sampleName,
                            quantity: parseInt(row.quantity),
                            unitValue: parseFloat(row.unitValue),
                            totalValue: itemValue
                        };
                        shipment.items.push(item);
                        shipment.totalValue += itemValue;
                    });
                    resolve(Array.from(shipments.values()));
                }
                catch (error) {
                    reject(error);
                }
            })
                .on('error', reject);
        });
    }
    async parseInfluencerJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.map((item) => ({
            id: item.id || (0, types_1.generateId)(),
            name: item.name,
            platform: item.platform,
            followers: item.followers,
            contact: item.contact,
            depositAmount: item.depositAmount || 0
        }));
    }
    parseStatus(status) {
        const statusMap = {
            'pending': types_1.SampleStatus.PENDING,
            'shipped': types_1.SampleStatus.SHIPPED,
            'returned': types_1.SampleStatus.RETURNED,
            'damaged': types_1.SampleStatus.DAMAGED,
            'lost': types_1.SampleStatus.LOST,
            'overdue': types_1.SampleStatus.OVERDUE
        };
        return statusMap[status?.toLowerCase()] || types_1.SampleStatus.PENDING;
    }
    async loadSampleData() {
        const sampleDir = path.join(__dirname, '../sample-data');
        if (!fs.existsSync(sampleDir)) {
            fs.mkdirSync(sampleDir, { recursive: true });
        }
        const csvPath = path.join(sampleDir, 'shipments.csv');
        const jsonPath = path.join(sampleDir, 'influencers.json');
        if (!fs.existsSync(csvPath) || !fs.existsSync(jsonPath)) {
            await this.createSampleData(csvPath, jsonPath);
        }
        const shipments = await this.parseShipmentCSV(csvPath);
        const influencers = await this.parseInfluencerJSON(jsonPath);
        return { shipments, influencers };
    }
    async createSampleData(csvPath, jsonPath) {
        const csvContent = `shipmentId,batchCode,batchName,brand,influencerId,influencerName,sampleCode,sampleName,quantity,unitValue,shipDate,dueDate,returnDate,status,photoProof,notes
ship001,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU001,口红A,1,199,2024-03-01,2024-03-15,2024-03-14,returned,photo1.jpg,完好归还
ship001,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU002,眼影盘B,1,299,2024-03-01,2024-03-15,2024-03-14,returned,photo1.jpg,完好归还
ship002,BATCH2024Q1,2024春季新品,美妆品牌X,inf002,李穿搭,SKU001,口红A,1,199,2024-03-05,2024-03-20,,shipped,,
ship003,BATCH2024Q1,2024春季新品,美妆品牌X,inf003,王护肤,SKU003,精华液C,2,399,2024-03-02,2024-03-16,2024-03-18,damaged,photo2.jpg;photo3.jpg,瓶身破损
ship004,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU001,口红A,1,199,2024-03-10,2024-03-25,,shipped,,重复寄送
ship005,BATCH2024Q1,2024春季新品,美妆品牌X,inf004,赵时尚,SKU004,香水D,1,599,2024-02-20,2024-03-06,,overdue,,超期未还`;
        const jsonContent = JSON.stringify([
            {
                id: "inf001",
                name: "张美妆",
                platform: "抖音",
                followers: 1500000,
                contact: "zhang@example.com",
                depositAmount: 1000
            },
            {
                id: "inf002",
                name: "李穿搭",
                platform: "小红书",
                followers: 800000,
                contact: "li@example.com",
                depositAmount: 800
            },
            {
                id: "inf003",
                name: "王护肤",
                platform: "B站",
                followers: 2000000,
                contact: "wang@example.com",
                depositAmount: 1500
            },
            {
                id: "inf004",
                name: "赵时尚",
                platform: "微博",
                followers: 3000000,
                contact: "zhao@example.com",
                depositAmount: 2000
            }
        ], null, 2);
        fs.writeFileSync(csvPath, csvContent);
        fs.writeFileSync(jsonPath, jsonContent);
    }
}
exports.ImportService = ImportService;
