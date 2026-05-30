import { randomUUID } from 'crypto'
import db from '../database.js'
import type { RiskFlag, RiskCheckResult } from '../../shared/types.js'

const MCC_DESCRIPTIONS: Record<string, string> = {
  "3000": "航空公司",
  "3001": "航空公司",
  "3501": "租车",
  "4000": "铁路客运",
  "4001": "铁路客运",
  "4002": "铁路客运",
  "4003": "铁路客运",
  "4004": "铁路客运",
  "4005": "铁路客运",
  "4006": "铁路客运",
  "4007": "铁路客运",
  "4008": "铁路客运",
  "4009": "铁路客运",
  "4010": "铁路客运",
  "4011": "铁路客运",
  "5940": "自行车商店",
  "5941": "体育用品店",
  "5942": "书店",
  "5943": "文具店",
  "5944": "珠宝店",
  "5945": "玩具店",
  "5946": "相机店",
  "5947": "礼品卡商店",
  "5948": "箱包店",
  "5949": "纺织品店",
  "5950": "玻璃器皿店",
  "5960": "保险直销",
  "5961": "目录商户",
  "5962": "直销",
  "5963": "上门推销",
  "5964": "直销-目录商户",
  "5965": "直销-组合",
  "5966": "直销-其他",
  "5967": "直销-订阅",
  "5968": "直销-旅行",
  "5969": "直销-其他服务",
  "5811": "餐饮-外卖",
  "5812": "餐饮-餐厅",
  "5813": "餐饮-酒吧",
  "5814": "餐饮-快餐",
  "5831": "酒类商店",
  "5832": "酒类商店",
  "5833": "酒类商店",
  "5834": "酒类商店",
  "5835": "酒类商店",
  "5836": "酒类商店",
  "5837": "酒类商店",
  "5838": "酒类商店",
  "5839": "酒类商店",
  "5840": "酒类商店",
  "5841": "酒类商店",
  "5842": "酒类商店",
  "5912": "药店",
  "5921": "加油站",
  "5931": "当铺",
  "5970": "工艺品店",
  "5971": "艺术品店",
  "5972": "邮票硬币店",
  "5973": "宗教用品店",
  "5975": "助听器店",
  "5976": "假肢店",
  "5977": "化妆品店",
  "5978": "打字机店",
  "5992": "花店",
  "5993": "雪茄店",
  "5994": "报刊亭",
  "5995": "宠物店",
  "5999": "其他零售",
}

export { MCC_DESCRIPTIONS }

function formatLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN')
}

function getMccDesc(mcc: string): string {
  return MCC_DESCRIPTIONS[mcc] || mcc
}

export function checkBudgetOverrun(
  transaction: { amount: number; budgetId: string },
  budget: { name: string; totalAmount: number; usedAmount: number }
): RiskFlag | null {
  const remaining = budget.totalAmount - budget.usedAmount
  if (transaction.amount > remaining) {
    return {
      id: randomUUID(),
      transactionId: '',
      type: 'budget_overrun',
      severity: 'error',
      detail: `amount=${transaction.amount}, remaining=${remaining}`,
      humanReason: `该笔交易金额${formatAmount(transaction.amount)}元，超出预算科目'${budget.name}'剩余额度${formatAmount(remaining)}元`,
      createdAt: formatLocalDate(new Date()),
    }
  }
  return null
}

export function checkMccMismatch(
  transaction: { mcc: string; budgetId: string },
  budget: { name: string; allowedMccs: string[] }
): RiskFlag | null {
  if (!budget.allowedMccs.includes(transaction.mcc)) {
    return {
      id: randomUUID(),
      transactionId: '',
      type: 'mcc_mismatch',
      severity: 'warning',
      detail: `mcc=${transaction.mcc}, allowedMccs=${budget.allowedMccs.join(',')}`,
      humanReason: `商户类别码${transaction.mcc}(${getMccDesc(transaction.mcc)})不在预算科目'${budget.name}'允许的商户类别范围内`,
      createdAt: formatLocalDate(new Date()),
    }
  }
  return null
}

