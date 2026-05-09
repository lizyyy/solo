import offlineStorage from './offlineStorage'
import { countTaskApi } from './api'
import { ElMessage } from 'element-plus'

class SyncService {
  constructor() {
    this.isSyncing = false
    this.syncInterval = null
    this.checkInterval = 30000
  }

  start() {
    this.setupOnlineOfflineListeners()
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.trySync()
      }
    }, this.checkInterval)
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }

  setupOnlineOfflineListeners() {
    window.addEventListener('online', () => {
      console.log('网络已连接，开始同步...')
      ElMessage.success('网络已连接，正在同步离线数据...')
      this.trySync()
    })

    window.addEventListener('offline', () => {
      console.log('网络已断开，切换到离线模式')
      ElMessage.warning('网络已断开，数据将保存到本地')
    })
  }

  async trySync() {
    if (this.isSyncing) return

    this.isSyncing = true
    try {
      await this.syncCounts()
      await this.processPendingQueue()
    } catch (error) {
      console.error('同步失败:', error)
    } finally {
      this.isSyncing = false
    }
  }

  async syncCounts() {
    const unsyncedCounts = await offlineStorage.getUnsyncedCounts()

    if (unsyncedCounts.length === 0) {
      return
    }

    console.log(`发现 ${unsyncedCounts.length} 条未同步的盘点数据`)

    try {
      const detailsToSync = unsyncedCounts.map(count => ({
        id: count.id,
        countQuantity: count.countQuantity,
        version: count.version,
        remark: count.remark || null
      }))

      const result = await countTaskApi.syncDetails(detailsToSync)

      if (result && result.data && result.data.results) {
        const successIds = result.data.results
          .filter(r => r.success)
          .map(r => r.id)

        await offlineStorage.markCountsAsSynced(successIds)

        const successCount = successIds.length
        const failCount = unsyncedCounts.length - successCount

        if (failCount === 0) {
          ElMessage.success(`成功同步 ${successCount} 条盘点数据`)
        } else {
          ElMessage.warning(`同步完成：成功 ${successCount} 条，失败 ${failCount} 条，稍后将重新同步`)
        }
      }
    } catch (error) {
      console.error('同步盘点数据失败:', error)
      throw error
    }
  }

  async processPendingQueue() {
    const queue = await offlineStorage.getPendingQueue()

    if (queue.length === 0) {
      return
    }

    console.log(`发现 ${queue.length} 条待处理的队列项`)

    for (const item of queue) {
      try {
        if (item.retryCount >= item.maxRetries) {
          console.warn(`跳过已达到最大重试次数: ${item.id}`)
          continue
        }

        await this.executeQueueItem(item)
        await offlineStorage.removeFromQueue(item.id)
      } catch (error) {
        console.error(`执行队列项失败: ${item.id}`, error)
        await offlineStorage.updateQueueItem(item.id, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: error.message
        })
      }
    }
  }

  async executeQueueItem(item) {
    switch (item.type) {
      case 'updateCountDetail':
        await countTaskApi.updateDetail(item.detailId, item.data)
        break
      case 'completeTask':
        await countTaskApi.complete(item.taskId, item.data)
        break
      case 'startTask':
        await countTaskApi.start(item.taskId)
        break
      case 'cancelTask':
        await countTaskApi.cancel(item.taskId)
        break
      default:
        throw new Error(`未知的队列类型: ${item.type}`)
    }
  }

  async queueTaskAction(type, data) {
    const queueItem = await offlineStorage.addToPendingQueue({
      type,
      data
    })

    if (navigator.onLine) {
      setTimeout(() => this.trySync(), 1000)
    }

    return queueItem
  }
}

const syncService = new SyncService()
export default syncService
