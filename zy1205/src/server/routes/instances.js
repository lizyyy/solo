const express = require('express');
const router = express.Router();
const dataStore = require('../storage/DataStore');
const { Instance, InstanceRole, InstanceStatus } = require('../models/Instance');
const { EventType, EventSeverity, EventLog } = require('../models/EventLog');
const serviceDiscovery = require('../services/ServiceDiscovery');
const healthCheckService = require('../services/HealthCheckService');
const { LoadBalancer } = require('../services/LoadBalancer');

router.get('/', (req, res) => {
  try {
    const { clusterId } = req.query;
    let instances;
    
    if (clusterId) {
      instances = dataStore.getInstancesByClusterId(clusterId);
    } else {
      instances = dataStore.getInstances();
    }
    
    res.json({ success: true, data: instances.map(i => i.toJSON()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = dataStore.getInstanceById(instanceId);
    
    if (!instance) {
      return res.status(404).json({ success: false, error: '实例不存在' });
    }
    
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { clusterId, name, host, port, role, weight } = req.body;
    
    const instance = serviceDiscovery.registerInstance(
      clusterId,
      name,
      host,
      port,
      role || InstanceRole.SLAVE,
      weight || 1
    );
    
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const instanceId = req.params.id;
    const { name, host, port, role } = req.body;
    
    const instance = dataStore.getInstanceById(instanceId);
    if (!instance) {
      return res.status(404).json({ success: false, error: '实例不存在' });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    
    if (role !== undefined && role !== instance.role) {
      const cluster = dataStore.getClusterById(instance.clusterId);
      
      if (role === InstanceRole.MASTER) {
        const currentMaster = serviceDiscovery.getMasterInstance(instance.clusterId);
        if (currentMaster && currentMaster.id !== instanceId) {
          dataStore.updateInstance(currentMaster.id, {
            role: InstanceRole.SLAVE,
            lastStatusChangeTime: Date.now()
          });
          
          dataStore.addEventLog(new EventLog(
            null,
            EventType.INSTANCE_ROLE_CHANGED,
            EventSeverity.WARNING,
            instance.clusterId,
            currentMaster.id,
            `实例 ${currentMaster.name} 角色变更为从节点`,
            {
              oldRole: InstanceRole.MASTER,
              newRole: InstanceRole.SLAVE,
              reason: '手动切换主节点'
            }
          ));
        }
      }
      
      updateData.role = role;
      updateData.lastStatusChangeTime = Date.now();
      
      dataStore.addEventLog(new EventLog(
        null,
        EventType.INSTANCE_ROLE_CHANGED,
        EventSeverity.INFO,
        instance.clusterId,
        instanceId,
        `实例 ${instance.name} 角色变更`,
        {
          oldRole: instance.role,
          newRole: role
        }
      ));
    }
    
    const updatedInstance = dataStore.updateInstance(instanceId, updateData);
    res.json({ success: true, data: updatedInstance.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const instanceId = req.params.id;
    const success = serviceDiscovery.deregisterInstance(instanceId);
    
    if (success) {
      res.json({ success: true, message: '实例注销成功' });
    } else {
      res.status(404).json({ success: false, error: '实例不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/set-down', (req, res) => {
  try {
    const instanceId = req.params.id;
    const { reason } = req.body;
    
    const instance = healthCheckService.manualSetInstanceDown(instanceId, reason);
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/recover', (req, res) => {
  try {
    const instanceId = req.params.id;
    const instance = healthCheckService.manualRecoverInstance(instanceId);
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/weight', (req, res) => {
  try {
    const instanceId = req.params.id;
    const { weight } = req.body;
    
    if (weight === undefined || weight < 1 || weight > 100) {
      return res.status(400).json({ 
        success: false, 
        error: '权重必须在1-100之间' 
      });
    }
    
    const instance = healthCheckService.updateInstanceWeight(instanceId, weight);
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/release-connection', (req, res) => {
  try {
    const instanceId = req.params.id;
    LoadBalancer.releaseConnection(instanceId);
    
    const instance = dataStore.getInstanceById(instanceId);
    res.json({ success: true, data: instance.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
