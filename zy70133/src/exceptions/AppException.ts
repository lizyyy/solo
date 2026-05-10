export class AppException extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`);
  }
}

export class InsufficientBudgetException extends AppException {
  constructor(available: number, requested: number, context?: string) {
    super('INSUFFICIENT_BUDGET', `Insufficient budget. Available: ${available}, Requested: ${requested}`, {
      available,
      requested,
      context,
    });
  }
}

export class OverBudgetException extends AppException {
  constructor(type: string, limit: number, requested: number, context?: string) {
    super('OVER_BUDGET', `${type} limit exceeded. Limit: ${limit}, Requested: ${requested}`, {
      type,
      limit,
      requested,
      context,
    });
  }
}

export class RuleViolationException extends AppException {
  constructor(rule: string, reason: string, evaluation?: Record<string, any>) {
    super('RULE_VIOLATION', `Rule violation: ${rule}. ${reason}`, {
      rule,
      reason,
      evaluation,
    });
  }
}

export class InvalidOperationException extends AppException {
  constructor(operation: string, reason: string, details?: Record<string, any>) {
    super('INVALID_OPERATION', `Cannot perform ${operation}: ${reason}`, details);
  }
}

export class ValidationException extends AppException {
  constructor(errors: Record<string, string>) {
    super('VALIDATION_ERROR', 'Validation failed', { errors });
  }
}

export class TransactionNotFoundException extends NotFoundException {
  constructor(transactionId: string) {
    super('Transaction', transactionId);
  }
}

export class BudgetPoolNotFoundException extends NotFoundException {
  constructor(budgetPoolId: string) {
    super('BudgetPool', budgetPoolId);
  }
}

export class CampaignNotFoundException extends NotFoundException {
  constructor(campaignId: string) {
    super('Campaign', campaignId);
  }
}

export class MaterialNotFoundException extends NotFoundException {
  constructor(materialId: string) {
    super('Material', materialId);
  }
}

export class ChannelNotFoundException extends NotFoundException {
  constructor(channelId: string) {
    super('Channel', channelId);
  }
}

export class BindingNotFoundException extends NotFoundException {
  constructor(bindingId: string) {
    super('MaterialBinding', bindingId);
  }
}

export class EntityStateException extends AppException {
  constructor(entity: string, currentState: string, expectedStates: string[]) {
    super('INVALID_ENTITY_STATE', `${entity} is in state: ${currentState}. Expected: ${expectedStates.join(' or ')}`, {
      entity,
      currentState,
      expectedStates,
    });
  }
}
