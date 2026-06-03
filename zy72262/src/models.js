const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(filename) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function saveData(filename, data) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

class Obstacle {
  constructor(data) {
    this.id = data.id || `obs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.floor = data.floor;
    this.location = data.location;
    this.description = data.description;
    this.safetyDistance = data.safetyDistance;
    this.remark = data.remark || '';
    this.mobileScreenshot = data.mobileScreenshot || null;
    this.alarmTagBlocked = data.alarmTagBlocked || false;
    this.blockReason = data.blockReason || '';
    this.status = data.status || 'pending_review';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.floorPlanId = data.floorPlanId || null;
    this.nextAction = data.nextAction || '';
    this.missingMaterials = data.missingMaterials || [];
    this.assignedTo = data.assignedTo || '';
    this.reviewedByManager = data.reviewedByManager || false;
  }

  static getAll() {
    return loadData('obstacles.json').map(d => new Obstacle(d));
  }

  static getById(id) {
    const all = this.getAll();
    return all.find(o => o.id === id);
  }

  static create(data) {
    const obstacle = new Obstacle(data);
    const all = this.getAll();
    all.push(obstacle);
    saveData('obstacles.json', all);
    return obstacle;
  }

  static update(id, data) {
    const all = this.getAll();
    const index = all.findIndex(o => o.id === id);
    if (index === -1) return null;
    all[index] = new Obstacle({ ...all[index], ...data, updatedAt: new Date().toISOString() });
    saveData('obstacles.json', all);
    return all[index];
  }

  static delete(id) {
    const all = this.getAll();
    const filtered = all.filter(o => o.id !== id);
    saveData('obstacles.json', filtered);
    return filtered.length !== all.length;
  }
}

class FloorPlan {
  constructor(data) {
    this.id = data.id || `fp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.floor = data.floor;
    this.name = data.name;
    this.description = data.description || '';
    this.sketchData = data.sketchData || {};
    this.imageUrl = data.imageUrl || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.reviewedByTao = data.reviewedByTao || false;
  }

  static getAll() {
    return loadData('floor_plans.json').map(d => new FloorPlan(d));
  }

  static getById(id) {
    const all = this.getAll();
    return all.find(f => f.id === id);
  }

  static getByFloor(floor) {
    const all = this.getAll();
    return all.filter(f => f.floor === floor);
  }

  static create(data) {
    const floorPlan = new FloorPlan(data);
    const all = this.getAll();
    all.push(floorPlan);
    saveData('floor_plans.json', all);
    return floorPlan;
  }

  static update(id, data) {
    const all = this.getAll();
    const index = all.findIndex(f => f.id === id);
    if (index === -1) return null;
    all[index] = new FloorPlan({ ...all[index], ...data, updatedAt: new Date().toISOString() });
    saveData('floor_plans.json', all);
    return all[index];
  }
}

class SafetyReport {
  constructor(data) {
    this.id = data.id || `report_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.obstacleId = data.obstacleId;
    this.title = data.title;
    this.content = data.content;
    this.status = data.status || 'draft';
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.evidenceSummary = data.evidenceSummary || {
      obstacleRemark: '',
      floorPlanSketch: '',
      alarmTagBlocked: false
    };
  }

  static generateForObstacle(obstacle, floorPlan = null) {
    const reasons = [];
    const missingMaterials = [...(obstacle.missingMaterials || [])];
    let nextAction = obstacle.nextAction || '';
    let assignedTo = obstacle.assignedTo || '';

    if (obstacle.alarmTagBlocked) {
      reasons.push('移动端截图挡住了告警标签，需要施工经理复核');
      assignedTo = assignedTo || '施工经理';
      nextAction = nextAction || '请施工经理复核告警标签遮挡情况';
    }

    if (!obstacle.floorPlanId) {
      missingMaterials.push('楼层剖面草图');
      if (!assignedTo) assignedTo = '园区运维小陶';
      if (!nextAction) nextAction = '请园区运维小陶补录楼层剖面草图';
    }

    if (!obstacle.remark) {
      missingMaterials.push('障碍物备注说明');
      if (!assignedTo) assignedTo = '施工经理';
      if (!nextAction) nextAction = '请补充障碍物备注信息';
    }

    if (!floorPlan && obstacle.floorPlanId) {
      missingMaterials.push('楼层剖面草图数据');
    }

    const content = `
安全距离报告
============
障碍物ID: ${obstacle.id}
楼层: ${obstacle.floor}
位置: ${obstacle.location}
描述: ${obstacle.description}
安全距离要求: ${obstacle.safetyDistance}米

一、为什么被留下
${reasons.length > 0 ? reasons.join('\n') : '需要进一步核实障碍物信息'}

二、还缺什么材料
${missingMaterials.length > 0 ? missingMaterials.map(m => `- ${m}`).join('\n') : '- 暂无缺失材料'}

三、下一步该找谁
负责人: ${assignedTo}
行动: ${nextAction}

四、当前状态
${obstacle.alarmTagBlocked ? '⚠️ 告警标签被遮挡，待复核' : '✅ 告警标签可见'}
${obstacle.floorPlanId ? '✅ 已关联楼层剖面草图' : '❌ 缺少楼层剖面草图'}
${obstacle.reviewedByManager ? '✅ 施工经理已复核' : '⏳ 施工经理待复核'}

证据摘要:
- 障碍物备注: ${obstacle.remark || '(无)'}
- 楼层剖面草图: ${floorPlan ? floorPlan.name : '(未关联)'}
- 告警标签状态: ${obstacle.alarmTagBlocked ? '被遮挡' : '正常'}
    `.trim();

    return new SafetyReport({
      obstacleId: obstacle.id,
      title: `安全距离报告 - ${obstacle.floor}层 ${obstacle.location}`,
      content,
      status: obstacle.reviewedByManager ? 'final' : 'pending_review',
      evidenceSummary: {
        obstacleRemark: obstacle.remark || '',
        floorPlanSketch: floorPlan ? floorPlan.name : '',
        alarmTagBlocked: obstacle.alarmTagBlocked || false
      }
    });
  }

  static getAll() {
    return loadData('safety_reports.json').map(d => new SafetyReport(d));
  }

  static getById(id) {
    const all = this.getAll();
    return all.find(r => r.id === id);
  }

  static getByObstacle(obstacleId) {
    const all = this.getAll();
    return all.filter(r => r.obstacleId === obstacleId);
  }

  save() {
    const all = SafetyReport.getAll();
    const index = all.findIndex(r => r.id === this.id);
    if (index === -1) {
      all.push(this);
    } else {
      all[index] = this;
    }
    saveData('safety_reports.json', all);
    return this;
  }
}

module.exports = { Obstacle, FloorPlan, SafetyReport, DATA_DIR };
