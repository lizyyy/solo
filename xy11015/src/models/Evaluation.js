const { v4: uuidv4 } = require('uuid');

const STATUS_ENUMS = ['待评价', '已评价', '已回访', '已归档', '异常'];

const RATING_ENUMS = ['非常满意', '满意', '一般', '不满意', '非常不满意'];

const SERVICE_TYPES = ['日常保洁', '深度保洁', '育儿嫂', '月嫂', '老人看护', '钟点工'];

class Evaluation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.orderNo = data.orderNo;
    this.storeId = data.storeId;
    this.storeName = data.storeName;
    this.managerId = data.managerId;
    this.managerName = data.managerName;
    this.auntId = data.auntId;
    this.auntName = data.auntName;
    this.auntPhone = data.auntPhone;
    this.customerId = data.customerId;
    this.customerName = data.customerName;
    this.customerPhone = data.customerPhone;
    this.customerAddress = data.customerAddress;
    this.serviceType = data.serviceType;
    this.trialDate = data.trialDate;
    this.trialDuration = data.trialDuration;
    this.status = data.status || '待评价';
    this.overallRating = data.overallRating;
    this.cleanlinessRating = data.cleanlinessRating;
    this.attitudeRating = data.attitudeRating;
    this.punctualityRating = data.punctualityRating;
    this.skillRating = data.skillRating;
    this.comment = data.comment || '';
    this.negativeTags = data.negativeTags || [];
    this.positiveTags = data.positiveTags || [];
    this.wouldRecommend = data.wouldRecommend;
    this.returnVisitRequired = data.returnVisitRequired || false;
    this.returnVisitSummary = data.returnVisitSummary || '';
    this.returnVisitDate = data.returnVisitDate;
    this.returnVisitPerson = data.returnVisitPerson;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static validate(data) {
    const errors = [];

    if (!data.orderNo) {
      errors.push('订单号不能为空');
    }

    if (!data.storeId || !data.storeName) {
      errors.push('门店信息不能为空');
    }

    if (!data.auntId || !data.auntName) {
      errors.push('阿姨信息不能为空');
    }

    if (!data.customerId || !data.customerName) {
      errors.push('客户信息不能为空');
    }

    if (!data.trialDate) {
      errors.push('试工日期不能为空');
    }

    if (data.status && !STATUS_ENUMS.includes(data.status)) {
      errors.push(`状态值无效，必须是: ${STATUS_ENUMS.join(', ')}`);
    }

    if (data.serviceType && !SERVICE_TYPES.includes(data.serviceType)) {
      errors.push(`服务类型无效，必须是: ${SERVICE_TYPES.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      orderNo: this.orderNo,
      storeId: this.storeId,
      storeName: this.storeName,
      managerId: this.managerId,
      managerName: this.managerName,
      auntId: this.auntId,
      auntName: this.auntName,
      auntPhone: this.auntPhone,
      customerId: this.customerId,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerAddress: this.customerAddress,
      serviceType: this.serviceType,
      trialDate: this.trialDate,
      trialDuration: this.trialDuration,
      status: this.status,
      overallRating: this.overallRating,
      cleanlinessRating: this.cleanlinessRating,
      attitudeRating: this.attitudeRating,
      punctualityRating: this.punctualityRating,
      skillRating: this.skillRating,
      comment: this.comment,
      negativeTags: this.negativeTags,
      positiveTags: this.positiveTags,
      wouldRecommend: this.wouldRecommend,
      returnVisitRequired: this.returnVisitRequired,
      returnVisitSummary: this.returnVisitSummary,
      returnVisitDate: this.returnVisitDate,
      returnVisitPerson: this.returnVisitPerson,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

Evaluation.STATUS_ENUMS = STATUS_ENUMS;
Evaluation.RATING_ENUMS = RATING_ENUMS;
Evaluation.SERVICE_TYPES = SERVICE_TYPES;

module.exports = Evaluation;
