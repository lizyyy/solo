const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const feeCalculator = require('./feeCalculator');
const { TRIP_STATUS } = require('../config');

function settleTrip(tripId, idempotencyKey, operator) {
  const existingSettlement = store.getIdempotentRequest(idempotencyKey);
  if (existingSettlement) {
    return {
      isDuplicate: true,
      settlement: existingSettlement.response
    };
  }

  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status !== TRIP_STATUS.COMPLETED) {
    throw new Error(`行程状态为 ${trip.status}，无法结算`);
  }

  if (trip.settled) {
    throw new Error('该行程已结算，请勿重复操作');
  }

  const totalFare = trip.fare.total + trip.cancellationFee;
  const driverIncome = feeCalculator.calculateDriverIncome(totalFare);

  const settlement = {
    id: uuidv4(),
    tripId: trip.id,
    driver: trip.driver,
    department: trip.employee.department,
    totalAmount: totalFare,
    driverIncome,
    companyRevenue: totalFare - driverIncome,
    fareBreakdown: trip.fare.breakdown,
    operator,
    createdAt: new Date().toISOString()
  };

  trip.settled = true;
  trip.settlementId = settlement.id;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.saveSettlement(settlement);
  store.saveIdempotentRequest(idempotencyKey, settlement);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'SETTLE',
    description: '行程已结算',
    details: {
      settlementId: settlement.id,
      totalAmount,
      driverIncome,
      companyRevenue: settlement.companyRevenue
    }
  });

  const department = store.getDepartment(trip.employee.department);
  if (department) {
    department.spent += totalFare;
    department.remaining = department.budget - department.spent;
    store.saveDepartment(department);
  }

  return {
    isDuplicate: false,
    settlement
  };
}

function allocateToDepartments(tripId, allocations, operator) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status !== TRIP_STATUS.COMPLETED) {
    throw new Error(`行程状态为 ${trip.status}，无法分摊`);
  }

  const totalPercent = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (totalPercent !== 100) {
    throw new Error(`分摊比例总和必须为100%，当前为${totalPercent}%`);
  }

  const totalAmount = trip.fare.total + trip.cancellationFee;
  const allocationDetails = allocations.map(a => {
    const amount = (totalAmount * a.percentage) / 100;
    return {
      department: a.department,
      percentage: a.percentage,
      amount: Math.round(amount * 100) / 100
    };
  });

  trip.departmentAllocations = allocationDetails;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'ALLOCATE',
    description: '部门费用已分摊',
    details: {
      operator,
      allocations: allocationDetails
    }
  });

  return trip;
}

function checkDepartmentBudget(deptCode, amount) {
  const dept = store.getDepartment(deptCode);
  if (!dept) {
    throw new Error(`部门 ${deptCode} 不存在`);
  }

  return {
    code: dept.code,
    name: dept.name,
    budget: dept.budget,
    spent: dept.spent,
    remaining: dept.remaining,
    canAfford: dept.remaining >= amount
  };
}

function manualCorrectTrip(tripId, corrections, operator) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  const beforeState = JSON.parse(JSON.stringify(trip));

  if (corrections.waitingMinutes !== undefined) {
    trip.waitingMinutes = corrections.waitingMinutes;
  }
  if (corrections.distanceKm !== undefined) {
    trip.distanceKm = corrections.distanceKm;
  }

  if (trip.status === TRIP_STATUS.COMPLETED) {
    const fare = feeCalculator.calculateTotalFare(
      trip.distanceKm,
      trip.waitingMinutes,
      trip.isIntercity,
      trip.intercityApproval
    );
    trip.fare = fare;
  }

  const afterState = JSON.parse(JSON.stringify(trip));
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addCorrection({
    tripId,
    operator,
    before: beforeState,
    after: afterState,
    changes: corrections,
    reason: corrections.reason || '人工修正'
  });
  store.addHistoryRecord({
    tripId,
    action: 'CORRECT',
    description: '人工修正费用',
    details: {
      operator,
      changes: corrections,
      reason: corrections.reason || '人工修正'
    }
  });

  return trip;
}

