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
exports.StorageService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StorageService {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.samplesDir = path.join(dataDir, 'samples');
        this.rulesDir = path.join(dataDir, 'rules');
        this.historyDir = path.join(dataDir, 'history');
        this.exportDir = path.join(dataDir, 'exports');
        this.ensureDirectories();
    }
    ensureDirectories() {
        [this.dataDir, this.samplesDir, this.rulesDir, this.historyDir, this.exportDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    saveSample(sample) {
        const filePath = path.join(this.samplesDir, `${sample.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf-8');
    }
    getSample(id) {
        const filePath = path.join(this.samplesDir, `${id}.json`);
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    getSampleByName(name) {
        const samples = this.getAllSamples();
        return samples.find(s => s.name === name) || null;
    }
    getAllSamples() {
        if (!fs.existsSync(this.samplesDir))
            return [];
        return fs.readdirSync(this.samplesDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(this.samplesDir, f), 'utf-8')))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    saveRule(rule) {
        const filePath = path.join(this.rulesDir, `${rule.countryCode}.json`);
        fs.writeFileSync(filePath, JSON.stringify(rule, null, 2), 'utf-8');
    }
    getRule(countryCode) {
        const filePath = path.join(this.rulesDir, `${countryCode.toUpperCase()}.json`);
        if (!fs.existsSync(filePath)) {
            const lowerPath = path.join(this.rulesDir, `${countryCode.toLowerCase()}.json`);
            if (!fs.existsSync(lowerPath))
                return null;
            return JSON.parse(fs.readFileSync(lowerPath, 'utf-8'));
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    getAllRules() {
        if (!fs.existsSync(this.rulesDir))
            return [];
        return fs.readdirSync(this.rulesDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(this.rulesDir, f), 'utf-8')));
    }
    saveCheckResult(result) {
        const historyFile = path.join(this.historyDir, `${result.sampleId}.json`);
        let history;
        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        }
        else {
            history = { sampleId: result.sampleId, results: [] };
        }
        history.results.push(result);
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    }
    getHistory(sampleId) {
        const filePath = path.join(this.historyDir, `${sampleId}.json`);
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    getAllHistory() {
        if (!fs.existsSync(this.historyDir))
            return [];
        return fs.readdirSync(this.historyDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(this.historyDir, f), 'utf-8')));
    }
    getLastCheckResult(sampleId) {
        const history = this.getHistory(sampleId);
        if (!history || history.results.length === 0)
            return null;
        return history.results[history.results.length - 1];
    }
    exportToJson(data, filename) {
        const filePath = path.join(this.exportDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return filePath;
    }
    exportToCSV(data, filename) {
        if (data.length === 0) {
            const filePath = path.join(this.exportDir, filename);
            fs.writeFileSync(filePath, '', 'utf-8');
            return filePath;
        }
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => {
                const val = row[h];
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val ?? '';
            }).join(','))
        ].join('\n');
        const filePath = path.join(this.exportDir, filename);
        fs.writeFileSync(filePath, csv, 'utf-8');
        return filePath;
    }
    getDataDir() {
        return this.dataDir;
    }
    getExportDir() {
        return this.exportDir;
    }
}
exports.StorageService = StorageService;
