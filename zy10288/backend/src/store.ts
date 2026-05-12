import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import {
  MonthlyCard,
  BlacklistRecord,
  RefundRecord,
  Anomaly,
  ProcessHistory,
  SyncLog,
  CardStatus,
  SyncStatus,
  AnomalyType,
  AnomalyStatus
} from './types'

class DataStore {
  private monthlyCards: MonthlyCard[] = []
  private blacklistRecords: BlacklistRecord[] = []
  private refundRecords: RefundRecord[] = []
  private anomalies: Anomaly[] = []
  private processHistories: ProcessHistory[] = []
  private syncLogs: SyncLog[] = []

  constructor() {
    this.initializeSampleData()
  }

  private initializeSampleData() {
    const now = dayjs()

    this.monthlyCards = [
      {
        id: uuidv4(),
        cardNo: 'MC001',
        plateNumber: '京A12345',
        ownerName: '张三',
        ownerPhone: '13800138001',
        startDate: now.subtract(10, 'day').format('YYYY-MM-DD'),
        endDate: now.add(20, 'day').format('YYYY-MM-DD'),
        status: CardStatus.ACTIVE,
        syncStatus: SyncStatus.SUCCESS,
        syncAttempts: 1,
        lastSyncTime: now.subtract(1, 'hour').toISOString(),
        createdAt: now.subtract(10, 'day').toISOString(),
        updatedAt: now.subtract(1, 'hour').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC002',
        plateNumber: '京B67890',
        ownerName: '李四',
        ownerPhone: '13800138002',
        startDate: now.subtract(5, 'day').format('YYYY-MM-DD'),
        endDate: now.add(25, 'day').format('YYYY-MM-DD'),
        status: CardStatus.ACTIVE,
        syncStatus: SyncStatus.PENDING,
        syncAttempts: 0,
        createdAt: now.subtract(5, 'day').toISOString(),
        updatedAt: now.subtract(5, 'day').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC003',
        plateNumber: '京C11111',
        ownerName: '王五',
        ownerPhone: '13800138003',
        startDate: now.subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: now.subtract(1, 'day').format('YYYY-MM-DD'),
        status: CardStatus.REFUNDED,
        syncStatus: SyncStatus.SUCCESS,
        syncAttempts: 1,
        createdAt: now.subtract(30, 'day').toISOString(),
        updatedAt: now.subtract(15, 'day').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC004',
        plateNumber: '京D22222',
        ownerName: '赵六',
        ownerPhone: '13800138004',
        startDate: now.subtract(20, 'day').format('YYYY-MM-DD'),
        endDate: now.add(10, 'day').format('YYYY-MM-DD'),
        status: CardStatus.BLACKLISTED,
        syncStatus: SyncStatus.FAILED,
        syncAttempts: 3,
        lastSyncTime: now.subtract(2, 'hour').toISOString(),
        lastSyncError: '闸机系统连接超时',
        createdAt: now.subtract(20, 'day').toISOString(),
        updatedAt: now.subtract(2, 'hour').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC005',
        plateNumber: '京E33333',
        ownerName: '孙七',
        ownerPhone: '13800138005',
        startDate: now.subtract(15, 'day').format('YYYY-MM-DD'),
        endDate: now.add(15, 'day').format('YYYY-MM-DD'),
        status: CardStatus.ACTIVE,
        syncStatus: SyncStatus.FAILED,
        syncAttempts: 2,
        lastSyncTime: now.subtract(30, 'minute').toISOString(),
        lastSyncError: '车牌格式验证失败',
        createdAt: now.subtract(15, 'day').toISOString(),
        updatedAt: now.subtract(30, 'minute').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC006',
        plateNumber: '京E33333',
        ownerName: '孙七',
        ownerPhone: '13800138005',
        startDate: now.subtract(2, 'day').format('YYYY-MM-DD'),
        endDate: now.add(28, 'day').format('YYYY-MM-DD'),
        status: CardStatus.ACTIVE,
        syncStatus: SyncStatus.PENDING,
        syncAttempts: 0,
        createdAt: now.subtract(2, 'day').toISOString(),
        updatedAt: now.subtract(2, 'day').toISOString()
      },
      {
        id: uuidv4(),
        cardNo: 'MC007',
        plateNumber: '京F44444',
        ownerName: '周八',
        ownerPhone: '13800138006',
        startDate: now.subtract(40, 'day').format('YYYY-MM-DD'),
        endDate: now.subtract(10, 'day').format('YYYY-MM-DD'),
        status: CardStatus.BLACKLISTED,
        syncStatus: SyncStatus.SUCCESS,
        syncAttempts: 1,
        createdAt: now.subtract(40, 'day').toISOString(),
        updatedAt: now.subtract(35, 'day').toISOString()
      }
    ]

    this.blacklistRecords = [
      {
        id: uuidv4(),
        plateNumber: '京D22222',
        reason: '恶意逃费',
        startTime: now.subtract(10, 'day').format('YYYY-MM-DD'),
        endTime: now.subtract(1, 'day').format('YYYY-MM-DD'),
        isActive: true,
        createdAt: now.subtract(10, 'day').toISOString()
      },
      {
        id: uuidv4(),
        plateNumber: '京F44444',
        reason: '车辆被盗',
        startTime: now.subtract(30, 'day').format('YYYY-MM-DD'),
        endTime: now.subtract(20, 'day').format('YYYY-MM-DD'),
        isActive: false,
        createdAt: now.subtract(30, 'day').toISOString()
      }
    ]

    this.refundRecords = [
      {
        id: uuidv4(),
        cardId: this.monthlyCards[2].id,
        plateNumber: '京C11111',
        refundAmount: 300,
        refundDate: now.subtract(15, 'day').format('YYYY-MM-DD'),
        refundReason: '用户提前退卡',
        operator: '客服小王',
        synced: true
      }
    ]

    this.syncLogs = [
      {
        id: uuidv4(),
        cardId: this.monthlyCards[4].id,
        plateNumber: '京E33333',
        status: SyncStatus.FAILED,
        errorMessage: '车牌格式验证失败',
        retryCount: 1,
        createdAt: now.subtract(2, 'hour').toISOString()
      },
      {
        id: uuidv4(),
        cardId: this.monthlyCards[4].id,
        plateNumber: '京E33333',
        status: SyncStatus.FAILED,
        errorMessage: '车牌格式验证失败',
        retryCount: 2,
        createdAt: now.subtract(30, 'minute').toISOString()
      }
    ]

    this.detectAnomalies()
  }

