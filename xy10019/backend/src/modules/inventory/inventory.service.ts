import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DistributedLockService } from '../../infrastructure/redis/distributed-lock.service';
import { IdempotentService } from '../../infrastructure/redis/idempotent.service';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { AuditService } from '../audit/audit.service';
import {
  Inventory,
  InventoryRecord,
  TransferOrder,
  AuditOperation,
  AuditEntity,
  TransferStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface InventoryOperationData {
  storeId: string;
  productId: string;
  quantity: number;
  price?: number;
  remark?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface PriceChangeData {
  storeId: string;
  productId: string;
  newPrice: number;
  reason: string;
  remark?: string;
}

export interface TransferItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface CreateTransferData {
  sourceStoreId: string;
  targetStoreId: string;
  items: TransferItem[];
  remark?: string;
}

const CACHE_PREFIX = 'inventory:';
const CACHE_TTL = 300;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prismaService: PrismaService,
    private lockService: DistributedLockService,
    private idempotentService: IdempotentService,
    private cacheService: CacheService,
    private auditService: AuditService,
  ) {}

  async findOrCreate(
    storeId: string,
    productId: string,
  ): Promise<Inventory> {
    let inventory = await this.prismaService.inventory.findUnique({
      where: { storeId_productId: { storeId, productId } },
    });

    if (!inventory) {
      const product = await this.prismaService.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException('商品不存在');
      }

      inventory = await this.prismaService.inventory.create({
        data: {
          storeId,
          productId,
          quantity: 0,
          availableQty: 0,
          lockedQty: 0,
          price: product.basePrice,
          version: 0,
        },
      });
    }

    return inventory;
  }

  async findAll(
    filters: {
      storeId?: string;
      productId?: string;
      keyword?: string;
      lowStock?: boolean;
    } = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ inventories: (Inventory & { product: any; store: any })[]; total: number }> {
    const cacheKey = this.cacheService.generateKey(
      'inventory:list',
      filters.storeId,
      filters.productId,
      filters.keyword,
      filters.lowStock,
      limit,
      offset,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const where: any = {};

        if (filters.storeId) {
          where.storeId = filters.storeId;
        }

        if (filters.productId) {
          where.productId = filters.productId;
        }

        if (filters.lowStock) {
          where.availableQty = { lte: 10 };
        }

        if (filters.keyword) {
          where.OR = [
            {
              product: {
                OR: [
                  { sku: { contains: filters.keyword } },
                  { name: { contains: filters.keyword } },
                  { barcode: { contains: filters.keyword } },
                ],
              },
            },
            {
              store: {
                OR: [
                  { code: { contains: filters.keyword } },
                  { name: { contains: filters.keyword } },
                ],
              },
            },
          ];
        }

        const [inventories, total] = await Promise.all([
          this.prismaService.inventory.findMany({
            where,
            include: {
              product: true,
              store: true,
            },
            orderBy: { lastUpdated: 'desc' },
            skip: offset,
            take: limit,
          }),
          this.prismaService.inventory.count({ where }),
        ]);

        return { inventories, total };
      },
      { ttl: CACHE_TTL },
    );
  }

  async findByStoreAndProduct(
    storeId: string,
    productId: string,
  ): Promise<(Inventory & { product: any; store: any }) | null> {
    const cacheKey = this.cacheService.generateKey(
      'inventory',
      storeId,
      productId,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prismaService.inventory.findUnique({
          where: { storeId_productId: { storeId, productId } },
          include: { product: true, store: true },
        });
      },
      { ttl: CACHE_TTL },
    );
  }

  async adjust(
    data: InventoryOperationData,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<{ inventory: Inventory; record: InventoryRecord }> {
    const idempotentKey = this.idempotentService.generateKey(
      'inventory:adjust',
      data.storeId,
      data.productId,
      data.quantity,
      requestId,
    );

    const { isDuplicate, response } = await this.idempotentService.checkAndSet(
      requestId || 'auto',
      idempotentKey,
    );

    if (isDuplicate) {
      if (response) {
        return response as any;
      }
      throw new ConflictException('请求正在处理中或已完成，请勿重复提交');
    }

    const lockKey = `inventory:${data.storeId}:${data.productId}`;

    try {
      const result = await this.lockService.executeWithLock(
        lockKey,
        async () => {
          return this.prismaService.$transaction(async (prisma) => {
            const inventory = await this.findOrCreate(
              data.storeId,
              data.productId,
            );

            const quantityBefore = inventory.quantity;
            const availableQtyBefore = inventory.availableQty;
            const priceBefore = inventory.price;

            const newQuantity = quantityBefore + data.quantity;
            const newAvailableQty = availableQtyBefore + data.quantity;

            if (newQuantity < 0 || newAvailableQty < 0) {
              throw new BadRequestException('库存数量不能为负数');
            }

            let newPrice = priceBefore;
            if (data.price !== undefined) {
              newPrice = new Decimal(data.price);
            }

            const updatedInventory = await prisma.inventory.update({
              where: {
                storeId_productId: {
                  storeId: data.storeId,
                  productId: data.productId,
                },
                version: inventory.version,
              },
              data: {
                quantity: newQuantity,
                availableQty: newAvailableQty,
                price: newPrice,
                version: { increment: 1 },
                lastUpdated: new Date(),
              },
            });

            if (!updatedInventory) {
              throw new ConflictException('数据已被其他用户修改，请刷新后重试');
            }

            const record = await prisma.inventoryRecord.create({
              data: {
                inventoryId: inventory.id,
                storeId: data.storeId,
                productId: data.productId,
                operationType: data.quantity > 0 ? 'IN' : 'OUT',
                quantityBefore,
                quantityAfter: newQuantity,
                changeQuantity: data.quantity,
                priceBefore,
                priceAfter: newPrice,
                referenceId: data.referenceId,
                referenceType: data.referenceType || 'ADJUST',
                operatorId,
                operatorName,
                remark: data.remark,
              },
            });

            await this.auditService.log({
              requestId,
              operation: AuditOperation.ADJUST,
              entity: AuditEntity.INVENTORY,
              entityId: inventory.id,
              beforeSnapshot: {
                quantity: quantityBefore,
                availableQty: availableQtyBefore,
                price: priceBefore,
                version: inventory.version,
              },
              afterSnapshot: {
                quantity: newQuantity,
                availableQty: newAvailableQty,
                price: newPrice,
                version: updatedInventory.version,
              },
              userId: operatorId,
              operatorName,
              remark: data.remark || `调整库存: ${data.quantity > 0 ? '+' : ''}${data.quantity}`,
            });

            return { inventory: updatedInventory, record };
          });
        },
        { ttl: 30000, retryCount: 3 },
      );

      await this.idempotentService.complete(idempotentKey, result);
      await this.invalidateInventoryCache(data.storeId, data.productId);
      return result;
    } catch (error) {
      await this.idempotentService.fail(idempotentKey, error.message);
      throw error;
    }
  }

  async batchAdjust(
    operations: InventoryOperationData[],
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<{ inventories: Inventory[]; records: InventoryRecord[] }> {
    const idempotentKey = this.idempotentService.generateKey(
      'inventory:batch-adjust',
      requestId,
      operations.length,
    );

    const { isDuplicate, response } = await this.idempotentService.checkAndSet(
      requestId || 'auto',
      idempotentKey,
    );

    if (isDuplicate) {
      if (response) {
        return response as any;
      }
      throw new ConflictException('请求正在处理中或已完成，请勿重复提交');
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const inventories: Inventory[] = [];
        const records: InventoryRecord[] = [];

        for (const op of operations) {
          let inventory = await prisma.inventory.findUnique({
            where: {
              storeId_productId: {
                storeId: op.storeId,
                productId: op.productId,
              },
            },
          });

          if (!inventory) {
            const product = await prisma.product.findUnique({
              where: { id: op.productId },
            });

            if (!product) {
              throw new NotFoundException(`商品不存在: ${op.productId}`);
            }

            inventory = await prisma.inventory.create({
              data: {
                storeId: op.storeId,
                productId: op.productId,
                quantity: 0,
                availableQty: 0,
                lockedQty: 0,
                price: product.basePrice,
                version: 0,
              },
            });
          }

          const quantityBefore = inventory.quantity;
          const newQuantity = quantityBefore + op.quantity;

          if (newQuantity < 0) {
            throw new BadRequestException('库存数量不能为负数');
          }

          const updatedInventory = await prisma.inventory.update({
            where: {
              storeId_productId: {
                storeId: op.storeId,
                productId: op.productId,
              },
              version: inventory.version,
            },
            data: {
              quantity: newQuantity,
              availableQty: inventory.availableQty + op.quantity,
              version: { increment: 1 },
              lastUpdated: new Date(),
            },
          });

          if (!updatedInventory) {
            throw new ConflictException('数据已被其他用户修改，请刷新后重试');
          }

          const record = await prisma.inventoryRecord.create({
            data: {
              inventoryId: inventory.id,
              storeId: op.storeId,
              productId: op.productId,
              operationType: op.quantity > 0 ? 'IN' : 'OUT',
              quantityBefore,
              quantityAfter: newQuantity,
              changeQuantity: op.quantity,
              priceBefore: inventory.price,
              priceAfter: inventory.price,
              referenceType: 'BATCH_ADJUST',
              operatorId,
              operatorName,
              remark: op.remark,
            },
          });

          inventories.push(updatedInventory);
          records.push(record);
        }

        await this.auditService.log({
          requestId,
          operation: AuditOperation.BATCH,
          entity: AuditEntity.INVENTORY,
          afterSnapshot: { count: operations.length },
          userId: operatorId,
          operatorName,
          remark: `批量调整库存: ${operations.length} 条`,
        });

        return { inventories, records };
      });

      await this.idempotentService.complete(idempotentKey, result);
      for (const op of operations) {
        await this.invalidateInventoryCache(op.storeId, op.productId);
      }
      return result;
    } catch (error) {
      await this.idempotentService.fail(idempotentKey, error.message);
      throw error;
    }
  }

  async changePrice(
    data: PriceChangeData,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<{ inventory: Inventory; record: InventoryRecord }> {
    const idempotentKey = this.idempotentService.generateKey(
      'inventory:price',
      data.storeId,
      data.productId,
      data.newPrice,
      requestId,
    );

    const { isDuplicate, response } = await this.idempotentService.checkAndSet(
      requestId || 'auto',
      idempotentKey,
    );

    if (isDuplicate) {
      if (response) {
        return response as any;
      }
      throw new ConflictException('请求正在处理中或已完成，请勿重复提交');
    }

    if (data.newPrice <= 0) {
      throw new BadRequestException('价格必须大于0');
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const inventory = await prisma.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: data.storeId,
              productId: data.productId,
            },
          },
        });

        if (!inventory) {
          throw new NotFoundException('该门店库存不存在');
        }

        const priceBefore = inventory.price;
        const newPrice = new Decimal(data.newPrice);

        if (priceBefore.equals(newPrice)) {
          throw new BadRequestException('新价格与原价格相同');
        }

        const updatedInventory = await prisma.inventory.update({
          where: {
            storeId_productId: {
              storeId: data.storeId,
              productId: data.productId,
            },
            version: inventory.version,
          },
          data: {
            price: newPrice,
            version: { increment: 1 },
            lastUpdated: new Date(),
          },
        });

        if (!updatedInventory) {
          throw new ConflictException('数据已被其他用户修改，请刷新后重试');
        }

        const record = await prisma.inventoryRecord.create({
          data: {
            inventoryId: inventory.id,
            storeId: data.storeId,
            productId: data.productId,
            operationType: 'PRICE_CHANGE',
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity,
            changeQuantity: 0,
            priceBefore,
            priceAfter: newPrice,
            referenceType: 'PRICE_CHANGE',
            operatorId,
            operatorName,
            remark: data.reason,
          },
        });

        await this.auditService.log({
          requestId,
          operation: AuditOperation.PRICE_CHANGE,
          entity: AuditEntity.INVENTORY,
          entityId: inventory.id,
          beforeSnapshot: {
            price: priceBefore,
            version: inventory.version,
          },
          afterSnapshot: {
            price: newPrice,
            version: updatedInventory.version,
          },
          changedFields: ['price'],
          userId: operatorId,
          operatorName,
          remark: `${data.reason || '价格变更'}: ${priceBefore} -> ${newPrice}`,
        });

        return { inventory: updatedInventory, record };
      });

      await this.idempotentService.complete(idempotentKey, result);
      await this.invalidateInventoryCache(data.storeId, data.productId);
      return result;
    } catch (error) {
      await this.idempotentService.fail(idempotentKey, error.message);
      throw error;
    }
  }

  async getInventoryRecords(
    filters: {
      inventoryId?: string;
      storeId?: string;
      productId?: string;
      operationType?: string;
      startTime?: Date;
      endTime?: Date;
      operatorId?: string;
    } = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ records: (InventoryRecord & { product: any })[]; total: number }> {
    const where: any = {};

    if (filters.inventoryId) where.inventoryId = filters.inventoryId;
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.operationType) where.operationType = filters.operationType;
    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.startTime || filters.endTime) {
      where.createdAt = {};
      if (filters.startTime) where.createdAt.gte = filters.startTime;
      if (filters.endTime) where.createdAt.lte = filters.endTime;
    }

    const [records, total] = await Promise.all([
      this.prismaService.inventoryRecord.findMany({
        where,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.inventoryRecord.count({ where }),
    ]);

    return { records, total };
  }

  async createTransfer(
    data: CreateTransferData,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<TransferOrder> {
    if (data.sourceStoreId === data.targetStoreId) {
      throw new BadRequestException('源门店和目标门店不能相同');
    }

    if (data.items.length === 0) {
      throw new BadRequestException('调拨商品不能为空');
    }

    const transferLockKey = `transfer:${data.sourceStoreId}:${data.targetStoreId}`;

    const result = await this.lockService.executeWithLock(
      transferLockKey,
      async () => {
        return this.prismaService.$transaction(async (prisma) => {
          const orderNo = `TF${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

          const sourceStore = await prisma.store.findUnique({
            where: { id: data.sourceStoreId },
          });

          const targetStore = await prisma.store.findUnique({
            where: { id: data.targetStoreId },
          });

          if (!sourceStore || !targetStore) {
            throw new NotFoundException('门店不存在');
          }

          if (!sourceStore.isActive || !targetStore.isActive) {
            throw new BadRequestException('门店已停用');
          }

          let totalQuantity = 0;
          let totalAmount = new Decimal(0);

          for (const item of data.items) {
            if (item.quantity <= 0) {
              throw new BadRequestException('调拨数量必须大于0');
            }
            if (item.price <= 0) {
              throw new BadRequestException('调拨单价必须大于0');
            }

            const inventory = await prisma.inventory.findUnique({
              where: {
                storeId_productId: {
                  storeId: data.sourceStoreId,
                  productId: item.productId,
                },
              },
            });

            if (!inventory) {
              throw new NotFoundException('源门店库存不存在');
            }

            if (inventory.availableQty < item.quantity) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
              });
              throw new BadRequestException(
                `库存不足: ${product?.name || item.productId}，可用数量: ${inventory.availableQty}`,
              );
            }

            totalQuantity += item.quantity;
            totalAmount = totalAmount.add(new Decimal(item.quantity * item.price));
          }

          const transferOrder = await prisma.transferOrder.create({
            data: {
              orderNo,
              sourceStoreId: data.sourceStoreId,
              targetStoreId: data.targetStoreId,
              status: TransferStatus.IN_PROGRESS,
              totalQuantity,
              totalAmount,
              operatorId,
              remark: data.remark,
              items: {
                create: data.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  amount: item.quantity * item.price,
                })),
              },
            },
            include: {
              items: { include: { product: true } },
              sourceStore: true,
              targetStore: true,
            },
          });

          for (const item of data.items) {
            await prisma.inventory.update({
              where: {
                storeId_productId: {
                  storeId: data.sourceStoreId,
                  productId: item.productId,
                },
              },
              data: {
                availableQty: { decrement: item.quantity },
                lockedQty: { increment: item.quantity },
                lastUpdated: new Date(),
              },
            });
          }

          await this.auditService.log({
            requestId,
            operation: AuditOperation.TRANSFER,
            entity: AuditEntity.TRANSFER_ORDER,
            entityId: transferOrder.id,
            entityName: transferOrder.orderNo,
            afterSnapshot: transferOrder,
            userId: operatorId,
            operatorName,
            remark: `创建调拨单: ${transferOrder.orderNo}`,
          });

          return transferOrder;
        });
      },
      { ttl: 60000, retryCount: 3 },
    );

    for (const item of data.items) {
      await this.invalidateInventoryCache(data.sourceStoreId, item.productId);
    }

    return result;
  }

  async completeTransfer(
    transferOrderId: string,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<TransferOrder> {
    const transfer = await this.prismaService.transferOrder.findUnique({
      where: { id: transferOrderId },
      include: { items: true, sourceStore: true, targetStore: true },
    });

    if (!transfer) {
      throw new NotFoundException('调拨单不存在');
    }

    if (transfer.status !== TransferStatus.IN_PROGRESS) {
      throw new BadRequestException(`调拨单当前状态为 ${transfer.status}，无法完成`);
    }

    const transferLockKey = `transfer:complete:${transferOrderId}`;

    const result = await this.lockService.executeWithLock(
      transferLockKey,
      async () => {
        return this.prismaService.$transaction(async (prisma) => {
          for (const item of transfer.items) {
            await prisma.inventory.update({
              where: {
                storeId_productId: {
                  storeId: transfer.sourceStoreId,
                  productId: item.productId,
                },
              },
              data: {
                quantity: { decrement: item.quantity },
                lockedQty: { decrement: item.quantity },
                lastUpdated: new Date(),
              },
            });

            await prisma.inventoryRecord.create({
              data: {
                inventoryId: (
                  await prisma.inventory.findUnique({
                    where: {
                      storeId_productId: {
                        storeId: transfer.sourceStoreId,
                        productId: item.productId,
                      },
                    },
                  })
                )?.id!,
                storeId: transfer.sourceStoreId,
                productId: item.productId,
                operationType: 'TRANSFER_OUT',
                quantityBefore: (
                  await prisma.inventory.findUnique({
                    where: {
                      storeId_productId: {
                        storeId: transfer.sourceStoreId,
                        productId: item.productId,
                      },
                    },
                  })
                )?.quantity || 0,
                quantityAfter: 0,
                changeQuantity: -item.quantity,
                referenceId: transferOrderId,
                referenceType: 'TRANSFER',
                operatorId,
                operatorName,
                remark: `调拨出库: ${transfer.orderNo}`,
              },
            });

            let targetInventory = await prisma.inventory.findUnique({
              where: {
                storeId_productId: {
                  storeId: transfer.targetStoreId,
                  productId: item.productId,
                },
              },
            });

            if (!targetInventory) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
              });
              targetInventory = await prisma.inventory.create({
                data: {
                  storeId: transfer.targetStoreId,
                  productId: item.productId,
                  quantity: 0,
                  availableQty: 0,
                  lockedQty: 0,
                  price: product!.basePrice,
                  version: 0,
                },
              });
            }

            await prisma.inventory.update({
              where: {
                storeId_productId: {
                  storeId: transfer.targetStoreId,
                  productId: item.productId,
                },
              },
              data: {
                quantity: { increment: item.quantity },
                availableQty: { increment: item.quantity },
                lastUpdated: new Date(),
              },
            });

            await prisma.inventoryRecord.create({
              data: {
                inventoryId: targetInventory.id,
                storeId: transfer.targetStoreId,
                productId: item.productId,
                operationType: 'TRANSFER_IN',
                quantityBefore: targetInventory.quantity,
                quantityAfter: targetInventory.quantity + item.quantity,
                changeQuantity: item.quantity,
                referenceId: transferOrderId,
                referenceType: 'TRANSFER',
                operatorId,
                operatorName,
                remark: `调拨入库: ${transfer.orderNo}`,
              },
            });
          }

          const completedOrder = await prisma.transferOrder.update({
            where: { id: transferOrderId },
            data: {
              status: TransferStatus.COMPLETED,
              completedAt: new Date(),
            },
            include: {
              items: { include: { product: true } },
              sourceStore: true,
              targetStore: true,
            },
          });

          await this.auditService.log({
            requestId,
            operation: AuditOperation.TRANSFER,
            entity: AuditEntity.TRANSFER_ORDER,
            entityId: completedOrder.id,
            entityName: completedOrder.orderNo,
            beforeSnapshot: { status: transfer.status },
            afterSnapshot: { status: TransferStatus.COMPLETED },
            userId: operatorId,
            operatorName,
            remark: `完成调拨: ${completedOrder.orderNo}`,
          });

          return completedOrder;
        });
      },
      { ttl: 60000, retryCount: 3 },
    );

    for (const item of transfer.items) {
      await this.invalidateInventoryCache(transfer.sourceStoreId, item.productId);
      await this.invalidateInventoryCache(transfer.targetStoreId, item.productId);
    }

    return result;
  }

  async cancelTransfer(
    transferOrderId: string,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<TransferOrder> {
    const transfer = await this.prismaService.transferOrder.findUnique({
      where: { id: transferOrderId },
      include: { items: true },
    });

    if (!transfer) {
      throw new NotFoundException('调拨单不存在');
    }

    if (transfer.status !== TransferStatus.IN_PROGRESS && transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(`调拨单当前状态为 ${transfer.status}，无法取消`);
    }

    const result = await this.prismaService.$transaction(async (prisma) => {
      for (const item of transfer.items) {
        await prisma.inventory.update({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
              productId: item.productId,
            },
          },
          data: {
            availableQty: { increment: item.quantity },
            lockedQty: { decrement: item.quantity },
            lastUpdated: new Date(),
          },
        });
      }

      const cancelledOrder = await prisma.transferOrder.update({
        where: { id: transferOrderId },
        data: {
          status: TransferStatus.CANCELLED,
        },
        include: {
          items: { include: { product: true } },
          sourceStore: true,
          targetStore: true,
        },
      });

      await this.auditService.log({
        requestId,
        operation: AuditOperation.TRANSFER,
        entity: AuditEntity.TRANSFER_ORDER,
        entityId: cancelledOrder.id,
        entityName: cancelledOrder.orderNo,
        beforeSnapshot: { status: transfer.status },
        afterSnapshot: { status: TransferStatus.CANCELLED },
        userId: operatorId,
        operatorName,
        remark: `取消调拨: ${cancelledOrder.orderNo}`,
      });

      return cancelledOrder;
    });

    for (const item of transfer.items) {
      await this.invalidateInventoryCache(transfer.sourceStoreId, item.productId);
    }

    return result;
  }

  async getTransferOrders(
    filters: {
      orderNo?: string;
      sourceStoreId?: string;
      targetStoreId?: string;
      status?: TransferStatus;
      operatorId?: string;
      startTime?: Date;
      endTime?: Date;
    } = {},
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ orders: TransferOrder[]; total: number }> {
    const where: any = {};

    if (filters.orderNo) where.orderNo = { contains: filters.orderNo };
    if (filters.sourceStoreId) where.sourceStoreId = filters.sourceStoreId;
    if (filters.targetStoreId) where.targetStoreId = filters.targetStoreId;
    if (filters.status) where.status = filters.status;
    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.startTime || filters.endTime) {
      where.createdAt = {};
      if (filters.startTime) where.createdAt.gte = filters.startTime;
      if (filters.endTime) where.createdAt.lte = filters.endTime;
    }

    const [orders, total] = await Promise.all([
      this.prismaService.transferOrder.findMany({
        where,
        include: {
          items: { include: { product: true } },
          sourceStore: true,
          targetStore: true,
          operator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.transferOrder.count({ where }),
    ]);

    return { orders, total };
  }

  async getTransferOrderById(id: string): Promise<TransferOrder | null> {
    return this.prismaService.transferOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        sourceStore: true,
        targetStore: true,
        operator: { select: { id: true, name: true } },
      },
    });
  }

  async getStatistics(storeId?: string): Promise<any> {
    const cacheKey = this.cacheService.generateKey(
      'inventory:stats',
      storeId,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const where: any = {};
        if (storeId) {
          where.storeId = storeId;
        }

        const [totalProducts, totalQuantity, lowStockCount, totalValue] = await Promise.all([
          this.prismaService.inventory.count({ where }),
          this.prismaService.inventory.aggregate({
            _sum: { quantity: true },
            where,
          }),
          this.prismaService.inventory.count({
            where: {
              ...where,
              availableQty: { lte: 10 },
            },
          }),
          this.prismaService.inventory.findMany({
            where,
            select: { quantity: true, price: true },
          }),
        ]);

        const totalInventoryValue = totalValue.reduce((sum, item) => {
          return sum + item.quantity * Number(item.price);
        }, 0);

        return {
          totalProducts,
          totalQuantity: totalQuantity._sum.quantity || 0,
          lowStockCount,
          totalInventoryValue,
          storeId,
        };
      },
      { ttl: CACHE_TTL },
    );
  }

  private async invalidateInventoryCache(storeId?: string, productId?: string): Promise<void> {
    await this.cacheService.invalidateInventory(storeId, productId);
    await this.cacheService.invalidateStatistics(storeId);
    this.logger.log(`缓存已失效: storeId=${storeId}, productId=${productId}`);
  }
}
