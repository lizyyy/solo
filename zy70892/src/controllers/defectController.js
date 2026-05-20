const { Defect, Batch, WorkOrder, RepairRecord } = require('../models');
const HistoryService = require('../services/historyService');
const { Op } = require('sequelize');

class DefectController {
  static async createDefect(req, res) {
    try {
      const {
        batchId, workOrderId, repairRecordId, defectCode, defectType,
        description, severity, workstation, responsibleStation,
        discoveredBy, rootCause, causeAnalysis, status, remark
      } = req.body;

      const defect = await Defect.create({
        batchId,
        workOrderId,
        repairRecordId,
        defectCode,
        defectType,
        description,
        severity,
        workstation,
        responsibleStation,
        discoveredBy,
        discoveredAt: new Date(),
        rootCause,
        causeAnalysis,
        status,
        remark
      });

      await HistoryService.addHistory(
        defect.id,
        '创建缺陷记录',
        discoveredBy || 'system',
        { newStatus: status || 'open', reason: description }
      );

      res.status(201).json({ success: true, data: defect });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getDefects(req, res) {
    try {
      const {
        page = 1, pageSize = 20, defectCode, defectType, severity,
        workstation, responsibleStation, status, startDate, endDate
      } = req.query;
      const where = {};

      if (defectCode) where.defectCode = { [Op.like]: `%${defectCode}%` };
      if (defectType) where.defectType = { [Op.like]: `%${defectType}%` };
      if (severity) where.severity = severity;
      if (workstation) where.workstation = workstation;
      if (responsibleStation) where.responsibleStation = responsibleStation;
      if (status) where.status = status;
      if (startDate && endDate) {
        where.discoveredAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const result = await Defect.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize),
        order: [['discoveredAt', 'DESC']],
        include: [
          { association: 'batch', attributes: ['id', 'batchNo'] },
          { association: 'workOrder', attributes: ['id', 'orderNo'] },
          { association: 'repairRecord', attributes: ['id', 'recordNo'] }
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

  static async getDefectById(req, res) {
    try {
      const { id } = req.params;
      const defect = await Defect.findByPk(id, {
        include: [
          { association: 'batch' },
          { association: 'workOrder' },
          { association: 'repairRecord' },
          { association: 'histories', order: [['operatedAt', 'DESC']] }
        ]
      });

      if (!defect) {
        return res.status(404).json({ success: false, message: '缺陷记录不存在' });
      }

      res.json({ success: true, data: defect });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateDefect(req, res) {
    try {
      const { id } = req.params;
      const { operator, ...updateData } = req.body;
      
      const defect = await Defect.findByPk(id);
      if (!defect) {
        return res.status(404).json({ success: false, message: '缺陷记录不存在' });
      }

      const previousStatus = defect.status;
      await defect.update(updateData);

      if (updateData.status && updateData.status !== previousStatus) {
        await HistoryService.addHistory(
          id,
          '更新缺陷状态',
          operator || 'system',
          { previousStatus, newStatus: updateData.status, reason: updateData.causeAnalysis }
        );
      }

      res.json({ success: true, data: defect });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteDefect(req, res) {
    try {
      const { id } = req.params;
      const defect = await Defect.findByPk(id);
      if (!defect) {
        return res.status(404).json({ success: false, message: '缺陷记录不存在' });
      }

      await defect.destroy();
      res.json({ success: true, message: '缺陷记录已删除' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getDefectStatistics(req, res) {
    try {
      const { startDate, endDate, workstation } = req.query;
      const where = {};

      if (startDate && endDate) {
        where.discoveredAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }
      if (workstation) where.workstation = workstation;

      const defects = await Defect.findAll({ where });

      const byType = {};
      const bySeverity = { minor: 0, major: 0, critical: 0 };
      const byStatus = { open: 0, analyzing: 0, fixing: 0, verified: 0, closed: 0 };
      const byWorkstation = {};

      defects.forEach(d => {
        byType[d.defectType] = (byType[d.defectType] || 0) + 1;
        bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        byWorkstation[d.workstation] = (byWorkstation[d.workstation] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          total: defects.length,
          byType,
          bySeverity,
          byStatus,
          byWorkstation
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DefectController;
