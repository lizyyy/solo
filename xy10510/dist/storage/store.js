"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultStore = exports.DataStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const schemas_1 = require("../models/schemas");
const DEFAULT_DATA_DIR = path_1.default.join(process.cwd(), ".cmp-data");
const DB_FILE = "database.json";
class DataStore {
    constructor(dataDir = DEFAULT_DATA_DIR) {
        this.dataDir = dataDir;
        this.dbPath = path_1.default.join(dataDir, DB_FILE);
        this.db = (0, schemas_1.createEmptyDatabase)();
    }
    getDatabase() {
        return this.db;
    }
    getDataDir() {
        return this.dataDir;
    }
    exists() {
        return fs_1.default.existsSync(this.dbPath);
    }
    initialize() {
        if (!fs_1.default.existsSync(this.dataDir)) {
            fs_1.default.mkdirSync(this.dataDir, { recursive: true });
        }
        this.db = (0, schemas_1.createEmptyDatabase)();
        this.save();
    }
    load() {
        if (!this.exists()) {
            return false;
        }
        try {
            const content = fs_1.default.readFileSync(this.dbPath, "utf-8");
            this.db = JSON.parse(content);
            return true;
        }
        catch (error) {
            throw new Error(`无法加载数据库: ${error.message}`);
        }
    }
    save() {
        this.db.lastUpdatedAt = new Date().toISOString();
        if (!fs_1.default.existsSync(this.dataDir)) {
            fs_1.default.mkdirSync(this.dataDir, { recursive: true });
        }
        fs_1.default.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2), "utf-8");
    }
    addContract(contract) {
        const now = new Date().toISOString();
        const newContract = {
            ...contract,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.contracts.push(newContract);
        this.save();
        return newContract;
    }
    addMilestone(milestone) {
        const now = new Date().toISOString();
        const newMilestone = {
            ...milestone,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.milestones.push(newMilestone);
        this.save();
        return newMilestone;
    }
    addDeliveryProof(proof) {
        const now = new Date().toISOString();
        const newProof = {
            ...proof,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.deliveryProofs.push(newProof);
        this.save();
        return newProof;
    }
    addAcceptanceForm(form) {
        const now = new Date().toISOString();
        const newForm = {
            ...form,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.acceptanceForms.push(newForm);
        this.save();
        return newForm;
    }
    addInvoice(invoice) {
        const now = new Date().toISOString();
        const newInvoice = {
            ...invoice,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.invoices.push(newInvoice);
        this.save();
        return newInvoice;
    }
    addPaymentRecord(record) {
        const now = new Date().toISOString();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.db.paymentRecords.push(newRecord);
        this.save();
        return newRecord;
    }
    addOperation(operation) {
        const now = new Date().toISOString();
        const newOp = {
            ...operation,
            id: (0, uuid_1.v4)(),
            timestamp: now,
        };
        this.db.operations.push(newOp);
        this.save();
        return newOp;
    }
    addIssue(issue) {
        const now = new Date().toISOString();
        const newIssue = {
            ...issue,
            id: (0, uuid_1.v4)(),
            createdAt: now,
        };
        this.db.issues.push(newIssue);
        this.save();
        return newIssue;
    }
    clearIssues() {
        this.db.issues = [];
        this.save();
    }
    getContractById(id) {
        return this.db.contracts.find((c) => c.id === id);
    }
    getContractByNo(contractNo) {
        return this.db.contracts.find((c) => c.contractNo === contractNo);
    }
    getMilestoneById(id) {
        return this.db.milestones.find((m) => m.id === id);
    }
    getMilestonesByContractId(contractId) {
        return this.db.milestones.filter((m) => m.contractId === contractId);
    }
    getMilestoneByNo(milestoneNo) {
        return this.db.milestones.find((m) => m.milestoneNo === milestoneNo);
    }
    getDeliveryProofById(id) {
        return this.db.deliveryProofs.find((p) => p.id === id);
    }
    getDeliveryProofsByMilestoneId(milestoneId) {
        return this.db.deliveryProofs.filter((p) => p.milestoneId === milestoneId);
    }
    getDeliveryProofByNo(proofNo) {
        return this.db.deliveryProofs.find((p) => p.proofNo === proofNo);
    }
    getAcceptanceFormById(id) {
        return this.db.acceptanceForms.find((f) => f.id === id);
    }
    getAcceptanceFormsByMilestoneId(milestoneId) {
        return this.db.acceptanceForms.filter((f) => f.milestoneId === milestoneId);
    }
    getAcceptanceFormByNo(formNo) {
        return this.db.acceptanceForms.find((f) => f.formNo === formNo);
    }
    getInvoiceById(id) {
        return this.db.invoices.find((i) => i.id === id);
    }
    getInvoicesByMilestoneId(milestoneId) {
        return this.db.invoices.filter((i) => i.milestoneId === milestoneId);
    }
    getInvoiceByNo(invoiceNo) {
        return this.db.invoices.find((i) => i.invoiceNo === invoiceNo);
    }
    getPaymentRecordById(id) {
        return this.db.paymentRecords.find((p) => p.id === id);
    }
    getPaymentRecordsByMilestoneId(milestoneId) {
        return this.db.paymentRecords.filter((p) => p.milestoneId === milestoneId);
    }
    getPaymentRecordsByInvoiceId(invoiceId) {
        return this.db.paymentRecords.filter((p) => p.invoiceId === invoiceId);
    }
    getPaymentRecordByNo(paymentNo) {
        return this.db.paymentRecords.find((p) => p.paymentNo === paymentNo);
    }
    getOperationsByEntity(entityType, entityId) {
        return this.db.operations
            .filter((op) => op.entityType === entityType && op.entityId === entityId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    getIssuesByEntity(entityType, entityId) {
        return this.db.issues.filter((issue) => issue.entityType === entityType && issue.entityId === entityId);
    }
    updateContract(id, updates) {
        const idx = this.db.contracts.findIndex((c) => c.id === id);
        if (idx === -1)
            return undefined;
        this.db.contracts[idx] = {
            ...this.db.contracts[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.contracts[idx];
    }
    updateMilestone(id, updates) {
        const idx = this.db.milestones.findIndex((m) => m.id === id);
        if (idx === -1)
            return undefined;
        this.db.milestones[idx] = {
            ...this.db.milestones[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.milestones[idx];
    }
    updateDeliveryProof(id, updates) {
        const idx = this.db.deliveryProofs.findIndex((p) => p.id === id);
        if (idx === -1)
            return undefined;
        this.db.deliveryProofs[idx] = {
            ...this.db.deliveryProofs[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.deliveryProofs[idx];
    }
    updateAcceptanceForm(id, updates) {
        const idx = this.db.acceptanceForms.findIndex((f) => f.id === id);
        if (idx === -1)
            return undefined;
        this.db.acceptanceForms[idx] = {
            ...this.db.acceptanceForms[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.acceptanceForms[idx];
    }
    updateInvoice(id, updates) {
        const idx = this.db.invoices.findIndex((i) => i.id === id);
        if (idx === -1)
            return undefined;
        this.db.invoices[idx] = {
            ...this.db.invoices[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.invoices[idx];
    }
    updatePaymentRecord(id, updates) {
        const idx = this.db.paymentRecords.findIndex((p) => p.id === id);
        if (idx === -1)
            return undefined;
        this.db.paymentRecords[idx] = {
            ...this.db.paymentRecords[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.save();
        return this.db.paymentRecords[idx];
    }
    getAllContracts() {
        return [...this.db.contracts];
    }
    getAllMilestones() {
        return [...this.db.milestones];
    }
    getAllDeliveryProofs() {
        return [...this.db.deliveryProofs];
    }
    getAllAcceptanceForms() {
        return [...this.db.acceptanceForms];
    }
    getAllInvoices() {
        return [...this.db.invoices];
    }
    getAllPaymentRecords() {
        return [...this.db.paymentRecords];
    }
    getAllOperations() {
        return [...this.db.operations];
    }
    getAllIssues() {
        return [...this.db.issues];
    }
}
exports.DataStore = DataStore;
exports.defaultStore = new DataStore();
//# sourceMappingURL=store.js.map