"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = exports.DataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.mentors = new Map();
        this.applications = new Map();
        this.transfers = new Map();
        this.processedBatches = new Set();
        this.studentApplications = new Map();
    }
    addMentor(mentor) {
        this.mentors.set(mentor.id, mentor);
    }
    getMentor(id) {
        return this.mentors.get(id);
    }
    getAllMentors() {
        return Array.from(this.mentors.values());
    }
    updateMentorQuota(mentorId, usedQuota) {
        const mentor = this.mentors.get(mentorId);
        if (mentor) {
            mentor.usedQuota = usedQuota;
        }
    }
    addApplication(app) {
        this.applications.set(app.id, app);
        const studentApps = this.studentApplications.get(app.studentId) || new Set();
        studentApps.add(app.id);
        this.studentApplications.set(app.studentId, studentApps);
    }
    getApplication(id) {
        return this.applications.get(id);
    }
    getApplicationsByStudent(studentId) {
        const appIds = this.studentApplications.get(studentId) || new Set();
        return Array.from(appIds).map(id => this.applications.get(id)).filter(Boolean);
    }
    getAllApplications() {
        return Array.from(this.applications.values());
    }
    addTransfer(transfer) {
        this.transfers.set(transfer.id, transfer);
    }
    getTransfer(id) {
        return this.transfers.get(id);
    }
    getAllTransfers() {
        return Array.from(this.transfers.values());
    }
    markBatchProcessed(batchId) {
        this.processedBatches.add(batchId);
    }
    isBatchProcessed(batchId) {
        return this.processedBatches.has(batchId);
    }
    reset() {
        this.mentors.clear();
        this.applications.clear();
        this.transfers.clear();
        this.processedBatches.clear();
        this.studentApplications.clear();
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
