import prisma from '../lib/prisma';

export const tenantService = {
  async create(name: string, description?: string) {
    return prisma.tenant.create({
      data: { name, description },
    });
  },

  async list() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.tenant.delete({
      where: { id },
    });
  },
};
