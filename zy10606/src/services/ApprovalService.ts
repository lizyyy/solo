import { In, Repository } from 'typeorm';
import { AppDataSource } from '../database';
import { ApprovalOrder } from '../entities/ApprovalOrder';
import { SignRecord } from '../entities/SignRecord';
import { RemindRecord } from '../entities/RemindRecord';
import { OperationHistory } from '../entities/OperationHistory';
import { ApprovalStatus, OperationType, SignStatus } from '../types/enums';
import * as moment from 'moment';

export interface ImportRecord {
  orderNo: string;
  title: string;
  applicantId: string;
  applicantName: string;
  applicantDept: string;
  content?: string;
  applyTime: string;
  status: string;
  timeoutTime?: string;
  completeTime?: string;
  signerId: string;
  signerName: string;
  signerDept: string;
  isResigned?: boolean;
  signOrder: number;
  signStartTime: string;
  signStatus: string;
  opinion?: string;
  remark?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string; record: Partial<ImportRecord> }>;
}

export class ApprovalService {
  private approvalRepo: Repository<ApprovalOrder>;
  private signRepo: Repository<SignRecord>;
  private remindRepo: Repository<RemindRecord>;
  private historyRepo: Repository<OperationHistory>;

  constructor() {
    this.approvalRepo = AppDataSource.getRepository(ApprovalOrder);
    this.signRepo = AppDataSource.getRepository(SignRecord);
    this.remindRepo = AppDataSource.getRepository(RemindRecord);
    this.historyRepo = AppDataSource.getRepository(OperationHistory);
  }

