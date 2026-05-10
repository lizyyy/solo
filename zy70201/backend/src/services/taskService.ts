import prisma from '../utils/prisma';
import { TaskStatus, VehicleStatus } from '../utils/constants';
import { AppError } from '../utils/errorHandler';
import * as ExcelJS from 'exceljs';

export interface CreateTaskDto {
  slopeId: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  notes?: string;
}

export interface AssignTaskDto {
  taskId: string;
  vehicleId: string;
}

export const taskService = {
  async getAllTasks() {
    return prisma.task.findMany({
      include: { slope: true, vehicle: true, report: true },
      orderBy: { scheduledStartTime: 'asc' }
    });
  },

  async getTaskById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { slope: true, vehicle: true, report: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    return task;
  },

  async createTask(data: CreateTaskDto) {
    const slope = await prisma.slope.findUnique({
      where: { id: data.slopeId }
    });
    
    if (!slope) {
      throw new AppError('雪道不存在', 404);
    }
    
    const startTime = new Date(data.scheduledStartTime);
    const endTime = new Date(data.scheduledEndTime);
    
    if (startTime >= endTime) {
      throw new AppError('计划开始时间必须早于计划结束时间', 400);
    }
    
    const timeConflict = await this.checkTimeConflict(data.slopeId, startTime, endTime);
    if (timeConflict) {
      throw new AppError('该雪道在相同时间段已有其他任务', 400);
    }
    
    const isDuringOpenWindow = this.isDuringOpenWindow(
      startTime,
      slope.openWindowStart,
      slope.openWindowEnd
    );
    
    if (isDuringOpenWindow) {
      throw new AppError('压雪任务不能安排在雪道开放时间内，必须安排在夜间作业窗口', 400);
    }
    
    return prisma.task.create({
      data: {
        slopeId: data.slopeId,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        notes: data.notes,
        status: 'PENDING_ASSIGNMENT',
        snowThicknessBefore: slope.currentSnowThickness
      },
      include: { slope: true }
    });
  },

  async assignTask(taskId: string, vehicleId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { slope: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    if (task.status !== 'PENDING_ASSIGNMENT') {
      throw new AppError('只能分配处于待分配状态的任务', 400);
    }
    
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });
    
    if (!vehicle) {
      throw new AppError('车辆不存在', 404);
    }
    
    if (vehicle.status === 'BROKEN') {
      throw new AppError('车辆已故障，无法分配任务', 400);
    }
    
    if (vehicle.status === 'MAINTENANCE') {
      throw new AppError('车辆正在维修中，无法分配任务', 400);
    }
    
    if (vehicle.assignedTaskId) {
      throw new AppError('车辆已有分配的任务，无法分配新任务', 400);
    }
    
    const estimatedHours = this.calculateEstimatedHours(
      task.slope.area,
      vehicle.capacityPerHour
    );
    
    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          vehicleId: vehicleId,
          status: 'PENDING_EXECUTION'
        },
        include: { slope: true, vehicle: true }
      });
      
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { assignedTaskId: taskId, status: 'WORKING' }
      });
      
      return {
        ...updatedTask,
        estimatedHours
      };
    });
  },

  async confirmTask(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    if (task.status !== 'PENDING_EXECUTION') {
      throw new AppError('只能确认处于待执行状态的任务', 400);
    }
    
    return prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        actualStartTime: new Date()
      },
      include: { slope: true, vehicle: true }
    });
  },

  async rejectTask(taskId: string, reason: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { vehicle: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    if (task.status !== 'PENDING_EXECUTION') {
      throw new AppError('只能拒绝处于待执行状态的任务', 400);
    }
    
    if (!reason || reason.trim().length === 0) {
      throw new AppError('拒绝原因不能为空', 400);
    }
    
    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'REJECTED',
          reason: reason,
          isReassigned: true,
          originalVehicleId: task.vehicleId
        },
        include: { slope: true, vehicle: true }
      });
      
      if (task.vehicleId) {
        await tx.vehicle.update({
          where: { id: task.vehicleId },
          data: { assignedTaskId: null, status: 'AVAILABLE' }
        });
      }
      
      return updatedTask;
    });
  },

  async completeTask(taskId: string, snowThicknessAfter: number, qualityScore: number) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { slope: true, vehicle: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    if (task.status !== 'IN_PROGRESS') {
      throw new AppError('只能完成处于执行中状态的任务', 400);
    }
    
    if (qualityScore < 1 || qualityScore > 10) {
      throw new AppError('质量评分必须在1-10之间', 400);
    }
    
    if (snowThicknessAfter < 0) {
      throw new AppError('作业后积雪厚度不能为负数', 400);
    }
    
    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          actualEndTime: new Date(),
          snowThicknessAfter,
          qualityScore
        },
        include: { slope: true, vehicle: true }
      });
      
      await tx.slope.update({
        where: { id: task.slopeId },
        data: { currentSnowThickness: snowThicknessAfter }
      });
      
      if (task.vehicleId) {
        await tx.vehicle.update({
          where: { id: task.vehicleId },
          data: { assignedTaskId: null, status: 'AVAILABLE' }
        });
      }
      
      return updatedTask;
    });
  },

  async cancelTask(taskId: string, reason: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { vehicle: true }
    });
    
    if (!task) {
      throw new AppError('任务不存在', 404);
    }
    
    const validStatuses: string[] = ['PENDING_ASSIGNMENT', 'PENDING_EXECUTION', 'IN_PROGRESS'];
    if (!validStatuses.includes(task.status)) {
      throw new AppError('只能取消未完成的任务', 400);
    }
    
    if (!reason || reason.trim().length === 0) {
      throw new AppError('取消原因不能为空', 400);
    }
    
    return prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'CANCELLED',
          reason: reason
        },
        include: { slope: true, vehicle: true }
      });
      
      if (task.vehicleId) {
        await tx.vehicle.update({
          where: { id: task.vehicleId },
          data: { assignedTaskId: null, status: 'AVAILABLE' }
        });
      }
      
      return updatedTask;
    });
  },

  async autoSchedule() {
    const slopesNeedingGrooming = await prisma.slope.findMany({
      where: {
        status: 'OPEN',
        currentSnowThickness: {
          lt: prisma.slope.fields.minSnowThickness
        }
      },
      orderBy: { priority: 'asc' }
    });
    
    const availableVehicles = await prisma.vehicle.findMany({
      where: {
        status: 'AVAILABLE'
      }
    });
    
    const results = [];
    
    for (const slope of slopesNeedingGrooming) {
      const availableVehicle = availableVehicles.find(v => !v.assignedTaskId);
      
      if (!availableVehicle) {
        results.push({
          slopeId: slope.id,
          slopeName: slope.name,
          success: false,
          message: '没有可用的压雪车'
        });
        continue;
      }
      
      const tonightStart = new Date();
      tonightStart.setHours(22, 0, 0, 0);
      if (tonightStart <= new Date()) {
        tonightStart.setDate(tonightStart.getDate() + 1);
      }
      
      const estimatedHours = this.calculateEstimatedHours(slope.area, availableVehicle.capacityPerHour);
      const tonightEnd = new Date(tonightStart.getTime() + estimatedHours * 60 * 60 * 1000);
      
      try {
        const task = await prisma.task.create({
          data: {
            slopeId: slope.id,
            scheduledStartTime: tonightStart,
            scheduledEndTime: tonightEnd,
            status: 'PENDING_EXECUTION',
            vehicleId: availableVehicle.id,
            snowThicknessBefore: slope.currentSnowThickness,
            notes: '系统自动排程'
          },
          include: { slope: true, vehicle: true }
        });
        
        await prisma.vehicle.update({
          where: { id: availableVehicle.id },
          data: { assignedTaskId: task.id, status: 'WORKING' }
        });
        
        results.push({
          slopeId: slope.id,
          slopeName: slope.name,
          taskId: task.id,
          vehicleId: availableVehicle.id,
          vehicleName: availableVehicle.name,
          success: true,
          message: '自动排程成功',
          estimatedHours
        });
      } catch (error) {
        results.push({
          slopeId: slope.id,
          slopeName: slope.name,
          success: false,
          message: error instanceof Error ? error.message : '排程失败'
        });
      }
    }
    
    return results;
  },

  async exportTasks(format: 'json' | 'excel', startDate?: string, endDate?: string) {
    const where: any = {};
    
    if (startDate || endDate) {
      where.scheduledStartTime = {};
      if (startDate) where.scheduledStartTime.gte = new Date(startDate);
      if (endDate) where.scheduledStartTime.lte = new Date(endDate);
    }
    
    const tasks = await prisma.task.findMany({
      where,
      include: { slope: true, vehicle: true, report: true },
      orderBy: { scheduledStartTime: 'asc' }
    });
    
    if (format === 'json') {
      return tasks;
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('压雪任务报表');
    
    worksheet.columns = [
      { header: '任务ID', key: 'id', width: 36 },
      { header: '雪道名称', key: 'slopeName', width: 20 },
      { header: '车辆名称', key: 'vehicleName', width: 20 },
      { header: '计划开始时间', key: 'scheduledStartTime', width: 20 },
      { header: '计划结束时间', key: 'scheduledEndTime', width: 20 },
      { header: '实际开始时间', key: 'actualStartTime', width: 20 },
      { header: '实际结束时间', key: 'actualEndTime', width: 20 },
      { header: '状态', key: 'status', width: 15 },
      { header: '作业前厚度', key: 'snowThicknessBefore', width: 12 },
      { header: '作业后厚度', key: 'snowThicknessAfter', width: 12 },
      { header: '质量评分', key: 'qualityScore', width: 10 },
      { header: '是否改派', key: 'isReassigned', width: 10 }
    ];
    
    tasks.forEach(task => {
      worksheet.addRow({
        id: task.id,
        slopeName: task.slope?.name,
        vehicleName: task.vehicle?.name || '未分配',
        scheduledStartTime: task.scheduledStartTime.toISOString(),
        scheduledEndTime: task.scheduledEndTime.toISOString(),
        actualStartTime: task.actualStartTime?.toISOString() || '',
        actualEndTime: task.actualEndTime?.toISOString() || '',
        status: this.getTaskStatusText(task.status),
        snowThicknessBefore: task.snowThicknessBefore || '',
        snowThicknessAfter: task.snowThicknessAfter || '',
        qualityScore: task.qualityScore || '',
        isReassigned: task.isReassigned ? '是' : '否'
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  async checkTimeConflict(slopeId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const existingTasks = await prisma.task.findMany({
      where: {
        slopeId,
        status: {
          in: ['PENDING_ASSIGNMENT', 'PENDING_EXECUTION', 'IN_PROGRESS']
        },
        OR: [
          {
            scheduledStartTime: { lt: endTime },
            scheduledEndTime: { gt: startTime }
          }
        ]
      }
    });
    
    return existingTasks.length > 0;
  },

  isDuringOpenWindow(taskTime: Date, openStart: string, openEnd: string): boolean {
    const taskHour = taskTime.getHours();
    const [startHour, startMin] = openStart.split(':').map(Number);
    const [endHour, endMin] = openEnd.split(':').map(Number);
    
    const openStartTime = startHour * 60 + startMin;
    const openEndTime = endHour * 60 + endMin;
    const taskTimeMinutes = taskHour * 60 + taskTime.getMinutes();
    
    if (openStartTime < openEndTime) {
      return taskTimeMinutes >= openStartTime && taskTimeMinutes <= openEndTime;
    } else {
      return taskTimeMinutes >= openStartTime || taskTimeMinutes <= openEndTime;
    }
  },

  calculateEstimatedHours(slopeArea: number, vehicleCapacity: number): number {
    return Math.ceil(slopeArea / vehicleCapacity);
  },

  getTaskStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING_ASSIGNMENT: '待分配',
      PENDING_EXECUTION: '待执行',
      IN_PROGRESS: '执行中',
      COMPLETED: '已完成',
      REJECTED: '已拒绝',
      CANCELLED: '已取消'
    };
    return statusMap[status] || status;
  }
};
