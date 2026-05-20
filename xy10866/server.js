const express = require('express');
const cors = require('cors');
const Storage = require('./storage');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function logRequest(req, res, next) {
  const oldSend = res.send;
  let responseBody;
  res.send = function(body) {
    responseBody = body;
    oldSend.call(this, body);
  };
  
  res.on('finish', () => {
    Storage.logRequest({
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      statusCode: res.statusCode,
      response: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
    });
  });
  next();
}

app.use(logRequest);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/services', (req, res) => {
  try {
    const { name, description, ownerId, status = 'planning' } = req.body;
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'name and ownerId are required' });
    }
    const service = Storage.create('services', { name, description, ownerId, status, contactLostRisk: false, environments: [] });
    res.json(service);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/services', (req, res) => {
  try {
    let services = Storage.getAll('services');
    const { ownerId, status, search } = req.query;
    if (ownerId) services = services.filter(s => s.ownerId === ownerId);
    if (status) services = services.filter(s => s.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      services = services.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        (s.description && s.description.toLowerCase().includes(searchLower))
      );
    }
    res.json(services);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/services/:id', (req, res) => {
  try {
    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    const endpoints = Storage.find('endpoints', e => e.serviceId === service.id);
    const owner = Storage.getById('owners', service.ownerId);
    const transitions = Storage.find('transitions', t => t.serviceId === service.id);
    const allEnvs = Storage.getAll('environments');
    const environments = (service.environments || []).map(envId =>
      allEnvs.find(e => e.id === envId)
    ).filter(Boolean);
    res.json({ ...service, endpoints, owner, transitions, environments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/services/:id', (req, res) => {
  try {
    const updated = Storage.update('services', req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Service not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:id/change-owner', (req, res) => {
  try {
    const { newOwnerId, reason } = req.body;
    if (!newOwnerId) return res.status(400).json({ error: 'newOwnerId is required' });
    
    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    const oldOwnerId = service.ownerId;
    Storage.update('services', req.params.id, { ownerId: newOwnerId });
    Storage.create('transitions', {
      serviceId: req.params.id,
      oldOwnerId,
      newOwnerId,
      reason,
      transitionType: 'owner_change'
    });
    
    res.json({ success: true, message: 'Owner changed successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:id/alert-lost', (req, res) => {
  try {
    const { notes } = req.body;
    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    Storage.update('services', req.params.id, { contactLostRisk: true });
    Storage.create('alerts', {
      serviceId: req.params.id,
      type: 'contact_lost',
      severity: 'high',
      notes,
      status: 'open'
    });
    
    res.json({ success: true, message: 'Alert created' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/endpoints', (req, res) => {
  try {
    const { serviceId, path, method, description, ownerId } = req.body;
    if (!serviceId || !path || !method) {
      return res.status(400).json({ error: 'serviceId, path, method are required' });
    }
    const endpoint = Storage.create('endpoints', { serviceId, path, method, description, ownerId, status: 'active' });
    res.json(endpoint);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/endpoints', (req, res) => {
  try {
    let endpoints = Storage.getAll('endpoints');
    const { serviceId, method } = req.query;
    if (serviceId) endpoints = endpoints.filter(e => e.serviceId === serviceId);
    if (method) endpoints = endpoints.filter(e => e.method === method.toUpperCase());
    res.json(endpoints);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/endpoints/:id', (req, res) => {
  try {
    const endpoint = Storage.getById('endpoints', req.params.id);
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });
    res.json(endpoint);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/owners', (req, res) => {
  try {
    const { name, email, team, phone } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
    const owner = Storage.create('owners', { name, email, team, phone, active: true });
    res.json(owner);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/owners', (req, res) => {
  try {
    let owners = Storage.getAll('owners');
    const { team, active } = req.query;
    if (team) owners = owners.filter(o => o.team === team);
    if (active !== undefined) owners = owners.filter(o => o.active === (active === 'true'));
    res.json(owners);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/owners/:id', (req, res) => {
  try {
    const owner = Storage.getById('owners', req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    const services = Storage.find('services', s => s.ownerId === owner.id);
    const endpoints = Storage.find('endpoints', e => e.ownerId === owner.id);
    res.json({ ...owner, services, endpoints });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/alerts', (req, res) => {
  try {
    let alerts = Storage.getAll('alerts');
    const { status, type } = req.query;
    if (status) alerts = alerts.filter(a => a.status === status);
    if (type) alerts = alerts.filter(a => a.type === type);
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/transitions', (req, res) => {
  try {
    let transitions = Storage.getAll('transitions');
    const { serviceId } = req.query;
    if (serviceId) transitions = transitions.filter(t => t.serviceId === serviceId);
    res.json(transitions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/directory', (req, res) => {
  try {
    const services = Storage.getAll('services');
    const endpoints = Storage.getAll('endpoints');
    const owners = Storage.getAll('owners');
    const environments = Storage.getAll('environments');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalServices: services.length,
        totalEndpoints: endpoints.length,
        totalOwners: owners.length,
        totalEnvironments: environments.length,
        atRiskServices: services.filter(s => s.contactLostRisk).length
      },
      environments,
      services: services.map(s => ({
        ...s,
        owner: owners.find(o => o.id === s.ownerId),
        endpoints: endpoints.filter(e => e.serviceId === s.id),
        environments: (s.environments || []).map(envId => environments.find(e => e.id === envId)).filter(Boolean)
      }))
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="service-directory-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const services = Storage.getAll('services');
    const endpoints = Storage.getAll('endpoints');
    const owners = Storage.getAll('owners');
    const environments = Storage.getAll('environments');
    const alerts = Storage.getAll('alerts');
    const requests = Storage.getAll('requests');
    
    res.json({
      services: services.length,
      endpoints: endpoints.length,
      owners: owners.length,
      environments: environments.length,
      activeAlerts: alerts.filter(a => a.status === 'open').length,
      atRiskServices: services.filter(s => s.contactLostRisk).length,
      totalRequests: requests.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/requests', (req, res) => {
  try {
    const requests = Storage.getAll('requests').slice(-100);
    res.json(requests.reverse());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/environments', (req, res) => {
  try {
    const { name, description, type, url } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    const environment = Storage.create('environments', {
      name,
      description,
      type,
      url,
      status: 'active'
    });
    res.json(environment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/environments', (req, res) => {
  try {
    let environments = Storage.getAll('environments');
    const { type, status } = req.query;
    if (type) environments = environments.filter(e => e.type === type);
    if (status) environments = environments.filter(e => e.status === status);
    res.json(environments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/environments/:id', (req, res) => {
  try {
    const environment = Storage.getById('environments', req.params.id);
    if (!environment) return res.status(404).json({ error: 'Environment not found' });
    const services = Storage.getAll('services').filter(s =>
      s.environments && s.environments.includes(req.params.id)
    );
    res.json({ ...environment, services });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/environments/:id', (req, res) => {
  try {
    const updated = Storage.update('environments', req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Environment not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:id/bind-environment', (req, res) => {
  try {
    const { environmentId } = req.body;
    if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });

    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const environment = Storage.getById('environments', environmentId);
    if (!environment) return res.status(404).json({ error: 'Environment not found' });

    const currentEnvs = service.environments || [];
    if (!currentEnvs.includes(environmentId)) {
      Storage.update('services', req.params.id, {
        environments: [...currentEnvs, environmentId]
      });
    }

    res.json({ success: true, message: 'Environment bound successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:id/unbind-environment', (req, res) => {
  try {
    const { environmentId } = req.body;
    if (!environmentId) return res.status(400).json({ error: 'environmentId is required' });

    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const currentEnvs = service.environments || [];
    Storage.update('services', req.params.id, {
      environments: currentEnvs.filter(id => id !== environmentId)
    });

    res.json({ success: true, message: 'Environment unbound successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const SERVICE_STATUS_FLOW = {
  'planning': ['development'],
  'development': ['testing', 'deprecated'],
  'testing': ['active', 'development'],
  'active': ['maintenance', 'deprecated'],
  'maintenance': ['active', 'deprecated'],
  'deprecated': []
};

app.post('/api/services/:id/advance-status', (req, res) => {
  try {
    const { targetStatus, reason } = req.body;
    if (!targetStatus) return res.status(400).json({ error: 'targetStatus is required' });

    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const currentStatus = service.status || 'planning';
    const allowedTransitions = SERVICE_STATUS_FLOW[currentStatus] || [];

    if (!allowedTransitions.includes(targetStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${targetStatus}`,
        allowedTransitions
      });
    }

    Storage.update('services', req.params.id, { status: targetStatus });
    Storage.create('transitions', {
      serviceId: req.params.id,
      transitionType: 'status_change',
      oldStatus: currentStatus,
      newStatus: targetStatus,
      reason
    });

    res.json({
      success: true,
      message: `Status advanced from ${currentStatus} to ${targetStatus}`,
      previousStatus: currentStatus,
      currentStatus: targetStatus
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/services/:id/status-flow', (req, res) => {
  try {
    const service = Storage.getById('services', req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const currentStatus = service.status || 'planning';
    res.json({
      currentStatus,
      allowedTransitions: SERVICE_STATUS_FLOW[currentStatus] || [],
      allStatuses: Object.keys(SERVICE_STATUS_FLOW)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/`);
});
