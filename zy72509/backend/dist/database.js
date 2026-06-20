"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfCheck = exports.records = void 0;
exports.initDatabase = initDatabase;
exports.saveData = saveData;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let dbPath;
let data;
function initDatabase() {
    const DATA_DIR = path_1.default.resolve(__dirname, '..', 'data');
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    dbPath = path_1.default.join(DATA_DIR, 'chatbot.json');
    if (fs_1.default.existsSync(dbPath)) {
        try {
            const raw = fs_1.default.readFileSync(dbPath, 'utf-8');
            data = JSON.parse(raw);
        }
        catch (e) {
            data = { annotation_records: [], self_check_results: [] };
            saveData();
        }
    }
    else {
        data = { annotation_records: [], self_check_results: [] };
        saveData();
    }
}
function saveData() {
    fs_1.default.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}
function cloneRecord(r) {
    return JSON.parse(JSON.stringify(r));
}
exports.records = {
    getAll: () => data.annotation_records.map(cloneRecord),
    getById: (id) => {
        const r = data.annotation_records.find((x) => x.id === id);
        return r ? cloneRecord(r) : undefined;
    },
    add: (record) => {
        data.annotation_records.push(cloneRecord(record));
        saveData();
    },
    update: (id, updates) => {
        const idx = data.annotation_records.findIndex((r) => r.id === id);
        if (idx === -1)
            return false;
        data.annotation_records[idx] = cloneRecord({ ...data.annotation_records[idx], ...updates });
        saveData();
        return true;
    },
    getSessionIds: () => new Set(data.annotation_records.map((r) => r.session_id)),
    getByMaskedPhone: (maskedPhone) => {
        return data.annotation_records
            .filter((r) => {
            const phone = r.phone_number || '';
            const clean = phone.replace(/\D/g, '');
            if (clean.length < 7)
                return false;
            const masked = clean.slice(0, 3) + '****' + clean.slice(-4);
            return masked === maskedPhone;
        })
            .map(cloneRecord);
    },
    getRawData: () => data,
};
exports.selfCheck = {
    getAll: () => [...data.self_check_results],
    add: (result) => {
        data.self_check_results.push(result);
        saveData();
    },
    clear: () => {
        data.self_check_results = [];
        saveData();
    },
    resolve: (id) => {
        const idx = data.self_check_results.findIndex((r) => r.id === id);
        if (idx === -1)
            return false;
        data.self_check_results[idx].is_resolved = true;
        saveData();
        return true;
    },
};
