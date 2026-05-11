"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureStore = ensureStore;
exports.loadStore = loadStore;
exports.saveStore = saveStore;
exports.resetStore = resetStore;
exports.getStorePath = getStorePath;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const STORE_DIR = path_1.default.resolve(process.cwd(), '.logistics-data');
const STORE_FILE = path_1.default.join(STORE_DIR, 'data.json');
const defaultStore = {
    orders: [],
    signRecords: [],
    refuseRecords: [],
    claimRecords: [],
    abnormals: [],
    issues: [],
    reviews: [],
    processedBatches: [],
};
function ensureStore() {
    fs_extra_1.default.ensureDirSync(STORE_DIR);
    if (!fs_extra_1.default.existsSync(STORE_FILE)) {
        fs_extra_1.default.writeJSONSync(STORE_FILE, defaultStore, { spaces: 2 });
    }
}
function loadStore() {
    ensureStore();
    return fs_extra_1.default.readJSONSync(STORE_FILE);
}
function saveStore(store) {
    ensureStore();
    fs_extra_1.default.writeJSONSync(STORE_FILE, store, { spaces: 2 });
}
function resetStore() {
    saveStore(defaultStore);
}
function getStorePath() {
    return STORE_FILE;
}
