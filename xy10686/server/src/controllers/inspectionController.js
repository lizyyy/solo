const { InspectionRecord, DeliveryNote, MaterialOrder } = require('../models');
const { createAuditLog } = require('../services/auditService');
const { createFlowRecord } = require('../services/flowService');
const { 
  checkPhotoChanges, 
  checkReturnInterception, 
  checkPaymentNodeReview,
  checkDuplicateSubmission 
} = require('../services/validationService');
const { Op } = require('sequelize');

const getAllInspections = async (req, res) => {
  try {
    const { orderId, deliveryId, status, inspector, startDate, endDate } = req.query;
    
    const where = {};
    if (orderId) where.orderId = orderId;
    if (deliveryId) where.deliveryId = deliveryId;
    if (status) where.status = status;
    if (inspector) where.inspector = inspector;
    if (startDate && endDate) {
      where.inspectionDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    const inspections = await InspectionRecord.findAll({
      where,
      include: [
        { model: MaterialOrder, as: 'order' },
        { model: DeliveryNote, as: 'delivery' }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ success: true, data: inspections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInspectionById = async (req, res) => {
  try {
    const inspection = await InspectionRecord.findByPk(req.params.id, {
      include: [
        { model: MaterialOrder, as: 'order' },
        { model: DeliveryNote, as: 'delivery' }
      ]
    });
    if (!inspection) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createInspection = async (req, res) => {
  try {
    const { deliveryId, operator } = req.body;
    
    const duplicateCheck = await checkDuplicateSubmission(
      deliveryId, 
      req.body.inspectionDate, 
      req.body.inspector
    );
    
    if (duplicateCheck.duplicate && req.body.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: duplicateCheck.message,
        code: 'DUPLICATE_SUBMISSION'
      });
    }
    
    const delivery = await DeliveryNote.findByPk(deliveryId);
    if (!delivery) {
      return res.status(404).json({ success: false, message: '送货单不存在' });
    }
    
    const order = await MaterialOrder.findByPk(delivery.orderId);
    
    const inspection = await InspectionRecord.create({
      ...req.body,
      orderId: delivery.orderId,
      createdBy: operator || 'system',
      updatedBy: operator || 'system'
    });
    
    await createAuditLog(
      'inspection',
      inspection.id,
      'create',
      null,
      inspection.toJSON(),
      operator || 'system',
      '创建验收记录'
    );
    
    await createFlowRecord(
      'inspection',
      inspection.id,
      inspection.orderId,
      delivery.status,
      inspection.status,
      operator || 'system',
      '验收记录创建'
    );
    
    if (req.body.status === 'submitted') {
      let newDeliveryStatus = 'accepted';
      if (inspection.inspectionResult === 'rejected') {
        newDeliveryStatus = 'rejected';
      } else if (inspection.inspectionResult === 'partial') {
        newDeliveryStatus = 'partial_accepted';
      }
      
      const oldDeliveryStatus = delivery.status;
      await delivery.update({ status: newDeliveryStatus });
      
      await createFlowRecord(
        'inspection',
        delivery.id,
        delivery.orderId,
        oldDeliveryStatus,
        newDeliveryStatus,
        operator || 'system',
        '送货单状态更新'
      );
    }
    
    res.json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateInspection = async (req, res) => {
  try {
    const inspection = await InspectionRecord.findByPk(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    
    const oldValues = inspection.toJSON();
    
    if (req.body.photos) {
      const photoCheck = checkPhotoChanges(oldValues.photos, req.body.photos);
      if (photoCheck.hasChanged) {
        await createAuditLog(
          'inspection',
          inspection.id,
          'update',
          { photos: oldValues.photos },
          { photos: req.body.photos },
          req.body.operator || 'system',
          `照片变更: ${photoCheck.message}`
        );
      }
    }
    
    await inspection.update({
      ...req.body,
      updatedBy: req.body.operator || 'system'
    });
    
    await createAuditLog(
      'inspection',
      inspection.id,
      'update',
      oldValues,
      inspection.toJSON(),
      req.body.operator || 'system',
      '更新验收记录'
    );
    
    res.json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const submitInspection = async (req, res) => {
  try {
    const inspection = await InspectionRecord.findByPk(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    
    if (inspection.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: '只有草稿状态的验收记录可以提交',
        code: 'INVALID_STATUS'
      });
    }
    
    const duplicateCheck = await checkDuplicateSubmission(
      inspection.deliveryId,
      inspection.inspectionDate,
      inspection.inspector
    );
    
    if (duplicateCheck.duplicate) {
      return res.status(400).json({ 
        success: false, 
        message: duplicateCheck.message,
        code: 'DUPLICATE_SUBMISSION'
      });
    }
    
    const oldValues = inspection.toJSON();
    await inspection.update({ status: 'submitted' });
    
    await createAuditLog(
      'inspection',
      inspection.id,
      'submit',
      oldValues,
      inspection.toJSON(),
      req.body.operator || 'system',
      '提交验收记录'
    );
    
    const delivery = await DeliveryNote.findByPk(inspection.deliveryId);
    if (delivery) {
      let newDeliveryStatus = 'accepted';
      if (inspection.inspectionResult === 'rejected') {
        newDeliveryStatus = 'rejected';
      } else if (inspection.inspectionResult === 'partial') {
        newDeliveryStatus = 'partial_accepted';
      }
      
      const oldDeliveryStatus = delivery.status;
      await delivery.update({ status: newDeliveryStatus });
      
      await createFlowRecord(
        'inspection',
        delivery.id,
        delivery.orderId,
        oldDeliveryStatus,
        newDeliveryStatus,
        req.body.operator || 'system',
        '送货单状态更新'
      );
    }
    
    res.json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const processReturn = async (req, res) => {
  try {
    const inspection = await InspectionRecord.findByPk(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }
    
    if (inspection.rejectedQuantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: '该验收记录没有拒收材料，无需处理退换货',
        code: 'NO_REJECTED'
      });
    }
    
    if (inspection.isReturnProcessed) {
      return res.status(400).json({ 
        success: false, 
        message: '该验收记录的退换货已处理',
        code: 'ALREADY_PROCESSED'
      });
    }
    
    const oldValues = inspection.toJSON();
    await inspection.update({ isReturnProcessed: true });
    
    await createAuditLog(
      'inspection',
      inspection.id,
      'return',
      oldValues,
      inspection.toJSON(),
      req.body.operator || 'system',
      '处理退换货'
    );
    
    const delivery = await DeliveryNote.findByPk(inspection.deliveryId);
    if (delivery) {
      const oldDeliveryStatus = delivery.status;
      await delivery.update({ status: 'returned' });
      
      await createFlowRecord(
        'return',
        inspection.id,
        inspection.orderId,
        oldDeliveryStatus,
        'returned',
        req.body.operator || 'system',
        '退换货处理完成'
      );
    }
    
    res.json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyPaymentNode = async (req, res) => {
  try {
    const { orderId, operator } = req.body;
    
    const reviewResult = await checkPaymentNodeReview(orderId);
    
    if (!reviewResult.verified) {
      return res.status(400).json({ 
        success: false, 
        message: reviewResult.message,
        code: 'PAYMENT_VERIFY_FAILED',
        details: reviewResult
      });
    }
    
    const order = await MaterialOrder.findByPk(orderId);
    if (order) {
      const oldValues = order.toJSON();
      await order.update({ status: 'completed' });
      
      await createAuditLog(
        'order',
        orderId,
        'approve',
        oldValues,
        order.toJSON(),
        operator || 'system',
        '付款节点复核通过，订单完成'
      );
      
      await createFlowRecord(
        'payment',
        orderId,
        orderId,
        oldValues.status,
        'completed',
        operator || 'system',
        '付款节点复核通过'
      );
    }
    
    res.json({ success: true, message: reviewResult.message, data: reviewResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReturnInterception = async (req, res) => {
  try {
    const result = await checkReturnInterception(req.params.deliveryId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  submitInspection,
  processReturn,
  verifyPaymentNode,
  getReturnInterception
};
