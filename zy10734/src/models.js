class RedispatchRecord {
  constructor(data) {
    this.orderId = data.orderId || data.订单编号;
    this.originalRiderId = data.originalRiderId || data.原骑手ID;
    this.originalRiderName = data.originalRiderName || data.原骑手姓名;
    this.newRiderId = data.newRiderId || data.新骑手ID;
    this.newRiderName = data.newRiderName || data.新骑手姓名;
    this.redispatchTime = data.redispatchTime || data.改派时间;
    this.redispatchReason = data.redispatchReason || data.改派原因;
    this.redispatchType = data.redispatchType || data.改派类型;
    this.compensationAmount = parseFloat(data.compensationAmount || data.补偿金额 || 0);
    this.isSystemRedispatch = (data.redispatchType || data.改派类型) === '系统改派';
    this.isRiderRejection = (data.redispatchReason || data.改派原因)?.includes('拒单') || false;
  }

  validate() {
    const errors = [];
    if (!this.orderId) errors.push('订单编号不能为空');
    if (!this.originalRiderId) errors.push('原骑手ID不能为空');
    if (!this.newRiderId) errors.push('新骑手ID不能为空');
    if (!this.redispatchTime) errors.push('改派时间不能为空');
    return errors;
  }
}

class RiderSettlement {
  constructor(data) {
    this.riderId = data.riderId || data.骑手ID;
    this.riderName = data.riderName || data.骑手姓名;
    this.settlementDate = data.settlementDate || data.结算日期;
    this.totalOrders = parseInt(data.totalOrders || data.总订单数 || 0);
    this.totalCompensation = parseFloat(data.totalCompensation || data.总补偿金额 || 0);
    this.compensatedOrders = [];
    
    const orderList = data['已补偿订单列表'] || data.compensatedOrders || '';
    if (orderList) {
      this.compensatedOrders = orderList.split(';').map(o => o.trim()).filter(o => o);
    }
  }

  hasBeenCompensated(orderId) {
    return this.compensatedOrders.includes(orderId);
  }
}

class RejectionReason {
  constructor(data) {
    this.reasonCode = data.reasonCode || data.原因编码;
    this.reasonName = data.reasonName || data.原因名称;
    this.compensationRate = parseFloat(data.compensationRate || data.补偿系数 || 0);
    this.fixedCompensation = parseFloat(data.fixedCompensation || data.固定补偿金额 || 0);
    this.isCompensable = (data.isCompensable || data.是否可补偿) === '是' || this.compensationRate > 0 || this.fixedCompensation > 0;
  }

  calculateCompensation(baseAmount) {
    if (this.fixedCompensation > 0) {
      return this.fixedCompensation;
    }
    return baseAmount * this.compensationRate;
  }
}

class CompensationResult {
  constructor(data) {
    this.orderId = data.orderId;
    this.orderId_Display = `改派订单_${data.orderId}`;
    this.originalRiderId = data.originalRiderId;
    this.originalRiderName = data.originalRiderName;
    this.newRiderId = data.newRiderId;
    this.newRiderName = data.newRiderName;
    this.redispatchTime = data.redispatchTime;
    this.redispatchType = data.redispatchType;
    this.redispatchReason = data.redispatchReason;
    this.calculatedCompensation = data.calculatedCompensation || 0;
    this.previousCompensation = data.previousCompensation || 0;
    this.finalCompensation = data.finalCompensation || 0;
    this.compensationStatus = data.compensationStatus || '待核算';
    this.compensationRemark = data.compensationRemark || '';
    this.isDuplicate = data.isDuplicate || false;
    this.isError = data.isError || false;
    this.errorMessage = data.errorMessage || '';
  }
}

module.exports = {
  RedispatchRecord,
  RiderSettlement,
  RejectionReason,
  CompensationResult
};
