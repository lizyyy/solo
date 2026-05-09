import { Repository, Not } from 'typeorm';
import dayjs from 'dayjs';
import { Receipt, ReceiptStatus, Dispatch, DispatchStatus, Route, RoutePointStatus, BinType } from '../entities';
import { AppDataSource } from '../database/data-source';
import { BizResponse, success, idempotent, invalidParam, notFound, statusError, businessError } from '../utils/biz-response';
import { IdempotentService } from './idempotent.service';

export interface CreateReceiptDto {
  requestId: string;
  dispatchId: string;
  grossWeight: number;
  tareWeight: number;
  unitPrice: number;
  weighbridgeLocation?: string;
  submitter?: string;
  remark?: string;
  weighbridgePhotoUrl?: string;
}

export interface VerifyReceiptDto {
  verifier: string;
  approved: boolean;
  remark?: string;
}

export class ReceiptService {
  private receiptRepo: Repository<Receipt>;
  private dispatchRepo: Repository<Dispatch>;
  private routeRepo: Repository<Route>;
  private idempotentService: IdempotentService;

  constructor() {
    this.receiptRepo = AppDataSource.getRepository(Receipt);
    this.dispatchRepo = AppDataSource.getRepository(Dispatch);
    this.routeRepo = AppDataSource.getRepository(Route);
    this.idempotentService = new IdempotentService();
  }

