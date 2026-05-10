import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from './audit.service';
import { CacheService } from '../../infrastructure/redis/cache.service';
import {
  AuditLog,
  AuditOperation,
  AuditEntity,
  TransferStatus,
} from '@prisma/client';

export interface RollbackResult {
  success: boolean;
  logId: string;
  operation: AuditOperation;
  entity: AuditEntity;
  message: string;
  revertLogId?: string;
}

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
    private cacheService: CacheService,
  ) {}

  async rollbackOperation(
    auditLogId: string,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    const log = await this.prismaService.auditLog.findUnique({
      where: { id: auditLogId },
    });

    if (!log) {
      throw new NotFoundException('审计日志不存在');
    }

    if (log.operation === AuditOperation.REVERT) {
      throw new BadRequestException('不能回滚一个回滚操作');
    }

    const alreadyReverted = await this.prismaService.auditLog.findFirst({
      where: {
        parentLogId: auditLogId,
        operation: AuditOperation.REVERT,
      },
    });

    if (alreadyReverted) {
      throw new ConflictException('该操作已被回滚');
    }

    let result: RollbackResult;

    switch (log.entity) {
      case AuditEntity.INVENTORY:
        result = await this.rollbackInventoryOperation(log, operatorId, operatorName, requestId);
        break;
      case AuditEntity.TRANSFER_ORDER:
        result = await this.rollbackTransferOperation(log, operatorId, operatorName, requestId);
        break;
      default:
        throw new BadRequestException(`不支持回滚该类型的操作: ${log.entity}`);
    }

    return result;
  }

  private async rollbackInventoryOperation(
    log: AuditLog,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    const beforeSnapshot = (log.beforeSnapshot || {}) as Record<string, any>;
    const afterSnapshot = (log.afterSnapshot || {}) as Record<string, any>;

    if (!log.entityId) {
      throw new BadRequestException('无法确定库存实体ID');
    }

    const inventory = await this.prismaService.inventory.findUnique({
      where: { id: log.entityId },
    });

    if (!inventory) {
      throw new NotFoundException('库存记录不存在，可能已被删除');
    }

    const result = await this.prismaService.$transaction(async (prisma) => {
      let updatedInventory: any = null;

      switch (log.operation) {
        case AuditOperation.ADJUST:
        case AuditOperation.BATCH: {
          const originalQuantity = beforeSnapshot.quantity ?? inventory.quantity;
          const originalAvailableQty = beforeSnapshot.availableQty ?? inventory.availableQty;
          const originalPrice = beforeSnapshot.price ?? inventory.price;

          updatedInventory = await prisma.inventory.update({
            where: {
              id: inventory.id,
              version: inventory.version,
            },
            data: {
              quantity: originalQuantity,
              availableQty: originalAvailableQty,
              price: originalPrice,
              version: { increment: 1 },
              lastUpdated: new Date(),
            },
          });

          await prisma.inventoryRecord.create({
            data: {
              inventoryId: inventory.id,
              storeId: inventory.storeId,
              productId: inventory.productId,
              operationType: 'REVERT',
              quantityBefore: inventory.quantity,
              quantityAfter: originalQuantity,
              changeQuantity: originalQuantity - inventory.quantity,
              priceBefore: inventory.price,
              priceAfter: originalPrice,
              referenceId: log.id,
              referenceType: 'REVERT',
              operatorId,
              operatorName,
              remark: `回滚操作: 恢复到 ${log.timestamp.toISOString()} 之前的状态`,
            },
          });
          break;
        }

        case AuditOperation.PRICE_CHANGE: {
          const originalPrice = beforeSnapshot.price ?? inventory.price;

          updatedInventory = await prisma.inventory.update({
            where: {
              id: inventory.id,
              version: inventory.version,
            },
            data: {
              price: originalPrice,
              version: { increment: 1 },
              lastUpdated: new Date(),
            },
          });

          await prisma.inventoryRecord.create({
            data: {
              inventoryId: inventory.id,
              storeId: inventory.storeId,
              productId: inventory.productId,
              operationType: 'PRICE_REVERT',
              quantityBefore: inventory.quantity,
              quantityAfter: inventory.quantity,
              changeQuantity: 0,
              priceBefore: inventory.price,
              priceAfter: originalPrice,
              referenceId: log.id,
              referenceType: 'REVERT',
              operatorId,
              operatorName,
              remark: `回滚改价: 恢复价格`,
            },
          });
          break;
        }

        default:
          throw new BadRequestException(`不支持回滚该类型的库存操作: ${log.operation}`);
      }

      if (!updatedInventory) {
        throw new ConflictException('数据已被其他用户修改，请刷新后重试');
      }

      const revertLog = await this.auditService.log({
        requestId,
        operation: AuditOperation.REVERT,
        entity: AuditEntity.INVENTORY,
        entityId: inventory.id,
        beforeSnapshot: {
          quantity: inventory.quantity,
          availableQty: inventory.availableQty,
          price: inventory.price,
          version: inventory.version,
        },
        afterSnapshot: {
          quantity: updatedInventory.quantity,
          availableQty: updatedInventory.availableQty,
          price: updatedInventory.price,
          version: updatedInventory.version,
        },
        changedFields: this.findChangedFields(inventory, updatedInventory),
        userId: operatorId,
        operatorName,
        parentLogId: log.id,
        remark: `回滚操作 #${log.id}: ${log.remark || log.operation}`,
      });

      return { updatedInventory, revertLog };
    });

    await this.cacheService.invalidateInventory(inventory.storeId, inventory.productId);
    await this.cacheService.invalidateStatistics(inventory.storeId);

    return {
      success: true,
      logId: log.id,
      operation: log.operation,
      entity: log.entity,
      message: `已成功回滚库存操作`,
      revertLogId: result.revertLog.id,
    };
  }

  private async rollbackTransferOperation(
    log: AuditLog,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    if (!log.entityId) {
      throw new BadRequestException('无法确定调拨单ID');
    }

    const transferOrder = await this.prismaService.transferOrder.findUnique({
      where: { id: log.entityId },
      include: { items: true, sourceStore: true, targetStore: true },
    });

    if (!transferOrder) {
      throw new NotFoundException('调拨单不存在');
    }

    if (log.operation !== AuditOperation.TRANSFER) {
      throw new BadRequestException('该日志不是调拨操作');
    }

    const beforeStatus = (log.beforeSnapshot as Record<string, any>)?.status;
    const afterStatus = (log.afterSnapshot as Record<string, any>)?.status;

    if (afterStatus === TransferStatus.COMPLETED && beforeStatus === TransferStatus.IN_PROGRESS) {
      return this.revertCompletedTransfer(transferOrder, log, operatorId, operatorName, requestId);
    } else if (afterStatus === TransferStatus.CANCELLED) {
      return this.revertCancelledTransfer(transferOrder, log, operatorId, operatorName, requestId);
    } else if (afterStatus === TransferStatus.IN_PROGRESS && !beforeStatus) {
      return this.revertCreatedTransfer(transferOrder, log, operatorId, operatorName, requestId);
    }

    throw new BadRequestException(
      `不支持回滚该状态变更的调拨: ${beforeStatus} -> ${afterStatus}`,
    );
  }

  private async revertCompletedTransfer(
    transfer: any,
    log: AuditLog,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    const result = await this.prismaService.$transaction(async (prisma) => {
      for (const item of transfer.items) {
        const sourceInventory = await prisma.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
              productId: item.productId,
            },
          },
        });

        if (!sourceInventory) {
          throw new NotFoundException(`源门店库存不存在: ${item.productId}`);
        }

        await prisma.inventory.update({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
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
            inventoryId: sourceInventory.id,
            storeId: transfer.sourceStoreId,
            productId: item.productId,
            operationType: 'TRANSFER_REVERT_IN',
            quantityBefore: sourceInventory.quantity,
            quantityAfter: sourceInventory.quantity + item.quantity,
            changeQuantity: item.quantity,
            referenceId: transfer.id,
            referenceType: 'TRANSFER_REVERT',
            operatorId,
            operatorName,
            remark: `回滚调拨出库: ${transfer.orderNo}`,
          },
        });

        const targetInventory = await prisma.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.targetStoreId,
              productId: item.productId,
            },
          },
        });

        if (!targetInventory) {
          throw new NotFoundException(`目标门店库存不存在: ${item.productId}`);
        }

        if (targetInventory.quantity < item.quantity) {
          throw new BadRequestException(
            `目标门店库存不足，无法回滚: 商品 ${item.productId}`,
          );
        }

        await prisma.inventory.update({
          where: {
            storeId_productId: {
              storeId: transfer.targetStoreId,
              productId: item.productId,
            },
          },
          data: {
            quantity: { decrement: item.quantity },
            availableQty: { decrement: item.quantity },
            lastUpdated: new Date(),
          },
        });

        await prisma.inventoryRecord.create({
          data: {
            inventoryId: targetInventory.id,
            storeId: transfer.targetStoreId,
            productId: item.productId,
            operationType: 'TRANSFER_REVERT_OUT',
            quantityBefore: targetInventory.quantity,
            quantityAfter: targetInventory.quantity - item.quantity,
            changeQuantity: -item.quantity,
            referenceId: transfer.id,
            referenceType: 'TRANSFER_REVERT',
            operatorId,
            operatorName,
            remark: `回滚调拨入库: ${transfer.orderNo}`,
          },
        });
      }

      const revertedOrder = await prisma.transferOrder.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.REVERTED,
        },
      });

      const revertLog = await this.auditService.log({
        requestId,
        operation: AuditOperation.REVERT,
        entity: AuditEntity.TRANSFER_ORDER,
        entityId: transfer.id,
        entityName: transfer.orderNo,
        beforeSnapshot: { status: TransferStatus.COMPLETED },
        afterSnapshot: { status: TransferStatus.REVERTED },
        userId: operatorId,
        operatorName,
        parentLogId: log.id,
        remark: `回滚完成的调拨: ${transfer.orderNo}`,
      });

      return { revertedOrder, revertLog };
    });

    for (const item of transfer.items) {
      await this.cacheService.invalidateInventory(transfer.sourceStoreId, item.productId);
      await this.cacheService.invalidateInventory(transfer.targetStoreId, item.productId);
    }
    await this.cacheService.invalidateStatistics(transfer.sourceStoreId);
    await this.cacheService.invalidateStatistics(transfer.targetStoreId);

    return {
      success: true,
      logId: log.id,
      operation: log.operation,
      entity: log.entity,
      message: `已成功回滚调拨单 ${transfer.orderNo}`,
      revertLogId: result.revertLog.id,
    };
  }

  private async revertCancelledTransfer(
    transfer: any,
    log: AuditLog,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    const result = await this.prismaService.$transaction(async (prisma) => {
      for (const item of transfer.items) {
        const sourceInventory = await prisma.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
              productId: item.productId,
            },
          },
        });

        if (!sourceInventory) {
          throw new NotFoundException(`源门店库存不存在: ${item.productId}`);
        }

        if (sourceInventory.availableQty < item.quantity) {
          throw new BadRequestException(
            `源门店可用库存不足，无法恢复调拨: 商品 ${item.productId}`,
          );
        }

        await prisma.inventory.update({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
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

      const restoredOrder = await prisma.transferOrder.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.IN_PROGRESS,
        },
      });

      const revertLog = await this.auditService.log({
        requestId,
        operation: AuditOperation.REVERT,
        entity: AuditEntity.TRANSFER_ORDER,
        entityId: transfer.id,
        entityName: transfer.orderNo,
        beforeSnapshot: { status: TransferStatus.CANCELLED },
        afterSnapshot: { status: TransferStatus.IN_PROGRESS },
        userId: operatorId,
        operatorName,
        parentLogId: log.id,
        remark: `恢复已取消的调拨: ${transfer.orderNo}`,
      });

      return { restoredOrder, revertLog };
    });

    for (const item of transfer.items) {
      await this.cacheService.invalidateInventory(transfer.sourceStoreId, item.productId);
    }
    await this.cacheService.invalidateStatistics(transfer.sourceStoreId);

    return {
      success: true,
      logId: log.id,
      operation: log.operation,
      entity: log.entity,
      message: `已恢复调拨单 ${transfer.orderNo} 到进行中状态`,
      revertLogId: result.revertLog.id,
    };
  }

  private async revertCreatedTransfer(
    transfer: any,
    log: AuditLog,
    operatorId: string,
    operatorName: string,
    requestId?: string,
  ): Promise<RollbackResult> {
    const result = await this.prismaService.$transaction(async (prisma) => {
      for (const item of transfer.items) {
        const sourceInventory = await prisma.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
              productId: item.productId,
            },
          },
        });

        if (!sourceInventory) {
          throw new NotFoundException(`源门店库存不存在: ${item.productId}`);
        }

        if (sourceInventory.lockedQty < item.quantity) {
          throw new BadRequestException(
            `锁定库存不足，无法回滚: 商品 ${item.productId}`,
          );
        }

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
        where: { id: transfer.id },
        data: {
          status: TransferStatus.CANCELLED,
        },
      });

      const revertLog = await this.auditService.log({
        requestId,
        operation: AuditOperation.REVERT,
        entity: AuditEntity.TRANSFER_ORDER,
        entityId: transfer.id,
        entityName: transfer.orderNo,
        beforeSnapshot: { status: TransferStatus.IN_PROGRESS },
        afterSnapshot: { status: TransferStatus.CANCELLED },
        userId: operatorId,
        operatorName,
        parentLogId: log.id,
        remark: `撤销新创建的调拨: ${transfer.orderNo}`,
      });

      return { cancelledOrder, revertLog };
    });

    for (const item of transfer.items) {
      await this.cacheService.invalidateInventory(transfer.sourceStoreId, item.productId);
    }
    await this.cacheService.invalidateStatistics(transfer.sourceStoreId);

    return {
      success: true,
      logId: log.id,
      operation: log.operation,
      entity: log.entity,
      message: `已撤销调拨单 ${transfer.orderNo}`,
      revertLogId: result.revertLog.id,
    };
  }

  async canRollback(auditLogId: string): Promise<{
    canRollback: boolean;
    reason?: string;
    operation?: AuditOperation;
    entity?: AuditEntity;
  }> {
    const log = await this.prismaService.auditLog.findUnique({
      where: { id: auditLogId },
    });

    if (!log) {
      return { canRollback: false, reason: '审计日志不存在' };
    }

    if (log.operation === AuditOperation.REVERT) {
      return { canRollback: false, reason: '不能回滚一个回滚操作' };
    }

    const alreadyReverted = await this.prismaService.auditLog.findFirst({
      where: {
        parentLogId: auditLogId,
        operation: AuditOperation.REVERT,
      },
    });

    if (alreadyReverted) {
      return { canRollback: false, reason: '该操作已被回滚' };
    }

    if (log.entity === AuditEntity.INVENTORY) {
      const supportedOperations: AuditOperation[] = [AuditOperation.ADJUST, AuditOperation.BATCH, AuditOperation.PRICE_CHANGE];
      if (!supportedOperations.includes(log.operation)) {
        return { canRollback: false, reason: `不支持回滚该类型的库存操作: ${log.operation}` };
      }
    } else if (log.entity === AuditEntity.TRANSFER_ORDER) {
      if (log.operation !== AuditOperation.TRANSFER) {
        return { canRollback: false, reason: `不支持回滚该类型的调拨操作: ${log.operation}` };
      }
    } else {
      return { canRollback: false, reason: `不支持回滚该类型的操作: ${log.entity}` };
    }

    return {
      canRollback: true,
      operation: log.operation,
      entity: log.entity,
    };
  }

  private findChangedFields(before: any, after: any): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const beforeValue = before?.[key];
      const afterValue = after?.[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }
}
