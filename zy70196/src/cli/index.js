const { Command } = require('commander')
const prisma = require('../lib/prisma')
const deliveryService = require('../services/deliveryService')
const inspectionService = require('../services/inspectionService')
const claimService = require('../services/claimService')
const exceptionService = require('../services/exceptionService')

const program = new Command()

program
  .name('shortage-claim')
  .description('到货短缺索赔 API CLI 工具')
  .version('1.0.0')

program
  .command('health')
  .description('检查系统状态')
  .action(async () => {
    try {
      await prisma.$connect()
      console.log('✅ 系统状态正常')
      console.log('   - 数据库连接: 正常')
    } catch (error) {
      console.error('❌ 系统异常:', error.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

const listCmd = program.command('list').description('列出各类数据')

listCmd
  .command('suppliers')
  .description('列出所有供应商')
  .action(async () => {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
    console.log('\n📦 供应商列表:')
    suppliers.forEach(s => {
      console.log(`  ${s.code} - ${s.name} (${s.contact || '无联系人'})`)
    })
    console.log(`  共 ${suppliers.length} 个供应商\n`)
  })

listCmd
  .command('products')
  .description('列出所有产品')
  .action(async () => {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
    console.log('\n📦 产品列表:')
    products.forEach(p => {
      console.log(`  ${p.sku} - ${p.name} (¥${p.unitPrice}/${p.unit})`)
    })
    console.log(`  共 ${products.length} 个产品\n`)
  })

listCmd
  .command('deliveries')
  .option('-s, --status <status>', '按状态筛选')
  .description('列出所有收货单')
  .action(async (options) => {
    const where = options.status ? { status: options.status } : {}
    const deliveries = await prisma.delivery.findMany({ 
      where,
      orderBy: { deliveryDate: 'desc' },
      include: { supplier: true }
    })
    console.log('\n📦 收货单列表:')
    deliveries.forEach(d => {
      console.log(`  ${d.deliveryNo} - ${d.supplier.name} [${d.status}]`)
      console.log(`      日期: ${d.deliveryDate.toISOString().split('T')[0]}`)
    })
    console.log(`  共 ${deliveries.length} 个收货单\n`)
  })

listCmd
  .command('claims')
  .option('-s, --status <status>', '按状态筛选')
  .description('列出所有索赔单')
  .action(async (options) => {
    const where = options.status ? { status: options.status } : {}
    const claims = await prisma.claim.findMany({ 
      where,
      orderBy: { createdAt: 'desc' },
      include: { supplier: true }
    })
    console.log('\n📋 索赔单列表:')
    claims.forEach(c => {
      console.log(`  ${c.claimNo} - ${c.supplier.name} [${c.status}]`)
      console.log(`      短缺: ${c.totalShortageQty} 件, 缺陷: ${c.totalDefectQty} 件, 金额: ¥${c.totalClaimAmount}`)
    })
    console.log(`  共 ${claims.length} 个索赔单\n`)
  })

listCmd
  .command('exceptions')
  .option('-s, --status <status>', '按状态筛选 (OPEN/RESOLVED/IGNORED)')
  .description('列出所有异常记录')
  .action(async (options) => {
    const where = options.status ? { status: options.status } : {}
    const exceptions = await exceptionService.getExceptions(where)
    console.log('\n⚠️  异常记录列表:')
    exceptions.forEach(e => {
      console.log(`  [${e.type}] [${e.status}] ${e.message}`)
      console.log(`      来源: ${e.source}, 时间: ${e.createdAt.toISOString()}`)
    })
    console.log(`  共 ${exceptions.length} 条异常记录\n`)
  })

listCmd
  .command('tasks')
  .option('--completed', '包含已完成任务')
  .description('列出待处理任务')
  .action(async (options) => {
    const filters = options.completed ? {} : { completed: false }
    const tasks = await exceptionService.getPendingTasks(filters)
    console.log('\n📝 待处理任务列表:')
    tasks.forEach(t => {
      const status = t.completedAt ? '✅ 已完成' : '⏳ 待处理'
      console.log(`  [${status}] [${t.type}] ${t.title}`)
      if (t.description) console.log(`      ${t.description}`)
    })
    console.log(`  共 ${tasks.length} 个任务\n`)
  })

const showCmd = program.command('show').description('查看详情')

showCmd
  .command('delivery <deliveryNo>')
  .description('查看收货单详情')
  .action(async (deliveryNo) => {
    const delivery = await deliveryService.getDeliveryByNo(deliveryNo)
    if (!delivery) {
      console.error(`❌ 收货单 ${deliveryNo} 不存在`)
      return
    }
    console.log(`\n📦 收货单详情: ${delivery.deliveryNo}`)
    console.log(`   供应商: ${delivery.supplier.name} (${delivery.supplier.code})`)
    console.log(`   状态: ${delivery.status}`)
    console.log(`   发货日期: ${delivery.deliveryDate.toISOString().split('T')[0]}`)
    console.log('\n   明细:')
    delivery.items.forEach(item => {
      const diff = item.differenceQty > 0 ? `(短缺 ${item.differenceQty})` : 
                   item.differenceQty < 0 ? `(多送 ${Math.abs(item.differenceQty)})` : ''
      console.log(`     - ${item.product.sku} ${item.product.name}`)
      console.log(`       预期: ${item.expectedQty}, 实收: ${item.receivedQty} ${diff}`)
      console.log(`       单价: ¥${item.unitPrice}, 金额: ¥${item.amount}`)
    })
    if (delivery.inspection) {
      console.log(`\n   质检单: ${delivery.inspection.inspectionNo}`)
    }
    if (delivery.claim) {
      console.log(`   索赔单: ${delivery.claim.claimNo}`)
    }
    console.log('')
  })

showCmd
  .command('claim <claimNo>')
  .description('查看索赔单详情')
  .action(async (claimNo) => {
    const claim = await claimService.getClaimByNo(claimNo)
    if (!claim) {
      console.error(`❌ 索赔单 ${claimNo} 不存在`)
      return
    }
    console.log(`\n📋 索赔单详情: ${claim.claimNo}`)
    console.log(`   供应商: ${claim.supplier.name}`)
    console.log(`   状态: ${claim.status}`)
    console.log(`   总短缺: ${claim.totalShortageQty} 件`)
    console.log(`   总缺陷: ${claim.totalDefectQty} 件`)
    console.log(`   总索赔金额: ¥${claim.totalClaimAmount}`)
    console.log('\n   明细:')
    claim.items.forEach(item => {
      console.log(`     - ${item.product.sku} ${item.product.name}`)
      console.log(`       责任方: ${item.responsibility}`)
      console.log(`       短缺: ${item.shortageQty}, 缺陷: ${item.defectQty}`)
      console.log(`       单价: ¥${item.unitPrice}, 索赔金额: ¥${item.claimAmount}`)
    })
    if (claim.supplierConfirmedAt) {
      console.log(`\n   供应商确认: ${claim.supplierConfirmedAt.toISOString().split('T')[0]}`)
      console.log(`   确认备注: ${claim.supplierConfirmRemark || '无'}`)
    }
    if (claim.deductionReceiptNo) {
      console.log(`\n   扣款回执: ${claim.deductionReceiptNo}`)
      console.log(`   回执日期: ${claim.deductionReceiptDate?.toISOString().split('T')[0]}`)
    }
    console.log('')
  })

showCmd
  .command('claim-report <claimNo>')
  .description('生成索赔报表')
  .action(async (claimNo) => {
    const claim = await claimService.getClaimByNo(claimNo)
    if (!claim) {
      console.error(`❌ 索赔单 ${claimNo} 不存在`)
      return
    }
    const report = await claimService.generateClaimReport(claim.id)
    
    console.log('\n' + '='.repeat(60))
    console.log('                  到货短缺索赔报表')
    console.log('='.repeat(60))
    console.log(`\n索赔单号: ${report.claimNo}`)
    console.log(`状态: ${report.status}`)
    console.log(`创建日期: ${report.createdAt.toISOString().split('T')[0]}`)
    console.log(`\n供应商: ${report.supplier.name} (${report.supplier.code})`)
    console.log(`收货单号: ${report.delivery.deliveryNo}`)
    if (report.delivery.poNo) console.log(`采购单号: ${report.delivery.poNo}`)
    console.log(`发货日期: ${report.delivery.deliveryDate.toISOString().split('T')[0]}`)
    console.log('\n' + '-'.repeat(60))
    console.log('索赔明细:')
    console.log('-'.repeat(60))
    console.log(`产品SKU      名称          责任方      短缺  缺陷   单价   索赔金额`)
    console.log('-'.repeat(60))
    report.items.forEach(item => {
      console.log(`${item.product.sku.padEnd(12)} ${item.product.name.slice(0,12).padEnd(12)} ${item.responsibility.padEnd(10)} ${String(item.shortageQty).padStart(4)} ${String(item.defectQty).padStart(5)} ¥${String(item.unitPrice).padStart(6)} ¥${item.claimAmount.toFixed(2).padStart(8)}`)
    })
    console.log('-'.repeat(60))
    console.log(`合计:                      短缺 ${report.totals.totalShortageQty} 件, 缺陷 ${report.totals.totalDefectQty} 件, 总金额 ¥${report.totals.totalClaimAmount.toFixed(2)}`)
    console.log('-'.repeat(60))
    
    if (report.supplierConfirmation) {
      console.log(`\n供应商确认: ${report.supplierConfirmation.confirmedAt.toISOString().split('T')[0]}`)
      if (report.supplierConfirmation.remark) {
        console.log(`确认备注: ${report.supplierConfirmation.remark}`)
      }
    }
    
    if (report.deductionReceipt) {
      console.log(`\n扣款回执: ${report.deductionReceipt.receiptNo}`)
      console.log(`回执日期: ${report.deductionReceipt.receiptDate.toISOString().split('T')[0]}`)
    }
    
    if (report.settledAt) {
      console.log(`\n结算日期: ${report.settledAt.toISOString().split('T')[0]}`)
    }
    
    console.log('='.repeat(60) + '\n')
  })

const workflowCmd = program.command('workflow').description('执行工作流')

workflowCmd
  .command('demo-normal')
  .description('演示正常索赔流程')
  .action(async () => {
    console.log('\n🎬 开始演示正常索赔流程...\n')
    
    const suppliers = await prisma.supplier.findMany({ take: 1 })
    const products = await prisma.product.findMany({ take: 2 })
    
    if (suppliers.length === 0 || products.length === 0) {
      console.error('❌ 请先运行 npm run db:seed 创建测试数据')
      return
    }
    
    const supplier = suppliers[0]
    const product1 = products[0]
    const product2 = products[1] || products[0]
    
    console.log('步骤 1: 创建收货单（模拟到货短缺）')
    const delivery = await deliveryService.createDelivery({
      deliveryNo: 'DN-DEMO-' + Date.now(),
      supplierId: supplier.id,
      poNo: 'PO-DEMO-001',
      deliveryDate: new Date(),
      items: [
        {
          productId: product1.id,
          expectedQty: 100,
          receivedQty: 95,
          unitPrice: product1.unitPrice
        },
        {
          productId: product2.id,
          expectedQty: 50,
          receivedQty: 50,
          unitPrice: product2.unitPrice
        }
      ]
    })
    console.log(`   ✅ 收货单 ${delivery.deliveryNo} 已创建`)
    console.log(`      ${product1.sku}: 预期 100, 实收 95 (短缺 5)`)
    console.log(`      ${product2.sku}: 预期 50, 实收 50\n`)
    
    console.log('步骤 2: 创建质检单（发现质量缺陷）')
    const inspection = await inspectionService.createInspection({
      deliveryId: delivery.id,
      inspectionNo: 'INSP-DEMO-' + Date.now(),
      inspector: 'CLI测试员',
      items: delivery.items.map(item => ({
        deliveryItemId: item.id,
        inspectedQty: item.receivedQty,
        qualifiedQty: item.productId === product1.id ? item.receivedQty - 2 : item.receivedQty,
        defectQty: item.productId === product1.id ? 2 : 0
      }))
    })
    console.log(`   ✅ 质检单 ${inspection.inspectionNo} 已创建`)
    console.log(`      ${product1.sku}: 检验 95, 合格 93, 缺陷 2\n`)
    
    console.log('步骤 3: 生成索赔草稿')
    const draft = await claimService.generateClaimDraft(delivery.id)
    console.log(`   ✅ 索赔草稿已生成`)
    console.log(`      索赔总金额: ¥${draft.summary.totalClaimAmount}`)
    console.log(`      涉及产品: ${draft.items.length} 个\n`)
    
    console.log('步骤 4: 创建正式索赔单')
    const claim = await claimService.createClaim({
      claimNo: 'CLM-DEMO-' + Date.now(),
      deliveryId: delivery.id,
      supplierId: supplier.id,
      items: draft.items
    })
    console.log(`   ✅ 索赔单 ${claim.claimNo} 已创建`)
    console.log(`      状态: ${claim.status}\n`)
    
    console.log('步骤 5: 提交索赔单')
    const submittedClaim = await claimService.submitClaim(claim.id)
    console.log(`   ✅ 索赔单已提交`)
    console.log(`      状态: ${submittedClaim.status}\n`)
    
    console.log('步骤 6: 供应商确认')
    const confirmedClaim = await claimService.confirmBySupplier(claim.id, '同意赔偿短缺和质量缺陷')
    console.log(`   ✅ 供应商已确认`)
    console.log(`      状态: ${confirmedClaim.status}\n`)
    
    console.log('步骤 7: 记录扣款回执并结算')
    const settledClaim = await claimService.recordDeductionReceipt(
      claim.id,
      'DR-DEMO-' + Date.now(),
      new Date()
    )
    console.log(`   ✅ 已记录扣款回执，索赔已结算`)
    console.log(`      状态: ${settledClaim.status}`)
    console.log(`      扣款单号: ${settledClaim.deductionReceiptNo}\n`)
    
    console.log('步骤 8: 生成索赔报表')
    const report = await claimService.generateClaimReport(claim.id)
    console.log('   ✅ 索赔报表:')
    console.log(`      索赔单号: ${report.claimNo}`)
    console.log(`      总金额: ¥${report.totals.totalClaimAmount}`)
    console.log(`      状态: ${report.status}\n`)
    
    console.log('🎉 正常索赔流程演示完成！')
    console.log(`   索赔单号: ${claim.claimNo}`)
    console.log(`   最终状态: SETTLED\n`)
  })

workflowCmd
  .command('demo-exception')
  .description('演示异常流程和异常记录')
  .action(async () => {
    console.log('\n🎬 开始演示异常流程...\n')
    
    const suppliers = await prisma.supplier.findMany({ take: 1 })
    const products = await prisma.product.findMany({ take: 1 })
    
    if (suppliers.length === 0 || products.length === 0) {
      console.error('❌ 请先运行 npm run db:seed 创建测试数据')
      return
    }
    
    const supplier = suppliers[0]
    const product = products[0]
    
    console.log('步骤 1: 创建有问题的收货单（多送货物）')
    console.log('   (多送货物会触发异常记录)')
    
    const delivery = await deliveryService.createDelivery({
      deliveryNo: 'DN-EXC-' + Date.now(),
      supplierId: supplier.id,
      poNo: 'PO-EXC-001',
      deliveryDate: new Date(),
      items: [
        {
          productId: product.id,
          expectedQty: 100,
          receivedQty: 105,
          unitPrice: product.unitPrice
        }
      ]
    })
    console.log(`   ✅ 收货单 ${delivery.deliveryNo} 已创建`)
    console.log(`      ${product.sku}: 预期 100, 实收 105 (多送 5)\n`)
    
    console.log('步骤 2: 查看异常记录')
    const exceptions = await exceptionService.getExceptions({ deliveryId: delivery.id })
    if (exceptions.length > 0) {
      console.log(`   ⚠️  发现 ${exceptions.length} 条异常记录:`)
      exceptions.forEach(e => {
        console.log(`      [${e.type}] ${e.message}`)
      })
    } else {
      console.log('   ℹ️  暂无异常记录')
    }
    console.log('')
    
    console.log('步骤 3: 查看待处理任务')
    const tasks = await exceptionService.getPendingTasks({ source: 'Delivery', completed: false })
    const relevantTasks = tasks.filter(t => t.sourceId === delivery.id)
    if (relevantTasks.length > 0) {
      console.log(`   📝 发现 ${relevantTasks.length} 个待处理任务:`)
      relevantTasks.forEach(t => {
        console.log(`      [${t.type}] ${t.title}`)
      })
    } else {
      console.log('   ℹ️  暂无待处理任务')
    }
    console.log('')
    
    console.log('步骤 4: 尝试违规操作（索赔数量超过实际短缺）')
    console.log('   (这将触发异常并记录)')
    
    try {
      await claimService.createClaim({
        claimNo: 'CLM-EXC-' + Date.now(),
        deliveryId: delivery.id,
        supplierId: supplier.id,
        items: [
          {
            deliveryItemId: delivery.items[0].id,
            productId: product.id,
            responsibility: 'SUPPLIER',
            shortageQty: 20,
            defectQty: 0,
            unitPrice: product.unitPrice
          }
        ]
      })
    } catch (error) {
      console.log(`   ❌ 操作被阻止: ${error.message}`)
    }
    
    console.log('\n🎉 异常流程演示完成！')
    console.log('   边界数据已被捕获并进入异常记录\n')
  })

program.parseAsync(process.argv)
