const { PLANT_STATUSES, MAINTENANCE_STATUSES, COMPENSATION_STATUSES, RENEWAL_STATUSES, BILL_STATUSES } = require('../utils/constants');

class StateMachineService {
  static PLANT_STATUS_TRANSITIONS = {
    [PLANT_STATUSES.HEALTHY]: [PLANT_STATUSES.NEEDS_CARE, PLANT_STATUSES.REPOTTED, PLANT_STATUSES.MOVED],
    [PLANT_STATUSES.NEEDS_CARE]: [PLANT_STATUSES.HEALTHY, PLANT_STATUSES.WILTED, PLANT_STATUSES.REPOTTED, PLANT_STATUSES.MOVED],
    [PLANT_STATUSES.WILTED]: [PLANT_STATUSES.HEALTHY, PLANT_STATUSES.DEAD, PLANT_STATUSES.REPOTTED],
    [PLANT_STATUSES.DEAD]: [],
    [PLANT_STATUSES.REPOTTED]: [PLANT_STATUSES.HEALTHY, PLANT_STATUSES.NEEDS_CARE, PLANT_STATUSES.MOVED],
    [PLANT_STATUSES.MOVED]: [PLANT_STATUSES.HEALTHY, PLANT_STATUSES.NEEDS_CARE, PLANT_STATUSES.REPOTTED]
  };

  static MAINTENANCE_STATUS_TRANSITIONS = {
    [MAINTENANCE_STATUSES.PENDING]: [MAINTENANCE_STATUSES.IN_PROGRESS, MAINTENANCE_STATUSES.CANCELLED],
    [MAINTENANCE_STATUSES.IN_PROGRESS]: [MAINTENANCE_STATUSES.COMPLETED, MAINTENANCE_STATUSES.NEEDS_REPOTTING, MAINTENANCE_STATUSES.NEEDS_COMPENSATION, MAINTENANCE_STATUSES.CANCELLED],
    [MAINTENANCE_STATUSES.COMPLETED]: [],
    [MAINTENANCE_STATUSES.CANCELLED]: [],
    [MAINTENANCE_STATUSES.NEEDS_REPOTTING]: [MAINTENANCE_STATUSES.COMPLETED],
    [MAINTENANCE_STATUSES.NEEDS_COMPENSATION]: [MAINTENANCE_STATUSES.COMPLETED]
  };

  static COMPENSATION_STATUS_TRANSITIONS = {
    [COMPENSATION_STATUSES.PENDING]: [COMPENSATION_STATUSES.APPROVED, COMPENSATION_STATUSES.WAIVED],
    [COMPENSATION_STATUSES.APPROVED]: [COMPENSATION_STATUSES.PAID],
    [COMPENSATION_STATUSES.PAID]: [],
    [COMPENSATION_STATUSES.WAIVED]: []
  };

  static RENEWAL_STATUS_TRANSITIONS = {
    [RENEWAL_STATUSES.PENDING]: [RENEWAL_STATUSES.CONFIRMED, RENEWAL_STATUSES.CANCELLED],
    [RENEWAL_STATUSES.CONFIRMED]: [RENEWAL_STATUSES.BILLED, RENEWAL_STATUSES.CANCELLED],
    [RENEWAL_STATUSES.CANCELLED]: [],
    [RENEWAL_STATUSES.BILLED]: []
  };

  static BILL_STATUS_TRANSITIONS = {
    [BILL_STATUSES.DRAFT]: [BILL_STATUSES.ISSUED],
    [BILL_STATUSES.ISSUED]: [BILL_STATUSES.PAID, BILL_STATUSES.OVERDUE],
    [BILL_STATUSES.PAID]: [],
    [BILL_STATUSES.OVERDUE]: [BILL_STATUSES.PAID]
  };

  static canTransitionPlant(currentStatus, nextStatus) {
    const allowed = this.PLANT_STATUS_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  static canTransitionMaintenance(currentStatus, nextStatus) {
    const allowed = this.MAINTENANCE_STATUS_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  static canTransitionCompensation(currentStatus, nextStatus) {
    const allowed = this.COMPENSATION_STATUS_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  static canTransitionRenewal(currentStatus, nextStatus) {
    const allowed = this.RENEWAL_STATUS_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  static canTransitionBill(currentStatus, nextStatus) {
    const allowed = this.BILL_STATUS_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  static validatePlantTransition(currentStatus, nextStatus) {
    if (!this.canTransitionPlant(currentStatus, nextStatus)) {
      throw new Error(`植物状态流转无效: ${currentStatus} -> ${nextStatus}`);
    }
    return true;
  }

  static validateMaintenanceTransition(currentStatus, nextStatus) {
    if (!this.canTransitionMaintenance(currentStatus, nextStatus)) {
      throw new Error(`养护任务状态流转无效: ${currentStatus} -> ${nextStatus}`);
    }
    return true;
  }

  static validateCompensationTransition(currentStatus, nextStatus) {
    if (!this.canTransitionCompensation(currentStatus, nextStatus)) {
      throw new Error(`赔偿状态流转无效: ${currentStatus} -> ${nextStatus}`);
    }
    return true;
  }

  static validateRenewalTransition(currentStatus, nextStatus) {
    if (!this.canTransitionRenewal(currentStatus, nextStatus)) {
      throw new Error(`续租合同状态流转无效: ${currentStatus} -> ${nextStatus}`);
    }
    return true;
  }

  static validateBillTransition(currentStatus, nextStatus) {
    if (!this.canTransitionBill(currentStatus, nextStatus)) {
      throw new Error(`账单状态流转无效: ${currentStatus} -> ${nextStatus}`);
    }
    return true;
  }
}

module.exports = StateMachineService;
