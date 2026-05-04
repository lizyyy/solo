const express = require('express');
const router = express.Router();
const {
  createProvider,
  getProviderById,
  getProviderByName,
  listProviders,
  updateProvider,
  deleteProvider,
} = require('../dao/providerDao');
const { 
  createOrUpdateSimulatorConfig,
  listSimulatorConfigs,
  deleteSimulatorConfig,
  getSimulatorConfigById,
} = require('../dao/simulatorDao');
const { createAuditLog, ACTIONS } = require('../dao/auditDao');

router.get('/', async (req, res) => {
  try {
    const onlyEnabled = req.query.enabled === 'true';
    const providers = await listProviders(onlyEnabled);
    res.json({
      success: true,
      data: providers,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const provider = await getProviderById(parseInt(req.params.id));
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }
    res.json({
      success: true,
      data: provider,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/', async (req, res) => {
  const { name, secret, algorithm, tolerance_seconds, signature_header, timestamp_header, event_id_key } = req.body;
  
  if (!name || !secret) {
    return res.status(400).json({
      success: false,
      error: 'name and secret are required',
    });
  }
  
  try {
    const existing = await getProviderByName(name);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Provider with this name already exists',
      });
    }
    
    const provider = await createProvider({
      name,
      secret,
      algorithm,
      tolerance_seconds,
      signature_header,
      timestamp_header,
      event_id_key,
    });
    
    await createAuditLog(
      ACTIONS.PROVIDER_CREATED,
      'provider',
      provider.id,
      { name: provider.name }
    );
    
    res.status(201).json({
      success: true,
      data: provider,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const provider = await getProviderById(id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }
    
    const { algorithm, secret, tolerance_seconds, signature_header, timestamp_header, event_id_key, enabled } = req.body;
    
    const updated = await updateProvider(id, {
      algorithm,
      secret,
      tolerance_seconds,
      signature_header,
      timestamp_header,
      event_id_key,
      enabled,
    });
    
    await createAuditLog(
      ACTIONS.PROVIDER_UPDATED,
      'provider',
      id,
      { fields: Object.keys(req.body) }
    );
    
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const provider = await getProviderById(id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }
    
    await deleteProvider(id);
    
    await createAuditLog(
      ACTIONS.PROVIDER_DELETED,
      'provider',
      id,
      { name: provider.name }
    );
    
    res.json({
      success: true,
      message: 'Provider deleted',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get('/:id/simulator', async (req, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const configs = await listSimulatorConfigs(providerId);
    
    res.json({
      success: true,
      data: configs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/:id/simulator', async (req, res) => {
  const providerId = parseInt(req.params.id);
  
  try {
    const provider = await getProviderById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }
    
    const { event_type, mode, fail_count, error_message, delay_ms, enabled } = req.body;
    
    if (!mode) {
      return res.status(400).json({
        success: false,
        error: 'mode is required',
      });
    }
    
    const config = await createOrUpdateSimulatorConfig({
      provider_id: providerId,
      event_type: event_type || '*',
      mode,
      fail_count,
      error_message,
      delay_ms,
      enabled,
    });
    
    await createAuditLog(
      ACTIONS.SIMULATOR_CONFIG_UPDATED,
      'provider',
      providerId,
      { mode, event_type: event_type || '*' }
    );
    
    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
