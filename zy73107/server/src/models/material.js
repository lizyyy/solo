const { loadDB, saveDB } = require('./db');
const { v4: uuid } = require('uuid');

const MATERIAL_STATUS = {
  PENDING: 'pending',
  NEED_SUPPLEMENT: 'need_supplement',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVIEWING: 'reviewing'
};

const STATUS_LABEL = {
  pending: '待复核',
  need_supplement: '需补材料',
  approved: '可放行',
  rejected: '不予放行',
  reviewing: '复核中'
};

function getAllMaterials() {
  const db = loadDB();
  return db.materials;
}

function getMaterialById(id) {
  const db = loadDB();
  return db.materials.find(m => m.id === id) || null;
}

function createMaterial(data) {
  const db = loadDB();
  const now = new Date().toISOString();
  const material = {
    id: uuid(),
    materialNo: data.materialNo || '',
    name: data.name || '',
    category: data.category || '',
    quantity: data.quantity || 0,
    unit: data.unit || '',
    specification: data.specification || '',
    status: data.status || MATERIAL_STATUS.PENDING,
    source: data.source || '手动录入',
    sourceId: data.sourceId || null,
    remarks: data.remarks || '',
    reviewer: data.reviewer || '',
    reviewConclusion: data.reviewConclusion || '',
    createdAt: now,
    updatedAt: now,
    history: [{
      action: '创建',
      operator: data.reviewer || '系统',
      time: now,
      detail: `创建材料记录：${data.name || data.materialNo || '未命名'}`
    }]
  };
  db.materials.push(material);
  saveDB(db);
  return material;
}

function updateMaterial(id, data, operator = '系统') {
  const db = loadDB();
  const idx = db.materials.findIndex(m => m.id === id);
  if (idx === -1) return null;

  const old = db.materials[idx];
  const now = new Date().toISOString();
  const updated = { ...old, ...data, updatedAt: now };

  const changes = [];
  ['status', 'name', 'materialNo', 'reviewConclusion', 'remarks', 'reviewer'].forEach(f => {
    if (old[f] !== data[f] && data[f] !== undefined) {
      const label = FIELD_LABELS[f] || f;
      changes.push(`${label}: ${old[f] || '(空)'} → ${data[f] || '(空)'}`);
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

  db.materials[idx] = updated;
  saveDB(db);
  return updated;
}

const FIELD_LABELS = {
  status: '状态',
  name: '名称',
  materialNo: '材料编号',
  reviewConclusion: '复核结论',
  remarks: '备注',
  reviewer: '复核人'
};

function getStatusLabel(s) {
  return STATUS_LABEL[s] || s;
}

module.exports = {
  MATERIAL_STATUS,
  STATUS_LABEL,
  FIELD_LABELS,
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  getStatusLabel
};
