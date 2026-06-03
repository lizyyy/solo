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
    this.historyManager.createSnapshot(zone, 'create', operator);
    return { success: true, zone };
  }

  updateZone(id, updates, operator) {
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

    this.historyManager.createSnapshot(zone, isRemarkOnly ? 'update_remark' : 'update', operator, { before, after: zone });
    
    return {
      success: true,
      zone,
      isRemarkOnly,
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

  getZoneHistory(zoneId) {
    return this.historyManager.getHistory(zoneId);
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

    this.historyManager.createSnapshot(zone, 'rollback', operator, { before, after: zone });
    return { success: true, zone };
  }

  getBoundaryRules() {
    return TemperatureZone3D.getBoundaryRules();
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
