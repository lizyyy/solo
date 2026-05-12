const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const feeCalculator = require('./feeCalculator');
const { TRIP_STATUS, APPROVAL_STATUS } = require('../config');

function createTrip(requestData) {
  const isIntercity = feeCalculator.needsIntercityApproval(requestData.distanceKm);
  
  const trip = {
    id: uuidv4(),
    requestId: requestData.requestId || uuidv4(),
    employee: {
      id: requestData.employeeId,
      name: requestData.employeeName,
      department: requestData.department
    },
    pickup: requestData.pickup,
    dropoff: requestData.dropoff,
    distanceKm: requestData.distanceKm,
    scheduledTime: requestData.scheduledTime,
    isIntercity,
    intercityApproval: isIntercity ? APPROVAL_STATUS.PENDING : APPROVAL_STATUS.NOT_REQUIRED,
    status: TRIP_STATUS.PENDING,
    driver: null,
    actualStartTime: null,
    actualEndTime: null,
    waitingMinutes: 0,
    driverArrivalTime: null,
    fare: null,
    cancellationFee: 0,
    cancelledBy: null,
    cancellationReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'CREATE',
    description: '员工创建用车申请',
    details: { pickup: requestData.pickup, dropoff: requestData.dropoff, distanceKm: requestData.distanceKm }
  });

  if (isIntercity) {
    store.addHistoryRecord({
      tripId: trip.id,
      action: 'APPROVAL_NEEDED',
      description: '跨城行程需要审批',
      details: { distanceKm: requestData.distanceKm, threshold: 100 }
    });
  }

  return trip;
}

function dispatchDriver(tripId, driverId, driverName) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status !== TRIP_STATUS.PENDING) {
    throw new Error(`行程状态为 ${trip.status}，无法派单`);
  }

  if (trip.isIntercity && trip.intercityApproval === APPROVAL_STATUS.PENDING) {
    throw new Error('跨城行程需要先审批才能派单');
  }

  if (trip.isIntercity && trip.intercityApproval === APPROVAL_STATUS.REJECTED) {
    throw new Error('跨城行程已被拒绝，无法派单');
  }

  trip.driver = { id: driverId, name: driverName };
  trip.status = TRIP_STATUS.DISPATCHED;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'DISPATCH',
    description: `司机 ${driverName} 已派单`,
    details: { driverId, driverName }
  });

  return trip;
}

function driverArrive(tripId) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status !== TRIP_STATUS.DISPATCHED) {
    throw new Error(`行程状态为 ${trip.status}，司机无法到达`);
  }

  trip.status = TRIP_STATUS.DRIVER_ARRIVED;
  trip.driverArrivalTime = new Date().toISOString();
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'DRIVER_ARRIVE',
    description: '司机已到达上车点',
    details: { arrivalTime: trip.driverArrivalTime }
  });

  return trip;
}

function startTrip(tripId, startTime) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status === TRIP_STATUS.IN_PROGRESS || trip.status === TRIP_STATUS.COMPLETED) {
    throw new Error(`行程状态为 ${trip.status}，无法开始`);
  }

  if (trip.status === TRIP_STATUS.DRIVER_ARRIVED && trip.driverArrivalTime) {
    const arrivalTime = new Date(trip.driverArrivalTime);
    const actualStartTime = startTime ? new Date(startTime) : new Date();
    const waitingMs = actualStartTime - arrivalTime;
    trip.waitingMinutes = Math.max(0, Math.ceil(waitingMs / 60000));
  }

  trip.status = TRIP_STATUS.IN_PROGRESS;
  trip.actualStartTime = startTime || new Date().toISOString();
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'START',
    description: '行程开始',
    details: { startTime: trip.actualStartTime, waitingMinutes: trip.waitingMinutes }
  });

  return trip;
}

function endTrip(tripId, endTime, actualDistanceKm) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status !== TRIP_STATUS.IN_PROGRESS) {
    throw new Error(`行程状态为 ${trip.status}，无法结束`);
  }

  const finalDistance = actualDistanceKm || trip.distanceKm;
  const fare = feeCalculator.calculateTotalFare(
    finalDistance,
    trip.waitingMinutes,
    trip.isIntercity,
    trip.intercityApproval
  );

  trip.status = TRIP_STATUS.COMPLETED;
  trip.actualEndTime = endTime || new Date().toISOString();
  trip.distanceKm = finalDistance;
  trip.fare = fare;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'END',
    description: '行程已完成，费用已计算',
    details: {
      endTime: trip.actualEndTime,
      distanceKm: finalDistance,
      totalFare: fare.total,
      breakdown: fare.breakdown
    }
  });

  return trip;
}

function cancelTrip(tripId, cancelledBy, reason) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (trip.status === TRIP_STATUS.COMPLETED || trip.status === TRIP_STATUS.CANCELLED) {
    throw new Error(`行程状态为 ${trip.status}，无法取消`);
  }

  const cancellationFee = feeCalculator.calculateCancellationFee(trip.status, cancelledBy);

  trip.status = TRIP_STATUS.CANCELLED;
  trip.cancellationFee = cancellationFee;
  trip.cancelledBy = cancelledBy;
  trip.cancellationReason = reason;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: 'CANCEL',
    description: `行程已取消（${cancelledBy}）`,
    details: {
      cancelledBy,
      reason,
      cancellationFee,
      previousStatus: trip.status
    }
  });

  return trip;
}

function approveIntercity(tripId, approved) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    throw new Error(`行程 ${tripId} 不存在`);
  }

  if (!trip.isIntercity) {
    throw new Error('该行程不是跨城行程，无需审批');
  }

  if (trip.intercityApproval !== APPROVAL_STATUS.PENDING) {
    throw new Error(`跨城审批状态为 ${trip.intercityApproval}，无法审批`);
  }

  trip.intercityApproval = approved ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
  trip.updatedAt = new Date().toISOString();

  store.saveTrip(trip);
  store.addHistoryRecord({
    tripId: trip.id,
    action: approved ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
    description: approved ? '跨城审批已通过' : '跨城审批已拒绝',
    details: { approved }
  });

  return trip;
}

function getTripDetails(tripId) {
  const trip = store.getTrip(tripId);
  if (!trip) {
    return null;
  }

  const history = store.getHistoryRecords(tripId);
  const corrections = store.getCorrections(tripId);

  return {
    trip,
    history,
    corrections
  };
}

function getAllTrips(filters = {}) {
  const trips = Object.values(store.getTrips());
  
  if (filters.status) {
    return trips.filter(t => t.status === filters.status);
  }
  
  if (filters.department) {
    return trips.filter(t => t.employee.department === filters.department);
  }
  
  if (filters.driverId) {
    return trips.filter(t => t.driver && t.driver.id === filters.driverId);
  }

  return trips;
}

module.exports = {
  createTrip,
  dispatchDriver,
  driverArrive,
  startTrip,
  endTrip,
  cancelTrip,
  approveIntercity,
  getTripDetails,
  getAllTrips
};
