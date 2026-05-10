const { v4: uuidv4 } = require('uuid');
const { PresetStatus, SceneStatus, ApprovalStatus } = require('./types');

const database = {
  scenes: new Map(),
  presets: new Map(),
  approvals: new Map()
};

const initSampleData = () => {
  const sceneId = 'scene-001';
  database.scenes.set(sceneId, {
    id: sceneId,
    name: '《天鹅湖》第二幕 - 月夜湖畔',
    description: '女主角与白天鹅相遇的经典场景',
    status: SceneStatus.UNLOCKED,
    lockedBy: null,
    lockedAt: null,
    activePresetId: null,
    createdAt: new Date().toISOString()
  });

  const presetId1 = 'preset-001-v1';
  database.presets.set(presetId1, {
    id: presetId1,
    sceneId: sceneId,
    version: 'v1.0.0',
    name: '月夜冷色调基础版',
    description: '第一轮彩排确认版本',
    status: PresetStatus.APPROVED,
    lightPositions: {
      '主光-左': { intensity: 65, color: '#1E3A8A', pan: 0, tilt: -15 },
      '主光-右': { intensity: 65, color: '#1E3A8A', pan: 0, tilt: -15 },
      '面光-1': { intensity: 40, color: '#DBEAFE', pan: 0, tilt: 0 },
      '面光-2': { intensity: 40, color: '#DBEAFE', pan: 0, tilt: 0 },
      '追光-1': { intensity: 100, color: '#FFFFFF', pan: 0, tilt: -30 }
    },
    createdBy: '灯光师-李明',
    createdAt: '2024-05-01T10:00:00.000Z',
    approvedBy: '导演-王导',
    approvedAt: '2024-05-05T14:30:00.000Z'
  });

  const presetId2 = 'preset-001-v2';
  database.presets.set(presetId2, {
    id: presetId2,
    sceneId: sceneId,
    version: 'v2.0.0',
    name: '暖色调调整版',
    description: '导演要求增加温情氛围',
    status: PresetStatus.DRAFT,
    lightPositions: {
      '主光-左': { intensity: 70, color: '#FCD34D', pan: 0, tilt: -15 },
      '主光-右': { intensity: 70, color: '#FCD34D', pan: 0, tilt: -15 },
      '面光-1': { intensity: 50, color: '#FEF3C7', pan: 0, tilt: 0 },
      '面光-2': { intensity: 50, color: '#FEF3C7', pan: 0, tilt: 0 },
      '追光-1': { intensity: 100, color: '#FFFBEB', pan: 0, tilt: -30 }
    },
    createdBy: '灯光助理-小张',
    createdAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null
  });

  database.scenes.get(sceneId).activePresetId = presetId1;
};

const generateId = (prefix) => `${prefix}-${uuidv4().substring(0, 8)}`;

module.exports = {
  database,
  initSampleData,
  generateId
};
