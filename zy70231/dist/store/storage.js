"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
class Storage {
    constructor(dbPath) {
        this.database = this.createEmptyDatabase();
        this.dbPath = dbPath;
    }
    static getInstance(dbPath) {
        if (!Storage.instance) {
            Storage.instance = new Storage(dbPath || path_1.default.join(process.cwd(), '.rw-data.json'));
        }
        return Storage.instance;
    }
    createEmptyDatabase() {
        return {
            maintenanceWindows: new Map(),
            workZones: new Map(),
            resources: new Map(),
            workTasks: new Map(),
            blockSections: new Map(),
            scheduledTasks: new Map(),
            resourceOccupancies: new Map(),
            conflicts: [],
            runStates: [],
        };
    }
    load() {
        if (!fs_1.default.existsSync(this.dbPath)) {
            return;
        }
        const raw = fs_1.default.readFileSync(this.dbPath, 'utf-8');
        const data = JSON.parse(raw);
        this.database = {
            maintenanceWindows: new Map(Object.entries(data.maintenanceWindows || {})),
            workZones: new Map(Object.entries(data.workZones || {})),
            resources: new Map(Object.entries(data.resources || {})),
            workTasks: new Map(Object.entries(data.workTasks || {})),
            blockSections: new Map(Object.entries(data.blockSections || {})),
            scheduledTasks: new Map(Object.entries(data.scheduledTasks || {})),
            resourceOccupancies: new Map(Object.entries(data.resourceOccupancies || {})),
            conflicts: data.conflicts || [],
            runStates: data.runStates || [],
        };
    }
    save() {
        const data = {
            maintenanceWindows: Object.fromEntries(this.database.maintenanceWindows),
            workZones: Object.fromEntries(this.database.workZones),
            resources: Object.fromEntries(this.database.resources),
            workTasks: Object.fromEntries(this.database.workTasks),
            blockSections: Object.fromEntries(this.database.blockSections),
            scheduledTasks: Object.fromEntries(this.database.scheduledTasks),
            resourceOccupancies: Object.fromEntries(this.database.resourceOccupancies),
            conflicts: this.database.conflicts,
            runStates: this.database.runStates,
        };
        const dir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    get db() {
        return this.database;
    }
    clearRunData(runId) {
        const scheduledToRemove = new Set();
        const lastSuccessRun = this.database.runStates
            .filter(r => r.status === 'completed')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        for (const [id, task] of this.database.scheduledTasks) {
            scheduledToRemove.add(id);
        }
        for (const id of scheduledToRemove) {
            this.database.scheduledTasks.delete(id);
        }
        const occupanciesToRemove = new Set();
        for (const [id, occ] of this.database.resourceOccupancies) {
            occupanciesToRemove.add(id);
        }
        for (const id of occupanciesToRemove) {
            this.database.resourceOccupancies.delete(id);
        }
        this.database.conflicts = [];
    }
    addRunState(state) {
        const runState = {
            runId: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            ...state,
        };
        this.database.runStates.push(runState);
        return runState;
    }
    updateRunState(runId, updates) {
        const index = this.database.runStates.findIndex(r => r.runId === runId);
        if (index !== -1) {
            this.database.runStates[index] = { ...this.database.runStates[index], ...updates };
        }
    }
    getLastRunState() {
        return [...this.database.runStates]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    }
}
exports.Storage = Storage;
Storage.instance = null;
//# sourceMappingURL=storage.js.map