const store = require('../data/store');
const { service: berthingService } = require('./berthingService');
const { createError, ErrorCodes } = require('../utils/errors');
const moment = require('moment');

const InterruptionTypes = {
  EQUIPMENT_FAILURE: 'EQUIPMENT_FAILURE',
  MAINTENANCE: 'MAINTENANCE',
  WEATHER: 'WEATHER',
  POWER_GRID_ISSUE: 'POWER_GRID_ISSUE',
  SHIP_REQUEST: 'SHIP_REQUEST',
  OTHER: 'OTHER'
};

const InterruptionStatuses = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED'
};

const MAX_EXPECTED_INTERRUPTION_HOURS = 8;

class InterruptionService {
  createInterruption(data) {
    if (!data.berthingId || !data.startTime || !data.type) {
      throw createError(ErrorCodes.INVALID_PARAMETERS, {
        required: ['berthingId', 'startTime', 'type'],
        provided: Object.keys(data)
      });
    }

    const berthing = berthingService.getBerthing(data.berthingId);
    
    const existingInterruptions = store.getInterruptionsByBerthing(data.berthingId);
    const activeInterruptions = existingInterruptions.filter(i => i.status === InterruptionStatuses.ACTIVE);
    
    if (activeInterruptions.length > 0) {
      throw createError(ErrorCodes.INTERRUPTION_OVERLAP, {
        message: '已有活跃的中断事件，请先处理',
        activeInterruptions: activeInterruptions.map(i => ({ id: i.id, startTime: i.startTime }))
      });
    }

    return store.createInterruption({
      berthingId: data.berthingId,
      startTime: data.startTime,
      endTime: data.endTime || null,
      type: data.type,
      reason: data.reason || null,
      impactKwh: data.impactKwh || 0,
      responsibleParty: data.responsibleParty || 'UNKNOWN',
      notes: data.notes || null
    });
  }

  getInterruption(id) {
    const interruption = store.getInterruption(id);
    if (!interruption) {
      throw createError(ErrorCodes.INTERRUPTION_NOT_FOUND, { interruptionId: id });
    }
    return interruption;
  }

  resolveInterruption(id, data = {}) {
    const interruption = this.getInterruption(id);
    
    if (interruption.status !== InterruptionStatuses.ACTIVE) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus: interruption.status,
        message: '只有活跃的中断事件可以解决'
      });
    }

    const endTime = data.endTime || moment().toISOString();
    const durationHours = moment(endTime).diff(moment(interruption.startTime), 'hours', true);

    const updateData = {
      status: InterruptionStatuses.RESOLVED,
      endTime,
      durationHours
    };

    if (data.impactKwh !== undefined) {
      updateData.impactKwh = Number(data.impactKwh);
    }
    if (data.notes) {
      updateData.notes = data.notes;
    }

    return store.updateInterruption(id, updateData);
  }

  cancelInterruption(id) {
    const interruption = this.getInterruption(id);
    
    if (interruption.status !== InterruptionStatuses.ACTIVE) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus: interruption.status,
        message: '只有活跃的中断事件可以取消'
      });
    }

    return store.updateInterruption(id, {
      status: InterruptionStatuses.CANCELLED,
      endTime: moment().toISOString()
    });
  }

  getInterruptionsByBerthing(berthingId) {
    berthingService.getBerthing(berthingId);
    return store.getInterruptionsByBerthing(berthingId);
  }

  getActiveInterruption(berthingId) {
    const interruptions = this.getInterruptionsByBerthing(berthingId);
    return interruptions.find(i => i.status === InterruptionStatuses.ACTIVE) || null;
  }

  calculateTotalInterruptionHours(berthingId) {
    const interruptions = this.getInterruptionsByBerthing(berthingId);
    const resolvedInterruptions = interruptions.filter(i => 
      i.status === InterruptionStatuses.RESOLVED && i.durationHours
    );

    const totalHours = resolvedInterruptions.reduce((sum, i) => sum + i.durationHours, 0);
    const totalImpactKwh = resolvedInterruptions.reduce((sum, i) => sum + (i.impactKwh || 0), 0);

    return {
      totalHours,
      totalImpactKwh,
      interruptionCount: resolvedInterruptions.length,
      interruptions: resolvedInterruptions
    };
  }

  validateInterruptionForReview(interruption) {
    const issues = [];
    const warnings = [];

    if (interruption.durationHours && interruption.durationHours > MAX_EXPECTED_INTERRUPTION_HOURS) {
      issues.push({
        code: ErrorCodes.INTERRUPTION_DURATION_EXCEEDS,
        message: '中断时长超过预期范围',
        details: {
          durationHours: interruption.durationHours,
          maxExpected: MAX_EXPECTED_INTERRUPTION_HOURS
        }
      });
    }

    if (interruption.impactKwh && interruption.impactKwh > 500) {
      warnings.push({
        message: '中断影响电量较高，建议复核',
        details: {
          impactKwh: interruption.impactKwh,
          threshold: 500
        }
      });
    }

    return { issues, warnings };
  }
}

module.exports = {
  service: new InterruptionService(),
  InterruptionTypes,
  InterruptionStatuses
};
