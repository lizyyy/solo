import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { MaintenanceRecord, MaintenanceStatus, FaultTicket, TicketStatus, FailureReason } from '../models';
import ticketService from './TicketService';
import { OperationType } from '../models/OperationHistory';

interface CreateMaintenanceRequest {
  ticketId: string;
  stationId: string;
  pileId: string;
  technicianId?: string;
  technicianName?: string;
  problemDescription?: string;
}

interface UpdateMaintenanceRequest {
  maintenanceId: string;
  status: MaintenanceStatus;
  technicianId?: string;
  technicianName?: string;
  solution?: string;
  partsReplaced?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  failureReason?: FailureReason;
}

class MaintenanceService {
  private analyzeFailureFromSolution(solution: string, partsReplaced?: string): FailureReason {
    const combined = `${solution} ${partsReplaced || ''}`.toLowerCase();
    
    if (combined.includes('模块') || combined.includes('硬件') || combined.includes('更换') || combined.includes('主板')) {
      return FailureReason.HARDWARE_FAILURE;
    }
    if (combined.includes('通信') || combined.includes('网络') || combined.includes('连接') || combined.includes('信号')) {
      return FailureReason.COMMUNICATION_ERROR;
    }
    if (combined.includes('过热') || combined.includes('温度') || combined.includes('散热') || combined.includes('风扇')) {
      return FailureReason.OVERHEAT;
    }
    if (combined.includes('软件') || combined.includes('程序') || combined.includes('升级') || combined.includes('重启')) {
      return FailureReason.SOFTWARE_BUG;
    }
    if (combined.includes('枪') || combined.includes('锁') || combined.includes('gun') || combined.includes('lock')) {
      return FailureReason.GUN_LOCK_FAILURE;
    }
    return FailureReason.UNKNOWN;
  }

  async createMaintenance(request: CreateMaintenanceRequest): Promise<{ maintenance: MaintenanceRecord; ticket: FaultTicket }> {
    const ticket = await FaultTicket.findByPk(request.ticketId);
    if (!ticket) {
      throw new Error(`工单不存在: ${request.ticketId}`);
    }

    if ([TicketStatus.CLOSED, TicketStatus.MAINTENANCE_COMPLETED].includes(ticket.status)) {
      throw new Error(`该工单已${ticket.status === TicketStatus.CLOSED ? '关闭' : '完成维修'}，无需重复派单`);
    }

    const activeMaintenance = await MaintenanceRecord.findOne({
      where: {
        ticketId: request.ticketId,
        status: { [Op.in]: [MaintenanceStatus.PENDING, MaintenanceStatus.DISPATCHED, MaintenanceStatus.IN_PROGRESS] },
      },
    });

    if (activeMaintenance) {
      throw new Error('该工单已有正在进行的维修任务');
    }

    const maintenance = await MaintenanceRecord.create({
      id: uuidv4(),
      ticketId: request.ticketId,
      stationId: request.stationId,
      pileId: request.pileId,
      technicianId: request.technicianId,
      technicianName: request.technicianName,
      problemDescription: request.problemDescription || ticket.faultMessage,
      status: request.technicianId ? MaintenanceStatus.DISPATCHED : MaintenanceStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updatedTicket = await ticketService.updateStatus({
      ticketId: request.ticketId,
      newStatus: request.technicianId ? TicketStatus.MAINTENANCE_IN_PROGRESS : TicketStatus.DISPATCH_PENDING,
      operatorId: request.technicianId,
      operatorName: request.technicianName,
      description: request.technicianId 
        ? `已派单给 ${request.technicianName} 进行维修` 
        : '已创建维修派单，等待分配工程师',
      details: { maintenanceId: maintenance.id },
    });

    return { maintenance, ticket: updatedTicket };
  }

  async updateMaintenance(request: UpdateMaintenanceRequest): Promise<{ maintenance: MaintenanceRecord; ticket?: FaultTicket }> {
    const maintenance = await MaintenanceRecord.findByPk(request.maintenanceId);
    if (!maintenance) {
      throw new Error(`维修记录不存在: ${request.maintenanceId}`);
    }

    const updateData: Partial<MaintenanceRecord> = {
      status: request.status,
      updatedAt: new Date(),
    };

    if (request.technicianId) updateData.technicianId = request.technicianId;
    if (request.technicianName) updateData.technicianName = request.technicianName;
    if (request.solution) updateData.solution = request.solution;
    if (request.partsReplaced) updateData.partsReplaced = request.partsReplaced;
    if (request.startTime) updateData.startTime = request.startTime;
    if (request.endTime) updateData.endTime = request.endTime;
    if (request.notes) updateData.notes = request.notes;

    await maintenance.update(updateData);

    let updatedTicket: FaultTicket | undefined;
    const ticket = await FaultTicket.findByPk(maintenance.ticketId);
    
    if (ticket) {
      if (request.status === MaintenanceStatus.DISPATCHED) {
        updatedTicket = await ticketService.updateStatus({
          ticketId: maintenance.ticketId,
          newStatus: TicketStatus.MAINTENANCE_IN_PROGRESS,
          operatorId: request.technicianId,
          operatorName: request.technicianName,
          description: `维修人员 ${request.technicianName || '已'} 已接单，准备出发`,
          details: { maintenanceId: request.maintenanceId },
        });
      } else if (request.status === MaintenanceStatus.IN_PROGRESS) {
        updatedTicket = await ticketService.updateStatus({
          ticketId: maintenance.ticketId,
          newStatus: TicketStatus.MAINTENANCE_IN_PROGRESS,
          operatorId: request.technicianId,
          operatorName: request.technicianName,
          description: '维修人员已到达现场，开始维修',
          details: { maintenanceId: request.maintenanceId },
        });
      } else if (request.status === MaintenanceStatus.COMPLETED) {
        const analyzedFailureReason = request.failureReason || this.analyzeFailureFromSolution(request.solution || '', request.partsReplaced);
        
        updatedTicket = await ticketService.updateStatus({
          ticketId: maintenance.ticketId,
          newStatus: TicketStatus.MAINTENANCE_COMPLETED,
          operatorId: request.technicianId,
          operatorName: request.technicianName,
          description: `维修完成: ${request.solution || '未填写解决方案'}`,
          failureReason: analyzedFailureReason,
          details: { 
            maintenanceId: request.maintenanceId, 
            solution: request.solution,
            partsReplaced: request.partsReplaced,
            analyzedFailureReason,
          },
        });
      } else if (request.status === MaintenanceStatus.CANCELLED) {
        const suggestion = await ticketService.getDecisionSuggestion(maintenance.ticketId);
        updatedTicket = await ticketService.updateStatus({
          ticketId: maintenance.ticketId,
          newStatus: suggestion.recommendedAction === 'remote_restart' 
            ? TicketStatus.REMOTE_RESTART_FAILED 
            : TicketStatus.DISPATCH_PENDING,
          operatorId: request.technicianId,
          operatorName: request.technicianName,
          description: `维修任务已取消: ${request.notes || '未填写原因'}`,
          details: { maintenanceId: request.maintenanceId },
        });
      }
    }

    return { maintenance, ticket: updatedTicket };
  }

  async getMaintenanceByTicket(ticketId: string): Promise<MaintenanceRecord[]> {
    return MaintenanceRecord.findAll({
      where: { ticketId },
      order: [['createdAt', 'DESC']],
    });
  }
}

export default new MaintenanceService();
