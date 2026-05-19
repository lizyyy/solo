import { db } from '../models/database';
import { OperationType, Operator, Material, Booth, BorrowRecord } from '../models/types';

export interface RuleResult {
  passed: boolean;
  reason: string;
  code: string;
}

export interface RuleContext {
  operationType: OperationType;
  operator: Operator;
  materialCode?: string;
  materialId?: string;
  fromBoothId?: string;
  toBoothId?: string;
  quantity?: number;
  requestId?: string;
  recordId?: string;
}

export class RuleEngine {
  async validate(context: RuleContext): Promise<RuleResult> {
    const rules = this.getRulesForOperation(context.operationType);
    
    for (const rule of rules) {
      const result = await rule.call(this, context);
      if (!result.passed) {
        return result;
      }
    }

    return { passed: true, reason: '所有校验通过', code: 'VALIDATION_PASSED' };
  }

  private getRulesForOperation(operationType: OperationType): Array<(ctx: RuleContext) => Promise<RuleResult>> {
    const ruleMap: Record<OperationType, Array<(ctx: RuleContext) => Promise<RuleResult>>> = {
      'import': [this.validateImport.bind(this)],
      'occupy': [
        this.validateOperatorRole.bind(this),
        this.validateMaterialExists.bind(this),
        this.validateBoothExists.bind(this),
        this.validateQuantityPositive.bind(this),
        this.validateSufficientStock.bind(this),
        this.validateDuplicateScan.bind(this)
      ],
      'transfer': [
        this.validateOperatorRole.bind(this),
        this.validateMaterialExists.bind(this),
        this.validateBoothExists.bind(this),
        this.validateQuantityPositive.bind(this),
        this.validateCrossBooth.bind(this),
        this.validateFromBoothStock.bind(this)
      ],
      'return': [
        this.validateOperatorRole.bind(this),
        this.validateRecordExists.bind(this),
        this.validateReturnQuantity.bind(this)
      ],
      'damage': [
        this.validateOperatorRole.bind(this),
        this.validateRecordExists.bind(this),
        this.validateDamageQuantity.bind(this)
      ],
      'rollback': [
        this.validateOperatorRole.bind(this),
        this.validateRecordExists.bind(this),
        this.validateRollbackEligibility.bind(this)
      ]
    };

    return ruleMap[operationType] || [];
  }

