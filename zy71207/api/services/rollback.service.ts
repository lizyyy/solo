import { RollbackRepository } from '../repositories/rollback.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { RollbackRecord, AuditRecord } from '../../shared/types';

export class RollbackService {
  private rollbackRepository: RollbackRepository;
  private auditRepository: AuditRepository;

  constructor() {
    this.rollbackRepository = new RollbackRepository();
    this.auditRepository = new AuditRepository();
  }

  getRollbackById(id: string): RollbackRecord | null {
    return this.rollbackRepository.findById(id);
  }

  getRollbackByAuditId(auditId: string): RollbackRecord | null {
    return this.rollbackRepository.findByAuditId(auditId);
  }

  getRollbacksByCustomerId(customerId: string): RollbackRecord[] {
    return this.rollbackRepository.findByCustomerId(customerId);
  }

  generateRollbackPlan(audit: AuditRecord): {
    rollback: RollbackRecord;
    planDetails: {
      rollbackAmount: number;
      compensationAmount: number;
      compensationRate: number;
      totalAmount: number;
      calculation: string[];
    };
  } {
    const calculation: string[] = [];

    const rollbackAmount = audit.diffAmount;
    calculation.push(`回退本金：多扣金额¥${rollbackAmount.toFixed(2)}`);

    const compensationRate = 0.003;
    const compensationAmount = rollbackAmount * compensationRate;
    calculation.push(`补偿金：按年化${(compensationRate * 100).toFixed(1)}%计算，¥${rollbackAmount.toFixed(2)} × ${compensationRate} = ¥${compensationAmount.toFixed(2)}`);

    const totalAmount = rollbackAmount + compensationAmount;
    calculation.push(`合计应退：¥${rollbackAmount.toFixed(2)} + ¥${compensationAmount.toFixed(2)} = ¥${totalAmount.toFixed(2)}`);

    const existingRollback = this.rollbackRepository.findByAuditId(audit.id);
    if (existingRollback) {
      calculation.push('注意：该审计记录已存在回滚方案，本次为更新方案');
      return {
        rollback: existingRollback,
        planDetails: {
          rollbackAmount,
          compensationAmount,
          compensationRate,
          totalAmount,
          calculation,
        },
      };
    }

    const rollback = this.rollbackRepository.create({
      auditId: audit.id,
      customerId: audit.customerId,
      productId: audit.productId,
      rollbackAmount,
      compensationAmount,
      totalAmount,
      status: 'pending',
      completedAt: null,
    });

    this.auditRepository.updateRollbackId(audit.id, rollback.id);

    return {
      rollback,
      planDetails: {
        rollbackAmount,
        compensationAmount,
        compensationRate,
        totalAmount,
        calculation,
      },
    };
  }

  executeRollback(rollbackId: string): RollbackRecord {
    const rollback = this.rollbackRepository.findById(rollbackId);
    if (!rollback) {
      throw new Error(`Rollback record ${rollbackId} not found`);
    }

    this.rollbackRepository.updateStatus(rollbackId, 'completed');

    const audit = this.auditRepository.findById(rollback.auditId);
    if (audit) {
      this.auditRepository.updateStatus(audit.id, 'resolved');
    }

    return this.rollbackRepository.findById(rollbackId)!;
  }

  getAllRollbacks(): RollbackRecord[] {
    return this.rollbackRepository.findAll();
  }
}
