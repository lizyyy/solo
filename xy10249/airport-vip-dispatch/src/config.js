const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.avd-data');
const FLIGHTS_FILE = path.join(DATA_DIR, 'flights.json');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');
const DRIVERS_FILE = path.join(DATA_DIR, 'drivers.json');
const DISPATCH_HISTORY_FILE = path.join(DATA_DIR, 'dispatch-history.json');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

const VEHICLE_TYPES = {
  SEDAN: 'sedan',
  SUV: 'suv',
  VAN: 'van',
  LIMOUSINE: 'limousine'
};

const VEHICLE_TYPE_NAMES = {
  [VEHICLE_TYPES.SEDAN]: '豪华轿车',
  [VEHICLE_TYPES.SUV]: '豪华SUV',
  [VEHICLE_TYPES.VAN]: '商务车',
  [VEHICLE_TYPES.LIMOUSINE]: '礼宾车'
};

const FLIGHT_STATUS = {
  SCHEDULED: 'scheduled',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
  BOARDING: 'boarding',
  DEPARTED: 'departed'
};

const DISPATCH_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CONFLICT: 'conflict'
};

const AIRPORT_GATES = {
  'T1-A01': { terminal: 'T1', zone: 'A', distance: 5 },
  'T1-A02': { terminal: 'T1', zone: 'A', distance: 6 },
  'T1-A03': { terminal: 'T1', zone: 'A', distance: 7 },
  'T1-B01': { terminal: 'T1', zone: 'B', distance: 10 },
  'T1-B02': { terminal: 'T1', zone: 'B', distance: 12 },
  'T2-A01': { terminal: 'T2', zone: 'A', distance: 8 },
  'T2-A02': { terminal: 'T2', zone: 'A', distance: 9 },
  'T2-B01': { terminal: 'T2', zone: 'B', distance: 15 },
  'T2-B02': { terminal: 'T2', zone: 'B', distance: 18 },
  'T3-A01': { terminal: 'T3', zone: 'A', distance: 3 },
  'T3-A02': { terminal: 'T3', zone: 'A', distance: 4 },
  'T3-B01': { terminal: 'T3', zone: 'B', distance: 20 },
  'T3-B02': { terminal: 'T3', zone: 'B', distance: 25 }
};

const VEHICLE_BASE_LOCATIONS = {
  'BASE-MAIN': { terminal: 'T2', distance: 0 },
  'BASE-T1': { terminal: 'T1', distance: 10 },
  'BASE-T3': { terminal: 'T3', distance: 10 }
};

const DRIVER_NOTIFICATION_TYPES = {
  INITIAL_ASSIGNMENT: 'initial_assignment',
  DELAY_NOTICE: 'delay_notice',
  GATE_CHANGE: 'gate_change',
  CONFLICT_ALERT: 'conflict_alert',
  CANCELLATION: 'cancellation',
  COMPLETION: 'completion'
};

module.exports = {
  DATA_DIR,
  FLIGHTS_FILE,
  VEHICLES_FILE,
  DRIVERS_FILE,
  DISPATCH_HISTORY_FILE,
  REPORTS_DIR,
  VEHICLE_TYPES,
  VEHICLE_TYPE_NAMES,
  FLIGHT_STATUS,
  DISPATCH_STATUS,
  AIRPORT_GATES,
  VEHICLE_BASE_LOCATIONS,
  DRIVER_NOTIFICATION_TYPES
};
