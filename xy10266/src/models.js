export const HOSE_STATUS = {
  WET: 'wet',
  DRYING: 'drying',
  DRY: 'dry',
  STORAGE: 'storage'
}

export const HOSE_STATUS_DESC = {
  [HOSE_STATUS.WET]: '潮湿（需晾晒）',
  [HOSE_STATUS.DRYING]: '晾晒中',
  [HOSE_STATUS.DRY]: '已晾干',
  [HOSE_STATUS.STORAGE]: '已归仓'
}

export class Hose {
  constructor(id, number, name = '', status = HOSE_STATUS.STORAGE, location = '', notes = '') {
    this.id = id
    this.number = number
    this.name = name
    this.status = status
    this.location = location
    this.notes = notes
  }
}

export class BorrowRecord {
  constructor(id, hoseId, borrowDate, purpose = '', borrower = '', returnDate = null) {
    this.id = id
    this.hoseId = hoseId
    this.borrowDate = borrowDate
    this.purpose = purpose
    this.borrower = borrower
    this.returnDate = returnDate
  }
}

export class DryingRecord {
  constructor(id, hoseId, startDate, endDate = null, isComplete = false) {
    this.id = id
    this.hoseId = hoseId
    this.startDate = startDate
    this.endDate = endDate
    this.isComplete = isComplete
  }
}

export class ProblemRecord {
  constructor(id, type, severity, message, source, data, createdAt = null) {
    this.id = id
    this.type = type
    this.severity = severity
    this.message = message
    this.source = source
    this.data = data
    this.createdAt = createdAt || new Date().toISOString()
  }
}

export class OperationHistory {
  constructor(id, operation, details, operator = '', createdAt = null) {
    this.id = id
    this.operation = operation
    this.details = details
    this.operator = operator
    this.createdAt = createdAt || new Date().toISOString()
  }
}

export class StorageResult {
  constructor(hoseId, success, message, reason = null) {
    this.hoseId = hoseId
    this.success = success
    this.message = message
    this.reason = reason
  }
}
