import { DetentionFeeRecord, DetentionFeeStatus, DetentionReason } from '../types/detention-fee';
import { storageService } from './storage.service';

interface ManualReviewRequest {
  billOfLadingNo: string;
  containerNo: string;
  portCode: string;
  manualRemark: string;
  operatorId: string;
  operatorName: string;
}

interface ReviewResponse {
  success: boolean;
  message: string;
  record?: DetentionFeeRecord;
}

class ReviewService {
  submitManualReview(request: ManualReviewRequest): ReviewResponse {
    const record = storageService.findByBillOfLadingAndContainer(
      request.billOfLadingNo,
      request.containerNo,
      request.portCode
    );

    if (!record) {
      return {
        success: false,
        message: '未找到对应的滞箱费用记录'
      };
    }

    if (!record.requiresManualRemark) {
      return {
        success: false,
        message: '该记录不需要人工审核备注'
      };
    }

    if (!request.manualRemark || request.manualRemark.trim().length === 0) {
      return {
        success: false,
        message: '人工备注不能为空，请说明费用明细一致性情况'
      };
    }

    const updatedRecord: DetentionFeeRecord = {
      ...record,
      manualRemark: request.manualRemark,
      requiresManualRemark: false,
      status: DetentionFeeStatus.PENDING_REVIEW,
      reviewedBy: request.operatorId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedRecord = storageService.save(updatedRecord);

    return {
      success: true,
      message: '人工备注已提交，记录已进入待审核状态',
      record: savedRecord
    };
  }

  getPendingReviewRecords(): DetentionFeeRecord[] {
    return storageService.findAll().filter(r => r.requiresManualRemark);
  }

  getReviewedRecords(): DetentionFeeRecord[] {
    return storageService.findAll().filter(r => !r.requiresManualRemark && r.manualRemark);
  }
}

export const reviewService = new ReviewService();