  async batchImport(records: ImportRecord[], operatorId: string, operatorName: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        await this.importSingleRecord(record, operatorId, operatorName);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          message: error.message,
          record
        });
      }
    }

    return result;
  }

  private async importSingleRecord(record: ImportRecord, operatorId: string, operatorName: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await this.approvalRepo.findOne({
        where: { orderNo: record.orderNo }
      });

      if (existing) {
        throw new Error(`审批单号 ${record.orderNo} 已存在`);
      }

      const statusMap: Record<string, ApprovalStatus> = {
        'pending': ApprovalStatus.PENDING,
        'signing': ApprovalStatus.SIGNING,
        'timeout': ApprovalStatus.TIMEOUT,
        'completed': ApprovalStatus.COMPLETED,
        'withdrawn': ApprovalStatus.WITHDRAWN
      };

      const signStatusMap: Record<string, SignStatus> = {
        'pending': SignStatus.PENDING,
        'approved': SignStatus.APPROVED,
        'rejected': SignStatus.REJECTED,
        'timeout': SignStatus.TIMEOUT,
        'transferred': SignStatus.TRANSFERRED
      };

      const order = this.approvalRepo.create({
        orderNo: record.orderNo,
        title: record.title,
        applicantId: record.applicantId,
        applicantName: record.applicantName,
        applicantDept: record.applicantDept,
        content: record.content,
        status: statusMap[record.status] || ApprovalStatus.PENDING,
        applyTime: new Date(record.applyTime),
        timeoutTime: record.timeoutTime ? new Date(record.timeoutTime) : undefined,
        completeTime: record.completeTime ? new Date(record.completeTime) : undefined,
        isImported: true
      });

      const savedOrder = await queryRunner.manager.save(order);

      const signRecord = this.signRepo.create({
        approvalOrderId: savedOrder.id,
        signerId: record.signerId,
        signerName: record.signerName,
        signerDept: record.signerDept,
        isResigned: record.isResigned || false,
        signOrder: record.signOrder,
        status: signStatusMap[record.signStatus] || SignStatus.PENDING,
        signStartTime: new Date(record.signStartTime),
        opinion: record.opinion,
        remark: record.remark
      });

      await queryRunner.manager.save(signRecord);

      const history = this.historyRepo.create({
        approvalOrderId: savedOrder.id,
        operationType: OperationType.IMPORT,
        operatorId,
        operatorName,
        detail: `批量导入历史记录: ${record.orderNo}`
      });

      await queryRunner.manager.save(history);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async addRemark(orderId: string, signId: string, remark: string, operatorId: string, operatorName: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const signRecord = await this.signRepo.findOne({
        where: { id: signId, approvalOrderId: orderId }
      });

      if (!signRecord) {
        throw new Error('加签记录不存在');
      }

      const oldRemark = signRecord.remark;
      signRecord.remark = remark;
      await queryRunner.manager.save(signRecord);

      const history = this.historyRepo.create({
        approvalOrderId: orderId,
        operationType: OperationType.REMARK,
        operatorId,
        operatorName,
        detail: remark,
        snapshot: { oldRemark, newRemark: remark }
      });

      await queryRunner.manager.save(history);
      await queryRunner.commitTransaction();

      return signRecord;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getList(params: {
    page?: number;
    pageSize?: number;
    status?: ApprovalStatus;
    orderNo?: string;
    applicantName?: string;
    isTimeout?: boolean;
  }) {
    const { page = 1, pageSize = 20, status, orderNo, applicantName, isTimeout } = params;
    const query = this.approvalRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.signRecords', 'sign')
      .orderBy('order.applyTime', 'DESC');

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    if (orderNo) {
      query.andWhere('order.orderNo LIKE :orderNo', { orderNo: `%${orderNo}%` });
    }

    if (applicantName) {
      query.andWhere('order.applicantName LIKE :applicantName', { applicantName: `%${applicantName}%` });
    }

    if (isTimeout !== undefined) {
      const now = new Date();
      if (isTimeout) {
        query.andWhere('order.timeoutTime < :now', { now });
      } else {
        query.andWhere('order.timeoutTime >= :now OR order.timeoutTime IS NULL');
      }
    }

    const [data, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize
    };
  }

  async getDetail(orderId: string) {
    const order = await this.approvalRepo.findOne({
      where: { id: orderId },
      relations: ['signRecords', 'remindRecords', 'operationHistories']
    });

    if (!order) {
      throw new Error('审批单不存在');
    }

    return order;
  }

  async getHistory(orderId: string) {
    const histories = await this.historyRepo.find({
      where: { approvalOrderId: orderId },
      order: { operateTime: 'DESC' }
    });

    return histories;
  }

  async transferSign(orderId: string, signId: string, transferToId: string, transferToName: string, operatorId: string, operatorName: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const signRecord = await this.signRepo.findOne({
        where: { id: signId, approvalOrderId: orderId }
      });

      if (!signRecord) {
        throw new Error('加签记录不存在');
      }

      if (signRecord.status !== SignStatus.PENDING) {
        throw new Error('当前加签状态不支持转交');
      }

      signRecord.status = SignStatus.TRANSFERRED;
      signRecord.transferToId = transferToId;
      signRecord.transferToName = transferToName;
      signRecord.signCompleteTime = new Date();
      await queryRunner.manager.save(signRecord);

      const newSignRecord = this.signRepo.create({
        approvalOrderId: orderId,
        signerId: transferToId,
        signerName: transferToName,
        signerDept: signRecord.signerDept,
        signOrder: signRecord.signOrder,
        status: SignStatus.PENDING,
        signStartTime: new Date(),
        timeoutTime: moment().add(process.env.TIMEOUT_HOURS || 72, 'hours').toDate()
      });

      await queryRunner.manager.save(newSignRecord);

      const history = this.historyRepo.create({
        approvalOrderId: orderId,
        operationType: OperationType.TRANSFER,
        operatorId,
        operatorName,
        detail: `从 ${signRecord.signerName} 转交给 ${transferToName}`,
        snapshot: { from: signRecord.signerName, to: transferToName }
      });

      await queryRunner.manager.save(history);
      await queryRunner.commitTransaction();

      return { oldSign: signRecord, newSign: newSignRecord };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async withdrawOrder(orderId: string, operatorId: string, operatorName: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.approvalRepo.findOne({
        where: { id: orderId }
      });

      if (!order) {
        throw new Error('审批单不存在');
      }

      if (order.status === ApprovalStatus.COMPLETED) {
        throw new Error('已办结的审批单不能撤回');
      }

      const oldStatus = order.status;
      order.status = ApprovalStatus.WITHDRAWN;
      await queryRunner.manager.save(order);

      const history = this.historyRepo.create({
        approvalOrderId: orderId,
        operationType: OperationType.WITHDRAW,
        operatorId,
        operatorName,
        detail: '撤回审批单',
        snapshot: { oldStatus, newStatus: ApprovalStatus.WITHDRAWN }
      });

      await queryRunner.manager.save(history);
      await queryRunner.commitTransaction();

      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async resubmitOrder(orderId: string, operatorId: string, operatorName: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.approvalRepo.findOne({
        where: { id: orderId },
        relations: ['signRecords']
      });

      if (!order) {
        throw new Error('审批单不存在');
      }

      if (order.status !== ApprovalStatus.WITHDRAWN) {
        throw new Error('只有已撤回的审批单才能重新提交');
      }

      order.status = ApprovalStatus.SIGNING;
      await queryRunner.manager.save(order);

      const pendingSign = order.signRecords.find(s => s.status === SignStatus.PENDING);
      if (pendingSign) {
        pendingSign.signStartTime = new Date();
        pendingSign.timeoutTime = moment().add(process.env.TIMEOUT_HOURS || 72, 'hours').toDate();
        await queryRunner.manager.save(pendingSign);
      }

      const history = this.historyRepo.create({
        approvalOrderId: orderId,
        operationType: OperationType.RESUBMIT,
        operatorId,
        operatorName,
        detail: '重新提交审批单'
      });

      await queryRunner.manager.save(history);
      await queryRunner.commitTransaction();

      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
