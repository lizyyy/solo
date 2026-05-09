import OperationModel, { OperationDocument } from '../models/Operation';
import { Operation, OperationType, LiveMessage } from '@live-push/shared';
import { generateId } from '@live-push/shared';
import logger from '../utils/logger';

class OperationLogService {
  async recordOperation(
    messageId: string,
    type: OperationType,
    operatorId: string,
    operatorName: string,
    traceId: string,
    options: {
      beforeState?: Partial<LiveMessage>;
      afterState?: Partial<LiveMessage>;
      reason?: string;
      ip?: string;
      userAgent?: string;
    } = {}
  ): Promise<Operation> {
    const operation: Operation = {
      id: generateId(),
      messageId,
      type,
      operatorId,
      operatorName,
      beforeState: options.beforeState,
      afterState: options.afterState,
      reason: options.reason,
      timestamp: new Date(),
      traceId,
      ip: options.ip,
      userAgent: options.userAgent,
    };

    const operationDoc = new OperationModel({
      _id: operation.id,
      messageId: operation.messageId,
      type: operation.type,
      operatorId: operation.operatorId,
      operatorName: operation.operatorName,
      beforeState: operation.beforeState,
      afterState: operation.afterState,
      reason: operation.reason,
      traceId: operation.traceId,
      ip: operation.ip,
      userAgent: operation.userAgent,
    });

    await operationDoc.save();

    logger.info('Operation recorded', {
      operationId: operation.id,
      messageId,
      type,
      operatorId,
      traceId,
    });

    return operation;
  }

  async getOperationsByMessageId(
    messageId: string,
    limit: number = 100
  ): Promise<Operation[]> {
    const operationDocs = await OperationModel.find({ messageId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return operationDocs.map((doc) => this.toOperation(doc));
  }

  async getOperationsByTraceId(traceId: string): Promise<Operation[]> {
    const operationDocs = await OperationModel.find({ traceId }).sort({ timestamp: 1 });
    return operationDocs.map((doc) => this.toOperation(doc));
  }

  async getOperationsByOperator(
    operatorId: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<Operation[]> {
    const query: Record<string, unknown> = { operatorId };

    if (startTime || endTime) {
      query['timestamp'] = {} as Record<string, unknown>;
      if (startTime) query['timestamp'].$gte = startTime;
      if (endTime) query['timestamp'].$lte = endTime;
    }

    const operationDocs = await OperationModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    return operationDocs.map((doc) => this.toOperation(doc));
  }

  async getOperationsByType(
    type: OperationType,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<Operation[]> {
    const query: Record<string, unknown> = { type };

    if (startTime || endTime) {
      query['timestamp'] = {} as Record<string, unknown>;
      if (startTime) query['timestamp'].$gte = startTime;
      if (endTime) query['timestamp'].$lte = endTime;
    }

    const operationDocs = await OperationModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    return operationDocs.map((doc) => this.toOperation(doc));
  }

  async getOperationsByTimeRange(
    startTime: Date,
    endTime: Date,
    types?: OperationType[],
    limit: number = 1000
  ): Promise<Operation[]> {
    const query: Record<string, unknown> = {
      timestamp: {
        $gte: startTime,
        $lte: endTime,
      },
    };

    if (types && types.length > 0) {
      query['type'] = { $in: types };
    }

    const operationDocs = await OperationModel.find(query)
      .sort({ timestamp: 1 })
      .limit(limit);

    return operationDocs.map((doc) => this.toOperation(doc));
  }

  async getOperationById(operationId: string): Promise<Operation | null> {
    const operationDoc = await OperationModel.findById(operationId);
    return operationDoc ? this.toOperation(operationDoc) : null;
  }

  private toOperation(doc: OperationDocument): Operation {
    return {
      id: doc._id,
      messageId: doc.messageId,
      type: doc.type as OperationType,
      operatorId: doc.operatorId,
      operatorName: doc.operatorName,
      beforeState: doc.beforeState as Partial<LiveMessage> | undefined,
      afterState: doc.afterState as Partial<LiveMessage> | undefined,
      reason: doc.reason,
      timestamp: doc.timestamp,
      traceId: doc.traceId,
      ip: doc.ip,
      userAgent: doc.userAgent,
    };
  }
}

export default new OperationLogService();
