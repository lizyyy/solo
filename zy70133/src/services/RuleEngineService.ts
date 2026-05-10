import { 
  BudgetPool, 
  Channel, 
  RuleEvaluation, 
  RuleEvaluationResult, 
  DeductRequest,
  BudgetPoolRule,
  ChannelRule
} from '../types';
import { 
  addAmount, 
  greaterThan, 
  greaterThanOrEqual, 
  lessThan 
} from '../utils/amount';
import { getTransactionRepository } from '../repositories/RepositoryFactory';
import { OverBudgetException, RuleViolationException } from '../exceptions/AppException';

export interface RuleContext {
  budgetPool: BudgetPool;
  channel?: Channel;
  request: DeductRequest;
  availableAmount: number;
  dailyConsumed: number;
  dailyLimit?: number;
}

export class RuleEngineService {
  private static instance: RuleEngineService;

  private constructor() {}

  static getInstance(): RuleEngineService {
    if (!RuleEngineService.instance) {
      RuleEngineService.instance = new RuleEngineService();
    }
    return RuleEngineService.instance;
  }

  async evaluateDeduction(context: RuleContext): Promise<RuleEvaluationResult> {
    const evaluations: RuleEvaluation[] = [];
    let passed = true;

    const budgetPoolRules = context.budgetPool.rules || [];
    for (const rule of budgetPoolRules.sort((a, b) => a.priority - b.priority)) {
      const result = this.evaluateBudgetPoolRule(rule, context);
      evaluations.push(result);
      if (!result.passed) {
        passed = false;
      }
    }

    if (context.channel) {
      const channelRules = context.channel.rules || [];
      for (const rule of channelRules) {
        const result = this.evaluateChannelRule(rule, context);
        evaluations.push(result);
        if (!result.passed) {
          passed = false;
        }
      }
    }

    const globalResult = this.evaluateGlobalRules(context);
    evaluations.push(...globalResult);
    passed = passed && globalResult.every(r => r.passed);

    return {
      passed,
      evaluations,
      finalDecision: passed ? 'ALLOW' : 'BLOCK',
      timestamp: new Date(),
    };
  }

  private evaluateBudgetPoolRule(rule: BudgetPoolRule, context: RuleContext): RuleEvaluation {
    const input = { ruleType: rule.type, ruleValue: rule.value, requestAmount: context.request.amount };

    switch (rule.type) {
      case 'DAILY_LIMIT': {
        if (typeof rule.value !== 'number') {
          return this.createEvaluation('DAILY_LIMIT', rule.description, input, false, 'Invalid daily limit configuration');
        }
        const dailyLimit = rule.value;
        const dailyTotal = addAmount(context.dailyConsumed, context.request.amount);
        const passed = !greaterThan(dailyTotal, dailyLimit);
        return this.createEvaluation(
          'DAILY_LIMIT',
          rule.description,
          { ...input, dailyConsumed: context.dailyConsumed, dailyLimit, dailyTotal },
          passed,
          passed ? 'Daily limit check passed' : `Daily limit exceeded. Consumed: ${context.dailyConsumed}, Requested: ${context.request.amount}, Limit: ${dailyLimit}`
        );
      }

      case 'MINIMUM_BALANCE': {
        if (typeof rule.value !== 'number') {
          return this.createEvaluation('MINIMUM_BALANCE', rule.description, input, false, 'Invalid minimum balance configuration');
        }
        const minBalance = rule.value;
        const newBalance = context.availableAmount - context.request.amount;
        const passed = greaterThanOrEqual(newBalance, minBalance);
        return this.createEvaluation(
          'MINIMUM_BALANCE',
          rule.description,
          { ...input, availableAmount: context.availableAmount, minBalance, newBalance },
          passed,
          passed ? 'Minimum balance check passed' : `Minimum balance would be violated. Available: ${context.availableAmount}, Requested: ${context.request.amount}, Min Balance: ${minBalance}`
        );
      }

      case 'ALLOW_OVERDRAFT': {
        const allowOverdraft = rule.value === true;
        const wouldOverdraft = lessThan(context.availableAmount, context.request.amount);
        if (allowOverdraft) {
          return this.createEvaluation(
            'ALLOW_OVERDRAFT',
            rule.description,
            { ...input, allowOverdraft, wouldOverdraft, availableAmount: context.availableAmount },
            true,
            wouldOverdraft ? 'Overdraft is allowed, proceeding' : 'Overdraft check passed'
          );
        }
        if (wouldOverdraft) {
          return this.createEvaluation(
            'ALLOW_OVERDRAFT',
            rule.description,
            { ...input, allowOverdraft, wouldOverdraft, availableAmount: context.availableAmount },
            false,
            'Overdraft not allowed and would occur'
          );
        }
        return this.createEvaluation(
          'ALLOW_OVERDRAFT',
          rule.description,
          { ...input, allowOverdraft, wouldOverdraft, availableAmount: context.availableAmount },
          true,
          'Overdraft check passed'
        );
      }

      default:
        return this.createEvaluation(
          rule.type,
          rule.description,
          input,
          true,
          'Unknown rule type, passed by default'
        );
    }
  }

