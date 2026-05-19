import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { InstanceStatus } from '../types';

export interface CreateServiceInstanceDTO {
  instanceId: string;
  serviceName: string;
  ipAddress: string;
  hostname?: string;
  env: string;
}

export class ServiceInstanceService {
  async create(dto: CreateServiceInstanceDTO) {
    const existing = await prisma.serviceInstance.findUnique({
      where: {
        instanceId_env: {
          instanceId: dto.instanceId,
          env: dto.env,
        },
      },
    });

    if (existing) {
      throw new AppError('该环境下已存在相同实例ID', 400);
    }

    return prisma.serviceInstance.create({
      data: dto,
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    serviceName?: string;
    env?: string;
    status?: InstanceStatus;
  }) {
    const { page = 1, pageSize = 20, serviceName, env, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (serviceName) where.serviceName = { contains: serviceName };
    if (env) where.env = env;
    if (status) where.status = status;

    const [instances, total] = await Promise.all([
      prisma.serviceInstance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { serviceName: 'asc' },
        include: {
          _count: {
            select: { pullRecords: true, effectiveStates: true },
          },
        },
      }),
      prisma.serviceInstance.count({ where }),
    ]);

    return {
      instances,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findById(id: string) {
    const instance = await prisma.serviceInstance.findUnique({
      where: { id },
      include: {
        pullRecords: { take: 50, orderBy: { pulledAt: 'desc' } },
        effectiveStates: true,
      },
    });

    if (!instance) {
      throw new AppError('服务实例不存在', 404);
    }

    return instance;
  }

  async heartbeat(instanceId: string, env: string) {
    const instance = await prisma.serviceInstance.findUnique({
      where: {
        instanceId_env: { instanceId, env },
      },
    });

    if (!instance) {
      throw new AppError('服务实例不存在', 404);
    }

    return prisma.serviceInstance.update({
      where: { id: instance.id },
      data: {
        lastHeartbeat: new Date(),
        status: InstanceStatus.ONLINE,
      },
    });
  }

  async updateStatus(id: string, status: InstanceStatus) {
    await this.findById(id);
    return prisma.serviceInstance.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return prisma.serviceInstance.delete({ where: { id } });
  }
}

export default new ServiceInstanceService();
