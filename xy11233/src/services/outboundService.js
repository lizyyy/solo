const { Op } = require('sequelize');
const {
  Requisition,
  RequisitionItem,
  Inventory,
  OutboundRecord,
  Reagent
} = require('../models');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../config/logger');

function generateOrderNo(prefix) {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
}

class OutboundService {
  async processOutbound(data, operator) {
    const { requisition_id, requisition_item_id, inventory_id, quantity, receiver_id, receiver_name, remark } = data;

    const requisition = await Requisition.findByPk(requisition_id);
    if (!requisition) {
      throw new Error('申领单不存在');
    }

    if (requisition.status !== Requisition.REQUISITION_STATUSES.APPROVED) {
      throw new Error('只有已审批状态的申领单可以出库');
    }

    const item = await RequisitionItem.findByPk(requisition_item_id);
    if (!item) {
      throw new Error('申领单项不存在');
    }

    if (item.status !== RequisitionItem.ITEM_STATUSES.APPROVED) {
      throw new Error('该申领单项状态不允许出库');
    }

    const remaining = item.approved_quantity - item.issued_quantity;
    if (quantity > remaining) {
      throw new Error(`出库数量超出可出量，剩余可出: ${remaining}`);
    }

    const inventory = await Inventory.findByPk(inventory_id);
    if (!inventory) {
      throw new Error('库存记录不存在');
    }

    if (inventory.quantity < quantity) {
      throw new Error(`库存不足，当前库存: ${inventory.quantity}`);
    }

    if (inventory.status !== Inventory.STORAGE_STATUSES.NORMAL) {
      throw new Error('该批次库存状态异常，无法出库');
    }

    const outbound_no = generateOrderNo('OB');

    await OutboundRecord.create({
      outbound_no,
      requisition_id,
      requisition_item_id,
      inventory_id,
      batch_no: inventory.batch_no,
      reagent_id: item.reagent_id,
      reagent_name: item.reagent_name,
      quantity,
      unit: item.unit,
      receiver_id,
      receiver_name,
      handler_id: operator.id,
      handler_name: operator.name,
      outbound_time: new Date(),
      location: inventory.location,
      remark
    });

    const newIssued = item.issued_quantity + quantity;
    const itemStatus = newIssued >= item.approved_quantity 
      ? RequisitionItem.ITEM_STATUSES.FULLY_ISSUED 
      : RequisitionItem.ITEM_STATUSES.PARTIAL_ISSUED;
    
    await item.update({
      issued_quantity: newIssued,
      status: itemStatus
    });

    const newInventoryQty = inventory.quantity - quantity;
    const inventoryStatus = newInventoryQty <= 0 
      ? Inventory.STORAGE_STATUSES.OUT_OF_STOCK 
      : (newInventoryQty <= (inventory.warning_threshold || 5) 
          ? Inventory.STORAGE_STATUSES.LOW_STOCK 
          : inventory.status);
    
    await inventory.update({
      quantity: newInventoryQty,
      status: inventoryStatus
    });

    const allItems = await RequisitionItem.findAll({ where: { requisition_id } });
    const allFullyIssued = allItems.every(i => i.status === RequisitionItem.ITEM_STATUSES.FULLY_ISSUED);
    const anyPartialIssued = allItems.some(i => i.status === RequisitionItem.ITEM_STATUSES.PARTIAL_ISSUED);

    let requisitionStatus = requisition.status;
    if (allFullyIssued) {
      requisitionStatus = Requisition.REQUISITION_STATUSES.FULLY_ISSUED;
    } else if (anyPartialIssued) {
      requisitionStatus = Requisition.REQUISITION_STATUSES.PARTIAL_ISSUED;
    }

    await requisition.update({
      status: requisitionStatus,
      fully_issued_at: allFullyIssued ? new Date() : null
    });

    await createAuditLog({
      action: 'outbound',
      module: 'outbound',
      recordId: requisition.id,
      recordNo: outbound_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `出库 ${item.reagent_name} 数量 ${quantity} ${item.unit}`
    });

    return { outbound_no, item, inventory };
  }

  async getOutboundRecords(filters = {}) {
    const where = {};
    if (filters.requisition_id) where.requisition_id = filters.requisition_id;
    if (filters.reagent_id) where.reagent_id = filters.reagent_id;
    if (filters.handler_id) where.handler_id = filters.handler_id;

    return await OutboundRecord.findAll({
      where,
      order: [['outbound_time', 'DESC']]
    });
  }

  async getAvailableInventory(reagent_id) {
    return await Inventory.findAll({
      where: {
        reagent_id,
        quantity: { [Op.gt]: 0 },
        status: Inventory.STORAGE_STATUSES.NORMAL
      },
      order: [['expiry_date', 'ASC']]
    });
  }
}

module.exports = new OutboundService();
