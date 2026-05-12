import { v4 as uuidv4 } from 'uuid';
import { RemoteOperation, OperationCommand, OperationStatus, FaultTicket, TicketStatus, FailureReason } from '../models';
import ticketService from './TicketService';
import { OperationType } from '../models/OperationHistory';

interface CreateRemoteOperationRequest {
  ticketId: string;
  stationId: string;
  pileId: string;
  command: OperationCommand;
  operatorId?: string;
  operatorName?: string;
}

interface UpdateRemoteOperationRequest {
  operationId: string;
  status: OperationStatus;
  resultMessage?: string;
  failureReason?: FailureReason;
}

interface EscalationSuggestion {
  shouldEscalate: boolean;
  reason: string;
  suggestedAction: string;
}

class RemoteOperationService {
  async createOperation(request: CreateRemoteOperationRequest): Promise<RemoteOperation> {
    const canRestart = await ticketService.canRemoteRestart(request.ticketId);
    if (!canRestart) {
      const ticket = await FaultTicket.findByPk(request.ticketId);
      if (ticket && ticket.remoteRestartAttempts >= ticket.maxRemoteRestarts) {
        throw new Error('该工单已达到最大远程重试次数，建议直接派维修人员');
      }
      throw new Error('该工单无法进行远程操作，可能已关闭');
    }

    const ticket = await FaultTicket.findByPk(request.ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${request.ticketId}`);
    }

    const oldStatus = ticket.status;
    const newAttemptCount = ticket.remoteRestartAttempts + 1;

    const operation = await RemoteOperation.create({
      id: uuidv4(),
      ticketId: request.ticketId,
      stationId: request.stationId,
      pileId: request.pileId,
      command: request.command,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      status: OperationStatus.PENDING,
      requestedAt: new Date(),
    });

    await ticket.update({
      remoteRestartAttempts: newAttemptCount,
      status: TicketStatus.REMOTE_RESTART_PENDING,
      lastStatusChangeAt: new Date(),
    });

    await ticketService.recordHistory({
      ticketId: request.ticketId,
      operationType: OperationType.REMOTE_RESTART_TRIGGERED,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      description: `触发远程操作: ${request.command} (第${newAttemptCount}次尝试)`,
      oldStatus,
      newStatus: TicketStatus.REMOTE_RESTART_PENDING,
      details: { operationId: operation.id, attempt: newAttemptCount, maxAttempts: ticket.maxRemoteRestarts },
    });

    return operation;
  }

  async checkEscalation(ticketId: string): Promise<EscalationSuggestion> {
    const ticket = await FaultTicket.findByPk(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${ticketId}`);
    }

    if (ticket.remoteRestartAttempts >= ticket.maxRemoteRestarts) {
      return {
        shouldEscalate: true,
        reason: `已尝试${ticket.remoteRestartAttempts}次远程操作均失败，达到最大重试次数`,
        suggestedAction: '建议立即派维修人员现场处理',
      };
    }

    return {
      shouldEscalate: false,
      reason: `已尝试${ticket.remoteRestartAttempts}次远程操作，还可继续尝试`,
      suggestedAction: '继续远程排查',
    };
  }

  async updateOperation(request: UpdateRemoteOperationRequest): Promise<RemoteOperation> {
    const operation = await RemoteOperation.findByPk(request.operationId);
    if (!operation) {
      throw new Error(`远程操作不存在: ${request.operationId}`);
    }

    const ticket = await FaultTicket.findByPk(operation.ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${operation.ticketId}`);
    }

    const updateData: Partial<RemoteOperation> = {
      status: request.status,
      resultMessage: request.resultMessage,
      completedAt: new Date(),
    };

    if (request.status !== OperationStatus.PENDING) {
      updateData.executedAt = new Date();
    }

    await operation.update(updateData);

    if (request.status === OperationStatus.SUCCESS) {
      await ticketService.updateStatus({
        ticketId: operation.ticketId,
        newStatus: TicketStatus.REMOTE_RESTART_SUCCESS,
        operatorId: operation.operatorId,
        operatorName: operation.operatorName,
        description: `远程操作成功: ${operation.command}`,
        details: { operationId: operation.id, resultMessage: request.resultMessage },
        failureReason: FailureReason.COMMUNICATION_ERROR,
      });
    } else if (request.status === OperationStatus.FAILED || request.status === OperationStatus.TIMEOUT) {
      const escalation = await this.checkEscalation(operation.ticketId);
      
      await ticketService.updateStatus({
        ticketId: operation.ticketId,
        newStatus: escalation.shouldEscalate ? TicketStatus.DISPATCH_PENDING : TicketStatus.REMOTE_RESTART_FAILED,
        operatorId: operation.operatorId,
        operatorName: operation.operatorName,
        description: `远程操作失败: ${operation.command} - ${request.resultMessage || '未知原因'}。${escalation.reason}。${escalation.suggestedAction}`,
        details: { 
          operationId: operation.id, 
          resultMessage: request.resultMessage,
          escalationSuggestion: escalation,
        },
        failureReason: request.failureReason || this.analyzeFailureReason(request.resultMessage || ''),
      });
    }

    return operation;
  }

  private analyzeFailureReason(resultMessage: string): FailureReason {
    const message = resultMessage.toLowerCase();
    if (message.includes('硬件') || message.includes('hardware') || message.includes('模块')) {
      return FailureReason.HARDWARE_FAILURE;
    }
    if (message.includes('超时') || message.includes('timeout') || message.includes('连接') || message.includes('网络')) {
      return FailureReason.COMMUNICATION_ERROR;
    }
    if (message.includes('过热') || message.includes('温度') || message.includes('overheat')) {
      return FailureReason.OVERHEAT;
    }
    if (message.includes('软件') || message.includes('software') || message.includes('bug') || message.includes('程序')) {
      return FailureReason.SOFTWARE_BUG;
    }
    if (message.includes('支付') || message.includes('payment')) {
      return FailureReason.PAYMENT_FAILURE;
    }
    return FailureReason.UNKNOWN;
  }

  async getOperationsByTicket(ticketId: string): Promise<RemoteOperation[]> {
    return RemoteOperation.findAll({
      where: { ticketId },
      order: [['requestedAt', 'DESC']],
    });
  }
}

export default new RemoteOperationService();
