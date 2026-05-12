export const ServiceStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
};

export const DegradeAction = {
  CACHE: 'cache',
  FALLBACK: 'fallback',
  BLOCK: 'block',
  NO_DEGRADE: 'no_degrade',
};

export const DrillStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const ServiceRole = {
  CORE: 'core',
  NON_CORE: 'non_core',
};
