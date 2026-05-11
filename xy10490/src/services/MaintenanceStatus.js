const moment = require('moment');

class MaintenanceStatus {
  static calculateOverdueHours(currentHours, deadlineHours) {
    if (currentHours <= deadlineHours) return 0;
    return Math.floor(currentHours - deadlineHours);
  }

  static calculateOverdueDays(currentDate, deadlineDate) {
    const current = moment(currentDate);
    const deadline = moment(deadlineDate);
    if (current.isSameOrBefore(deadline, 'day')) return 0;
    return current.diff(deadline, 'days');
  }

  static isPlanOverdue(plan, currentHours, currentDate = new Date()) {
    if (plan.cycleType === 'hour') {
      if (plan.deadlineHours === undefined || plan.deadlineHours === null) return false;
      return currentHours > plan.deadlineHours;
    } else {
      if (!plan.deadlineDate === undefined || plan.deadlineDate === null) return false;
      return moment(currentDate).isAfter(plan.deadlineDate);
    }
  }

  static getMaintenanceStatus(plan, currentHours, currentDate = new Date()) {
    if (plan.status === 'completed') {
      return { status: 'completed', overdueHours: 0, overdueDays: 0, overdue: false;
    }
    
    if (plan.status === 'skipped') {
      return { status: 'skipped', overdueHours: 0, overdueDays: 0, overdue: false;
    }

    const isOverdue = this.isPlanOverdue(plan, currentHours, currentDate);
    
    let overdueHours = 0;
    let overdueDays = 0;

    if (isOverdue) {
      if (plan.cycleType === 'hour') {
        overdueHours = this.calculateOverdueHours(currentHours, plan.deadlineHours);
      } else {
        overdueDays = this.calculateOverdueDays(currentDate, plan.deadlineDate);
      }
    }

    return {
      status: isOverdue ? 'overdue' : 'pending',
      overdueHours,
      overdueDays,
      overdue: isOverdue
    };
  }

  static calculateNextPlanHours(equipment, completedHours) {
    const { maintenanceCycleType = equipment.maintenanceCycleType;
    const cycleValue = equipment.maintenanceCycleValue;

    if (cycleType === 'hour') {
      return {
        targetHours: completedHours + cycleValue,
        deadlineHours: completedHours + cycleValue,
        targetDate: null,
        deadlineDate: null
      };
    } else {
      const now = new Date();
      const targetDate = moment().add(cycleValue, 'days');
      const deadlineDate = moment().add(cycleValue, 'days');
      return {
        targetHours: null,
        deadlineHours: null,
        targetDate: targetDate.toDate(),
        deadlineDate: deadlineDate.toDate()
      };
    }
  }

  static calculateNextPlanDate(equipment, completedDate) {
    const cycleValue = equipment.maintenanceCycleValue;
    const completedMoment = moment(completedDate);
    const targetDate = completedMoment.add(cycleValue, 'days');
    const deadlineDate = targetDate.clone();

    return {
      targetHours: null,
      deadlineHours: null,
      targetDate: targetDate.toDate(),
      deadlineDate: deadlineDate.toDate()
    };
  }

  static calculateNextPlanAfterSkip(equipment, previousPlan) {
    const cycleValue = equipment.maintenanceCycleValue;

    if (equipment.maintenanceCycleType === 'hour') {
      const currentHours = equipment.currentRunningHours;
      return {
        targetHours: currentHours + cycleValue,
        deadlineHours: currentHours + cycleValue,
        targetDate: null,
        deadlineDate: null
      };
    } else {
      const now = moment();
      const targetDate = now.add(cycleValue, 'days');
      return {
        targetHours: null,
        deadlineHours: null,
        targetDate: targetDate.toDate(),
        deadlineDate: targetDate.toDate()
      };
    }
  }
}

module.exports = MaintenanceStatus;
