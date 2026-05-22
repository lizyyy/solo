import { AppDataSource } from '../data-source';
import { Batch } from '../entities/Batch';
import { MaterialReceipt } from '../entities/MaterialReceipt';
import { v4 as uuidv4 } from 'uuid';

export interface CreateBatchData {
  batchNo?: string;
  batchDate: Date;
  batchName: string;
  description?: string;
  createdBy?: string;
  receiptIds?: string[];
}

export class BatchService {
  private batchRepository = AppDataSource.getRepository(Batch);
  private receiptRepository = AppDataSource.getRepository(MaterialReceipt);

  async createBatch(data: CreateBatchData): Promise<Batch> {
    const batch = this.batchRepository.create({
      batchNo: data.batchNo || this.generateBatchNo(),
      batchDate: data.batchDate,
      batchName: data.batchName,
      description: data.description,
      createdBy: data.createdBy,
      totalRecords: 0,
      totalAmount: 0
    });

    const savedBatch = await this.batchRepository.save(batch);

    if (data.receiptIds && data.receiptIds.length > 0) {
      await this.addReceiptsToBatch(savedBatch.id, data.receiptIds);
    }

    return this.updateBatchStats(savedBatch.id);
  }

  async addReceiptsToBatch(batchId: string, receiptIds: string[]): Promise<Batch> {
    await this.receiptRepository
      .createQueryBuilder()
      .update(MaterialReceipt)
      .set({ batchId })
      .where('id IN (:...ids)', { ids: receiptIds })
      .execute();

    return this.updateBatchStats(batchId);
  }

  async removeReceiptsFromBatch(batchId: string, receiptIds: string[]): Promise<Batch> {
    await this.receiptRepository
      .createQueryBuilder()
      .update(MaterialReceipt)
      .set({ batchId: null as any })
      .where('id IN (:...ids) AND batchId = :batchId', { ids: receiptIds, batchId })
      .execute();

    return this.updateBatchStats(batchId);
  }

  private async updateBatchStats(batchId: string): Promise<Batch> {
    const result = await this.receiptRepository
      .createQueryBuilder('receipt')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(receipt.amount)', 'amount')
      .where('receipt.batchId = :batchId', { batchId })
      .andWhere('receipt.isDeleted = :isDeleted', { isDeleted: false })
      .getRawOne();

    const count = parseInt(result.count) || 0;
    const amount = parseFloat(result.amount) || 0;

    await this.batchRepository.update(batchId, {
      totalRecords: count,
      totalAmount: amount
    });

    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['receipts']
    });

    if (!batch) {
      throw new Error('批次不存在');
    }

    return batch;
  }

  async getBatch(id: string): Promise<Batch | null> {
    return this.batchRepository.findOne({
      where: { id },
      relations: ['receipts']
    });
  }

  async getBatchList(params: {
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ list: Batch[]; total: number }> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;

    const queryBuilder = this.batchRepository.createQueryBuilder('batch')
      .where('batch.isDeleted = :isDeleted', { isDeleted: false });

    if (startDate) {
      queryBuilder.andWhere('batch.batchDate >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('batch.batchDate <= :endDate', { endDate });
    }

    const [list, total] = await queryBuilder
      .orderBy('batch.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async deleteBatch(id: string): Promise<boolean> {
    const receipts = await this.receiptRepository.find({
      where: { batchId: id }
    });

    for (const receipt of receipts) {
      receipt.batchId = null as any;
      await this.receiptRepository.save(receipt);
    }

    const result = await this.batchRepository.update(id, { isDeleted: true });
    return result.affected !== undefined && result.affected > 0;
  }

  private generateBatchNo(): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BAT${dateStr}${random}`;
  }
}

export const batchService = new BatchService();
