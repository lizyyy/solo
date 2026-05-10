const prisma = require('../lib/prisma')

async function main() {
  console.log('🌱 开始创建种子数据...')

  const supplier1 = await prisma.supplier.upsert({
    where: { code: 'SUP001' },
    update: {},
    create: {
      code: 'SUP001',
      name: '优质电子科技有限公司',
      contact: '张经理',
      phone: '13800138001',
      email: 'zhang@goodtech.com'
    }
  })

  const supplier2 = await prisma.supplier.upsert({
    where: { code: 'SUP002' },
    update: {},
    create: {
      code: 'SUP002',
      name: '快速物流配件厂',
      contact: '李总',
      phone: '13900139002',
      email: 'li@fastlog.com'
    }
  })

  const product1 = await prisma.product.upsert({
    where: { sku: 'PROD001' },
    update: {},
    create: {
      sku: 'PROD001',
      name: '智能芯片 A1',
      unitPrice: 50.00,
      unit: '个',
      description: '高性能处理芯片'
    }
  })

  const product2 = await prisma.product.upsert({
    where: { sku: 'PROD002' },
    update: {},
    create: {
      sku: 'PROD002',
      name: '传感器模块 B2',
      unitPrice: 25.50,
      unit: '套',
      description: '高精度传感器'
    }
  })

  const product3 = await prisma.product.upsert({
    where: { sku: 'PROD003' },
    update: {},
    create: {
      sku: 'PROD003',
      name: '连接器 C3',
      unitPrice: 10.00,
      unit: '个',
      description: '标准连接器'
    }
  })

  console.log('✅ 已创建基础数据：')
  console.log(`   - 供应商: ${supplier1.name}, ${supplier2.name}`)
  console.log(`   - 产品: ${product1.sku}, ${product2.sku}, ${product3.sku}`)

  console.log('\n🌱 创建示例数据（正常流程）：')
  
  const normalDelivery = await prisma.delivery.create({
    data: {
      deliveryNo: 'DN-2026-001',
      supplierId: supplier1.id,
      poNo: 'PO-2026-1001',
      deliveryDate: new Date('2026-05-01'),
      status: 'PARTIAL',
      items: {
        create: [
          {
            productId: product1.id,
            expectedQty: 100,
            receivedQty: 95,
            differenceQty: 5,
            unitPrice: 50.00,
            amount: 4750.00
          },
          {
            productId: product2.id,
            expectedQty: 50,
            receivedQty: 50,
            differenceQty: 0,
            unitPrice: 25.50,
            amount: 1275.00
          }
        ]
      }
    },
    include: { items: true }
  })

  console.log(`   - 收货单: ${normalDelivery.deliveryNo} (短缺 5 个 ${product1.sku})`)

  const inspection = await prisma.inspection.create({
    data: {
      inspectionNo: 'INSP-2026-001',
      deliveryId: normalDelivery.id,
      inspector: '王质检员',
      inspectionDate: new Date('2026-05-02'),
      result: 'PARTIAL_PASS',
      conclusion: '产品 PROD001 发现 2 个质量缺陷',
      items: {
        create: normalDelivery.items.map(item => {
          if (item.productId === product1.id) {
            return {
              deliveryItemId: item.id,
              productId: item.productId,
              inspectedQty: 95,
              qualifiedQty: 93,
              defectQty: 2,
              result: 'PARTIAL_PASS',
              conclusion: '外观划痕'
            }
          }
          return {
            deliveryItemId: item.id,
            productId: item.productId,
            inspectedQty: 50,
            qualifiedQty: 50,
            defectQty: 0,
            result: 'PASS',
            conclusion: '合格'
          }
        })
      }
    },
    include: { items: true }
  })

  console.log(`   - 质检单: ${inspection.inspectionNo} (发现 2 个缺陷)`)

  const claimItems = []
  for (const item of normalDelivery.items) {
    const inspItem = inspection.items.find(i => i.deliveryItemId === item.id)
    const shortageQty = Math.max(0, item.differenceQty)
    const defectQty = inspItem?.defectQty || 0
    
    if (shortageQty > 0 || defectQty > 0) {
      claimItems.push({
        deliveryItemId: item.id,
        inspectionItemId: inspItem?.id,
        productId: item.productId,
        responsibility: 'SUPPLIER',
        shortageQty,
        defectQty,
        unitPrice: item.unitPrice,
        claimAmount: (shortageQty + defectQty) * parseFloat(item.unitPrice)
      })
    }
  }

  const totalShortage = claimItems.reduce((sum, i) => sum + i.shortageQty, 0)
  const totalDefect = claimItems.reduce((sum, i) => sum + i.defectQty, 0)
  const totalAmount = claimItems.reduce((sum, i) => sum + i.claimAmount, 0)

  const claim = await prisma.claim.create({
    data: {
      claimNo: 'CLM-2026-001',
      deliveryId: normalDelivery.id,
      supplierId: supplier1.id,
      status: 'SETTLED',
      totalShortageQty: totalShortage,
      totalDefectQty: totalDefect,
      totalClaimAmount: totalAmount,
      supplierConfirmedAt: new Date('2026-05-03'),
      supplierConfirmRemark: '确认短缺和质量问题，同意赔偿',
      deductionReceiptNo: 'DR-2026-001',
      deductionReceiptDate: new Date('2026-05-05'),
      settledAt: new Date('2026-05-05'),
      items: {
        create: claimItems
      }
    },
    include: { items: true }
  })

  console.log(`   - 索赔单: ${claim.claimNo} (已结算，总金额: ¥${totalAmount})`)

  console.log('\n🌱 创建示例数据（异常流程）：')

  const exceptionDelivery = await prisma.delivery.create({
    data: {
      deliveryNo: 'DN-2026-002',
      supplierId: supplier2.id,
      poNo: 'PO-2026-1002',
      deliveryDate: new Date('2026-05-08'),
      status: 'PARTIAL',
      items: {
        create: [
          {
            productId: product3.id,
            expectedQty: 200,
            receivedQty: 180,
            differenceQty: 20,
            unitPrice: 10.00,
            amount: 1800.00
          }
        ]
      }
    }
  })

  console.log(`   - 收货单: ${exceptionDelivery.deliveryNo} (短缺 20 个 ${product3.sku})`)

  const exceptionClaim = await prisma.claim.create({
    data: {
      claimNo: 'CLM-2026-002',
      deliveryId: exceptionDelivery.id,
      supplierId: supplier2.id,
      status: 'SUBMITTED',
      totalShortageQty: 20,
      totalDefectQty: 0,
      totalClaimAmount: 200.00,
      items: {
        create: exceptionDelivery.items.map(item => ({
          deliveryItemId: item.id,
          productId: item.productId,
          responsibility: 'SUPPLIER',
          shortageQty: Math.max(0, item.differenceQty),
          defectQty: 0,
          unitPrice: item.unitPrice,
          claimAmount: Math.max(0, item.differenceQty) * parseFloat(item.unitPrice)
        }))
      }
    }
  })

  console.log(`   - 索赔单: ${exceptionClaim.claimNo} (待供应商确认)`)

  await prisma.exceptionRecord.create({
    data: {
      type: 'QUANTITY_MISMATCH',
      source: 'DeliveryService',
      supplierId: supplier2.id,
      deliveryId: exceptionDelivery.id,
      claimId: exceptionClaim.id,
      message: '历史记录显示该供应商多次送货短缺',
      status: 'OPEN'
    }
  })

  console.log(`   - 异常记录: 已记录供应商多次短缺警告`)

  await prisma.pendingTask.create({
    data: {
      type: 'SUPPLIER_FOLLOW_UP',
      source: 'Claim',
      sourceId: exceptionClaim.id,
      title: `跟进索赔 ${exceptionClaim.claimNo} 的供应商确认`,
      description: '供应商未在规定时间内确认索赔，需要电话跟进',
      priority: 2
    }
  })

  console.log(`   - 待处理任务: 已创建供应商跟进任务`)

  console.log('\n✅ 种子数据创建完成！')
  console.log('\n📊 数据概览：')
  console.log('   - 供应商: 2 个')
  console.log('   - 产品: 3 个')
  console.log('   - 收货单: 2 个')
  console.log('   - 质检单: 1 个')
  console.log('   - 索赔单: 2 个 (1 已结算, 1 待确认)')
  console.log('   - 异常记录: 1 个')
  console.log('   - 待处理任务: 1 个')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
