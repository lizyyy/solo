import fs from 'fs';
import csv from 'csv-parser';

export const REFUND_FIELDS = {
  REFUND_NO: '退款单号',
  ORDER_NO: '订单号',
  USER_ID: '用户ID',
  USER_NAME: '用户姓名',
  REFUND_AMOUNT: '退款金额',
  REFUND_TIME: '退款时间',
  REFUND_REASON: '退款原因',
  RISK_TAGS: '风控标签',
  TAG_EXPIRE_TIME: '标签过期时间',
  BLACKLIST_STATUS: '黑名单状态',
  SPLIT_REFUND_FLAG: '拆单退款标记',
  PROCESS_STATUS: '处理状态',
  REVIEW_STATUS: '复核状态',
  REVIEWER: '复核人',
  REVIEW_TIME: '复核时间',
  REMARK: '备注'
};

export async function parseRefundFile(filePath) {
  const results = [];
  const errors = [];
  let rowNumber = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true
      }))
      .on('headers', (headers) => {
        const missingFields = validateHeaders(headers);
        if (missingFields.length > 0) {
          errors.push({
            type: 'HEADER_ERROR',
            message: `缺少必要字段: ${missingFields.join(', ')}`,
            rowNumber: 0
          });
        }
      })
      .on('data', (data) => {
        rowNumber++;
        try {
          const parsed = parseRow(data, rowNumber);
          results.push(parsed);
        } catch (error) {
          errors.push({
            type: 'ROW_PARSE_ERROR',
            message: error.message,
            rowNumber,
            data
          });
        }
      })
      .on('end', () => {
        resolve({
          success: true,
          data: results,
          errors,
          totalRows: rowNumber,
          validRows: results.length,
          invalidRows: errors.filter(e => e.type === 'ROW_PARSE_ERROR').length
        });
      })
      .on('error', (error) => {
        reject({
          success: false,
          error: error.message
        });
      });
  });
}

function validateHeaders(headers) {
  const requiredFields = [
    REFUND_FIELDS.REFUND_NO,
    REFUND_FIELDS.ORDER_NO,
    REFUND_FIELDS.USER_ID,
    REFUND_FIELDS.REFUND_AMOUNT,
    REFUND_FIELDS.REFUND_TIME
  ];
  
  return requiredFields.filter(field => !headers.includes(field));
}

function parseRow(data, rowNumber) {
  const refundNo = data[REFUND_FIELDS.REFUND_NO]?.trim();
  if (!refundNo) {
    throw new Error(`第${rowNumber}行: 退款单号不能为空`);
  }

  const refundAmount = parseFloat(data[REFUND_FIELDS.REFUND_AMOUNT]);
  if (isNaN(refundAmount) || refundAmount < 0) {
    throw new Error(`第${rowNumber}行: 退款金额格式错误或为负数`);
  }

  const refundTime = data[REFUND_FIELDS.REFUND_TIME]?.trim();
  if (!refundTime || !isValidDate(refundTime)) {
    throw new Error(`第${rowNumber}行: 退款时间格式错误`);
  }

  return {
    refundNo,
    orderNo: data[REFUND_FIELDS.ORDER_NO]?.trim() || '',
    userId: data[REFUND_FIELDS.USER_ID]?.trim() || '',
    userName: data[REFUND_FIELDS.USER_NAME]?.trim() || '',
    refundAmount,
    refundTime: parseDate(refundTime),
    refundReason: data[REFUND_FIELDS.REFUND_REASON]?.trim() || '',
    riskTags: parseTags(data[REFUND_FIELDS.RISK_TAGS]),
    tagExpireTime: parseDate(data[REFUND_FIELDS.TAG_EXPIRE_TIME]?.trim()),
    blacklistStatus: data[REFUND_FIELDS.BLACKLIST_STATUS]?.trim() || '',
    splitRefundFlag: data[REFUND_FIELDS.SPLIT_REFUND_FLAG]?.trim() || 'N',
    processStatus: data[REFUND_FIELDS.PROCESS_STATUS]?.trim() || '',
    reviewStatus: data[REFUND_FIELDS.REVIEW_STATUS]?.trim() || '',
    reviewer: data[REFUND_FIELDS.REVIEWER]?.trim() || '',
    reviewTime: parseDate(data[REFUND_FIELDS.REVIEW_TIME]?.trim()),
    remark: data[REFUND_FIELDS.REMARK]?.trim() || '',
    rowNumber
  };
}

function parseTags(tagsStr) {
  if (!tagsStr) return [];
  return tagsStr.split(/[,，;；]/).map(t => t.trim()).filter(Boolean);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
