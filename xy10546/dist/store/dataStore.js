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
exports.defaultStore = void 0;
exports.ensureDataDir = ensureDataDir;
exports.isInitialized = isInitialized;
exports.loadStore = loadStore;
exports.saveStore = saveStore;
exports.initializeStore = initializeStore;
exports.getWorkDir = getWorkDir;
exports.getDataDir = getDataDir;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const WORK_DIR = process.cwd();
const DATA_DIR = path.join(WORK_DIR, '.invoice-checker');
exports.defaultStore = {
    initialized: false,
    companyHeaders: [],
    employees: [],
    departments: [],
    invoices: [],
    reimbursements: [],
    auditRecords: [],
    checkReports: [],
    corrections: []
};
const getStorePath = () => path.join(DATA_DIR, 'data.json');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function isInitialized() {
    return fs.existsSync(getStorePath());
}
function loadStore() {
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) {
        return { ...exports.defaultStore, initialized: false };
    }
    const content = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(content);
}
function saveStore(store) {
    ensureDataDir();
    const storePath = getStorePath();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}
function initializeStore() {
    const store = { ...exports.defaultStore, initialized: true };
    saveStore(store);
    return store;
}
function getWorkDir() {
    return WORK_DIR;
}
function getDataDir() {
    return DATA_DIR;
}
