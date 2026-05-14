import { DataStore } from '../store/dataStore'
import { BatchOperation } from '../types'
import { RuleEngine } from './ruleEngine'

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export class BatchService {
  static createPreview(
    name: string,
    type: BatchOperation['type'],
    targetIds: string[],
    createdBy: string
  ): BatchOperation {
    const affectedItems = targetIds.map(id => {
      const inquiry = DataStore.getInquiryById(id)
      return {
        id,
        title: inquiry?.title || '未知询价单',
        impact: '将执行复核操作'
      }
    })

    const warnings: string[] = []
    const duplicateCount = affectedItems.filter(
      item => item.impact.includes('重复')
    ).length

    if (duplicateCount > 0) {
      warnings.push(`检测到 ${duplicateCount} 条可能存在重复提交的记录`)
    }

    const operation: BatchOperation = {
      id: generateId(),
      name,
      type,
      status: 'preview',
      targetIds,
      previewResult: {
        affectedCount: targetIds.length,
        affectedItems,
        warnings
      },
      createdAt: new Date().toISOString(),
      createdBy
    }

    DataStore.addBatchOperation(operation)
    return operation
  }

  static executeBatch(operationId: string): BatchOperation {
    const operation = DataStore.getBatchOperations().find(
      o => o.id === operationId
    )

    if (!operation) {
      throw new Error(`Batch operation ${operationId} not found`)
    }

    if (operation.status !== 'preview') {
      throw new Error('Batch operation can only be executed from preview state')
    }

    const ruleEngine = new RuleEngine()

    for (const inquiryId of operation.targetIds) {
      const inquiry = DataStore.getInquiryById(inquiryId)
      if (inquiry) {
        const result = ruleEngine.review(inquiry)
        DataStore.addReviewResult(result)
      }
    }

    const updatedOperation: BatchOperation = {
      ...operation,
      status: 'completed',
      executedAt: new Date().toISOString()
    }

    DataStore.updateBatchOperation(updatedOperation)
    return updatedOperation
  }

  static getBatchOperations(): BatchOperation[] {
    return DataStore.getBatchOperations()
  }

  static getBatchOperationById(id: string): BatchOperation | undefined {
    return DataStore.getBatchOperations().find(o => o.id === id)
  }
}
