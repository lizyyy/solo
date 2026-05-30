import { AppDataSource } from '../database.js'
import { SettlementTask } from '../entities/SettlementTask.js'
import { VersionHistory } from '../entities/VersionHistory.js'
import { BoxOfficeRecord } from '../entities/BoxOfficeRecord.js'
import { ShowSession } from '../entities/ShowSession.js'
import { FilmContract } from '../entities/FilmContract.js'
import { SettlementResult } from '../entities/SettlementResult.js'

const taskRepo = () => AppDataSource.getRepository(SettlementTask)
const versionRepo = () => AppDataSource.getRepository(VersionHistory)

const VALID_STATUSES = ['draft', 'processing', 'pending_material', 'completed', 'cancelled']

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['processing', 'cancelled'],
  processing: ['pending_material', 'completed', 'cancelled'],
  pending_material: ['processing', 'cancelled'],
  completed: ['cancelled'],
  cancelled: [],
}

function canTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

async function createSnapshot(task: SettlementTask, operation: string, remark?: string): Promise<void> {
  const fullTask = await taskRepo().findOne({
    where: { id: task.id },
    relations: { boxOfficeRecords: true, showSessions: true, filmContracts: true, settlementResults: true },
  })
  if (!fullTask) return

  const snapshot = {
    name: fullTask.name,
    status: fullTask.status,
    periodStart: fullTask.periodStart,
    periodEnd: fullTask.periodEnd,
    totalGross: fullTask.totalGross,
    totalRefund: fullTask.totalRefund,
    totalCoupon: fullTask.totalCoupon,
    netGross: fullTask.netGross,
    totalSettlement: fullTask.totalSettlement,
    errorCount: fullTask.errorCount,
    currentVersion: fullTask.currentVersion,
    boxOfficeRecords: fullTask.boxOfficeRecords,
    showSessions: fullTask.showSessions,
    filmContracts: fullTask.filmContracts,
    settlementResults: fullTask.settlementResults,
  }

  const vh = versionRepo().create({
    version: fullTask.currentVersion,
    snapshotJson: JSON.stringify(snapshot),
    operation,
    remark: remark ?? null,
    task: fullTask,
  })
  await versionRepo().save(vh)
}

export async function listTasks(): Promise<SettlementTask[]> {
  return taskRepo().find({ order: { createdAt: 'DESC' } })
}

export async function getTaskById(id: string): Promise<SettlementTask | null> {
  return taskRepo().findOne({
    where: { id },
    relations: { boxOfficeRecords: true, showSessions: true, filmContracts: true, settlementResults: true, versionHistories: true },
  })
}

export async function createTask(data: Partial<SettlementTask>): Promise<SettlementTask> {
  const task = taskRepo().create({
    ...data,
    status: data.status ?? 'draft',
    totalGross: 0,
    totalRefund: 0,
    totalCoupon: 0,
    netGross: 0,
    totalSettlement: 0,
    errorCount: 0,
    currentVersion: 1,
  })
  return taskRepo().save(task)
}

export async function updateTask(id: string, data: Partial<SettlementTask>): Promise<SettlementTask | null> {
  const task = await taskRepo().findOne({ where: { id } })
  if (!task) return null

  if (data.status && data.status !== task.status) {
    if (!canTransition(task.status, data.status)) {
      throw new Error(`Cannot transition from ${task.status} to ${data.status}`)
    }
  }

  await createSnapshot(task, 'update', `Version ${task.currentVersion} saved`)

  Object.assign(task, data)
  task.currentVersion += 1
  return taskRepo().save(task)
}

export async function withdrawTask(id: string): Promise<SettlementTask | null> {
  const task = await taskRepo().findOne({ where: { id } })
  if (!task) return null

  if (task.currentVersion <= 1) {
    throw new Error('No previous version to withdraw to')
  }

  const versions = await versionRepo().find({
    where: { task: { id: task.id } },
    order: { version: 'DESC' },
  })

  if (versions.length === 0) {
    throw new Error('No version history found')
  }

  const prevVersion = versions[0]
  const snapshot = JSON.parse(prevVersion.snapshotJson)

  const boxOfficeRepo = AppDataSource.getRepository(BoxOfficeRecord)
  const sessionRepo = AppDataSource.getRepository(ShowSession)
  const contractRepo = AppDataSource.getRepository(FilmContract)
  const resultRepo = AppDataSource.getRepository(SettlementResult)

  await boxOfficeRepo.delete({ task: { id: task.id } })
  await sessionRepo.delete({ task: { id: task.id } })
  await contractRepo.delete({ task: { id: task.id } })
  await resultRepo.delete({ task: { id: task.id } })

  task.name = snapshot.name
  task.status = snapshot.status
  task.periodStart = snapshot.periodStart
  task.periodEnd = snapshot.periodEnd
  task.totalGross = snapshot.totalGross
  task.totalRefund = snapshot.totalRefund
  task.totalCoupon = snapshot.totalCoupon
  task.netGross = snapshot.netGross
  task.totalSettlement = snapshot.totalSettlement
  task.errorCount = snapshot.errorCount
  task.currentVersion = snapshot.currentVersion

  const savedTask = await taskRepo().save(task)

  if (snapshot.boxOfficeRecords?.length) {
    const records = snapshot.boxOfficeRecords.map((r: any) => {
      const { id: _, task: __, createdAt: ___, ...rest } = r
      return boxOfficeRepo.create({ ...rest, task: savedTask })
    })
    await boxOfficeRepo.save(records)
  }

  if (snapshot.showSessions?.length) {
    const sessions = snapshot.showSessions.map((s: any) => {
      const { id: _, task: __, ...rest } = s
      return sessionRepo.create({ ...rest, task: savedTask })
    })
    await sessionRepo.save(sessions)
  }

  if (snapshot.filmContracts?.length) {
    const contracts = snapshot.filmContracts.map((c: any) => {
      const { id: _, task: __, ...rest } = c
      return contractRepo.create({ ...rest, task: savedTask })
    })
    await contractRepo.save(contracts)
  }

  if (snapshot.settlementResults?.length) {
    const results = snapshot.settlementResults.map((r: any) => {
      const { id: _, task: __, contract: ___, ...rest } = r
      return resultRepo.create({ ...rest, task: savedTask })
    })
    await resultRepo.save(results)
  }

  await createSnapshot(savedTask, 'withdraw', `Withdrawn to version ${snapshot.currentVersion}`)

  return savedTask
}

export async function getTaskHistory(id: string): Promise<VersionHistory[]> {
  return versionRepo().find({
    where: { task: { id } },
    order: { version: 'DESC' },
  })
}

export async function resumeTask(id: string): Promise<SettlementTask | null> {
  const task = await taskRepo().findOne({ where: { id } })
  if (!task) return null

  if (task.status !== 'pending_material') {
    throw new Error(`Cannot resume from status ${task.status}, only from pending_material`)
  }

  await createSnapshot(task, 'resume', 'Resumed from pending_material')
  task.status = 'processing'
  task.currentVersion += 1
  return taskRepo().save(task)
}
