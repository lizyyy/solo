import { PrismaClient, DataSource, LedgerStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始播种样例数据...')

  const ledgers = [
    {
      boxNo: 'BOX-2024-001',
      batchNo: 'BATCH-001',
      driverId: 'DRV-001',
      driverName: '张三',
      driverPhone: '13800138001',
      receiveDate: new Date('2024-01-15'),
      crossDaySign: false,
      boxNameChange: false,
      temperatureMin: -18,
      temperatureMax: -15,
      compensationAmount: 0,
      status: LedgerStatus.DRAFT,
      createdBy: 'warehouse_staff_01',
      changeReason: '初始建账',
    },
    {
      boxNo: 'BOX-2024-002',
      batchNo: 'BATCH-001',
      driverId: 'DRV-002',
      driverName: '李四',
      driverPhone: '13800138002',
      receiveDate: new Date('2024-01-15'),
      crossDaySign: true,
      boxNameChange: true,
      originalBoxNo: 'BOX-2024-002-OLD',
      temperatureMin: -20,
      temperatureMax: -12,
      compensationAmount: 500,
      status: LedgerStatus.SUBMITTED,
      createdBy: 'warehouse_staff_01',
      changeReason: '跨日签收需要核实',
    },
    {
      boxNo: 'BOX-2024-003',
      batchNo: 'BATCH-002',
      driverId: 'DRV-003',
      driverName: '王五',
      driverPhone: '13800138003',
      receiveDate: new Date('2024-01-14'),
      crossDaySign: false,
      boxNameChange: false,
      temperatureMin: -19,
      temperatureMax: -16,
      compensationAmount: 0,
      status: LedgerStatus.CONFIRMED,
      createdBy: 'warehouse_staff_02',
      confirmedBy: 'supervisor_01',
      confirmedAt: new Date('2024-01-16'),
      changeReason: '数据核实无误',
    },
    {
      boxNo: 'BOX-2024-004',
      batchNo: 'BATCH-002',
      driverId: 'DRV-001',
      driverName: '张三',
      driverPhone: '13800138001',
      receiveDate: new Date('2024-01-13'),
      crossDaySign: true,
      boxNameChange: false,
      temperatureMin: -25,
      temperatureMax: -10,
      compensationAmount: 1200,
      status: LedgerStatus.AUDITED,
      createdBy: 'warehouse_staff_01',
      confirmedBy: 'supervisor_01',
      confirmedAt: new Date('2024-01-14'),
      auditedBy: 'auditor_01',
      auditedAt: new Date('2024-01-15'),
      changeReason: '温度超标赔付已审计',
    },
    {
      boxNo: 'BOX-2024-005',
      batchNo: 'BATCH-003',
      driverId: 'DRV-002',
      driverName: '李四',
      driverPhone: '13800138002',
      receiveDate: new Date('2024-01-12'),
      crossDaySign: false,
      boxNameChange: true,
      originalBoxNo: 'BOX-TEMP-005',
      temperatureMin: -18,
      temperatureMax: -15,
      compensationAmount: 100,
      status: LedgerStatus.REJECTED,
      createdBy: 'warehouse_staff_02',
      rejectedBy: 'supervisor_01',
      rejectedAt: new Date('2024-01-13'),
      rejectionReason: '箱号变更需要原始单据佐证',
      changeReason: '待补充原始凭证',
    },
  ]

  for (const ledgerData of ledgers) {
    const ledger = await prisma.ledger.create({
      data: ledgerData,
    })

    console.log(`创建台账: ${ledger.boxNo} (${ledger.id})`)

    await prisma.statusHistory.create({
      data: {
        ledgerId: ledger.id,
        fromStatus: null,
        toStatus: LedgerStatus.DRAFT,
        changedBy: ledger.createdBy,
        changeReason: '初始建账',
        diffAfter: ledger,
      },
    })

    if (ledger.status !== LedgerStatus.DRAFT) {
      await prisma.statusHistory.create({
        data: {
          ledgerId: ledger.id,
          fromStatus: LedgerStatus.DRAFT,
          toStatus: ledger.status,
          changedBy: ledger.confirmedBy || ledger.rejectedBy || ledger.auditedBy || 'system',
          changeReason: ledger.changeReason || '状态变更',
        },
      })
    }

    await prisma.scanDetail.createMany({
      data: [
        {
          ledgerId: ledger.id,
          scanTime: new Date(ledger.receiveDate.getTime() - 3600000),
          scanLocation: '始发仓库A',
          operator: 'scan_op_01',
          temperature: -17,
          boxCondition: '完好',
        },
        {
          ledgerId: ledger.id,
          scanTime: new Date(ledger.receiveDate.getTime() + 3600000),
          scanLocation: '中转仓B',
          operator: 'scan_op_02',
          temperature: -16,
          boxCondition: '完好',
        },
      ],
    })

    if (ledger.boxNo === 'BOX-2024-002') {
      await prisma.failedRecord.create({
        data: {
          ledgerId: ledger.id,
          source: DataSource.TEMPERATURE_LOG,
          rawData: { temperature: 999, unit: 'invalid' },
          errorMessage: '温度数据超出有效范围',
        },
      })
    }

    await prisma.attachment.create({
      data: {
        ledgerId: ledger.id,
        source: DataSource.DRIVER_PHOTO,
        fileName: `${ledger.boxNo}_driver_sign.jpg`,
        fileUrl: `/attachments/${ledger.id}/${ledger.boxNo}_driver_sign.jpg`,
        fileHash: 'hash_' + Math.random().toString(36).substring(7),
        uploadedBy: ledger.createdBy,
      },
    })
  }

  console.log('样例数据播种完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
