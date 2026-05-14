"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const dataStore_1 = require("../store/dataStore");
class QueryService {
    static queryInquiries(filters = {}, page = 1, pageSize = 10) {
        let inquiries = dataStore_1.DataStore.getInquiries();
        if (filters.batchId) {
            inquiries = inquiries.filter(i => i.batchId === filters.batchId);
        }
        if (filters.status) {
            inquiries = inquiries.filter(i => i.status === filters.status);
        }
        if (filters.department) {
            inquiries = inquiries.filter(i => i.department === filters.department);
        }
        const total = inquiries.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedData = inquiries.slice(startIndex, startIndex + pageSize);
        return {
            success: true,
            data: paginatedData,
            metadata: {
                total,
                page,
                pageSize,
                filters
            }
        };
    }
    static queryReviewResults(filters = {}, page = 1, pageSize = 10) {
        let results = dataStore_1.DataStore.getReviewResults();
        if (filters.batchId) {
            results = results.filter(r => r.batchId === filters.batchId);
        }
        if (filters.status) {
            results = results.filter(r => r.status === filters.status);
        }
        if (filters.ruleVersion) {
            results = results.filter(r => r.ruleVersion === filters.ruleVersion);
        }
        const total = results.length;
        const startIndex = (page - 1) * pageSize;
        const paginatedData = results.slice(startIndex, startIndex + pageSize);
        return {
            success: true,
            data: paginatedData,
            metadata: {
                total,
                page,
                pageSize,
                filters
            }
        };
    }
    static getInquiryWithDetails(inquiryId) {
        const inquiry = dataStore_1.DataStore.getInquiryById(inquiryId);
        if (!inquiry) {
            return {
                success: false,
                error: 'Inquiry not found'
            };
        }
        const reviewResult = dataStore_1.DataStore.getReviewResultByInquiry(inquiryId);
        const auditLogs = dataStore_1.DataStore.getAuditLogsByInquiry(inquiryId);
        const permissionTickets = dataStore_1.DataStore.getPermissionTicketsByInquiry(inquiryId);
        return {
            success: true,
            data: {
                inquiry,
                reviewResult,
                auditLogs,
                permissionTickets
            }
        };
    }
}
exports.QueryService = QueryService;
