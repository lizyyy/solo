import { FilingStatus, FilingRecord, ApprovalStatus } from '../types';
import { db } from '../database';

interface StateTransition {
  from: FilingStatus[];
  to: FilingStatus;
  allowed: boolean;
  requiresApproval?: boolean;
  description: string;
}

export class StateMachineService {
  private transitions: StateTransition[] = [
    {
      from: [FilingStatus.PENDING],
      to: FilingStatus.CONFIRMED,
      allowed: true,
      requiresApproval: true,
      description: '确认备案申请'
    },
    {
      from: [FilingStatus.PENDING, FilingStatus.CONFIRMED],
      to: FilingStatus.BLOCKED,
      allowed: true,
      description: '拦截备案申请'
    },
    {
      from: [FilingStatus.BLOCKED],
      to: FilingStatus.REVOKED,
      allowed: true,
      description: '撤销已拦截的备案'
    },
    {
      from: [FilingStatus.BLOCKED],
      to: FilingStatus.COMPENSATED,
      allowed: true,
      description: '补偿已拦截的备案'
    },
    {
      from: [FilingStatus.CONFIRMED],
      to: FilingStatus.CLOSED,
      allowed: true,
      description: '关闭备案'
    },
    {
      from: [FilingStatus.CONFIRMED],
      to: FilingStatus.EXPIRED,
      allowed: true,
      description: '窗口到期自动关闭'
    },
    {
      from: [FilingStatus.REVOKED, FilingStatus.COMPENSATED, FilingStatus.EXPIRED],
      to: FilingStatus.CLOSED,
      allowed: true,
      description: '最终关闭'
    }
  ];

  canTransition(currentStatus: FilingStatus, targetStatus: FilingStatus): boolean {
    const transition = this.transitions.find(
      t => t.from.includes(currentStatus) && t.to === targetStatus
    );
    return transition?.allowed || false;
  }

  requiresApproval(currentStatus: FilingStatus, targetStatus: FilingStatus): boolean {
    const transition = this.transitions.find(
      t => t.from.includes(currentStatus) && t.to === targetStatus
    );
    return transition?.requiresApproval || false;
  }

  getTransitionDescription(currentStatus: FilingStatus, targetStatus: FilingStatus): string {
    const transition = this.transitions.find(
      t => t.from.includes(currentStatus) && t.to === targetStatus
    );
    return transition?.description || '未知状态转换';
  }

  async advanceStatus(
    filingId: string,
    targetStatus: FilingStatus,
    operator?: string,
    reason?: string
  ): Promise<FilingRecord> {
    const filing = await db.getFiling(filingId);
    if (!filing) {
      throw new Error('备案记录不存在');
    }

    if (!this.canTransition(filing.status, targetStatus)) {
      throw new Error(`不允许从 ${filing.status} 转换到 ${targetStatus}`);
    }

    if (this.requiresApproval(filing.status, targetStatus)) {
      if (filing.approvalStatus !== ApprovalStatus.APPROVED) {
        throw new Error('此状态转换需要先审批通过');
      }
    }

    await db.updateFilingStatus(filingId, targetStatus, operator, reason);
    
    const updatedFiling = await db.getFiling(filingId);
    if (!updatedFiling) {
      throw new Error('更新后备案记录不存在');
    }

    return updatedFiling;
  }

  async approveFiling(filingId: string, approver: string): Promise<FilingRecord> {
    const filing = await db.getFiling(filingId);
    if (!filing) {
      throw new Error('备案记录不存在');
    }

    await db.updateApprovalStatus(filingId, ApprovalStatus.APPROVED, approver);
    
    const updatedFiling = await db.getFiling(filingId);
    if (!updatedFiling) {
      throw new Error('更新后备案记录不存在');
    }

    return updatedFiling;
  }

  async rejectFiling(filingId: string, approver: string, reason: string): Promise<FilingRecord> {
    const filing = await db.getFiling(filingId);
    if (!filing) {
      throw new Error('备案记录不存在');
    }

    await db.updateApprovalStatus(filingId, ApprovalStatus.REJECTED, approver);
    await db.updateFilingStatus(filingId, FilingStatus.REVOKED, approver, reason);
    
    const updatedFiling = await db.getFiling(filingId);
    if (!updatedFiling) {
      throw new Error('更新后备案记录不存在');
    }

    return updatedFiling;
  }

  getAllTransitions(): StateTransition[] {
    return this.transitions;
  }
}

export const stateMachineService = new StateMachineService();
