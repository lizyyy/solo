const { setupTestDatabase, teardownTestDatabase } = require('./test-helper');

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

function getAmountRecordsByAgreement(agreementId) {
  return db.prepare('SELECT * FROM amount_records WHERE agreement_id = ? ORDER BY created_at DESC').all(agreementId);
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
    const available = currentAgreement.total_amount - currentAgreement.reserved_amount - currentAgreement.used_amount;
    
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

function createOrder({ projectId, amount, description }) {
  const project = getProjectById(projectId);
  if (!project) throw new Error('项目不存在');
  if (project.status !== 'active') throw new Error('项目状态无效');
  
  const agreement = getAgreementById(project.agreement_id);
  if (!agreement) throw new Error('协议不存在');
  if (agreement.status !== 'active') throw new Error('协议状态无效');
  if (amount <= 0) throw new Error('订单金额必须大于0');
  
  const transaction = db.transaction(() => {
    const currentProject = getProjectById(projectId);
    const projectAvailable = currentProject.reserved_amount - currentProject.used_amount;
    
    if (projectAvailable < amount) {
      throw new Error(`项目可用额度不足: 可用 ${projectAvailable}, 需要 ${amount}`);
    }
    
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (id, project_id, agreement_id, amount, status, description)
      VALUES (?, ?, ?, ?, 'reserved', ?)
    `).run(orderId, projectId, project.agreement_id, amount, description);
    
    db.prepare('UPDATE projects SET reserved_amount = ?, used_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(
        currentProject.reserved_amount - amount,
        currentProject.used_amount + amount,
        projectId
      );
    
    const currentAgreement = getAgreementById(project.agreement_id);
    db.prepare('UPDATE agreements SET reserved_amount = ?, used_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(
        currentAgreement.reserved_amount - amount,
        currentAgreement.used_amount + amount,
        project.agreement_id
      );
    
    const remainingAvailable = currentAgreement.total_amount - 
      (currentAgreement.reserved_amount - amount) - 
      (currentAgreement.used_amount + amount);
    
    createAmountRecord({
      agreementId: project.agreement_id,
      projectId: projectId,
      orderId: orderId,
      type: 'order_reserve',
      amount: amount,
      balance: remainingAvailable,
      description: `订单占用: ${description || '未命名订单'}, 金额: ${amount}`
    });
    
    return {
      id: orderId,
      project_id: projectId,
      agreement_id: project.agreement_id,
      amount: amount,
      status: 'reserved',
      description: description,
      projectRemaining: currentProject.reserved_amount - currentProject.used_amount - amount,
      agreementRemaining: remainingAvailable
    };
  });
  
  return transaction();
}

function getOrderById(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function releaseOrder(orderId) {
  const order = getOrderById(orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'reserved') throw new Error('只有预留状态的订单可以释放');
  
  const transaction = db.transaction(() => {
    const currentOrder = getOrderById(orderId);
    if (currentOrder.status !== 'reserved') {
      throw new Error('订单状态已变更，无法释放');
    }
    
    const project = getProjectById(currentOrder.project_id);
    db.prepare('UPDATE projects SET reserved_amount = ?, used_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(
        project.reserved_amount + currentOrder.amount,
        project.used_amount - currentOrder.amount,
        currentOrder.project_id
      );
    
    const agreement = getAgreementById(currentOrder.agreement_id);
    db.prepare('UPDATE agreements SET reserved_amount = ?, used_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(
        agreement.reserved_amount + currentOrder.amount,
        agreement.used_amount - currentOrder.amount,
        currentOrder.agreement_id
      );
    
    db.prepare('UPDATE orders SET status = ?, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('released', orderId);
    
    const remainingAvailable = agreement.total_amount - 
      (agreement.reserved_amount + currentOrder.amount) - 
      (agreement.used_amount - currentOrder.amount);
    
    createAmountRecord({
      agreementId: currentOrder.agreement_id,
      projectId: currentOrder.project_id,
      orderId: orderId,
      type: 'order_release',
      amount: currentOrder.amount,
      balance: remainingAvailable,
      description: `订单释放: 金额 ${currentOrder.amount}`
    });
    
    return {
      success: true,
      orderId: orderId,
      releasedAmount: currentOrder.amount
    };
  });
  
  return transaction();
}

function confirmOrder(orderId) {
  const order = getOrderById(orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'reserved') throw new Error('只有预留状态的订单可以确认');
  
  const transaction = db.transaction(() => {
    const currentOrder = getOrderById(orderId);
    if (currentOrder.status !== 'reserved') {
      throw new Error('订单状态已变更，无法确认');
    }
    
    db.prepare('UPDATE orders SET status = ?, confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('confirmed', orderId);
    
    const agreement = getAgreementById(currentOrder.agreement_id);
    const available = agreement.total_amount - agreement.reserved_amount - agreement.used_amount;
    
    createAmountRecord({
      agreementId: currentOrder.agreement_id,
      projectId: currentOrder.project_id,
      orderId: orderId,
      type: 'order_confirm',
      amount: 0,
      balance: available,
      description: `订单确认: ${currentOrder.description || '未命名订单'}`
    });
    
    return {
      success: true,
      orderId: orderId,
      confirmedAmount: currentOrder.amount
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

describe('OrderService - 核心业务逻辑', () => {
  describe('reserveForProject - 项目预留', () => {
    test('应该成功从协议预留额度到项目', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      
      const result = reserveForProject(project.id, 200000);
      
      expect(result.success).toBe(true);
      expect(result.agreementReserved).toBe(200000);
      expect(result.projectReserved).toBe(200000);
      expect(result.remainingAvailable).toBe(800000);
      
      const updatedAgreement = getAgreementById(agreement.id);
      expect(updatedAgreement.reserved_amount).toBe(200000);
      expect(updatedAgreement.used_amount).toBe(0);
      
      const updatedProject = getProjectById(project.id);
      expect(updatedProject.reserved_amount).toBe(200000);
      expect(updatedProject.used_amount).toBe(0);
    });

    test('当协议额度不足时应该抛出错误', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 100000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      
      expect(() => reserveForProject(project.id, 150000)).toThrow('协议可用额度不足');
    });

    test('多个项目预留应该不会互相干扰', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const projectA = createProject({ name: '项目A', agreementId: agreement.id });
      const projectB = createProject({ name: '项目B', agreementId: agreement.id });
      
      reserveForProject(projectA.id, 300000);
      reserveForProject(projectB.id, 400000);
      
      const updatedA = getProjectById(projectA.id);
      const updatedB = getProjectById(projectB.id);
      const updatedAgreement = getAgreementById(agreement.id);
      
      expect(updatedA.reserved_amount).toBe(300000);
      expect(updatedB.reserved_amount).toBe(400000);
      expect(updatedAgreement.reserved_amount).toBe(700000);
      expect(updatedAgreement.used_amount).toBe(0);
    });
  });

  describe('createOrder - 下单锁定', () => {
    test('应该成功创建订单并锁定额度', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '采购订单1'
      });
      
      expect(order.status).toBe('reserved');
      expect(order.amount).toBe(100000);
      
      const updatedProject = getProjectById(project.id);
      expect(updatedProject.reserved_amount).toBe(200000);
      expect(updatedProject.used_amount).toBe(100000);
      
      const updatedAgreement = getAgreementById(agreement.id);
      expect(updatedAgreement.reserved_amount).toBe(200000);
      expect(updatedAgreement.used_amount).toBe(100000);
    });

    test('当项目额度不足时应该抛出错误', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 100000);
      
      expect(() => createOrder({
        projectId: project.id,
        amount: 200000,
        description: '超额度订单'
      })).toThrow('项目可用额度不足');
    });

    test('应正确记录额度变更历史', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      
      const records = getAmountRecordsByAgreement(agreement.id);
      expect(records.length).toBeGreaterThanOrEqual(2);
      
      const reserveRecord = records.find(r => r.type === 'reserve_project');
      const orderRecord = records.find(r => r.type === 'order_reserve');
      
      expect(reserveRecord).toBeDefined();
      expect(reserveRecord.amount).toBe(300000);
      
      expect(orderRecord).toBeDefined();
      expect(orderRecord.amount).toBe(100000);
      expect(orderRecord.order_id).toBe(order.id);
    });
  });

  describe('releaseOrder - 释放补偿', () => {
    test('应该成功释放订单并返还额度', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '待释放订单'
      });
      
      const releaseResult = releaseOrder(order.id);
      
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.releasedAmount).toBe(100000);
      
      const updatedOrder = getOrderById(order.id);
      expect(updatedOrder.status).toBe('released');
      
      const updatedProject = getProjectById(project.id);
      expect(updatedProject.reserved_amount).toBe(300000);
      expect(updatedProject.used_amount).toBe(0);
      
      const updatedAgreement = getAgreementById(agreement.id);
      expect(updatedAgreement.reserved_amount).toBe(300000);
      expect(updatedAgreement.used_amount).toBe(0);
    });

    test('释放后应该正确记录变更历史', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      releaseOrder(order.id);
      
      const records = getAmountRecordsByAgreement(agreement.id);
      const releaseRecord = records.find(r => r.type === 'order_release');
      
      expect(releaseRecord).toBeDefined();
      expect(releaseRecord.amount).toBe(100000);
      expect(releaseRecord.order_id).toBe(order.id);
    });

    test('不能重复释放同一个订单', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      
      releaseOrder(order.id);
      
      expect(() => releaseOrder(order.id)).toThrow('只有预留状态的订单可以释放');
    });
  });

  describe('confirmOrder - 订单确认', () => {
    test('应该成功确认订单', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      
      const confirmResult = confirmOrder(order.id);
      
      expect(confirmResult.success).toBe(true);
      expect(confirmResult.confirmedAmount).toBe(100000);
      
      const updatedOrder = getOrderById(order.id);
      expect(updatedOrder.status).toBe('confirmed');
    });

    test('确认后不能再释放订单', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      
      confirmOrder(order.id);
      
      expect(() => releaseOrder(order.id)).toThrow('只有预留状态的订单可以释放');
    });

    test('确认后额度应保持已使用状态', () => {
      const agreement = createAgreement({
        name: '年度采购协议',
        year: 2026,
        totalAmount: 1000000
      });
      const project = createProject({ name: '项目A', agreementId: agreement.id });
      reserveForProject(project.id, 300000);
      const order = createOrder({
        projectId: project.id,
        amount: 100000,
        description: '测试订单'
      });
      
      const beforeProject = getProjectById(project.id);
      const beforeAgreement = getAgreementById(agreement.id);
      
      confirmOrder(order.id);
      
      const afterProject = getProjectById(project.id);
      const afterAgreement = getAgreementById(agreement.id);
      
      expect(afterProject.used_amount).toBe(beforeProject.used_amount);
      expect(afterAgreement.used_amount).toBe(beforeAgreement.used_amount);
    });
  });
});
