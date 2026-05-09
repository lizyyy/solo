import fs from 'fs/promises'
import { HOSE_STATUS } from './models.js'
import { storage } from './storage.js'
import { ruleEngine, RULE_TYPE, SEVERITY } from './rules.js'

export class DataImporter {
  constructor() {
    this.stats = {
      imported: 0,
      skipped: 0,
      problems: 0
    }
  }

  async importHoses(filePath) {
    this.stats = { imported: 0, skipped: 0, problems: 0 }
    const content = await fs.readFile(filePath, 'utf-8')
    const rawData = JSON.parse(content)
    const existingHoses = await storage.getHoses()
    const hosesToAdd = []

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i]
      const source = `file:${filePath}:row:${i + 1}`

      const hose = {
        id: `HD-${Date.now()}-${i.toString().padStart(4, '0')}`,
        number: item.number || item.hoseNumber || '',
        name: item.name || item.hoseName || '',
        status: this.normalizeStatus(item.status) || HOSE_STATUS.STORAGE,
        location: item.location || '',
        notes: item.notes || ''
      }

      const validation = await ruleEngine.validateHose(hose, source)
      
      if (!validation.valid) {
        this.stats.problems++
        continue
      }

      if (existingHoses.find(h => h.number === hose.number)) {
        await ruleEngine.addProblem(
          RULE_TYPE.HOSE_NUMBER_UNIQUE,
          SEVERITY.WARNING,
          `水带编号已存在，跳过导入: ${hose.number}`,
          source,
          { item, hose }
        )
        this.stats.skipped++
        continue
      }

      hosesToAdd.push(hose)
      this.stats.imported++
    }

    await storage.saveHoses([...existingHoses, ...hosesToAdd])
    await ruleEngine.addHistory('IMPORT_HOSES', `从 ${filePath} 导入 ${hosesToAdd.length} 条水带记录`)

    return { ...this.stats, added: hosesToAdd.length }
  }

  async importBorrowRecords(filePath) {
    this.stats = { imported: 0, skipped: 0, problems: 0 }
    const content = await fs.readFile(filePath, 'utf-8')
    const rawData = JSON.parse(content)
    const hoses = await storage.getHoses()
    const existingRecords = await storage.getBorrowRecords()
    const recordsToAdd = []

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i]
      const source = `file:${filePath}:row:${i + 1}`

      const hoseNumber = item.hoseNumber || item.number
      const hose = hoses.find(h => h.number === hoseNumber)

      if (!hose) {
        await ruleEngine.addProblem(
          RULE_TYPE.BORROW_RETURN,
          SEVERITY.ERROR,
          `借用记录引用了不存在的水带编号: ${hoseNumber}`,
          source,
          { item }
        )
        this.stats.problems++
        continue
      }

      const record = {
        id: `BOR-${Date.now()}-${i.toString().padStart(4, '0')}`,
        hoseId: hose.id,
        borrowDate: item.borrowDate || new Date().toISOString(),
        purpose: item.purpose || '',
        borrower: item.borrower || '',
        returnDate: item.returnDate || null
      }

      recordsToAdd.push(record)
      this.stats.imported++
    }

    await storage.saveBorrowRecords([...existingRecords, ...recordsToAdd])
    await ruleEngine.addHistory('IMPORT_BORROW', `从 ${filePath} 导入 ${recordsToAdd.length} 条借用记录`)

    return { ...this.stats, added: recordsToAdd.length }
  }

  async importDryingRecords(filePath) {
    this.stats = { imported: 0, skipped: 0, problems: 0 }
    const content = await fs.readFile(filePath, 'utf-8')
    const rawData = JSON.parse(content)
    const hoses = await storage.getHoses()
    const existingRecords = await storage.getDryingRecords()
    const recordsToAdd = []

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i]
      const source = `file:${filePath}:row:${i + 1}`

      const hoseNumber = item.hoseNumber || item.number
      const hose = hoses.find(h => h.number === hoseNumber)

      if (!hose) {
        await ruleEngine.addProblem(
          RULE_TYPE.DRYING_REQUIRED,
          SEVERITY.ERROR,
          `晾晒记录引用了不存在的水带编号: ${hoseNumber}`,
          source,
          { item }
        )
        this.stats.problems++
        continue
      }

      const record = {
        id: `DRY-${Date.now()}-${i.toString().padStart(4, '0')}`,
        hoseId: hose.id,
        startDate: item.startDate || new Date().toISOString(),
        endDate: item.endDate || null,
        isComplete: item.isComplete !== undefined ? item.isComplete : !!item.endDate
      }

      recordsToAdd.push(record)
      this.stats.imported++
    }

    await storage.saveDryingRecords([...existingRecords, ...recordsToAdd])
    await ruleEngine.addHistory('IMPORT_DRYING', `从 ${filePath} 导入 ${recordsToAdd.length} 条晾晒记录`)

    return { ...this.stats, added: recordsToAdd.length }
  }

  normalizeStatus(status) {
    if (!status) return null
    const statusMap = {
      '潮湿': HOSE_STATUS.WET,
      'wet': HOSE_STATUS.WET,
      'WET': HOSE_STATUS.WET,
      '晾晒中': HOSE_STATUS.DRYING,
      'drying': HOSE_STATUS.DRYING,
      'DRYING': HOSE_STATUS.DRYING,
      '已晾干': HOSE_STATUS.DRY,
      'dry': HOSE_STATUS.DRY,
      'DRY': HOSE_STATUS.DRY,
      '已归仓': HOSE_STATUS.STORAGE,
      'storage': HOSE_STATUS.STORAGE,
      'STORAGE': HOSE_STATUS.STORAGE
    }
    return statusMap[status] || status
  }
}

export const importer = new DataImporter()
