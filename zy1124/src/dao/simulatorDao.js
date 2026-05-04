const { run, get, all } = require('../db');

const SIMULATOR_MODES = {
  SUCCESS: 'success',
  FAIL_ALWAYS: 'fail_always',
  FAIL_N_TIMES: 'fail_n_times',
};

async function createOrUpdateSimulatorConfig(data) {
  const existing = await get(`
    SELECT * FROM simulator_configs 
    WHERE provider_id = ? AND event_type = ?
  `, [data.provider_id, data.event_type || '*']);
  
  if (existing) {
    await run(`
      UPDATE simulator_configs 
      SET mode = ?, fail_count = ?, error_message = ?, delay_ms = ?, enabled = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `, [
      data.mode || 'success',
      data.fail_count || null,
      data.error_message || null,
      data.delay_ms || 0,
      data.enabled !== false ? 1 : 0,
      existing.id
    ]);
    return getSimulatorConfigById(existing.id);
  }
  
  const result = await run(`
    INSERT INTO simulator_configs (
      provider_id, event_type, mode, fail_count, error_message, delay_ms, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.provider_id,
    data.event_type || '*',
    data.mode || 'success',
    data.fail_count || null,
    data.error_message || null,
    data.delay_ms || 0,
    data.enabled !== false ? 1 : 0
  ]);
  
  return getSimulatorConfigById(result.lastID);
}

async function getSimulatorConfigById(id) {
  return get('SELECT * FROM simulator_configs WHERE id = ?', [id]);
}

async function getSimulatorConfig(providerId, eventType = '*') {
  let config = await get(`
    SELECT * FROM simulator_configs 
    WHERE provider_id = ? AND event_type = ? AND enabled = 1
  `, [providerId, eventType]);
  
  if (!config && eventType !== '*') {
    config = await get(`
      SELECT * FROM simulator_configs 
      WHERE provider_id = ? AND event_type = '*' AND enabled = 1
    `, [providerId]);
  }
  
  return config;
}

async function listSimulatorConfigs(providerId) {
  if (providerId) {
    return all(`
      SELECT * FROM simulator_configs WHERE provider_id = ? ORDER BY created_at DESC
    `, [providerId]);
  }
  return all('SELECT * FROM simulator_configs ORDER BY created_at DESC');
}

async function deleteSimulatorConfig(id) {
  return run('DELETE FROM simulator_configs WHERE id = ?', [id]);
}

module.exports = {
  createOrUpdateSimulatorConfig,
  getSimulatorConfigById,
  getSimulatorConfig,
  listSimulatorConfigs,
  deleteSimulatorConfig,
  SIMULATOR_MODES,
};
