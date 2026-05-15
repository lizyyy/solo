const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const CALLBACK_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  NEED_REVIEW: 'need_review',
  REVIEWED: 'reviewed',
  RED_FLUSHED: 'red_flushed'
};

const PLATFORM_TYPES = {
  BAIWANG: 'baiwang',
  JINSUI: 'jinsui',
  UKONG: 'ukong'
};

const REVIEW_REASONS = {
  CALLBACK_TIMEOUT: 'callback_timeout',
  INVALID_DATA: 'invalid_data',
  DUPLICATE_REQUEST: 'duplicate_request',
  PLATFORM_ERROR: 'platform_error',
  MANUAL_ADJUST: 'manual_adjust'
};

class Invoice {
  constructor(data) {
    this.id = uuidv4();
    this.requestId = data.requestId || uuidv4();
    this.platform = data.platform;
    this.businessNo = data.businessNo;
    this.buyerName = data.buyerName;
    this.amount = data.amount;
    this.callbackStatus = CALLBACK_STATUS.PENDING;
    this.reviewReason = null;
    this.reviewer = null;
    this.reviewTime = null;
    this.reviewComment = null;
    this.redFlushRecordId = null;
    this.downloadUrl = null;
    this.invoiceCode = null;
    this.invoiceNo = null;
    this.callbackAttempts = 0;
    this.lastCallbackTime = null;
    this.compensated = false;
    this.compensationTime = null;
    this.timeline = [];
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    
    this.addTimeline('CREATE', '开票请求已创建');
  }

  addTimeline(action, description, operator = 'system', extra = {}) {
    this.timeline.unshift({
      id: uuidv4(),
      action,
      description,
      operator,
      timestamp: moment().toISOString(),
      ...extra
    });
    this.updatedAt = moment().toISOString();
  }

  updateStatus(status, description, operator = 'system') {
    this.callbackStatus = status;
    this.addTimeline('STATUS_CHANGE', description, operator, { newStatus: status });
  }

  incrementCallbackAttempt() {
    this.callbackAttempts++;
    this.lastCallbackTime = moment().toISOString();
  }

  markForReview(reason, comment = '') {
    this.callbackStatus = CALLBACK_STATUS.NEED_REVIEW;
    this.reviewReason = reason;
    this.addTimeline('MARK_FOR_REVIEW', `标记为待人工复核: ${reason}`, 'system', { reason });
  }

  review(reviewer, comment, approve = true) {
    this.reviewer = reviewer;
    this.reviewTime = moment().toISOString();
    this.reviewComment = comment;
    
    if (approve) {
      this.callbackStatus = CALLBACK_STATUS.REVIEWED;
      this.addTimeline('REVIEW_APPROVE', `复核通过: ${comment}`, reviewer);
    } else {
      this.callbackStatus = CALLBACK_STATUS.PENDING;
      this.addTimeline('REVIEW_REJECT', `复核驳回，重新处理: ${comment}`, reviewer);
    }
  }

  setRedFlush(redFlushId, relatedInvoiceId) {
    this.redFlushRecordId = redFlushId;
    this.callbackStatus = CALLBACK_STATUS.RED_FLUSHED;
    this.addTimeline('RED_FLUSH', '发票已红冲', 'system', { redFlushId, relatedInvoiceId });
  }

  setDownloadUrl(url, invoiceCode, invoiceNo) {
    this.downloadUrl = url;
    this.invoiceCode = invoiceCode;
    this.invoiceNo = invoiceNo;
    this.addTimeline('INVOICE_ISSUED', '发票已开具成功', 'system', { invoiceCode, invoiceNo });
  }

  markCompensated() {
    this.compensated = true;
    this.compensationTime = moment().toISOString();
    this.addTimeline('COMPENSATION', '状态补偿执行成功', 'system');
  }

  toJSON() {
    return {
      id: this.id,
      requestId: this.requestId,
      platform: this.platform,
      businessNo: this.businessNo,
      buyerName: this.buyerName,
      amount: this.amount,
      callbackStatus: this.callbackStatus,
      reviewReason: this.reviewReason,
      reviewer: this.reviewer,
      reviewTime: this.reviewTime,
      reviewComment: this.reviewComment,
      redFlushRecordId: this.redFlushRecordId,
      downloadUrl: this.downloadUrl,
      invoiceCode: this.invoiceCode,
      invoiceNo: this.invoiceNo,
      callbackAttempts: this.callbackAttempts,
      lastCallbackTime: this.lastCallbackTime,
      compensated: this.compensated,
      compensationTime: this.compensationTime,
      timeline: this.timeline,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  Invoice,
  CALLBACK_STATUS,
  PLATFORM_TYPES,
  REVIEW_REASONS
};
