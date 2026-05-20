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
exports.dataStore = exports.DataStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
class DataStore {
    constructor(dataDir = './data') {
        this.dataPath = path.join(process.cwd(), dataDir, 'data.json');
        this.data = this.initializeData();
        this.ensureDataDir(dataDir);
        this.loadData();
    }
    initializeData() {
        return {
            childProfiles: [],
            vaccineInventories: [],
            appointmentRecords: [],
            contraindicationRules: [],
            batches: []
        };
    }
    ensureDataDir(dataDir) {
        const dirPath = path.join(process.cwd(), dataDir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
                this.data = JSON.parse(fileContent);
            }
            else {
                this.saveData();
            }
        }
        catch (error) {
            console.error('加载数据失败，使用空数据:', error);
            this.data = this.initializeData();
        }
    }
    saveData() {
        try {
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('保存数据失败:', error);
            throw error;
        }
    }
    createChildProfile(profile) {
        const now = new Date().toISOString();
        const newProfile = {
            ...profile,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        this.data.childProfiles.push(newProfile);
        this.saveData();
        return newProfile;
    }
    getChildProfiles() {
        return this.data.childProfiles;
    }
    getChildProfileById(id) {
        return this.data.childProfiles.find(p => p.id === id);
    }
    getChildProfileByIdCard(idCard) {
        return this.data.childProfiles.find(p => p.idCard === idCard);
    }
    updateChildProfile(id, updates) {
        const index = this.data.childProfiles.findIndex(p => p.id === id);
        if (index === -1)
            return undefined;
        this.data.childProfiles[index] = {
            ...this.data.childProfiles[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.childProfiles[index];
    }
    createVaccineInventory(inventory) {
        const now = new Date().toISOString();
        const newInventory = {
            ...inventory,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        this.data.vaccineInventories.push(newInventory);
        this.saveData();
        return newInventory;
    }
    getVaccineInventories() {
        return this.data.vaccineInventories;
    }
    getVaccineInventoryByCode(vaccineCode) {
        return this.data.vaccineInventories.find(v => v.vaccineCode === vaccineCode && v.availableQuantity > 0);
    }
    updateVaccineInventory(id, updates) {
        const index = this.data.vaccineInventories.findIndex(v => v.id === id);
        if (index === -1)
            return undefined;
        this.data.vaccineInventories[index] = {
            ...this.data.vaccineInventories[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.vaccineInventories[index];
    }
    createAppointmentRecord(record) {
        const now = new Date().toISOString();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            operationLogs: [],
            createdAt: now,
            updatedAt: now
        };
        this.data.appointmentRecords.push(newRecord);
        this.saveData();
        return newRecord;
    }
    getAppointmentRecords() {
        return this.data.appointmentRecords;
    }
    getAppointmentRecordById(id) {
        return this.data.appointmentRecords.find(r => r.id === id);
    }
    getAppointmentRecordsByChildId(childId) {
        return this.data.appointmentRecords.filter(r => r.childId === childId);
    }
    getAppointmentRecordsByBatchId(batchId) {
        return this.data.appointmentRecords.filter(r => r.batchId === batchId);
    }
    updateAppointmentRecord(id, updates) {
        const index = this.data.appointmentRecords.findIndex(r => r.id === id);
        if (index === -1)
            return undefined;
        this.data.appointmentRecords[index] = {
            ...this.data.appointmentRecords[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.appointmentRecords[index];
    }
    addOperationLog(recordId, operation) {
        const record = this.getAppointmentRecordById(recordId);
        if (!record)
            return undefined;
        const log = {
            ...operation,
            id: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString()
        };
        record.operationLogs.push(log);
        return this.updateAppointmentRecord(recordId, { operationLogs: record.operationLogs });
    }
    createContraindicationRule(rule) {
        const now = new Date().toISOString();
        const newRule = {
            ...rule,
            id: (0, uuid_1.v4)(),
            createdAt: now
        };
        this.data.contraindicationRules.push(newRule);
        this.saveData();
        return newRule;
    }
    getContraindicationRules() {
        return this.data.contraindicationRules;
    }
    getContraindicationRulesByVaccineCode(vaccineCode) {
        return this.data.contraindicationRules.filter(r => r.vaccineCode === vaccineCode);
    }
    createBatch(batch) {
        const now = new Date().toISOString();
        const newBatch = {
            ...batch,
            id: (0, uuid_1.v4)(),
            createdAt: now
        };
        this.data.batches.push(newBatch);
        this.saveData();
        return newBatch;
    }
    getBatches() {
        return this.data.batches;
    }
    getBatchById(id) {
        return this.data.batches.find(b => b.id === id);
    }
    updateBatch(id, updates) {
        const index = this.data.batches.findIndex(b => b.id === id);
        if (index === -1)
            return undefined;
        this.data.batches[index] = {
            ...this.data.batches[index],
            ...updates
        };
        this.saveData();
        return this.data.batches[index];
    }
    getNextWaitlistOrder(batchId) {
        const waitlistedRecords = this.data.appointmentRecords.filter(r => r.batchId === batchId && r.status === types_1.RecordStatus.WAITLISTED && r.waitlistOrder);
        const maxOrder = Math.max(...waitlistedRecords.map(r => r.waitlistOrder || 0), 0);
        return maxOrder + 1;
    }
    bulkInsertChildProfiles(profiles) {
        const now = new Date().toISOString();
        const newProfiles = profiles.map(p => ({
            ...p,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        }));
        this.data.childProfiles.push(...newProfiles);
        this.saveData();
        return newProfiles;
    }
    bulkInsertVaccineInventories(inventories) {
        const now = new Date().toISOString();
        const newInventories = inventories.map(i => ({
            ...i,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        }));
        this.data.vaccineInventories.push(...newInventories);
        this.saveData();
        return newInventories;
    }
    bulkInsertContraindicationRules(rules) {
        const now = new Date().toISOString();
        const newRules = rules.map(r => ({
            ...r,
            id: (0, uuid_1.v4)(),
            createdAt: now
        }));
        this.data.contraindicationRules.push(...newRules);
        this.saveData();
        return newRules;
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
