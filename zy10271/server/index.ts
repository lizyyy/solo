import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Order, OrderStatus, HistoryEntry } from '../src/types'

const app = express()
const PORT = 3001
const DATA_FILE = path.join(process.cwd(), 'data', 'orders.json')

app.use(cors())
app.use(express.json())

interface DataStore {
  orders: Order[]
}

const loadData = (): DataStore => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load data:', e)
  }
  return { orders: [] }
}

const saveData = (data: DataStore) => {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to save data:', e)
  }
}

const createHistoryEntry = (status: OrderStatus, operator: string, remarks?: string): HistoryEntry => ({
  id: uuidv4(),
  status,
  timestamp: new Date().toISOString(),
  operator,
  remarks
})

app.get('/api/orders', (req, res) => {
  const data = loadData()
  res.json(data.orders)
})

app.get('/api/orders/:id', (req, res) => {
  const data = loadData()
  const order = data.orders.find(o => o.id === req.params.id)
  if (!order) {
    return res.status(404).json({ error: '订单不存在' })
  }
  res.json(order)
})

app.post('/api/orders', (req, res) => {
  const data = loadData()
  const orderData = req.body

  const exists = data.orders.some((o: Order) =>
    o.orderNo === orderData.orderNo ||
    (o.customerName === orderData.customerName && o.phone === orderData.phone && o.status !== 'picked-up')
  )

  if (exists) {
    return res.status(400).json({ error: '订单已存在或该客户有未完成订单' })
  }

  const errors: string[] = []
  if (orderData.leftEye.axis < 0 || orderData.leftEye.axis > 180) {
    errors.push('左眼轴位必须在0-180之间')
  }
  if (orderData.rightEye.axis < 0 || orderData.rightEye.axis > 180) {
    errors.push('右眼轴位必须在0-180之间')
  }
  if (Math.abs(orderData.leftEye.sphere - orderData.rightEye.sphere) > 6) {
    errors.push('左右眼球镜度数差异过大，请确认')
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') })
  }

  const newOrder: Order = {
    ...orderData,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    reworkCount: 0,
    history: [createHistoryEntry('pending', 'system', '订单创建')]
  }

  data.orders.push(newOrder)
  saveData(data)
  res.status(201).json(newOrder)
})

const STATUS_FLOW: OrderStatus[] = [
  'pending', 'measuring', 'cutting', 'polishing', 'edging', 'quality-check', 'ready', 'picked-up'
]

app.patch('/api/orders/:id/status', (req, res) => {
  const data = loadData()
  const { newStatus, operator, remarks } = req.body
  const orderIndex = data.orders.findIndex((o: Order) => o.id === req.params.id)

  if (orderIndex === -1) {
    return res.status(404).json({ error: '订单不存在' })
  }

  const order = data.orders[orderIndex]

  if (newStatus === 'picked-up') {
    if (!order.qualityCheck || !order.qualityCheck.passed || order.status !== 'ready') {
      return res.status(400).json({ error: '未通过质检的订单不能取镜' })
    }
  }

  if (newStatus === 'rework' && order.status !== 'quality-check') {
    return res.status(400).json({ error: '只有质检未通过的订单才能返工' })
  }

  if (newStatus !== 'rework' && newStatus !== 'picked-up' && order.status === 'rework') {
    const currentIndex = STATUS_FLOW.indexOf(newStatus)
    if (currentIndex <= STATUS_FLOW.indexOf('quality-check')) {
      data.orders[orderIndex] = {
        ...order,
        status: newStatus,
        reworkCount: order.reworkCount + 1,
        history: [...order.history, createHistoryEntry(newStatus, operator, remarks)]
      }
      saveData(data)
      return res.json(data.orders[orderIndex])
    }
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status)
  const newIndex = STATUS_FLOW.indexOf(newStatus)

  if (newStatus !== 'rework' && newIndex <= currentIndex && order.status !== 'rework') {
    return res.status(400).json({ error: '不能回退到已完成的状态' })
  }

  data.orders[orderIndex] = {
    ...order,
    status: newStatus,
    history: [...order.history, createHistoryEntry(newStatus, operator, remarks)],
    pickedUpAt: newStatus === 'picked-up' ? new Date().toISOString() : order.pickedUpAt,
    qualityCheck: newStatus === 'ready'
      ? { passed: true, inspector: operator, checkedAt: new Date().toISOString(), remarks }
      : order.qualityCheck
  }

  saveData(data)
  res.json(data.orders[orderIndex])
})

app.delete('/api/orders/:id', (req, res) => {
  const data = loadData()
  const orderIndex = data.orders.findIndex((o: Order) => o.id === req.params.id)
  if (orderIndex === -1) {
    return res.status(404).json({ error: '订单不存在' })
  }
  data.orders.splice(orderIndex, 1)
  saveData(data)
  res.status(204).send()
})

app.listen(PORT, () => {
  console.log(`🚀 后端服务运行在 http://localhost:${PORT}`)
})
