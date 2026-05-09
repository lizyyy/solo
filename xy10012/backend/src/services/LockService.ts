import { EntityType, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { RequestContext } from '../utils/logger';

export class VersionConflictError extends Error {
  constructor(
    message: string,
    public currentVersion: number,
    public yourVersion: number
  ) {
    super(message);
    this.name = 'VersionConflictError';
  }
}

export class LockConflictError extends Error {
  constructor(
    message: string,
    public lockedBy: string,
    public lockedAt: Date
  ) {
    super(message);
    this.name = 'LockConflictError';
  }
}

export class LockService {
  private readonly lockTimeout: number;
  private readonly redisKeyPrefix = 'lock:';

  constructor(lockTimeout?: number) {
    this.lockTimeout = lockTimeout || env.lockTimeout;
  }

  async acquireOptimisticLock(
    entityType: EntityType,
    entityId: string,
    userId: string,
    context: RequestContext
  ): Promise<{ success: boolean; lock?: { lockedBy: string; lockedAt: Date } }> {
    const redisKey = `${this.redisKeyPrefix}${entityType}:${entityId}`;
    const lockValue = `${userId}:${Date.now()}`;

    const result = await redis.set(
      redisKey,
      lockValue,
      'PX',
      this.lockTimeout,
      'NX'
    );

    if (result === 'OK') {
      await prisma.optimisticLock.upsert({
        where: {
          entityType_entityId: { entityType, entityId },
        },
        create: {
          entityType,
          entityId,
          version: 1,
          lockedBy: userId,
          expiresAt: new Date(Date.now() + this.lockTimeout),
        },
        update: {
          lockedBy: userId,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + this.lockTimeout),
        },
      });

      return { success: true };
    }

    const existingLock = await redis.get(redisKey);
    if (existingLock) {
      const [lockedBy, timestamp] = existingLock.split(':');
      return {
        success: false,
        lock: {
          lockedBy,
          lockedAt: new Date(parseInt(timestamp)),
        },
      };
    }

    return { success: false };
  }

  async releaseOptimisticLock(
    entityType: EntityType,
    entityId: string,
    userId: string
  ): Promise<boolean> {
    const redisKey = `${this.redisKeyPrefix}${entityType}:${entityId}`;
    const currentLock = await redis.get(redisKey);

    if (currentLock && currentLock.startsWith(`${userId}:`)) {
      await redis.del(redisKey);
      await prisma.optimisticLock.delete({
        where: {
          entityType_entityId: { entityType, entityId },
        },
      }).catch(() => {});
      return true;
    }

    return false;
  }

  async checkLock(
    entityType: EntityType,
    entityId: string
  ): Promise<{ isLocked: boolean; lock?: { lockedBy: string; lockedAt: Date; expiresAt: Date } }> {
    const redisKey = `${this.redisKeyPrefix}${entityType}:${entityId}`;
    const lockValue = await redis.get(redisKey);

    if (!lockValue) {
      return { isLocked: false };
    }

    const [lockedBy, timestamp] = lockValue.split(':');

    const dbLock = await prisma.optimisticLock.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });

    return {
      isLocked: true,
      lock: {
        lockedBy,
        lockedAt: new Date(parseInt(timestamp)),
        expiresAt: dbLock?.expiresAt || new Date(Date.now() + this.lockTimeout),
      },
    };
  }

  async checkVersion(
    entityType: EntityType,
    entityId: string,
    expectedVersion: number,
    tx: PrismaClient = prisma
  ): Promise<void> {
    let currentVersion = 0;

    switch (entityType) {
      case EntityType.TASK: {
        const task = await tx.task.findUnique({
          where: { id: entityId },
          select: { version: true },
        });
        currentVersion = task?.version || 0;
        break;
      }
      case EntityType.CUSTOMER: {
        const customer = await tx.customer.findUnique({
          where: { id: entityId },
          select: { version: true },
        });
        currentVersion = customer?.version || 0;
        break;
      }
      case EntityType.USER: {
        const user = await tx.user.findUnique({
          where: { id: entityId },
          select: { version: true },
        });
        currentVersion = user?.version || 0;
        break;
      }
    }

    if (currentVersion !== expectedVersion) {
      throw new VersionConflictError(
        '数据已被其他用户修改，请刷新后重试',
        currentVersion,
        expectedVersion
      );
    }
  }

  async extendLock(
    entityType: EntityType,
    entityId: string,
    userId: string
  ): Promise<boolean> {
    const redisKey = `${this.redisKeyPrefix}${entityType}:${entityId}`;
    const currentLock = await redis.get(redisKey);

    if (currentLock && currentLock.startsWith(`${userId}:`)) {
      const newLockValue = `${userId}:${Date.now()}`;
      const result = await redis.set(
        redisKey,
        newLockValue,
        'PX',
        this.lockTimeout,
        'XX'
      );

      if (result === 'OK') {
        await prisma.optimisticLock.update({
          where: {
            entityType_entityId: { entityType, entityId },
          },
          data: {
            lockedAt: new Date(),
            expiresAt: new Date(Date.now() + this.lockTimeout),
          },
        });
        return true;
      }
    }

    return false;
  }
}

export const lockService = new LockService();