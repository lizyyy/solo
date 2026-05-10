import prisma from '../lib/prisma';

export const serviceService = {
  async create(tenantId: string, name: string, description?: string) {
    return prisma.service.create({
      data: { tenantId, name, description },
    });
  },

  async list(tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { endpoints: true, sloConfigs: true },
        },
      },
    });
  },

  async getById(id: string) {
    return prisma.service.findUnique({
      where: { id },
      include: {
        endpoints: true,
        sloConfigs: true,
      },
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return prisma.service.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.service.delete({
      where: { id },
    });
  },
};

export const endpointService = {
  async create(serviceId: string, method: string, path: string, description?: string) {
    return prisma.aPIEndpoint.create({
      data: { serviceId, method: method.toUpperCase(), path, description },
    });
  },

  async list(serviceId: string) {
    return prisma.aPIEndpoint.findMany({
      where: { serviceId },
      orderBy: [{ method: 'asc' }, { path: 'asc' }],
    });
  },

  async getById(id: string) {
    return prisma.aPIEndpoint.findUnique({
      where: { id },
    });
  },

  async update(id: string, data: { method?: string; path?: string; description?: string }) {
    if (data.method) {
      data.method = data.method.toUpperCase();
    }
    return prisma.aPIEndpoint.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.aPIEndpoint.delete({
      where: { id },
    });
  },
};
