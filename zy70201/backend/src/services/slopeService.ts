import prisma from '../utils/prisma';
import { SlopeDifficulty, SlopeStatus } from '../utils/constants';
import { AppError } from '../utils/errorHandler';

export interface CreateSlopeDto {
  name: string;
  difficulty: SlopeDifficulty;
  length: number;
  area: number;
  openWindowStart: string;
  openWindowEnd: string;
  minSnowThickness: number;
  targetSnowThickness: number;
  currentSnowThickness: number;
  status?: SlopeStatus;
  priority: number;
}

export interface UpdateSlopeDto {
  name?: string;
  difficulty?: SlopeDifficulty;
  length?: number;
  area?: number;
  openWindowStart?: string;
  openWindowEnd?: string;
  minSnowThickness?: number;
  targetSnowThickness?: number;
  currentSnowThickness?: number;
  status?: SlopeStatus;
  priority?: number;
}

export const slopeService = {
  async getAllSlopes() {
    return prisma.slope.findMany({
      orderBy: { priority: 'asc' }
    });
  },

  async getSlopeById(id: string) {
    const slope = await prisma.slope.findUnique({
      where: { id },
      include: { tasks: true }
    });
    
    if (!slope) {
      throw new AppError('雪道不存在', 404);
    }
    
    return slope;
  },

  async createSlope(data: CreateSlopeDto) {
    if (data.minSnowThickness > data.targetSnowThickness) {
      throw new AppError('最小积雪厚度不能大于目标积雪厚度', 400);
    }
    
    if (data.currentSnowThickness < 0) {
      throw new AppError('当前积雪厚度不能为负数', 400);
    }
    
    return prisma.slope.create({
      data
    });
  },

  async updateSlope(id: string, data: UpdateSlopeDto) {
    const slope = await prisma.slope.findUnique({ where: { id } });
    
    if (!slope) {
      throw new AppError('雪道不存在', 404);
    }
    
    if (data.minSnowThickness && data.targetSnowThickness && 
        data.minSnowThickness > data.targetSnowThickness) {
      throw new AppError('最小积雪厚度不能大于目标积雪厚度', 400);
    }
    
    if (data.currentSnowThickness !== undefined && data.currentSnowThickness < 0) {
      throw new AppError('当前积雪厚度不能为负数', 400);
    }
    
    return prisma.slope.update({
      where: { id },
      data
    });
  },

  async deleteSlope(id: string) {
    const slope = await prisma.slope.findUnique({
      where: { id },
      include: { 
        tasks: {
          where: {
            status: { in: ['PENDING_ASSIGNMENT', 'PENDING_EXECUTION', 'IN_PROGRESS'] }
          }
        }
      }
    });
    
    if (!slope) {
      throw new AppError('雪道不存在', 404);
    }
    
    if (slope.tasks.length > 0) {
      throw new AppError('该雪道有未完成的任务，无法删除', 400);
    }
    
    return prisma.slope.delete({ where: { id } });
  },

  async getSlopesNeedingGrooming() {
    const slopes = await prisma.slope.findMany({
      where: {
        status: 'OPEN',
        currentSnowThickness: {
          lt: prisma.slope.fields.minSnowThickness
        }
      },
      orderBy: { priority: 'asc' }
    });
    
    return slopes;
  }
};
