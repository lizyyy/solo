import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { ConfigStatus } from '../types';

export interface CreateConfigItemDTO {
  key: string;
  value: string;
  description?: string;
  createdBy?: string;
}

export interface UpdateConfigItemDTO {
  value?: string;
  description?: string;
  status?: ConfigStatus;
}

export class ConfigItemService {
  async create(dto: CreateConfigItemDTO) {
    const existing = await prisma.configItem.findFirst({
      where: { key: dto.key },
      orderBy: { version: 'desc' },
    });

    const newVersion = existing ? existing.version + 1 : 1;

    return prisma.configItem.create({
      data: {
        ...dto,
        version: newVersion,
        status: ConfigStatus.DRAFT,
      },
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: ConfigStatus;
    key?: string;
  }) {
    const { page = 1, pageSize = 20, status, key } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (key) where.key = { contains: key };

    const [items, total] = await Promise.all([
      prisma.configItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        include: {
          _count: {
            select: { pullRecords: true, versions: true },
          },
        },
      }),
      prisma.configItem.count({ where }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findById(id: string) {
    const config = await prisma.configItem.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { releasedAt: 'desc' } },
        pullRecords: { take: 50, orderBy: { pulledAt: 'desc' } },
        diffReports: { orderBy: { generatedAt: 'desc' } },
      },
    });

    if (!config) {
      throw new AppError('配置项不存在', 404);
    }

    return config;
  }

  async update(id: string, dto: UpdateConfigItemDTO) {
    const config = await this.findById(id);

    if (dto.value && dto.value !== config.value) {
      return prisma.configItem.create({
        data: {
          key: config.key,
          value: dto.value,
          description: dto.description || config.description,
          version: config.version + 1,
          status: ConfigStatus.DRAFT,
          createdBy: config.createdBy,
        },
      });
    }

    return prisma.configItem.update({
      where: { id },
      data: {
        description: dto.description,
        status: dto.status,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return prisma.configItem.delete({ where: { id } });
  }

  async getVersions(configId: string) {
    return prisma.distributionVersion.findMany({
      where: { configId },
      orderBy: { version: 'desc' },
    });
  }
}

export default new ConfigItemService();
