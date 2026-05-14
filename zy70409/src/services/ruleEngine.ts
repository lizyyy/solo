import { PurchaseInquiry, ReviewRule, ReviewResult } from '../types'
import { DataStore } from '../store/dataStore'

export class RuleEngine {
  private rule: ReviewRule

  constructor(ruleVersion?: string) {
    if (ruleVersion) {
      const rule = DataStore.getRuleByVersion(ruleVersion)
      if (!rule) {
        throw new Error(`Rule version ${ruleVersion} not found`)
      }
      this.rule = rule
    } else {
      const activeRule = DataStore.getActiveRule()
      if (!activeRule) {
        throw new Error('No active rule found')
      }
      this.rule = activeRule
    }
  }

  getRuleVersion(): string {
    return this.rule.version
  }

  getRuleDescription(): string {
    return this.rule.description
  }

  private evaluateCondition(
    condition: ReviewRule['conditions'][0],
    inquiry: PurchaseInquiry
  ): boolean {
    switch (condition.type) {
      case 'amount_threshold': {
        const threshold = condition.value as number
        switch (condition.operator) {
          case '>':
            return inquiry.totalAmount > threshold
          case '<':
            return inquiry.totalAmount < threshold
          case '>=':
            return inquiry.totalAmount >= threshold
          case '<=':
            return inquiry.totalAmount <= threshold
          case '==':
            return inquiry.totalAmount === threshold
          default:
            return false
        }
      }
      case 'department': {
        const dept = condition.value as string
        switch (condition.operator) {
          case '==':
            return inquiry.department === dept
          case 'contains':
            return inquiry.department.includes(dept)
          default:
            return false
        }
      }
      case 'item_count': {
        const count = condition.value as number
        switch (condition.operator) {
          case '>':
            return inquiry.items.length > count
          case '<':
            return inquiry.items.length < count
          case '>=':
            return inquiry.items.length >= count
          case '<=':
            return inquiry.items.length <= count
          default:
            return false
        }
      }
      case 'duplicate_check':
        return this.checkDuplicate(inquiry)
      default:
        return true
    }
  }

  private checkDuplicate(inquiry: PurchaseInquiry): boolean {
    const inquiries = DataStore.getInquiries().filter(
      i =>
        i.id !== inquiry.id &&
        i.batchId === inquiry.batchId &&
        i.items.some(item =>
          inquiry.items.some(
            newItem =>
              newItem.itemCode === item.itemCode &&
              newItem.supplierId === item.supplierId &&
              newItem.quantity === item.quantity
          )
        )
    )
    return inquiries.length > 0
  }

  review(inquiry: PurchaseInquiry): ReviewResult {
    const checks: ReviewResult['checks'] = []
    const issues: ReviewResult['issues'] = []

    for (const condition of this.rule.conditions) {
      const passed = this.evaluateCondition(condition, inquiry)
      let message = ''
      let details: Record<string, unknown> | undefined

      switch (condition.type) {
        case 'amount_threshold':
          message = passed
            ? `金额 ${inquiry.totalAmount} 符合阈值要求`
            : `金额 ${inquiry.totalAmount} 超出阈值 ${condition.value}`
          details = {
            actualAmount: inquiry.totalAmount,
            threshold: condition.value
          }
          if (!passed) {
            issues.push({
              type: 'amount_exceed',
              severity: 'high',
              message: `询价单金额 ${inquiry.totalAmount} 超出阈值 ${condition.value}`,
              data: details
            })
          }
          break
        case 'department':
          message = passed
            ? `部门 ${inquiry.department} 符合要求`
            : `部门 ${inquiry.department} 不在允许范围内`
          details = {
            actualDepartment: inquiry.department,
            allowedDepartment: condition.value
          }
          break
        case 'item_count':
          message = passed
            ? `物料数量 ${inquiry.items.length} 符合要求`
            : `物料数量 ${inquiry.items.length} 超出限制 ${condition.value}`
          details = {
            actualCount: inquiry.items.length,
            maxCount: condition.value
          }
          break
        case 'duplicate_check':
          message = passed ? '检测到重复提交' : '未检测到重复提交'
          if (passed) {
            const duplicates = DataStore.getInquiries().filter(
              i =>
                i.id !== inquiry.id &&
                i.batchId === inquiry.batchId &&
                i.items.some(item =>
                  inquiry.items.some(
                    newItem =>
                      newItem.itemCode === item.itemCode &&
                      newItem.supplierId === item.supplierId &&
                      newItem.quantity === item.quantity
                  )
                )
            )
            details = {
              duplicateCount: duplicates.length,
              duplicateIds: duplicates.map(d => d.id)
            }
            issues.push({
              type: 'duplicate',
              severity: 'high',
              message: `检测到 ${duplicates.length} 条重复提交记录`,
              data: details
            })
          }
          break
        default:
          message = '检查完成'
      }

      checks.push({
        name: condition.type,
        passed,
        message,
        details
      })
    }

    const hasError = issues.some(i => i.severity === 'high')
    const hasWarning = issues.some(i => i.severity === 'medium')

    return {
      inquiryId: inquiry.id,
      batchId: inquiry.batchId,
      status: hasError ? 'error' : hasWarning ? 'warning' : 'success',
      ruleVersion: this.rule.version,
      checks,
      issues,
      originalData: inquiry,
      reviewedAt: new Date().toISOString()
    }
  }
}
