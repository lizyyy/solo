"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
const uuid_1 = require("uuid");
class Storage {
    constructor() {
        this.sites = new Map();
        this.orders = new Map();
        this.events = new Map();
        this.rebookings = new Map();
        this.locks = new Map();
        this.problems = new Map();
        this.idempotentRecords = new Map();
        this.initializeSampleData();
    }
    initializeSampleData() {
        const now = new Date().toISOString();
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        const dayAfter = new Date(Date.now() + 172800000).toISOString();
        const sampleSites = [
            { siteId: (0, uuid_1.v4)(), siteNumber: 'A01', type: 'LOW_LYING', elevation: 5, distanceToWater: 10, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'A02', type: 'LOW_LYING', elevation: 7, distanceToWater: 15, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'A03', type: 'LOW_LYING', elevation: 3, distanceToWater: 5, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'B01', type: 'STANDARD', elevation: 25, distanceToWater: 100, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'B02', type: 'STANDARD', elevation: 30, distanceToWater: 120, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'C01', type: 'ELEVATED', elevation: 100, distanceToWater: 500, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true, hasView: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'C02', type: 'ELEVATED', elevation: 120, distanceToWater: 600, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true, hasView: true } },
            { siteId: (0, uuid_1.v4)(), siteNumber: 'D01', type: 'PREMIUM', elevation: 80, distanceToWater: 300, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true, privateBathroom: true } },
        ];
        sampleSites.forEach(site => this.sites.set(site.siteId, site));
        const siteA01 = sampleSites[0];
        const siteA02 = sampleSites[1];
        const siteB01 = sampleSites[3];
        const siteD01 = sampleSites[7];
        const sampleOrders = [
            { orderId: (0, uuid_1.v4)(), orderNumber: 'ORD-2026-001', customerName: '张三', siteId: siteA01.siteId, checkInDate: now, checkOutDate: dayAfter, status: 'CHECKED_IN', guestCount: 4, isCheckedin: true },
            { orderId: (0, uuid_1.v4)(), orderNumber: 'ORD-2026-002', customerName: '李四', siteId: siteA02.siteId, checkInDate: tomorrow, checkOutDate: dayAfter, status: 'CONFIRMED', guestCount: 2, isCheckedin: false },
            { orderId: (0, uuid_1.v4)(), orderNumber: 'ORD-2026-003', customerName: '王五', siteId: siteB01.siteId, checkInDate: now, checkOutDate: tomorrow, status: 'CHECKED_IN', guestCount: 3, isCheckedin: true },
            { orderId: (0, uuid_1.v4)(), orderNumber: 'ORD-2026-004', customerName: '赵六', siteId: siteD01.siteId, checkInDate: tomorrow, checkOutDate: dayAfter, status: 'CONFIRMED', guestCount: 5, isCheckedin: false },
        ];
        sampleOrders.forEach(order => this.orders.set(order.orderId, order));
    }
    getSite(siteId) {
        return this.sites.get(siteId);
    }
    getAllSites() {
        return Array.from(this.sites.values());
    }
    updateSite(site) {
        this.sites.set(site.siteId, site);
        return site;
    }
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    getAllOrders() {
        return Array.from(this.orders.values());
    }
    getOrdersBySite(siteId) {
        return Array.from(this.orders.values()).filter(o => o.siteId === siteId && ['CONFIRMED', 'CHECKED_IN'].includes(o.status));
    }
    updateOrder(order) {
        this.orders.set(order.orderId, order);
        return order;
    }
    createEvent(event) {
        this.events.set(event.eventId, event);
        return event;
    }
    getEvent(eventId) {
        return this.events.get(eventId);
    }
    getAllEvents() {
        return Array.from(this.events.values());
    }
    updateEvent(event) {
        this.events.set(event.eventId, event);
        return event;
    }
    createRebooking(rebooking) {
        this.rebookings.set(rebooking.rebookingId, rebooking);
        return rebooking;
    }
    getRebooking(rebookingId) {
        return this.rebookings.get(rebookingId);
    }
    getAllRebookings() {
        return Array.from(this.rebookings.values());
    }
    getRebookingsByEvent(eventId) {
        return Array.from(this.rebookings.values()).filter(r => r.eventId === eventId);
    }
    updateRebooking(rebooking) {
        this.rebookings.set(rebooking.rebookingId, rebooking);
        return rebooking;
    }
    createLock(lock) {
        this.locks.set(lock.lockId, lock);
        return lock;
    }
    getLock(lockId) {
        return this.locks.get(lockId);
    }
    getActiveLocksBySite(siteId) {
        return Array.from(this.locks.values()).filter(l => l.siteId === siteId && l.isActive);
    }
    updateLock(lock) {
        this.locks.set(lock.lockId, lock);
        return lock;
    }
    createProblem(problem) {
        this.problems.set(problem.problemId, problem);
        return problem;
    }
    getProblems() {
        return Array.from(this.problems.values());
    }
    createIdempotentRecord(record) {
        this.idempotentRecords.set(record.requestId, record);
        return record;
    }
    getIdempotentRecord(requestId) {
        return this.idempotentRecords.get(requestId);
    }
    cleanupExpiredRecords() {
        const now = new Date();
        for (const [key, record] of this.idempotentRecords) {
            if (new Date(record.expiresAt) < now) {
                this.idempotentRecords.delete(key);
            }
        }
    }
}
exports.storage = new Storage();
//# sourceMappingURL=storage.js.map