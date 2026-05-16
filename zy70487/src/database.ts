import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import { MessageRecord, BatchInfo, TempTicket, ReviewRecord } from './types'

interface DatabaseSchema {
  tempTickets: TempTicket[]
  messageRecords: MessageRecord[]
  batches: BatchInfo[]
  reviewRecords: ReviewRecord[]
}

const defaultData: DatabaseSchema = {
  tempTickets: [],
  messageRecords: [],
  batches: [],
  reviewRecords: []
}

const dbPath = join(process.cwd(), 'data', 'db.json')

class Database {
  private db: Low<DatabaseSchema>

  constructor() {
    const adapter = new JSONFile<DatabaseSchema>(dbPath)
    this.db = new Low(adapter, defaultData)
  }

  async init() {
    await this.db.read()
    if (!this.db.data) {
      this.db.data = defaultData
    }
    await this.db.write()
  }

  get data() {
    return this.db.data!
  }

  async write() {
    await this.db.write()
  }

  async saveTempTicket(ticket: TempTicket) {
    this.data.tempTickets.push(ticket)
    await this.write()
    return ticket
  }

  async findTempTicketById(id: string) {
    return this.data.tempTickets.find(t => t.id === id)
  }

  async findTempTicketByNo(ticketNo: string) {
    return this.data.tempTickets.find(t => t.ticketNo === ticketNo)
  }

  async saveBatch(batch: BatchInfo) {
    this.data.batches.push(batch)
    await this.write()
    return batch
  }

  async updateBatch(batchId: string, updates: Partial<BatchInfo>) {
    const index = this.data.batches.findIndex(b => b.id === batchId)
    if (index !== -1) {
      this.data.batches[index] = { ...this.data.batches[index], ...updates }
      await this.write()
    }
  }

  async findBatchById(id: string) {
    return this.data.batches.find(b => b.id === id)
  }

  async findAllBatches() {
    return [...this.data.batches]
  }

  async saveMessageRecord(record: MessageRecord) {
    this.data.messageRecords.push(record)
    await this.write()
    return record
  }

  async saveMessageRecords(records: MessageRecord[]) {
    this.data.messageRecords.push(...records)
    await this.write()
    return records
  }

  async updateMessageRecord(id: string, updates: Partial<MessageRecord>) {
    const index = this.data.messageRecords.findIndex(r => r.id === id)
    if (index !== -1) {
      this.data.messageRecords[index] = { ...this.data.messageRecords[index], ...updates }
      await this.write()
    }
  }

  async findMessageRecordsByBatch(batchId: string) {
    return this.data.messageRecords.filter(r => r.batchId === batchId)
  }

  async findMessageRecordById(id: string) {
    return this.data.messageRecords.find(r => r.id === id)
  }

  async findAllMessageRecords() {
    return [...this.data.messageRecords]
  }

  async saveReviewRecord(record: ReviewRecord) {
    this.data.reviewRecords.push(record)
    await this.write()
    return record
  }

  async findReviewRecordsByMessage(messageId: string) {
    return this.data.reviewRecords.filter(r => r.messageId === messageId)
  }
}

export const db = new Database()