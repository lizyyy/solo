import { getDb } from './database.js';
import { ClassroomError } from './errors.js';

export function createPartsList(name, createdBy, parts = [], steps = []) {
  const db = getDb();
  
  const existing = db.prepare('SELECT MAX(version) as max_version FROM parts_lists WHERE name = ?').get(name);
  const version = existing?.max_version ? existing.max_version + 1 : 1;
  
  const result = db.prepare(`
    INSERT INTO parts_lists (name, version, created_by)
    VALUES (?, ?, ?)
  `).run(name, version, createdBy);
  
  const partsListId = result.lastInsertRowid;
  
  for (const part of parts) {
    addPart(partsListId, part, createdBy, false);
  }
  
  for (const step of steps) {
    addAssemblyStep(partsListId, step, createdBy, false);
  }
  
  logChange('parts_list', partsListId, 'create', createdBy, null, JSON.stringify({ name, version, parts, steps }));
  
  return { id: partsListId, name, version };
}

export function addPart(partsListId, partData, modifiedBy, log = true) {
  const db = getDb();
  
  const existing = db.prepare(`
    SELECT p.*, pl.name as list_name
    FROM parts p
    JOIN parts_lists pl ON p.parts_list_id = pl.id
    WHERE p.parts_list_id = ? AND p.part_number = ?
  `).get(partsListId, partData.partNumber);
  
  if (existing) {
    throw new ClassroomError('DUPLICATE_PART', {
      partName: partData.partName || partData.partNumber,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toLocaleString('zh-CN')
    });
  }
  
  if (partData.quantity <= 0) {
    throw new ClassroomError('INVALID_QUANTITY', {
      partName: partData.partName || partData.partNumber,
      quantity: partData.quantity,
      expectedQuantity: '至少1'
    });
  }
  
  const result = db.prepare(`
    INSERT INTO parts (parts_list_id, part_number, part_name, quantity, required)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    partsListId,
    partData.partNumber,
    partData.partName,
    partData.quantity || 1,
    partData.required !== false ? 1 : 0
  );
  
  if (log) {
    logChange('part', result.lastInsertRowid, 'add', modifiedBy, null, JSON.stringify(partData));
    touchPartsList(partsListId, modifiedBy);
  }
  
  return result.lastInsertRowid;
}

export function addAssemblyStep(partsListId, stepData, modifiedBy, log = true) {
  const db = getDb();
  
  const result = db.prepare(`
    INSERT INTO assembly_steps (parts_list_id, step_number, step_name, description, required_parts, video_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    partsListId,
    stepData.stepNumber,
    stepData.stepName,
    stepData.description || '',
    JSON.stringify(stepData.requiredParts || []),
    stepData.videoRequired ? 1 : 0
  );
  
  if (log) {
    logChange('step', result.lastInsertRowid, 'add', modifiedBy, null, JSON.stringify(stepData));
    touchPartsList(partsListId, modifiedBy);
  }
  
  return result.lastInsertRowid;
}

export function getPartsList(name, version = null) {
  const db = getDb();
  
  let query = 'SELECT * FROM parts_lists WHERE name = ?';
  const params = [name];
  
  if (version) {
    query += ' AND version = ?';
    params.push(version);
  } else {
    query += ' AND is_active = 1 ORDER BY version DESC LIMIT 1';
  }
  
  const list = db.prepare(query).get(...params);
  if (!list) return null;
  
  const parts = db.prepare('SELECT * FROM parts WHERE parts_list_id = ?').all(list.id);
  const steps = db.prepare('SELECT * FROM assembly_steps WHERE parts_list_id = ? ORDER BY step_number').all(list.id);
  
  return {
    ...list,
    parts: parts.map(p => ({
      partNumber: p.part_number,
      partName: p.part_name,
      quantity: p.quantity,
      required: p.required === 1
    })),
    steps: steps.map(s => ({
      stepNumber: s.step_number,
      stepName: s.step_name,
      description: s.description,
      requiredParts: JSON.parse(s.required_parts || '[]'),
      videoRequired: s.video_required === 1
    }))
  };
}

export function getPartsListHistory(name) {
  const db = getDb();
  
  const lists = db.prepare(`
    SELECT * FROM parts_lists WHERE name = ? ORDER BY version DESC
  `).all(name);
  
  return lists.map(list => ({
    id: list.id,
    name: list.name,
    version: list.version,
    createdBy: list.created_by,
    createdAt: list.created_at,
    modifiedBy: list.modified_by,
    modifiedAt: list.modified_at
  }));
}

export function getChangeLog(entityType, entityId = null) {
  const db = getDb();
  
  let query = 'SELECT * FROM change_log WHERE entity_type = ?';
  const params = [entityType];
  
  if (entityId) {
    query += ' AND entity_id = ?';
    params.push(entityId);
  }
  
  query += ' ORDER BY changed_at DESC';
  
  return db.prepare(query).all(...params).map(log => ({
    id: log.id,
    entityType: log.entity_type,
    entityId: log.entity_id,
    action: log.action,
    changedBy: log.changed_by,
    oldValue: log.old_value,
    newValue: log.new_value,
    changedAt: log.changed_at
  }));
}

function touchPartsList(partsListId, modifiedBy) {
  const db = getDb();
  db.prepare(`
    UPDATE parts_lists 
    SET modified_by = ?, modified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(modifiedBy, partsListId);
}

function logChange(entityType, entityId, action, changedBy, oldValue, newValue) {
  const db = getDb();
  db.prepare(`
    INSERT INTO change_log (entity_type, entity_id, action, changed_by, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, action, changedBy, oldValue, newValue);
}

export function updatePartQuantity(partsListId, partNumber, newQuantity, modifiedBy) {
  const db = getDb();
  
  const part = db.prepare('SELECT * FROM parts WHERE parts_list_id = ? AND part_number = ?').get(partsListId, partNumber);
  if (!part) {
    throw new ClassroomError('PART_NOT_FOUND', { partName: partNumber });
  }
  
  if (newQuantity <= 0) {
    throw new ClassroomError('INVALID_QUANTITY', {
      partName: part.part_name,
      quantity: newQuantity,
      expectedQuantity: '至少1'
    });
  }
  
  const oldQuantity = part.quantity;
  
  db.prepare('UPDATE parts SET quantity = ? WHERE parts_list_id = ? AND part_number = ?')
    .run(newQuantity, partsListId, partNumber);
  
  logChange('part', part.id, 'update_quantity', modifiedBy, 
    JSON.stringify({ quantity: oldQuantity }), 
    JSON.stringify({ quantity: newQuantity }));
  
  touchPartsList(partsListId, modifiedBy);
}

export function getLastModifier(partsListName) {
  const db = getDb();
  const list = db.prepare(`
    SELECT modified_by, modified_at 
    FROM parts_lists 
    WHERE name = ? AND is_active = 1
    ORDER BY version DESC LIMIT 1
  `).get(partsListName);
  
  return list ? {
    modifiedBy: list.modified_by,
    modifiedAt: list.modified_at
  } : null;
}
