const ResourceType = Object.freeze({
  DOCTOR: 'doctor',
  ROOM: 'room',
  EQUIPMENT: 'equipment'
});

const ConflictSeverity = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
});

const ConflictType = Object.freeze({
  OVERLAP: 'overlap',
  TIME_WINDOW_VIOLATION: 'time_window_violation',
  CAPACITY_EXCEEDED: 'capacity_exceeded'
});

module.exports = {
  ResourceType,
  ConflictSeverity,
  ConflictType
};
