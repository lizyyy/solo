import * as fs from 'fs'
import * as path from 'path'
import { Database, Task, Escort, IdempotencyRecord } from '../models/types'
import { createSensitiveLogger, maskTask, maskEscort } from '../utils/sensitiveMask'

const logger = createSensitiveLogger()

const DEFAULT_DATA_DIR = path.join(process.env.HOME || process.cwd(), '.clinic-escort')
const DEFAULT_DB_FILE = path.join(DEFAULT_DATA_DIR, 'database.json')

export class StorageService {
  private dbPath: string
  private cache: Database | null = null

  constructor(dbPath?: string) {
    this.dbPath = dbPath || DEFAULT_DB_FILE
    this.ensureDataDirectory()
  }

  private ensureDataDirectory(): void {
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.info('数据目录已创建', { directory: dir })
    }
  }

  private getDefaultDatabase(): Database {
    return {
      tasks: [],
      escorts: [],
      idempotencyRecords: [],
      lastUpdated: Date.now()
    }
  }

  public load(): Database {
    if (this.cache) {
      return { ...this.cache }
    }

    try {
      if (!fs.existsSync(this.dbPath)) {
        const defaultDb = this.getDefaultDatabase()
        this.save(defaultDb)
        logger.info('新建数据库文件')
        return defaultDb
      }

      const content = fs.readFileSync(this.dbPath, 'utf-8')
      const db = JSON.parse(content) as Database
      this.cache = db
      logger.info('数据库加载成功', { taskCount: db.tasks.length, escortCount: db.escorts.length })
      return db
    } catch (error) {
      logger.error('数据库加载失败，使用默认数据', error)
      return this.getDefaultDatabase()
    }
  }

  public save(db: Database): void {
    try {
      db.lastUpdated = Date.now()
      const content = JSON.stringify(db, null, 2)
      fs.writeFileSync(this.dbPath, content, 'utf-8')
      this.cache = { ...db }
    } catch (error) {
      logger.error('数据库保存失败', error)
      throw new Error('数据库保存失败')
    }
  }

  public saveBackup(): string {
    const db = this.load()
    const backupPath = `${this.dbPath}.backup.${Date.now()}`
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf-8')
    logger.info('数据库备份已创建', { backupPath })
    return backupPath
  }

  public getTasks(): Task[] {
    const db = this.load()
    return [...db.tasks]
  }

  public getTaskById(id: string): Task | undefined {
    const db = this.load()
    return db.tasks.find(t => t.id === id)
  }

  public saveTask(task: Task): void {
    const db = this.load()
    const index = db.tasks.findIndex(t => t.id === task.id)
    if (index >= 0) {
      db.tasks[index] = task
    } else {
      db.tasks.push(task)
    }
    this.save(db)
    logger.info('任务已保存', { taskId: task.id })
  }

  public getEscorts(): Escort[] {
    const db = this.load()
    return [...db.escorts]
  }

  public getEscortById(id: string): Escort | undefined {
    const db = this.load()
    return db.escorts.find(e => e.id === id)
  }

  public saveEscort(escort: Escort): void {
    const db = this.load()
    const index = db.escorts.findIndex(e => e.id === escort.id)
    if (index >= 0) {
      db.escorts[index] = escort
    } else {
      db.escorts.push(escort)
    }
    this.save(db)
    logger.info('陪检员已保存', { escortId: escort.id })
  }

  public getIdempotencyRecord(key: string): IdempotencyRecord | undefined {
    const db = this.load()
    return db.idempotencyRecords.find(r => r.key === key)
  }

  public saveIdempotencyRecord(record: IdempotencyRecord): void {
    const db = this.load()
    const existingIndex = db.idempotencyRecords.findIndex(r => r.key === record.key)
    if (existingIndex >= 0) {
      db.idempotencyRecords[existingIndex] = record
    } else {
      db.idempotencyRecords.push(record)
    }
    this.save(db)
  }

  public clearExpiredIdempotencyRecords(expireMs: number = 24 * 60 * 60 * 1000): number {
    const db = this.load()
    const now = Date.now()
    const originalCount = db.idempotencyRecords.length
    db.idempotencyRecords = db.idempotencyRecords.filter(
      r => now - r.createdAt < expireMs
    )
    const deletedCount = originalCount - db.idempotencyRecords.length
    if (deletedCount > 0) {
      this.save(db)
      logger.info('已清理过期幂等记录', { count: deletedCount })
    }
    return deletedCount
  }

  public exportData(exportPath: string, includeSensitive: boolean = false): void {
    const db = this.load()
    
    if (!includeSensitive) {
      const maskedDb = {
        ...db,
        tasks: db.tasks.map(task => maskTask(task)),
        escorts: db.escorts.map(escort => maskEscort(escort))
      }
      fs.writeFileSync(exportPath, JSON.stringify(maskedDb, null, 2), 'utf-8')
    } else {
      fs.writeFileSync(exportPath, JSON.stringify(db, null, 2), 'utf-8')
    }
    logger.info('数据已导出', { exportPath })
  }

  public importData(importPath: string): void {
    if (!fs.existsSync(importPath)) {
      throw new Error('导入文件不存在')
    }
    const content = fs.readFileSync(importPath, 'utf-8')
    const importedDb = JSON.parse(content) as Database
    
    this.saveBackup()
    
    const db = this.load()
    
    for (const task of importedDb.tasks) {
      const existing = db.tasks.find(t => t.id === task.id)
      if (!existing) {
        db.tasks.push(task)
      }
    }
    
    for (const escort of importedDb.escorts) {
      const existing = db.escorts.find(e => e.id === escort.id)
      if (!existing) {
        db.escorts.push(escort)
      }
    }
    
    for (const record of importedDb.idempotencyRecords) {
      const existing = db.idempotencyRecords.find(r => r.key === record.key)
      if (!existing) {
        db.idempotencyRecords.push(record)
      }
    }
    
    this.save(db)
    logger.info('数据导入成功')
  }

  public resetDatabase(): void {
    this.saveBackup()
    this.save(this.getDefaultDatabase())
    logger.warn('数据库已重置')
  }

  public getDbPath(): string {
    return this.dbPath
  }
}

export const storage = new StorageService()
