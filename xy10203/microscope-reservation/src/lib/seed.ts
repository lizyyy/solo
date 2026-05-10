import db from './db';
import { generateId, nowISO } from './utils';

const SYSTEM_USER_ID = 'system-user';

function ensureSeedData() {
  const groupCount = (db.prepare('SELECT COUNT(*) as count FROM research_groups').get() as any).count;
  if (groupCount > 0) {
    return false;
  }

  const now = nowISO();

  const groups = [
    { id: 'group-1', name: '分子生物学组', leader: '张教授' },
    { id: 'group-2', name: '细胞生物学组', leader: '李教授' },
    { id: 'group-3', name: '神经科学组', leader: '王教授' }
  ];

  const insertGroup = db.prepare(`
    INSERT INTO research_groups (id, name, leader, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const g of groups) {
    insertGroup.run(g.id, g.name, g.leader, now, now);
  }

  const users = [
    { id: 'user-1', name: '陈小明', email: 'chenxm@lab.edu', groupId: 'group-1', role: 'user' },
    { id: 'user-2', name: '刘小红', email: 'liuxh@lab.edu', groupId: 'group-1', role: 'user' },
    { id: 'user-3', name: '赵小刚', email: 'zhaoxg@lab.edu', groupId: 'group-2', role: 'user' },
    { id: 'user-4', name: '孙小丽', email: 'sunxl@lab.edu', groupId: 'group-2', role: 'user' },
    { id: 'user-5', name: '周小强', email: 'zhouxq@lab.edu', groupId: 'group-3', role: 'user' },
    { id: 'admin-1', name: '实验室管理员', email: 'admin@lab.edu', groupId: null, role: 'admin' }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, group_id, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, u.groupId, u.role, now);
  }

  const microscopes = [
    { id: 'scope-1', name: '蔡司 LSM 880 共聚焦', model: 'Zeiss LSM 880', location: 'B201室-1号台' },
    { id: 'scope-2', name: '尼康 A1R 共聚焦', model: 'Nikon A1R', location: 'B201室-2号台' },
    { id: 'scope-3', name: '奥林巴斯 FV3000', model: 'Olympus FV3000', location: 'B202室-1号台' },
    { id: 'scope-4', name: '徕卡 SP8 双光子', model: 'Leica SP8', location: 'B202室-2号台' }
  ];

  const insertMicroscope = db.prepare(`
    INSERT INTO microscopes (id, name, model, location, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  for (const m of microscopes) {
    insertMicroscope.run(m.id, m.name, m.model, m.location, now, now);
  }

  const accessories = [
    { microscopeId: 'scope-1', name: '10x 物镜', type: 'magnification' },
    { microscopeId: 'scope-1', name: '20x 物镜', type: 'magnification' },
    { microscopeId: 'scope-1', name: '40x 油镜', type: 'magnification' },
    { microscopeId: 'scope-1', name: '63x 油镜', type: 'magnification' },
    { microscopeId: 'scope-1', name: '加热样品台', type: 'sample_stage' },
    { microscopeId: 'scope-1', name: '二氧化碳培养台', type: 'sample_stage' },
    { microscopeId: 'scope-2', name: '10x 物镜', type: 'magnification' },
    { microscopeId: 'scope-2', name: '20x 水镜', type: 'magnification' },
    { microscopeId: 'scope-2', name: '40x 水镜', type: 'magnification' },
    { microscopeId: 'scope-2', name: '60x 油镜', type: 'magnification' },
    { microscopeId: 'scope-2', name: '标准样品台', type: 'sample_stage' },
    { microscopeId: 'scope-2', name: '温控样品台', type: 'sample_stage' },
    { microscopeId: 'scope-3', name: '10x 物镜', type: 'magnification' },
    { microscopeId: 'scope-3', name: '20x 物镜', type: 'magnification' },
    { microscopeId: 'scope-3', name: '40x 油镜', type: 'magnification' },
    { microscopeId: 'scope-3', name: '100x 油镜', type: 'magnification' },
    { microscopeId: 'scope-3', name: '活细胞工作站', type: 'sample_stage' },
    { microscopeId: 'scope-4', name: '10x 水镜', type: 'magnification' },
    { microscopeId: 'scope-4', name: '25x 水镜', type: 'magnification' },
    { microscopeId: 'scope-4', name: '40x 水镜', type: 'magnification' },
    { microscopeId: 'scope-4', name: '深层成像样品台', type: 'sample_stage' },
    { microscopeId: 'scope-4', name: '动物成像台', type: 'sample_stage' }
  ];

  const insertAccessory = db.prepare(`
    INSERT INTO accessories (id, microscope_id, name, type, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  for (const acc of accessories) {
    insertAccessory.run(generateId(), acc.microscopeId, acc.name, acc.type, now, now);
  }

  return true;
}

export default ensureSeedData;
