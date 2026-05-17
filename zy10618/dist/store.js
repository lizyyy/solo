"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const uuid_1 = require("uuid");
class DataStore {
    advertisers = new Map();
    adPlans = new Map();
    spendCallbacks = new Map();
    reviewRecords = new Map();
    addAdvertiser(advertiser) {
        const id = (0, uuid_1.v4)();
        const newAdvertiser = {
            ...advertiser,
            id,
            createdAt: new Date()
        };
        this.advertisers.set(id, newAdvertiser);
        return newAdvertiser;
    }
    getAdvertiser(id) {
        return this.advertisers.get(id);
    }
    getAllAdvertisers() {
        return Array.from(this.advertisers.values());
    }
    addAdPlan(plan) {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const newPlan = {
            ...plan,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.adPlans.set(id, newPlan);
        return newPlan;
    }
    updateAdPlan(id, updates) {
        const plan = this.adPlans.get(id);
        if (!plan)
            return undefined;
        const updatedPlan = {
            ...plan,
            ...updates,
            updatedAt: new Date()
        };
        this.adPlans.set(id, updatedPlan);
        return updatedPlan;
    }
    getAdPlan(id) {
        return this.adPlans.get(id);
    }
    getAllAdPlans() {
        return Array.from(this.adPlans.values());
    }
    getAdPlansByAdvertiser(advertiserId) {
        return this.getAllAdPlans().filter(p => p.advertiserId === advertiserId);
    }
    addSpendCallback(callback) {
        const id = (0, uuid_1.v4)();
        const newCallback = {
            ...callback,
            id,
            createdAt: new Date()
        };
        this.spendCallbacks.set(id, newCallback);
        return newCallback;
    }
    getSpendCallbacksByPlan(planId) {
        return Array.from(this.spendCallbacks.values())
            .filter(c => c.planId === planId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    addReviewRecord(record) {
        const id = (0, uuid_1.v4)();
        const newRecord = {
            ...record,
            id,
            createdAt: new Date()
        };
        this.reviewRecords.set(id, newRecord);
        return newRecord;
    }
    getReviewRecordsByPlan(planId) {
        return Array.from(this.reviewRecords.values())
            .filter(r => r.planId === planId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    clear() {
        this.advertisers.clear();
        this.adPlans.clear();
        this.spendCallbacks.clear();
        this.reviewRecords.clear();
    }
}
exports.store = new DataStore();
