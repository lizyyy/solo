import prisma from '../utils/prisma';
import { VehicleStatus } from '../utils/constants';
import { AppError } from '../utils/errorHandler';

export interface CreateVehicleDto {
  name: string;
  model: string;
  status?: VehicleStatus;
  capacityPerHour: number;
  currentLocation: string;
}

export interface UpdateVehicleDto {
  name?: string;
  model?: string;
  status?: VehicleStatus;
  capacityPerHour?: number;
  currentLocation?: string;
  lastMaintenance?: Date;
}

export const vehicleService = {
  async getAllVehicles() {
    return prisma.vehicle.findMany({
      include: { tasks: true }
    });
  },

  async getVehicleById(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { tasks: true }
    });
    
    if (!vehicle) {
      throw new AppError('车辆不存在', 404);
    }
    
    return vehicle;
  },

  async createVehicle(data: CreateVehicleDto) {
    if (data.capacityPerHour <= 0) {
      throw new AppError('每小时作业能力必须大于0', 400);
    }
    
    return prisma.vehicle.create({
      data: {
        ...data,
        status: data.status || 'AVAILABLE'
      }
    });
  },

  async updateVehicle(id: string, data: UpdateVehicleDto) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    
    if (!vehicle) {
      throw new AppError('车辆不存在', 404);
    }
    
    if (data.capacityPerHour !== undefined && data.capacityPerHour <= 0) {
      throw new AppError('每小时作业能力必须大于0', 400);
    }
    
    if (data.status === 'BROKEN' && vehicle.assignedTaskId) {
      await this.handleVehicleBreakdown(id);
    }
    
    return prisma.vehicle.update({
      where: { id },
      data
    });
  },

  async deleteVehicle(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        tasks: {
          where: {
            status: { in: ['PENDING_EXECUTION', 'IN_PROGRESS'] }
          }
        }
      }
    });
    
    if (!vehicle) {
      throw new AppError('车辆不存在', 404);
    }
    
    if (vehicle.tasks.length > 0) {
      throw new AppError('该车辆有未完成的任务，无法删除', 400);
    }
    
    return prisma.vehicle.delete({ where: { id } });
  },

  async getAvailableVehicles() {
    return prisma.vehicle.findMany({
      where: {
        status: 'AVAILABLE'
      }
    });
  },

  async handleVehicleBreakdown(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { tasks: true }
    });
    
    if (!vehicle) {
      throw new AppError('车辆不存在', 404);
    }
    
    const pendingTask = vehicle.tasks.find(
      t => t.status === 'PENDING_EXECUTION' || t.status === 'IN_PROGRESS'
    );
    
    if (pendingTask) {
      await prisma.task.update({
        where: { id: pendingTask.id },
        data: {
          status: 'PENDING_ASSIGNMENT',
          isReassigned: true,
          originalVehicleId: vehicleId,
          vehicleId: null
        }
      });
      
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { assignedTaskId: null }
      });
      
      return { success: true, message: '任务已重新分配到待分配队列', taskId: pendingTask.id };
    }
    
    return { success: true, message: '该车辆没有待执行的任务' };
  }
};
