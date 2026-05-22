import { AppDataSource } from '../data-source';
import { MaterialReceipt } from '../entities/MaterialReceipt';
import { Batch } from '../entities/Batch';
import { Attachment } from '../entities/Attachment';
import { ReceiptStatus, RecordStatus, ActionType } from '../constants/ReceiptStatus';
import { stateMachineService } from './StateMachineService';
import { v4 as uuidv4 } from 'uuid';

export interface CreateReceiptData {
  receiptNo?: string;
  batchId?: string;
  franchiseId: string;
  orderId?: string;
  sourceType: string;
  sourceNo?: string;
  materialCode?: string;
  materialName?: string;
  quantity?: number;
  reportedQuantity?: number;
  unitPrice?: number;
  amount?: number;
  reportedAmount?: number;
  abnormalType?: string;
  abnormalReason?: string;
  remark?: string;
}

export class ReceiptService {
  private receiptRepository = AppDataSource.getRepository(MaterialReceipt);
  private batchRepository = AppDataSource.getRepository(Batch);
  private attachmentRepository = AppDataSource.getRepository(Attachment);

  async createReceipt(data: CreateReceiptData): Promise<MaterialReceipt> {
    const receipt = this.receiptRepository.create({
      receiptNo: data.receiptNo || this.generateReceiptNo(),
      batchId: data.batchId,
      franchiseId: data.franchiseId,
      orderId: data.orderId,
      sourceType: data.sourceType,
      sourceNo: data.sourceNo,
      materialCode: data.materialCode,
      materialName: data.materialName,
      quantity: data.quantity || 0,
      reportedQuantity: data.reportedQuantity || 0,
      unitPrice: data.unitPrice || 0,
      amount: data.amount || 0,
      reportedAmount: data.reportedAmount || 0,
      abnormalType: data.abnormalType,
      abnormalReason: data.abnormalReason,
      remark: data.remark,
      status: ReceiptStatus.DRAFT,
      recordStatus: RecordStatus.UNPROCESSED
    });

    return this.receiptRepository.save(receipt);
  }

  async getReceipt(id: string): Promise<MaterialReceipt | null> {
    return this.receiptRepository.findOne({
      where: { id },
      relations: ['franchise', 'order', 'batch', 'attachments']
    });
  }

  async getReceiptList(params: {
    franchiseId?: string;
    status?: ReceiptStatus;
    recordStatus?: RecordStatus;
    batchId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: MaterialReceipt[]; total: number }> {
    const { franchiseId, status, recordStatus, batchId, page = 1, pageSize = 20 } = params;

    const queryBuilder = this.receiptRepository.createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.franchise', 'franchise')
      .leftJoinAndSelect('receipt.batch', 'batch')
      .where('receipt.isDeleted = :isDeleted', { isDeleted: false });

    if (franchiseId) {
      queryBuilder.andWhere('receipt.franchiseId = :franchiseId', { franchiseId });
    }

    if (status) {
      queryBuilder.andWhere('receipt.status = :status', { status });
    }

    if (recordStatus) {
      queryBuilder.andWhere('receipt.recordStatus = :recordStatus', { recordStatus });
    }

    if (batchId) {
      queryBuilder.andWhere('receipt.batchId = :batchId', { batchId });
    }

    const [list, total] = await queryBuilder
      .orderBy('receipt.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async submitForReview(id: string, operator?: string): Promise<any> {
    return stateMachineService.transition({
      receiptId: id,
      targetStatus: ReceiptStatus.PENDING_REVIEW,
      actionType: ActionType.CREATE_BATCH,
      operator,
      reason: '提交审核'
    });
  }

  async reviewDecision(
    id: string,
    decision: 'approve' | 'reject',
    reason: string,
    operator?: string
  ): Promise<any> {
    const targetStatus = decision === 'approve'
      ? ReceiptStatus.APPROVED
      : ReceiptStatus.REJECTED;

    return stateMachineService.transition({
      receiptId: id,
      targetStatus,
      actionType: ActionType.REVIEW_DECISION,
      reason,
      operator,
      additionalData: {
        reviewReason: reason,
        reviewedBy: operator,
        reviewedAt: new Date()
      }
    });
  }

  async freezeSettlement(
    id: string,
    freezeReason: string,
    operator?: string
  ): Promise<any> {
    const receipt = await this.getReceipt(id);
    if (!receipt) {
      return { success: false, error: '回执记录不存在' };
    }

    const beforeFreezeData = {
      status: receipt.status,
      amount: receipt.amount,
      quantity: receipt.quantity
    };

    return stateMachineService.transition({
      receiptId: id,
      targetStatus: ReceiptStatus.FROZEN,
      actionType: ActionType.FREEZE_SETTLEMENT,
      reason: freezeReason,
      operator,
      additionalData: {
        beforeFreezeData,
        freezeReason
      }
    });
  }

  async unfreezeSettlement(
    id: string,
    reason: string,
    operator?: string
  ): Promise<any> {
    return stateMachineService.transition({
      receiptId: id,
      targetStatus: ReceiptStatus.APPROVED,
      actionType: ActionType.UNFREEZE_SETTLEMENT,
      reason,
      operator
    });
  }

  async cancelReceipt(
    id: string,
    reason: string,
    operator?: string
  ): Promise<any> {
    return stateMachineService.transition({
      receiptId: id,
      targetStatus: ReceiptStatus.CANCELLED,
      actionType: ActionType.CANCEL,
      reason,
      operator
    });
  }

  async archiveReceipt(
    id: string,
    operator?: string
  ): Promise<any> {
    return stateMachineService.transition({
      receiptId: id,
      targetStatus: ReceiptStatus.ARCHIVED,
      actionType: ActionType.ARCHIVE,
      operator,
      reason: '归档'
    });
  }

  async correctReceipt(
    id: string,
    updateData: Partial<CreateReceiptData>,
    reason: string,
    operator?: string
  ): Promise<any> {
    const receipt = await this.getReceipt(id);
    if (!receipt) {
      return { success: false, error: '回执记录不存在' };
    }

    Object.assign(receipt, updateData);
    receipt.recordStatus = RecordStatus.CORRECTED;
    receipt.manualReason = reason;

    await this.receiptRepository.save(receipt);

    return { success: true, receipt };
  }

  async addAttachment(
    receiptId: string,
    fileData: {
      fileName: string;
      filePath: string;
      fileType?: string;
      fileSize?: number;
      uploadedBy?: string;
      description?: string;
    }
  ): Promise<Attachment> {
    const attachment = this.attachmentRepository.create({
      receiptId,
      fileName: fileData.fileName,
      filePath: fileData.filePath,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      uploadedBy: fileData.uploadedBy,
      description: fileData.description
    });

    return this.attachmentRepository.save(attachment);
  }

  async getAttachments(receiptId: string): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { receiptId },
      order: { createdAt: 'DESC' }
    });
  }

  private generateReceiptNo(): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RCP${dateStr}${random}`;
  }
}

export const receiptService = new ReceiptService();
