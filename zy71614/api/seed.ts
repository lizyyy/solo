import 'reflect-metadata'
import { AppDataSource, initDatabase } from './database.js'
import { SettlementTask } from './entities/SettlementTask.js'
import { BoxOfficeRecord } from './entities/BoxOfficeRecord.js'
import { ShowSession } from './entities/ShowSession.js'
import { FilmContract } from './entities/FilmContract.js'
import { VersionHistory } from './entities/VersionHistory.js'

async function seed() {
  await initDatabase()

  const taskRepo = AppDataSource.getRepository(SettlementTask)
  const recordRepo = AppDataSource.getRepository(BoxOfficeRecord)
  const sessionRepo = AppDataSource.getRepository(ShowSession)
  const contractRepo = AppDataSource.getRepository(FilmContract)
  const versionRepo = AppDataSource.getRepository(VersionHistory)

  const existing = await taskRepo.find()
  if (existing.length > 0) {
    console.log('Database already seeded, skipping...')
    process.exit(0)
  }

  const task = taskRepo.create({
    name: '2025年1月票房分账核对',
    status: 'processing',
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    totalGross: 0,
    totalRefund: 0,
    totalCoupon: 0,
    netGross: 0,
    totalSettlement: 0,
    errorCount: 0,
    currentVersion: 1,
  })
  const savedTask = await taskRepo.save(task)

  const sessions = [
    { showCode: 'SH001', filmName: '流浪地球3', showTime: '2025-01-05 14:00', hallName: '1号厅' },
    { showCode: 'SH002', filmName: '哪吒之魔童闹海', showTime: '2025-01-06 16:30', hallName: '2号厅' },
    { showCode: 'SH003', filmName: '唐人街探案4', showTime: '2025-01-07 19:00', hallName: '3号厅', isSpecial: true, specialType: '首映场' },
    { showCode: 'SH004', filmName: '流浪地球3', showTime: '2025-01-08 20:00', hallName: '1号厅' },
    { showCode: 'SH005', filmName: '哪吒之魔童闹海', showTime: '2025-01-09 15:00', hallName: '2号厅' },
  ]

  const savedSessions: ShowSession[] = []
  for (const s of sessions) {
    const session = sessionRepo.create({ ...s, isSpecial: s.isSpecial ?? false, specialType: s.specialType ?? null, contractId: null, task: savedTask })
    savedSessions.push(await sessionRepo.save(session))
  }

  const contracts = [
    { filmName: '流浪地球3', distributor: '中影集团', shareRatio: 0.43, minimumGuarantee: 50000, isTiered: false, tierRules: null },
    { filmName: '哪吒之魔童闹海', distributor: '光线影业', shareRatio: 0.40, minimumGuarantee: null, isTiered: false, tierRules: null },
    { filmName: '唐人街探案4', distributor: '万达影视', shareRatio: 0.38, minimumGuarantee: 30000, isTiered: true, tierRules: JSON.stringify([
      { threshold: 100000, ratio: 0.35 },
      { threshold: 200000, ratio: 0.38 },
      { threshold: 0, ratio: 0.42 },
    ]) },
  ]

  const savedContracts: FilmContract[] = []
  for (const c of contracts) {
    const contract = contractRepo.create({ ...c, task: savedTask })
    savedContracts.push(await contractRepo.save(contract))
  }

  for (const sc of savedSessions) {
    const matchedContract = savedContracts.find((c) => c.filmName === sc.filmName)
    if (matchedContract) {
      sc.contractId = matchedContract.id
      await sessionRepo.save(sc)
    }
  }

  const records = [
    { ticketNo: 'T001', showCode: 'SH001', filmName: '流浪地球3', showTime: '2025-01-05 14:00', ticketAmount: 80, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T002', showCode: 'SH001', filmName: '流浪地球3', showTime: '2025-01-05 14:00', ticketAmount: 60, refundAmount: 0, couponAmount: 10 },
    { ticketNo: 'T003', showCode: 'SH002', filmName: '哪吒之魔童闹海', showTime: '2025-01-06 16:30', ticketAmount: 90, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T004', showCode: 'SH002', filmName: '哪吒之魔童闹海', showTime: '2025-01-06 16:30', ticketAmount: 70, refundAmount: 5, couponAmount: 0 },
    { ticketNo: 'T005', showCode: 'SH003', filmName: '唐人街探案4', showTime: '2025-01-07 19:00', ticketAmount: 100, refundAmount: 0, couponAmount: 15 },
    { ticketNo: 'T006', showCode: 'SH003', filmName: '唐人街探案4', showTime: '2025-01-07 19:00', ticketAmount: 80, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T007', showCode: 'SH004', filmName: '流浪地球3', showTime: '2025-01-08 20:00', ticketAmount: 75, refundAmount: 0, couponAmount: 5 },
    { ticketNo: 'T008', showCode: 'SH005', filmName: '哪吒之魔童闹海', showTime: '2025-01-09 15:00', ticketAmount: 85, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T009', showCode: 'SH004', filmName: '流浪地球3', showTime: '2025-01-08 20:00', ticketAmount: 65, refundAmount: 0, couponAmount: 10 },
    { ticketNo: 'T010', showCode: 'SH001', filmName: '流浪地球3', showTime: '2025-01-05 14:00', ticketAmount: 55, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T011', showCode: 'SH003', filmName: '唐人街探案4', showTime: '2025-01-07 19:00', ticketAmount: 50, refundAmount: 80, couponAmount: 0 },
    { ticketNo: 'T012', showCode: 'SH002', filmName: '哪吒之魔童闹海', showTime: '2025-01-06 16:30', ticketAmount: 40, refundAmount: 0, couponAmount: 45 },
    { ticketNo: 'T013', showCode: 'SH999', filmName: '封神第二部', showTime: '2025-01-10 18:00', ticketAmount: 95, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T014', showCode: 'SH001', filmName: '流浪地球3', showTime: '2025-01-05 14:00', ticketAmount: 70, refundAmount: 0, couponAmount: 0 },
    { ticketNo: 'T015', showCode: 'SH005', filmName: '哪吒之魔童闹海', showTime: '2025-01-09 15:00', ticketAmount: 88, refundAmount: 3, couponAmount: 0 },
  ]

  for (const r of records) {
    const netAmount = r.ticketAmount - r.refundAmount - r.couponAmount
    let recordStatus = 'normal'
    let errorMessage: string | null = null
    let diffNote: string | null = null

    if (r.refundAmount > r.ticketAmount) {
      recordStatus = 'warning'
      diffNote = '退票漏扣: 退款金额大于票面金额'
    }

    if (r.couponAmount > r.ticketAmount) {
      recordStatus = 'error'
      errorMessage = '券抵扣误算: 券金额大于票面金额'
    }

    if (!sessions.find((s) => s.showCode === r.showCode)) {
      recordStatus = 'error'
      errorMessage = `场次映射错: showCode ${r.showCode} 未找到对应场次`
    }

    const record = recordRepo.create({
      ...r,
      netAmount,
      recordStatus,
      errorMessage,
      diffNote,
      mapped: false,
      sessionId: null,
      contractId: null,
      diffHash: null,
      task: savedTask,
    })
    await recordRepo.save(record)
  }

  const vh1 = versionRepo.create({
    version: 1,
    snapshotJson: JSON.stringify({ name: savedTask.name, status: 'draft', currentVersion: 1 }),
    operation: 'create',
    operator: 'system',
    remark: '初始创建',
    task: savedTask,
  })
  await versionRepo.save(vh1)

  const allRecords = await recordRepo.find({ where: { task: { id: savedTask.id } } })
  savedTask.totalGross = allRecords.reduce((s, r) => s + r.ticketAmount, 0)
  savedTask.totalRefund = allRecords.reduce((s, r) => s + r.refundAmount, 0)
  savedTask.totalCoupon = allRecords.reduce((s, r) => s + r.couponAmount, 0)
  savedTask.netGross = allRecords.reduce((s, r) => s + r.netAmount, 0)
  savedTask.errorCount = allRecords.filter((r) => r.recordStatus === 'error').length
  await taskRepo.save(savedTask)

  console.log('Seed data created successfully!')
  console.log(`Task: ${savedTask.id}`)
  console.log(`Sessions: ${savedSessions.length}`)
  console.log(`Contracts: ${savedContracts.length}`)
  console.log(`Records: ${allRecords.length}`)
  console.log(`Anomalies: T011 (退票漏扣), T012 (券抵扣误算), T013 (场次映射错)`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
