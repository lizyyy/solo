const { MaterialOrder } = require('../models');
const { createAuditLog } = require('../services/auditService');
const { createFlowRecord } = require('../services/flowService');
const { Op } = require('sequelize');

const getAllOrders = async (req, res) => {
  try {
    const { 
      projectName, 
      materialName, 
      supplier, 
      status, 
      responsiblePerson,
      startDate,
      endDate 
    } = req.query;
    
    const where = {};
    
    if (projectName) where.projectName = { [Op.like]: `%${projectName}%` };
    if (materialName) where.materialName = { [Op.like]: `%${materialName}%` };
    if (supplier) where.supplier = { [Op.like]: `%${supplier}%` };
    if (status) where.status = status;
    if (responsiblePerson) where.responsiblePerson = responsiblePerson;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    const orders = await MaterialOrder.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await MaterialOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const order = await MaterialOrder.create({
      ...req.body,
      createdBy: req.body.operator || 'system',
      updatedBy: req.body.operator || 'system'
    });
    
    await createAuditLog(
      'order',
      order.id,
      'create',
      null,
      order.toJSON(),
      req.body.operator || 'system',
      '创建材料订单'
    );
    
    await createFlowRecord(
      'delivery',
      order.id,
      order.id,
      null,
      'pending',
      req.body.operator || 'system',
      '订单创建，待送货'
    );
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const order = await MaterialOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const oldValues = order.toJSON();
    await order.update({
      ...req.body,
      updatedBy: req.body.operator || 'system'
    });
    
    await createAuditLog(
      'order',
      order.id,
      'update',
      oldValues,
      order.toJSON(),
      req.body.operator || 'system',
      '更新材料订单'
    );
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await MaterialOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const oldValues = order.toJSON();
    await order.destroy();
    
    await createAuditLog(
      'order',
      req.params.id,
      'delete',
      oldValues,
      null,
      req.body.operator || 'system',
      '删除材料订单'
    );
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder
};
