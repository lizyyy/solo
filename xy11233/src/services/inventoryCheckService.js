const {
  InventoryCheck,
  InventoryCheckItem,
  Inventory,
  Reagent
} = require('../models');
const { createAuditLog } = require('../middleware/audit');

function generateOrderNo(prefix) {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
}

class InventoryCheckService {
  async createCheck(data, operator) {
    const { check_type, title, checker_id, checker_name, supervisor_id, supervisor_name, inventory_ids } = data;

    const check_no = generateOrderNo('IC');

    const check = await InventoryCheck.create({
      check_no,
      check_type,
      title,
      checker_id,
      checker_name,
      supervisor_id,
      supervisor_name,
      status: InventoryCheck.CHECK_STATUSES.PENDING,
      total_items: 0
    });

    let inventories;
    if (inventory_ids && inventory_ids.length > 0) {
      inventories = await Inventory.findAll({
        where: { id: inventory_ids },
        include: [{ model: Reagent }]
      });
    } else {
      inventories = await Inventory.findAll({
        include: [{ model: Reagent }]
      });
    }

    const checkItems = inventories.map(inv => ({
      check_id: check.id,
      inventory_id: inv.id,
      reagent_id: inv.reagent_id,
      reagent_name: inv.Reagent?.name || '未知',
      batch_no: inv.batch_no,
      expected_quantity: inv.quantity,
      actual_quantity: null,
      unit: inv.Reagent?.unit || 'unit',
      difference: null,
      is_matched: false,
      location: inv.location
    }));

    await InventoryCheckItem.bulkCreate(checkItems);

    await check.update({ total_items: checkItems.length });

    await createAuditLog({
      action: 'create',
      module: 'inventory_check',
      recordId: check.id,
      recordNo: check_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `创建盘点单 ${check_no}`
    });

    return check;
  }

  async startCheck(id, operator) {
    const check = await InventoryCheck.findByPk(id);
    if (!check) {
      throw new Error('盘点单不存在');
    }

    if (check.status !== InventoryCheck.CHECK_STATUSES.PENDING) {
      throw new Error('只有待盘点状态的盘点单可以开始');
    }

    await check.update({
      status: InventoryCheck.CHECK_STATUSES.IN_PROGRESS,
      start_time: new Date()
    });

    await createAuditLog({
      action: 'check_inventory',
      module: 'inventory_check',
      recordId: check.id,
      recordNo: check.check_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `开始盘点 ${check.check_no}`
    });

    return check;
  }

  async updateCheckItem(data, operator) {
    const { check_id, item_id, actual_quantity, reason, remark } = data;

    const check = await InventoryCheck.findByPk(check_id);
    if (!check) {
      throw new Error('盘点单不存在');
    }

    if (check.status !== InventoryCheck.CHECK_STATUSES.IN_PROGRESS) {
      throw new Error('只有进行中的盘点单可以修改');
    }

    const item = await InventoryCheckItem.findByPk(item_id);
    if (!item) {
      throw new Error('盘点项不存在');
    }

    const difference = actual_quantity - item.expected_quantity;
    const is_matched = Math.abs(difference) < 0.001;

    await item.update({
      actual_quantity,
      difference,
      is_matched,
      reason,
      remark
    });

    return item;
  }

  async completeCheck(id, operator) {
    const check = await InventoryCheck.findByPk(id, {
      include: [{ model: InventoryCheckItem, as: 'items' }]
    });

    if (!check) {
      throw new Error('盘点单不存在');
    }

    if (check.status !== InventoryCheck.CHECK_STATUSES.IN_PROGRESS) {
      throw new Error('只有进行中的盘点单可以完成');
    }

    const matched = check.items.filter(i => i.is_matched).length;
    const mismatched = check.items.length - matched;

    await check.update({
      status: InventoryCheck.CHECK_STATUSES.COMPLETED,
      end_time: new Date(),
      matched_items: matched,
      mismatched_items: mismatched
    });

    for (const item of check.items) {
      if (!item.is_matched && item.actual_quantity !== null) {
        const inventory = await Inventory.findByPk(item.inventory_id);
        if (inventory) {
          await inventory.update({ quantity: item.actual_quantity });
        }
      }
    }

    await createAuditLog({
      action: 'check_inventory',
      module: 'inventory_check',
      recordId: check.id,
      recordNo: check.check_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `完成盘点 ${check.check_no}, 相符: ${matched}, 不符: ${mismatched}`
    });

    return check;
  }

  async getCheckDetail(id) {
    return await InventoryCheck.findByPk(id, {
      include: [{ model: InventoryCheckItem, as: 'items' }]
    });
  }

  async listChecks(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.checker_id) where.checker_id = filters.checker_id;

    return await InventoryCheck.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
  }
}

module.exports = new InventoryCheckService();
