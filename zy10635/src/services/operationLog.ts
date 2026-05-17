import { AppDataSource } from '../app';
import { OperationLog } from '../models/OperationLog';

export class OperationLogService {
  private repository = AppDataSource.getRepository(OperationLog);

  async log(
    entityType: string,
    entityId: number,
    operation: string,
    operator: string,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
    remark?: string
  ): Promise<OperationLog> {
    const log = this.repository.create({
      entityType,
      entityId,
      operation,
      operator,
      oldValue,
      newValue,
      remark,
    });
    return await this.repository.save(log);
  }

  async getLogs(entityType: string, entityId: number): Promise<OperationLog[]> {
    return await this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllLogs(entityType?: string): Promise<OperationLog[]> {
    const where = entityType ? { entityType } : {};
    return await this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}

export const operationLogService = new OperationLogService();