function getSettlement(settlementId) {
  return store.getSettlement(settlementId);
}

function getDriverIncomeReport(driverId) {
  const settlements = Object.values(store.getSettlements()).filter(
    s => s.driver && s.driver.id === driverId
  );

  const totalIncome = settlements.reduce((sum, s) => sum + s.driverIncome, 0);
  const totalTrips = settlements.length;

  return {
    driverId,
    totalTrips,
    totalIncome,
    settlements: settlements.map(s => ({
      id: s.id,
      tripId: s.tripId,
      amount: s.driverIncome,
      createdAt: s.createdAt
    }))
  };
}

function getDepartmentReport(deptCode) {
  const trips = Object.values(store.getTrips()).filter(
    t => t.employee.department === deptCode
  );

  const completedTrips = trips.filter(t => t.status === TRIP_STATUS.COMPLETED);
  const cancelledTrips = trips.filter(t => t.status === TRIP_STATUS.CANCELLED);

  const totalTripAmount = completedTrips.reduce(
    (sum, t) => sum + (t.fare ? t.fare.total : 0),
    0
  );
  const totalCancellationFees = cancelledTrips.reduce(
    (sum, t) => sum + t.cancellationFee,
    0
  );

  const dept = store.getDepartment(deptCode);

  return {
    department: deptCode,
    departmentName: dept ? dept.name : deptCode,
    totalTrips: trips.length,
    completedTrips: completedTrips.length,
    cancelledTrips: cancelledTrips.length,
    totalTripAmount,
    totalCancellationFees,
    totalSpent: totalTripAmount + totalCancellationFees,
    budgetInfo: dept ? {
      budget: dept.budget,
      spent: dept.spent,
      remaining: dept.remaining
    } : null,
    trips: trips.map(t => ({
      id: t.id,
      status: t.status,
      employee: t.employee.name,
      amount: t.fare ? t.fare.total : t.cancellationFee,
      createdAt: t.createdAt
    }))
  };
}

function generateFullReport() {
  const trips = Object.values(store.getTrips());
  const settlements = Object.values(store.getSettlements());
  const departments = Object.values(store.getDepartments());

  const completedTrips = trips.filter(t => t.status === TRIP_STATUS.COMPLETED);
  const cancelledTrips = trips.filter(t => t.status === TRIP_STATUS.CANCELLED);

  const totalRevenue = settlements.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalDriverPayout = settlements.reduce((sum, s) => sum + s.driverIncome, 0);
  const totalCompanyRevenue = totalRevenue - totalDriverPayout;

  const anomalyTrips = trips.filter(t => {
    if (t.status !== TRIP_STATUS.COMPLETED) return false;
    return t.fare && t.fare.waitingFee > 100;
  });

  return {
    summary: {
      totalTrips: trips.length,
      completedTrips: completedTrips.length,
      cancelledTrips: cancelledTrips.length,
      pendingTrips: trips.length - completedTrips.length - cancelledTrips.length,
      totalRevenue,
      totalDriverPayout,
      totalCompanyRevenue
    },
    departments: departments.map(d => ({
      code: d.code,
      name: d.name,
      budget: d.budget,
      spent: d.spent,
      remaining: d.remaining,
      utilization: d.budget > 0 ? (d.spent / d.budget * 100).toFixed(2) : 0
    })),
    anomalies: anomalyTrips.map(t => ({
      tripId: t.id,
      employee: t.employee.name,
      waitingFee: t.fare.waitingFee,
      waitingMinutes: t.waitingMinutes,
      reason: '高额等待费'
    })),
    recentSettlements: settlements.slice(-10).map(s => ({
      id: s.id,
      tripId: s.tripId,
      driver: s.driver.name,
      totalAmount: s.totalAmount,
      createdAt: s.createdAt
    }))
  };
}

module.exports = {
  settleTrip,
  allocateToDepartments,
  checkDepartmentBudget,
  manualCorrectTrip,
  getSettlement,
  getDriverIncomeReport,
  getDepartmentReport,
  generateFullReport
};
