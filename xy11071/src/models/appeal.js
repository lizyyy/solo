const moment = require('moment');

const STATUS = {
  NORMAL: '正常',
  REJECTED: '驳回',
  SUPPLEMENTARY: '补录',
  COMPLETED: '已完成'
};

let appeals = [];
let nextId = 1;

class Appeal {
  constructor(data) {
    this.id = nextId++;
    this.trackingNumber = data.trackingNumber;
    this.recipientName = data.recipientName;
    this.recipientPhone = data.recipientPhone;
    this.storeId = data.storeId;
    this.storeName = data.storeName;
    this.pickupCode = data.pickupCode;
    this.pickupTime = data.pickupTime || moment().format('YYYY-MM-DD HH:mm:ss');
    this.pickupPerson = data.pickupPerson;
    this.pickupPersonIdCard = data.pickupPersonIdCard;
    this.pickupPersonPhone = data.pickupPersonPhone;
    this.pickupPersonRelation = data.pickupPersonRelation;
    this.applicantName = data.applicantName;
    this.applicantPhone = data.applicantPhone;
    this.appealTime = data.appealTime || moment().format('YYYY-MM-DD HH:mm:ss');
    this.appealReason = data.appealReason;
    this.appealDescription = data.appealDescription;
    this.status = data.status || STATUS.NORMAL;
    this.handler = data.handler;
    this.handleTime = data.handleTime;
    this.handleRemark = data.handleRemark;
    this.evidenceImages = data.evidenceImages || [];
    this.supplementaryInfo = data.supplementaryInfo;
    this.createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
  }

  static create(data) {
    const appeal = new Appeal(data);
    appeals.push(appeal);
    return appeal;
  }

  static findById(id) {
    return appeals.find(a => a.id === parseInt(id));
  }

  static findAll(filters = {}) {
    let result = [...appeals];

    if (filters.startDate) {
      result = result.filter(a => moment(a.appealTime).isSameOrAfter(moment(filters.startDate)));
    }

    if (filters.endDate) {
      result = result.filter(a => moment(a.appealTime).isSameOrBefore(moment(filters.endDate)));
    }

    if (filters.status) {
      result = result.filter(a => a.status === filters.status);
    }

    if (filters.handler) {
      result = result.filter(a => a.handler === filters.handler);
    }

    if (filters.storeId) {
      result = result.filter(a => a.storeId === filters.storeId);
    }

    if (filters.storeName) {
      result = result.filter(a => a.storeName.includes(filters.storeName));
    }

    return result;
  }

  static update(id, data) {
    const appeal = this.findById(id);
    if (!appeal) return null;

    Object.assign(appeal, data);
    appeal.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    return appeal;
  }

  static delete(id) {
    const index = appeals.findIndex(a => a.id === parseInt(id));
    if (index === -1) return false;
    appeals.splice(index, 1);
    return true;
  }

  static batchImport(dataList) {
    const results = [];
    const pickupCodeMap = new Map();

    appeals.forEach(a => {
      if (!pickupCodeMap.has(a.pickupCode)) {
        pickupCodeMap.set(a.pickupCode, []);
      }
      pickupCodeMap.get(a.pickupCode).push(a);
    });

    dataList.forEach((data, index) => {
      try {
        const existingAppeals = pickupCodeMap.get(data.pickupCode) || [];
        const hasFamilyPickup = existingAppeals.some(a => 
          a.pickupPersonRelation && 
          ['家人', '亲属', '配偶', '父母', '子女'].includes(a.pickupPersonRelation)
        );

        const appeal = new Appeal(data);
        
        if (hasFamilyPickup) {
          appeal.supplementaryInfo = `注意：取件码${data.pickupCode}已有代取记录`;
        }

        appeals.push(appeal);
        
        if (!pickupCodeMap.has(data.pickupCode)) {
          pickupCodeMap.set(data.pickupCode, []);
        }
        pickupCodeMap.get(data.pickupCode).push(appeal);

        results.push({
          row: index + 1,
          success: true,
          id: appeal.id,
          trackingNumber: appeal.trackingNumber,
          pickupCode: appeal.pickupCode,
          warning: hasFamilyPickup ? '该取件码存在家人代取记录，请核实' : null
        });
      } catch (error) {
        results.push({
          row: index + 1,
          success: false,
          trackingNumber: data.trackingNumber,
          pickupCode: data.pickupCode,
          error: error.message
        });
      }
    });

    return results;
  }
}

module.exports = { Appeal, STATUS };
