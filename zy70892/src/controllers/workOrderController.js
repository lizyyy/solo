const { WorkOrder, RepairRecord } = require('../models');
const { Op } = require('sequelize');

class WorkOrderController {
  static async createWorkOrder(req, res) {
    try {
      const {
        orderNo, productCode, productName, plannedQuantity, actualQuantity,
        workstation, shift, operator, startTime, endTime, status, remark
      } = req.body;

      const existing = await WorkOrder.findOne({ where: { orderNo } });
      if (existing) {
        return res.status(400).json({ success: false, message: '工单号已存在' });
      }

      const workOrder = await WorkOrder.create({
        orderNo,
        productCode,
        productName,
        plannedQuantity,
        actualQuantity,
        workstation,
        shift,
        operator,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        status,
        remark
      });

      res.status(201).json({ success: true, data: workOrder });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getWorkOrders(req, res) {
    try {
      const { page = 1, pageSize = 20, orderNo, workstation, status, startDate, endDate } = req.query;
      const where = {};

      if (orderNo) where.orderNo = { [Op.like]: `%${orderNo}%` };
      if (workstation) where.workstation = workstation;
      if (status) where.status = status;
      if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const result = await WorkOrder.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize),
        order: [['createdAt', 'DESC']],
        include: [{ association: 'repairRecords', attributes: ['id', 'recordNo', 'status'] }]
      });

      res.json({
        success: true,
        data: result.rows,
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getWorkOrderById(req, res) {
    try {
      const { id } = req.params;
      const workOrder = await WorkOrder.findByPk(id, {
        include: [{ association: 'repairRecords' }, { association: 'defects' }]
      });

      if (!workOrder) {
        return res.status(404).json({ success: false, message: '工单不存在' });
      }

      res.json({ success: true, data: workOrder });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateWorkOrder(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const workOrder = await WorkOrder.findByPk(id);
      if (!workOrder) {
        return res.status(404).json({ success: false, message: '工单不存在' });
      }

      if (updateData.startTime) updateData.startTime = new Date(updateData.startTime);
      if (updateData.endTime) updateData.endTime = new Date(updateData.endTime);

      await workOrder.update(updateData);
      res.json({ success: true, data: workOrder });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteWorkOrder(req, res) {
    try {
      const { id } = req.params;
      const workOrder = await WorkOrder.findByPk(id);
      if (!workOrder) {
        return res.status(404).json({ success: false, message: '工单不存在' });
      }

      await workOrder.destroy();
      res.json({ success: true, message: '工单已删除' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = WorkOrderController;
