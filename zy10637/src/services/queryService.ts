import { db } from '../store/database';
import { RedApplyStatus, ApiResponse, ErrorType } from '../types';

export class QueryService {
  getList(filters?: {
    status?: RedApplyStatus;
    orderNo?: string;
    invoiceNumber?: string;
    page?: number;
    pageSize?: number;
  }): ApiResponse {
    let list = db.listRedApplies();

    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }

    if (filters?.orderNo) {
      list = list.filter(a => a.order.orderNo.includes(filters.orderNo!));
    }

    if (filters?.invoiceNumber) {
      list = list.filter(a => a.invoice.invoiceNumber.includes(filters.invoiceNumber!));
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const pagedList = list.slice(start, start + pageSize);

    return {
      success: true,
      data: {
        list: pagedList,
        total: list.length,
        page,
        pageSize
      }
    };
  }

  getDetail(id: string): ApiResponse {
    const apply = db.getRedApply(id);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查ID是否正确'
        }
      };
    }
    return { success: true, data: apply };
  }

  getHistory(redApplyId: string): ApiResponse {
    const apply = db.getRedApply(redApplyId);
    if (!apply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '记录不存在',
          type: ErrorType.DATA_INCOMPLETE,
          suggestion: '请检查ID是否正确'
        }
      };
    }

    const history = db.getHistoryByRedApplyId(redApplyId);
    return { success: true, data: history };
  }

  getStatistics(): ApiResponse {
    const all = db.listRedApplies();
    const stats = {
      total: all.length,
      byStatus: {
        [RedApplyStatus.PENDING_APPLY]: all.filter(a => a.status === RedApplyStatus.PENDING_APPLY).length,
        [RedApplyStatus.VERIFYING]: all.filter(a => a.status === RedApplyStatus.VERIFYING).length,
        [RedApplyStatus.RED_COMPLETED]: all.filter(a => a.status === RedApplyStatus.RED_COMPLETED).length,
        [RedApplyStatus.REJECTED]: all.filter(a => a.status === RedApplyStatus.REJECTED).length
      }
    };
    return { success: true, data: stats };
  }
}

export const queryService = new QueryService();
