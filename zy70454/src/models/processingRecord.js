import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from './database.js';

export async function createProcessingRecord(data) {
  const now = Date.now();
  const id = uuidv4();
  
  await runAsync(
    `INSERT INTO processing_records (id, batch_id, material_id, action, result, conclusion, rerun_marker, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.batch_id,
      data.material_id,
      data.action,
      data.result,
      data.conclusion || null,
      data.rerun_marker || null,
      now
    ]
  );
  
  return getProcessingRecordById(id);
}

export async function getProcessingRecordById(id) {
  return getAsync('SELECT * FROM processing_records WHERE id = ?', [id]);
}

export async function getRecordsByBatch(batchId) {
  return allAsync('SELECT * FROM processing_records WHERE batch_id = ? ORDER BY created_at', [batchId]);
}

export async function getRecordsByMaterial(materialId) {
  return allAsync('SELECT * FROM processing_records WHERE material_id = ? ORDER BY created_at', [materialId]);
}

export async function getRecordsByRerunMarker(rerunMarker) {
  return allAsync('SELECT * FROM processing_records WHERE rerun_marker = ? ORDER BY created_at', [rerunMarker]);
}

export async function getFullTraceByRerunMarker(rerunMarker) {
  return allAsync(`
    SELECT 
      pr.id as record_id,
      pr.action,
      pr.result,
      pr.conclusion,
      pr.rerun_marker,
      pr.created_at,
      m.id as material_id,
      m.material_type,
      m.content,
      m.status,
      m.raw_input as material_raw_input,
      s.id as supplier_id,
      s.code as supplier_code,
      s.name as supplier_name,
      s.raw_input as supplier_raw_input
    FROM processing_records pr
    JOIN materials m ON pr.material_id = m.id
    JOIN suppliers s ON m.supplier_id = s.id
    WHERE pr.rerun_marker = ?
    ORDER BY pr.created_at
  `, [rerunMarker]);
}
