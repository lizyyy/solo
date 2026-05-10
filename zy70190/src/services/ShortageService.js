const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const { MaterialShortage, CommitmentVersion, AffectedOrder, UrgeTask, DeliveryReceipt, RiskReport } = require('../models');
const HistoryService = require('./HistoryService');
const ResultService = require('./ResultService');

class ShortageService {
  static async createShortage(data, operator = null) {
    try {
      const shortage = await MaterialShortage.create({
        shortageNo: `SH-${Date.now()}`,
        materialCode: data.materialCode,
        materialName: data.materialName,
        supplierCode: data.supplierCode,
        supplierName: data.supplierName,
        requiredDate: data.requiredDate,
        requiredQuantity: data.requiredQuantity,
        status: 'pending'
      });

      await HistoryService.record(
        shortage.id,
        'create',
        `创建缺料单：${shortage.shortageNo}`,
        operator,
        null,
        shortage.toJSON()
      );

      return shortage;
    } catch (error) {
      console.error('创建缺料单失败:', error);
      throw error;
    }
  }

  static async getShortage(shortageId) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId, {
        include: [
          { model: CommitmentVersion, as: 'commitments', order: [['versionNo', 'DESC']] },
          { model: AffectedOrder, as: 'affectedOrders' },
          { model: UrgeTask, as: 'urgeTasks', order: [['createdAt', 'DESC']] },
          { model: DeliveryReceipt, as: 'deliveryReceipts', order: [['deliveryDate', 'DESC']] },
          { model: RiskReport, as: 'riskReports', order: [['createdAt', 'DESC']] }
        ]
      });

      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      return shortage;
    } catch (error) {
      console.error('获取缺料单失败:', error);
      throw error;
    }
  }

  static async getShortageByNo(shortageNo) {
    try {
      const shortage = await MaterialShortage.findOne({
        where: { shortageNo },
        include: [
          { model: CommitmentVersion, as: 'commitments', order: [['versionNo', 'DESC']] },
          { model: AffectedOrder, as: 'affectedOrders' },
          { model: UrgeTask, as: 'urgeTasks', order: [['createdAt', 'DESC']] },
          { model: DeliveryReceipt, as: 'deliveryReceipts', order: [['deliveryDate', 'DESC']] },
          { model: RiskReport, as: 'riskReports', order: [['createdAt', 'DESC']] }
        ]
      });

      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      return shortage;
    } catch (error) {
      console.error('获取缺料单失败:', error);
      throw error;
    }
  }

  static async listShortages(filter = {}) {
    try {
      const where = {};
      if (filter.status) where.status = filter.status;
      if (filter.supplierCode) where.supplierCode = filter.supplierCode;
      if (filter.materialCode) where.materialCode = filter.materialCode;

      const shortages = await MaterialShortage.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });

      return shortages;
    } catch (error) {
      console.error('查询缺料单列表失败:', error);
      throw error;
    }
  }

  static async updateShortage(shortageId, data, operator = null) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId);
      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      const beforeSnapshot = shortage.toJSON();
      await shortage.update(data);

      await HistoryService.record(
        shortageId,
        'update',
        `更新缺料单信息`,
        operator,
        beforeSnapshot,
        shortage.toJSON()
      );

      return shortage;
    } catch (error) {
      console.error('更新缺料单失败:', error);
      throw error;
    }
  }

  static async withdrawShortage(shortageId, reason, operator = null) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId);
      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      const beforeSnapshot = shortage.toJSON();
      await shortage.update({ status: 'withdrawn' });

      await HistoryService.record(
        shortageId,
        'withdraw',
        `撤回缺料单，原因：${reason}`,
        operator,
        beforeSnapshot,
        shortage.toJSON()
      );

      return shortage;
    } catch (error) {
      console.error('撤回缺料单失败:', error);
      throw error;
    }
  }

  static async supplementShortage(shortageId, data, operator = null) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId);
      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      const beforeSnapshot = shortage.toJSON();
      await shortage.update(data);

      await HistoryService.record(
        shortageId,
        'supplement',
        `补录缺料单信息`,
        operator,
        beforeSnapshot,
        shortage.toJSON()
      );

      return shortage;
    } catch (error) {
      console.error('补录缺料单失败:', error);
      throw error;
    }
  }

  static async addCommitment(shortageId, data, operator = null) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId);
      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      const existingCommitments = await CommitmentVersion.count({
        where: { shortageId }
      });

      const commitment = await CommitmentVersion.create({
        shortageId,
        versionNo: existingCommitments + 1,
        promiseDate: data.promiseDate,
        promiseQuantity: data.promiseQuantity,
        reason: data.reason,
        source: data.source
      });

      await shortage.update({
        latestPromiseDate: data.promiseDate,
        status: 'processing'
      });

      await HistoryService.record(
        shortageId,
        'commitment',
        `添加第${existingCommitments + 1}版承诺：承诺日期${dayjs(data.promiseDate).format('YYYY-MM-DD')}，数量${data.promiseQuantity}`,
        operator
      );

      return commitment;
    } catch (error) {
      console.error('添加承诺版本失败:', error);
      throw error;
    }
  }

  static async addAffectedOrder(shortageId, data) {
    try {
      const order = await AffectedOrder.create({
        shortageId,
        orderNo: data.orderNo,
        orderType: data.orderType,
        orderDate: data.orderDate,
        requiredDate: data.requiredDate,
        quantity: data.quantity,
        customerName: data.customerName,
        impactLevel: data.impactLevel || 'medium'
      });

      return order;
    } catch (error) {
      console.error('添加影响订单失败:', error);
      throw error;
    }
  }

  static async addUrgeTask(shortageId, data, operator = null) {
    try {
      const urge = await UrgeTask.create({
        shortageId,
        taskNo: `URG-${Date.now()}`,
        priority: data.priority || 'normal',
        assignee: data.assignee,
        content: data.content,
        dueDate: data.dueDate,
        status: 'pending'
      });

      await HistoryService.record(
        shortageId,
        'urge',
        `创建催办任务：${urge.taskNo}`,
        operator
      );

      return urge;
    } catch (error) {
      console.error('创建催办任务失败:', error);
      throw error;
    }
  }

  static async completeUrgeTask(taskId, response, operator = null) {
    try {
      const task = await UrgeTask.findByPk(taskId);
      if (!task) {
        throw new Error('催办任务不存在');
      }

      const beforeSnapshot = task.toJSON();
      await task.update({
        status: 'completed',
        response,
        completedAt: new Date()
      });

      await HistoryService.record(
        task.shortageId,
        'urge',
        `完成催办任务：${task.taskNo}`,
        operator,
        beforeSnapshot,
        task.toJSON()
      );

      return task;
    } catch (error) {
      console.error('完成催办任务失败:', error);
      throw error;
    }
  }

  static async addDeliveryReceipt(shortageId, data, operator = null) {
    try {
      const shortage = await MaterialShortage.findByPk(shortageId);
      if (!shortage) {
        throw new Error('缺料单不存在');
      }

      const receipt = await DeliveryReceipt.create({
        shortageId,
        receiptNo: `REC-${Date.now()}`,
        deliveryDate: data.deliveryDate,
        deliveryQuantity: data.deliveryQuantity,
        batchNo: data.batchNo,
        qualityStatus: data.qualityStatus || 'inspecting',
        remark: data.remark
      });

      const allReceipts = await DeliveryReceipt.findAll({
        where: { shortageId }
      });
      const totalDelivered = allReceipts.reduce((sum, r) => sum + parseFloat(r.deliveryQuantity), 0);

      let newStatus = shortage.status;
      let actualDeliveryDate = shortage.actualDeliveryDate;

      if (data.qualityStatus === 'qualified') {
        actualDeliveryDate = data.deliveryDate;
        if (totalDelivered >= parseFloat(shortage.requiredQuantity)) {
          newStatus = 'resolved';
        }
      }

      await shortage.update({
        deliveryQuantity: totalDelivered,
        actualDeliveryDate,
        status: newStatus
      });

      await HistoryService.record(
        shortageId,
        'delivery',
        `到料回执：数量${data.deliveryQuantity}，日期${dayjs(data.deliveryDate).format('YYYY-MM-DD')}`,
        operator
      );

      return receipt;
    } catch (error) {
      console.error('添加到料回执失败:', error);
      throw error;
    }
  }

  static async addRiskReport(shortageId, data, operator = null) {
    try {
      const report = await RiskReport.create({
        shortageId,
        reportNo: `RISK-${Date.now()}`,
        riskLevel: data.riskLevel,
        riskType: data.riskType,
        description: data.description,
        impact: data.impact,
        mitigation: data.mitigation,
        reporter: data.reporter || operator,
        status: 'active'
      });

      await HistoryService.record(
        shortageId,
        'risk',
        `创建风险报告：${report.reportNo}，风险等级${data.riskLevel}`,
        operator
      );

      return report;
    } catch (error) {
      console.error('创建风险报告失败:', error);
      throw error;
    }
  }

  static async updateRiskReport(reportId, data, operator = null) {
    try {
      const report = await RiskReport.findByPk(reportId);
      if (!report) {
        throw new Error('风险报告不存在');
      }

      const beforeSnapshot = report.toJSON();
      await report.update(data);

      await HistoryService.record(
        report.shortageId,
        'risk',
        `更新风险报告：${report.reportNo}`,
        operator,
        beforeSnapshot,
        report.toJSON()
      );

      return report;
    } catch (error) {
      console.error('更新风险报告失败:', error);
      throw error;
    }
  }
}

module.exports = ShortageService;
