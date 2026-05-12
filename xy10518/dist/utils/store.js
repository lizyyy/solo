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
exports.loadStore = loadStore;
exports.saveStore = saveStore;
exports.initStore = initStore;
exports.saveBatch = saveBatch;
exports.getBatch = getBatch;
exports.getAllBatches = getAllBatches;
exports.saveSamplingSheet = saveSamplingSheet;
exports.getSamplingSheet = getSamplingSheet;
exports.getAllSamplingSheets = getAllSamplingSheets;
exports.getStorePath = getStorePath;
exports.storeExists = storeExists;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'qc-data.json');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadStore() {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) {
        return { batches: {}, samplingSheets: {} };
    }
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return { batches: {}, samplingSheets: {} };
    }
}
function saveStore(store) {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}
function initStore() {
    const store = { batches: {}, samplingSheets: {} };
    saveStore(store);
    return store;
}
function saveBatch(batch) {
    const store = loadStore();
    store.batches[batch.batchNumber] = batch;
    saveStore(store);
}
function getBatch(batchNumber) {
    const store = loadStore();
    return store.batches[batchNumber];
}
function getAllBatches() {
    const store = loadStore();
    return Object.values(store.batches);
}
function saveSamplingSheet(sheet) {
    const store = loadStore();
    store.samplingSheets[sheet.sheetNumber] = sheet;
    saveStore(store);
}
function getSamplingSheet(sheetNumber) {
    const store = loadStore();
    return store.samplingSheets[sheetNumber];
}
function getAllSamplingSheets() {
    const store = loadStore();
    return Object.values(store.samplingSheets);
}
function getStorePath() {
    return DATA_FILE;
}
function storeExists() {
    return fs.existsSync(DATA_FILE);
}
//# sourceMappingURL=store.js.map