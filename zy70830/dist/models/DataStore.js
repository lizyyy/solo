"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = exports.DataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.beds = new Map();
        this.patients = new Map();
        this.workOrders = new Map();
        this.discrepancies = new Map();
        this.auditLogs = [];
        this.reconciliationRecords = [];
        this.reviewDecisions = [];
    }
    static getInstance() {
        if (!DataStore.instance) {
            DataStore.instance = new DataStore();
        }
        return DataStore.instance;
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    addBed(bed) {
        this.beds.set(bed.id, bed);
    }
    getBed(id) {
        return this.beds.get(id);
    }
    getBedByNumber(bedNumber) {
        return Array.from(this.beds.values()).find(b => b.bedNumber === bedNumber);
    }
    getAllBeds() {
        return Array.from(this.beds.values());
    }
    updateBed(id, updates) {
        const bed = this.beds.get(id);
        if (bed) {
            const updatedBed = { ...bed, ...updates, updatedAt: new Date() };
            this.beds.set(id, updatedBed);
            return updatedBed;
        }
        return undefined;
    }
    clearBeds() {
        this.beds.clear();
    }
    addPatient(patient) {
        this.patients.set(patient.id, patient);
    }
    getPatient(id) {
        return this.patients.get(id);
    }
    getPatientByMRN(medicalRecordNumber) {
        return Array.from(this.patients.values()).find(p => p.medicalRecordNumber === medicalRecordNumber);
    }
    getAllPatients() {
        return Array.from(this.patients.values());
    }
    updatePatient(id, updates) {
        const patient = this.patients.get(id);
        if (patient) {
            const updatedPatient = { ...patient, ...updates, updatedAt: new Date() };
            this.patients.set(id, updatedPatient);
            return updatedPatient;
        }
        return undefined;
    }
    clearPatients() {
        this.patients.clear();
    }
    addWorkOrder(workOrder) {
        this.workOrders.set(workOrder.id, workOrder);
    }
    getWorkOrder(id) {
        return this.workOrders.get(id);
    }
    getWorkOrdersByBedId(bedId) {
        return Array.from(this.workOrders.values()).filter(wo => wo.bedId === bedId);
    }
    getAllWorkOrders() {
        return Array.from(this.workOrders.values());
    }
    updateWorkOrder(id, updates) {
        const workOrder = this.workOrders.get(id);
        if (workOrder) {
            const updatedWorkOrder = { ...workOrder, ...updates, updatedAt: new Date() };
            this.workOrders.set(id, updatedWorkOrder);
            return updatedWorkOrder;
        }
        return undefined;
    }
    clearWorkOrders() {
        this.workOrders.clear();
    }
    addDiscrepancy(discrepancy) {
        this.discrepancies.set(discrepancy.id, discrepancy);
    }
    getDiscrepancy(id) {
        return this.discrepancies.get(id);
    }
    getAllDiscrepancies() {
        return Array.from(this.discrepancies.values());
    }
    getUnresolvedDiscrepancies() {
        return Array.from(this.discrepancies.values()).filter(d => !d.isResolved);
    }
    updateDiscrepancy(id, updates) {
        const discrepancy = this.discrepancies.get(id);
        if (discrepancy) {
            const updatedDiscrepancy = { ...discrepancy, ...updates };
            this.discrepancies.set(id, updatedDiscrepancy);
            return updatedDiscrepancy;
        }
        return undefined;
    }
    clearDiscrepancies() {
        this.discrepancies.clear();
    }
    addAuditLog(log) {
        const auditLog = {
            ...log,
            id: this.generateId(),
            timestamp: new Date()
        };
        this.auditLogs.push(auditLog);
        return auditLog;
    }
    getAuditLogsByEntity(entityType, entityId) {
        return this.auditLogs.filter(log => log.entityType === entityType && log.entityId === entityId);
    }
    getAllAuditLogs() {
        return [...this.auditLogs];
    }
    addReconciliationRecord(record) {
        this.reconciliationRecords.push(record);
    }
    getReconciliationRecord(id) {
        return this.reconciliationRecords.find(r => r.id === id);
    }
    getLatestReconciliationRecord() {
        if (this.reconciliationRecords.length === 0)
            return undefined;
        return [...this.reconciliationRecords].sort((a, b) => new Date(b.reconciliationDate).getTime() - new Date(a.reconciliationDate).getTime())[0];
    }
    updateReconciliationRecord(id, updates) {
        const index = this.reconciliationRecords.findIndex(r => r.id === id);
        if (index !== -1) {
            this.reconciliationRecords[index] = { ...this.reconciliationRecords[index], ...updates };
            return this.reconciliationRecords[index];
        }
        return undefined;
    }
    refreshReconciliationStats(recordId) {
        const record = this.getReconciliationRecord(recordId);
        if (!record)
            return undefined;
        const allDiscrepancies = this.getAllDiscrepancies();
        const resolvedCount = allDiscrepancies.filter(d => d.isResolved).length;
        const pendingCount = allDiscrepancies.filter(d => !d.isResolved).length;
        return this.updateReconciliationRecord(recordId, {
            discrepanciesFound: allDiscrepancies.length,
            discrepanciesResolved: resolvedCount,
            discrepanciesPending: pendingCount
        });
    }
    getAllReconciliationRecords() {
        return [...this.reconciliationRecords];
    }
    addReviewDecision(decision) {
        this.reviewDecisions.push(decision);
    }
    getReviewDecision(id) {
        return this.reviewDecisions.find(d => d.id === id);
    }
    getReviewDecisionsByDiscrepancy(discrepancyId) {
        return this.reviewDecisions.filter(d => d.discrepancyId === discrepancyId);
    }
    getAllReviewDecisions() {
        return [...this.reviewDecisions];
    }
    clearAll() {
        this.clearBeds();
        this.clearPatients();
        this.clearWorkOrders();
        this.clearDiscrepancies();
        this.auditLogs = [];
        this.reconciliationRecords = [];
        this.reviewDecisions = [];
    }
}
exports.DataStore = DataStore;
exports.dataStore = DataStore.getInstance();
//# sourceMappingURL=DataStore.js.map