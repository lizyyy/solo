import { 
  BudgetPool, 
  CreateBudgetPoolRequest, 
  UUID,
  BudgetPoolRule
} from '../types';
import { 
  getBudgetPoolRepository,
  getCampaignRepository
} from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';
import { 
  addAmount, 
  subtractAmount, 
  greaterThan,
  formatAmount 
} from '../utils/amount';
import { 
  BudgetPoolNotFoundException, 
  InsufficientBudgetException,
  InvalidOperationException,
  EntityStateException,
  ValidationException
} from '../exceptions/AppException';
import { AuditService } from './AuditService';
import { RuleEngineService } from './RuleEngineService';

export class BudgetPoolService {
  private static instance: BudgetPoolService;

  private constructor() {}

  static getInstance(): BudgetPoolService {
    if (!BudgetPoolService.instance) {
      BudgetPoolService.instance = new BudgetPoolService();
    }
    return BudgetPoolService.instance;
  }

  async createBudgetPool(request: CreateBudgetPoolRequest, operator?: string): Promise<BudgetPool> {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException({ name: 'Name is required' });
    }
    if (!greaterThan(request.totalAmount, 0)) {
      throw new ValidationException({ totalAmount: 'Total amount must be greater than zero' });
    }

    const rules: BudgetPoolRule[] = [];
    if (request.dailyLimit) {
      rules.push({
        type: 'DAILY_LIMIT',
        value: request.dailyLimit,
        priority: 1,
        description: 'Daily spending limit',
      });
    }
    if (request.rules) {
      rules.push(...request.rules);
    }

    const budgetPool: BudgetPool = {
      id: generateId(),
      name: request.name,
      description: request.description,
      totalAmount: formatAmount(request.totalAmount),
      allocatedAmount: 0,
      consumedAmount: 0,
      refundedAmount: 0,
      compensatedAmount: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      startDate: request.startDate,
      endDate: request.endDate,
      dailyLimit: request.dailyLimit,
      rules,
    };

    const saved = await getBudgetPoolRepository().save(budgetPool);

    await AuditService.getInstance().logAction(
      'CREATE_BUDGET_POOL',
      'BudgetPool',
      saved.id,
      {
        operator,
        afterState: this.toLoggableState(saved),
        reason: 'Created new budget pool',
      }
    );

