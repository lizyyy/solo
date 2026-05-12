import { db } from './index.js';
import { v4 as uuidv4 } from 'uuid';
import type { Service, Endpoint, BudgetRule, MetricPoint, ExceptionApproval, FreezeRecord } from '../types/index.js';

export const serviceDAO = {
  getAll: () => [...db.services].sort((a, b) => a.name.localeCompare(b.name)),
  getById: (id: string) => db.services.find(s => s.id === id) || null,
  create: (service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newService: Service = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...service,
    };
    db.services.push(newService);
    return newService;
  },
  update: (id: string, updates: Partial<Omit<Service, 'id' | 'createdAt'>>) => {
    const index = db.services.findIndex(s => s.id === id);
    if (index === -1) return null;
    db.services[index] = {
      ...db.services[index],
      ...updates,
      updatedAt: Date.now(),
    };
    return db.services[index];
  },
};

export const endpointDAO = {
  getAll: () => [...db.endpoints].sort((a, b) => 
    a.serviceId.localeCompare(b.serviceId) || a.path.localeCompare(b.path)
  ),
  getByService: (serviceId: string) => 
    db.endpoints.filter(e => e.serviceId === serviceId).sort((a, b) => a.path.localeCompare(b.path)),
  getById: (id: string) => db.endpoints.find(e => e.id === id) || null,
  create: (endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newEndpoint: Endpoint = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...endpoint,
    };
    db.endpoints.push(newEndpoint);
    return newEndpoint;
  },
};

export const budgetRuleDAO = {
  getAllActive: () => db.budgetRules.filter(r => r.isActive).sort((a, b) => a.serviceId.localeCompare(b.serviceId)),
  getByService: (serviceId: string) => 
    db.budgetRules.filter(r => r.serviceId === serviceId && r.isActive),
  getById: (id: string) => db.budgetRules.find(r => r.id === id) || null,
  create: (rule: Omit<BudgetRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newRule: BudgetRule = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      isActive: true,
      ...rule,
    };
    db.budgetRules.push(newRule);
    return newRule;
  },
  deactivate: (id: string) => {
    const index = db.budgetRules.findIndex(r => r.id === id);
    if (index !== -1) {
      db.budgetRules[index].isActive = false;
      db.budgetRules[index].updatedAt = Date.now();
    }
  },
};

export const metricDAO = {
  getByServiceTimeRange: (serviceId: string, startTime: number, endTime: number) =>
    db.metricPoints
      .filter(m => m.serviceId === serviceId && m.timestamp >= startTime && m.timestamp <= endTime)
      .sort((a, b) => a.timestamp - b.timestamp),
  
  getByEndpointTimeRange: (endpointId: string, startTime: number, endTime: number) =>
    db.metricPoints
      .filter(m => m.endpointId === endpointId && m.timestamp >= startTime && m.timestamp <= endTime)
      .sort((a, b) => a.timestamp - b.timestamp),
  
  getLastForService: (serviceId: string) => {
    const points = db.metricPoints
      .filter(m => m.serviceId === serviceId && m.endpointId === null)
      .sort((a, b) => b.timestamp - a.timestamp);
    return points[0] || null;
  },
  
  getLastForEndpoint: (endpointId: string) => {
    const points = db.metricPoints
      .filter(m => m.endpointId === endpointId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return points[0] || null;
  },
  
  insertBatch: (metrics: Omit<MetricPoint, 'id' | 'createdAt'>[]) => {
    const now = Date.now();
    for (const m of metrics) {
      const newPoint: MetricPoint = {
        id: uuidv4(),
        createdAt: now,
        ...m,
      };
      db.metricPoints.push(newPoint);
    }
  },
};

export const exceptionDAO = {
  getAll: () => [...db.exceptionApprovals].sort((a, b) => b.createdAt - a.createdAt),
  getActiveApproved: (serviceId: string, now: number) =>
    db.exceptionApprovals
      .filter(e => e.serviceId === serviceId && e.status === 'approved' && e.expiresAt > now)
      .sort((a, b) => b.expiresAt - a.expiresAt),
  getById: (id: string) => db.exceptionApprovals.find(e => e.id === id) || null,
  create: (approval: Omit<ExceptionApproval, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newApproval: ExceptionApproval = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...approval,
    };
    db.exceptionApprovals.push(newApproval);
    return newApproval;
  },
  updateStatus: (id: string, status: ExceptionApproval['status'], approvedBy?: string) => {
    const index = db.exceptionApprovals.findIndex(e => e.id === id);
    if (index === -1) return null;
    db.exceptionApprovals[index].status = status;
    db.exceptionApprovals[index].updatedAt = Date.now();
    if (approvedBy) {
      db.exceptionApprovals[index].approvedBy = approvedBy;
    }
    return db.exceptionApprovals[index];
  },
  markExpired: (ids: string[]) => {
    for (const id of ids) {
      const index = db.exceptionApprovals.findIndex(e => e.id === id);
      if (index !== -1) {
        db.exceptionApprovals[index].status = 'expired';
        db.exceptionApprovals[index].updatedAt = Date.now();
      }
    }
  },
};

export const freezeDAO = {
  getAll: () => [...db.freezeRecords].sort((a, b) => b.createdAt - a.createdAt),
  getActiveByService: (serviceId: string) =>
    db.freezeRecords
      .filter(f => f.serviceId === serviceId && f.isActive)
      .sort((a, b) => b.createdAt - a.createdAt),
  getById: (id: string) => db.freezeRecords.find(f => f.id === id) || null,
  create: (freeze: Omit<FreezeRecord, 'id' | 'createdAt' | 'liftedAt' | 'liftedBy'>) => {
    const now = Date.now();
    const newFreeze: FreezeRecord = {
      id: uuidv4(),
      createdAt: now,
      liftedAt: null,
      liftedBy: null,
      isActive: true,
      ...freeze,
    };
    db.freezeRecords.push(newFreeze);
    return newFreeze;
  },
  lift: (id: string, liftedBy: string) => {
    const index = db.freezeRecords.findIndex(f => f.id === id);
    if (index === -1) return null;
    db.freezeRecords[index].isActive = false;
    db.freezeRecords[index].liftedAt = Date.now();
    db.freezeRecords[index].liftedBy = liftedBy;
    return db.freezeRecords[index];
  },
};
