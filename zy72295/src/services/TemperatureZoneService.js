const { TemperatureZone3D, BOUNDARY_RULES } = require('../models/TemperatureZone3D');
const { historyManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');
const { store } = require('../store/FileStore');

class TemperatureZoneService {
  constructor() {
    this.historyManager = historyManager;
  }

  _toZone(plain) {
    if (!plain) return null;
    const zone = new TemperatureZone3D({});
    Object.assign(zone, plain);
    return zone;
  }

  _saveZone(zone) {
    const existing = store.getById('temperatureZones', zone.id);
    if (existing) {
      return store.update('temperatureZones', zone.id, JSON.parse(JSON.stringify(zone)));
    } else {
      return store.add('temperatureZones', JSON.parse(JSON.stringify(zone)));
    }
  }

  createZone(data, operator) {
    const zone = new TemperatureZone3D({
      ...data,
      createdBy: operator
    });

    const isValid = zone.validateBounds();
    if (!isValid) {
      return {
        success: false,
        message: getUserFriendlyError('TEMPERATURE_ZONE_INVALID'),
        errors: zone.validationErrors
      };
    }

    const overlapCheck = this._checkAllOverlaps(zone);
    if (overlapCheck.hasOverlap) {
      return {
        success: false,
        message: getUserFriendlyError('BOUNDARY_RULE_VIOLATION'),
        overlapsWith: overlapCheck.overlappingZones
      };
    }

    this._saveZone(zone);
    this.historyManager.createSnapshot(zone, 'create', operator, null, {
      reason: '初次创建温区',
      nextStep: '导入测距仪记录后补录路线',
      reviewRequired: false
    });
    return { success: true, zone };
  }

  updateZone(id, updates, operator, explicitReason = null) {
    const zone = this.getZoneById(id);
    if (!zone) return null;

    const before = JSON.parse(JSON.stringify(zone));
    const isRemarkOnly = Object.keys(updates).length === 1 && updates.remark !== undefined;

    Object.assign(zone, updates);

    if (!isRemarkOnly) {
      const isValid = zone.validateBounds();
      if (!isValid) {
        return {
          success: false,
          message: getUserFriendlyError('TEMPERATURE_ZONE_INVALID'),
          errors: zone.validationErrors
        };
      }

      const overlapCheck = this._checkAllOverlaps(zone, id);
      if (overlapCheck.hasOverlap) {
        return {
          success: false,
          message: getUserFriendlyError('BOUNDARY_RULE_VIOLATION'),
          overlapsWith: overlapCheck.overlappingZones
        };
      }
    }

    this._saveZone(zone);

    const diff = this.historyManager._calculateDiff(before, zone);
    const changedFields = Object.keys(diff);
    const context = {
      originalValue: {},
      changedValue: {},
      reason: explicitReason || (isRemarkOnly ? '运维人员修改备注' : '更新温区属性'),
      nextStep: isRemarkOnly ? '备注已更新，温区三维分层数据未变更' : '请确认更新后的温区数据是否需要复核',
      reviewRequired: !isRemarkOnly
    };

    for (const field of changedFields) {
      context.originalValue[field] = diff[field].before;
      context.changedValue[field] = diff[field].after;
    }

    const snapshot = this.historyManager.createSnapshot(
      zone,
      isRemarkOnly ? 'update_remark' : 'update',
      operator,
      { before, after: JSON.parse(JSON.stringify(zone)) },
      context
    );

    return {
      success: true,
      zone,
      isRemarkOnly,
      snapshot,
      message: isRemarkOnly ? getUserFriendlyError('REMARK_UPDATE_ONLY') : null
    };
  }

  getZoneById(id) {
    const plain = store.getById('temperatureZones', id);
    return this._toZone(plain);
  }

  getAllZones() {
    return store.getAll('temperatureZones').map(p => this._toZone(p));
  }

  getZonesByLayer(layerId) {
    return store.findMany('temperatureZones', z => z.layerId === layerId).map(p => this._toZone(p));
  }

  getZoneSummary(zoneId) {
    const zone = this.getZoneById(zoneId);
    if (!zone) return null;

    const latestSnapshot = this.historyManager.getLatestSnapshot(zoneId);
    const history = this.historyManager.getHistory(zoneId, 50);

    return {
      id: zone.id,
      name: zone.name,
      status: zone.status,
      bounds: zone.bounds,
      temperatureRange: zone.temperatureRange,
      remark: zone.remark,
      layerId: zone.layerId,
      routeId: zone.routeId,
      color: zone.color,
      latestOperation: latestSnapshot ? {
        operation: latestSnapshot.operation,
        operator: latestSnapshot.operator,
        timestamp: latestSnapshot.timestamp,
        diff: latestSnapshot.diff,
        context: latestSnapshot.context
      } : null,
      totalHistoryCount: history.length,
      hasPendingReview: history.some(h => h.context && h.context.reviewRequired && h.operation !== 'create')
    };
  }

  getZoneHistory(zoneId) {
    return this.historyManager.getHistory(zoneId);
  }

  getZoneDetail(zoneId) {
    const zone = this.getZoneById(zoneId);
    if (!zone) return null;

    const latestSnapshot = this.historyManager.getLatestSnapshot(zoneId);
    const history = this.historyManager.getHistory(zoneId, 50);

    return {
      zone,
      latestSnapshot,
      history,
      remarkDiff: this._extractRemarkHistory(history)
    };
  }

  compareZoneVersions(snapshotId1, snapshotId2) {
    const comparison = this.historyManager.compareVersions(snapshotId1, snapshotId2);
    if (!comparison) {
      return { success: false, message: getUserFriendlyError('HISTORY_NOT_FOUND') };
    }
    return { success: true, comparison };
  }

  rollbackZone(zoneId, snapshotId, operator) {
    const rollbackData = this.historyManager.rollback(snapshotId);
    if (!rollbackData) return { success: false, message: getUserFriendlyError('HISTORY_NOT_FOUND') };

    const zone = this.getZoneById(zoneId);
    if (!zone) return { success: false, message: '温区不存在' };

    const before = JSON.parse(JSON.stringify(zone));
    Object.assign(zone, rollbackData);
    this._saveZone(zone);

    this.historyManager.createSnapshot(zone, 'rollback', operator, { before, after: JSON.parse(JSON.stringify(zone)) }, {
      reason: `回滚到快照 ${snapshotId}`,
      nextStep: '请确认回滚后的数据是否需要复核',
      reviewRequired: true
    });
    return { success: true, zone };
  }

  getBoundaryRules() {
    return TemperatureZone3D.getBoundaryRules();
  }

  _extractRemarkHistory(history) {
    return history
      .filter(h => h.operation === 'update_remark' || (h.diff && h.diff['remark']))
      .map(h => ({
        snapshotId: h.id,
        timestamp: h.timestamp,
        operator: h.operator,
        before: h.diff && h.diff['remark'] ? h.diff['remark'].before : undefined,
        after: h.diff && h.diff['remark'] ? h.diff['remark'].after : undefined,
        context: h.context
      }));
  }

  _checkAllOverlaps(newZone, excludeId = null) {
    const overlappingZones = [];
    const allZones = this.getAllZones();
    for (const zone of allZones) {
      if (excludeId && zone.id === excludeId) continue;
      if (newZone.checkOverlap(zone)) {
        overlappingZones.push({ id: zone.id, name: zone.name });
      }
    }
    return {
      hasOverlap: overlappingZones.length > 0,
      overlappingZones
    };
  }
}

const temperatureZoneService = new TemperatureZoneService();

module.exports = { TemperatureZoneService, temperatureZoneService };
