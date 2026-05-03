const BaseRepository = require('./baseRepository');
const models = require('../models');

class BoxRepository extends BaseRepository {
  constructor() {
    super('boxes', models.Box);
  }

  findByBatchId(batchId) {
    return this.findByField('currentBatchId', batchId);
  }
}

class BatchRepository extends BaseRepository {
  constructor() {
    super('batches', models.Batch);
  }

  findByBoxId(boxId) {
    return this.findByField('boxId', boxId);
  }

  findByState(state) {
    return this.findByField('currentState', state);
  }

  findWithRisks() {
    const batches = this.findAll();
    return batches.filter(batch => batch.hasAnyRisk());
  }
}

class StationRepository extends BaseRepository {
  constructor() {
    super('stations', models.Station);
  }
}

class ResponsiblePersonRepository extends BaseRepository {
  constructor() {
    super('responsiblePersons', models.ResponsiblePerson);
  }
}

class TemperatureLogRepository extends BaseRepository {
  constructor() {
    super('temperatureLogs', models.TemperatureLog);
  }

  findByBoxId(boxId) {
    const logs = this.findByField('boxId', boxId);
    return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  findByBoxIdBetween(boxId, startTime, endTime) {
    const logs = this.findByBoxId(boxId);
    return logs.filter(log => {
      const ts = new Date(log.timestamp);
      return ts >= new Date(startTime) && ts <= new Date(endTime);
    });
  }
}

class VehicleTrajectoryRepository extends BaseRepository {
  constructor() {
    super('vehicleTrajectories', models.VehicleTrajectory);
  }

  findByBatchId(batchId) {
    return this.findByField('batchId', batchId);
  }

  findByVehiclePlate(plate) {
    return this.findByField('vehiclePlate', plate);
  }
}

class HandoverFormRepository extends BaseRepository {
  constructor() {
    super('handoverForms', models.HandoverForm);
  }

  findByBatchId(batchId) {
    return this.findByField('batchId', batchId);
  }

  findByState(state) {
    return this.findByField('currentState', state);
  }

  findWithMissingSignatures() {
    const forms = this.findAll();
    return forms.filter(form => !form.hasCompleteSignatures());
  }
}

class RiskEventRepository extends BaseRepository {
  constructor() {
    super('riskEvents', models.RiskEvent);
  }

  findByBatchId(batchId) {
    return this.findByField('batchId', batchId);
  }

  findByStatus(status) {
    return this.findByField('status', status);
  }

  findByType(type) {
    return this.findByField('type', type);
  }

  findOpen() {
    return this.findByStatus('open');
  }
}

class AuditEventRepository extends BaseRepository {
  constructor() {
    super('auditEvents', models.AuditEvent);
  }

  findByEntityType(entityType) {
    return this.findByField('entityType', entityType);
  }

  findByEntityId(entityId) {
    return this.findByField('entityId', entityId);
  }

  findByAction(action) {
    return this.findByField('action', action);
  }
}

class ReviewRepository extends BaseRepository {
  constructor() {
    super('reviews', models.Review);
  }

  findByRiskEventId(riskEventId) {
    return this.findByField('riskEventId', riskEventId);
  }

  findByStatus(status) {
    return this.findByField('status', status);
  }

  findPending() {
    return this.findByStatus('pending');
  }
}

module.exports = {
  BaseRepository,
  BoxRepository,
  BatchRepository,
  StationRepository,
  ResponsiblePersonRepository,
  TemperatureLogRepository,
  VehicleTrajectoryRepository,
  HandoverFormRepository,
  RiskEventRepository,
  AuditEventRepository,
  ReviewRepository
};
