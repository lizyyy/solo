const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { 
  driverData, 
  tripData, 
  waitingFeeData, 
  reassignData, 
  historyData 
} = require('./data/sampleData');

function validateDriverVehicle(driverId, vehicleId, tripId) {
  const driver = driverData.find(d => d.id === driverId);
  if (!driver) {
    return { success: false, message: '司机不存在', code: 'DRIVER_NOT_FOUND' };
  }

  if (driver.vehicleId !== vehicleId) {
    return { success: false, message: '司机与车辆不匹配', code: 'DRIVER_VEHICLE_MISMATCH' };
  }

  if (driver.status !== 'available') {
    const statusMap = {
      'on_trip': '执行任务中',
      'offline': '离线',
      'busy': '忙碌'
    };
    return { 
      success: false, 
      message: `司机当前${statusMap[driver.status] || '不可用'}`, 
      code: 'DRIVER_NOT_AVAILABLE' 
    };
  }

  const trip = tripData.find(t => t.id === tripId);
  if (trip && trip.driverId === driverId) {
    return { success: false, message: '该司机已被指派给此行程', code: 'DRIVER_ALREADY_ASSIGNED' };
  }

  return {
    success: true,
    message: '校验通过',
    data: {
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating
      },
      vehicle: {
        id: driver.vehicleId,
        plate: driver.vehiclePlate,
        model: driver.vehicleModel
      }
    }
  };
}

function calculateWaitingFee(tripId, arriveTime, pickupTime, handler) {
  const trip = tripData.find(t => t.id === tripId);
  if (!trip) {
    return { success: false, message: '行程不存在', code: 'TRIP_NOT_FOUND' };
  }

  const arrive = moment(arriveTime);
  const pickup = moment(pickupTime);

  if (!arrive.isValid() || !pickup.isValid()) {
    return { success: false, message: '时间格式不正确', code: 'INVALID_TIME_FORMAT' };
  }

  if (pickup.isBefore(arrive)) {
    return { success: false, message: '接客时间不能早于到达时间', code: 'PICKUP_BEFORE_ARRIVE' };
  }

  const waitingMinutes = pickup.diff(arrive, 'minutes');
  const freeMinutes = 30;
  const ratePerMinute = 2;
  const chargeMinutes = Math.max(0, waitingMinutes - freeMinutes);
  const amount = chargeMinutes * ratePerMinute;

  const existingFee = waitingFeeData.find(w => w.tripId === tripId);
  if (existingFee) {
    return {
      success: true,
      message: '费用已计算，返回已有记录',
      data: existingFee
    };
  }

  const feeRecord = {
    id: 'W' + String(waitingFeeData.length + 1).padStart(3, '0'),
    tripId: tripId,
    orderNo: trip.orderNo,
    arriveTime: arriveTime,
    pickupTime: pickupTime,
    waitingMinutes: waitingMinutes,
    freeMinutes: freeMinutes,
    chargeMinutes: chargeMinutes,
    ratePerMinute: ratePerMinute,
    amount: amount,
    status: 'calculated',
    createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    handler: handler
  };

  waitingFeeData.push(feeRecord);

  historyData.push({
    id: 'H' + String(historyData.length + 1).padStart(3, '0'),
    type: 'waiting_fee',
    referenceId: feeRecord.id,
    field: 'amount',
    oldValue: '0',
    newValue: String(amount),
    handleTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    handler: handler,
    remark: '等待费用计算'
  });

  return {
    success: true,
    message: '等待费用计算成功',
    data: feeRecord
  };
}

function saveReassign(tripId, oldDriverId, newDriverId, reason, handler) {
  const trip = tripData.find(t => t.id === tripId);
  if (!trip) {
    return { success: false, message: '行程不存在', code: 'TRIP_NOT_FOUND' };
  }

  const oldDriver = driverData.find(d => d.id === oldDriverId);
  if (!oldDriver) {
    return { success: false, message: '原司机不存在', code: 'OLD_DRIVER_NOT_FOUND' };
  }

  const newDriver = driverData.find(d => d.id === newDriverId);
  if (!newDriver) {
    return { success: false, message: '新司机不存在', code: 'NEW_DRIVER_NOT_FOUND' };
  }

  if (oldDriverId === newDriverId) {
    return { success: false, message: '新司机不能与原司机相同', code: 'SAME_DRIVER' };
  }

  if (newDriver.status !== 'available') {
    return { success: false, message: '新司机不可用', code: 'NEW_DRIVER_NOT_AVAILABLE' };
  }

  const existingReassign = reassignData.find(r => 
    r.tripId === tripId && r.oldDriverId === oldDriverId && r.newDriverId === newDriverId
  );
  if (existingReassign) {
    return {
      success: true,
      message: '改签重派已保存，返回已有记录',
      data: existingReassign
    };
  }

  const reassignRecord = {
    id: 'R' + String(reassignData.length + 1).padStart(3, '0'),
    tripId: tripId,
    orderNo: trip.orderNo,
    oldDriverId: oldDriverId,
    oldDriverName: oldDriver.name,
    newDriverId: newDriverId,
    newDriverName: newDriver.name,
    reason: reason,
    status: 'completed',
    createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    handler: handler
  };

  reassignData.push(reassignRecord);

  historyData.push({
    id: 'H' + String(historyData.length + 1).padStart(3, '0'),
    type: 'reassign',
    referenceId: reassignRecord.id,
    field: 'driverId',
    oldValue: oldDriverId,
    newValue: newDriverId,
    handleTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    handler: handler,
    remark: '改签重派: ' + reason
  });

  const oldTripDriverId = trip.driverId;
  trip.driverId = newDriverId;
  trip.vehicleId = newDriver.vehicleId;

  historyData.push({
    id: 'H' + String(historyData.length + 1).padStart(3, '0'),
    type: 'trip_update',
    referenceId: tripId,
    field: 'driverId',
    oldValue: oldTripDriverId,
    newValue: newDriverId,
    handleTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    handler: handler,
    remark: '行程司机更新'
  });

  return {
    success: true,
    message: '改签重派保存成功',
    data: reassignRecord
  };
}

module.exports = {
  validateDriverVehicle,
  calculateWaitingFee,
  saveReassign
};
