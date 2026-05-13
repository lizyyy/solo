const { Parser } = require('json2csv');
const { MaterialOrder, DeliveryNote, InspectionRecord, AuditLog } = require('../models');
const { Op } = require('sequelize');

const exportOrdersReport = async (req, res) => {
  try {
    const { responsiblePerson, startDate, endDate, status } = req.query;
    
    const where = {};
    if (responsiblePerson) where.responsiblePerson = responsiblePerson;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    if (status) where.status = status;
    
    const orders = await MaterialOrder.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    const fields = [
      'orderNo',
      'projectName',
      'materialName',
      'materialType',
      'specification',
      'quantity',
      'unit',
      'unitPrice',
      'totalAmount',
      'supplier',
      'expectedDeliveryDate',
      'status',
      'responsiblePerson',
      'createdAt'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(orders.map(o => o.toJSON()));
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=材料订单报表_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportInspectionsReport = async (req, res) => {
  try {
    const { inspector, startDate, endDate, status } = req.query;
    
    const where = {};
    if (inspector) where.inspector = inspector;
    if (startDate && endDate) {
      where.inspectionDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    if (status) where.status = status;
    
    const inspections = await InspectionRecord.findAll({
      where,
      include: [
        { model: MaterialOrder, as: 'order' },
        { model: DeliveryNote, as: 'delivery' }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    const data = inspections.map(i => {
      const json = i.toJSON();
      return {
        inspectionNo: json.inspectionNo,
        orderNo: json.order?.orderNo,
        deliveryNo: json.delivery?.deliveryNo,
        projectName: json.order?.projectName,
        materialName: json.order?.materialName,
        inspectionDate: json.inspectionDate,
        inspectedQuantity: json.inspectedQuantity,
        acceptedQuantity: json.acceptedQuantity,
        rejectedQuantity: json.rejectedQuantity,
        inspectionResult: json.inspectionResult,
        rejectReason: json.rejectReason,
        inspector: json.inspector,
        isReturnProcessed: json.isReturnProcessed ? '是' : '否',
        status: json.status,
        createdAt: json.createdAt
      };
    });
    
    const fields = [
      'inspectionNo',
      'orderNo',
      'deliveryNo',
      'projectName',
      'materialName',
      'inspectionDate',
      'inspectedQuantity',
      'acceptedQuantity',
      'rejectedQuantity',
      'inspectionResult',
      'rejectReason',
      'inspector',
      'isReturnProcessed',
      'status',
      'createdAt'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=验收记录报表_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const orders = await MaterialOrder.findAll();
    const deliveries = await DeliveryNote.findAll();
    const inspections = await InspectionRecord.findAll();
    
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const partialOrders = orders.filter(o => o.status === 'partial_delivered').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    
    const pendingDeliveries = deliveries.filter(d => d.status === 'pending').length;
    const rejectedDeliveries = deliveries.filter(d => d.status === 'rejected').length;
    const returnedDeliveries = deliveries.filter(d => d.status === 'returned').length;
    
    const pendingReturns = inspections.filter(i => !i.isReturnProcessed && i.rejectedQuantity > 0).length;
    
    const totalOrderAmount = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
    const totalInspected = inspections.reduce((sum, i) => sum + parseFloat(i.inspectedQuantity), 0);
    const totalRejected = inspections.reduce((sum, i) => sum + parseFloat(i.rejectedQuantity), 0);
    
    const inspectors = [...new Set(inspections.map(i => i.inspector).filter(Boolean))];
    
    const inspectorStats = inspectors.map(inspector => {
      const ins = inspections.filter(i => i.inspector === inspector);
      return {
        inspector,
        total: ins.length,
        accepted: ins.filter(i => i.inspectionResult === 'accepted').length,
        rejected: ins.filter(i => i.inspectionResult === 'rejected').length
      };
    });
    
    const responsiblePersons = [...new Set(orders.map(o => o.responsiblePerson).filter(Boolean))];
    
    const responsibleStats = responsiblePersons.map(person => {
      const ords = orders.filter(o => o.responsiblePerson === person);
      return {
        person,
        total: ords.length,
        completed: ords.filter(o => o.status === 'completed').length
      };
    });
    
    res.json({
      success: true,
      data: {
        orders: {
          total: orders.length,
          pending: pendingOrders,
          partial: partialOrders,
          delivered: deliveredOrders,
          completed: completedOrders,
          totalAmount: totalOrderAmount
        },
        deliveries: {
          total: deliveries.length,
          pending: pendingDeliveries,
          rejected: rejectedDeliveries,
          returned: returnedDeliveries
        },
        inspections: {
          total: inspections.length,
          totalInspected,
          totalRejected,
          pendingReturns
        },
        inspectorStats,
        responsibleStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, operator, startDate, endDate } = req.query;
    
    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (operator) where.operator = operator;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    
    const logs = await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        ...log.toJSON(),
        oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
        newValues: log.newValues ? JSON.parse(log.newValues) : null,
        changedFields: log.changedFields ? JSON.parse(log.changedFields) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  exportOrdersReport,
  exportInspectionsReport,
  getDashboardData,
  getAuditLogs
};
