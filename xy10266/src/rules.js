import { HOSE_STATUS, ProblemRecord, OperationHistory, StorageResult } from './models.js'
import { storage } from './storage.js'

export const HOSE_NUMBER_PATTERN = /^HD-\d{4}$/

export const RULE_TYPE = {
  HOSE_NUMBER_FORMAT: 'hose_number_format',
  HOSE_NUMBER_UNIQUE: 'hose_number_unique',
  STATUS_TRANSITION: 'status_transition',
  DRYING_REQUIRED: 'drying_required',
  BORROW_RETURN: 'borrow_return',
  STORAGE_CHECK: 'storage_check'
}

export const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

export const VALID_TRANSITIONS = {
  [HOSE_STATUS.STORAGE]: [HOSE_STATUS.WET, HOSE_STATUS.DRY],
  [HOSE_STATUS.WET]: [HOSE_STATUS.DRYING, HOSE_STATUS.WET],
  [HOSE_STATUS.DRYING]: [HOSE_STATUS.DRY, HOSE_STATUS.DRYING],
  [HOSE_STATUS.DRY]: [HOSE_STATUS.STORAGE, HOSE_STATUS.WET]
}

export function validateHoseNumber(number) {
  if (!number) {
    return { valid: false, reason: '水带编号不能为空' }
  }
  if (!HOSE_NUMBER_PATTERN.test(number)) {
    return { valid: false, reason: `水带编号格式不正确，应为 HD-XXXX（四位数字），实际值: ${number}` }
  }
  return { valid: true }
}

export function validateStatusTransition(fromStatus, toStatus) {
  const validTransitions = VALID_TRANSITIONS[fromStatus] || []
  if (!validTransitions.includes(toStatus)) {
    return { 
      valid: false, 
      reason: `状态转换无效: 不能从 ${fromStatus} 转换到 ${toStatus}` 
    }
  }
  return { valid: true }
}

export async function checkHoseCanBeStored(hose) {
  const reasons = []

  if (hose.status === HOSE_STATUS.WET) {
    reasons.push('水带状态为"潮湿"，必须先晾晒才能归仓')
  }

  if (hose.status === HOSE_STATUS.DRYING) {
    reasons.push('水带状态为"晾晒中"，尚未完成晾晒')
  }

  const dryingRecords = await storage.getDryingRecords()
  const hoseDryingRecords = dryingRecords.filter(r => r.hoseId === hose.id)
  
  if (hoseDryingRecords.length > 0) {
    const incompleteDrying = hoseDryingRecords.find(r => !r.isComplete)
    if (incompleteDrying) {
      reasons.push(`存在未完成的晾晒记录，开始于 ${incompleteDrying.startDate}`)
    }
  }

  const borrowRecords = await storage.getBorrowRecords()
  const hoseBorrowRecords = borrowRecords.filter(r => r.hoseId === hose.id)
  const unreturnedBorrow = hoseBorrowRecords.find(r => !r.returnDate)
  
  if (unreturnedBorrow) {
    reasons.push(`存在未归还的借用记录，借出日期 ${unreturnedBorrow.borrowDate}`)
  }

  return {
    canStore: reasons.length === 0,
    reasons
  }
}

export class RuleEngine {
  constructor() {
    this.problems = []
  }

  async addProblem(type, severity, message, source, data) {
    const problems = await storage.getProblems()
    const newProblem = new ProblemRecord(
      `PRB-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      severity,
      message,
      source,
      data
    )
    problems.push(newProblem)
    await storage.saveProblems(problems)
    return newProblem
  }

  async addHistory(operation, details, operator = '') {
    const history = await storage.getHistory()
    const newHistory = new OperationHistory(
      `HIS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      operation,
      details,
      operator
    )
    history.push(newHistory)
    await storage.saveHistory(history)
    return newHistory
  }

