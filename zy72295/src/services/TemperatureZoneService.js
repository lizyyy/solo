const { TemperatureZone3D, BOUNDARY_RULES } = require('../models/TemperatureZone3D');
const { HistoryManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');

class TemperatureZoneService {
  constructor() {
    this.zones = [];
    this.historyManager = new HistoryManager();
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

    this.zones.push(zone);
    this.historyManager.createSnapshot(zone, 'create', operator, null, {
      reason: '初次创建温区',
      nextStep: '导入测距仪记录后补录路线',
      reviewRequired: false
    });
    return { success: true, zone };
  }

  updateZone(id, updates, operator, explicitReason = null) {
    const zone = this.zones.find(z => z.id === id);
    if (!zone) return null;

    const before = JSON.parse(JSON.stringify(zone));
    const isRemarkOnly = Object.keys(updates).length === 1 && updates.remark !== undefined;

    Object.assign(zone, updates);

    if (!isRemarkOnly) {
      const isValid = zone.validateBounds();
      if (!isValid) {
        Object.assign(zone, before);
        return {
          success: false,
          message: getUserFriendlyError('TEMPERATURE_ZONE_INVALID'),
          errors: zone.validationErrors
        };
      }

      const overlapCheck = this._checkAllOverlaps(zone, id);
      if (overlapCheck.hasOverlap) {
        Object.assign(zone, before);
        return {
          success: false,
          message: getUserFriendlyError('BOUNDARY_RULE_VIOLATION'),
          overlapsWith: overlapCheck.overlappingZones
        };
      }
    }

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
    return this.zones.find(z => z.id === id);
  }

  getAllZones() {
    return [...this.zones];
  }

  getZonesByLayer(layerId) {
    return this.zones.filter(z => z.layerId === layerId);
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
    for (const zone of this.zones) {
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

module.exports = { TemperatureZoneService };
