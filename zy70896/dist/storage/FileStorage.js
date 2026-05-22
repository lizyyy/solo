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
exports.storage = exports.FileStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileStorage {
    constructor(dataDir = './data') {
        this.dataDir = path.resolve(dataDir);
        this.recordsPath = path.join(this.dataDir, 'records.json');
        this.batchesPath = path.join(this.dataDir, 'batches.json');
        this.errorsPath = path.join(this.dataDir, 'errors.json');
        this.tellersPath = path.join(this.dataDir, 'tellers.json');
        this.schedulesPath = path.join(this.dataDir, 'schedules.json');
        this.ensureDataDir();
    }
    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        this.initFileIfNotExists(this.recordsPath, []);
        this.initFileIfNotExists(this.batchesPath, []);
        this.initFileIfNotExists(this.errorsPath, []);
        this.initFileIfNotExists(this.tellersPath, []);
        this.initFileIfNotExists(this.schedulesPath, []);
    }
    initFileIfNotExists(filePath, defaultValue) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        }
    }
    readFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    writeFile(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    async getRecords() {
        return this.readFile(this.recordsPath);
    }
    async saveRecord(record) {
        const records = await this.getRecords();
        const index = records.findIndex(r => r.id === record.id);
        if (index >= 0) {
            records[index] = record;
        }
        else {
            records.push(record);
        }
        this.writeFile(this.recordsPath, records);
    }
    async saveRecords(records) {
        const existingRecords = await this.getRecords();
        for (const record of records) {
            const index = existingRecords.findIndex(r => r.id === record.id);
            if (index >= 0) {
                existingRecords[index] = record;
            }
            else {
                existingRecords.push(record);
            }
        }
        this.writeFile(this.recordsPath, existingRecords);
    }
    async getBatches() {
        return this.readFile(this.batchesPath);
    }
    async saveBatch(batch) {
        const batches = await this.getBatches();
        const index = batches.findIndex(b => b.id === batch.id);
        if (index >= 0) {
            batches[index] = batch;
        }
        else {
            batches.push(batch);
        }
        this.writeFile(this.batchesPath, batches);
    }
    async getErrors() {
        return this.readFile(this.errorsPath);
    }
    async saveError(error) {
        const errors = await this.getErrors();
        const index = errors.findIndex(e => e.errorNumber === error.errorNumber);
        if (index >= 0) {
            errors[index] = error;
        }
        else {
            errors.push(error);
        }
        this.writeFile(this.errorsPath, errors);
    }
    async getTellers() {
        return this.readFile(this.tellersPath);
    }
    async saveTeller(teller) {
        const tellers = await this.getTellers();
        const index = tellers.findIndex(t => t.tellerId === teller.tellerId);
        if (index >= 0) {
            tellers[index] = teller;
        }
        else {
            tellers.push(teller);
        }
        this.writeFile(this.tellersPath, tellers);
    }
    async saveTellers(tellers) {
        this.writeFile(this.tellersPath, tellers);
    }
    async getSchedules() {
        return this.readFile(this.schedulesPath);
    }
    async saveSchedules(schedules) {
        this.writeFile(this.schedulesPath, schedules);
    }
}
exports.FileStorage = FileStorage;
exports.storage = new FileStorage();
