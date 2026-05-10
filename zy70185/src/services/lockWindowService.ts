import { LockWindowStatus, LockWindow, Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { stateMachineService } from './stateMachine';
import { idempotencyService } from './idempotency';
import { NotFoundError, ValidationError, LockedError } from '../utils/errors';

export interface CreateLockWindowParams {
  budgetVersionId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  actorId: string;
}

export class LockWindowService {
  async create(params: CreateLockWindowParams): Promise<LockWindow> {
    const { budgetVersionId, name, description, startDate, endDate, actorId } = params;

    const budgetVersion = await prisma.budgetVersion.findUnique({
      where: { id: budgetVersionId }
    });

    if (!budgetVersion) {
      throw new NotFoundError(`未找到预算版本 ${budgetVersionId}`);
    }

    if (budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法创建锁定窗口');
    }

    if (startDate >= endDate) {
      throw new ValidationError('开始时间必须早于结束时间');
    }

    const existing = await prisma.lockWindow.findFirst({
      where: {
        budgetVersionId,
        status: {
          in: ['OPEN', 'CLOSED']
        }
      }
    });

    if (existing) {
      throw new ValidationError(
        `已有一个「${stateMachineService.getLockWindowStatusLabel(existing.status)}」的锁定窗口（${existing.name}），请先处理后再创建新窗口`
      );
    }

    const overlapping = await prisma.lockWindow.findFirst({
      where: {
        budgetVersionId,
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } }
        ]
      }
    });

    if (overlapping) {
      throw new ValidationError(
        `窗口期与现有窗口「${overlapping.name}」时间重叠`
      );
    }

    const key = idempotencyService.generateKey(
      'lock_window',
      `${budgetVersionId}-${startDate.toISOString()}`,
      'create_lock_window'
    );

    return idempotencyService.executeWithIdempotency(key, 'create_lock_window', async () => {
      return await prisma.lockWindow.create({
        data: {
          budgetVersionId,
          name,
          description,
          startDate,
          endDate,
          status: LockWindowStatus.OPEN
        }
      });
    });
  }

  async getById(id: string): Promise<LockWindow> {
    const window = await prisma.lockWindow.findUnique({
      where: { id },
      include: {
        budgetVersion: true
      }
    });

    if (!window) {
      throw new NotFoundError(`未找到锁定窗口 ${id}`);
    }

    return window;
  }

  async list(filters?: {
    budgetVersionId?: string;
    status?: LockWindowStatus;
  }): Promise<LockWindow[]> {
    const where: Prisma.LockWindowWhereInput = {};

    if (filters?.budgetVersionId) where.budgetVersionId = filters.budgetVersionId;
    if (filters?.status) where.status = filters.status;

    return await prisma.lockWindow.findMany({
      where,
      include: {
        budgetVersion: true
      },
      orderBy: [
        { startDate: 'desc' }
      ]
    });
  }

  async getActiveWindow(budgetVersionId: string): Promise<LockWindow | null> {
    const now = new Date();

    return await prisma.lockWindow.findFirst({
      where: {
        budgetVersionId,
        status: LockWindowStatus.OPEN,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: {
        budgetVersion: true
      }
    });
  }

  async close(id: string, actorId: string): Promise<LockWindow> {
    const window = await this.getById(id);

    stateMachineService.validateLockWindowTransition(
      window.status,
      LockWindowStatus.CLOSED,
      '锁定窗口'
    );

    const key = idempotencyService.generateKey(
      'lock_window',
      id,
      'close_lock_window'
    );

    return idempotencyService.executeWithIdempotency(key, 'close_lock_window', async () => {
      return await prisma.lockWindow.update({
        where: { id },
        data: {
          status: LockWindowStatus.CLOSED
        }
      });
    }, id);
  }

  async reopen(id: string, actorId: string): Promise<LockWindow> {
    const window = await this.getById(id);

    stateMachineService.validateLockWindowTransition(
      window.status,
      LockWindowStatus.OPEN,
      '锁定窗口'
    );

    if (window.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法重新开放窗口期');
    }

    const key = idempotencyService.generateKey(
      'lock_window',
      id,
      'reopen_lock_window'
    );

    return idempotencyService.executeWithIdempotency(key, 'reopen_lock_window', async () => {
      return await prisma.lockWindow.update({
        where: { id },
        data: {
          status: LockWindowStatus.OPEN
        }
      });
    }, id);
  }

  async lock(id: string, actorId: string): Promise<LockWindow> {
    const window = await this.getById(id);

    stateMachineService.validateLockWindowTransition(
      window.status,
      LockWindowStatus.LOCKED,
      '锁定窗口'
    );

    if (window.status !== 'CLOSED') {
      throw new ValidationError('只有已关闭的窗口才能锁定');
    }

    const key = idempotencyService.generateKey(
      'lock_window',
      id,
      'lock_lock_window'
    );

    return idempotencyService.executeWithIdempotency(key, 'lock_lock_window', async () => {
      return await prisma.lockWindow.update({
        where: { id },
        data: {
          status: LockWindowStatus.LOCKED
        }
      });
    }, id);
  }

  async extend(
    id: string,
    actorId: string,
    newEndDate: Date
  ): Promise<LockWindow> {
    const window = await this.getById(id);

    if (window.status === 'LOCKED') {
      throw new LockedError('锁定窗口已锁定，无法延长');
    }

    if (newEndDate <= window.endDate) {
      throw new ValidationError('新的结束时间必须晚于当前结束时间');
    }

    const now = new Date();
    if (window.status === 'CLOSED' && newEndDate < now) {
      throw new ValidationError('延长后的结束时间必须晚于当前时间');
    }

    return await prisma.lockWindow.update({
      where: { id },
      data: {
        endDate: newEndDate
      }
    });
  }

  isWindowActive(window: LockWindow): boolean {
    if (window.status !== 'OPEN') return false;

    const now = new Date();
    return now >= window.startDate && now <= window.endDate;
  }

  getStatusLabel(status: LockWindowStatus): string {
    return stateMachineService.getLockWindowStatusLabel(status);
  }
}

export const lockWindowService = new LockWindowService();
