const { setupTestDatabase, teardownTestDatabase, getTestDb } = require('./test-helper');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let db = null;

function createAgreement({ name, year, totalAmount }) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO agreements (id, name, year, total_amount, reserved_amount, used_amount, status)
    VALUES (?, ?, ?, ?, 0, 0, 'active')
  `);
  stmt.run(id, name, year, totalAmount);
  return db.prepare('SELECT * FROM agreements WHERE id = ?').get(id);
}

function getAgreementById(id) {
  return db.prepare('SELECT * FROM agreements WHERE id = ?').get(id);
}

function getAgreementAvailable(id) {
  const agreement = getAgreementById(id);
  return agreement ? agreement.total_amount - agreement.reserved_amount - agreement.used_amount : 0;
}

function canReserveAgreement(id, amount) {
  return getAgreementAvailable(id) >= amount;
}

function createProject({ name, agreementId }) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, agreement_id, reserved_amount, used_amount, status)
    VALUES (?, ?, ?, 0, 0, 'active')
  `);
  stmt.run(id, name, agreementId);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function getProjectById(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function createAmountRecord({ agreementId, projectId, orderId, type, amount, balance, description }) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO amount_records (id, agreement_id, project_id, order_id, type, amount, balance, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, agreementId, projectId, orderId, type, amount, balance, description);
}

function reserveForProject(projectId, amount) {
  const project = getProjectById(projectId);
  if (!project) throw new Error('项目不存在');
  if (project.status !== 'active') throw new Error('项目状态无效');
  
  const agreement = getAgreementById(project.agreement_id);
  if (!agreement) throw new Error('协议不存在');
  if (agreement.status !== 'active') throw new Error('协议状态无效');
  if (amount <= 0) throw new Error('预留金额必须大于0');
  
  const transaction = db.transaction(() => {
    const currentAgreement = getAgreementById(project.agreement_id);
    const available = getAgreementAvailable(currentAgreement.id);
    
    if (available < amount) {
      throw new Error(`协议可用额度不足: 可用 ${available}, 需要 ${amount}`);
    }
    
    const newReserved = currentAgreement.reserved_amount + amount;
    db.prepare('UPDATE agreements SET reserved_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newReserved, project.agreement_id);
    
    const newProjectReserved = project.reserved_amount + amount;
    db.prepare('UPDATE projects SET reserved_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newProjectReserved, projectId);
    
    const newAvailable = available - amount;
    createAmountRecord({
      agreementId: project.agreement_id,
      projectId: projectId,
      type: 'reserve_project',
      amount: amount,
      balance: newAvailable,
      description: `项目 "${project.name}" 预留额度: ${amount}`
    });
    
    return {
      success: true,
      agreementReserved: newReserved,
      projectReserved: newProjectReserved,
      remainingAvailable: newAvailable
    };
  });
  
  return transaction();
}

beforeAll(() => {
  db = setupTestDatabase();
});

afterAll(() => {
  teardownTestDatabase();
});

beforeEach(() => {
  db.exec('DELETE FROM amount_records');
  db.exec('DELETE FROM orders');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM agreements');
});

describe('AgreementService', () => {
  describe('createAgreement', () => {
    test('应该成功创建协议并设置初始状态', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      
      expect(agreement).toBeDefined();
      expect(agreement.name).toBe('年度采购协议');
      expect(agreement.year).toBe(2026);
      expect(agreement.total_amount).toBe(1000000);
      expect(agreement.reserved_amount).toBe(0);
      expect(agreement.used_amount).toBe(0);
      expect(agreement.status).toBe('active');
    });

    test('创建协议后可用额度应等于总额度', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 500000
      });
      
      const available = getAgreementAvailable(agreement.id);
      expect(available).toBe(500000);
    });
  });

  describe('canReserve', () => {
    test('当可用额度充足时应返回 true', () => {
      const agreement = createAgreement({
        name: '测试协议',
        year: 2026,
        totalAmount: 100000
      });
      
      expect(canReserveAgreement(agreement.id, 50000)).toBe(true);
      expect(canReserveAgreement(agreement.id, 100000)).toBe(true);
    });

    test('当可用额度不足时应返回 false', () => {
      const agreement = createAgreement({
        name: '测试协议',
        year: 2026,
        totalAmount: 100000
      });
      
      expect(canReserveAgreement(agreement.id, 150000)).toBe(false);
    });

    test('当已部分占用时应正确判断', () => {
      const agreement = createAgreement({
        name: '测试协议',
        year: 2026,
        totalAmount: 100000
      });
      
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 30000);
      
      const available = getAgreementAvailable(agreement.id);
      expect(available).toBe(70000);
      expect(canReserveAgreement(agreement.id, 50000)).toBe(true);
      expect(canReserveAgreement(agreement.id, 80000)).toBe(false);
    });
  });
});
