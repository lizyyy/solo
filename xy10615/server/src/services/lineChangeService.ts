import { store } from '../store';
import { LineChangePlan, LineChangeStatus } from '../types';

export class LineChangeService {
  createPlan(
    data: Omit<LineChangePlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    operator: string,
    operatorId: string,
    requestId: string
  ): LineChangePlan {
    const idempotent = store.checkIdempotent(requestId);
    if (idempotent.exists) {
      return idempotent.result;
    }

    const plan: LineChangePlan = {
      id: store.generateId(),
      ...data,
      createdAt: store.now(),
      updatedAt: store.now(),
      version: 1
    };

    store.lineChangePlans.set(plan.id, plan);
    store.addStatusHistory(plan.id, 'LINE_CHANGE', plan.status, undefined, operator, operatorId, '创建换线计划');
    store.markIdempotent(requestId, 'LINE_CHANGE', 'CREATE', plan);

    return plan;
  }

  updatePlan(
    id: string,
    updates: Partial<Omit<LineChangePlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
    operator: string,
    operatorId: string
  ): LineChangePlan {
    const plan = store.lineChangePlans.get(id);
    if (!plan) {
      throw new Error('PLAN_NOT_FOUND');
    }

    const oldValues: Record<string, any> = {};
    Object.keys(updates).forEach(key => {
      oldValues[key] = (plan as any)[key];
    });

    const updatedPlan: LineChangePlan = {
      ...plan,
      ...updates,
      updatedAt: store.now(),
      version: plan.version + 1
    };

    store.lineChangePlans.set(id, updatedPlan);

    Object.entries(updates).forEach(([field, newValue]) => {
      const oldValue = oldValues[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        store.addChangeLog(id, 'LINE_CHANGE', field, oldValue, newValue, operator, operatorId);
      }
    });

    if (updates.status && updates.status !== plan.status) {
      store.addStatusHistory(id, 'LINE_CHANGE', updates.status, plan.status, operator, operatorId, '状态变更');
    }

    return updatedPlan;
  }

  getPlan(id: string): LineChangePlan | undefined {
    return store.lineChangePlans.get(id);
  }

  getAllPlans(): LineChangePlan[] {
    return Array.from(store.lineChangePlans.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getPlansByStatus(status: LineChangeStatus): LineChangePlan[] {
    return this.getAllPlans().filter(p => p.status === status);
  }

  getStatistics() {
    const plans = this.getAllPlans();
    const now = new Date();
    
    return {
      total: plans.length,
      byStatus: {
        DRAFT: plans.filter(p => p.status === 'DRAFT').length,
        PENDING: plans.filter(p => p.status === 'PENDING').length,
        IN_PROGRESS: plans.filter(p => p.status === 'IN_PROGRESS').length,
        COMPLETED: plans.filter(p => p.status === 'COMPLETED').length,
        REVIEW: plans.filter(p => p.status === 'REVIEW').length,
        REJECTED: plans.filter(p => p.status === 'REJECTED').length,
        CANCELLED: plans.filter(p => p.status === 'CANCELLED').length
      },
      todayPlans: plans.filter(p => {
        const planDate = new Date(p.plannedStartTime);
        return planDate.toDateString() === now.toDateString();
      }).length,
      delayedPlans: plans.filter(p => {
        if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
        return new Date(p.plannedEndTime) < now;
      }).length
    };
  }
}

export const lineChangeService = new LineChangeService();