  async validateHose(hose, source = 'system') {
    const issues = []

    const numberResult = validateHoseNumber(hose.number)
    if (!numberResult.valid) {
      await this.addProblem(
        RULE_TYPE.HOSE_NUMBER_FORMAT,
        SEVERITY.ERROR,
        numberResult.reason,
        source,
        { hose }
      )
      issues.push(numberResult.reason)
    }

    const existingHose = await storage.getHoseByNumber(hose.number)
    if (existingHose && existingHose.id !== hose.id) {
      const message = `水带编号重复: ${hose.number} 已存在于系统中`
      await this.addProblem(
        RULE_TYPE.HOSE_NUMBER_UNIQUE,
        SEVERITY.ERROR,
        message,
        source,
        { newHose: hose, existingHose }
      )
      issues.push(message)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  async borrowHose(hoseId, purpose = '', borrower = '') {
    const hoses = await storage.getHoses()
    const hose = hoses.find(h => h.id === hoseId)

    if (!hose) {
      return { success: false, reason: `水带不存在: ${hoseId}` }
    }

    if (hose.status === HOSE_STATUS.WET) {
      const reason = '潮湿水带不能借出，可能影响出警'
      await this.addProblem(
        RULE_TYPE.BORROW_RETURN,
        SEVERITY.WARNING,
        reason,
        'borrow',
        { hose }
      )
    }

    const borrowRecord = {
      id: `BOR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      hoseId: hose.id,
      borrowDate: new Date().toISOString(),
      purpose,
      borrower,
      returnDate: null
    }

    await storage.addBorrowRecord(borrowRecord)

    hose.status = HOSE_STATUS.WET
    await storage.saveHoses(hoses)

    await this.addHistory('BORROW', `借出 "${hose.number}" ${hose.name}`, borrower)

    return {
      success: true,
      hose,
      borrowRecord
    }
  }

  async returnHose(hoseId, operator = '') {
    const hoses = await storage.getHoses()
    const hose = hoses.find(h => h.id === hoseId)

    if (!hose) {
      return { success: false, reason: `水带不存在: ${hoseId}` }
    }

    const borrowRecords = await storage.getBorrowRecords()
    const unreturnedBorrow = borrowRecords.find(
      r => r.hoseId === hoseId && !r.returnDate
    )

    if (unreturnedBorrow) {
      unreturnedBorrow.returnDate = new Date().toISOString()
      await storage.saveBorrowRecords(borrowRecords)
    }

    hose.status = HOSE_STATUS.WET
    await storage.saveHoses(hoses)

    await this.addHistory('RETURN', `归还 "${hose.number}" 并标记为潮湿`, operator)

    return {
      success: true,
      hose
    }
  }

  async startDrying(hoseId, operator = '') {
    const hoses = await storage.getHoses()
    const hose = hoses.find(h => h.id === hoseId)

    if (!hose) {
      return { success: false, reason: `水带不存在: ${hoseId}` }
    }

    if (hose.status === HOSE_STATUS.DRYING) {
      return { success: false, reason: '水带已经在晾晒中' }
    }

    if (hose.status === HOSE_STATUS.DRY || hose.status === HOSE_STATUS.STORAGE) {
      await this.addProblem(
        RULE_TYPE.DRYING_REQUIRED,
        SEVERITY.WARNING,
        `${hose.number} 当前状态为${hose.status}，重复晾晒`,
        'drying',
        { hose }
      )
    }

    const dryingRecord = {
      id: `DRY-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      hoseId: hose.id,
      startDate: new Date().toISOString(),
      endDate: null,
      isComplete: false
    }

    await storage.addDryingRecord(dryingRecord)

    hose.status = HOSE_STATUS.DRYING
    await storage.saveHoses(hoses)

    await this.addHistory('START_DRYING', `开始晾晒 "${hose.number}"`, operator)

    return {
      success: true,
      hose,
      dryingRecord
    }
  }

  async completeDrying(hoseId, operator = '') {
    const hoses = await storage.getHoses()
    const hose = hoses.find(h => h.id === hoseId)

    if (!hose) {
      return { success: false, reason: `水带不存在: ${hoseId}` }
    }

    if (hose.status !== HOSE_STATUS.DRYING) {
      return { success: false, reason: '水带不在晾晒中，无法完成晾晒' }
    }

    const dryingRecords = await storage.getDryingRecords()
    const incompleteDrying = dryingRecords.find(
      r => r.hoseId === hoseId && !r.isComplete
    )

    if (incompleteDrying) {
      incompleteDrying.endDate = new Date().toISOString()
      incompleteDrying.isComplete = true
      await storage.saveDryingRecords(dryingRecords)
    }

    hose.status = HOSE_STATUS.DRY
    await storage.saveHoses(hoses)

    await this.addHistory('COMPLETE_DRYING', `完成晾晒 "${hose.number}"，状态改为已晾干`, operator)

    return {
      success: true,
      hose
    }
  }

  async storeHose(hoseId, operator = '') {
    const hoses = await storage.getHoses()
    const hose = hoses.find(h => h.id === hoseId)

    if (!hose) {
      return new StorageResult(hoseId, false, '水带不存在', 'hose_not_found')
    }

    const checkResult = await checkHoseCanBeStored(hose)

    if (!checkResult.canStore) {
      const reason = checkResult.reasons.join('; ')
      await this.addProblem(
        RULE_TYPE.STORAGE_CHECK,
        SEVERITY.ERROR,
        `${hose.number} 归仓被拦截: ${reason}`,
        'storage',
        { hose, reasons: checkResult.reasons }
      )
      
      await this.addHistory('STORAGE_BLOCKED', `阻止归仓 "${hose.number}": ${reason}`, operator)

      return new StorageResult(hoseId, false, `归仓被拦截: ${reason}`, checkResult.reasons)
    }

    hose.status = HOSE_STATUS.STORAGE
    await storage.saveHoses(hoses)

    await this.addHistory('STORE', `归仓 "${hose.number}"，状态改为已归仓`, operator)

    return new StorageResult(hoseId, true, `${hose.number} 归仓成功`)
  }

  async checkAllForStorage(operator = '') {
    const hoses = await storage.getHoses()
    const results = []

    for (const hose of hoses) {
      if (hose.status !== HOSE_STATUS.STORAGE) {
        const result = await this.checkHoseStorageStatus(hose)
        results.push(result)
      }
    }

    await this.addHistory('CHECK_ALL', `执行全量归仓检查，共检查 ${results.length} 条记录`, operator)

    return results
  }

  async checkHoseStorageStatus(hose) {
    const checkResult = await checkHoseCanBeStored(hose)

    return {
      hoseId: hose.id,
      hoseNumber: hose.number,
      currentStatus: hose.status,
      canStore: checkResult.canStore,
      blockingReasons: checkResult.reasons
    }
  }
}

export const ruleEngine = new RuleEngine()