  detectAnomalies() {
    const now = dayjs()
    const newAnomalies: Anomaly[] = []

    const existingPlateNumbers = new Set(
      this.anomalies.filter(a => a.status !== AnomalyStatus.RESOLVED).map(a => a.plateNumber)
    )

    for (const card of this.monthlyCards) {
      if (card.syncStatus === SyncStatus.PENDING && !existingPlateNumbers.has(card.plateNumber)) {
        newAnomalies.push({
          id: uuidv4(),
          type: AnomalyType.PLATE_NOT_SYNCED,
          cardId: card.id,
          plateNumber: card.plateNumber,
          description: `新车牌 ${card.plateNumber} 未同步到闸机系统`,
          status: AnomalyStatus.OPEN,
          priority: 'high',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }

      if (card.syncStatus === SyncStatus.FAILED && !existingPlateNumbers.has(card.plateNumber)) {
        newAnomalies.push({
          id: uuidv4(),
          type: AnomalyType.SYNC_FAILED,
          cardId: card.id,
          plateNumber: card.plateNumber,
          description: `车牌 ${card.plateNumber} 同步失败 (尝试 ${card.syncAttempts} 次): ${card.lastSyncError}`,
          status: AnomalyStatus.OPEN,
          priority: 'high',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }

      if (card.status === CardStatus.REFUNDED) {
        const refund = this.refundRecords.find(r => r.cardId === card.id)
        if (refund && !refund.synced && !existingPlateNumbers.has(card.plateNumber)) {
          newAnomalies.push({
            id: uuidv4(),
            type: AnomalyType.REFUND_STILL_ACTIVE,
            cardId: card.id,
            plateNumber: card.plateNumber,
            description: `车牌 ${card.plateNumber} 已退款但闸机系统仍可能有效`,
            status: AnomalyStatus.OPEN,
            priority: 'high',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          })
        }
      }
    }

    const plateGroups = new Map<string, MonthlyCard[]>()
    for (const card of this.monthlyCards) {
      if (card.status === CardStatus.ACTIVE) {
        if (!plateGroups.has(card.plateNumber)) {
          plateGroups.set(card.plateNumber, [])
        }
        plateGroups.get(card.plateNumber)!.push(card)
      }
    }

    for (const [plate, cards] of plateGroups) {
      if (cards.length > 1 && !existingPlateNumbers.has(plate)) {
        newAnomalies.push({
          id: uuidv4(),
          type: AnomalyType.MULTIPLE_CARDS_SAME_PLATE,
          plateNumber: plate,
          description: `车牌 ${plate} 绑定了 ${cards.length} 张有效月卡: ${cards.map(c => c.cardNo).join(', ')}`,
          status: AnomalyStatus.OPEN,
          priority: 'medium',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }
    }

    for (const bl of this.blacklistRecords) {
      if (bl.endTime && dayjs(bl.endTime).isBefore(now) && bl.isActive && !existingPlateNumbers.has(bl.plateNumber)) {
        newAnomalies.push({
          id: uuidv4(),
          type: AnomalyType.BLACKLIST_EXPIRED,
          plateNumber: bl.plateNumber,
          description: `车牌 ${bl.plateNumber} 黑名单已过期但未恢复`,
          status: AnomalyStatus.OPEN,
          priority: 'medium',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      }
    }

    this.anomalies = [...this.anomalies, ...newAnomalies]
  }

  getMonthlyCards() { return [...this.monthlyCards] }
  getMonthlyCardById(id: string) { return this.monthlyCards.find(c => c.id === id) }
  getBlacklistRecords() { return [...this.blacklistRecords] }
  getRefundRecords() { return [...this.refundRecords] }
  getAnomalies() { return [...this.anomalies] }
  getAnomalyById(id: string) { return this.anomalies.find(a => a.id === id) }
  getProcessHistories() { return [...this.processHistories] }
  getSyncLogs() { return [...this.syncLogs] }

  updateCard(cardId: string, updates: Partial<MonthlyCard>) {
    const index = this.monthlyCards.findIndex(c => c.id === cardId)
    if (index === -1) return null
    this.monthlyCards[index] = { ...this.monthlyCards[index], ...updates, updatedAt: dayjs().toISOString() }
    return this.monthlyCards[index]
  }

  updateAnomaly(anomalyId: string, updates: Partial<Anomaly>) {
    const index = this.anomalies.findIndex(a => a.id === anomalyId)
    if (index === -1) return null
    this.anomalies[index] = { ...this.anomalies[index], ...updates, updatedAt: dayjs().toISOString() }
    return this.anomalies[index]
  }

  addProcessHistory(history: Omit<ProcessHistory, 'id' | 'createdAt'>) {
    const newHistory: ProcessHistory = {
      id: uuidv4(),
      ...history,
      createdAt: dayjs().toISOString()
    }
    this.processHistories.push(newHistory)
    return newHistory
  }

  addSyncLog(log: Omit<SyncLog, 'id' | 'createdAt'>) {
    const newLog: SyncLog = {
      id: uuidv4(),
      ...log,
      createdAt: dayjs().toISOString()
    }
    this.syncLogs.push(newLog)
    return newLog
  }

  getStatistics() {
    const now = dayjs()
    return {
      totalCards: this.monthlyCards.length,
      activeCards: this.monthlyCards.filter(c => c.status === CardStatus.ACTIVE).length,
      pendingSync: this.monthlyCards.filter(c => c.syncStatus === SyncStatus.PENDING).length,
      failedSync: this.monthlyCards.filter(c => c.syncStatus === SyncStatus.FAILED).length,
      openAnomalies: this.anomalies.filter(a => a.status === AnomalyStatus.OPEN).length,
      todayProcessed: this.processHistories.filter(h => dayjs(h.createdAt).isSame(now, 'day')).length,
      blacklistedCount: this.blacklistRecords.filter(b => b.isActive).length,
      refundedCount: this.refundRecords.length
    }
  }
}

export const store = new DataStore()
