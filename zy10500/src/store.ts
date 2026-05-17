import { v4 as uuidv4 } from 'uuid';
import { ChangeOrder, Dependency, ChangeOrderStatus, DependencyStatus, ExecutionSummary } from './types';

class ChangeOrderStore {
  private changeOrders: Map<string, ChangeOrder> = new Map();
  private changeOrderNoIndex: Map<string, string> = new Map();

  generateId(): string {
    return uuidv4();
  }

  createChangeOrder(data: Omit<ChangeOrder, 'id' | 'createdAt' | 'updatedAt' | 'executionSummaries'>): ChangeOrder {
    const now = new Date().toISOString();
    const id = this.generateId();
    
    const changeOrder: ChangeOrder = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      executionSummaries: []
    };

    this.changeOrders.set(id, changeOrder);
    this.changeOrderNoIndex.set(data.changeOrderNo, id);

    return changeOrder;
  }

  getChangeOrderById(id: string): ChangeOrder | undefined {
    return this.changeOrders.get(id);
  }

  getChangeOrderByNo(changeOrderNo: string): ChangeOrder | undefined {
    const id = this.changeOrderNoIndex.get(changeOrderNo);
    return id ? this.changeOrders.get(id) : undefined;
  }

  getAllChangeOrders(): ChangeOrder[] {
    return Array.from(this.changeOrders.values());
  }

  updateChangeOrder(id: string, updates: Partial<ChangeOrder>): ChangeOrder | undefined {
    const changeOrder = this.changeOrders.get(id);
    if (!changeOrder) return undefined;

    const updated = {
      ...changeOrder,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.changeOrders.set(id, updated);
    return updated;
  }

  addExecutionSummary(changeOrderId: string, summary: Omit<ExecutionSummary, 'timestamp'>): ChangeOrder | undefined {
    const changeOrder = this.changeOrders.get(changeOrderId);
    if (!changeOrder) return undefined;

    const executionSummary: ExecutionSummary = {
      ...summary,
      timestamp: new Date().toISOString()
    };

    changeOrder.executionSummaries.push(executionSummary);
    changeOrder.updatedAt = new Date().toISOString();

    this.changeOrders.set(changeOrderId, changeOrder);
    return changeOrder;
  }

  existsByChangeOrderNo(changeOrderNo: string): boolean {
    return this.changeOrderNoIndex.has(changeOrderNo);
  }

  createDependency(data: Omit<Dependency, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Dependency {
    const now = new Date().toISOString();
    return {
      ...data,
      id: this.generateId(),
      status: DependencyStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };
  }
}

export const store = new ChangeOrderStore();
