import { Op } from 'sequelize';
import DepositFlow, { FlowType } from '../models/DepositFlow';
import Application from '../models/Application';
import ApplicationService from './ApplicationService';
import { LogType } from '../models/ProcessingLog';
import dayjs from 'dayjs';

export interface DepositDeductionResult {
  flow: DepositFlow;
  balanceBefore: number;
  balanceAfter: number;
  readableMessage: string;
}

class DepositService {
  async getCurrentBalance(applicationId: number): Promise<number> {
    const application = await Application.findByPk(applicationId);
    if (!application) {
      throw new Error('申请记录不存在');
    }
    return parseFloat(application.depositAmount.toString());
  }

  async addFlow(
    applicationId: number,
    flowType: FlowType,
    amount: number,
    reason: string,
    operator: string
  ): Promise<DepositDeductionResult> {
    const balanceBefore = await this.getCurrentBalance(applicationId);
    let balanceAfter = balanceBefore;

    switch (flowType) {
      case FlowType.COLLECT:
        balanceAfter = balanceBefore + amount;
        break;
      case FlowType.DEDUCT:
        if (balanceBefore < amount) {
          throw new Error(`押金余额不足，当前余额：${balanceBefore}，扣减金额：${amount}`);
        }
        balanceAfter = balanceBefore - amount;
        break;
      case FlowType.REFUND:
        balanceAfter = 0;
        break;
    }

    const flowNo = `DEP${dayjs().format('YYYYMMDDHHmmss')}`;
    const readableMessage = this.getReadableFlowMessage(flowType, amount, reason, operator, balanceBefore, balanceAfter);

    const flow = await DepositFlow.create({
      applicationId,
      flowNo,
      flowType,
      amount,
      reason,
      readableReason: readableMessage,
      operator,
      operatedAt: new Date(),
      balanceBefore,
      balanceAfter,
    });

    await Application.update(
      { depositAmount: balanceAfter },
      { where: { id: applicationId } }
    );

    await ApplicationService.addLog(
      applicationId,
      LogType.DEPOSIT_DEDUCTION,
      reason,
      readableMessage,
      operator,
      undefined,
      undefined,
      { balanceBefore, balanceAfter, amount, flowType }
    );

    return {
      flow,
      balanceBefore,
      balanceAfter,
      readableMessage,
    };
  }

  private getReadableFlowMessage(
    flowType: FlowType,
    amount: number,
    reason: string,
    operator: string,
    balanceBefore: number,
    balanceAfter: number
  ): string {
    const typeMap: Record<string, string> = {
      [FlowType.COLLECT]: '收取',
      [FlowType.DEDUCT]: '扣减',
      [FlowType.REFUND]: '退还',
    };

    const typeName = typeMap[flowType] || flowType;

    return `操作员【${operator}】${typeName}押金 ${amount} 元，原因：${reason || '未说明'}，操作前余额：${balanceBefore} 元，操作后余额：${balanceAfter} 元`;
  }

  async deductDeposit(
    applicationId: number,
    amount: number,
    reason: string,
    operator: string
  ) {
    return this.addFlow(applicationId, FlowType.DEDUCT, amount, reason, operator);
  }

  async collectDeposit(
    applicationId: number,
    amount: number,
    reason: string,
    operator: string
  ) {
    return this.addFlow(applicationId, FlowType.COLLECT, amount, reason, operator);
  }

  async refundDeposit(
    applicationId: number,
    reason: string,
    operator: string
  ) {
    const balance = await this.getCurrentBalance(applicationId);
    return this.addFlow(applicationId, FlowType.REFUND, balance, reason, operator);
  }

  async getFlowsByApplication(applicationId: number) {
    return await DepositFlow.findAll({
      where: { applicationId },
      order: [['operatedAt', 'DESC']],
    });
  }

  async listFlows(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      applicationId?: number;
      flowType?: FlowType;
      operator?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = {};

    if (filters) {
      if (filters.applicationId) {
        where.applicationId = filters.applicationId;
      }
      if (filters.flowType) {
        where.flowType = filters.flowType;
      }
      if (filters.operator) {
        where.operator = { [Op.like]: `%${filters.operator}%` };
      }
      if (filters.startDate && filters.endDate) {
        where.operatedAt = {
          [Op.between]: [filters.startDate, filters.endDate],
        };
      }
    }

    const { count, rows } = await DepositFlow.findAndCountAll({
      where,
      order: [['operatedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [{
        model: Application,
        as: 'application',
        attributes: ['applicationNo', 'merchantName'],
      }],
    });

    return { total: count, list: rows, page, pageSize };
  }
}

export default new DepositService();
