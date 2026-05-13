const { DeliveryNote, MaterialOrder } = require('../models');
const { createAuditLog } = require('../services/auditService');
const { createFlowRecord } = require('../services/flowService');
const { Op } = require('sequelize');

const getAllDeliveries = async (req, res) => {
  try {
    const { orderId, status, startDate, endDate } = req.query;
    
    const where = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.deliveryDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    const deliveries = await DeliveryNote.findAll({
      where,
      include: [{ model: MaterialOrder, as: 'order' }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDeliveryById = async (req, res) => {
  try {
    const delivery = await DeliveryNote.findByPk(req.params.id, {
      include: [{ model: MaterialOrder, as: 'order' }]
    });
    if (!delivery) {
      return res.status(404).json({ success: false, message: '送货单不存在' });
    }
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createDelivery = async (req, res) => {
  try {
    const order = await MaterialOrder.findByPk(req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '关联订单不存在' });
    }
    
    const delivery = await DeliveryNote.create({
      ...req.body,
      createdBy: req.body.operator || 'system',
      updatedBy: req.body.operator || 'system'
    });
    
    await createAuditLog(
      'delivery',
      delivery.id,
      'create',
      null,
      delivery.toJSON(),
      req.body.operator || 'system',
      '创建送货单'
    );
    
    await createFlowRecord(
      'delivery',
      delivery.id,
      delivery.orderId,
      order.status,
      delivery.status,
      req.body.operator || 'system',
      '送货单创建'
    );
    
    const allDeliveries = await DeliveryNote.findAll({ where: { orderId: order.id } });
    const totalDelivered = allDeliveries.reduce((sum, d) => sum + parseFloat(d.deliveredQuantity), 0);
    let newOrderStatus = order.status;
    if (totalDelivered >= parseFloat(order.quantity)) {
      newOrderStatus = 'delivered';
    } else if (totalDelivered > 0) {
      newOrderStatus = 'partial_delivered';
    }
    
    if (newOrderStatus !== order.status) {
      const oldOrderStatus = order.status;
      await order.update({ status: newOrderStatus });
      await createFlowRecord(
        'delivery',
        order.id,
        order.id,
        oldOrderStatus,
        newOrderStatus,
        req.body.operator || 'system',
        '订单状态更新'
      );
    }
    
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateDelivery = async (req, res) => {
  try {
    const delivery = await DeliveryNote.findByPk(req.params.id);
    if (!delivery) {
      return res.status(404).json({ success: false, message: '送货单不存在' });
    }
    
    const oldValues = delivery.toJSON();
    await delivery.update({
      ...req.body,
      updatedBy: req.body.operator || 'system'
    });
    
    await createAuditLog(
      'delivery',
      delivery.id,
      'update',
      oldValues,
      delivery.toJSON(),
      req.body.operator || 'system',
      '更新送货单'
    );
    
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery
};
