import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from './database.js';

export async function createMaterial(data) {
  const now = Date.now();
  const id = uuidv4();
  
  await runAsync(
    `INSERT INTO materials (id, supplier_id, batch_id, material_type, content, status, is_abnormal, cache_version, created_at, updated_at, raw_input)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.supplier_id,
      data.batch_id,
      data.material_type,
      data.content,
      'pending',
      0,
      data.cache_version || null,
      now,
      now,
      JSON.stringify(data)
    ]
  );
  
  return getMaterialById(id);
}

export async function getMaterialById(id) {
  return getAsync('SELECT * FROM materials WHERE id = ?', [id]);
}

export async function getMaterialsByBatch(batchId) {
  return allAsync('SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at', [batchId]);
}

export async function getMaterialsBySupplier(supplierId) {
  return allAsync('SELECT * FROM materials WHERE supplier_id = ? ORDER BY created_at DESC', [supplierId]);
}

export async function getAbnormalMaterials() {
  return allAsync('SELECT * FROM materials WHERE is_abnormal = 1 ORDER BY created_at DESC');
}

export async function updateMaterialStatus(id, status, errorMessage = null) {
  const now = Date.now();
  await runAsync('UPDATE materials SET status = ?, error_message = ?, updated_at = ? WHERE id = ?', [status, errorMessage, now, id]);
  return getMaterialById(id);
}

export async function updateMaterialSummary(id, summary) {
  const now = Date.now();
  await runAsync('UPDATE materials SET summary = ?, updated_at = ? WHERE id = ?', [summary, now, id]);
  return getMaterialById(id);
}

export async function markAsAbnormal(id, errorMessage) {
  const now = Date.now();
  await runAsync('UPDATE materials SET is_abnormal = 1, status = \'error\', error_message = ?, updated_at = ? WHERE id = ?', [errorMessage, now, id]);
  return getMaterialById(id);
}

export async function getMaterialRawInput(id) {
  const material = await getMaterialById(id);
  return material ? JSON.parse(material.raw_input) : null;
}