  private evaluateChannelRule(rule: ChannelRule, context: RuleContext): RuleEvaluation {
    const input = { ruleType: rule.type, ruleValue: rule.value, requestAmount: context.request.amount };

    switch (rule.type) {
      case 'MIN_DEDUCT': {
        if (typeof rule.value !== 'number') {
          return this.createEvaluation('MIN_DEDUCT', rule.description, input, false, 'Invalid min deduct configuration');
        }
        const minDeduct = rule.value;
        const passed = greaterThanOrEqual(context.request.amount, minDeduct);
        return this.createEvaluation(
          'MIN_DEDUCT',
          rule.description,
          { ...input, minDeduct },
          passed,
          passed ? 'Min deduct check passed' : `Amount ${context.request.amount} below channel minimum of ${minDeduct}`
        );
      }

      case 'MAX_DEDUCT_PER_ORDER': {
        if (typeof rule.value !== 'number') {
          return this.createEvaluation('MAX_DEDUCT_PER_ORDER', rule.description, input, false, 'Invalid max deduct configuration');
        }
        const maxDeduct = rule.value;
        const passed = !greaterThan(context.request.amount, maxDeduct);
        return this.createEvaluation(
          'MAX_DEDUCT_PER_ORDER',
          rule.description,
          { ...input, maxDeduct },
          passed,
          passed ? 'Max deduct check passed' : `Amount ${context.request.amount} exceeds channel maximum of ${maxDeduct}`
        );
      }

      default:
        return this.createEvaluation(
          rule.type,
          rule.description,
          input,
          true,
          'Unknown rule type, passed by default'
        );
    }
  }

  private evaluateGlobalRules(context: RuleContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];

    evaluations.push(
      this.createEvaluation(
        'GLOBAL_AMOUNT_POSITIVE',
        'Request amount must be positive',
        { requestAmount: context.request.amount },
        greaterThan(context.request.amount, 0),
        greaterThan(context.request.amount, 0) ? 'Amount is positive' : 'Amount must be greater than zero'
      )
    );

    evaluations.push(
      this.createEvaluation(
        'GLOBAL_BUDGET_POOL_ACTIVE',
        'Budget pool must be active',
        { budgetPoolStatus: context.budgetPool.status },
        context.budgetPool.status === 'ACTIVE',
        context.budgetPool.status === 'ACTIVE' ? 'Budget pool is active' : `Budget pool is in state: ${context.budgetPool.status}`
      )
    );

    evaluations.push(
      this.createEvaluation(
        'GLOBAL_AVAILABLE_BUDGET',
        'Available budget must be sufficient',
        {
          availableAmount: context.availableAmount,
          requestAmount: context.request.amount,
        },
        greaterThanOrEqual(context.availableAmount, context.request.amount),
        greaterThanOrEqual(context.availableAmount, context.request.amount)
          ? 'Available budget is sufficient'
          : `Insufficient budget. Available: ${context.availableAmount}, Requested: ${context.request.amount}`
      )
    );

    return evaluations;
  }

  private createEvaluation(
    ruleType: string,
    ruleDescription: string | undefined,
    input: Record<string, any>,
    passed: boolean,
    message: string
  ): RuleEvaluation {
    return {
      ruleType,
      ruleDescription,
      input,
      passed,
      message,
    };
  }

  async evaluateAndThrow(context: RuleContext): Promise<RuleEvaluationResult> {
    const result = await this.evaluateDeduction(context);
    if (!result.passed) {
      const failedEvaluations = result.evaluations.filter(e => !e.passed);
      const firstFailed = failedEvaluations[0];
      if (firstFailed) {
        if (firstFailed.ruleType === 'DAILY_LIMIT' || firstFailed.ruleType.includes('OVER')) {
          throw new OverBudgetException(
            firstFailed.ruleType,
            firstFailed.input.dailyLimit || firstFailed.input.maxDeduct || 0,
            firstFailed.input.requestAmount || 0,
            JSON.stringify({ ruleEvaluations: result })
          );
        }
        throw new RuleViolationException(firstFailed.ruleType, firstFailed.message, { ruleEvaluations: result });
      }
      throw new RuleViolationException('UNKNOWN', 'Rule check failed', { ruleEvaluations: result });
    }
    return result;
  }
}
