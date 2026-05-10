const prisma = require('../lib/prisma')

async function main() {
  console.log('🗑️  开始重置数据库...')

  await prisma.pendingTask.deleteMany({})
  await prisma.exceptionRecord.deleteMany({})
  await prisma.claimItem.deleteMany({})
  await prisma.claim.deleteMany({})
  await prisma.inspectionItem.deleteMany({})
  await prisma.inspection.deleteMany({})
  await prisma.deliveryItem.deleteMany({})
  await prisma.delivery.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.supplier.deleteMany({})

  console.log('✅ 数据库已重置')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
