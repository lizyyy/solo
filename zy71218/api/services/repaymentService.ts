import {
  RepaymentDAO,
  RepaymentWriteOffDAO,
  RepaymentPlanDAO,
  CaseDAO,
} from '../dao/index.js';
import { auditService } from './auditService.js';
import { versionService } from './versionService.js';
import { riskService } from './riskService.js';
import type {
  Repayment,
  RepaymentWriteOff,
  User,
} from '../../shared/types.js';

interface WriteOffTarget {
  targetType: string;
  targetId: string;
  amount: number;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const repaymentService = {
  async registerRepayment(
    data: Partial<Repayment>,
    operator: User
  ): Promise<string> {
    if (!data.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!data.totalAmount || data.totalAmount <= 0) {
      throw new Error('还款金额必须大于0');
    }
    if (!data.repaymentDate) {
      throw new Error('还款日期不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const caseInfo = await CaseDAO.findByBusinessNo(data.businessNo);
    if (!caseInfo) {
      throw new Error(`案件不存在: ${data.businessNo}`);
    }

    const id = generateId('rep');
    
    const repaymentData: Partial<Repayment> & { id: string } = {
      id,
      businessNo: data.businessNo,
      repaymentDate: data.repaymentDate,
      totalAmount: Number(data.totalAmount),
      principalPaid: 0,
      interestPaid: 0,
      penaltyPaid: 0,
      payer: data.payer,
      remark: data.remark,
      writeOffStatus: 'pending',
    };

    await RepaymentDAO.create(repaymentData);

    await auditService.logAction(
      operator.id,
      operator.name,
      'register_repayment',
      'repayment',
      id,
      `登记回款，金额: ${data.totalAmount}，业务编号: ${data.businessNo}`,
    );

    return id;
  },

  async writeOffRepayment(
    repaymentId: string,
    targets: WriteOffTarget[],
    operator: User
  ): Promise<void> {
    if (!repaymentId) {
      throw new Error('回款ID不能为空');
    }
    if (!targets || targets.length === 0) {
      throw new Error('核销目标不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const repayment = await RepaymentDAO.getById(repaymentId);
    if (!repayment) {
      throw new Error(`回款记录不存在: ${repaymentId}`);
    }

    if (repayment.writeOffStatus === 'full') {
      throw new Error('该回款已完成核销，不能重复操作');
    }

    const totalWriteOffAmount = targets.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalWriteOffAmount > repayment.totalAmount) {
      throw new Error(`核销金额(${totalWriteOffAmount})不能大于回款金额(${repayment.totalAmount})`);
    }

    const existingWriteOffs = await RepaymentWriteOffDAO.findByRepaymentId(repaymentId);
    const existingAmount = existingWriteOffs.reduce((sum, w) => sum + w.amount, 0);
    
    if (existingAmount + totalWriteOffAmount > repayment.totalAmount) {
      throw new Error(`累计核销金额(${existingAmount + totalWriteOffAmount})不能大于回款金额(${repayment.totalAmount})`);
    }

    const writeOffData = targets.map(target => ({
      id: generateId('wo'),
      repaymentId,
      targetType: target.targetType,
      targetId: target.targetId,
      amount: Number(target.amount),
    }));

    await RepaymentWriteOffDAO.batchCreate(writeOffData);

    const totalAmount = existingAmount + totalWriteOffAmount;
    const writeOffStatus = totalAmount >= repayment.totalAmount ? 'full' : 'partial';
    
    await RepaymentDAO.updateWriteOffStatus(repaymentId, writeOffStatus);

    for (const target of targets) {
      if (target.targetType === 'repayment_plan') {
        const plan = await RepaymentPlanDAO.getById(target.targetId);
        if (plan) {
          const beforeData = { ...plan };
          await RepaymentPlanDAO.updateStatus(target.targetId, 'paid');
          const afterData = { ...plan, status: 'paid' };
          
          await versionService.saveVersion(
            target.targetId,
            'repayment_plan',
            beforeData,
            afterData,
            operator,
            `回款核销，金额: ${target.amount}`
          );
        }
      }
    }

    const newTotalWriteOff = await RepaymentWriteOffDAO.getTotalWriteOffAmount(repaymentId);
    if (newTotalWriteOff >= repayment.totalAmount && repayment.businessNo) {
      const caseInfo = await CaseDAO.findByBusinessNo(repayment.businessNo);
      if (caseInfo && caseInfo.currentStatus !== 'settled') {
        await riskService.updateRiskLevel(repayment.businessNo, operator);
      }
    }

    await auditService.logAction(
      operator.id,
      operator.name,
      'write_off_repayment',
      'repayment',
      repaymentId,
      `核销回款，金额: ${totalWriteOffAmount}，目标数: ${targets.length}`,
    );
  },

  async getRepaymentList(
    page: number = 1,
    pageSize: number = 10,
    filters?: Record<string, any>
  ): Promise<{ list: Repayment[]; total: number; page: number; pageSize: number }> {
    const result = await RepaymentDAO.list(filters, page, pageSize);
    return {
      list: result.list,
      total: result.total,
      page,
      pageSize,
    };
  },

  async getRepaymentDetail(repaymentId: string): Promise<{
    repayment: Repayment;
    writeOffs: RepaymentWriteOff[];
  }> {
    if (!repaymentId) {
      throw new Error('回款ID不能为空');
    }

    const repayment = await RepaymentDAO.getById(repaymentId);
    if (!repayment) {
      throw new Error(`回款记录不存在: ${repaymentId}`);
    }

    const writeOffs = await RepaymentWriteOffDAO.findByRepaymentId(repaymentId);

    return {
      repayment,
      writeOffs,
    };
  },
};

export default repaymentService;
