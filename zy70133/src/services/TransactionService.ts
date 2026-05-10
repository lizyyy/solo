import { 
  Transaction, 
  DeductRequest, 
  RefundRequest,
  CompensateRequest,
  RevertRequest,
  UUID,
  RuleEvaluationResult,
  TransactionType,
  TransactionStatus
} from '../types';
import { 
  getTransactionRepository,
  getBudgetPoolRepository,
  getCampaignRepository,
  getBindingRepository,
  getChannelRepository
} from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';
import { 
  addAmount, 
  subtractAmount, 
  greaterThan,
  formatAmount,
  lessThanOrEqual
} from '../utils/amount';
import { 
  TransactionNotFoundException,
  InsufficientBudgetException,
  InvalidOperationException,
  ValidationException,
  EntityStateException
} from '../exceptions/AppException';
import { AuditService } from './AuditService';
import { BudgetPoolService } from './BudgetPoolService';
import { RuleEngineService, RuleContext } from './RuleEngineService';
import { MaterialBindingService } from './MaterialBindingService';

interface TransactionExecutionContext {
  transaction: Transaction;
  budgetPoolBefore: any;
  campaignBefore?: any;
  bindingBefore?: any;
}

export class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  async deduct(request: DeductRequest): Promise<Transaction> {
    if (!greaterThan(request.amount, 0)) {
      throw new ValidationException({ amount: 'Deduct amount must be greater than zero' });
    }
    if (!request.reason || request.reason.trim().length === 0) {
      throw new ValidationException({ reason: 'Reason is required' });
    }

    const budgetPoolService = BudgetPoolService.getInstance();
    const ruleEngine = RuleEngineService.getInstance();
    const bindingService = MaterialBindingService.getInstance();

    const budgetPool = await budgetPoolService.getBudgetPool(request.budgetPoolId);
    const channel = await getChannelRepository().findById(request.channelId);

    const available = budgetPoolService.calculateAvailableAmount(budgetPool);
    const dailyConsumed = await getTransactionRepository().getDailyConsumption(
      budgetPool.id,
      new Date()
    );

    const activeBindings = await bindingService.getActiveBindings(
      request.campaignId,
      request.channelId
    );

    const relevantBinding = activeBindings.find(b => b.materialId === request.materialId);
    if (!relevantBinding) {
      throw new InvalidOperationException(
        'DEDUCT',
        `Material ${request.materialId} is not actively bound to campaign ${request.campaignId} on channel ${request.channelId}`
      );
    }

    const ruleContext: RuleContext = {
      budgetPool,
      channel: channel || undefined,
      request,
      availableAmount: available,
      dailyConsumed,
      dailyLimit: budgetPool.dailyLimit,
    };

    const ruleEvaluation = await ruleEngine.evaluateAndThrow(ruleContext);

    const balanceBefore = available;
    const balanceAfter = subtractAmount(balanceBefore, request.amount);

    const transaction: Transaction = {
      id: generateId(),
      type: 'DEDUCT',
      budgetPoolId: budgetPool.id,
      campaignId: request.campaignId,
      materialId: request.materialId,
      channelId: request.channelId,
      bindingId: relevantBinding.id,
      amount: formatAmount(request.amount),
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      status: 'PENDING',
      reason: request.reason,
      operator: request.operator,
      metadata: request.metadata,
      ruleEvaluation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const executionContext: TransactionExecutionContext = {
      transaction,
      budgetPoolBefore: this.extractBudgetPoolState(budgetPool),
    };

    try {
      budgetPool.consumedAmount = addAmount(budgetPool.consumedAmount, request.amount);
      budgetPool.updatedAt = new Date();
      await getBudgetPoolRepository().save(budgetPool);

      const campaign = await getCampaignRepository().findById(request.campaignId);
      if (campaign) {
        executionContext.campaignBefore = this.extractCampaignState(campaign);
        campaign.consumedBudget = addAmount(campaign.consumedBudget, request.amount);
        campaign.updatedAt = new Date();
        await getCampaignRepository().save(campaign);
      }

      executionContext.bindingBefore = this.extractBindingState(relevantBinding);
      relevantBinding.consumedBudget = addAmount(relevantBinding.consumedBudget, request.amount);
      relevantBinding.updatedAt = new Date();
      await getBindingRepository().save(relevantBinding);

      transaction.status = 'SUCCESS';
      transaction.updatedAt = new Date();
      await getTransactionRepository().save(transaction);

      await budgetPoolService.checkBudgetExhaustion(budgetPool);

      await this.logTransactionEvent('TRANSACTION_DEDUCT_SUCCESS', transaction, executionContext);

      return { ...transaction };
    } catch (error) {
      transaction.status = 'FAILED';
      transaction.updatedAt = new Date();
      await getTransactionRepository().save(transaction);

      await this.logTransactionEvent('TRANSACTION_DEDUCT_FAILED', transaction, executionContext, error);

      throw error;
    }
  }

