const MessageType = {
  TELEMETRY: 'telemetry',
  CONTROL: 'control',
  EVENT: 'event',
  ERROR: 'error',
  INFO: 'info',
  ACK: 'ack'
};

const ControlAction = {
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  STOP: 'stop',
  SPEED: 'speed',
  STEP_FORWARD: 'step_forward',
  STEP_BACKWARD: 'step_backward',
  LOAD_DATA: 'load_data',
  CLEAR_DATA: 'clear_data'
};

const EventType = {
  STATE_CHANGE: 'STATE_CHANGE',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
  LATENCY_WARNING: 'LATENCY_WARNING',
  CHECKPOINT_REACHED: 'CHECKPOINT_REACHED',
  COMMAND_ACK: 'COMMAND_ACK',
  SENSOR_ALERT: 'SENSOR_ALERT',
  BATTERY_LOW: 'BATTERY_LOW',
  TAG_CREATED: 'TAG_CREATED',
  SESSION_SAVED: 'SESSION_SAVED',
  DATA_LOADED: 'DATA_LOADED'
};

const RobotState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED'
};

const CommandStatus = {
  SENT: 'SENT',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  TIMEOUT: 'TIMEOUT',
  FAILED: 'FAILED'
};

const CommandType = {
  VELOCITY: 'VELOCITY',
  POSITION: 'POSITION',
  STOP: 'STOP',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
  RESET: 'RESET',
  CUSTOM: 'CUSTOM'
};

function createTelemetryMessage(options) {
  const {
    timestamp = Date.now(),
    sequence = 0,
    data = {},
    latency = null,
    metadata = {}
  } = options;

  return {
    type: MessageType.TELEMETRY,
    timestamp,
    sequence,
    data: {
      state: data.state || RobotState.IDLE,
      position: data.position || { x: 0, y: 0, theta: 0 },
      velocity: data.velocity || { linear: 0, angular: 0 },
      battery: data.battery !== undefined ? data.battery : 12.5,
      emergency_stop: data.emergency_stop || false,
      sensors: data.sensors || {},
      ...data
    },
    latency: latency ? {
      command_ack: latency.command_ack || 0,
      sensor_update: latency.sensor_update || 0,
      total: latency.total || 0
    } : null,
    metadata
  };
}

function createControlMessage(action, params = {}) {
  return {
    type: MessageType.CONTROL,
    action,
    params,
    timestamp: Date.now()
  };
}

function createEventMessage(eventType, details = {}, timestamp = Date.now()) {
  return {
    type: MessageType.EVENT,
    event_type: eventType,
    timestamp,
    details
  };
}

function createErrorMessage(error, context = {}) {
  return {
    type: MessageType.ERROR,
    timestamp: Date.now(),
    error: {
      message: error.message || String(error),
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack
    },
    context
  };
}

function createInfoMessage(info, context = {}) {
  return {
    type: MessageType.INFO,
    timestamp: Date.now(),
    info,
    context
  };
}

function validateTelemetryData(data) {
  const errors = [];
  const warnings = [];

  if (!data.timestamp && data.timestamp !== 0) {
    errors.push('Missing required field: timestamp');
  }

  if (data.timestamp && typeof data.timestamp !== 'number') {
    errors.push('Invalid timestamp: must be a number');
  }

  if (data.state && !Object.values(RobotState).includes(data.state)) {
    warnings.push(`Unknown robot state: ${data.state}`);
  }

  if (data.position) {
    if (typeof data.position.x !== 'number') errors.push('position.x must be a number');
    if (typeof data.position.y !== 'number') errors.push('position.y must be a number');
    if (typeof data.position.theta !== 'number') errors.push('position.theta must be a number');
  }

  if (data.battery !== undefined && (data.battery < 0 || data.battery > 20)) {
    warnings.push(`Battery value out of expected range: ${data.battery}V`);
  }

  if (data.emergency_stop !== undefined && typeof data.emergency_stop !== 'boolean') {
    errors.push('emergency_stop must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateControlMessage(msg) {
  const errors = [];

  if (!msg.action) {
    errors.push('Missing required field: action');
  } else if (!Object.values(ControlAction).includes(msg.action)) {
    errors.push(`Unknown control action: ${msg.action}`);
  }

  if (msg.action === ControlAction.SEEK && !msg.params?.timestamp) {
    errors.push('SEEK action requires params.timestamp');
  }

  if (msg.action === ControlAction.SPEED && (msg.params?.speed === undefined || msg.params?.speed <= 0)) {
    errors.push('SPEED action requires params.speed > 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  MessageType,
  ControlAction,
  EventType,
  RobotState,
  CommandStatus,
  CommandType,
  createTelemetryMessage,
  createControlMessage,
  createEventMessage,
  createErrorMessage,
  createInfoMessage,
  validateTelemetryData,
  validateControlMessage
};
