import { v4 as uuidv4 } from 'uuid';
import ExceptionRecord from '../models/ExceptionRecord';

type ExceptionType = 'file_expiry' | 'download_failure' | 'task_failure' | 'repeated_operation' | 'sensitive_field_violation' | 'other';

class ExceptionService {
  async recordException(
    type: ExceptionType,
    description: string,
    requestId?: string,
    details?: object
  ): Promise<ExceptionRecord> {
    const exception = await ExceptionRecord.create({
      id: uuidv4(),
      type,
      description,
      requestId,
      details,
    });

    return exception;
  }

  async getPendingExceptions(): Promise<ExceptionRecord[]> {
    return ExceptionRecord.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
    });
  }

  async getAllExceptions(): Promise<ExceptionRecord[]> {
    return ExceptionRecord.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  async processException(
    exceptionId: string,
    processorId: string,
    action: 'processed' | 'ignored'
  ): Promise<ExceptionRecord | null> {
    const exception = await ExceptionRecord.findByPk(exceptionId);
    if (!exception) {
      return null;
    }

    exception.status = action;
    exception.processedBy = processorId;
    exception.processedAt = new Date();
    await exception.save();

    return exception;
  }
}

export default new ExceptionService();
