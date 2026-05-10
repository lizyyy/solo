const { getDatabase } = require('../database/init');
const { generateId } = require('../utils/idGenerator');
const { ORDER_STATUS, MODULES, DAMAGE_DEGREE } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');
const { getOrderById } = require('./orderService');

function validateChecklistData(data) {
  const errors = [];
  if (!data.order_id) errors.push('order_id不能为空');
  if (!data.item_name) errors.push('item_name不能为空');
  if (data.expected_quantity === undefined || data.expected_quantity < 0) {
    errors.push('expected_quantity不能为空且不能为负数');
  }
  return errors;
}

function createChecklistFromTemplate(orderId, venueId, operator) {
  const db = getDatabase();
  const templates = db.prepare(`
    SELECT * FROM checklist_templates 
    WHERE venue_id = ? AND is_active = 1
  `).all(venueId);

  const checklistItems = [];
  for (const template of templates) {
    const item = createChecklistItem({
      order_id: orderId,
      template_item_id: template.id,
      item_name: template.item_name,
      item_category: template.item_category,
      expected_quantity: template.default_quantity,
      unit_price: template.unit_price
    }, operator);
    checklistItems.push(item);
  }

  return checklistItems;
}

function createChecklistItem(data, operator) {
  const db = getDatabase();
  const errors = validateChecklistData(data);

  if (errors.length > 0) {
    throw new Error('验收清单数据校验失败: ' + errors.join(', '));
  }

  const order = getOrderById(data.order_id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (![ORDER_STATUS.CHECKING, ORDER_STATUS.IN_USE].includes(order.status)) {
    throw new Error('当前订单状态不允许添加验收项');
  }

  const itemId = generateId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO checklists (
      id, order_id, template_item_id, item_name, item_category,
      expected_quantity, actual_quantity, is_damaged, damage_degree,
      damage_photo_urls, unit_price, checked_by, checked_at, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    itemId,
    data.order_id,
    data.template_item_id || null,
    data.item_name,
    data.item_category || null,
    data.expected_quantity,
    data.actual_quantity || null,
    data.is_damaged ? 1 : 0,
    data.damage_degree || null,
    data.damage_photo_urls ? JSON.stringify(data.damage_photo_urls) : null,
    data.unit_price || null,
    null,
    null,
    data.remark || null
  );

  logAudit('CREATE', MODULES.CHECKLIST, operator, {
    targetId: itemId,
    targetType: 'checklist',
    newValues: data
  });

  return getChecklistItemById(itemId);
}

function getChecklistItemById(itemId) {
  const db = getDatabase();
  const item = db.prepare(`
    SELECT * FROM checklists WHERE id = ?
  `).get(itemId);

  if (item && item.damage_photo_urls) {
    try {
      item.damage_photo_urls = JSON.parse(item.damage_photo_urls);
    } catch (e) {
      item.damage_photo_urls = [];
    }
  }

  return item;
}

function getChecklistsByOrderId(orderId) {
  const db = getDatabase();
  const items = db.prepare(`
    SELECT * FROM checklists 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  return items.map(item => {
    if (item.damage_photo_urls) {
      try {
        item.damage_photo_urls = JSON.parse(item.damage_photo_urls);
      } catch (e) {
        item.damage_photo_urls = [];
      }
    }
    return item;
  });
}

function updateChecklistItem(itemId, data, operator) {
  const db = getDatabase();
  const item = getChecklistItemById(itemId);

  if (!item) {
    throw new Error('验收项不存在');
  }

  const order = getOrderById(item.order_id);
  if (order && order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('订单已完成，不允许修改验收项');
  }

  const allowedUpdates = [
    'actual_quantity', 'is_damaged', 'damage_degree', 
    'damage_photo_urls', 'unit_price', 'remark'
  ];

  const updateFields = [];
  const updateValues = [];
  const oldValues = {};
  const newValues = {};

  for (const key of allowedUpdates) {
    if (data[key] !== undefined) {
      const value = key === 'damage_photo_urls' 
        ? JSON.stringify(data[key]) 
        : (key === 'is_damaged' ? (data[key] ? 1 : 0) : data[key]);
      
      updateFields.push(`${key} = ?`);
      updateValues.push(value);
      oldValues[key] = item[key];
      newValues[key] = data[key];
    }
  }

  if (updateFields.length === 0) {
    return item;
  }

  updateValues.push(itemId);

  db.prepare(`
    UPDATE checklists 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `).run(...updateValues);

  logAudit('UPDATE', MODULES.CHECKLIST, operator, {
    targetId: itemId,
    targetType: 'checklist',
    oldValues,
    newValues
  });

  return getChecklistItemById(itemId);
}

function markAsChecked(itemId, operator) {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE checklists 
    SET checked_by = ?, checked_at = ?
    WHERE id = ?
  `).run(operator, now, itemId);

  logAudit('CHECK', MODULES.CHECKLIST, operator, {
    targetId: itemId,
    targetType: 'checklist',
    remark: '标记为已检查'
  });

  return getChecklistItemById(itemId);
}

function deleteChecklistItem(itemId, operator) {
  const db = getDatabase();
  const item = getChecklistItemById(itemId);

  if (!item) {
    throw new Error('验收项不存在');
  }

  const order = getOrderById(item.order_id);
  if (order && order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('订单已完成，不允许删除验收项');
  }

  db.prepare(`DELETE FROM checklists WHERE id = ?`).run(itemId);

  logAudit('DELETE', MODULES.CHECKLIST, operator, {
    targetId: itemId,
    targetType: 'checklist',
    oldValues: item
  });

  return true;
}

function getChecklistSummary(orderId) {
  const items = getChecklistsByOrderId(orderId);
  
  const totalItems = items.length;
  const checkedItems = items.filter(i => i.checked_at).length;
  const damagedItems = items.filter(i => i.is_damaged).length;
  const missingItems = items.filter(i => 
    i.actual_quantity !== null && i.actual_quantity < i.expected_quantity
  ).length;

  return {
    total: totalItems,
    checked: checkedItems,
    unchecked: totalItems - checkedItems,
    damaged: damagedItems,
    missing: missingItems,
    isComplete: totalItems > 0 && totalItems === checkedItems
  };
}

module.exports = {
  validateChecklistData,
  createChecklistFromTemplate,
  createChecklistItem,
  getChecklistItemById,
  getChecklistsByOrderId,
  updateChecklistItem,
  markAsChecked,
  deleteChecklistItem,
  getChecklistSummary
};
