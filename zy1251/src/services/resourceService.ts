import prisma from '../lib/prisma';

export class ResourceService {
  async createResource(data: {
    tenantId: string;
    name: string;
    code: string;
    type?: string;
    path?: string;
    method?: string;
    description?: string;
    parentId?: string;
  }) {
    const existingResource = await prisma.resource.findUnique({
      where: {
        tenantId_code: {
          tenantId: data.tenantId,
          code: data.code,
        },
      },
    });

    if (existingResource) {
      throw new Error('资源代码已存在');
    }

    if (data.parentId) {
      const parent = await prisma.resource.findUnique({
        where: { id: data.parentId },
      });
      if (!parent || parent.tenantId !== data.tenantId) {
        throw new Error('父资源不存在');
      }
    }

    return prisma.resource.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        code: data.code,
        type: data.type || 'api',
        path: data.path,
        method: data.method,
        description: data.description,
        parentId: data.parentId,
      },
      include: {
        parent: true,
        children: true,
        permissions: true,
      },
    });
  }

  async updateResource(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      path?: string;
      method?: string;
      description?: string;
      parentId?: string;
    }
  ) {
    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource || resource.tenantId !== tenantId) {
      throw new Error('资源不存在');
    }

    if (data.parentId && data.parentId === id) {
      throw new Error('不能将资源设为自己的父资源');
    }

    return prisma.resource.update({
      where: { id },
      data,
      include: {
        parent: true,
        children: true,
        permissions: true,
      },
    });
  }

  async deleteResource(id: string, tenantId: string) {
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        children: true,
        permissions: true,
      },
    });

    if (!resource || resource.tenantId !== tenantId) {
      throw new Error('资源不存在');
    }

    if (resource.children.length > 0) {
      throw new Error('请先删除子资源');
    }

    if (resource.permissions.length > 0) {
      throw new Error('请先删除关联的权限');
    }

    await prisma.resource.delete({
      where: { id },
    });
  }

  async listResources(tenantId: string, options?: { type?: string; includeChildren?: boolean; page?: number; pageSize?: number }) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 100;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { tenantId };
    if (options?.type) {
      where.type = options.type;
    }

    const [resources, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
        include: {
          parent: true,
          children: options?.includeChildren
            ? {
                include: {
                  children: {
                    include: {
                      children: true,
                    },
                  },
                },
              }
            : false,
          permissions: true,
          _count: {
            select: { permissions: true },
          },
        },
      }),
      prisma.resource.count({ where }),
    ]);

    return {
      resources: resources.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        type: r.type,
        path: r.path,
        method: r.method,
        description: r.description,
        parentId: r.parentId,
        parent: r.parent
          ? {
              id: r.parent.id,
              name: r.parent.name,
              code: r.parent.code,
            }
          : null,
        children: r.children,
        permissionCount: r._count.permissions,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

export const resourceService = new ResourceService();
