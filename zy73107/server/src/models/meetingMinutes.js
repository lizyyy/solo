const { loadDB, saveDB } = require('./db');
const { v4: uuid } = require('uuid');

function getAllMinutes() {
  const db = loadDB();
  return db.meetingMinutes;
}

function getMinutesById(id) {
  const db = loadDB();
  return db.meetingMinutes.find(m => m.id === id) || null;
}

function getFieldMappings() {
  const db = loadDB();
  return db.fieldMappings;
}

function normalizeFields(rawRecord, fieldMappings) {
  const result = { ...rawRecord };
  const normalizedKeys = {};

  Object.keys(rawRecord).forEach(rawKey => {
    const trimmed = rawKey.trim();
    let mapped = null;
    for (const [canonical, aliases] of Object.entries(fieldMappings)) {
      const all = [canonical, ...aliases].map(a => a.trim());
      if (all.some(a => a === trimmed || a.toLowerCase() === trimmed.toLowerCase())) {
        mapped = canonical;
        break;
      }
    }
    normalizedKeys[rawKey] = mapped || trimmed;
    if (mapped && result[mapped] === undefined) {
      result[mapped] = rawRecord[rawKey];
    }
  });

  return { normalized: result, keyMap: normalizedKeys };
}

function createMeetingMinutes(data, operator = '系统') {
  const db = loadDB();
  const now = new Date().toISOString();

  const { normalized, keyMap } = normalizeFields(data.rawFields || {}, db.fieldMappings);

  const record = {
    id: uuid(),
    title: data.title || normalized.title || normalized.会议名称 || `会议纪要-${now.slice(0, 10)}`,
    meetingDate: normalized.meetingDate || normalized.会议日期 || data.meetingDate || now.slice(0, 10),
    location: data.location || normalized.location || '',
    attendees: data.attendees || normalized.attendees || [],
    source: data.source || '手动上传',
    sourceType: data.sourceType || 'manual',
    rawFields: data.rawFields || {},
    keyMap: keyMap,
    items: (data.items || normalized.items || []).map((item, idx) => {
      const norm = normalizeFields(item, db.fieldMappings);
      return {
        itemId: uuid(),
        index: idx + 1,
        materialNo: norm.normalized.materialNo || norm.normalized.材料编号 || item.materialNo || '',
        content: item.content || item.description || JSON.stringify(item).slice(0, 500),
        collisionDesc: norm.normalized.collisionDesc || norm.normalized.碰撞描述 || item.collisionDesc || '',
        owner: norm.normalized.owner || norm.normalized.负责人 || item.owner || '',
        deadline: norm.normalized.deadline || norm.normalized.截止日期 || item.deadline || '',
        status: norm.normalized.status || norm.normalized.状态 || item.status || '待处理',
        processed: false,
        linkedMaterialId: null,
        rawItem: item
      };
    }),
    createdAt: now,
    importedBy: operator
  };

  db.meetingMinutes.push(record);
  saveDB(db);
  return record;
}

function updateMinutesItem(minutesId, itemId, patch) {
  const db = loadDB();
  const mIdx = db.meetingMinutes.findIndex(m => m.id === minutesId);
  if (mIdx === -1) return null;

  const minutes = db.meetingMinutes[mIdx];
  const iIdx = minutes.items.findIndex(i => i.itemId === itemId);
  if (iIdx === -1) return null;

  minutes.items[iIdx] = { ...minutes.items[iIdx], ...patch, updatedAt: new Date().toISOString() };
  db.meetingMinutes[mIdx] = { ...minutes, updatedAt: new Date().toISOString() };
  saveDB(db);
  return minutes.items[iIdx];
}

function addFieldMapping(canonical, alias) {
  const db = loadDB();
  if (!db.fieldMappings[canonical]) {
    db.fieldMappings[canonical] = [];
  }
  if (!db.fieldMappings[canonical].includes(alias)) {
    db.fieldMappings[canonical].push(alias);
  }
  saveDB(db);
  return db.fieldMappings;
}

module.exports = {
  getAllMinutes,
  getMinutesById,
  getFieldMappings,
  normalizeFields,
  createMeetingMinutes,
  updateMinutesItem,
  addFieldMapping
};
