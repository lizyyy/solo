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
exports.DataStoreService = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class DataStoreService {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.shipmentsDir = path.join(this.dataDir, 'shipments');
        this.influencersDir = path.join(this.dataDir, 'influencers');
        this.resultsDir = path.join(this.dataDir, 'results');
        this.batchesDir = path.join(this.dataDir, 'batches');
        this.photosDir = path.join(this.dataDir, 'photos');
        this.initializeDirectories();
    }
    async initializeDirectories() {
        await fs.ensureDir(this.dataDir);
        await fs.ensureDir(this.shipmentsDir);
        await fs.ensureDir(this.influencersDir);
        await fs.ensureDir(this.resultsDir);
        await fs.ensureDir(this.batchesDir);
        await fs.ensureDir(this.photosDir);
    }
    generateItemHash(item) {
        const key = `${item.sampleId}-${item.influencerId}-${item.shipDate}`;
        return Buffer.from(key).toString('base64');
    }
    async isBatchProcessed(fileName) {
        const batchFile = path.join(this.batchesDir, `${fileName}.json`);
        return await fs.pathExists(batchFile);
    }
    async saveBatch(batch) {
        const batchFile = path.join(this.batchesDir, `${batch.fileName}.json`);
        await fs.writeJson(batchFile, batch);
    }
    async getBatches() {
        const files = await fs.readdir(this.batchesDir);
        const batches = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const batch = await fs.readJson(path.join(this.batchesDir, file));
                batches.push(batch);
            }
        }
        return batches.sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime());
    }
    async saveShipments(items) {
        for (const item of items) {
            const shipmentFile = path.join(this.shipmentsDir, `${item.id}.json`);
            await fs.writeJson(shipmentFile, item);
        }
    }
    async getAllShipments() {
        const files = await fs.readdir(this.shipmentsDir);
        const shipments = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const shipment = await fs.readJson(path.join(this.shipmentsDir, file));
                shipments.push(shipment);
            }
        }
        return shipments;
    }
    async getShipmentById(id) {
        const shipmentFile = path.join(this.shipmentsDir, `${id}.json`);
        if (await fs.pathExists(shipmentFile)) {
            return await fs.readJson(shipmentFile);
        }
        return null;
    }
    async saveInfluencers(influencers) {
        for (const [id, influencer] of influencers) {
            const influencerFile = path.join(this.influencersDir, `${id}.json`);
            await fs.writeJson(influencerFile, influencer);
        }
    }
    async getInfluencers() {
        const files = await fs.readdir(this.influencersDir);
        const influencers = new Map();
        for (const file of files) {
            if (file.endsWith('.json')) {
                const influencer = await fs.readJson(path.join(this.influencersDir, file));
                influencers.set(influencer.id, influencer);
            }
        }
        return influencers;
    }
    async getInfluencerById(id) {
        const influencerFile = path.join(this.influencersDir, `${id}.json`);
        if (await fs.pathExists(influencerFile)) {
            return await fs.readJson(influencerFile);
        }
        return null;
    }
    async saveProcessingResult(result) {
        const resultFile = path.join(this.resultsDir, `${result.batchId}.json`);
        await fs.writeJson(resultFile, result);
    }
    async getProcessingResults() {
        const files = await fs.readdir(this.resultsDir);
        const results = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const result = await fs.readJson(path.join(this.resultsDir, file));
                results.push(result);
            }
        }
        return results;
    }
    async getProcessingResultById(batchId) {
        const resultFile = path.join(this.resultsDir, `${batchId}.json`);
        if (await fs.pathExists(resultFile)) {
            return await fs.readJson(resultFile);
        }
        return null;
    }
    async getReportDetail(shipmentId) {
        const shipment = await this.getShipmentById(shipmentId);
        if (!shipment) {
            return null;
        }
        const influencer = await this.getInfluencerById(shipment.influencerId);
        const results = await this.getProcessingResults();
        let issues = [];
        let suggestions = [];
        let finalStatus = 'normal';
        for (const result of results) {
            const allItems = [...result.normalItems, ...result.pendingItems, ...result.failedItems];
            const processed = allItems.find(p => p.original.id === shipmentId);
            if (processed) {
                issues = processed.issues;
                suggestions = processed.suggestions;
                finalStatus = processed.status;
                break;
            }
        }
        return {
            shipmentId: shipment.id,
            batchId: shipment.batchId,
            sampleInfo: {
                id: shipment.sampleId,
                name: shipment.sampleName,
                brand: shipment.sampleBrand,
                value: shipment.sampleValue
            },
            influencerInfo: {
                id: shipment.influencerId,
                name: shipment.influencerName,
                platform: influencer?.platform || '未知'
            },
            timeline: {
                shipDate: shipment.shipDate,
                expectedReturnDate: shipment.expectedReturnDate,
                actualReturnDate: shipment.actualReturnDate
            },
            issues,
            suggestions,
            finalStatus,
            photos: shipment.returnPhotos
        };
    }
    async savePhoto(fileName, buffer) {
        const photoPath = path.join(this.photosDir, fileName);
        await fs.writeFile(photoPath, buffer);
        return `/photos/${fileName}`;
    }
}
exports.DataStoreService = DataStoreService;
