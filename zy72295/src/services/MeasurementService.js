const { MeasurementRecord } = require('../models/MeasurementRecord');
const { SupplementaryRoute } = require('../models/SupplementaryRoute');
const { historyManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');
const { store } = require('../store/FileStore');

class MeasurementService {
  constructor() {
    this.historyManager = historyManager;
  }

  _toRecord(plain) {
    if (!plain) return null;
    const rec = new MeasurementRecord({});
    Object.assign(rec, plain);
    return rec;
  }

  _toRoute(plain) {
    if (!plain) return null;
    const route = new SupplementaryRoute({});
    Object.assign(route, plain);
    return route;
  }

  _saveRecord(record) {
    const existing = store.getById('measurementRecords', record.id);
    if (existing) {
      return store.update('measurementRecords', record.id, JSON.parse(JSON.stringify(record)));
    } else {
      return store.add('measurementRecords', JSON.parse(JSON.stringify(record)));
    }
  }

  _saveRoute(route) {
    const existing = store.getById('supplementaryRoutes', route.id);
    if (existing) {
      return store.update('supplementaryRoutes', route.id, JSON.parse(JSON.stringify(route)));
    } else {
      return store.add('supplementaryRoutes', JSON.parse(JSON.stringify(route)));
    }
  }

  addMeasurementRecord(data, operator) {
    const record = new MeasurementRecord({
      ...data,
      recordedBy: operator
    });
    this._saveRecord(record);
    this.historyManager.createSnapshot(record, 'create', operator, null, {
      reason: '录入测距仪记录',
      nextStep: '关联到补录路线',
      reviewRequired: false
    });
    return record;
  }

  addSupplementaryRoute(data, operator) {
    const route = new SupplementaryRoute({
      ...data,
      createdBy: operator
    });
    this._saveRoute(route);
    this.historyManager.createSnapshot(route, 'create', operator, null, {
      reason: '创建补录路线',
      nextStep: '需要重新计算长度后再复核',
      reviewRequired: true,
      originalValue: { lengthRecalculated: false },
      changedValue: null
    });
    return route;
  }

  recalculateRouteLength(routeId, operator) {
    const route = this.getRouteById(routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    const oldLength = route.length;
    const newLength = route.recalculateLength();
    this._saveRoute(route);

    this.historyManager.createSnapshot(route, 'recalculate_length', operator, { before, after: JSON.parse(JSON.stringify(route)) }, {
      reason: '重新计算补录路线长度',
      originalValue: { length: oldLength, lengthRecalculated: false },
      changedValue: { length: newLength, lengthRecalculated: true },
      nextStep: '计算完成，请复核确认',
      reviewRequired: true
    });
    return { route, newLength };
  }

  checkRouteForReview(routeId) {
    const route = this.getRouteById(routeId);
    if (!route) return { valid: false, message: '路线不存在' };

    if (route.needsLengthRecalculation()) {
      return {
        valid: false,
        needsReview: true,
        message: getUserFriendlyError('ROUTE_LENGTH_NOT_RECALCULATED'),
        route
      };
    }

    return { valid: true, route };
  }

  markRouteForCustomerReview(routeId, operator, reason = null) {
    const route = this.getRouteById(routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    route.markForCustomerReview();
    this._saveRoute(route);

    this.historyManager.createSnapshot(route, 'mark_for_review', operator, { before, after: JSON.parse(JSON.stringify(route)) }, {
      reason: reason || '补录路线需要客户复核',
      originalValue: { customerReviewStatus: before.customerReviewStatus, status: before.status },
      changedValue: { customerReviewStatus: 'pending', status: 'reviewing' },
      nextStep: '等待展陈客户复核，请勿提前归为正常',
      reviewRequired: true
    });
    return route;
  }

  completeCustomerReview(routeId, operator, approved, remark = '') {
    const route = this.getRouteById(routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    route.completeCustomerReview(approved, remark);
    this._saveRoute(route);

    this.historyManager.createSnapshot(route, 'customer_review', operator, { before, after: JSON.parse(JSON.stringify(route)) }, {
      reason: approved ? '客户复核通过' : '客户复核未通过',
      originalValue: { customerReviewStatus: before.customerReviewStatus, status: before.status },
      changedValue: { customerReviewStatus: route.customerReviewStatus, status: route.status },
      nextStep: approved ? '可继续导出流程' : '需要修正后重新提交复核，请联系园区运维小陶',
      reviewRequired: !approved
    });
    return route;
  }

  getRouteById(routeId) {
    const plain = store.getById('supplementaryRoutes', routeId);
    return this._toRoute(plain);
  }

  getRecordById(recordId) {
    const plain = store.getById('measurementRecords', recordId);
    return this._toRecord(plain);
  }

  getRoutesPendingReview() {
    return store.findMany('supplementaryRoutes', r => r.needsCustomerReview).map(p => this._toRoute(p));
  }

  getAllRoutes() {
    return store.getAll('supplementaryRoutes').map(p => this._toRoute(p));
  }

  getAllRecords() {
    return store.getAll('measurementRecords').map(p => this._toRecord(p));
  }

  getRouteHistory(routeId) {
    return this.historyManager.getHistory(routeId);
  }

  getRouteSummary(routeId) {
    const route = this.getRouteById(routeId);
    if (!route) return null;

    const latestSnapshot = this.historyManager.getLatestSnapshot(routeId);
    const history = this.historyManager.getHistory(routeId, 50);

    return {
      id: route.id,
      name: route.name,
      length: route.length,
      lengthRecalculated: route.lengthRecalculated,
      needsCustomerReview: route.needsCustomerReview,
      customerReviewStatus: route.customerReviewStatus,
      status: route.status,
      linkedMeasurementId: route.linkedMeasurementId,
      linkedCADLayerId: route.linkedCADLayerId,
      remark: route.remark,
      latestOperation: latestSnapshot ? {
        operation: latestSnapshot.operation,
        operator: latestSnapshot.operator,
        timestamp: latestSnapshot.timestamp,
        context: latestSnapshot.context
      } : null,
      totalHistoryCount: history.length
    };
  }

  getRouteDetail(routeId) {
    const route = this.getRouteById(routeId);
    if (!route) return null;

    const latestSnapshot = this.historyManager.getLatestSnapshot(routeId);
    const history = this.historyManager.getHistory(routeId, 50);
    const measurement = route.linkedMeasurementId
      ? this.getRecordById(route.linkedMeasurementId)
      : null;

    return {
      route,
      measurement,
      latestSnapshot,
      history
    };
  }

  linkRouteToMeasurement(routeId, measurementId, operator) {
    const route = this.getRouteById(routeId);
    const measurement = this.getRecordById(measurementId);

    if (!route || !measurement) {
      return { success: false, message: getUserFriendlyError('MEASUREMENT_RECORD_MISMATCH') };
    }

    const beforeRoute = JSON.parse(JSON.stringify(route));
    route.linkedMeasurementId = measurementId;

    const beforeMeasurement = JSON.parse(JSON.stringify(measurement));
    measurement.linkedRouteId = routeId;

    this._saveRoute(route);
    this._saveRecord(measurement);

    this.historyManager.createSnapshot(route, 'link_measurement', operator, { before: beforeRoute, after: JSON.parse(JSON.stringify(route)) }, {
      reason: '关联测距仪记录到补录路线',
      originalValue: { linkedMeasurementId: null },
      changedValue: { linkedMeasurementId: measurementId },
      nextStep: '请重新计算路线长度后提交复核',
      reviewRequired: true
    });

    this.historyManager.createSnapshot(measurement, 'link_route', operator, { before: beforeMeasurement, after: JSON.parse(JSON.stringify(measurement)) }, {
      reason: '关联补录路线到测距仪记录',
      nextStep: '路线关联完成',
      reviewRequired: false
    });

    return { success: true, route, measurement };
  }
}

const measurementService = new MeasurementService();

module.exports = { MeasurementService, measurementService };
