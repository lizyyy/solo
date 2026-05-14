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
const DATA_DIR = path.join(process.cwd(), 'data');
const FILES = {
    inquiries: path.join(DATA_DIR, 'inquiries.json'),
    rules: path.join(DATA_DIR, 'rules.json'),
    auditLogs: path.join(DATA_DIR, 'audit-logs.json'),
    reviewResults: path.join(DATA_DIR, 'review-results.json'),
    permissionTickets: path.join(DATA_DIR, 'permission-tickets.json'),
    batchOperations: path.join(DATA_DIR, 'batch-operations.json')
};
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function readJsonFile(filePath, defaultValue) {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
        return defaultValue;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return defaultValue;
    }
}
function writeJsonFile(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
class DataStore {
    static getInquiries() {
        return readJsonFile(FILES.inquiries, []);
    }
    static saveInquiries(inquiries) {
        writeJsonFile(FILES.inquiries, inquiries);
    }
    static addInquiry(inquiry) {
        const inquiries = this.getInquiries();
        inquiries.push(inquiry);
        this.saveInquiries(inquiries);
    }
    static getInquiryById(id) {
        return this.getInquiries().find(i => i.id === id);
    }
    static getInquiriesByBatch(batchId) {
        return this.getInquiries().filter(i => i.batchId === batchId);
    }
    static getRules() {
        return readJsonFile(FILES.rules, []);
    }
    static saveRules(rules) {
        writeJsonFile(FILES.rules, rules);
    }
    static addRule(rule) {
        const rules = this.getRules();
        rules.push(rule);
        this.saveRules(rules);
    }
    static getRuleByVersion(version) {
        return this.getRules().find(r => r.version === version);
    }
    static getActiveRule() {
        return this.getRules().find(r => r.isActive);
    }
    static getAuditLogs() {
        return readJsonFile(FILES.auditLogs, []);
    }
    static saveAuditLogs(logs) {
        writeJsonFile(FILES.auditLogs, logs);
    }
    static addAuditLog(log) {
        const logs = this.getAuditLogs();
        logs.push(log);
        this.saveAuditLogs(logs);
    }
    static getAuditLogsByInquiry(inquiryId) {
        return this.getAuditLogs().filter(l => l.inquiryId === inquiryId);
    }
    static getReviewResults() {
        return readJsonFile(FILES.reviewResults, []);
    }
    static saveReviewResults(results) {
        writeJsonFile(FILES.reviewResults, results);
    }
    static addReviewResult(result) {
        const results = this.getReviewResults();
        results.push(result);
        this.saveReviewResults(results);
    }
    static getReviewResultByInquiry(inquiryId) {
        return this.getReviewResults().find(r => r.inquiryId === inquiryId);
    }
    static getPermissionTickets() {
        return readJsonFile(FILES.permissionTickets, []);
    }
    static savePermissionTickets(tickets) {
        writeJsonFile(FILES.permissionTickets, tickets);
    }
    static addPermissionTicket(ticket) {
        const tickets = this.getPermissionTickets();
        tickets.push(ticket);
        this.savePermissionTickets(tickets);
    }
    static getPermissionTicketsByInquiry(inquiryId) {
        return this.getPermissionTickets().filter(t => t.inquiryId === inquiryId);
    }
    static getBatchOperations() {
        return readJsonFile(FILES.batchOperations, []);
    }
    static saveBatchOperations(operations) {
        writeJsonFile(FILES.batchOperations, operations);
    }
    static addBatchOperation(operation) {
        const operations = this.getBatchOperations();
        operations.push(operation);
        this.saveBatchOperations(operations);
    }
    static updateBatchOperation(operation) {
        const operations = this.getBatchOperations();
        const index = operations.findIndex(o => o.id === operation.id);
        if (index >= 0) {
            operations[index] = operation;
            this.saveBatchOperations(operations);
        }
    }
}
exports.DataStore = DataStore;