export function checkDuplicateReimbursement(
  transaction: { id: string; employeeId: string; amount: number; merchantName: string; transactionTime: string },
  employeeName: string
): RiskFlag | null {
  const txnTime = new Date(transaction.transactionTime)
  const sevenDaysAgo = new Date(txnTime)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const rows = db.prepare(`
    SELECT id FROM transactions
    WHERE employeeId = ?
      AND amount = ?
      AND merchantName = ?
      AND transactionTime >= ?
      AND transactionTime <= ?
      AND id != ?
  `).all(
    transaction.employeeId,
    transaction.amount,
    transaction.merchantName,
    formatLocalDate(sevenDaysAgo),
    formatLocalDate(txnTime),
    transaction.id
  ) as { id: string }[]

  if (rows.length > 0) {
    return {
      id: randomUUID(),
      transactionId: '',
      type: 'duplicate_reimbursement',
      severity: 'error',
      detail: `duplicateCount=${rows.length}, employeeId=${transaction.employeeId}, amount=${transaction.amount}, merchantName=${transaction.merchantName}`,
      humanReason: `员工${employeeName}在7天内存在相同商户'${transaction.merchantName}'、相同金额${formatAmount(transaction.amount)}元的另一笔交易，可能存在重复报销`,
      createdAt: formatLocalDate(new Date()),
    }
  }
  return null
}

export function runRiskCheck(transactionId: string): RiskCheckResult {
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any
  if (!txn) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(txn.budgetId) as any
  if (!budget) {
    throw new Error(`Budget ${txn.budgetId} not found`)
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(txn.employeeId) as any

  const allowedMccs: string[] = JSON.parse(budget.allowedMccs)
  const budgetObj = { name: budget.name, totalAmount: budget.totalAmount, usedAmount: budget.usedAmount, allowedMccs }

  db.prepare('DELETE FROM risk_flags WHERE transactionId = ?').run(transactionId)

  const flags: RiskFlag[] = []

  const budgetFlag = checkBudgetOverrun(txn, budgetObj)
  if (budgetFlag) {
    budgetFlag.transactionId = transactionId
    flags.push(budgetFlag)
  }

  const mccFlag = checkMccMismatch(txn, budgetObj)
  if (mccFlag) {
    mccFlag.transactionId = transactionId
    flags.push(mccFlag)
  }

  const employeeName = employee ? employee.name : txn.employeeId
  const dupFlag = checkDuplicateReimbursement(txn, employeeName)
  if (dupFlag) {
    dupFlag.transactionId = transactionId
    flags.push(dupFlag)
  }

  const insertFlag = db.prepare(
    'INSERT INTO risk_flags (id, transactionId, type, severity, detail, humanReason, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  for (const flag of flags) {
    insertFlag.run(flag.id, flag.transactionId, flag.type, flag.severity, flag.detail, flag.humanReason, flag.createdAt)
  }

  let autoJudgment: RiskCheckResult['autoJudgment']
  const errorFlags = flags.filter(f => f.severity === 'error')
  const warningFlags = flags.filter(f => f.severity === 'warning')

  if (errorFlags.length > 0) {
    autoJudgment = {
      decision: 'reject',
      reason: errorFlags.map(f => f.humanReason).join('；'),
    }
  } else if (warningFlags.length > 0) {
    autoJudgment = {
      decision: 'review',
      reason: warningFlags.map(f => f.humanReason).join('；'),
    }
  } else {
    autoJudgment = {
      decision: 'pass',
      reason: '该笔交易未发现风控问题，预算额度充足，商户类别匹配，无重复报销记录',
    }
  }

  const statusMap: Record<string, string> = {
    pass: 'normal',
    review: 'warning',
    reject: 'error',
  }
  db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(statusMap[autoJudgment.decision], transactionId)

  return {
    transactionId,
    flags,
    autoJudgment,
  }
}
