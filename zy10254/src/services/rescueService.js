const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

const STATUS = {
  CREATED: 'CREATED',
  MATCHED: 'MATCHED',
  DEPARTED: 'DEPARTED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED'
};

const BREAKDOWN_COST = {
  tire: 150,
  fuel: 100,
  battery: 80,
  tow: 300,
  lock: 120
};

const REPEAT_WINDOW = 30 * 60;

function logStatusChange(orderId, fromStatus, toStatus, operatorId = null, remark = null) {
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO order_status_logs (logId, orderId, fromStatus, toStatus, operatorId, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(logId, orderId, fromStatus, toStatus, operatorId, remark);
}

function checkRepeatReport(vehiclePlate) {
  const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - REPEAT_WINDOW;
  
  const existingOrder = db.prepare(`
    SELECT orderId, status, createdAt
    FROM rescue_orders
    WHERE vehiclePlate = ?
      AND status NOT IN ('COMPLETED', 'SETTLED', 'CANCELLED')
      AND createdAt > ?
    ORDER BY createdAt DESC
    LIMIT 1
  `).get(vehiclePlate, thirtyMinutesAgo);

  return existingOrder;
}

function checkMembership(membershipId) {
  if (!membershipId) return { valid: true, message: '无会员权益' };
  
  const membership = db.prepare(`
    SELECT * FROM memberships WHERE membershipId = ?
  `).get(membershipId);

  if (!membership) {
    return { valid: false, message: '会员不存在' };
  }

  if (!membership.isActive) {
    return { valid: false, message: '会员已失效' };
  }

  const today = new Date().toISOString().split('T')[0];
  if (membership.expireDate < today) {
    return { valid: false, message: '会员权益已过期' };
  }

  if (membership.remainingTimes <= 0) {
    return { valid: false, message: '会员剩余次数不足' };
  }

  return { valid: true, membership };
}

function createRescueOrder(data) {
  const {
    vehiclePlate,
    vehicleModel,
    ownerName,
    ownerPhone,
    location,
    breakdownType,
    description,
    membershipId
  } = data;

  if (!vehiclePlate || !ownerName || !ownerPhone || !location || !breakdownType) {
    throw new Error('缺少必填参数');
  }

  const membershipCheck = checkMembership(membershipId);
  if (!membershipCheck.valid) {
    throw new Error(membershipCheck.message);
  }

  const existingOrder = checkRepeatReport(vehiclePlate);
  if (existingOrder) {
    const repeatOrderId = uuidv4();
    db.prepare(`
      INSERT INTO rescue_orders (
        orderId, vehiclePlate, vehicleModel, ownerName, ownerPhone,
        location, breakdownType, description, membershipId, status,
        isRepeat, originalOrderId, estimatedCost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      repeatOrderId, vehiclePlate, vehicleModel, ownerName, ownerPhone,
      location, breakdownType, description, membershipId, STATUS.CREATED,
      existingOrder.orderId, BREAKDOWN_COST[breakdownType] || 100
    );

    logStatusChange(repeatOrderId, null, STATUS.CREATED, null, '重复报案，已关联原工单');

    return {
      orderId: repeatOrderId,
      isRepeat: true,
      originalOrderId: existingOrder.orderId,
      message: '检测到重复报案，已关联到原有工单'
    };
  }

  const orderId = uuidv4();
  const estimatedCost = BREAKDOWN_COST[breakdownType] || 100;

  db.prepare(`
    INSERT INTO rescue_orders (
      orderId, vehiclePlate, vehicleModel, ownerName, ownerPhone,
      location, breakdownType, description, membershipId, status, estimatedCost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId, vehiclePlate, vehicleModel, ownerName, ownerPhone,
    location, breakdownType, description, membershipId, STATUS.CREATED, estimatedCost
  );

  logStatusChange(orderId, null, STATUS.CREATED);

  return {
    orderId,
    isRepeat: false,
    estimatedCost,
    status: STATUS.CREATED
  };
}

function matchTechnician(orderId, excludeTechnicianId = null) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消，无法匹配技师');
  }

  if (order.status !== STATUS.CREATED) {
    throw new Error('当前工单状态不允许匹配技师');
  }

  const skills = [order.breakdownType];
  
  let sql = `
    SELECT * FROM technicians
    WHERE status = 'available'
      AND currentOrderId IS NULL
  `;
  const params = [];
  
  if (excludeTechnicianId) {
    sql += ` AND technicianId != ?`;
    params.push(excludeTechnicianId);
  }
  
  sql += ` ORDER BY rating DESC LIMIT 5`;
  
  const availableTechnicians = db.prepare(sql).all(...params);

  const qualifiedTechnicians = availableTechnicians.filter(tech => {
    const techSkills = JSON.parse(tech.skills);
    return skills.some(skill => techSkills.includes(skill));
  });

  if (qualifiedTechnicians.length === 0) {
    throw new Error('暂无可用技师');
  }

  const selectedTech = qualifiedTechnicians[0];

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, technicianId = ?, matchedAt = ?
    WHERE orderId = ?
  `).run(STATUS.MATCHED, selectedTech.technicianId, Math.floor(Date.now() / 1000), orderId);

  db.prepare(`
    UPDATE technicians
    SET status = 'busy', currentOrderId = ?
    WHERE technicianId = ?
  `).run(orderId, selectedTech.technicianId);

  let preDeductInfo = null;
  if (order.membershipId) {
    const membership = db.prepare('SELECT * FROM memberships WHERE membershipId = ?').get(order.membershipId);
    if (membership && membership.isActive && membership.remainingTimes > 0) {
      db.prepare(`
        UPDATE memberships
        SET remainingTimes = remainingTimes - 1
        WHERE membershipId = ?
      `).run(order.membershipId);

      const recordId = uuidv4();
      db.prepare(`
        INSERT INTO fee_records (recordId, orderId, membershipId, type, amount, timesUsed, description)
        VALUES (?, ?, ?, 'pre_deduct', ?, 1, '匹配技师-权益预扣')
      `).run(recordId, orderId, order.membershipId, order.estimatedCost);

      preDeductInfo = {
        usedMembership: true,
        timesUsed: 1,
        remainingTimes: membership.remainingTimes - 1
      };
    }
  }

  logStatusChange(orderId, STATUS.CREATED, STATUS.MATCHED);

  return {
    orderId,
    technician: {
      technicianId: selectedTech.technicianId,
      name: selectedTech.name,
      phone: selectedTech.phone,
      rating: selectedTech.rating
    },
    status: STATUS.MATCHED,
    preDeductInfo
  };
}

function technicianDepart(orderId, technicianId) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消');
  }

  if (order.status !== STATUS.MATCHED) {
    throw new Error('当前工单状态不允许确认出发');
  }

  if (order.technicianId !== technicianId) {
    throw new Error('该技师不是此工单的指派技师');
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, departedAt = ?
    WHERE orderId = ?
  `).run(STATUS.DEPARTED, Math.floor(Date.now() / 1000), orderId);

  logStatusChange(orderId, STATUS.MATCHED, STATUS.DEPARTED, technicianId);

  return {
    orderId,
    status: STATUS.DEPARTED,
    departedAt: new Date()
  };
}

