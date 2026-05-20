const { Batch, RepairRecord, Defect } = require('../models');
const HistoryService = require('../services/historyService');
const { Op } = require('sequelize');

class BatchController {
  static async createBatch(req, res) {
    try {
      const { batchNo, materialCode, materialName, quantity, productionDate, workstation, operator, remark } = req.body;
      
      const existingBatch = await Batch.findOne({ where: { batchNo } });
      if (existingBatch) {
        return res.status(400).json({ success: false, message: '批次号已存在' });
      }

      const batch = await Batch.create({
        batchNo,
        materialCode,
        materialName,
        quantity,
        productionDate,
        workstation,
        operator,
        remark
      });

      await HistoryService.addHistory(
        batch.id,
        '创建批次',
        operator || 'system',
        { newStatus: 'pending', reason: '新建批次入库' }
      );

      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBatches(req, res) {
    try {
      const { page = 1, pageSize = 20, batchNo, workstation, status, startDate, endDate } = req.query;
      const where = {};

      if (batchNo) where.batchNo = { [Op.like]: `%${batchNo}%` };
      if (workstation) where.workstation = workstation;
      if (status) where.status = status;
      if (startDate && endDate) {
        where.productionDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const result = await Batch.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize),
        order: [['createdAt', 'DESC']],
        include: [
          { association: 'defects', attributes: ['id', 'defectCode', 'defectType', 'severity', 'status'] },
          { association: 'repairRecords', attributes: ['id', 'recordNo', 'status', 'isClosed'] }
        ]
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

  static async getBatchById(req, res) {
    try {
      const { id } = req.params;
      const batch = await Batch.findByPk(id, {
        include: [
          { association: 'defects' },
          { association: 'repairRecords' },
          { association: 'histories', order: [['operatedAt', 'DESC']] }
        ]
      });

      if (!batch) {
        return res.status(404).json({ success: false, message: '批次不存在' });
      }

      res.json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateBatchStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, operator, reason, remark } = req.body;

      const batch = await Batch.findByPk(id);
      if (!batch) {
        return res.status(404).json({ success: false, message: '批次不存在' });
      }

      const previousStatus = batch.status;
      batch.status = status;
      await batch.save();

      await HistoryService.addHistory(
        id,
        '更新批次状态',
        operator,
        { previousStatus, newStatus: status, reason, remark }
      );

      res.json({ success: true, data: batch });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteBatch(req, res) {
    try {
      const { id } = req.params;
      const batch = await Batch.findByPk(id);
      if (!batch) {
        return res.status(404).json({ success: false, message: '批次不存在' });
      }

      await batch.destroy();
      res.json({ success: true, message: '批次已删除' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = BatchController;
