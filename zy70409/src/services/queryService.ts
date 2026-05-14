import { DataStore } from '../store/dataStore'
import { PurchaseInquiry, ReviewResult, QueryResult } from '../types'

export class QueryService {
  static queryInquiries(
    filters: {
      batchId?: string
      status?: string
      department?: string
    } = {},
    page: number = 1,
    pageSize: number = 10
  ): QueryResult<PurchaseInquiry[]> {
    let inquiries = DataStore.getInquiries()

    if (filters.batchId) {
      inquiries = inquiries.filter(i => i.batchId === filters.batchId)
    }
    if (filters.status) {
      inquiries = inquiries.filter(i => i.status === filters.status)
    }
    if (filters.department) {
      inquiries = inquiries.filter(i => i.department === filters.department)
    }

    const total = inquiries.length
    const startIndex = (page - 1) * pageSize
    const paginatedData = inquiries.slice(startIndex, startIndex + pageSize)

    return {
      success: true,
      data: paginatedData,
      metadata: {
        total,
        page,
        pageSize,
        filters
      }
    }
  }

  static queryReviewResults(
    filters: {
      batchId?: string
      status?: 'success' | 'warning' | 'error'
      ruleVersion?: string
    } = {},
    page: number = 1,
    pageSize: number = 10
  ): QueryResult<ReviewResult[]> {
    let results = DataStore.getReviewResults()

    if (filters.batchId) {
      results = results.filter(r => r.batchId === filters.batchId)
    }
    if (filters.status) {
      results = results.filter(r => r.status === filters.status)
    }
    if (filters.ruleVersion) {
      results = results.filter(r => r.ruleVersion === filters.ruleVersion)
    }

    const total = results.length
    const startIndex = (page - 1) * pageSize
    const paginatedData = results.slice(startIndex, startIndex + pageSize)

    return {
      success: true,
      data: paginatedData,
      metadata: {
        total,
        page,
        pageSize,
        filters
      }
    }
  }

  static getInquiryWithDetails(inquiryId: string) {
    const inquiry = DataStore.getInquiryById(inquiryId)
    if (!inquiry) {
      return {
        success: false,
        error: 'Inquiry not found'
      }
    }

    const reviewResult = DataStore.getReviewResultByInquiry(inquiryId)
    const auditLogs = DataStore.getAuditLogsByInquiry(inquiryId)
    const permissionTickets = DataStore.getPermissionTicketsByInquiry(inquiryId)

    return {
      success: true,
      data: {
        inquiry,
        reviewResult,
        auditLogs,
        permissionTickets
      }
    }
  }
}
