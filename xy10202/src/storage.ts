import { v4 as uuidv4 } from 'uuid';
import { Site, Order, RiskEvent, Rebooking, ResourceLock, ProblemRecord, IdempotentRecord } from './types';

class Storage {
  private sites: Map<string, Site> = new Map();
  private orders: Map<string, Order> = new Map();
  private events: Map<string, RiskEvent> = new Map();
  private rebookings: Map<string, Rebooking> = new Map();
  private locks: Map<string, ResourceLock> = new Map();
  private problems: Map<string, ProblemRecord> = new Map();
  private idempotentRecords: Map<string, IdempotentRecord> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const dayAfter = new Date(Date.now() + 172800000).toISOString();

    const sampleSites: Site[] = [
      { siteId: uuidv4(), siteNumber: 'A01', type: 'LOW_LYING', elevation: 5, distanceToWater: 10, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
      { siteId: uuidv4(), siteNumber: 'A02', type: 'LOW_LYING', elevation: 7, distanceToWater: 15, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
      { siteId: uuidv4(), siteNumber: 'A03', type: 'LOW_LYING', elevation: 3, distanceToWater: 5, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
      { siteId: uuidv4(), siteNumber: 'B01', type: 'STANDARD', elevation: 25, distanceToWater: 100, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
      { siteId: uuidv4(), siteNumber: 'B02', type: 'STANDARD', elevation: 30, distanceToWater: 120, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true } },
      { siteId: uuidv4(), siteNumber: 'C01', type: 'ELEVATED', elevation: 100, distanceToWater: 500, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true, hasView: true } },
      { siteId: uuidv4(), siteNumber: 'C02', type: 'ELEVATED', elevation: 120, distanceToWater: 600, riskLevel: 'NO_RISK', isOccupied: false, isLocked: false, lockedBy: null, attributes: { hasPower: true, hasView: true } },
      { siteId: uuidv4(), siteNumber: 'D01', type: 'PREMIUM', elevation: 80, distanceToWater: 300, riskLevel: 'NO_RISK', isOccupied: true, isLocked: false, lockedBy: null, attributes: { hasPower: true, privateBathroom: true } },
    ];

    sampleSites.forEach(site => this.sites.set(site.siteId, site));

    const siteA01 = sampleSites[0];
    const siteA02 = sampleSites[1];
    const siteB01 = sampleSites[3];
    const siteD01 = sampleSites[7];

    const sampleOrders: Order[] = [
      { orderId: uuidv4(), orderNumber: 'ORD-2026-001', customerName: '张三', siteId: siteA01.siteId, checkInDate: now, checkOutDate: dayAfter, status: 'CHECKED_IN', guestCount: 4, isCheckedin: true },
      { orderId: uuidv4(), orderNumber: 'ORD-2026-002', customerName: '李四', siteId: siteA02.siteId, checkInDate: tomorrow, checkOutDate: dayAfter, status: 'CONFIRMED', guestCount: 2, isCheckedin: false },
      { orderId: uuidv4(), orderNumber: 'ORD-2026-003', customerName: '王五', siteId: siteB01.siteId, checkInDate: now, checkOutDate: tomorrow, status: 'CHECKED_IN', guestCount: 3, isCheckedin: true },
      { orderId: uuidv4(), orderNumber: 'ORD-2026-004', customerName: '赵六', siteId: siteD01.siteId, checkInDate: tomorrow, checkOutDate: dayAfter, status: 'CONFIRMED', guestCount: 5, isCheckedin: false },
    ];

    sampleOrders.forEach(order => this.orders.set(order.orderId, order));
  }

  getSite(siteId: string): Site | undefined {
    return this.sites.get(siteId);
  }

  getAllSites(): Site[] {
    return Array.from(this.sites.values());
  }

  updateSite(site: Site): Site {
    this.sites.set(site.siteId, site);
    return site;
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  getOrdersBySite(siteId: string): Order[] {
    return Array.from(this.orders.values()).filter(o => o.siteId === siteId && ['CONFIRMED', 'CHECKED_IN'].includes(o.status));
  }

  updateOrder(order: Order): Order {
    this.orders.set(order.orderId, order);
    return order;
  }

  createEvent(event: RiskEvent): RiskEvent {
    this.events.set(event.eventId, event);
    return event;
  }

  getEvent(eventId: string): RiskEvent | undefined {
    return this.events.get(eventId);
  }

  getAllEvents(): RiskEvent[] {
    return Array.from(this.events.values());
  }

  updateEvent(event: RiskEvent): RiskEvent {
    this.events.set(event.eventId, event);
    return event;
  }

  createRebooking(rebooking: Rebooking): Rebooking {
    this.rebookings.set(rebooking.rebookingId, rebooking);
    return rebooking;
  }

  getRebooking(rebookingId: string): Rebooking | undefined {
    return this.rebookings.get(rebookingId);
  }

  getAllRebookings(): Rebooking[] {
    return Array.from(this.rebookings.values());
  }

  getRebookingsByEvent(eventId: string): Rebooking[] {
    return Array.from(this.rebookings.values()).filter(r => r.eventId === eventId);
  }

  updateRebooking(rebooking: Rebooking): Rebooking {
    this.rebookings.set(rebooking.rebookingId, rebooking);
    return rebooking;
  }

  createLock(lock: ResourceLock): ResourceLock {
    this.locks.set(lock.lockId, lock);
    return lock;
  }

  getLock(lockId: string): ResourceLock | undefined {
    return this.locks.get(lockId);
  }

  getActiveLocksBySite(siteId: string): ResourceLock[] {
    return Array.from(this.locks.values()).filter(l => l.siteId === siteId && l.isActive);
  }

  updateLock(lock: ResourceLock): ResourceLock {
    this.locks.set(lock.lockId, lock);
    return lock;
  }

  createProblem(problem: ProblemRecord): ProblemRecord {
    this.problems.set(problem.problemId, problem);
    return problem;
  }

  getProblems(): ProblemRecord[] {
    return Array.from(this.problems.values());
  }

  createIdempotentRecord(record: IdempotentRecord): IdempotentRecord {
    this.idempotentRecords.set(record.requestId, record);
    return record;
  }

  getIdempotentRecord(requestId: string): IdempotentRecord | undefined {
    return this.idempotentRecords.get(requestId);
  }

  cleanupExpiredRecords(): void {
    const now = new Date();
    for (const [key, record] of this.idempotentRecords) {
      if (new Date(record.expiresAt) < now) {
        this.idempotentRecords.delete(key);
      }
    }
  }
}

export const storage = new Storage();
