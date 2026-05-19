const dataStore = require('../store/dataStore');
const { CALLBACK_STATUS, REVIEW_REASONS } = require('../models/Invoice');
const moment = require('moment');

const CALLBACK_TIMEOUT_MINUTES = 30;
const MAX_CALLBACK_ATTEMPTS = 5;

class InvoiceService {
  createInvoice(invoiceData) {
    if (!invoiceData.platform || !invoiceData.businessNo || !invoiceData.amount) {
      throw new Error('缺少必填字段: platform, businessNo, amount');
    }
    return dataStore.addInvoice(invoiceData);
  }

  getInvoice(id) {
    return dataStore.getInvoice(id);
  }

  getInvoiceByRequestId(requestId) {
    return dataStore.getInvoiceByRequestId(requestId);
  }

  queryInvoices(filters) {
    return dataStore.queryInvoices(filters);
  }

  processCallback(requestId, callbackData) {
    const invoice = dataStore.getInvoiceByRequestId(requestId);
    if (!invoice) {
      throw new Error('开票请求不存在');
    }

    invoice.incrementCallbackAttempt();

    if (callbackData.success) {
      invoice.updateStatus(CALLBACK_STATUS.SUCCESS, '回调成功');
      if (callbackData.downloadUrl && callbackData.invoiceCode && callbackData.invoiceNo) {
        invoice.setDownloadUrl(
          callbackData.downloadUrl,
          callbackData.invoiceCode,
          callbackData.invoiceNo
        );
      }
    } else {
      if (invoice.callbackAttempts >= MAX_CALLBACK_ATTEMPTS) {
        invoice.markForReview(REVIEW_REASONS.PLATFORM_ERROR, `回调失败${MAX_CALLBACK_ATTEMPTS}次`);
      } else {
        invoice.updateStatus(CALLBACK_STATUS.FAILED, `回调失败: ${callbackData.error || '未知错误'}`);
      }
    }

    return invoice;
  }

  checkTimeoutInvoices() {
    const now = moment();
    const timeoutInvoices = [];

    for (const invoice of dataStore.getAllInvoices()) {
      if (invoice.callbackStatus === CALLBACK_STATUS.PENDING || 
          invoice.callbackStatus === CALLBACK_STATUS.PROCESSING) {
        const createdTime = moment(invoice.createdAt);
        const diffMinutes = now.diff(createdTime, 'minutes');
        
        if (diffMinutes > CALLBACK_TIMEOUT_MINUTES && !invoice.compensated) {
          invoice.markForReview(REVIEW_REASONS.CALLBACK_TIMEOUT, `回调超时${diffMinutes}分钟`);
          timeoutInvoices.push(invoice);
        }
      }
    }

    return timeoutInvoices;
  }

  compensateStatus(invoiceId, statusData) {
    const invoice = dataStore.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('发票记录不存在');
    }

    if (statusData.callbackStatus) {
      invoice.updateStatus(statusData.callbackStatus, '状态补偿更新');
    }
    if (statusData.downloadUrl && statusData.invoiceCode && statusData.invoiceNo) {
      invoice.setDownloadUrl(
        statusData.downloadUrl,
        statusData.invoiceCode,
        statusData.invoiceNo
      );
    }

    invoice.markCompensated();
    return invoice;
  }

  reviewInvoice(invoiceId, reviewData) {
    const invoice = dataStore.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('发票记录不存在');
    }

    if (invoice.callbackStatus !== CALLBACK_STATUS.NEED_REVIEW) {
      throw new Error('当前状态不允许复核');
    }

    if (!reviewData.reviewer || !reviewData.comment) {
      throw new Error('缺少复核人或复核意见');
    }

    invoice.review(reviewData.reviewer, reviewData.comment, reviewData.approve !== false);
    return invoice;
  }

  createRedFlush(redFlushData) {
    if (!redFlushData.originalInvoiceId || !redFlushData.reason || !redFlushData.operator) {
      throw new Error('缺少必填字段: originalInvoiceId, reason, operator');
    }

    const originalInvoice = dataStore.getInvoice(redFlushData.originalInvoiceId);
    if (!originalInvoice) {
      throw new Error('原发票记录不存在');
    }

    const record = dataStore.addRedFlushRecord({
      ...redFlushData,
      originalRequestId: originalInvoice.requestId
    });

    originalInvoice.setRedFlush(record.id, redFlushData.originalInvoiceId);
    return record;
  }

  getInvoiceDownloadUrl(invoiceId) {
    const invoice = dataStore.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('发票记录不存在');
    }

    if (!invoice.downloadUrl) {
      throw new Error('发票下载链接未生成');
    }

    if (invoice.callbackStatus !== CALLBACK_STATUS.SUCCESS && 
        invoice.callbackStatus !== CALLBACK_STATUS.REVIEWED) {
      throw new Error('发票状态不允许下载');
    }

    return {
      downloadUrl: invoice.downloadUrl,
      invoiceCode: invoice.invoiceCode,
      invoiceNo: invoice.invoiceNo
    };
  }

  exportInvoices(filters) {
    const invoices = dataStore.queryInvoices(filters);
    return invoices.map(inv => ({
      requestId: inv.requestId,
      platform: inv.platform,
      businessNo: inv.businessNo,
      buyerName: inv.buyerName,
      amount: inv.amount,
      callbackStatus: inv.callbackStatus,
      reviewReason: inv.reviewReason,
      invoiceCode: inv.invoiceCode,
      invoiceNo: inv.invoiceNo,
      createdAt: inv.createdAt,
      reviewTime: inv.reviewTime
    }));
  }

  batchImport(invoiceList) {
    const results = {
      success: [],
      failed: []
    };

    for (const item of invoiceList) {
      try {
        const invoice = this.createInvoice(item);
        results.success.push({
          businessNo: item.businessNo,
          requestId: invoice.requestId
        });
      } catch (error) {
        results.failed.push({
          businessNo: item.businessNo,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new InvoiceService();
