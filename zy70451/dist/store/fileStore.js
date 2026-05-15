"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const FORMS_FILE = path_1.default.join(DATA_DIR, 'handover-forms.json');
const HISTORY_FILE = path_1.default.join(DATA_DIR, 'history.json');
class FileStore {
    ensureDataDir() {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        }
    }
    readFile(filePath, defaultValue) {
        this.ensureDataDir();
        if (!fs_1.default.existsSync(filePath)) {
            return defaultValue;
        }
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            return defaultValue;
        }
    }
    writeFile(filePath, data) {
        this.ensureDataDir();
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    getHandoverForms() {
        return this.readFile(FORMS_FILE, []);
    }
    saveHandoverForms(forms) {
        this.writeFile(FORMS_FILE, forms);
    }
    getHandoverFormById(id) {
        const forms = this.getHandoverForms();
        return forms.find(f => f.id === id);
    }
    saveHandoverForm(form) {
        const forms = this.getHandoverForms();
        const index = forms.findIndex(f => f.id === form.id);
        if (index >= 0) {
            forms[index] = form;
        }
        else {
            forms.push(form);
        }
        this.saveHandoverForms(forms);
    }
    getHistoryRecords() {
        return this.readFile(HISTORY_FILE, []);
    }
    saveHistoryRecords(records) {
        this.writeFile(HISTORY_FILE, records);
    }
    addHistoryRecord(record) {
        const records = this.getHistoryRecords();
        records.push(record);
        this.saveHistoryRecords(records);
    }
}
exports.fileStore = new FileStore();
