import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const DATA_DIR = path.join(process.cwd(), '.firehose-data')

export const DATA_FILES = {
  HOSES: 'hoses.json',
  BORROW_RECORDS: 'borrow-records.json',
  DRYING_RECORDS: 'drying-records.json',
  PROBLEMS: 'problems.json',
  HISTORY: 'history.json',
  CONFIG: 'config.json'
}

export class Storage {
  constructor() {
    this.initialized = false
  }

  async ensureInit() {
    if (this.initialized) return
    
    try {
      await fs.access(DATA_DIR)
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true })
    }
    
    await Promise.all(
      Object.values(DATA_FILES).map(async (file) => {
        const filePath = path.join(DATA_DIR, file)
        try {
          await fs.access(filePath)
        } catch {
          await fs.writeFile(filePath, '[]')
        }
      })
    )
    
    this.initialized = true
  }

  async readData(fileName) {
    await this.ensureInit()
    const filePath = path.join(DATA_DIR, fileName)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content || '[]')
  }

  async writeData(fileName, data) {
    await this.ensureInit()
    const filePath = path.join(DATA_DIR, fileName)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  }

  async appendData(fileName, item) {
    const data = await this.readData(fileName)
    data.push(item)
    await this.writeData(fileName, data)
    return item
  }

  async getHoses() {
    return this.readData(DATA_FILES.HOSES)
  }

  async saveHoses(hoses) {
    await this.writeData(DATA_FILES.HOSES, hoses)
  }

  async addHose(hose) {
    return this.appendData(DATA_FILES.HOSES, hose)
  }

  async getHoseByNumber(number) {
    const hoses = await this.getHoses()
    return hoses.find(h => h.number === number)
  }

  async getBorrowRecords() {
    return this.readData(DATA_FILES.BORROW_RECORDS)
  }

  async saveBorrowRecords(records) {
    await this.writeData(DATA_FILES.BORROW_RECORDS, records)
  }

  async addBorrowRecord(record) {
    return this.appendData(DATA_FILES.BORROW_RECORDS, record)
  }

  async getDryingRecords() {
    return this.readData(DATA_FILES.DRYING_RECORDS)
  }

  async saveDryingRecords(records) {
    await this.writeData(DATA_FILES.DRYING_RECORDS, records)
  }

  async addDryingRecord(record) {
    return this.appendData(DATA_FILES.DRYING_RECORDS, record)
  }

  async getProblems() {
    return this.readData(DATA_FILES.PROBLEMS)
  }

  async saveProblems(problems) {
    await this.writeData(DATA_FILES.PROBLEMS, problems)
  }

  async addProblem(problem) {
    return this.appendData(DATA_FILES.PROBLEMS, problem)
  }

  async getHistory() {
    return this.readData(DATA_FILES.HISTORY)
  }

  async saveHistory(history) {
    await this.writeData(DATA_FILES.HISTORY, history)
  }

  async addHistory(record) {
    return this.appendData(DATA_FILES.HISTORY, record)
  }
}

export const storage = new Storage()
