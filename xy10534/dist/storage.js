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
exports.Storage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_DATA_DIR = path.join(process.cwd(), '.release-data');
const DATA_FILE = 'release-data.json';
class Storage {
    constructor(dataDir) {
        this.dataDir = dataDir || DEFAULT_DATA_DIR;
        this.dataFile = path.join(this.dataDir, DATA_FILE);
    }
    ensureDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    initialize(releasePlanId, releaseName) {
        this.ensureDirectory();
        const data = {
            releasePlanId,
            releaseName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            services: [],
            dependencies: [],
            migrations: [],
            switches: [],
            contacts: [],
            waivers: [],
            checkHistory: [],
            corrections: []
        };
        this.save(data);
        return data;
    }
    exists() {
        return fs.existsSync(this.dataFile);
    }
    load() {
        if (!this.exists()) {
            throw new Error('发版数据不存在，请先运行 init 命令初始化');
        }
        const content = fs.readFileSync(this.dataFile, 'utf-8');
        return JSON.parse(content);
    }
    save(data) {
        this.ensureDirectory();
        data.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
    }
    backup() {
        if (!this.exists()) {
            return '';
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.dataDir, `release-data-backup-${timestamp}.json`);
        fs.copyFileSync(this.dataFile, backupFile);
        return backupFile;
    }
    addServices(data, services) {
        const existingIds = new Set(data.services.map(s => s.id));
        const existingNames = new Set(data.services.map(s => s.name));
        for (const service of services) {
            if (!existingIds.has(service.id) && !existingNames.has(service.name)) {
                data.services.push(service);
            }
        }
        return data;
    }
    addDependencies(data, dependencies) {
        const existingKeys = new Set(data.dependencies.map(d => `${d.callerServiceId}-${d.calleeServiceId}`));
        for (const dep of dependencies) {
            const key = `${dep.callerServiceId}-${dep.calleeServiceId}`;
            if (!existingKeys.has(key)) {
                data.dependencies.push(dep);
            }
        }
        return data;
    }
    addMigrations(data, migrations) {
        const existingKeys = new Set(data.migrations.map(m => `${m.serviceId}-${m.scriptName}`));
        for (const migration of migrations) {
            const key = `${migration.serviceId}-${migration.scriptName}`;
            if (!existingKeys.has(key)) {
                data.migrations.push(migration);
            }
        }
        return data;
    }
    addSwitches(data, switches) {
        const existingKeys = new Set(data.switches.map(s => `${s.serviceId}-${s.key}`));
        for (const sw of switches) {
            const key = `${sw.serviceId}-${sw.key}`;
            if (!existingKeys.has(key)) {
                data.switches.push(sw);
            }
        }
        return data;
    }
    addContacts(data, contacts) {
        const existingKeys = new Set(data.contacts.map(c => `${c.serviceId}-${c.email}`));
        for (const contact of contacts) {
            const key = `${contact.serviceId}-${contact.email}`;
            if (!existingKeys.has(key)) {
                data.contacts.push(contact);
            }
        }
        return data;
    }
    addWaiver(data, waiver) {
        data.waivers.push(waiver);
        return data;
    }
    addCheckHistory(data, history) {
        data.checkHistory.push(history);
        return data;
    }
    addCorrection(data, correction) {
        data.corrections.push(correction);
        return data;
    }
    getDataDir() {
        return this.dataDir;
    }
    getDataFile() {
        return this.dataFile;
    }
}
exports.Storage = Storage;
//# sourceMappingURL=storage.js.map