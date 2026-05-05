const express = require('express');
const router = express.Router();
const dataStore = require('../storage/DataStore');
const Cluster = require('../models/Cluster');
const { InstanceRole, InstanceStatus } = require('../models/Instance');
const { EventType, EventSeverity, EventLog } = require('../models/EventLog');
const serviceDiscovery = require('../services/ServiceDiscovery');
const healthCheckService = require('../services/HealthCheckService');
const { LoadBalancer, LoadBalancerStrategy } = require('../services/LoadBalancer');
const exportService = require('../services/ExportService');

router.get('/', (req, res) => {
  try {
    const clusters = dataStore.getClusters();
    const result = clusters.map(cluster => {
      const instances = dataStore.getInstancesByClusterId(cluster.id);
      const master = instances.find(i => i.isMaster());
      const healthyCount = instances.filter(i => i.isAvailable()).length;
      
      return {
        ...cluster.toJSON(),
        instanceCount: instances.length,
        healthyInstanceCount: healthyCount,
        masterName: master?.name || null,
        hasMaster: !!master
      };
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const clusterId = req.params.id;
    const status = serviceDiscovery.getClusterStatus(clusterId);
    
    if (!status) {
      return res.status(404).json({ success: false, error: '集群不存在' });
    }
    
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, description, loadBalancerStrategy, healthCheckInterval } = req.body;
    
    const cluster = new Cluster(
      null,
      name,
      description,
      loadBalancerStrategy || 'ROUND_ROBIN',
      healthCheckInterval || 30000
    );
    
    const validation = cluster.validate();
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: '验证失败', 
        details: validation.errors 
      });
    }
    
    const createdCluster = dataStore.createCluster(cluster);
    
    dataStore.addEventLog(new EventLog(
      null,
      EventType.CLUSTER_CREATED,
      EventSeverity.INFO,
      createdCluster.id,
      null,
      `集群 ${createdCluster.name} 创建成功`,
      {
        name: createdCluster.name,
        description: createdCluster.description,
        loadBalancerStrategy: createdCluster.loadBalancerStrategy,
        healthCheckInterval: createdCluster.healthCheckInterval
      }
    ));
    
    res.json({ success: true, data: createdCluster.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const clusterId = req.params.id;
    const { name, description, loadBalancerStrategy, healthCheckInterval } = req.body;
    
    const cluster = dataStore.getClusterById(clusterId);
    if (!cluster) {
      return res.status(404).json({ success: false, error: '集群不存在' });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (loadBalancerStrategy !== undefined) updateData.loadBalancerStrategy = loadBalancerStrategy;
    if (healthCheckInterval !== undefined) updateData.healthCheckInterval = healthCheckInterval;
    
    const updatedCluster = dataStore.updateCluster(clusterId, updateData);
    
    dataStore.addEventLog(new EventLog(
      null,
      EventType.CLUSTER_UPDATED,
      EventSeverity.INFO,
      clusterId,
      null,
      `集群 ${updatedCluster.name} 更新`,
      {
        changes: Object.keys(updateData)
      }
    ));
    
    res.json({ success: true, data: updatedCluster.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const clusterId = req.params.id;
    const cluster = dataStore.getClusterById(clusterId);
    
    if (!cluster) {
      return res.status(404).json({ success: false, error: '集群不存在' });
    }
    
    dataStore.addEventLog(new EventLog(
      null,
      EventType.CLUSTER_DELETED,
      EventSeverity.WARNING,
      clusterId,
      null,
      `集群 ${cluster.name} 删除`,
      {
        name: cluster.name,
        reason: '手动删除'
      }
    ));
    
    dataStore.deleteCluster(clusterId);
    res.json({ success: true, message: '集群删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/elect-master', (req, res) => {
  try {
    const clusterId = req.params.id;
    const newMaster = serviceDiscovery.electMaster(clusterId);
    res.json({ success: true, data: { newMaster: newMaster.toJSON() } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/route-request', (req, res) => {
  try {
    const clusterId = req.params.id;
    const { requestId } = req.body;
    
    const result = LoadBalancer.routeRequest(clusterId, requestId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/load-balancer-stats', (req, res) => {
  try {
    const clusterId = req.params.id;
    const stats = LoadBalancer.getStats(clusterId);
    
    if (!stats) {
      return res.status(404).json({ success: false, error: '集群不存在' });
    }
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/health-stats', (req, res) => {
  try {
    const clusterId = req.params.id;
    const stats = healthCheckService.getAllHealthCheckStats(clusterId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/events', (req, res) => {
  try {
    const clusterId = req.params.id;
    const { limit, offset, eventType, severity } = req.query;
    
    const options = { clusterId };
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    if (eventType) options.eventType = eventType;
    if (severity) options.severity = severity;
    
    const logs = dataStore.getEventLogs(options);
    res.json({ success: true, data: logs.map(l => l.toJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/analysis', (req, res) => {
  try {
    const clusterId = req.params.id;
    const analysis = exportService.getEventLogsAnalysis(clusterId);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/export/json', (req, res) => {
  try {
    const clusterId = req.params.id;
    const result = exportService.exportToJSON(clusterId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=cluster-export-${Date.now()}.json`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/export/markdown', (req, res) => {
  try {
    const clusterId = req.params.id;
    const result = exportService.exportToMarkdown(clusterId);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=cluster-report-${Date.now()}.md`);
    res.send(result.markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
