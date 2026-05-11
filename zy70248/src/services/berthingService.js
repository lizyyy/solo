const store = require('../data/store');
const shipService = require('./shipService');
const { createError, ErrorCodes } = require('../utils/errors');
const moment = require('moment');

const BerthingStates = {
  ARRIVING: 'ARRIVING',
  DOCKED: 'DOCKED',
  SHORE_POWER_CONNECTED: 'SHORE_POWER_CONNECTED',
  USING_SHORE_POWER: 'USING_SHORE_POWER',
  DISCONNECTING_POWER: 'DISCONNECTING_POWER',
  PREPARING_DEPARTURE: 'PREPARING_DEPARTURE',
  DEPARTED: 'DEPARTED',
  CANCELLED: 'CANCELLED'
};

const ValidTransitions = {
  [BerthingStates.ARRIVING]: [BerthingStates.DOCKED, BerthingStates.CANCELLED],
  [BerthingStates.DOCKED]: [BerthingStates.SHORE_POWER_CONNECTED, BerthingStates.PREPARING_DEPARTURE],
  [BerthingStates.SHORE_POWER_CONNECTED]: [BerthingStates.USING_SHORE_POWER, BerthingStates.DISCONNECTING_POWER],
  [BerthingStates.USING_SHORE_POWER]: [BerthingStates.DISCONNECTING_POWER],
  [BerthingStates.DISCONNECTING_POWER]: [BerthingStates.PREPARING_DEPARTURE],
  [BerthingStates.PREPARING_DEPARTURE]: [BerthingStates.DEPARTED],
  [BerthingStates.DEPARTED]: [],
  [BerthingStates.CANCELLED]: []
};

class BerthingService {
  createBerthing(data) {
    if (!data.shipId || !data.terminal || !data.berthNumber) {
      throw createError(ErrorCodes.INVALID_PARAMETERS, {
        required: ['shipId', 'terminal', 'berthNumber'],
        provided: Object.keys(data)
      });
    }

    shipService.getShip(data.shipId);

    const estimatedArrival = data.estimatedArrival || moment().add(2, 'hours').toISOString();

    return store.createBerthing({
      shipId: data.shipId,
      terminal: data.terminal,
      berthNumber: data.berthNumber,
      estimatedArrival,
      estimatedDeparture: data.estimatedDeparture || null,
      voyageNumber: data.voyageNumber || null,
      cargoType: data.cargoType || null
    });
  }

  getBerthing(id) {
    const berthing = store.getBerthing(id);
    if (!berthing) {
      throw createError(ErrorCodes.BERTHING_NOT_FOUND, { berthingId: id });
    }
    return berthing;
  }

  validateTransition(currentStatus, newStatus) {
    const validNextStates = ValidTransitions[currentStatus];
    if (!validNextStates || !validNextStates.includes(newStatus)) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus,
        newStatus,
        validTransitions: validNextStates || []
      });
    }
    return true;
  }

  transitionStatus(id, newStatus, additionalData = {}) {
    const berthing = this.getBerthing(id);
    
    this.validateTransition(berthing.status, newStatus);

    const updateData = { ...additionalData };

    switch (newStatus) {
      case BerthingStates.DOCKED:
        updateData.actualArrival = moment().toISOString();
        break;
      case BerthingStates.SHORE_POWER_CONNECTED:
        updateData.powerConnectedAt = moment().toISOString();
        break;
      case BerthingStates.USING_SHORE_POWER:
        updateData.powerUsageStartedAt = moment().toISOString();
        break;
      case BerthingStates.DISCONNECTING_POWER:
        updateData.powerDisconnectedAt = moment().toISOString();
        break;
      case BerthingStates.DEPARTED:
        updateData.actualDeparture = moment().toISOString();
        break;
    }

    return store.updateBerthingStatus(id, newStatus, updateData);
  }

  dock(id) {
    return this.transitionStatus(id, BerthingStates.DOCKED);
  }

  connectShorePower(id) {
    return this.transitionStatus(id, BerthingStates.SHORE_POWER_CONNECTED);
  }

  startUsingPower(id) {
    return this.transitionStatus(id, BerthingStates.USING_SHORE_POWER);
  }

  disconnectPower(id) {
    return this.transitionStatus(id, BerthingStates.DISCONNECTING_POWER);
  }

  prepareDeparture(id) {
    return this.transitionStatus(id, BerthingStates.PREPARING_DEPARTURE);
  }

  depart(id) {
    return this.transitionStatus(id, BerthingStates.DEPARTED);
  }

  cancel(id) {
    const berthing = this.getBerthing(id);
    if (berthing.status === BerthingStates.DEPARTED) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus: berthing.status,
        message: '已离港的靠泊记录无法取消'
      });
    }
    return store.updateBerthingStatus(id, BerthingStates.CANCELLED);
  }

  getAllBerthings() {
    return store.getAllBerthings();
  }

  getBerthingsByShip(shipId) {
    shipService.getShip(shipId);
    return store.getBerthingsByShip(shipId);
  }

  isPowerActive(id) {
    const berthing = this.getBerthing(id);
    return berthing.status === BerthingStates.USING_SHORE_POWER;
  }

  isCompleted(id) {
    const berthing = this.getBerthing(id);
    return berthing.status === BerthingStates.DEPARTED;
  }
}

module.exports = {
  service: new BerthingService(),
  BerthingStates,
  ValidTransitions
};
