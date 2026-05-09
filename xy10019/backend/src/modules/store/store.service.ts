import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Store, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuditOperation, AuditEntity } from '@prisma/client';

@Injectable()
export class StoreService {
  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(data: Prisma.StoreCreateInput, userId?: string): Promise<Store> {
    const existing = await this.prismaService.store.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException('门店编码已存在');
    }

    const store = await this.prismaService.store.create({ data });

    await this.auditService.log({
      operation: AuditOperation.CREATE,
      entity: AuditEntity.STORE,
      entityId: store.id,
      entityName: store.name,
      afterSnapshot: store,
      userId,
      remark: `创建门店: ${store.name} (${store.code})`,
    });

    return store;
  }

  async findAll(
    filters: {
      keyword?: string;
      isActive?: boolean;
    } = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ stores: Store[]; total: number }> {
    const where: Prisma.StoreWhereInput = {};

    if (filters.keyword) {
      where.OR = [
        { code: { contains: filters.keyword } },
        { name: { contains: filters.keyword } },
        { manager: { contains: filters.keyword } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [stores, total] = await Promise.all([
      this.prismaService.store.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.store.count({ where }),
    ]);

    return { stores, total };
  }

  async findById(id: string): Promise<Store | null> {
    return this.prismaService.store.findUnique({
      where: { id },
      include: {
        users: {
          where: { isActive: true },
          select: { id: true, name: true, username: true, role: true },
        },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.StoreUpdateInput,
    userId?: string,
  ): Promise<Store> {
    const existing = await this.prismaService.store.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('门店不存在');
    }

    if (data.code && data.code !== existing.code) {
      const codeExists = await this.prismaService.store.findUnique({
        where: { code: data.code as string },
      });
      if (codeExists) {
        throw new ConflictException('门店编码已存在');
      }
    }

    const updated = await this.prismaService.store.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      operation: AuditOperation.UPDATE,
      entity: AuditEntity.STORE,
      entityId: updated.id,
      entityName: updated.name,
      beforeSnapshot: existing,
      afterSnapshot: updated,
      userId,
      remark: `更新门店: ${updated.name}`,
    });

    return updated;
  }

  async toggleActive(id: string, userId?: string): Promise<Store> {
    const existing = await this.prismaService.store.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('门店不存在');
    }

    const updated = await this.prismaService.store.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await this.auditService.log({
      operation: AuditOperation.UPDATE,
      entity: AuditEntity.STORE,
      entityId: updated.id,
      entityName: updated.name,
      beforeSnapshot: existing,
      afterSnapshot: updated,
      userId,
      remark: updated.isActive ? `启用门店: ${updated.name}` : `禁用门店: ${updated.name}`,
    });

    return updated;
  }

  async delete(id: string, userId?: string): Promise<void> {
    const existing = await this.prismaService.store.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('门店不存在');
    }

    const inventories = await this.prismaService.inventory.count({
      where: { storeId: id },
    });

    if (inventories > 0) {
      throw new BadRequestException('该门店下还有库存，无法删除');
    }

    const users = await this.prismaService.user.count({
      where: { storeId: id },
    });

    if (users > 0) {
      throw new BadRequestException('该门店下还有用户，无法删除');
    }

    await this.prismaService.store.delete({ where: { id } });

    await this.auditService.log({
      operation: AuditOperation.DELETE,
      entity: AuditEntity.STORE,
      entityId: id,
      entityName: existing.name,
      beforeSnapshot: existing,
      userId,
      remark: `删除门店: ${existing.name}`,
    });
  }
}
