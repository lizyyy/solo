import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function main() {
  console.log('开始创建种子数据...')

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashPassword('admin123'),
      name: '系统管理员',
      role: 'ADMIN',
    },
  })

  const checker1 = await prisma.user.upsert({
    where: { username: 'checker1' },
    update: {},
    create: {
      username: 'checker1',
      password: hashPassword('checker123'),
      name: '张三',
      role: 'CHECKER',
    },
  })

  const checker2 = await prisma.user.upsert({
    where: { username: 'checker2' },
    update: {},
    create: {
      username: 'checker2',
      password: hashPassword('checker123'),
      name: '李四',
      role: 'CHECKER',
    },
  })

  console.log('创建用户完成')

  const products = [
    { sku: 'SKU001', name: '苹果 iPhone 15', category: '电子产品', unit: '台', description: '最新款智能手机' },
    { sku: 'SKU002', name: 'MacBook Pro 14寸', category: '电子产品', unit: '台', description: '专业笔记本电脑' },
    { sku: 'SKU003', name: 'AirPods Pro', category: '电子产品', unit: '副', description: '无线降噪耳机' },
    { sku: 'SKU004', name: 'iPad Air', category: '电子产品', unit: '台', description: '平板电脑' },
    { sku: 'SKU005', name: 'Apple Watch', category: '电子产品', unit: '块', description: '智能手表' },
    { sku: 'SKU006', name: '显示器支架', category: '办公设备', unit: '个', description: '人体工学支架' },
    { sku: 'SKU007', name: '机械键盘', category: '办公设备', unit: '把', description: '樱桃轴机械键盘' },
    { sku: 'SKU008', name: '无线鼠标', category: '办公设备', unit: '个', description: '人体工学鼠标' },
    { sku: 'SKU009', name: '办公椅', category: '办公设备', unit: '张', description: '人体工学办公椅' },
    { sku: 'SKU010', name: '文件柜', category: '办公家具', unit: '组', description: '铁质文件柜' },
  ]

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    })

    const quantity = Math.floor(Math.random() * 100) + 10
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        quantity,
        minQuantity: 5,
        location: `A-${String(Math.floor(Math.random() * 10) + 1).padStart(2, '0')}`,
      },
    })
  }

  console.log('创建商品和库存完成')

  const allProducts = await prisma.product.findMany({ include: { inventory: true } })

  const task1 = await prisma.inventoryTask.create({
    data: {
      name: '1月第一周盘点任务',
      description: '电子产品区周度盘点',
      status: 'IN_PROGRESS',
      assigneeId: checker1.id,
      startedAt: new Date(),
    },
  })

  const task2 = await prisma.inventoryTask.create({
    data: {
      name: '办公设备月度盘点',
      description: '办公设备区月度全面盘点',
      status: 'PENDING',
      assigneeId: checker2.id,
    },
  })

  const task3 = await prisma.inventoryTask.create({
    data: {
      name: '已完成盘点任务示例',
      description: '历史盘点任务',
      status: 'APPROVED',
      assigneeId: checker1.id,
      startedAt: new Date(Date.now() - 86400000 * 7),
      completedAt: new Date(Date.now() - 86400000 * 5),
    },
  })

  console.log('创建盘点任务完成')

  const electronics = allProducts.filter(p => p.category === '电子产品')
  for (const p of electronics.slice(0, 3)) {
    const actualQty = (p.inventory?.quantity || 0) + Math.floor(Math.random() * 10) - 5
    await prisma.inventoryRecord.create({
      data: {
        taskId: task1.id,
        productId: p.id,
        userId: checker1.id,
        expectedQty: p.inventory?.quantity || 0,
        actualQty,
        difference: actualQty - (p.inventory?.quantity || 0),
        remark: Math.random() > 0.5 ? '已核对' : null,
      },
    })
  }

  const history = allProducts.slice(0, 5)
  for (const p of history) {
    if (p.inventory) {
      await prisma.taskHistory.create({
        data: {
          taskId: task3.id,
          oldStatus: 'PENDING',
          newStatus: 'IN_PROGRESS',
          remark: '任务开始',
          changedBy: admin.id,
          changedAt: new Date(Date.now() - 86400000 * 6),
        },
      })

      await prisma.inventoryHistory.create({
        data: {
          inventoryId: p.inventory.id,
          oldQuantity: (p.inventory.quantity || 0) - 5,
          newQuantity: p.inventory.quantity,
          changeReason: '日常补货',
          changedBy: checker1.id,
          changedAt: new Date(Date.now() - 86400000 * 10),
        },
      })
    }
  }

  console.log('创建历史记录完成')

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: 'CREATE',
        module: 'TASK',
        details: JSON.stringify({ taskId: task1.id, action: '创建盘点任务' }),
        level: 'INFO',
      },
      {
        userId: checker1.id,
        action: 'UPDATE',
        module: 'INVENTORY',
        details: JSON.stringify({ sku: 'SKU001', action: '更新库存数量' }),
        level: 'INFO',
      },
    ],
  })

  console.log('创建审计日志完成')

  await prisma.systemConfig.upsert({
    where: { key: 'sync_enabled' },
    update: {},
    create: { key: 'sync_enabled', value: 'true' },
  })

  await prisma.systemConfig.upsert({
    where: { key: 'auto_sync_interval' },
    update: {},
    create: { key: 'auto_sync_interval', value: '60000' },
  })

  console.log('创建系统配置完成')

  console.log('\n=== 种子数据创建完成 ===')
  console.log('\n登录账号:')
  console.log('  管理员: admin / admin123')
  console.log('  盘点员: checker1 / checker123 (张三)')
  console.log('  盘点员: checker2 / checker123 (李四)')
  console.log('\n商品数量: 10种')
  console.log('盘点任务: 3个')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
