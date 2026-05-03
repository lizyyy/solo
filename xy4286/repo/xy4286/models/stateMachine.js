const moment = require('moment');

const STATES = {
  BOX: {
    IDLE: 'idle',
    IN_TRANSIT: 'in_transit',
    AT_STATION: 'at_station',
    COMPLETED: 'completed',
    MAINTENANCE: 'maintenance'
  },
  BATCH: {
    PENDING: 'pending',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    COMPROMISED: 'compromised',
    REJECTED: 'rejected'
  },
  STATION: {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  },
  PERSON: {
    AVAILABLE: 'available',
    ON_DUTY: 'on_duty',
    OFF_DUTY: 'off_duty'
  },
  HANDOVER: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  }
};

const TRANSITIONS = {
  BOX: {
    [STATES.BOX.IDLE]: [STATES.BOX.IN_TRANSIT, STATES.BOX.MAINTENANCE],
    [STATES.BOX.IN_TRANSIT]: [STATES.BOX.AT_STATION, STATES.BOX.COMPLETED],
    [STATES.BOX.AT_STATION]: [STATES.BOX.IN_TRANSIT, STATES.BOX.COMPLETED],
    [STATES.BOX.MAINTENANCE]: [STATES.BOX.IDLE],
    [STATES.BOX.COMPLETED]: []
  },
  BATCH: {
    [STATES.BATCH.PENDING]: [STATES.BATCH.IN_TRANSIT, STATES.BATCH.REJECTED],
    [STATES.BATCH.IN_TRANSIT]: [STATES.BATCH.DELIVERED, STATES.BATCH.COMPROMISED],
    [STATES.BATCH.DELIVERED]: [],
    [STATES.BATCH.COMPROMISED]: [],
    [STATES.BATCH.REJECTED]: []
  },
  HANDOVER: {
    [STATES.HANDOVER.PENDING]: [STATES.HANDOVER.IN_PROGRESS, STATES.HANDOVER.CANCELLED],
    [STATES.HANDOVER.IN_PROGRESS]: [STATES.HANDOVER.COMPLETED, STATES.HANDOVER.CANCELLED],
    [STATES.HANDOVER.COMPLETED]: [],
    [STATES.HANDOVER.CANCELLED]: []
  }
};

class StateMachine {
  constructor(initialState, transitions) {
    this.currentState = initialState;
    this.transitions = transitions;
    this.history = [{
      state: initialState,
      timestamp: moment().toISOString(),
      reason: 'initial'
    }];
  }

  canTransitionTo(newState) {
    const allowedTransitions = this.transitions[this.currentState] || [];
    return allowedTransitions.includes(newState);
  }

  transitionTo(newState, reason = '') {
    if (!this.canTransitionTo(newState)) {
      throw new Error(`Invalid state transition: ${this.currentState} -> ${newState}`);
    }
    
    this.currentState = newState;
    this.history.push({
      state: newState,
      timestamp: moment().toISOString(),
      reason
    });
    
    return this.currentState;
  }

  getCurrentState() {
    return this.currentState;
  }

  getHistory() {
    return [...this.history];
  }

  toJSON() {
    return {
      currentState: this.currentState,
      history: this.history
    };
  }

  static fromJSON(json) {
    const sm = new StateMachine(json.currentState, TRANSITIONS.BOX);
    sm.history = json.history;
    return sm;
  }
}

module.exports = {
  STATES,
  TRANSITIONS,
  StateMachine
};