function technicianArrive(orderId, technicianId) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消');
  }

  if (order.status !== STATUS.DEPARTED) {
    throw new Error('当前工单状态不允许确认到达');
  }

  if (order.technicianId !== technicianId) {
    throw new Error('该技师不是此工单的指派技师');
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, arrivedAt = ?
    WHERE orderId = ?
  `).run(STATUS.ARRIVED, Math.floor(Date.now() / 1000), orderId);

  logStatusChange(orderId, STATUS.DEPARTED, STATUS.ARRIVED, technicianId);

  return {
    orderId,
    status: STATUS.ARRIVED,
    arrivedAt: new Date()
  };
}

function completeRescue(orderId, technicianId, actualCost, remark = '') {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消');
  }

  if (order.status !== STATUS.ARRIVED) {
    throw new Error('当前工单状态不允许完成');
  }

  if (order.technicianId !== technicianId) {
    throw new Error('该技师不是此工单的指派技师');
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, completedAt = ?, actualCost = ?, remark = ?
    WHERE orderId = ?
  `).run(STATUS.COMPLETED, Math.floor(Date.now() / 1000), actualCost, remark, orderId);

  db.prepare(`
    UPDATE technicians
    SET status = 'available', currentOrderId = NULL
    WHERE technicianId = ?
  `).run(technicianId);

  logStatusChange(orderId, STATUS.ARRIVED, STATUS.COMPLETED, technicianId, remark);

  let settlement = null;
  if (order.membershipId) {
    const membership = db.prepare('SELECT * FROM memberships WHERE membershipId = ?').get(order.membershipId);
    
    db.prepare(`
      UPDATE fee_records
      SET type = 'deduct', amount = ?, description = '救援服务费用结算'
      WHERE orderId = ? AND type = 'pre_deduct'
    `).run(actualCost, orderId);

    settlement = {
      usedMembership: true,
      timesUsed: 1,
      remainingTimes: membership.remainingTimes,
      cost: actualCost,
      note: '已从预扣转为正式结算'
    };
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?
    WHERE orderId = ?
  `).run(STATUS.SETTLED, orderId);

  logStatusChange(orderId, STATUS.COMPLETED, STATUS.SETTLED);

  return {
    orderId,
    status: STATUS.SETTLED,
    completedAt: new Date(),
    actualCost,
    settlement
  };
}

module.exports = {
  STATUS,
  createRescueOrder,
  matchTechnician,
  technicianDepart,
  technicianArrive,
  completeRescue,
  checkRepeatReport,
  checkMembership
};