const storage = {
  queueMetrics: new Map(),
  consumerHeartbeats: new Map(),
  retryQueues: new Map(),
  failureSamples: new Map(),
  alerts: new Map(),
  dedupKeys: new Map()
}

module.exports = storage
