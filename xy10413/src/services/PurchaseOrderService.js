const { PurchaseOrder, PurchaseOrderItem, Supplier } = require('../models');
const { Op } = require('sequelize');

class PurchaseOrderService {
  static async create(data, createdBy) {
    const { poNo, supplierId, items } = data;

    const existingPO = await PurchaseOrder.findOne({ where: { poNo } });
    if (existingPO) {
      throw new Error('采购单编号已存在');
    }

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      throw new Error('供应商不存在');
    }

    if (!items || items.length === 0) {
      throw new Error('采购单必须包含至少一个明细');
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += parseFloat(item.quantity) * parseFloat(item.unitPrice);
    }

    const po = await PurchaseOrder.create({
      poNo,
      supplierId,
      status: 'published',
      createdBy
    });

    const poItems = [];
    for (const item of items) {
      const amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      const poItem = await PurchaseOrderItem.create({
        poId: po.id,
        productCode: item.productCode,
        productName: item.productName,
        spec: item.spec,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount
      });
      poItems.push(poItem);
    }

    return {
      ...po.toJSON(),
      items: poItems
    };
  }

  static async findById(id) {
    const po = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier },
        { model: PurchaseOrderItem }
      ]
    });
    return po;
  }

  static async findByPoNo(poNo) {
    const po = await PurchaseOrder.findOne({
      where: { poNo },
      include: [
        { model: Supplier },
        { model: PurchaseOrderItem }
      ]
    });
    return po;
  }

  static async updateStatus(poId, status) {
    await PurchaseOrder.update({ status }, { where: { id: poId } });
  }

  static async updateReceivedQuantity(poId) {
    const items = await PurchaseOrderItem.findAll({ where: { poId } });
    let allReceived = true;
    
    for (const item of items) {
      if (parseFloat(item.receivedQuantity) < parseFloat(item.quantity)) {
        allReceived = false;
        break;
      }
    }

    const po = await PurchaseOrder.findByPk(poId);
    let newStatus;
    
    if (allReceived) {
      newStatus = 'full_arrival';
    } else {
      const hasSomeReceived = items.some(item => parseFloat(item.receivedQuantity) > 0);
      newStatus = hasSomeReceived ? 'partial_arrival' : 'published';
    }

    if (po.status !== newStatus) {
      await this.updateStatus(poId, newStatus);
    }

    return newStatus;
  }

  static async list(filters = {}) {
    const where = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    return await PurchaseOrder.findAll({
      where,
      include: [
        { model: Supplier },
        { model: PurchaseOrderItem }
      ],
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = PurchaseOrderService;
