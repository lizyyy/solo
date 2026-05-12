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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const DATA_FILES = {
    config: 'config.json',
    employees: 'employees.json',
    salaries: 'salaries.json',
    employmentRecords: 'employment-records.json',
    cityRules: 'city-rules.json',
    historicalDeclarations: 'historical-declarations.json',
    manualCorrections: 'manual-corrections.json',
    operationLogs: 'operation-logs.json',
};
class StorageService {
    constructor(dataDir) {
        this.dataDir = path.resolve(dataDir);
    }
    init(projectConfig) {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        const defaultData = {
            [DATA_FILES.config]: projectConfig,
            [DATA_FILES.employees]: [],
            [DATA_FILES.salaries]: [],
            [DATA_FILES.employmentRecords]: [],
            [DATA_FILES.cityRules]: [],
            [DATA_FILES.historicalDeclarations]: [],
            [DATA_FILES.manualCorrections]: [],
            [DATA_FILES.operationLogs]: [],
        };
        for (const [filename, content] of Object.entries(defaultData)) {
            const filePath = path.join(this.dataDir, filename);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
            }
        }
    }
    exists() {
        return fs.existsSync(path.join(this.dataDir, DATA_FILES.config));
    }
    getConfig() {
        return this.readFile(DATA_FILES.config);
    }
    updateConfig(partial) {
        const config = this.getConfig();
        const updated = {
            ...config,
            ...partial,
            updatedAt: (0, dayjs_1.default)().toISOString(),
        };
        this.writeFile(DATA_FILES.config, updated);
        return updated;
    }
    getEmployees() {
        return this.readFile(DATA_FILES.employees);
    }
    saveEmployees(employees) {
        this.writeFile(DATA_FILES.employees, employees);
    }
    addEmployee(employee) {
        const employees = this.getEmployees();
        const newEmployee = {
            ...employee,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString(),
            updatedAt: (0, dayjs_1.default)().toISOString(),
        };
        employees.push(newEmployee);
        this.saveEmployees(employees);
        return newEmployee;
    }
    getSalaries() {
        return this.readFile(DATA_FILES.salaries);
    }
    saveSalaries(salaries) {
        this.writeFile(DATA_FILES.salaries, salaries);
    }
    addSalary(salary) {
        const salaries = this.getSalaries();
        const newSalary = {
            ...salary,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString(),
        };
        salaries.push(newSalary);
        this.saveSalaries(salaries);
        return newSalary;
    }
    getEmploymentRecords() {
        return this.readFile(DATA_FILES.employmentRecords);
    }
    saveEmploymentRecords(records) {
        this.writeFile(DATA_FILES.employmentRecords, records);
    }
    addEmploymentRecord(record) {
        const records = this.getEmploymentRecords();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString(),
        };
        records.push(newRecord);
        this.saveEmploymentRecords(records);
        return newRecord;
    }
    getCityRules() {
        return this.readFile(DATA_FILES.cityRules);
    }
    saveCityRules(rules) {
        this.writeFile(DATA_FILES.cityRules, rules);
    }
    addCityRule(rule) {
        const rules = this.getCityRules();
        rules.push(rule);
        this.saveCityRules(rules);
    }
    getHistoricalDeclarations() {
        return this.readFile(DATA_FILES.historicalDeclarations);
    }
    saveHistoricalDeclarations(declarations) {
        this.writeFile(DATA_FILES.historicalDeclarations, declarations);
    }
    addHistoricalDeclaration(declaration) {
        const declarations = this.getHistoricalDeclarations();
        const now = (0, dayjs_1.default)().toISOString();
        const newDeclaration = {
            ...declaration,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        declarations.push(newDeclaration);
        this.saveHistoricalDeclarations(declarations);
        return newDeclaration;
    }
    getManualCorrections() {
        return this.readFile(DATA_FILES.manualCorrections);
    }
    saveManualCorrections(corrections) {
        this.writeFile(DATA_FILES.manualCorrections, corrections);
    }
    addManualCorrection(correction) {
        const corrections = this.getManualCorrections();
        const newCorrection = {
            ...correction,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString(),
        };
        corrections.push(newCorrection);
        this.saveManualCorrections(corrections);
        return newCorrection;
    }
    getOperationLogs() {
        return this.readFile(DATA_FILES.operationLogs);
    }
    saveOperationLogs(logs) {
        this.writeFile(DATA_FILES.operationLogs, logs);
    }
    addOperationLog(log) {
        const logs = this.getOperationLogs();
        const newLog = {
            ...log,
            id: (0, uuid_1.v4)(),
            timestamp: (0, dayjs_1.default)().toISOString(),
        };
        logs.push(newLog);
        this.saveOperationLogs(logs);
        return newLog;
    }
    readFile(filename) {
        const filePath = path.join(this.dataDir, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    writeFile(filename, data) {
        const filePath = path.join(this.dataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    getDataDir() {
        return this.dataDir;
    }
}
exports.StorageService = StorageService;
