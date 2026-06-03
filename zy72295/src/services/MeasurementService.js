const { MeasurementRecord } = require('../models/MeasurementRecord');
const { SupplementaryRoute } = require('../models/SupplementaryRoute');
const { HistoryManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');

class MeasurementService {
  constructor() {
    this.records = [];
    this.routes = [];
    this.historyManager = new HistoryManager();
  }

  addMeasurementRecord(data, operator) {
    const record = new MeasurementRecord({
      ...data,
      recordedBy: operator
    });
    this.records.push(record);
    this.historyManager.createSnapshot(record, 'create', operator);
    return record;
  }

  addSupplementaryRoute(data, operator) {
    const route = new SupplementaryRoute({
      ...data,
      createdBy: operator
    });
    this.routes.push(route);
    this.historyManager.createSnapshot(route, 'create', operator);
    return route;
  }

  recalculateRouteLength(routeId, operator) {
    const route = this.routes.find(r => r.id === routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    const newLength = route.recalculateLength();
    
    this.historyManager.createSnapshot(route, 'recalculate_length', operator, { before, after: route });
    return { route, newLength };
  }

  checkRouteForReview(routeId) {
    const route = this.routes.find(r => r.id === routeId);
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

  markRouteForCustomerReview(routeId, operator) {
    const route = this.routes.find(r => r.id === routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    route.markForCustomerReview();
    
    this.historyManager.createSnapshot(route, 'mark_for_review', operator, { before, after: route });
    return route;
  }

  completeCustomerReview(routeId, operator, approved, remark = '') {
    const route = this.routes.find(r => r.id === routeId);
    if (!route) return null;

    const before = JSON.parse(JSON.stringify(route));
    route.completeCustomerReview(approved, remark);
    
    this.historyManager.createSnapshot(route, 'customer_review', operator, { before, after: route });
    return route;
  }

  getRouteById(routeId) {
    return this.routes.find(r => r.id === routeId);
  }

  getRecordById(recordId) {
    return this.records.find(r => r.id === recordId);
  }

  getRoutesPendingReview() {
    return this.routes.filter(r => r.needsCustomerReview);
  }

  getRouteHistory(routeId) {
    return this.historyManager.getHistory(routeId);
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

    this.historyManager.createSnapshot(route, 'link_measurement', operator, { before: beforeRoute, after: route });
    this.historyManager.createSnapshot(measurement, 'link_route', operator, { before: beforeMeasurement, after: measurement });

    return { success: true, route, measurement };
  }
}

module.exports = { MeasurementService };
