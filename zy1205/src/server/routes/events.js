const express = require('express');
const router = express.Router();
const dataStore = require('../storage/DataStore');
const exportService = require('../services/ExportService');

router.get('/', (req, res) => {
  try {
    const { limit, offset, clusterId, instanceId, eventType, severity } = req.query;
    
    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    if (clusterId) options.clusterId = clusterId;
    if (instanceId) options.instanceId = instanceId;
    if (eventType) options.eventType = eventType;
    if (severity) options.severity = severity;
    
    const logs = dataStore.getEventLogs(options);
    res.json({ success: true, data: logs.map(l => l.toJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/types', (req, res) => {
  try {
    const EventType = {
      CLUSTER_CREATED: 'CLUSTER_CREATED',
      CLUSTER_UPDATED: 'CLUSTER_UPDATED',
      CLUSTER_DELETED: 'CLUSTER_DELETED',
      
      INSTANCE_REGISTERED: 'INSTANCE_REGISTERED',
      INSTANCE_DEREGISTERED: 'INSTANCE_DEREGISTERED',
      INSTANCE_STATUS_CHANGED: 'INSTANCE_STATUS_CHANGED',
      INSTANCE_ROLE_CHANGED: 'INSTANCE_ROLE_CHANGED',
      INSTANCE_WEIGHT_CHANGED: 'INSTANCE_WEIGHT_CHANGED',
      
      MASTER_FAILOVER: 'MASTER_FAILOVER',
      MASTER_ELECTION: 'MASTER_ELECTION',
      MASTER_RECOVERED: 'MASTER_RECOVERED',
      
      LOAD_BALANCE_DECISION: 'LOAD_BALANCE_DECISION',
      REQUEST_ROUTED: 'REQUEST_ROUTED',
      
      HEALTH_CHECK_PASSED: 'HEALTH_CHECK_PASSED',
      HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
      INSTANCE_EVICTED: 'INSTANCE_EVICTED',
      INSTANCE_RESTORED: 'INSTANCE_RESTORED',
      
      CONFIG_WARNING: 'CONFIG_WARNING',
      CONFIG_ERROR: 'CONFIG_ERROR',
      
      MANUAL_OPERATION: 'MANUAL_OPERATION'
    };

    const EventSeverity = {
      INFO: 'INFO',
      WARNING: 'WARNING',
      ERROR: 'ERROR',
      CRITICAL: 'CRITICAL'
    };

    res.json({ 
      success: true, 
      data: {
        eventTypes: EventType,
        severities: EventSeverity
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analysis', (req, res) => {
  try {
    const { clusterId } = req.query;
    const analysis = exportService.getEventLogsAnalysis(clusterId || null);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/', (req, res) => {
  try {
    const { clusterId } = req.query;
    dataStore.clearEventLogs(clusterId || null);
    res.json({ success: true, message: '事件日志已清空' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
