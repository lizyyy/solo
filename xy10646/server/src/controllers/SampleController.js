const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const {
  SampleRecord,
  SamplingPoint,
  SampleBottle,
  TestItem,
  FlowRecord,
  AuditLog
} = require('../models');
const BusinessRulesService = require('../services/BusinessRules');

class SampleController {
  static async getSampleRecords(req, res) {
    try {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        status,
        samplingPointId,
        startDate,
        endDate
      } = req.query;

      const where = {};

      if (keyword) {
        where[Op.or] = [
          { sampleCode: { [Op.like]: `%${keyword}%` } },
          { sampler: { [Op.like]: `%${keyword}%` } }
        ];
      }

      if (status) {
        where.status = status;
      }

      if (samplingPointId) {
        where.samplingPointId = samplingPointId;
      }

      if (startDate && endDate) {
        where.samplingTime = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const { count, rows } = await SampleRecord.findAndCountAll({
        where,
        include: [
          { model: SamplingPoint, attributes: ['code', 'name'] },
          { model: SampleBottle, attributes: ['bottleNumber', 'preservative'] }
        ],
        order: [['samplingTime', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count,
          totalPages: Math.ceil(count / parseInt(pageSize))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createSampleRecord(req, res) {
    try {
      const sample = await SampleRecord.create(req.body);
      res.status(201).json({ success: true, data: sample });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSampleRecord(req, res) {
    try {
      const { id } = req.params;
      const { operator, ...updateData } = req.body;
      
      const sample = await BusinessRulesService.updateSampleRecordWithAudit(
        id,
        updateData,
        operator || 'system'
      );

      res.json({ success: true, data: sample });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSampleDetail(req, res) {
    try {
      const { id } = req.params;
      const sample = await SampleRecord.findByPk(id, {
        include: [
          { model: SamplingPoint },
          { model: SampleBottle },
          { model: TestItem },
          { model: FlowRecord, order: [['operationTime', 'ASC']] }
        ]
      });

      if (!sample) {
        return res.status(404).json({ success: false, message: '样品不存在' });
      }

      res.json({ success: true, data: sample });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createFlowRecord(req, res) {
    try {
      const validation = await BusinessRulesService.validateFlowRecord(req.body);

      if (!validation.valid && validation.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: '业务规则校验失败',
          errors: validation.errors
        });
      }

      const flowRecord = await FlowRecord.create(validation.flowData);

      const statusMap = {
        sample: 'sampled',
        transport: 'transported',
        receive: 'received',
        test: 'testing',
        complete: 'completed',
        reject: 'rejected'
      };

      await SampleRecord.update(
        { status: statusMap[req.body.flowType] || 'sampled' },
        { where: { id: req.body.sampleRecordId } }
      );

      res.status(201).json({
        success: true,
        data: flowRecord,
        warnings: validation.warnings
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAnomalies(req, res) {
    try {
      const timeoutFlows = await FlowRecord.findAll({
        where: { isTimeout: true },
        include: [{ model: SampleRecord, include: [SamplingPoint] }],
        order: [['operationTime', 'DESC']]
      });

      const abnormalTests = await TestItem.findAll({
        where: { isAbnormal: true },
        include: [{ model: SampleRecord, include: [SamplingPoint] }],
        order: [['testTime', 'DESC']]
      });

      const rejectedSamples = await SampleRecord.findAll({
        where: { status: 'rejected' },
        include: [SamplingPoint],
        order: [['samplingTime', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          timeoutFlows,
          abnormalTests,
          rejectedSamples
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async exportReport(req, res) {
    try {
      const { operator, startDate, endDate, status } = req.query;

      const where = {};
      if (startDate && endDate) {
        where.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }
      if (status) {
        where.status = status;
      }

      const samples = await SampleRecord.findAll({
        where,
        include: [
          { model: SamplingPoint },
          { model: SampleBottle },
          { model: FlowRecord },
          { model: TestItem }
        ],
        order: [['samplingTime', 'DESC']]
      });

      let filteredSamples = samples;
      if (operator) {
        filteredSamples = samples.filter(sample =>
          sample.FlowRecords.some(flow => flow.operator.includes(operator))
        );
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('采样送检报告');

      worksheet.columns = [
        { header: '样品编号', key: 'sampleCode', width: 20 },
        { header: '采样点', key: 'samplingPoint', width: 20 },
        { header: '样瓶编号', key: 'bottleNumber', width: 15 },
        { header: '保存剂', key: 'preservative', width: 15 },
        { header: '采样时间', key: 'samplingTime', width: 20 },
        { header: '采样人', key: 'sampler', width: 12 },
        { header: '状态', key: 'status', width: 12 },
        { header: '检测项目数', key: 'testCount', width: 12 },
        { header: '异常数', key: 'abnormalCount', width: 10 },
        { header: '最后操作人', key: 'lastOperator', width: 12 },
        { header: '最后操作时间', key: 'lastOperationTime', width: 20 }
      ];

      filteredSamples.forEach(sample => {
        const lastFlow = sample.FlowRecords.sort(
          (a, b) => new Date(b.operationTime) - new Date(a.operationTime)
        )[0];

        worksheet.addRow({
          sampleCode: sample.sampleCode,
          samplingPoint: sample.SamplingPoint?.name || '',
          bottleNumber: sample.SampleBottle?.bottleNumber || '',
          preservative: sample.preservative,
          samplingTime: sample.samplingTime.toLocaleString('zh-CN'),
          sampler: sample.sampler,
          status: sample.status,
          testCount: sample.TestItems.length,
          abnormalCount: sample.TestItems.filter(t => t.isAbnormal).length,
          lastOperator: lastFlow?.operator || '',
          lastOperationTime: lastFlow?.operationTime.toLocaleString('zh-CN') || ''
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=采样送检报告_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAuditLogs(req, res) {
    try {
      const { entityType, entityId } = req.query;
      const where = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;

      const logs = await AuditLog.findAll({
        where,
        order: [['operationTime', 'DESC']]
      });

      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSamplingPoints(req, res) {
    try {
      const points = await SamplingPoint.findAll({ where: { isActive: true } });
      res.json({ success: true, data: points });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSampleBottles(req, res) {
    try {
      const { status } = req.query;
      const where = {};
      if (status) where.status = status;

      const bottles = await SampleBottle.findAll({ where });
      res.json({ success: true, data: bottles });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = SampleController;
