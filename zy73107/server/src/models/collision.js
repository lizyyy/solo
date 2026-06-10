const { loadDB, saveDB } = require('./db');
const { v4: uuid } = require('uuid');

function generateCollisionKey(collision) {
  const parts = [
    (collision.buildingId || collision.building || '').trim().toLowerCase(),
    (collision.floor || collision.layer || '').toString().trim(),
    (collision.axisX || collision.xAxis || collision.轴号X || '').trim().toUpperCase(),
    (collision.axisY || collision.yAxis || collision.轴号Y || '').trim().toUpperCase(),
    (collision.materialId || collision.materialNo || '').trim(),
    (collision.type || collision.category || '').trim()
  ].filter(Boolean);
  return parts.join('|');
}

function getAllCollisions() {
  const db = loadDB();
  return db.collisionPoints;
}

function getCollisionById(id) {
  const db = loadDB();
  return db.collisionPoints.find(c => c.id === id) || null;
}

function findDuplicate(collisionKey, excludeId = null) {
  const db = loadDB();
  return db.collisionPoints.find(c =>
    c.collisionKey === collisionKey && c.id !== excludeId && !c.resolved
  ) || null;
}

function getCollisionsByMaterial(materialId) {
  const db = loadDB();
  return db.collisionPoints.filter(c => c.materialId === materialId);
}

function getCollisionsByMinutes(minutesId, itemId = null) {
  const db = loadDB();
  return db.collisionPoints.filter(c =>
    c.sourceMinutesId === minutesId && (!itemId || c.sourceItemId === itemId)
  );
}

function createCollision(data, operator = '系统') {
  const db = loadDB();
  const now = new Date().toISOString();

  const collisionKey = data.collisionKey || generateCollisionKey(data);

  const dup = findDuplicate(collisionKey);
  if (dup) {
    return {
      duplicated: true,
      existing: dup,
      message: `该碰撞点已存在（来源：${dup.sourceRef || '未知'}，原始说法：${dup.originalQuote || '无'}）`
    };
  }

  const collision = {
    id: uuid(),
    collisionKey,
    materialId: data.materialId || null,
    materialNo: data.materialNo || '',
    buildingId: data.buildingId || data.building || '',
    floor: data.floor || data.layer || '',
    axisX: data.axisX || data.xAxis || '',
    axisY: data.axisY || data.yAxis || '',
    type: data.type || '空间碰撞',
    severity: data.severity || 'warning',
    description: data.description || '',
    originalQuote: data.originalQuote || '',
    screenshot: data.screenshot || null,
    cameraView: data.cameraView || null,
    modelRef: data.modelRef || null,
    sourceMinutesId: data.sourceMinutesId || null,
    sourceItemId: data.sourceItemId || null,
    sourceRef: data.sourceRef || `手动录入-${now.slice(0, 10)}`,
    processingStatus: data.processingStatus || '待处理',
    resolution: data.resolution || '',
    resolved: data.resolved || false,
    resolvedAt: null,
    assignedTo: data.assignedTo || '',
    createdAt: now,
    updatedAt: now,
    createdBy: operator,
    history: [{
      action: '创建',
      operator,
      time: now,
      detail: data.originalQuote
        ? `录入碰撞点，原始会议纪要说法：${data.originalQuote.slice(0, 100)}`
        : '录入碰撞点'
    }]
  };

  db.collisionPoints.push(collision);
  saveDB(db);
  return { duplicated: false, collision };
}

function updateCollision(id, data, operator = '系统') {
  const db = loadDB();
  const idx = db.collisionPoints.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const old = db.collisionPoints[idx];
  const now = new Date().toISOString();
  const updated = { ...old, ...data, updatedAt: now };

  if (data.resolved && !old.resolved) {
    updated.resolvedAt = now;
  }

  const changes = [];
  ['processingStatus', 'severity', 'assignedTo', 'resolution', 'resolved'].forEach(f => {
    if (old[f] !== data[f] && data[f] !== undefined) {
      changes.push(`${f}: ${JSON.stringify(old[f])} → ${JSON.stringify(data[f])}`);
    }
  });
  if (changes.length > 0) {
    updated.history = [...old.history, {
      action: '更新',
      operator,
      time: now,
      detail: changes.join('; ')
    }];
  }

  if (data.collisionKey || data.materialNo || data.buildingId || data.floor) {
    const newKey = generateCollisionKey({
      buildingId: data.buildingId || old.buildingId,
      floor: data.floor || old.floor,
      axisX: data.axisX || old.axisX,
      axisY: data.axisY || old.axisY,
      materialId: data.materialId || old.materialId,
      materialNo: data.materialNo || old.materialNo,
      type: data.type || old.type
    });
    if (newKey !== old.collisionKey) {
      const dup = findDuplicate(newKey, id);
      if (dup) {
        return {
          duplicated: true,
          existing: dup,
          message: `更新后的位置与已有碰撞点重复：${dup.id}`
        };
      }
      updated.collisionKey = newKey;
    }
  }

  db.collisionPoints[idx] = updated;
  saveDB(db);
  return { duplicated: false, collision: updated };
}

function linkCollisionToMinutes(collisionId, minutesId, itemId) {
  return updateCollision(collisionId, {
    sourceMinutesId: minutesId,
    sourceItemId: itemId
  });
}

module.exports = {
  generateCollisionKey,
  getAllCollisions,
  getCollisionById,
  findDuplicate,
  getCollisionsByMaterial,
  getCollisionsByMinutes,
  createCollision,
  updateCollision,
  linkCollisionToMinutes
};
