import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { FaultTicket, TicketStatus, FailureReason, OperationHistory, OperationType, RemoteOperation, OperationStatus } from '../models';

interface CreateTicketRequest {
  stationId: string;
  pileId: string;
  faultCode: string;
  faultMessage: string;
  faultLevel: string;
  orderId?: string;
  userId?: string;
  reportedAt?: Date;
}

interface UpdateTicketStatusRequest {
  ticketId: string;
  newStatus: TicketStatus;
  operatorId?: string;
  operatorName?: string;
  description: string;
  failureReason?: FailureReason;
  details?: Record<string, any>;
}

interface DecisionSuggestion {
  recommendedAction: 'remote_restart' | 'dispatch_maintenance' | 'wait_and_observe';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  nextSteps: string[];
  estimatedResolutionTime: string;
}

interface TicketAnalysis {
  isHighPriority: boolean;
  hasRefund: boolean;
  hasMaintenanceHistory: boolean;
  recentFailures: number;
}

class TicketService {
  private generateTicketCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FT-${timestamp}-${random}`;
  }

  async detectDuplicate(pileId: string, faultCode: string, reportedAt: Date): Promise<FaultTicket | null> {
    const timeWindow = 30 * 60 * 1000;
    const startTime = new Date(reportedAt.getTime() - timeWindow);

    const existingTicket = await FaultTicket.findOne({
      where: {
        pileId,
        faultCode,
        reportedAt: { [Op.between]: [startTime, reportedAt] },
        status: { [Op.notIn]: [TicketStatus.CLOSED, TicketStatus.REOPENED] },
        isDuplicate: false,
      },
      order: [['reportedAt', 'DESC']],
    });

    return existingTicket;
  }

  async createTicket(request: CreateTicketRequest): Promise<{ ticket: FaultTicket; isDuplicate: boolean; suggestion?: DecisionSuggestion }> {
    const reportedAt = request.reportedAt || new Date();
    const duplicateTicket = await this.detectDuplicate(request.pileId, request.faultCode, reportedAt);

    if (duplicateTicket) {
      await this.recordHistory({
        ticketId: duplicateTicket.id,
        operationType: OperationType.DUPLICATE_DETECTED,
        operatorId: request.userId,
        description: `检测到重复故障报告: ${request.faultMessage}`,
        details: { duplicateReportedAt: reportedAt },
      });

      return { ticket: duplicateTicket, isDuplicate: true };
    }

    const activeClosedTicket = await FaultTicket.findOne({
      where: {
        pileId: request.pileId,
        faultCode: request.faultCode,
        status: TicketStatus.CLOSED,
      },
      order: [['closedAt', 'DESC']],
    });

    const isReopened = activeClosedTicket && 
      reportedAt.getTime() - (activeClosedTicket.closedAt?.getTime() || 0) < 2 * 60 * 60 * 1000;

    const ticket = await FaultTicket.create({
      id: uuidv4(),
      ticketCode: this.generateTicketCode(),
      stationId: request.stationId,
      pileId: request.pileId,
      faultCode: request.faultCode,
      faultMessage: request.faultMessage,
      faultLevel: request.faultLevel,
      failureReason: this.analyzeInitialFailureReason(request.faultCode, request.faultMessage),
      status: isReopened ? TicketStatus.REOPENED : TicketStatus.NEW,
      orderId: request.orderId,
      userId: request.userId,
      remoteRestartAttempts: 0,
      maxRemoteRestarts: 2,
      isDuplicate: false,
      originalTicketId: isReopened ? activeClosedTicket.id : undefined,
      reportedAt,
      lastStatusChangeAt: reportedAt,
    });

    await this.recordHistory({
      ticketId: ticket.id,
      operationType: isReopened ? OperationType.TICKET_REOPENED : OperationType.FAULT_REPORTED,
      operatorId: request.userId,
      description: isReopened ? `工单重新打开: ${request.faultMessage}` : `新故障报告: ${request.faultMessage}`,
      details: { originalTicketId: isReopened ? activeClosedTicket.id : undefined },
    });

    const suggestion = await this.getDecisionSuggestion(ticket.id);

    return { ticket, isDuplicate: false, suggestion };
  }

  private analyzeInitialFailureReason(faultCode: string, faultMessage: string): FailureReason {
    const combined = `${faultCode} ${faultMessage}`.toLowerCase();
    
    if (combined.includes('硬件') || combined.includes('hardware') || combined.includes('模块') || combined.includes('损坏')) {
      return FailureReason.HARDWARE_FAILURE;
    }
    if (combined.includes('通信') || combined.includes('连接') || combined.includes('超时') || combined.includes('timeout')) {
      return FailureReason.COMMUNICATION_ERROR;
    }
    if (combined.includes('过热') || combined.includes('温度') || combined.includes('overheat') || combined.includes('高温')) {
      return FailureReason.OVERHEAT;
    }
    if (combined.includes('软件') || combined.includes('程序') || combined.includes('bug')) {
      return FailureReason.SOFTWARE_BUG;
    }
    if (combined.includes('支付') || combined.includes('payment')) {
      return FailureReason.PAYMENT_FAILURE;
    }
    if (combined.includes('枪锁') || combined.includes('枪') || combined.includes('lock')) {
      return FailureReason.GUN_LOCK_FAILURE;
    }
    return FailureReason.UNKNOWN;
  }

  private async analyzeTicket(ticketId: string): Promise<TicketAnalysis> {
    const ticket = await FaultTicket.findByPk(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${ticketId}`);
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFailureCount = await FaultTicket.count({
      where: {
        pileId: ticket.pileId,
        reportedAt: { [Op.gte]: oneWeekAgo },
      },
    });

    const hasMaintenance = await FaultTicket.count({
      where: {
        pileId: ticket.pileId,
        status: TicketStatus.MAINTENANCE_COMPLETED,
        reportedAt: { [Op.gte]: oneWeekAgo },
      },
    });

    return {
      isHighPriority: ticket.faultLevel === 'high' || ticket.faultLevel === 'critical',
      hasRefund: ticket.status === TicketStatus.REFUNDED,
      hasMaintenanceHistory: hasMaintenance > 0,
      recentFailures: recentFailureCount,
    };
  }

  async getDecisionSuggestion(ticketId: string): Promise<DecisionSuggestion> {
    const ticket = await FaultTicket.findByPk(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${ticketId}`);
    }

    const analysis = await this.analyzeTicket(ticketId);
    const reasons: string[] = [];
    const nextSteps: string[] = [];

    const hardwareFailureCodes = ['E001', 'E002', 'E003', 'E101', 'E102'];
    const communicationCodes = ['E201', 'E202', 'E203'];
    const overheatCodes = ['E301', 'E302'];

    if (hardwareFailureCodes.includes(ticket.faultCode) || ticket.failureReason === FailureReason.HARDWARE_FAILURE) {
      reasons.push('故障码指向硬件问题');
      return {
        recommendedAction: 'dispatch_maintenance',
        confidence: 'high',
        reasons: [...reasons, '硬件故障通常需要现场更换部件'],
        nextSteps: ['立即派维修人员', '准备相关备件', '联系用户说明情况'],
        estimatedResolutionTime: '2-4小时',
      };
    }

    if (analysis.recentFailures >= 3) {
      reasons.push(`该桩在一周内出现了${analysis.recentFailures}次故障`);
      return {
        recommendedAction: 'dispatch_maintenance',
        confidence: 'high',
        reasons: [...reasons, '重复故障表明存在深层问题'],
        nextSteps: ['派资深工程师现场排查', '检查整个充电桩系统', '记录详细故障日志'],
        estimatedResolutionTime: '4-8小时',
      };
    }

    if (analysis.hasMaintenanceHistory) {
      reasons.push('该桩近期有维修记录');
    }

    if (communicationCodes.includes(ticket.faultCode) || ticket.failureReason === FailureReason.COMMUNICATION_ERROR) {
      reasons.push('通信类故障通常可通过远程重启解决');
      nextSteps.push('执行远程重启命令');
      nextSteps.push('监控设备重连状态');
      nextSteps.push('如果失败，尝试重置通信模块');
      
      return {
        recommendedAction: 'remote_restart',
        confidence: 'high',
        reasons,
        nextSteps,
        estimatedResolutionTime: '5-15分钟',
      };
    }

    if (overheatCodes.includes(ticket.faultCode) || ticket.failureReason === FailureReason.OVERHEAT) {
      reasons.push('过热故障需要先降温观察');
      return {
        recommendedAction: 'wait_and_observe',
        confidence: 'medium',
        reasons: [...reasons, '建议等待30分钟让设备降温'],
        nextSteps: ['远程停止充电', '监控温度变化', '30分钟后尝试重启'],
        estimatedResolutionTime: '30-60分钟',
      };
    }

    if (analysis.isHighPriority) {
      reasons.push('高优先级故障');
      return {
        recommendedAction: ticket.remoteRestartAttempts === 0 ? 'remote_restart' : 'dispatch_maintenance',
        confidence: ticket.remoteRestartAttempts === 0 ? 'medium' : 'high',
        reasons: [...reasons, ticket.remoteRestartAttempts === 0 ? '先尝试远程重启快速解决' : '已尝试远程，需要现场处理'],
        nextSteps: ticket.remoteRestartAttempts === 0 
          ? ['立即远程重启', '监控5分钟', '失败则立即派单']
          : ['立即派维修人员', '准备应急方案'],
        estimatedResolutionTime: ticket.remoteRestartAttempts === 0 ? '5-15分钟' : '2-4小时',
      };
    }

    return {
      recommendedAction: ticket.remoteRestartAttempts === 0 ? 'remote_restart' : 'dispatch_maintenance',
      confidence: 'medium',
      reasons: ['标准处理流程', ticket.remoteRestartAttempts === 0 ? '优先尝试低成本方案' : '远程方案已尝试'],
      nextSteps: ticket.remoteRestartAttempts === 0 
        ? ['执行远程重启', '观察设备状态']
        : ['安排维修人员'],
      estimatedResolutionTime: ticket.remoteRestartAttempts === 0 ? '5-15分钟' : '2-4小时',
    };
  }

  async updateStatus(request: UpdateTicketStatusRequest): Promise<FaultTicket> {
    const ticket = await FaultTicket.findByPk(request.ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${request.ticketId}`);
    }

    const oldStatus = ticket.status;
    const updateData: Partial<FaultTicket> = {
      status: request.newStatus,
      lastStatusChangeAt: new Date(),
    };

    if (request.failureReason) {
      updateData.failureReason = request.failureReason;
    }

    if (request.newStatus === TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    await ticket.update(updateData);

    await this.recordHistory({
      ticketId: ticket.id,
      operationType: OperationType.STATUS_CHANGED,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      description: request.description,
      oldStatus,
      newStatus: request.newStatus,
      details: request.details,
    });

    return ticket;
  }

  async canRemoteRestart(ticketId: string): Promise<boolean> {
    const ticket = await FaultTicket.findByPk(ticketId);
    if (!ticket) return false;

    const canRestart = 
      ticket.remoteRestartAttempts < ticket.maxRemoteRestarts &&
      ![TicketStatus.CLOSED, TicketStatus.MAINTENANCE_COMPLETED].includes(ticket.status);

    return canRestart;
  }

  async recordHistory(params: {
    ticketId: string;
    operationType: OperationType;
    operatorId?: string;
    operatorName?: string;
    description: string;
    oldStatus?: string;
    newStatus?: string;
    details?: Record<string, any>;
  }): Promise<OperationHistory> {
    return OperationHistory.create({
      id: uuidv4(),
      ticketId: params.ticketId,
      operationType: params.operationType,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      description: params.description,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      details: params.details,
      operatedAt: new Date(),
    });
  }

  async getTicketWithHistory(ticketId: string): Promise<{ ticket: FaultTicket; histories: OperationHistory[]; suggestion: DecisionSuggestion } | null> {
    const ticket = await FaultTicket.findByPk(ticketId, {
      include: [
        { model: OperationHistory, as: 'histories', order: [['operatedAt', 'ASC']] },
      ],
    });

    if (!ticket) return null;
    
    const suggestion = await this.getDecisionSuggestion(ticketId);
    const ticketJson = ticket.toJSON() as any;
    
    return { 
      ticket, 
      histories: ticketJson.histories || [],
      suggestion,
    };
  }

  async getTicketTimeline(pileId: string, startTime: Date, endTime: Date): Promise<FaultTicket[]> {
    return FaultTicket.findAll({
      where: {
        pileId,
        reportedAt: { [Op.between]: [startTime, endTime] },
      },
      include: [
        { model: OperationHistory, as: 'histories', order: [['operatedAt', 'ASC']] },
      ],
      order: [['reportedAt', 'ASC']],
    });
  }
}

export default new TicketService();
