import { db } from './database'
import { SyncStatus } from '@prisma/client'
import { logger } from './logger'

interface SyncPayload {
  type: string
  data: Record<string, any>
}

class SyncService {
  private isRunning = false
  private retryDelay = 5000

  async addToQueue(params: {
    type: string
    payload: SyncPayload
    userId: string
    maxRetries?: number
  }) {
    const { type, payload, userId, maxRetries = 5 } = params

    return db.syncQueue.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: SyncStatus.PENDING,
        retryCount: 0,
        maxRetries,
        userId,
      },
    })
  }

  async getPendingItems() {
    return db.syncQueue.findMany({
      where: {
        OR: [
          { status: SyncStatus.PENDING },
          {
            status: SyncStatus.FAILED,
            retryCount: { lt: db.syncQueue.fields.maxRetries },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  private async simulateRemoteSync(payload: SyncPayload): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200))
    return Math.random() > 0.1
  }

  async processItem(itemId: string) {
    const item = await db.syncQueue.findUnique({
      where: { id: itemId },
    })

    if (!item) return false

    if (item.retryCount >= item.maxRetries) {
      await db.syncQueue.update({
        where: { id: itemId },
        data: { status: SyncStatus.FAILED },
      })
      return false
    }

    try {
      await db.syncQueue.update({
        where: { id: itemId },
        data: {
          status: SyncStatus.SYNCING,
          lastAttempt: new Date(),
        },
      })

      const payload: SyncPayload = JSON.parse(item.payload)
      const success = await this.simulateRemoteSync(payload)

      if (success) {
        await db.syncQueue.update({
          where: { id: itemId },
          data: {
            status: SyncStatus.SUCCESS,
            lastError: null,
          },
        })

        await logger.info({
          userId: item.userId,
          action: 'SYNC_SUCCESS',
          module: 'SYNC',
          details: { itemId, type: item.type },
        })

        return true
      } else {
        throw new Error('远程同步失败')
      }
    } catch (err: any) {
      const newRetryCount = item.retryCount + 1
      const willRetry = newRetryCount < item.maxRetries

      await db.syncQueue.update({
        where: { id: itemId },
        data: {
          status: willRetry ? SyncStatus.PENDING : SyncStatus.FAILED,
          retryCount: newRetryCount,
          lastError: err.message,
        },
      })

      await logger.warn({
        userId: item.userId,
        action: 'SYNC_FAILED',
        module: 'SYNC',
        details: {
          itemId,
          type: item.type,
          retryCount: newRetryCount,
          error: err.message,
        },
      })

      return false
    }
  }

  async processQueue() {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const items = await this.getPendingItems()

      for (const item of items) {
        await this.processItem(item.id)
      }
    } finally {
      this.isRunning = false
    }
  }

  async retryFailedItems() {
    const failedItems = await db.syncQueue.findMany({
      where: {
        status: SyncStatus.FAILED,
        retryCount: { lt: db.syncQueue.fields.maxRetries },
      },
    })

    for (const item of failedItems) {
      await db.syncQueue.update({
        where: { id: item.id },
        data: { status: SyncStatus.PENDING, lastError: null },
      })
    }

    await this.processQueue()
  }

  async resetItem(itemId: string) {
    return db.syncQueue.update({
      where: { id: itemId },
      data: {
        status: SyncStatus.PENDING,
        retryCount: 0,
        lastError: null,
      },
    })
  }

  async getStatistics() {
    const [pending, syncing, success, failed] = await Promise.all([
      db.syncQueue.count({ where: { status: SyncStatus.PENDING } }),
      db.syncQueue.count({ where: { status: SyncStatus.SYNCING } }),
      db.syncQueue.count({ where: { status: SyncStatus.SUCCESS } }),
      db.syncQueue.count({ where: { status: SyncStatus.FAILED } }),
    ])

    return { pending, syncing, success, failed }
  }

  async listQueueItems(params: {
    status?: SyncStatus
    type?: string
    skip?: number
    take?: number
  }) {
    const { status, type, skip = 0, take = 50 } = params

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [items, total] = await Promise.all([
      db.syncQueue.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      db.syncQueue.count({ where }),
    ])

    return { items, total }
  }
}

export const syncService = new SyncService()
