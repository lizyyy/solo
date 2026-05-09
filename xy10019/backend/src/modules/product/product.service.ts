import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Product, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuditOperation, AuditEntity } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(data: Prisma.ProductCreateInput, userId?: string): Promise<Product> {
    const existing = await this.prismaService.product.findUnique({
      where: { sku: data.sku },
    });

    if (existing) {
      throw new ConflictException('商品 SKU 已存在');
    }

    if (data.barcode) {
      const barcodeExists = await this.prismaService.product.findUnique({
        where: { barcode: data.barcode },
      });
      if (barcodeExists) {
        throw new ConflictException('商品条码已存在');
      }
    }

    const product = await this.prismaService.product.create({ data });

    await this.auditService.log({
      operation: AuditOperation.CREATE,
      entity: AuditEntity.PRODUCT,
      entityId: product.id,
      entityName: product.name,
      afterSnapshot: product,
      userId,
      remark: `创建商品: ${product.name} (${product.sku})`,
    });

    return product;
  }

  async findAll(
    filters: {
      keyword?: string;
      category?: string;
      isActive?: boolean;
    } = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ products: Product[]; total: number }> {
    const where: Prisma.ProductWhereInput = {};

    if (filters.keyword) {
      where.OR = [
        { sku: { contains: filters.keyword } },
        { name: { contains: filters.keyword } },
        { barcode: { contains: filters.keyword } },
      ];
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [products, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.product.count({ where }),
    ]);

    return { products, total };
  }

  async findById(id: string): Promise<Product | null> {
    return this.prismaService.product.findUnique({
      where: { id },
    });
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.prismaService.product.findUnique({
      where: { sku },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput,
    userId?: string,
  ): Promise<Product> {
    const existing = await this.prismaService.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('商品不存在');
    }

    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await this.prismaService.product.findUnique({
        where: { sku: data.sku as string },
      });
      if (skuExists) {
        throw new ConflictException('商品 SKU 已存在');
      }
    }

    if (data.barcode && data.barcode !== existing.barcode) {
      const barcodeExists = await this.prismaService.product.findUnique({
        where: { barcode: data.barcode as string },
      });
      if (barcodeExists) {
        throw new ConflictException('商品条码已存在');
      }
    }

    const updated = await this.prismaService.product.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      operation: AuditOperation.UPDATE,
      entity: AuditEntity.PRODUCT,
      entityId: updated.id,
      entityName: updated.name,
      beforeSnapshot: existing,
      afterSnapshot: updated,
      userId,
      remark: `更新商品: ${updated.name}`,
    });

    return updated;
  }

  async toggleActive(id: string, userId?: string): Promise<Product> {
    const existing = await this.prismaService.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('商品不存在');
    }

    const updated = await this.prismaService.product.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await this.auditService.log({
      operation: AuditOperation.UPDATE,
      entity: AuditEntity.PRODUCT,
      entityId: updated.id,
      entityName: updated.name,
      beforeSnapshot: existing,
      afterSnapshot: updated,
      userId,
      remark: updated.isActive ? `启用商品: ${updated.name}` : `禁用商品: ${updated.name}`,
    });

    return updated;
  }

  async delete(id: string, userId?: string): Promise<void> {
    const existing = await this.prismaService.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('商品不存在');
    }

    const inventories = await this.prismaService.inventory.count({
      where: { productId: id },
    });

    if (inventories > 0) {
      throw new BadRequestException('该商品在门店中还有库存，无法删除');
    }

    await this.prismaService.product.delete({ where: { id } });

    await this.auditService.log({
      operation: AuditOperation.DELETE,
      entity: AuditEntity.PRODUCT,
      entityId: id,
      entityName: existing.name,
      beforeSnapshot: existing,
      userId,
      remark: `删除商品: ${existing.name}`,
    });
  }

  async getCategories(): Promise<string[]> {
    const products = await this.prismaService.product.findMany({
      where: { category: { not: null } },
      distinct: ['category'],
      select: { category: true },
    });

    return products.map((p) => p.category).filter((c): c is string => c !== null);
  }
}
