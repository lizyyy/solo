const { RepairRecord, Batch, WorkOrder, Defect } = require('../models');
const HistoryService = require('../services/historyService');
const { Op } = require('sequelize');
const { Parser } = require('json2csv');

class RepairController {
  static generateRecordNo() {
    const date = new Date();
    const prefix = `R${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${random}`;
  }

  static async createRepairRecord(req, res) {
    try {
      const {
        batchId, workOrderId, serialNo, workstation, responsibleStation,
        operator, defectDescription, rootCause, solution, materialsUsed,
        repairTime, handler, remark
      } = req.body;

      const date = new Date();
      const prefix = `R${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const recordNo = `${prefix}${random}`;

      const repairRecord = await RepairRecord.create({
        recordNo,
        batchId,
        workOrderId,
        serialNo,
        workstation,
        responsibleStation,
        operator,
        defectDescription,
        rootCause,
        solution,
        materialsUsed,
        repairTime,
        handler,
        remark
      });

      await HistoryService.addHistory(
        repairRecord.id,
        '创建返修记录',
        operator || 'system',
        { newStatus: 'pending', reason: '发现缺陷，创建返修单' }
      );

      const result = await RepairRecord.findByPk(repairRecord.id, {
        include: [{ association: 'batch' }, { association: 'workOrder' }]
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getRepairRecords(req, res) {
    try {
      const {
        page = 1, pageSize = 20, recordNo, workstation, responsibleStation,
        status, isClosed, batchNo, startDate, endDate
      } = req.query;

      const where = {};
      const batchWhere = {};

      if (recordNo) where.recordNo = { [Op.like]: `%${recordNo}%` };
      if (workstation) where.workstation = workstation;
      if (responsibleStation) where.responsibleStation = responsibleStation;
      if (status) where.status = status;
      if (isClosed !== undefined) where.isClosed = isClosed === 'true';
      if (batchNo) batchWhere.batchNo = { [Op.like]: `%${batchNo}%` };
      if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const result = await RepairRecord.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize),
        order: [['createdAt', 'DESC']],
        include: [
          { association: 'batch', where: batchWhere, required: Object.keys(batchWhere).length > 0 },
          { association: 'workOrder' },
          { association: 'defects', attributes: ['id', 'defectCode', 'defectType'] }
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

  static async getRepairRecordById(req, res) {
    try {
      const { id } = req.params;
      const record = await RepairRecord.findByPk(id, {
        include: [
          { association: 'batch' },
          { association: 'workOrder' },
          { association: 'defects' },
          { association: 'histories', order: [['operatedAt', 'DESC']] }
        ]
      });

      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markProcessing(req, res) {
    try {
      const { id } = req.params;
      const { operator, handler, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const previousStatus = record.status;
      record.status = 'processing';
      record.handler = handler || record.handler;
      record.processedAt = new Date();
      record.processedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '开始处理',
        operator,
        { previousStatus, newStatus: 'processing', remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markCompleted(req, res) {
    try {
      const { id } = req.params;
      const { operator, solution, materialsUsed, repairTime, rootCause, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const previousStatus = record.status;
      record.status = 'completed';
      record.solution = solution || record.solution;
      record.materialsUsed = materialsUsed || record.materialsUsed;
      record.repairTime = repairTime || record.repairTime;
      record.rootCause = rootCause || record.rootCause;
      record.processedAt = new Date();
      record.processedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '返修完成',
        operator,
        { previousStatus, newStatus: 'completed', remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async returnForRework(req, res) {
    try {
      const { id } = req.params;
      const { operator, returnReason, responsibleStation, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const previousStatus = record.status;
      record.status = 'returned';
      record.returnReason = returnReason;
      record.responsibleStation = responsibleStation || record.responsibleStation;
      record.processedAt = new Date();
      record.processedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '退回修改',
        operator,
        { previousStatus, newStatus: 'returned', reason: returnReason, remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async releaseRecord(req, res) {
    try {
      const { id } = req.params;
      const { operator, releaseReason, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const previousStatus = record.status;
      record.status = 'released';
      record.releaseReason = releaseReason;
      record.processedAt = new Date();
      record.processedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '放行',
        operator,
        { previousStatus, newStatus: 'released', reason: releaseReason, remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async closeLoop(req, res) {
    try {
      const { id } = req.params;
      const { operator, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      if (record.status !== 'released' && record.status !== 'completed') {
        return res.status(400).json({ success: false, message: '只有已完成或已放行的记录才能闭环' });
      }

      const previousStatus = record.status;
      record.isClosed = true;
      record.closedAt = new Date();
      record.closedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '闭环',
        operator,
        { previousStatus, newStatus: 'closed', remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async requestMaterialSupplement(req, res) {
    try {
      const { id } = req.params;
      const { operator, materialSupplement, remark } = req.body;

      const record = await RepairRecord.findByPk(id);
      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const previousStatus = record.status;
      record.materialSupplement = materialSupplement;
      record.processedAt = new Date();
      record.processedBy = operator;
      await record.save();

      await HistoryService.addHistory(
        id,
        '要求补材料',
        operator,
        { previousStatus, newStatus: previousStatus, reason: materialSupplement, remark }
      );

      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async exportRecords(req, res) {
    try {
      const {
        workstation, responsibleStation, status, isClosed,
        batchNo, startDate, endDate
      } = req.query;

      const where = {};
      const batchWhere = {};

      if (workstation) where.workstation = workstation;
      if (responsibleStation) where.responsibleStation = responsibleStation;
      if (status) where.status = status;
      if (isClosed !== undefined) where.isClosed = isClosed === 'true';
      if (batchNo) batchWhere.batchNo = { [Op.like]: `%${batchNo}%` };
      if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const records = await RepairRecord.findAll({
        where,
        order: [['createdAt', 'DESC']],
        include: [
          { association: 'batch', where: batchWhere, required: Object.keys(batchWhere).length > 0 },
          { association: 'workOrder' }
        ]
      });

      const exportData = records.map(r => ({
        返修编号: r.recordNo,
        批次号: r.batch?.batchNo || '',
        工单号: r.workOrder?.orderNo || '',
        产品序列号: r.serialNo || '',
        返修工位: r.workstation,
        责任工位: r.responsibleStation || '',
        操作员: r.operator || '',
        处理人: r.handler || '',
        缺陷描述: r.defectDescription,
        根本原因: r.rootCause || '',
        处理方案: r.solution || '',
        使用物料: r.materialsUsed || '',
        返修耗时: r.repairTime || 0,
        状态: r.status,
        是否闭环: r.isClosed ? '是' : '否',
        放行原因: r.releaseReason || '',
        退回原因: r.returnReason || '',
        补材料要求: r.materialSupplement || '',
        创建时间: r.createdAt.toISOString(),
        处理时间: r.processedAt?.toISOString() || ''
      }));

      const parser = new Parser();
      const csv = parser.parse(exportData);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=repair_records_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getFinalReport(req, res) {
    try {
      const { id } = req.params;
      const record = await RepairRecord.findByPk(id, {
        include: [
          { association: 'batch' },
          { association: 'workOrder' },
          { association: 'defects' },
          { association: 'histories', order: [['operatedAt', 'ASC']] }
        ]
      });

      if (!record) {
        return res.status(404).json({ success: false, message: '返修记录不存在' });
      }

      const report = {
        basicInfo: {
          recordNo: record.recordNo,
          serialNo: record.serialNo,
          batchNo: record.batch?.batchNo,
          orderNo: record.workOrder?.orderNo,
          workstation: record.workstation,
          responsibleStation: record.responsibleStation,
          createdAt: record.createdAt,
          status: record.status,
          isClosed: record.isClosed
        },
        defectInfo: {
          description: record.defectDescription,
          rootCause: record.rootCause,
          defects: record.defects
        },
        processInfo: {
          solution: record.solution,
          materialsUsed: record.materialsUsed,
          repairTime: record.repairTime,
          operator: record.operator,
          handler: record.handler,
          processedAt: record.processedAt,
          processedBy: record.processedBy
        },
        decisionInfo: {
          releaseReason: record.releaseReason,
          returnReason: record.returnReason,
          materialSupplement: record.materialSupplement
        },
        closeInfo: {
          closedAt: record.closedAt,
          closedBy: record.closedBy
        },
        processHistory: record.histories,
        finalConclusion: {
          status: record.status,
          timestamp: record.isClosed ? record.closedAt : record.updatedAt,
          summary: record.isClosed 
            ? `该返修记录已闭环，最终处理结果为${record.status === 'released' ? '放行' : '完成返修'}`
            : `该返修记录当前状态为${record.status}，尚未闭环`
        }
      };

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = RepairController;