  private generateReceiptNo(): string {
    const dateStr = dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RECEIPT-${dateStr}-${random}`;
  }

  async createReceipt(dto: CreateReceiptDto): Promise<BizResponse> {
    if (!dto.requestId) {
      return invalidParam('必须提供 requestId（幂等请求ID）');
    }
    if (!dto.dispatchId) {
      return invalidParam('必须指定关联的调度单');
    }
    if (dto.grossWeight === undefined || dto.grossWeight < 0) {
      return invalidParam('必须提供有效的过磅毛重（千克）');
    }
    if (dto.tareWeight === undefined || dto.tareWeight < 0) {
      return invalidParam('必须提供有效的过磅皮重（千克）');
    }
    if (dto.unitPrice === undefined || dto.unitPrice <= 0) {
      return invalidParam('必须提供有效的清运单价（元/千克）');
    }
    if (dto.grossWeight < dto.tareWeight) {
      return invalidParam('毛重不能小于皮重');
    }

    const bizType = 'RECEIPT_CREATE';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      dto.requestId,
      JSON.stringify(dto),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该回执已创建（重复请求）');
      }
      if (existing.status === 'FAILED') {
        return businessError('上次创建失败，请使用新的 requestId 重试');
      }
      return idempotent({ receiptId: existing.bizId }, '该回执正在创建或已创建');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispatch = await queryRunner.manager.findOne(Dispatch, {
        where: { id: dto.dispatchId },
      });
      if (!dispatch) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到指定的调度单');
      }

      if (dispatch.status !== DispatchStatus.COMPLETED) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`调度单当前状态为「${dispatch.status}」，只有已完成的调度才能提交回执`);
      }

      const existingReceipt = await queryRunner.manager.findOne(Receipt, {
        where: { dispatchId: dto.dispatchId, status: Not(ReceiptStatus.REJECTED) },
      });
      if (existingReceipt) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`该调度单已有回执：${existingReceipt.receiptNo}（状态：${existingReceipt.status}）`);
      }

      const routes = await queryRunner.manager.find(Route, {
        where: { dispatchId: dispatch.id },
      });
      const collectedRoutes = routes.filter((r) => r.status === RoutePointStatus.COLLECTED);
      const collectedBinCount = collectedRoutes.length;
      const routeTotalWeight = collectedRoutes.reduce(
        (sum, r) => sum + (r.collectedWeight || 0),
        0,
      );

      const netWeight = dto.grossWeight - dto.tareWeight;
      const totalFee = Number((netWeight * dto.unitPrice).toFixed(2));

      const weightDiff = Math.abs(netWeight - routeTotalWeight);
      const weightDiffPercent = routeTotalWeight > 0 ? (weightDiff / routeTotalWeight) * 100 : 0;
      const isWeightMismatch = weightDiffPercent > 10;

      const receiptNo = this.generateReceiptNo();
      const receipt = queryRunner.manager.create(Receipt, {
        receiptNo,
        requestId: dto.requestId,
        dispatchId: dispatch.id,
        vehicleId: dispatch.vehicleId,
        binType: dispatch.targetBinType,
        status: ReceiptStatus.SUBMITTED,
        collectedBinCount,
        grossWeight: dto.grossWeight,
        tareWeight: dto.tareWeight,
        netWeight,
        weighbridgeLocation: dto.weighbridgeLocation || '默认过磅点',
        weighedAt: new Date(),
        unitPrice: dto.unitPrice,
        totalFee,
        weighbridgePhotoUrl: dto.weighbridgePhotoUrl || null,
        submitter: dto.submitter || '司机',
        submittedAt: new Date(),
        remark: dto.remark || null,
      });

      const savedReceipt = await queryRunner.manager.save(receipt);

      dispatch.totalFee = totalFee;
      await queryRunner.manager.save(dispatch);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        dto.requestId,
        savedReceipt.id,
        JSON.stringify({
          receiptId: savedReceipt.id,
          receiptNo: savedReceipt.receiptNo,
        }),
      );

      const weightWarnMsg = isWeightMismatch
        ? `【注意】过磅净重与路线记录重量差异较大：路线 ${routeTotalWeight}kg vs 过磅 ${netWeight}kg（相差 ${weightDiffPercent.toFixed(1)}%）`
        : '';

      return success(
        {
          receiptId: savedReceipt.id,
          receiptNo: savedReceipt.receiptNo,
          dispatchNo: dispatch.dispatchNo,
          dispatchId: dispatch.id,
          collectedBinCount,
          routeTotalWeight,
          grossWeight: dto.grossWeight,
          tareWeight: dto.tareWeight,
          netWeight,
          weightDiff: weightDiffPercent > 0 ? `${weightDiffPercent.toFixed(1)}%` : '无差异',
          isWeightMismatch,
          unitPrice: dto.unitPrice,
          totalFee,
          weighbridgeLocation: savedReceipt.weighbridgeLocation,
          status: savedReceipt.status,
          submitter: savedReceipt.submitter,
          submittedAt: savedReceipt.submittedAt,
        },
        `回执提交成功：${savedReceipt.receiptNo}，净重 ${netWeight} 千克，费用 ${totalFee} 元。${weightWarnMsg}`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, dto.requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyReceipt(
    receiptId: string,
    requestId: string,
    dto: VerifyReceiptDto,
  ): Promise<BizResponse> {
    const bizType = 'RECEIPT_VERIFY';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ receiptId, ...dto }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该核实已处理（重复请求）');
      }
      return idempotent({ receiptId }, '该核实正在处理或已处理');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await queryRunner.manager.findOne(Receipt, {
        where: { id: receiptId },
      });
      if (!receipt) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该回执');
      }

      if (receipt.status === ReceiptStatus.VERIFIED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ receiptId, status: receipt.status }, '该回执已核实');
      }

      if (receipt.status === ReceiptStatus.SETTLED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError('该回执已结算，无法再核实');
      }

      if (receipt.status !== ReceiptStatus.SUBMITTED && receipt.status !== ReceiptStatus.REJECTED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`回执当前状态为「${receipt.status}」，无法核实`);
      }

      if (dto.approved) {
        receipt.status = ReceiptStatus.VERIFIED;
      } else {
        receipt.status = ReceiptStatus.REJECTED;
      }
      receipt.verifier = dto.verifier;
      receipt.verifyRemark = dto.remark || null;
      receipt.verifiedAt = new Date();

      await queryRunner.manager.save(receipt);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        receipt.id,
        JSON.stringify({
          receiptId,
          status: receipt.status,
        }),
      );

      const resultMsg = dto.approved
        ? `核实通过：回执 ${receipt.receiptNo} 已确认有效，可进入结算流程`
        : `核实驳回：回执 ${receipt.receiptNo} 已被驳回，原因：${dto.remark || '未填写'}`;

      return success(
        {
          receiptId: receipt.id,
          receiptNo: receipt.receiptNo,
          status: receipt.status,
          verifier: receipt.verifier,
          verifiedAt: receipt.verifiedAt,
          approved: dto.approved,
          remark: receipt.verifyRemark,
        },
        resultMsg,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async settleReceipt(
    receiptId: string,
    requestId: string,
    settler: string,
  ): Promise<BizResponse> {
    const bizType = 'RECEIPT_SETTLE';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ receiptId, settler }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该结算已处理（重复请求）');
      }
      return idempotent({ receiptId }, '该结算正在处理或已处理');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await queryRunner.manager.findOne(Receipt, {
        where: { id: receiptId },
      });
      if (!receipt) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该回执');
      }

      if (receipt.status === ReceiptStatus.SETTLED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ receiptId, status: receipt.status }, '该回执已结算');
      }

      if (receipt.status !== ReceiptStatus.VERIFIED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`回执当前状态为「${receipt.status}」，只有已核实的回执才能结算`);
      }

      receipt.status = ReceiptStatus.SETTLED;
      receipt.settler = settler;
      receipt.settledAt = new Date();

      await queryRunner.manager.save(receipt);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        receipt.id,
        JSON.stringify({
          receiptId,
          status: ReceiptStatus.SETTLED,
        }),
      );

      return success(
        {
          receiptId: receipt.id,
          receiptNo: receipt.receiptNo,
          status: receipt.status,
          netWeight: receipt.netWeight,
          totalFee: receipt.totalFee,
          settler: receipt.settler,
          settledAt: receipt.settledAt,
        },
        `结算完成：回执 ${receipt.receiptNo}，净重 ${receipt.netWeight} 千克，应付 ${receipt.totalFee} 元已确认结算`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getReceipts(
    status?: ReceiptStatus,
    date?: string,
    limit: number = 20,
  ): Promise<BizResponse> {
    const where: any = {};
    if (status) where.status = status;

    const receipts = await this.receiptRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const statusDesc: Record<string, string> = {
      [ReceiptStatus.DRAFT]: '草稿',
      [ReceiptStatus.SUBMITTED]: '已提交，待核实',
      [ReceiptStatus.VERIFIED]: '已核实，待结算',
      [ReceiptStatus.REJECTED]: '已驳回',
      [ReceiptStatus.SETTLED]: '已结算',
    };

    const totalFee = receipts.reduce((sum, r) => sum + Number(r.totalFee), 0);

    return success(
      {
        total: receipts.length,
        totalFee: Number(totalFee.toFixed(2)),
        receipts: receipts.map((r) => ({
          receiptId: r.id,
          receiptNo: r.receiptNo,
          dispatchId: r.dispatchId,
          binType: r.binType,
          status: r.status,
          statusDesc: statusDesc[r.status] || r.status,
          collectedBinCount: r.collectedBinCount,
          grossWeight: r.grossWeight,
          tareWeight: r.tareWeight,
          netWeight: r.netWeight,
          totalFee: r.totalFee,
          submitter: r.submitter,
          verifier: r.verifier,
          settler: r.settler,
          submittedAt: r.submittedAt,
          verifiedAt: r.verifiedAt,
          settledAt: r.settledAt,
        })),
      },
      `共查询到 ${receipts.length} 条回执${status ? `（状态：${status}）` : ''}，总费用 ${totalFee.toFixed(2)} 元`,
    );
  }
}
