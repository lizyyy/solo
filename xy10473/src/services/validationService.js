const { queryOne, query, toBoolean } = require('../database');

function isWarrantyValid(productSN) {
  const warranty = queryOne(
    'SELECT * FROM warranties WHERE product_sn = ? AND status = ?',
    [productSN, 'active']
  );

  if (!warranty) {
    return { valid: false, reason: '未找到产品保修记录' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expireDate = new Date(warranty.warranty_expire_date);
  expireDate.setHours(0, 0, 0, 0);

  if (expireDate < today) {
    return { valid: false, reason: '产品保修已过期', warranty };
  }

  return { valid: true, warranty };
}

function isDuplicateFaultApplication(productSN, faultType, days = 30) {
  const applications = query(
    `SELECT * FROM part_applications 
     WHERE product_sn = ? AND fault_type = ? AND status != 'rejected'
     AND created_at >= datetime('now', '-' || ? || ' days')`,
    [productSN, faultType, days]
  );

  if (applications.length > 0) {
    return { 
      duplicate: true, 
      reason: `该故障类型在${days}天内已有申请记录`,
      existingApplications: applications 
    };
  }

  return { duplicate: false };
}

function hasEnoughInventory(partId, quantity = 1) {
  const inventory = queryOne(
    `SELECT i.*, p.part_name, p.part_code
     FROM inventory i
     JOIN parts p ON i.part_id = p.id
     WHERE i.part_id = ?`,
    [partId]
  );

  if (!inventory) {
    return { available: false, reason: '未找到配件库存信息' };
  }

  const availableQuantity = inventory.quantity - inventory.locked_quantity;

  if (availableQuantity < quantity) {
    return { 
      available: false, 
      reason: `库存不足，当前可用: ${availableQuantity}，需要: ${quantity}`,
      currentInventory: inventory
    };
  }

  return { available: true, inventory, availableQuantity };
}

function canCloseApplication(application) {
  if (application.status === 'closed') {
    return { canClose: true };
  }

  if (toBoolean(application.requires_recycling) && application.status !== 'old_part_received') {
    return { 
      canClose: false, 
      reason: '需回收旧件，旧件未回收前不能关闭申请' 
    };
  }

  const validStatusesForClose = ['delivered', 'old_part_received', 'rejected', 'cancelled'];
  if (!validStatusesForClose.includes(application.status)) {
    return { 
      canClose: false, 
      reason: `当前状态(${application.status})不允许关闭申请` 
    };
  }

  return { canClose: true };
}

function canModifyShippingAddress(application) {
  if (toBoolean(application.shipping_address_modified)) {
    return { 
      canModify: false, 
      reason: '物流签收后不允许再次修改收货地址' 
    };
  }

  const validStatuses = ['pending_review', 'approved', 'inventory_locked', 'shipped'];
  if (!validStatuses.includes(application.status)) {
    return { 
      canModify: false, 
      reason: `当前状态(${application.status})不允许修改收货地址` 
    };
  }

  return { canModify: true };
}

function validateApplicationCreate(data) {
  const errors = [];

  if (!data.product_sn) {
    errors.push('产品序列号不能为空');
  }
  if (!data.part_code) {
    errors.push('配件编码不能为空');
  }
  if (!data.fault_type) {
    errors.push('故障类型不能为空');
  }
  if (!data.reason) {
    errors.push('申请原因不能为空');
  }
  if (!data.customer_name) {
    errors.push('客户姓名不能为空');
  }
  if (!data.customer_phone) {
    errors.push('客户电话不能为空');
  }
  if (!data.shipping_address) {
    errors.push('收货地址不能为空');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  isWarrantyValid,
  isDuplicateFaultApplication,
  hasEnoughInventory,
  canCloseApplication,
  canModifyShippingAddress,
  validateApplicationCreate
};
