import { Op } from 'sequelize';
import Batch, { BatchStatus } from '../models/Batch';
import dayjs from 'dayjs';

class BatchService {
  async createBatch(name: string, importedBy: string, remark?: string) {
    const batchNo = `BATCH${dayjs().format('YYYYMMDDHHmmss')}`;
    const batch = await Batch.create({
      batchNo,
      name,
      status: BatchStatus.PENDING,
      importedBy,
      importedAt: new Date(),
      remark,
    });
    return batch;
  }

  async getBatchById(id: number) {
    return await Batch.findByPk(id);
  }

  async getBatchByNo(batchNo: string) {
    return await Batch.findOne({ where: { batchNo } });
  }

  async listBatches(page: number = 1, pageSize: number = 20, status?: BatchStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    const { count, rows } = await Batch.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { total: count, list: rows, page, pageSize };
  }

  async updateBatchStatus(id: number, status: BatchStatus, successCount?: number, failCount?: number) {
    const batch = await Batch.findByPk(id);
    if (!batch) {
      throw new Error('批次不存在');
    }
    const updateData: any = { status };
    if (successCount !== undefined) {
      updateData.successCount = successCount;
    }
    if (failCount !== undefined) {
      updateData.failCount = failCount;
    }
    await batch.update(updateData);
    return batch;
  }

  async incrementCounts(id: number, successIncrement: number = 0, failIncrement: number = 0) {
    const batch = await Batch.findByPk(id);
    if (!batch) {
      throw new Error('批次不存在');
    }
    await batch.update({
      successCount: batch.successCount + successIncrement,
      failCount: batch.failCount + failIncrement,
      totalCount: batch.totalCount + successIncrement + failIncrement,
    });
  }
}

export default new BatchService();
