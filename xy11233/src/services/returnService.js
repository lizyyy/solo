const {
  Requisition,
  RequisitionItem,
  Inventory,
  ReturnRecord,
  OutboundRecord
} = require('../models');
const { createAuditLog } = require('../middleware/audit');

function generateOrderNo(prefix) {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
}

class ReturnService {
  async processReturn(data, operator) {
    const { 
      requisition_id, 
      requisition_item_id, 
      outbound_record_id, 
      quantity, 
      returner_id, 
      returner_name,
      remaining_quantity,
      usage_remark,
      condition,
      remark 
    } = data;

    const requisition = await Requisition.findByPk(requisition_id);
    if (!requisition) {
      throw new Error('申领单不存在');
    }

    const item = await RequisitionItem.findByPk(requisition_item_id);
    if (!item) {
      throw new Error('申领单项不存在');
    }

    if (item.status !== RequisitionItem.ITEM_STATUSES.FULLY_ISSUED &&
        item.status !== RequisitionItem.ITEM_STATUSES.PARTIAL_ISSUED) {
      throw new Error('该申领单项状态不允许归还');
    }

    const outbound = await OutboundRecord.findByPk(outbound_record_id);
    if (!outbound) {
      throw new Error('出库记录不存在');
    }

    const returnedTotal = await ReturnRecord.sum('quantity', {
      where: {
        requisition_item_id,
        status: ReturnRecord.RETURN_STATUSES.CONFIRMED
      }
    }) || 0;

    const totalIssued = item.issued_quantity;
    if (returnedTotal + quantity > totalIssued) {
      throw new Error(`归还数量超出已出量，已归还: ${returnedTotal}, 可归还: ${totalIssued - returnedTotal}`);
    }

    const return_no = generateOrderNo('RT');

    await ReturnRecord.create({
      return_no,
      requisition_id,
      requisition_item_id,
      outbound_record_id,
      inventory_id: outbound.inventory_id,
      batch_no: outbound.batch_no,
      reagent_id: item.reagent_id,
      reagent_name: item.reagent_name,
      quantity,
      unit: item.unit,
      returner_id,
      returner_name,
      receiver_id: operator.id,
      receiver_name: operator.name,
      return_time: new Date(),
      status: ReturnRecord.RETURN_STATUSES.CONFIRMED,
      remaining_quantity,
      usage_remark,
      condition,
      remark
    });

    const newReturned = item.returned_quantity + quantity;
    const itemStatus = newReturned >= item.issued_quantity
      ? RequisitionItem.ITEM_STATUSES.FULLY_RETURNED
      : RequisitionItem.ITEM_STATUSES.PARTIAL_RETURNED;

    await item.update({
      returned_quantity: newReturned,
      status: itemStatus
    });

    const inventory = await Inventory.findByPk(outbound.inventory_id);
    if (inventory) {
      await inventory.update({
        quantity: inventory.quantity + quantity,
        status: Inventory.STORAGE_STATUSES.NORMAL
      });
    }

    const allItems = await RequisitionItem.findAll({ where: { requisition_id } });
    const allFullyReturned = allItems.every(i => 
      i.status === RequisitionItem.ITEM_STATUSES.FULLY_RETURNED ||
      i.status === RequisitionItem.ITEM_STATUSES.REJECTED
    );
    const anyPartialReturned = allItems.some(i => 
      i.status === RequisitionItem.ITEM_STATUSES.PARTIAL_RETURNED
    );

    let requisitionStatus = requisition.status;
    if (allFullyReturned) {
      requisitionStatus = Requisition.REQUISITION_STATUSES.FULLY_RETURNED;
    } else if (anyPartialReturned) {
      requisitionStatus = Requisition.REQUISITION_STATUSES.PARTIAL_RETURNED;
    }

    await requisition.update({
      status: requisitionStatus,
      fully_returned_at: allFullyReturned ? new Date() : null
    });

    await createAuditLog({
      action: 'return',
      module: 'return',
      recordId: requisition.id,
      recordNo: return_no,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      description: `归还 ${item.reagent_name} 数量 ${quantity} ${item.unit}`
    });

    return { return_no, item };
  }

  async getReturnRecords(filters = {}) {
    const where = {};
    if (filters.requisition_id) where.requisition_id = filters.requisition_id;
    if (filters.returner_id) where.returner_id = filters.returner_id;

    return await ReturnRecord.findAll({
      where,
      order: [['return_time', 'DESC']]
    });
  }

  async getReturnableItems(requisition_id) {
    const items = await RequisitionItem.findAll({
      where: {
        requisition_id,
        status: {
          $in: [
            RequisitionItem.ITEM_STATUSES.FULLY_ISSUED,
            RequisitionItem.ITEM_STATUSES.PARTIAL_ISSUED
          ]
        }
      }
    });

    const result = [];
    for (const item of items) {
      const returned = await ReturnRecord.sum('quantity', {
        where: {
          requisition_item_id: item.id,
          status: ReturnRecord.RETURN_STATUSES.CONFIRMED
        }
      }) || 0;

      result.push({
        item,
        issued_quantity: item.issued_quantity,
        returned_quantity: returned,
        returnable_quantity: item.issued_quantity - returned
      });
    }

    return result;
  }
}

module.exports = new ReturnService();
