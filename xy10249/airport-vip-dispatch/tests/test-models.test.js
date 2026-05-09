const test = require('node:test');
const assert = require('node:assert');
const Flight = require('../src/models/flight');
const Vehicle = require('../src/models/vehicle');
const Driver = require('../src/models/driver');
const Dispatch = require('../src/models/dispatch');
const { VEHICLE_TYPES } = require('../src/config');

test('Flight model - basic validation', () => {
  const validFlight = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'T3-A01',
    passengerName: '张三',
    passengerLevel: 'platinum'
  });
  
  const validation = validFlight.validate();
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.errors.length, 0);
});

test('Flight model - invalid gate should fail validation', () => {
  const invalidFlight = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'INVALID-GATE',
    passengerName: '张三'
  });
  
  const validation = invalidFlight.validate();
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('无效的登机口')));
});

test('Flight model - update delay', () => {
  const flight = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'T3-A01',
    passengerName: '张三',
    delayMinutes: 0
  });
  
  const result = flight.updateDelay(45, '天气原因');
  
  assert.strictEqual(result.newDelayMinutes, 45);
  assert.strictEqual(result.oldDelayMinutes, 0);
  assert.strictEqual(result.delayChange, 45);
  assert.strictEqual(flight.delayMinutes, 45);
});

test('Flight model - change gate', () => {
  const flight = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'T3-A01',
    passengerName: '张三'
  });
  
  const result = flight.changeGate('T2-B01', '航班调整');
  
  assert.strictEqual(result.oldGate, 'T3-A01');
  assert.strictEqual(result.newGate, 'T2-B01');
  assert.strictEqual(flight.gate, 'T2-B01');
  assert.strictEqual(flight.gateChangeHistory.length, 1);
});

test('Flight model - invalid gate change throws error', () => {
  const flight = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'T3-A01',
    passengerName: '张三'
  });
  
  assert.throws(() => {
    flight.changeGate('INVALID', '测试');
  }, /无效的登机口/);
});

test('Vehicle model - basic validation', () => {
  const validVehicle = new Vehicle({
    id: 'V1',
    plateNumber: '京A·88888',
    type: VEHICLE_TYPES.LIMOUSINE,
    status: 'available',
    baseLocation: 'BASE-T3'
  });
  
  const validation = validVehicle.validate();
  assert.strictEqual(validation.valid, true);
});

test('Vehicle model - invalid type should fail', () => {
  const invalidVehicle = new Vehicle({
    id: 'V1',
    plateNumber: '京A·88888',
    type: 'invalid-type',
    status: 'available'
  });
  
  const validation = invalidVehicle.validate();
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('无效的车型')));
});

test('Driver model - basic validation', () => {
  const validDriver = new Driver({
    id: 'D1',
    name: '王师傅',
    phone: '13800138001',
    status: 'available',
    rating: 4.9,
    experienceYears: 10
  });
  
  const validation = validDriver.validate();
  assert.strictEqual(validation.valid, true);
});

test('Driver model - invalid rating should fail', () => {
  const invalidDriver = new Driver({
    id: 'D1',
    name: '王师傅',
    status: 'available',
    rating: 6.0
  });
  
  const validation = invalidDriver.validate();
  assert.strictEqual(validation.valid, false);
});

test('Dispatch model - add notification', () => {
  const dispatch = new Dispatch({
    id: 'DISP-001',
    flightId: 'F1',
    vehicleId: 'V1',
    driverId: 'D1'
  });
  
  const notification = dispatch.addNotification({
    type: 'delay_notice',
    recipient: '王师傅',
    message: '航班延误'
  });
  
  assert.strictEqual(dispatch.notifications.length, 1);
  assert.ok(notification.id);
  assert.ok(notification.sentAt);
});

test('Dispatch model - add conflict', () => {
  const dispatch = new Dispatch({
    id: 'DISP-001',
    flightId: 'F1',
    vehicleId: 'V1',
    driverId: 'D1'
  });
  
  const conflict = dispatch.addConflict({
    type: 'VEHICLE_CONFLICT',
    severity: 'high',
    message: '车辆冲突'
  });
  
  assert.strictEqual(dispatch.conflicts.length, 1);
  assert.ok(conflict.id);
  assert.strictEqual(conflict.resolved, false);
});

test('Flight model - JSON serialization round trip', () => {
  const original = new Flight({
    id: 'F1',
    flightNumber: 'CA1234',
    scheduledDeparture: new Date().toISOString(),
    gate: 'T3-A01',
    passengerName: '张三',
    passengerLevel: 'gold',
    vehiclePreference: 'limousine',
    delayMinutes: 30
  });
  
  const json = original.toJSON();
  const restored = Flight.fromJSON(json);
  
  assert.strictEqual(restored.id, original.id);
  assert.strictEqual(restored.flightNumber, original.flightNumber);
  assert.strictEqual(restored.gate, original.gate);
  assert.strictEqual(restored.vehiclePreference, original.vehiclePreference);
  assert.strictEqual(restored.delayMinutes, original.delayMinutes);
});
