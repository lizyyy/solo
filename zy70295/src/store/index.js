const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Store {
  constructor() {
    this.busRoutes = new Map();
    this.temporaryStopRequests = new Map();
    this.studentStops = new Map();
    this.safetyRecords = new Map();
    this.idempotencyKeys = new Map();
    
    this._initializeSampleData();
  }

  _initializeSampleData() {
    const routeId = uuidv4();
    const stop1Id = uuidv4();
    const stop2Id = uuidv4();
    
    this.busRoutes.set(routeId, {
      id: routeId,
      routeNumber: 'BR001',
      routeName: '城东线路',
      driverName: '张师傅',
      licensePlate: '京A12345',
      status: 'active',
      scheduledStops: [
        {
          stopId: stop1Id,
          stopName: '东门站',
          stopAddress: '学校东门',
          scheduledTime: '07:30',
          studentCount: 15,
          order: 1
        },
        {
          stopId: stop2Id,
          stopName: '南门站',
          stopAddress: '学校南门',
          scheduledTime: '07:45',
          studentCount: 12,
          order: 2
        }
      ],
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    });

    const studentStop1Id = uuidv4();
    const studentStop2Id = uuidv4();
    
    this.studentStops.set(studentStop1Id, {
      id: studentStop1Id,
      routeId: routeId,
      originalStopId: stop1Id,
      stopName: '东门站',
      stopAddress: '学校东门',
      isTemporary: false,
      scheduledDate: moment().format('YYYY-MM-DD'),
      scheduledTime: '07:30',
      actualTime: null,
      studentCount: 15,
      actualStudentCount: null,
      status: 'pending',
      safetyRecordId: null,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    });
    
    this.studentStops.set(studentStop2Id, {
      id: studentStop2Id,
      routeId: routeId,
      originalStopId: stop2Id,
      stopName: '南门站',
      stopAddress: '学校南门',
      isTemporary: false,
      scheduledDate: moment().format('YYYY-MM-DD'),
      scheduledTime: '07:45',
      actualTime: null,
      studentCount: 12,
      actualStudentCount: null,
      status: 'pending',
      safetyRecordId: null,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    });
  }

  checkIdempotency(key) {
    if (this.idempotencyKeys.has(key)) {
      return { exists: true, result: this.idempotencyKeys.get(key) };
    }
    return { exists: false };
  }

  saveIdempotencyResult(key, result) {
    this.idempotencyKeys.set(key, {
      result,
      timestamp: moment().toISOString()
    });
  }
}

module.exports = new Store();