  private async validateOperatorRole(context: RuleContext): Promise<RuleResult> {
    const { operator, operationType } = context;
    const rolePermissions: Record<string, OperationType[]> = {
      'operator': ['occupy', 'return'],
      'manager': ['occupy', 'transfer', 'return', 'damage'],
      'admin': ['import', 'occupy', 'transfer', 'return', 'damage', 'rollback']
    };

    const allowedOperations = rolePermissions[operator.role] || [];
    if (!allowedOperations.includes(operationType)) {
      return {
        passed: false,
        reason: `角色 ${operator.role} 无权执行 ${operationType} 操作`,
        code: 'INSUFFICIENT_PERMISSION'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateMaterialExists(context: RuleContext): Promise<RuleResult> {
    if (!context.materialCode) {
      return { passed: false, reason: '物资编码不能为空', code: 'MATERIAL_CODE_REQUIRED' };
    }

    const material = await db.get<Material>(
      `SELECT * FROM materials WHERE code = ?`,
      [context.materialCode]
    );

    if (!material) {
      return { passed: false, reason: `物资 ${context.materialCode} 不存在`, code: 'MATERIAL_NOT_FOUND' };
    }

    if (material.status === 'damaged') {
      return { passed: false, reason: `物资 ${context.materialCode} 已损坏，无法操作`, code: 'MATERIAL_DAMAGED' };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateBoothExists(context: RuleContext): Promise<RuleResult> {
    const boothId = context.toBoothId || context.fromBoothId;
    if (!boothId) {
      return { passed: true, reason: '', code: '' };
    }

    const booth = await db.get<Booth>(
      `SELECT * FROM booths WHERE id = ?`,
      [boothId]
    );

    if (!booth) {
      return { passed: false, reason: `展位 ${boothId} 不存在`, code: 'BOOTH_NOT_FOUND' };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateQuantityPositive(context: RuleContext): Promise<RuleResult> {
    if (!context.quantity || context.quantity <= 0) {
      return { passed: false, reason: '数量必须大于0', code: 'INVALID_QUANTITY' };
    }
    return { passed: true, reason: '', code: '' };
  }

  private async validateSufficientStock(context: RuleContext): Promise<RuleResult> {
    if (!context.materialCode) return { passed: true, reason: '', code: '' };

    const material = await db.get<Material>(
      `SELECT * FROM materials WHERE code = ?`,
      [context.materialCode]
    );

    if (!material) return { passed: true, reason: '', code: '' };

    if (material.availableQuantity < context.quantity!) {
      return {
        passed: false,
        reason: `库存不足，可用: ${material.availableQuantity}, 请求: ${context.quantity}`,
        code: 'INSUFFICIENT_STOCK'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateDuplicateScan(context: RuleContext): Promise<RuleResult> {
    if (!context.materialCode || !context.toBoothId) return { passed: true, reason: '', code: '' };

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentRecord = await db.get<BorrowRecord>(
      `SELECT * FROM borrow_records 
       WHERE materialCode = ? AND toBoothId = ? AND operationType = 'occupy' AND createdAt >= ?
       ORDER BY createdAt DESC LIMIT 1`,
      [context.materialCode, context.toBoothId, fiveMinutesAgo]
    );

    if (recentRecord) {
      return {
        passed: false,
        reason: `5分钟内该物资已在该展位扫码借用，疑似重复操作`,
        code: 'DUPLICATE_SCAN'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateCrossBooth(context: RuleContext): Promise<RuleResult> {
    if (!context.fromBoothId || !context.toBoothId) {
      return { passed: false, reason: '调拨需要指定来源和目标展位', code: 'BOOTH_REQUIRED' };
    }

    if (context.fromBoothId === context.toBoothId) {
      return { passed: false, reason: '不能调拨到同一展位', code: 'SAME_BOOTH_TRANSFER' };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateFromBoothStock(context: RuleContext): Promise<RuleResult> {
    if (!context.fromBoothId || !context.materialCode) return { passed: true, reason: '', code: '' };

    const boothRecords = await db.all<BorrowRecord>(
      `SELECT * FROM borrow_records 
       WHERE materialCode = ? AND toBoothId = ? AND status = 'approved'`,
      [context.materialCode, context.fromBoothId]
    );

    const totalBorrowed = boothRecords.reduce((sum, r) => sum + r.quantity, 0);
    const returnedRecords = await db.all<BorrowRecord>(
      `SELECT * FROM borrow_records 
       WHERE materialCode = ? AND fromBoothId = ? AND status IN ('returned', 'rolled_back')`,
      [context.materialCode, context.fromBoothId]
    );
    const totalReturned = returnedRecords.reduce((sum, r) => sum + r.quantity, 0);

    const available = totalBorrowed - totalReturned;

    if (available < context.quantity!) {
      return {
        passed: false,
        reason: `来源展位可用数量不足，当前可用: ${available}, 请求调拨: ${context.quantity}`,
        code: 'INSUFFICIENT_BOOTH_STOCK'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateRecordExists(context: RuleContext): Promise<RuleResult> {
    if (!context.recordId) {
      return { passed: false, reason: '记录ID不能为空', code: 'RECORD_ID_REQUIRED' };
    }

    const record = await db.get<BorrowRecord>(
      `SELECT * FROM borrow_records WHERE id = ?`,
      [context.recordId]
    );

    if (!record) {
      return { passed: false, reason: `借用记录 ${context.recordId} 不存在`, code: 'RECORD_NOT_FOUND' };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateReturnQuantity(context: RuleContext): Promise<RuleResult> {
    if (!context.recordId) return { passed: true, reason: '', code: '' };

    const record = await db.get<BorrowRecord>(
      `SELECT * FROM borrow_records WHERE id = ?`,
      [context.recordId]
    );

    if (!record) return { passed: true, reason: '', code: '' };

    if (record.status === 'returned' || record.status === 'rolled_back') {
      return {
        passed: false,
        reason: '该记录已归还或已回滚，无法重复归还',
        code: 'ALREADY_RETURNED'
      };
    }

    if (context.quantity! > record.quantity) {
      return {
        passed: false,
        reason: `归还数量不能超过借用数量，借用: ${record.quantity}, 归还: ${context.quantity}`,
        code: 'EXCESS_RETURN_QUANTITY'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateDamageQuantity(context: RuleContext): Promise<RuleResult> {
    if (!context.recordId) return { passed: true, reason: '', code: '' };

    const record = await db.get<BorrowRecord>(
      `SELECT * FROM borrow_records WHERE id = ?`,
      [context.recordId]
    );

    if (!record) return { passed: true, reason: '', code: '' };

    if (context.quantity! > record.quantity) {
      return {
        passed: false,
        reason: `报损数量不能超过借用数量，借用: ${record.quantity}, 报损: ${context.quantity}`,
        code: 'EXCESS_DAMAGE_QUANTITY'
      };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateRollbackEligibility(context: RuleContext): Promise<RuleResult> {
    if (!context.recordId) return { passed: true, reason: '', code: '' };

    const record = await db.get<BorrowRecord>(
      `SELECT * FROM borrow_records WHERE id = ?`,
      [context.recordId]
    );

    if (!record) return { passed: true, reason: '', code: '' };

    if (record.status === 'rolled_back') {
      return { passed: false, reason: '该记录已回滚，无法重复回滚', code: 'ALREADY_ROLLED_BACK' };
    }

    if (record.status === 'returned') {
      return { passed: false, reason: '已归还的记录无法回滚', code: 'CANNOT_ROLLBACK_RETURNED' };
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (record.createdAt < oneHourAgo) {
      return { passed: false, reason: '只能回滚1小时内的操作', code: 'ROLLBACK_TIME_EXPIRED' };
    }

    return { passed: true, reason: '', code: '' };
  }

  private async validateImport(context: RuleContext): Promise<RuleResult> {
    if (context.operator.role !== 'admin') {
      return {
        passed: false,
        reason: '只有管理员可以导入物资',
        code: 'IMPORT_PERMISSION_DENIED'
      };
    }
    return { passed: true, reason: '', code: '' };
  }
}

export const ruleEngine = new RuleEngine();
