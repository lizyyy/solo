const dayjs = require('dayjs');
const {
  SUPPLEMENT_REASON,
  MAX_SUPPLEMENT_ATTEMPTS,
  SUPPLEMENT_TIMEOUT_HOURS
} = require('../config/constants');

function validateIdCard(idNumber) {
  if (!idNumber) {
    return { valid: false, reason: '身份证号不能为空' };
  }
  if (!/^\d{17}[\dXx]$/.test(idNumber)) {
    return { valid: false, reason: '身份证号格式不正确' };
  }
  return { valid: true };
}

function validateIdExpiry(expiryDate) {
  if (!expiryDate) {
    return { valid: false, reason: '证件有效期不能为空' };
  }
  const expiry = dayjs(expiryDate);
  if (!expiry.isValid()) {
    return { valid: false, reason: '证件有效期格式不正确' };
  }
  if (expiry.isBefore(dayjs())) {
    return { valid: false, reason: '证件已过期', expiryDate: expiryDate };
  }
  return { valid: true };
}

function validateTaxCodeFormat(taxCode) {
  if (!taxCode) {
    return { valid: false, reason: '税号不能为空' };
  }
  if (!/^\d{8,10}$/.test(taxCode)) {
    return { valid: false, reason: '税号格式不正确，应为8-10位数字' };
  }
  return { valid: true };
}

function validateTaxCodeCategory(taxCode, categoryCode, validTaxCodes) {
  const taxCodeInfo = validTaxCodes.find(t => t.tax_code === taxCode);
  if (!taxCodeInfo) {
    return { valid: false, reason: `税号 ${taxCode} 未在系统中登记` };
  }
  if (!taxCodeInfo.is_active) {
    return { valid: false, reason: `税号 ${taxCode} 已停用` };
  }
  if (taxCodeInfo.category_code !== categoryCode) {
    return {
      valid: false,
      reason: `税号 ${taxCode} 与品类 ${categoryCode} 不匹配，该税号对应品类为 ${taxCodeInfo.category_code}`,
      expectedCategory: taxCodeInfo.category_code,
      actualCategory: categoryCode
    };
  }
  return { valid: true, taxCodeInfo };
}

function checkSupplementTimeout(supplement) {
  if (!supplement.deadline_at) return false;
  return dayjs().isAfter(dayjs(supplement.deadline_at));
}

function canRequestSupplement(supplements) {
  const activeSupplement = supplements.find(s => 
    s.status === 'requested' || s.status === 'submitted'
  );
  if (activeSupplement) {
    return {
      canRequest: false,
      reason: `存在未完成的补件申请（编号：${activeSupplement.supplement_no}）`,
      activeSupplement
    };
  }
  const totalAttempts = supplements.length;
  if (totalAttempts >= MAX_SUPPLEMENT_ATTEMPTS) {
    return {
      canRequest: false,
      reason: `补件次数已达上限（${MAX_SUPPLEMENT_ATTEMPTS}次）`,
      totalAttempts
    };
  }
  return { canRequest: true };
}

function isDuplicateSupplement(orderId, reasonCode, supplements) {
  const sameReasonSupplement = supplements.find(
    s => s.order_id === orderId && s.reason_code === reasonCode
  );
  return !!sameReasonSupplement;
}

function canShip(orderStatus, checkpoints) {
  const approvedCheckpoint = checkpoints.find(
    c => c.checkpoint_type === 'approval' && c.passed === 1
  );
  if (orderStatus !== 'approved' || !approvedCheckpoint) {
    return {
      canShip: false,
      reason: '订单未通过清关审核，无法出库',
      orderStatus,
      hasApproval: !!approvedCheckpoint
    };
  }
  return { canShip: true };
}

function precheckOrder(order, items, documents, validTaxCodes) {
  const issues = [];
  
  if (!order.receiver_id_number) {
    issues.push({
      type: 'document',
      reasonCode: SUPPLEMENT_REASON.MISSING_ID_PHOTO,
      reasonText: '收件人身份证照片缺失',
      field: 'receiver_id_number'
    });
  } else {
    const idCheck = validateIdCard(order.receiver_id_number);
    if (!idCheck.valid) {
      issues.push({
        type: 'document',
        reasonCode: SUPPLEMENT_REASON.ID_NOT_MATCH,
        reasonText: idCheck.reason,
        field: 'receiver_id_number'
      });
    }
  }
  
  if (order.receiver_id_expiry_date) {
    const expiryCheck = validateIdExpiry(order.receiver_id_expiry_date);
    if (!expiryCheck.valid) {
      issues.push({
        type: 'document',
        reasonCode: SUPPLEMENT_REASON.ID_EXPIRED,
        reasonText: expiryCheck.reason,
        field: 'receiver_id_expiry_date'
      });
    }
  }
  
  const idPhotoDoc = documents.find(d => d.doc_type === 'id_photo');
  if (!idPhotoDoc || idPhotoDoc.verified_status !== 'passed') {
    issues.push({
      type: 'document',
      reasonCode: SUPPLEMENT_REASON.MISSING_ID_PHOTO,
      reasonText: '身份证照片未上传或未通过验证',
      field: 'id_photo_document'
    });
  }
  
  items.forEach((item, index) => {
    if (!item.tax_code) {
      issues.push({
        type: 'taxcode',
        reasonCode: SUPPLEMENT_REASON.INVALID_TAXCODE,
        reasonText: `商品"${item.product_name}"(SKU:${item.sku_code})税号缺失`,
        field: `items[${index}].tax_code`,
        itemIndex: index
      });
    } else {
      const formatCheck = validateTaxCodeFormat(item.tax_code);
      if (!formatCheck.valid) {
        issues.push({
          type: 'taxcode',
          reasonCode: SUPPLEMENT_REASON.INVALID_TAXCODE,
          reasonText: `商品"${item.product_name}"${formatCheck.reason}`,
          field: `items[${index}].tax_code`,
          itemIndex: index
        });
      } else {
        const categoryCheck = validateTaxCodeCategory(
          item.tax_code,
          item.category_code,
          validTaxCodes
        );
        if (!categoryCheck.valid) {
          issues.push({
            type: 'taxcode',
            reasonCode: SUPPLEMENT_REASON.TAXCODE_CATEGORY_MISMATCH,
            reasonText: categoryCheck.reason,
            field: `items[${index}].tax_code`,
            itemIndex: index,
            expectedCategory: categoryCheck.expectedCategory
          });
        }
      }
    }
  });
  
  return {
    passed: issues.length === 0,
    issueCount: issues.length,
    issues
  };
}

function calculateDeadline(requestedAt) {
  return dayjs(requestedAt).add(SUPPLEMENT_TIMEOUT_HOURS, 'hour').format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  validateIdCard,
  validateIdExpiry,
  validateTaxCodeFormat,
  validateTaxCodeCategory,
  checkSupplementTimeout,
  canRequestSupplement,
  isDuplicateSupplement,
  canShip,
  precheckOrder,
  calculateDeadline
};