    return saved;
  }

  async getBudgetPool(id: UUID): Promise<BudgetPool> {
    const budgetPool = await getBudgetPoolRepository().findById(id);
    if (!budgetPool) {
      throw new BudgetPoolNotFoundException(id);
    }
    return budgetPool;
  }

  async getAllBudgetPools(): Promise<BudgetPool[]> {
    return getBudgetPoolRepository().findAll();
  }

  async getAvailableAmount(budgetPoolId: UUID): Promise<number> {
    const budgetPool = await this.getBudgetPool(budgetPoolId);
    return this.calculateAvailableAmount(budgetPool);
  }

  calculateAvailableAmount(budgetPool: BudgetPool): number {
    const netConsumed = subtractAmount(
      subtractAmount(budgetPool.consumedAmount, budgetPool.refundedAmount),
      budgetPool.compensatedAmount
    );
    return subtractAmount(budgetPool.totalAmount, netConsumed);
  }

  calculateAllocatedAvailable(budgetPool: BudgetPool): number {
    const available = this.calculateAvailableAmount(budgetPool);
    return subtractAmount(available, budgetPool.allocatedAmount);
  }

  async updateStatus(id: UUID, status: 'PAUSED' | 'ACTIVE' | 'ARCHIVED', operator?: string): Promise<BudgetPool> {
    const budgetPool = await this.getBudgetPool(id);
    const beforeState = this.toLoggableState(budgetPool);

    if (budgetPool.status === 'ARCHIVED') {
      throw new EntityStateException('BudgetPool', budgetPool.status, ['ACTIVE', 'PAUSED']);
    }

    budgetPool.status = status;
    budgetPool.updatedAt = new Date();

    const saved = await getBudgetPoolRepository().save(budgetPool);

    await AuditService.getInstance().logAction(
      `UPDATE_STATUS_${status}`,
      'BudgetPool',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: `Status updated to ${status}`,
      }
    );

    return saved;
  }

  async addBudget(id: UUID, amount: number, operator?: string, reason?: string): Promise<BudgetPool> {
    if (!greaterThan(amount, 0)) {
      throw new ValidationException({ amount: 'Amount must be greater than zero' });
    }

    const budgetPool = await this.getBudgetPool(id);
    if (budgetPool.status === 'ARCHIVED') {
      throw new EntityStateException('BudgetPool', budgetPool.status, ['ACTIVE', 'PAUSED']);
    }

    const beforeState = this.toLoggableState(budgetPool);

    budgetPool.totalAmount = addAmount(budgetPool.totalAmount, amount);
    budgetPool.updatedAt = new Date();

    const saved = await getBudgetPoolRepository().save(budgetPool);

    await AuditService.getInstance().logAction(
      'ADD_BUDGET',
      'BudgetPool',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: reason || `Added ${amount} to budget`,
      }
    );

    return saved;
  }

  async allocateBudget(budgetPoolId: UUID, campaignId: UUID, amount: number, operator?: string): Promise<BudgetPool> {
    if (!greaterThan(amount, 0)) {
      throw new ValidationException({ amount: 'Allocation amount must be greater than zero' });
    }

    const budgetPool = await this.getBudgetPool(budgetPoolId);
    const available = this.calculateAllocatedAvailable(budgetPool);

    if (greaterThan(amount, available)) {
      throw new InsufficientBudgetException(available, amount, 'Allocation request');
    }

    const beforeState = this.toLoggableState(budgetPool);

    budgetPool.allocatedAmount = addAmount(budgetPool.allocatedAmount, amount);
    budgetPool.updatedAt = new Date();

    const saved = await getBudgetPoolRepository().save(budgetPool);

    await AuditService.getInstance().logAction(
      'ALLOCATE_BUDGET',
      'BudgetPool',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: `Allocated ${amount} to campaign ${campaignId}`,
      }
    );

    return saved;
  }

  async deallocateBudget(budgetPoolId: UUID, campaignId: UUID, amount: number, operator?: string): Promise<BudgetPool> {
    if (!greaterThan(amount, 0)) {
      throw new ValidationException({ amount: 'Deallocation amount must be greater than zero' });
    }

    const budgetPool = await this.getBudgetPool(budgetPoolId);

    if (greaterThan(amount, budgetPool.allocatedAmount)) {
      throw new InvalidOperationException(
        'DEALLOCATE_BUDGET',
        `Cannot deallocate more than allocated. Allocated: ${budgetPool.allocatedAmount}, Requested: ${amount}`
      );
    }

    const beforeState = this.toLoggableState(budgetPool);

    budgetPool.allocatedAmount = subtractAmount(budgetPool.allocatedAmount, amount);
    budgetPool.updatedAt = new Date();

    const saved = await getBudgetPoolRepository().save(budgetPool);

    await AuditService.getInstance().logAction(
      'DEALLOCATE_BUDGET',
      'BudgetPool',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: `Deallocated ${amount} from campaign ${campaignId}`,
      }
    );

    return saved;
  }

  async checkBudgetExhaustion(budgetPool: BudgetPool): Promise<BudgetPool> {
    const available = this.calculateAvailableAmount(budgetPool);
    if (budgetPool.status === 'ACTIVE' && available <= 0) {
      budgetPool.status = 'EXHAUSTED';
      budgetPool.updatedAt = new Date();
      const saved = await getBudgetPoolRepository().save(budgetPool);

      await AuditService.getInstance().logAction(
        'BUDGET_EXHAUSTED',
        'BudgetPool',
        saved.id,
        {
          afterState: this.toLoggableState(saved),
          reason: 'Budget pool exhausted',
        }
      );
      return saved;
    }
    return budgetPool;
  }

  private toLoggableState(budgetPool: BudgetPool): Record<string, any> {
    return {
      id: budgetPool.id,
      name: budgetPool.name,
      status: budgetPool.status,
      totalAmount: budgetPool.totalAmount,
      allocatedAmount: budgetPool.allocatedAmount,
      consumedAmount: budgetPool.consumedAmount,
      refundedAmount: budgetPool.refundedAmount,
      compensatedAmount: budgetPool.compensatedAmount,
      updatedAt: budgetPool.updatedAt,
    };
  }
}
