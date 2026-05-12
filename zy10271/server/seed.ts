import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Order, OrderStatus } from '../src/types'

const DATA_FILE = path.join(process.cwd(), 'data', 'orders.json')

const sampleOrders = [
  {
    orderNo: 'ORD-2024-001',
    customerName: '张三',
    phone: '13800138001',
    leftEye: { sphere: -2.5, cylinder: -0.5, axis: 90 },
    rightEye: { sphere: -2.75, cylinder: -0.75, axis: 85 },
    lens: { brand: '依视路', refractiveIndex: '1.60', coating: '防蓝光', type: 'single-vision' as const },
    frame: '雷朋 RB3025'
  },
  {
    orderNo: 'ORD-2024-002',
    customerName: '李四',
    phone: '13800138002',
    leftEye: { sphere: -4.0, cylinder: 0, axis: 0 },
    rightEye: { sphere: -3.75, cylinder: -0.25, axis: 180 },
    lens: { brand: '蔡司', refractiveIndex: '1.67', coating: '钻立方', type: 'single-vision' as const },
    frame: 'Oakley Holbrook'
  },
  {
    orderNo: 'ORD-2024-003',
    customerName: '王五',
    phone: '13800138003',
    leftEye: { sphere: +1.5, cylinder: -0.5, axis: 75 },
    rightEye: { sphere: +1.75, cylinder: -0.5, axis: 80 },
    lens: { brand: '豪雅', refractiveIndex: '1.56', coating: 'UV400', type: 'single-vision' as const },
    frame: '精工 H0101'
  }
]

const createHistoryEntry = (status: OrderStatus, operator: string, remarks?: string) => ({
  id: uuidv4(),
  status,
  timestamp: new Date().toISOString(),
  operator,
  remarks
})

const seedData = () => {
  const orders = sampleOrders.map(orderData => ({
    ...orderData,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    reworkCount: 0,
    history: [createHistoryEntry('pending', 'system', '订单创建')]
  }))

  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify({ orders }, null, 2))
  console.log('✅ 样例数据已初始化')
}

seedData()
