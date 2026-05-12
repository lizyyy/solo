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
exports.DataStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const DEFAULT_STORE_PATH = path.join(process.cwd(), '.cert-rotator', 'store.json');
const STORE_VERSION = '1.0.0';
class DataStore {
    constructor(storePath) {
        this.cache = null;
        this.storePath = storePath || DEFAULT_STORE_PATH;
    }
    getStorePath() {
        return this.storePath;
    }
    getStoreDir() {
        return path.dirname(this.storePath);
    }
    exists() {
        return fs.existsSync(this.storePath);
    }
    initialize() {
        const dir = this.getStoreDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const store = {
            certificates: [],
            domains: [],
            dependencies: [],
            windows: [],
            executionRecords: [],
            version: STORE_VERSION,
            lastUpdated: new Date().toISOString()
        };
        this.save(store);
        this.cache = store;
        return store;
    }
    load() {
        if (this.cache) {
            return this.cache;
        }
        if (!this.exists()) {
            throw new Error(`Store not found at ${this.storePath}. Please run 'init' first.`);
        }
        const content = fs.readFileSync(this.storePath, 'utf-8');
        const store = JSON.parse(content);
        this.cache = store;
        return store;
    }
    save(store) {
        store.lastUpdated = new Date().toISOString();
        const dir = this.getStoreDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
        this.cache = store;
    }
    addCertificate(cert) {
        const store = this.load();
        const now = new Date().toISOString();
        const newCert = {
            ...cert,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        store.certificates.push(newCert);
        this.save(store);
        return newCert;
    }
    updateCertificate(id, updates) {
        const store = this.load();
        const index = store.certificates.findIndex(c => c.id === id);
        if (index === -1)
            return null;
        store.certificates[index] = {
            ...store.certificates[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.save(store);
        return store.certificates[index];
    }
    getCertificate(id) {
        const store = this.load();
        return store.certificates.find(c => c.id === id);
    }
    getCertificateBySerial(serial) {
        const store = this.load();
        return store.certificates.find(c => c.serialNumber === serial);
    }
    getCertificates() {
        const store = this.load();
        return [...store.certificates];
    }
    addDomain(domain) {
        const store = this.load();
        const newDomain = {
            ...domain,
            id: (0, uuid_1.v4)(),
            createdAt: new Date().toISOString()
        };
        store.domains.push(newDomain);
        this.save(store);
        return newDomain;
    }
    getDomains() {
        const store = this.load();
        return [...store.domains];
    }
    getDomainsByCertificate(certId) {
        const store = this.load();
        return store.domains.filter(d => d.certificateId === certId);
    }
    addDependency(dep) {
        const store = this.load();
        const now = new Date().toISOString();
        const newDep = {
            ...dep,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        store.dependencies.push(newDep);
        this.save(store);
        return newDep;
    }
    updateDependency(id, updates) {
        const store = this.load();
        const index = store.dependencies.findIndex(d => d.id === id);
        if (index === -1)
            return null;
        store.dependencies[index] = {
            ...store.dependencies[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.save(store);
        return store.dependencies[index];
    }
    getDependencies() {
        const store = this.load();
        return [...store.dependencies];
    }
    getDependenciesByService(serviceName, env) {
        const store = this.load();
        return store.dependencies.filter(d => d.serviceName === serviceName && (!env || d.environment === env));
    }
    getDependenciesByServiceNames(serviceNames, env) {
        const store = this.load();
        return store.dependencies.filter(d => serviceNames.some(s => d.serviceName === s || d.dependsOn.includes(s)) &&
            (!env || d.environment === env));
    }
    addWindow(window) {
        const store = this.load();
        const newWindow = {
            ...window,
            id: (0, uuid_1.v4)(),
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };
        store.windows.push(newWindow);
        this.save(store);
        return newWindow;
    }
    getWindows() {
        const store = this.load();
        return [...store.windows];
    }
    getWindowsByCertificate(certId) {
        const store = this.load();
        return store.windows.filter(w => w.affectedCertificates.includes(certId));
    }
    addExecutionRecord(record) {
        const store = this.load();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)()
        };
        store.executionRecords.push(newRecord);
        this.save(store);
        return newRecord;
    }
    getExecutionRecords(limit, action) {
        const store = this.load();
        let records = [...store.executionRecords].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        if (action) {
            records = records.filter(r => r.action === action);
        }
        if (limit) {
            records = records.slice(0, limit);
        }
        return records;
    }
    getExecutionRecordsByIdempotencyKey(key) {
        const store = this.load();
        return store.executionRecords.find(r => r.idempotencyKey === key);
    }
    getExecutionRecordsByTarget(targetId) {
        const store = this.load();
        return store.executionRecords
            .filter(r => r.targetId === targetId)
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }
}
exports.DataStore = DataStore;
