import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import {
  RefundReview,
  RefundReviewStatusLabel,
  RefundReasonLabel,
  RiskTagLabel,
  ReviewConclusionLabel
} from '../types';
import { dataStore } from '../store/dataStore';
import { createSuccessResponse, ApiResponse } from '../utils/response';

const EXPORT_FIELDS = [
  { id: 'orderNo', title: '订单编号' },
  { id: 'goodsName', title: '商品名称' },
  { id: 'userId', title: '用户ID' },
  { id: 'orderAmount', title: '订单金额(元)' },
  { id: 'refundAmount', title: '退款金额(元)' },
  { id: 'refundReason', title: '退款原因' },
  { id: 'refundReasonDetail', title: '退款原因详情' },
  { id: 'riskTags', title: '风控标签' },
  { id: 'status', title: '当前状态' },
  { id: 'reviewConclusion', title: '复核结论' },
  { id: 'reviewerName', title: '复核人' },
  { id: 'reviewTime', title: '复核时间' },
  { id: 'reviewRemark', title: '复核备注' },
  { id: 'manualRemark', title: '人工备注' },
  { id: 'createTime', title: '创建时间' }
];

class ExportService {
  async exportToCsv(filters?: any): Promise<ApiResponse<{ filePath: string; recordCount: number }>> {
    const { list, total } = dataStore.listRefundReviews(1, 10000, filters);
    
    const records = list.map(review => this.mapToExportRecord(review));

    const fileName = `refund_review_export_${Date.now()}.csv`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: EXPORT_FIELDS,
      encoding: 'utf-8'
    });

    await csvWriter.writeRecords(records);

    return createSuccessResponse({
      filePath,
      recordCount: total
    }, `导出成功，共${total}条记录`);
  }

  private mapToExportRecord(review: RefundReview): Record<string, string> {
    return {
      orderNo: review.orderInfo.orderNo,
      goodsName: review.orderInfo.goodsName,
      userId: review.orderInfo.userId,
      orderAmount: review.orderInfo.orderAmount.toFixed(2),
      refundAmount: review.orderInfo.refundAmount.toFixed(2),
      refundReason: RefundReasonLabel[review.refundReason],
      refundReasonDetail: review.refundReasonDetail || '',
      riskTags: review.riskTags.map(tag => RiskTagLabel[tag]).join(';'),
      status: RefundReviewStatusLabel[review.status],
      reviewConclusion: review.reviewConclusion ? ReviewConclusionLabel[review.reviewConclusion] : '',
      reviewerName: review.reviewerName || '',
      reviewTime: review.reviewTime || '',
      reviewRemark: review.reviewRemark || '',
      manualRemark: review.manualRemark || '',
      createTime: review.createTime
    };
  }

  getExportFieldConfig(): ApiResponse<{ field: string; label: string }[]> {
    return createSuccessResponse(
      EXPORT_FIELDS.map(f => ({ field: f.id, label: f.title })),
      '获取导出字段配置成功'
    );
  }
}

export const exportService = new ExportService();
