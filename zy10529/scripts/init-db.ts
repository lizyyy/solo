import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('初始化数据库...\n')

  console.log('清理现有数据...')
  await prisma.promotionReport.deleteMany()
  await prisma.correctionRecord.deleteMany()
  await prisma.exceptionRecord.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.approvalRecord.deleteMany()
  await prisma.signatureRecord.deleteMany()
  await prisma.testSummary.deleteMany()
  await prisma.promotionRecord.deleteMany()
  await prisma.artifactVersion.deleteMany()
  console.log('✓ 数据清理完成\n')

  console.log('创建示例数据...')

  const artifact = await prisma.artifactVersion.create({
    data: {
      artifactName: '示例服务',
      version: '1.0.0',
      buildNumber: '20240517001',
      commitHash: 'abc123def456789',
      buildBranch: 'release/1.0.0',
      buildTime: new Date(),
      artifactUrl: 'https://artifacts.example.com/service/1.0.0',
      checksum: 'sha256:abcdef123456789',
      checksumAlgorithm: 'SHA256'
    }
  })
  console.log('✓ 制品版本创建完成')

  const promotion = await prisma.promotionRecord.create({
    data: {
      artifactVersionId: artifact.id,
      fromEnvironment: 'TEST',
      toEnvironment: 'PRODUCTION',
      status: 'DRAFT',
      title: '示例服务v1.0.0生产环境晋级',
      description: '这是一个示例晋级申请，用于演示API功能',
      initiator: '示例用户',
      currentStep: 0,
      totalSteps: 4
    }
  })
  console.log('✓ 晋级记录创建完成')

  await prisma.auditLog.create({
    data: {
      promotionRecordId: promotion.id,
      action: '创建晋级申请',
      actionType: 'CREATE',
      performedBy: 'system',
      details: '初始化脚本创建示例数据'
    }
  })
  console.log('✓ 审计日志创建完成\n')

  console.log('=== 初始化完成 ===')
  console.log(`\n示例晋级ID: ${promotion.id}`)
  console.log(`示例制品ID: ${artifact.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
