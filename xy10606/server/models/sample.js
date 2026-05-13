const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

async function getAllSamples(filter = {}) {
  let query = 'SELECT * FROM samples WHERE 1=1';
  const params = [];
  
  if (filter.sku) {
    query += ' AND sku LIKE ?';
    params.push(`%${filter.sku}%`);
  }
  if (filter.name) {
    query += ' AND name LIKE ?';
    params.push(`%${filter.name}%`);
  }
  if (filter.category) {
    query += ' AND category LIKE ?';
    params.push(`%${filter.category}%`);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return await all(query, params);
}

async function getSampleById(id) {
  return await get('SELECT * FROM samples WHERE id = ?', [id]);
}

async function getSampleBySku(sku) {
  return await get('SELECT * FROM samples WHERE sku = ?', [sku]);
}

async function createSample(data) {
  const id = uuidv4();
  await run(`
    INSERT INTO samples 
    (id, sku, name, category, unit_cost, quantity_in_stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.sku,
    data.name,
    data.category || null,
    data.unit_cost || 0,
    data.quantity_in_stock || 0
  ]);
  
  await saveSampleVersion(id, null, '创建', data.created_by || 'system');
  
  return await getSampleById(id);
}

async function updateSample(id, data, updatedBy = 'system') {
  const current = await getSampleById(id);
  if (!current) return null;
  
  const newData = {
    sku: data.sku || current.sku,
    name: data.name || current.name,
    category: data.category !== undefined ? data.category : current.category,
    unit_cost: data.unit_cost !== undefined ? data.unit_cost : current.unit_cost,
    quantity_in_stock: data.quantity_in_stock !== undefined ? data.quantity_in_stock : current.quantity_in_stock
  };
  
  await run(`
    UPDATE samples 
    SET sku = ?, name = ?, category = ?, unit_cost = ?, quantity_in_stock = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newData.sku,
    newData.name,
    newData.category,
    newData.unit_cost,
    newData.quantity_in_stock,
    id
  ]);
  
  await saveSampleVersion(id, current, data.change_reason || '修改', updatedBy);
  
  return await getSampleById(id);
}

async function saveSampleVersion(sampleId, oldData, changeReason, createdBy) {
  const id = uuidv4();
  
  if (oldData) {
    await run(`
      INSERT INTO sample_versions 
      (id, sample_id, sku, name, category, unit_cost, quantity_in_stock, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      sampleId,
      oldData.sku,
      oldData.name,
      oldData.category,
      oldData.unit_cost,
      oldData.quantity_in_stock,
      changeReason,
      createdBy
    ]);
  } else {
    const current = await getSampleById(sampleId);
    await run(`
      INSERT INTO sample_versions 
      (id, sample_id, sku, name, category, unit_cost, quantity_in_stock, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      sampleId,
      current.sku,
      current.name,
      current.category,
      current.unit_cost,
      current.quantity_in_stock,
      changeReason,
      createdBy
    ]);
  }
}

async function getSampleVersions(sampleId) {
  return await all(`
    SELECT * FROM sample_versions 
    WHERE sample_id = ? 
    ORDER BY created_at DESC
  `, [sampleId]);
}

async function updateSampleStock(sampleId, quantity) {
  const current = await getSampleById(sampleId);
  if (!current) return null;
  
  const newQuantity = current.quantity_in_stock + quantity;
  
  await run('UPDATE samples SET quantity_in_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newQuantity, sampleId]);
  
  return await getSampleById(sampleId);
}

module.exports = {
  getAllSamples,
  getSampleById,
  getSampleBySku,
  createSample,
  updateSample,
  getSampleVersions,
  updateSampleStock
};
