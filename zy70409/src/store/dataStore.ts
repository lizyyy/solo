import * as fs from 'fs'
import * as path from 'path'
import {
  PurchaseInquiry,
  ReviewRule,
  AuditLog,
  ReviewResult,
  PermissionTicket,
  BatchOperation
} from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILES = {
  inquiries: path.join(DATA_DIR, 'inquiries.json'),
  rules: path.join(DATA_DIR, 'rules.json'),
  auditLogs: path.join(DATA_DIR, 'audit-logs.json'),
  reviewResults: path.join(DATA_DIR, 'review-results.json'),
  permissionTickets: path.join(DATA_DIR, 'permission-tickets.json'),
  batchOperations: path.join(DATA_DIR, 'batch-operations.json')
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDataDir()
  if (!fs.existsSync(filePath)) {
    return defaultValue
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export class DataStore {
  static getInquiries(): PurchaseInquiry[] {
    return readJsonFile(FILES.inquiries, [])
  }

  static saveInquiries(inquiries: PurchaseInquiry[]): void {
    writeJsonFile(FILES.inquiries, inquiries)
  }

  static addInquiry(inquiry: PurchaseInquiry): void {
    const inquiries = this.getInquiries()
    inquiries.push(inquiry)
    this.saveInquiries(inquiries)
  }

  static getInquiryById(id: string): PurchaseInquiry | undefined {
    return this.getInquiries().find(i => i.id === id)
  }

  static getInquiriesByBatch(batchId: string): PurchaseInquiry[] {
    return this.getInquiries().filter(i => i.batchId === batchId)
  }

  static getRules(): ReviewRule[] {
    return readJsonFile(FILES.rules, [])
  }

  static saveRules(rules: ReviewRule[]): void {
    writeJsonFile(FILES.rules, rules)
  }

  static addRule(rule: ReviewRule): void {
    const rules = this.getRules()
    rules.push(rule)
    this.saveRules(rules)
  }

  static getRuleByVersion(version: string): ReviewRule | undefined {
    return this.getRules().find(r => r.version === version)
  }

  static getActiveRule(): ReviewRule | undefined {
    return this.getRules().find(r => r.isActive)
  }

  static getAuditLogs(): AuditLog[] {
    return readJsonFile(FILES.auditLogs, [])
  }

  static saveAuditLogs(logs: AuditLog[]): void {
    writeJsonFile(FILES.auditLogs, logs)
  }

  static addAuditLog(log: AuditLog): void {
    const logs = this.getAuditLogs()
    logs.push(log)
    this.saveAuditLogs(logs)
  }

  static getAuditLogsByInquiry(inquiryId: string): AuditLog[] {
    return this.getAuditLogs().filter(l => l.inquiryId === inquiryId)
  }

  static getReviewResults(): ReviewResult[] {
    return readJsonFile(FILES.reviewResults, [])
  }

  static saveReviewResults(results: ReviewResult[]): void {
    writeJsonFile(FILES.reviewResults, results)
  }

  static addReviewResult(result: ReviewResult): void {
    const results = this.getReviewResults()
    results.push(result)
    this.saveReviewResults(results)
  }

  static getReviewResultByInquiry(inquiryId: string): ReviewResult | undefined {
    return this.getReviewResults().find(r => r.inquiryId === inquiryId)
  }

  static getPermissionTickets(): PermissionTicket[] {
    return readJsonFile(FILES.permissionTickets, [])
  }

  static savePermissionTickets(tickets: PermissionTicket[]): void {
    writeJsonFile(FILES.permissionTickets, tickets)
  }

  static addPermissionTicket(ticket: PermissionTicket): void {
    const tickets = this.getPermissionTickets()
    tickets.push(ticket)
    this.savePermissionTickets(tickets)
  }

  static getPermissionTicketsByInquiry(inquiryId: string): PermissionTicket[] {
    return this.getPermissionTickets().filter(t => t.inquiryId === inquiryId)
  }

  static getBatchOperations(): BatchOperation[] {
    return readJsonFile(FILES.batchOperations, [])
  }

  static saveBatchOperations(operations: BatchOperation[]): void {
    writeJsonFile(FILES.batchOperations, operations)
  }

  static addBatchOperation(operation: BatchOperation): void {
    const operations = this.getBatchOperations()
    operations.push(operation)
    this.saveBatchOperations(operations)
  }

  static updateBatchOperation(operation: BatchOperation): void {
    const operations = this.getBatchOperations()
    const index = operations.findIndex(o => o.id === operation.id)
    if (index >= 0) {
      operations[index] = operation
      this.saveBatchOperations(operations)
    }
  }
}
