import express from 'express'
import cors from 'cors'
import dayjs from 'dayjs'
import { store } from './store'
import { SyncStatus, AnomalyStatus, CardStatus } from './types'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/statistics', (req, res) => {
  res.json({ code: 0, data: store.getStatistics() })
})

app.get('/api/cards', (req, res) => {
  const { status, syncStatus, plateNumber, page = 1, pageSize = 20 } = req.query
  let cards = store.getMonthlyCards()

  if (status) {
    cards = cards.filter(c => c.status === status)
  }
  if (syncStatus) {
    cards = cards.filter(c => c.syncStatus === syncStatus)
  }
  if (plateNumber) {
    cards = cards.filter(c => c.plateNumber.includes(plateNumber as string))
  }

  const total = cards.length
  const start = (Number(page) - 1) * Number(pageSize)
  const end = start + Number(pageSize)
  const list = cards.slice(start, end)

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } })
})

app.get('/api/cards/:id', (req, res) => {
  const card = store.getMonthlyCardById(req.params.id)
  if (!card) {
    return res.json({ code: 404, message: '卡片不存在' })
  }
  res.json({ code: 0, data: card })
})

app.get('/api/anomalies', (req, res) => {
  const { status, type, plateNumber, page = 1, pageSize = 20 } = req.query
  let anomalies = store.getAnomalies()

  if (status) {
    anomalies = anomalies.filter(a => a.status === status)
  }
  if (type) {
    anomalies = anomalies.filter(a => a.type === type)
  }
  if (plateNumber) {
    anomalies = anomalies.filter(a => a.plateNumber?.includes(plateNumber as string))
  }

  anomalies.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === AnomalyStatus.OPEN ? -1 : 1
    }
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const total = anomalies.length
  const start = (Number(page) - 1) * Number(pageSize)
  const end = start + Number(pageSize)
  const list = anomalies.slice(start, end)

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } })
})

app.get('/api/anomalies/:id', (req, res) => {
  const anomaly = store.getAnomalyById(req.params.id)
  if (!anomaly) {
    return res.json({ code: 404, message: '异常不存在' })
  }
  res.json({ code: 0, data: anomaly })
})

app.post('/api/anomalies/:id/process', (req, res) => {
  const { action, operator, resolution, cardUpdates } = req.body
  const anomaly = store.getAnomalyById(req.params.id)

  if (!anomaly) {
    return res.json({ code: 404, message: '异常不存在' })
  }

  const updates: any = { status: AnomalyStatus.PROCESSING }

  if (action === 'resolve') {
    updates.status = AnomalyStatus.RESOLVED
    updates.resolution = resolution
    updates.resolvedAt = dayjs().toISOString()
  } else if (action === 'ignore') {
    updates.status = AnomalyStatus.IGNORED
    updates.resolution = resolution
    updates.resolvedAt = dayjs().toISOString()
  } else if (action === 'assign') {
    updates.assignee = operator
  }

  const updatedAnomaly = store.updateAnomaly(req.params.id, updates)

  if (cardUpdates && anomaly.cardId) {
    store.updateCard(anomaly.cardId, cardUpdates)
  }

  store.addProcessHistory({
    anomalyId: req.params.id,
    cardId: anomaly.cardId,
    action: action,
    operator: operator || '系统',
    result: resolution || '处理中'
  })

  res.json({ code: 0, data: updatedAnomaly })
})

app.post('/api/cards/:id/sync', async (req, res) => {
  const card = store.getMonthlyCardById(req.params.id)
  if (!card) {
    return res.json({ code: 404, message: '卡片不存在' })
  }

  const { simulateSuccess = true } = req.body

  store.updateCard(req.params.id, {
    syncAttempts: card.syncAttempts + 1,
    lastSyncTime: dayjs().toISOString()
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  if (simulateSuccess) {
    store.updateCard(req.params.id, {
      syncStatus: SyncStatus.SUCCESS,
      lastSyncError: undefined
    })

    store.addSyncLog({
      cardId: req.params.id,
      plateNumber: card.plateNumber,
      status: SyncStatus.SUCCESS,
      retryCount: card.syncAttempts
    })

    const relatedAnomalies = store.getAnomalies().filter(
      a => a.cardId === req.params.id && a.status !== AnomalyStatus.RESOLVED
    )

    for (const anomaly of relatedAnomalies) {
      store.updateAnomaly(anomaly.id, {
        status: AnomalyStatus.RESOLVED,
        resolution: '同步成功自动解决',
        resolvedAt: dayjs().toISOString()
      })

      store.addProcessHistory({
        anomalyId: anomaly.id,
        cardId: req.params.id,
        action: 'auto_resolve',
        operator: '系统',
        result: '同步成功自动解决'
      })
    }

    res.json({ code: 0, data: { success: true, message: '同步成功' } })
  } else {
    const errorMsg = '闸机系统返回错误：车牌格式验证失败'
    store.updateCard(req.params.id, {
      syncStatus: SyncStatus.FAILED,
      lastSyncError: errorMsg
    })

    store.addSyncLog({
      cardId: req.params.id,
      plateNumber: card.plateNumber,
      status: SyncStatus.FAILED,
      errorMessage: errorMsg,
      retryCount: card.syncAttempts + 1
    })

    res.json({ code: 0, data: { success: false, message: errorMsg } })
  }
})

app.get('/api/cards/:id/sync-logs', (req, res) => {
  const logs = store.getSyncLogs().filter(l => l.cardId === req.params.id)
  res.json({ code: 0, data: logs })
})

app.get('/api/anomalies/:id/history', (req, res) => {
  const history = store.getProcessHistories().filter(h => h.anomalyId === req.params.id)
  res.json({ code: 0, data: history })
})

app.get('/api/blacklist', (req, res) => {
  res.json({ code: 0, data: store.getBlacklistRecords() })
})

app.get('/api/refunds', (req, res) => {
  res.json({ code: 0, data: store.getRefundRecords() })
})

app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})