  async refund(request: RefundRequest): Promise<Transaction> {
    if (!greaterThan(request.amount, 0)) {
      throw new ValidationException({ amount: 'Refund amount must be greater than zero' });
    }
    if (!request.reason || request.reason.trim().length === 0) {
      throw new ValidationException({ reason: 'Reason is required' });
    }

    const originalTransaction = await this.getTransaction(request.transactionId);

    if (originalTransaction.type !== 'DEDUCT') {
      throw new InvalidOperationException(
        'REFUND',
        `Can only refund DEDUCT transactions. Original type: ${originalTransaction.type}`
      );
    }

    if (originalTransaction.status !== 'SUCCESS') {
      throw new EntityStateException(
        'Transaction',
        originalTransaction.status,
        ['SUCCESS']
      );
    }

    const existingRefunds = await getTransactionRepository().findRelatedTransactions(
      originalTransaction.id
    );
    const totalRefunded = existingRefunds
      .filter(t => t.type === 'REFUND' && t.status === 'SUCCESS')
      .reduce((sum, t) => addAmount(sum, t.amount), 0);

    const availableToRefund = subtractAmount(originalTransaction.amount, totalRefunded);
    if (greaterThan(request.amount, availableToRefund)) {
      throw new InsufficientBudgetException(
        availableToRefund,
        request.amount,
        'Refund cannot exceed original amount minus already refunded amount'
      );
    }

    const budgetPool = await getBudgetPoolRepository().findById(originalTransaction.budgetPoolId);
    if (!budgetPool) {
      throw new InvalidOperationException('REFUND', 'Budget pool no longer exists');
    }

    const balanceBefore = BudgetPoolService.getInstance().calculateAvailableAmount(budgetPool);
    const balanceAfter = addAmount(balanceBefore, request.amount);

    const refundTransaction: Transaction = {
      id: generateId(),
      type: 'REFUND',
      budgetPoolId: originalTransaction.budgetPoolId,
      campaignId: originalTransaction.campaignId,
      materialId: originalTransaction.materialId,
      channelId: originalTransaction.channelId,
      bindingId: originalTransaction.bindingId,
      amount: formatAmount(request.amount),
      balanceBefore,
      balanceAfter,
      status: 'PENDING',
      reason: request.reason,
      operator: request.operator,
      relatedTransactionId: originalTransaction.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const executionContext: TransactionExecutionContext = {
      transaction: refundTransaction,
      budgetPoolBefore: this.extractBudgetPoolState(budgetPool),
    };

    try {
      budgetPool.refundedAmount = addAmount(budgetPool.refundedAmount, request.amount);
      budgetPool.updatedAt = new Date();
      await getBudgetPoolRepository().save(budgetPool);

      if (originalTransaction.campaignId) {
        const campaign = await getCampaignRepository().findById(originalTransaction.campaignId);
        if (campaign) {
          executionContext.campaignBefore = this.extractCampaignState(campaign);
          campaign.refundedBudget = addAmount(campaign.refundedBudget, request.amount);
          campaign.updatedAt = new Date();
          await getCampaignRepository().save(campaign);
        }
      }

      if (originalTransaction.bindingId) {
        const binding = await getBindingRepository().findById(originalTransaction.bindingId);
        if (binding) {
          executionContext.bindingBefore = this.extractBindingState(binding);
          binding.refundedBudget = addAmount(binding.refundedBudget, request.amount);
          binding.updatedAt = new Date();
          await getBindingRepository().save(binding);
        }
      }

      refundTransaction.status = 'SUCCESS';
      refundTransaction.updatedAt = new Date();
      await getTransactionRepository().save(refundTransaction);

      await this.logTransactionEvent('TRANSACTION_REFUND_SUCCESS', refundTransaction, executionContext);

      return { ...refundTransaction };
    } catch (error) {
      refundTransaction.status = 'FAILED';
      refundTransaction.updatedAt = new Date();
      await getTransactionRepository().save(refundTransaction);

      await this.logTransactionEvent('TRANSACTION_REFUND_FAILED', refundTransaction, executionContext, error);

      throw error;
    }
  }

  async compensate(request: CompensateRequest): Promise<Transaction> {
    if (!greaterThan(request.amount, 0)) {
      throw new ValidationException({ amount: 'Compensate amount must be greater than zero' });
    }
    if (!request.reason || request.reason.trim().length === 0) {
      throw new ValidationException({ reason: 'Reason is required' });
    }

    const budgetPool = await getBudgetPoolRepository().findById(request.budgetPoolId);
    if (!budgetPool) {
      throw new InvalidOperationException('COMPENSATE', 'Budget pool not found');
    }

    let relatedTransaction: Transaction | undefined;
    if (request.transactionId) {
      relatedTransaction = await this.getTransaction(request.transactionId);
    }

    const balanceBefore = BudgetPoolService.getInstance().calculateAvailableAmount(budgetPool);
    const balanceAfter = addAmount(balanceBefore, request.amount);

    const compensateTransaction: Transaction = {
      id: generateId(),
      type: 'COMPENSATE',
      budgetPoolId: budgetPool.id,
      campaignId: request.campaignId || relatedTransaction?.campaignId,
      materialId: relatedTransaction?.materialId,
      channelId: relatedTransaction?.channelId,
      bindingId: relatedTransaction?.bindingId,
      amount: formatAmount(request.amount),
      balanceBefore,
      balanceAfter,
      status: 'PENDING',
      reason: request.reason,
      operator: request.operator,
      relatedTransactionId: relatedTransaction?.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const executionContext: TransactionExecutionContext = {
      transaction: compensateTransaction,
      budgetPoolBefore: this.extractBudgetPoolState(budgetPool),
    };

    try {
      budgetPool.compensatedAmount = addAmount(budgetPool.compensatedAmount, request.amount);
      budgetPool.updatedAt = new Date();
      await getBudgetPoolRepository().save(budgetPool);

      const campaignId = request.campaignId || relatedTransaction?.campaignId;
      if (campaignId) {
        const campaign = await getCampaignRepository().findById(campaignId);
        if (campaign) {
          executionContext.campaignBefore = this.extractCampaignState(campaign);
          campaign.compensatedBudget = addAmount(campaign.compensatedBudget, request.amount);
          campaign.updatedAt = new Date();
          await getCampaignRepository().save(campaign);
        }
      }

      if (relatedTransaction?.bindingId) {
        const binding = await getBindingRepository().findById(relatedTransaction.bindingId);
        if (binding) {
          executionContext.bindingBefore = this.extractBindingState(binding);
          binding.compensatedBudget = addAmount(binding.compensatedBudget, request.amount);
          binding.updatedAt = new Date();
          await getBindingRepository().save(binding);
        }
      }

      compensateTransaction.status = 'SUCCESS';
      compensateTransaction.updatedAt = new Date();
      await getTransactionRepository().save(compensateTransaction);

      await this.logTransactionEvent('TRANSACTION_COMPENSATE_SUCCESS', compensateTransaction, executionContext);

      return { ...compensateTransaction };
    } catch (error) {
      compensateTransaction.status = 'FAILED';
      compensateTransaction.updatedAt = new Date();
      await getTransactionRepository().save(compensateTransaction);

      await this.logTransactionEvent('TRANSACTION_COMPENSATE_FAILED', compensateTransaction, executionContext, error);

      throw error;
    }
  }

  async revert(request: RevertRequest): Promise<Transaction> {
    if (!request.reason || request.reason.trim().length === 0) {
      throw new ValidationException({ reason: 'Reason is required' });
    }

    const originalTransaction = await this.getTransaction(request.transactionId);

    if (['REVERT', 'REFUND', 'COMPENSATE'].includes(originalTransaction.type)) {
      throw new InvalidOperationException(
        'REVERT',
        `Cannot revert transactions of type: ${originalTransaction.type}`
      );
    }

    if (originalTransaction.status !== 'SUCCESS') {
      throw new EntityStateException(
        'Transaction',
        originalTransaction.status,
        ['SUCCESS']
      );
    }

    const existingReverts = await getTransactionRepository().findRelatedTransactions(
      originalTransaction.id
    );
    const hasExistingRevert = existingReverts.some(t => t.type === 'REVERT' && t.status === 'SUCCESS');
    if (hasExistingRevert) {
      throw new InvalidOperationException('REVERT', 'Transaction has already been reverted');
    }

    const budgetPool = await getBudgetPoolRepository().findById(originalTransaction.budgetPoolId);
    if (!budgetPool) {
      throw new InvalidOperationException('REVERT', 'Budget pool no longer exists');
    }

    const balanceBefore = BudgetPoolService.getInstance().calculateAvailableAmount(budgetPool);
    const balanceAfter = addAmount(balanceBefore, originalTransaction.amount);

    const revertTransaction: Transaction = {
      id: generateId(),
      type: 'REVERT',
      budgetPoolId: originalTransaction.budgetPoolId,
      campaignId: originalTransaction.campaignId,
      materialId: originalTransaction.materialId,
      channelId: originalTransaction.channelId,
      bindingId: originalTransaction.bindingId,
      amount: originalTransaction.amount,
      balanceBefore,
      balanceAfter,
      status: 'PENDING',
      reason: request.reason,
      operator: request.operator,
      relatedTransactionId: originalTransaction.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const executionContext: TransactionExecutionContext = {
      transaction: revertTransaction,
      budgetPoolBefore: this.extractBudgetPoolState(budgetPool),
    };

    try {
      budgetPool.compensatedAmount = addAmount(budgetPool.compensatedAmount, originalTransaction.amount);
      budgetPool.updatedAt = new Date();
      await getBudgetPoolRepository().save(budgetPool);

      if (originalTransaction.campaignId) {
        const campaign = await getCampaignRepository().findById(originalTransaction.campaignId);
        if (campaign) {
          executionContext.campaignBefore = this.extractCampaignState(campaign);
          campaign.compensatedBudget = addAmount(campaign.compensatedBudget, originalTransaction.amount);
          campaign.updatedAt = new Date();
          await getCampaignRepository().save(campaign);
        }
      }

      if (originalTransaction.bindingId) {
        const binding = await getBindingRepository().findById(originalTransaction.bindingId);
        if (binding) {
          executionContext.bindingBefore = this.extractBindingState(binding);
          binding.compensatedBudget = addAmount(binding.compensatedBudget, originalTransaction.amount);
          binding.updatedAt = new Date();
          await getBindingRepository().save(binding);
        }
      }

      originalTransaction.status = 'REVERTED';
      originalTransaction.updatedAt = new Date();
      await getTransactionRepository().save(originalTransaction);

      revertTransaction.status = 'SUCCESS';
      revertTransaction.updatedAt = new Date();
      await getTransactionRepository().save(revertTransaction);

      await this.logTransactionEvent('TRANSACTION_REVERT_SUCCESS', revertTransaction, executionContext);

      return { ...revertTransaction };
    } catch (error) {
      revertTransaction.status = 'FAILED';
      revertTransaction.updatedAt = new Date();
      await getTransactionRepository().save(revertTransaction);

      await this.logTransactionEvent('TRANSACTION_REVERT_FAILED', revertTransaction, executionContext, error);

      throw error;
    }
  }

  async getTransaction(id: UUID): Promise<Transaction> {
    const transaction = await getTransactionRepository().findById(id);
    if (!transaction) {
      throw new TransactionNotFoundException(id);
    }
    return transaction;
  }

  async getTransactionsByBudgetPool(budgetPoolId: UUID): Promise<Transaction[]> {
    return getTransactionRepository().findByBudgetPoolId(budgetPoolId);
  }

  async getTransactionsByCampaign(campaignId: UUID): Promise<Transaction[]> {
    return getTransactionRepository().findByCampaignId(campaignId);
  }

  async getTransactionHistory(transactionId: UUID): Promise<Transaction[]> {
    const mainTransaction = await this.getTransaction(transactionId);
    const related = await getTransactionRepository().findRelatedTransactions(transactionId);
    return [mainTransaction, ...related].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  private extractBudgetPoolState(budgetPool: any): Record<string, any> {
    return {
      id: budgetPool.id,
      name: budgetPool.name,
      status: budgetPool.status,
      totalAmount: budgetPool.totalAmount,
      consumedAmount: budgetPool.consumedAmount,
      refundedAmount: budgetPool.refundedAmount,
      compensatedAmount: budgetPool.compensatedAmount,
    };
  }

  private extractCampaignState(campaign: any): Record<string, any> {
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalBudget: campaign.totalBudget,
      consumedBudget: campaign.consumedBudget,
      refundedBudget: campaign.refundedBudget,
      compensatedBudget: campaign.compensatedBudget,
    };
  }

  private extractBindingState(binding: any): Record<string, any> {
    return {
      id: binding.id,
      materialId: binding.materialId,
      campaignId: binding.campaignId,
      channelId: binding.channelId,
      status: binding.status,
      allocatedBudget: binding.allocatedBudget,
      consumedBudget: binding.consumedBudget,
      refundedBudget: binding.refundedBudget,
      compensatedBudget: binding.compensatedBudget,
    };
  }

  private async logTransactionEvent(
    action: string,
    transaction: Transaction,
    executionContext: TransactionExecutionContext,
    error?: any
  ): Promise<void> {
    await AuditService.getInstance().logAction(
      action,
      'Transaction',
      transaction.id,
      {
        operator: transaction.operator,
        beforeState: {
          budgetPool: executionContext.budgetPoolBefore,
          campaign: executionContext.campaignBefore,
          binding: executionContext.bindingBefore,
          transaction: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            status: 'PENDING',
          },
        },
        afterState: {
          transaction: {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            status: transaction.status,
            balanceBefore: transaction.balanceBefore,
            balanceAfter: transaction.balanceAfter,
          },
        },
        reason: transaction.reason + (error ? ` | Error: ${error.message}` : ''),
      }
    );
  }
}
