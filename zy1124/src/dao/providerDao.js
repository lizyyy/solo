const { run, get, all } = require('../db');

async function createProvider(data) {
  const result = await run(`
    INSERT INTO providers (
      name, algorithm, secret, tolerance_seconds,
      signature_header, timestamp_header, event_id_key, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.name,
    data.algorithm || 'sha256',
    data.secret,
    data.tolerance_seconds || 300,
    data.signature_header || 'X-Signature',
    data.timestamp_header || 'X-Timestamp',
    data.event_id_key || 'eventId',
    data.enabled !== false ? 1 : 0
  ]);
  
  return getProviderById(result.lastID);
}

async function getProviderById(id) {
  return get('SELECT * FROM providers WHERE id = ?', [id]);
}

async function getProviderByName(name) {
  return get('SELECT * FROM providers WHERE name = ?', [name]);
}

async function listProviders(onlyEnabled = false) {
  if (onlyEnabled) {
    return all('SELECT * FROM providers WHERE enabled = 1 ORDER BY created_at DESC');
  }
  return all('SELECT * FROM providers ORDER BY created_at DESC');
}

async function updateProvider(id, data) {
  const current = await getProviderById(id);
  if (!current) return null;
  
  const updates = [];
  const values = [];
  
  if (data.algorithm !== undefined) {
    updates.push('algorithm = ?');
    values.push(data.algorithm);
  }
  if (data.secret !== undefined) {
    updates.push('secret = ?');
    values.push(data.secret);
  }
  if (data.tolerance_seconds !== undefined) {
    updates.push('tolerance_seconds = ?');
    values.push(data.tolerance_seconds);
  }
  if (data.signature_header !== undefined) {
    updates.push('signature_header = ?');
    values.push(data.signature_header);
  }
  if (data.timestamp_header !== undefined) {
    updates.push('timestamp_header = ?');
    values.push(data.timestamp_header);
  }
  if (data.event_id_key !== undefined) {
    updates.push('event_id_key = ?');
    values.push(data.event_id_key);
  }
  if (data.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(data.enabled ? 1 : 0);
  }
  
  if (updates.length === 0) return current;
  
  updates.push('updated_at = strftime("%s", "now")');
  values.push(id);
  
  await run(`UPDATE providers SET ${updates.join(', ')} WHERE id = ?`, values);
  
  return getProviderById(id);
}

async function deleteProvider(id) {
  return run('DELETE FROM providers WHERE id = ?', [id]);
}

module.exports = {
  createProvider,
  getProviderById,
  getProviderByName,
  listProviders,
  updateProvider,
  deleteProvider,
};
