import { AppDataSource } from '../database.js'
import { ShowSession } from '../entities/ShowSession.js'
import { BoxOfficeRecord } from '../entities/BoxOfficeRecord.js'
import { SettlementTask } from '../entities/SettlementTask.js'

const sessionRepo = () => AppDataSource.getRepository(ShowSession)
const recordRepo = () => AppDataSource.getRepository(BoxOfficeRecord)
const taskRepo = () => AppDataSource.getRepository(SettlementTask)

export async function importShowSessions(taskId: string, data: any[]): Promise<{ imported: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  let imported = 0
  let errors = 0

  for (const item of data) {
    try {
      const session = sessionRepo().create({
        showCode: item.showCode ?? '',
        filmName: item.filmName ?? '',
        showTime: item.showTime ?? '',
        hallName: item.hallName ?? '',
        isSpecial: item.isSpecial ?? false,
        specialType: item.specialType ?? null,
        contractId: item.contractId ?? null,
        task,
      })

      if (!session.showCode || !session.filmName || !session.showTime) {
        session.showCode = session.showCode || 'MISSING'
        session.filmName = session.filmName || 'MISSING'
        session.showTime = session.showTime || 'MISSING'
      }

      await sessionRepo().save(session)
      imported++
    } catch (err: any) {
      errors++
    }
  }

  return { imported, errors }
}

export async function mapSessions(taskId: string): Promise<{ mapped: number; unmapped: number; mismatches: number }> {
  const records = await recordRepo().find({ where: { task: { id: taskId } } })
  const sessions = await sessionRepo().find({ where: { task: { id: taskId } } })

  const sessionMap = new Map<string, ShowSession>()
  for (const s of sessions) {
    sessionMap.set(s.showCode, s)
  }

  let mapped = 0
  let unmapped = 0
  let mismatches = 0

  for (const record of records) {
    try {
      if (record.recordStatus === 'error') continue

      const session = sessionMap.get(record.showCode)
      if (!session) {
        record.recordStatus = 'error'
        record.errorMessage = `场次映射错: showCode ${record.showCode} 未找到对应场次`
        record.mapped = false
        unmapped++
        await recordRepo().save(record)
        continue
      }

      if (session.filmName !== record.filmName) {
        record.recordStatus = 'warning'
        record.diffNote = `片名不匹配: 记录=${record.filmName}, 场次=${session.filmName}`
        mismatches++
      }

      record.mapped = true
      record.sessionId = session.id
      record.contractId = session.contractId
      mapped++
      await recordRepo().save(record)
    } catch (err: any) {
      unmapped++
    }
  }

  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (task) {
    task.errorCount = (await recordRepo().find({ where: { task: { id: taskId } } })).filter((r) => r.recordStatus === 'error').length
    await taskRepo().save(task)
  }

  return { mapped, unmapped, mismatches }
}

export async function flagSpecialSession(sessionId: string, specialType: string): Promise<ShowSession | null> {
  const session = await sessionRepo().findOne({ where: { id: sessionId } })
  if (!session) return null
  session.isSpecial = true
  session.specialType = specialType
  return sessionRepo().save(session)
}
