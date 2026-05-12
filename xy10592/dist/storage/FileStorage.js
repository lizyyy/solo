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
exports.FileStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileStorage {
    constructor(dataDir) {
        this.initialized = false;
        this.dataDir = dataDir;
        this.assetsFile = path.join(dataDir, 'assets.json');
        this.acquisitionsFile = path.join(dataDir, 'acquisitions.json');
        this.transfersFile = path.join(dataDir, 'transfers.json');
        this.repairsFile = path.join(dataDir, 'repairs.json');
        this.scrapsFile = path.join(dataDir, 'scraps.json');
        this.storesFile = path.join(dataDir, 'stores.json');
        this.periodsFile = path.join(dataDir, 'periods.json');
        this.depreciationDetailsFile = path.join(dataDir, 'depreciation-details.json');
        this.historyFile = path.join(dataDir, 'history.json');
        this.correctionsFile = path.join(dataDir, 'corrections.json');
        this.stateFile = path.join(dataDir, 'state.json');
    }
    async initialize() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.stateFile)) {
            const state = {
                initialized: true,
                initializedAt: new Date().toISOString(),
                lastCheckAt: null,
                dataDirectory: this.dataDir,
                importVersion: 0
            };
            await this.saveState(state);
        }
        const initFiles = [
            { file: this.assetsFile, data: [] },
            { file: this.acquisitionsFile, data: [] },
            { file: this.transfersFile, data: [] },
            { file: this.repairsFile, data: [] },
            { file: this.scrapsFile, data: [] },
            { file: this.storesFile, data: [] },
            { file: this.periodsFile, data: [] },
            { file: this.depreciationDetailsFile, data: [] },
            { file: this.historyFile, data: [] },
            { file: this.correctionsFile, data: [] },
        ];
        for (const item of initFiles) {
            if (!fs.existsSync(item.file)) {
                await this.writeFile(item.file, item.data);
            }
        }
        this.initialized = true;
    }
    isInitialized() {
        return this.initialized && fs.existsSync(this.stateFile);
    }
    getDataDir() {
        return this.dataDir;
    }
    async readFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    async writeFile(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    async getState() {
        if (!fs.existsSync(this.stateFile)) {
            return {
                initialized: false,
                initializedAt: null,
                lastCheckAt: null,
                dataDirectory: this.dataDir,
                importVersion: 0
            };
        }
        return this.readFile(this.stateFile);
    }
    async saveState(state) {
        await this.writeFile(this.stateFile, state);
    }
    async getStores() {
        return this.readFile(this.storesFile);
    }
    async saveStores(stores) {
        await this.writeFile(this.storesFile, stores);
    }
    async getAssets() {
        return this.readFile(this.assetsFile);
    }
    async saveAssets(assets) {
        await this.writeFile(this.assetsFile, assets);
    }
    async getAcquisitions() {
        return this.readFile(this.acquisitionsFile);
    }
    async saveAcquisitions(records) {
        await this.writeFile(this.acquisitionsFile, records);
    }
    async getTransfers() {
        return this.readFile(this.transfersFile);
    }
    async saveTransfers(records) {
        await this.writeFile(this.transfersFile, records);
    }
    async getRepairs() {
        return this.readFile(this.repairsFile);
    }
    async saveRepairs(records) {
        await this.writeFile(this.repairsFile, records);
    }
    async getScraps() {
        return this.readFile(this.scrapsFile);
    }
    async saveScraps(records) {
        await this.writeFile(this.scrapsFile, records);
    }
    async getPeriods() {
        return this.readFile(this.periodsFile);
    }
    async savePeriods(periods) {
        await this.writeFile(this.periodsFile, periods);
    }
    async getDepreciationDetails() {
        return this.readFile(this.depreciationDetailsFile);
    }
    async saveDepreciationDetails(details) {
        await this.writeFile(this.depreciationDetailsFile, details);
    }
    async getHistory() {
        return this.readFile(this.historyFile);
    }
    async saveHistory(history) {
        await this.writeFile(this.historyFile, history);
    }
    async getCorrections() {
        return this.readFile(this.correctionsFile);
    }
    async saveCorrections(corrections) {
        await this.writeFile(this.correctionsFile, corrections);
    }
    async importAll(data, importVersion) {
        await this.saveStores(data.stores);
        await this.saveAssets(data.assets);
        await this.saveAcquisitions(data.acquisitions);
        await this.saveTransfers(data.transfers);
        await this.saveRepairs(data.repairs);
        await this.saveScraps(data.scraps);
        const state = await this.getState();
        state.importVersion = importVersion;
        await this.saveState(state);
    }
    async clearAll() {
        await this.initialize();
        const state = await this.getState();
        state.importVersion = 0;
        state.lastCheckAt = null;
        await this.saveState(state);
    }
}
exports.FileStorage = FileStorage;
//# sourceMappingURL=FileStorage.js.map