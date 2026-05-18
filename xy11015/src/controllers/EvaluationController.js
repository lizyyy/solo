const Evaluation = require('../models/Evaluation');
const EvaluationStore = require('../stores/EvaluationStore');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const store = new EvaluationStore(path.join(__dirname, '../../data/evaluations.json'));

class EvaluationController {
  static async create(req, res) {
    try {
      const validation = Evaluation.validate(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: '数据验证失败',
          errors: validation.errors
        });
      }

      const existing = store.findByOrderNo(req.body.orderNo);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: '订单号已存在'
        });
      }

      const evaluation = store.create(req.body);
      res.status(201).json({
        success: true,
        data: evaluation.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const existing = store.findById(id);
      
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: '评价记录不存在'
        });
      }

      if (req.body.status && !Evaluation.STATUS_ENUMS.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: `状态值无效，必须是: ${Evaluation.STATUS_ENUMS.join(', ')}`
        });
      }

      const updated = store.update(id, req.body);
      res.json({
        success: true,
        data: updated.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const evaluation = store.findById(id);
      
      if (!evaluation) {
        return res.status(404).json({
          success: false,
          message: '评价记录不存在'
        });
      }

      res.json({
        success: true,
        data: evaluation.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async list(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        managerId: req.query.managerId,
        storeId: req.query.storeId,
        auntId: req.query.auntId,
        customerId: req.query.customerId,
        serviceType: req.query.serviceType
      };

      const evaluations = store.findByFilters(filters);
      
      res.json({
        success: true,
        total: evaluations.length,
        data: evaluations.map(e => e.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const result = store.delete(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '评价记录不存在'
        });
      }

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async batchImport(req, res) {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          message: 'items 必须是数组'
        });
      }

      const result = store.batchImport(items);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async export(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        managerId: req.query.managerId,
        storeId: req.query.storeId,
        auntId: req.query.auntId,
        customerId: req.query.customerId,
        serviceType: req.query.serviceType
      };

      const evaluations = store.findByFilters(filters);
      const exportDir = path.join(__dirname, '../../exports');
      
      if (!require('fs').existsSync(exportDir)) {
        require('fs').mkdirSync(exportDir, { recursive: true });
      }

      const fileName = `evaluations_${new Date().toISOString().slice(0, 10)}_${Date.now()}.csv`;
      const filePath = path.join(exportDir, fileName);

      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: 'orderNo', title: '订单号' },
          { id: 'storeName', title: '门店' },
          { id: 'managerName', title: '负责人' },
          { id: 'auntName', title: '阿姨姓名' },
          { id: 'auntPhone', title: '阿姨电话' },
          { id: 'customerName', title: '客户姓名' },
          { id: 'customerPhone', title: '客户电话' },
          { id: 'customerAddress', title: '客户地址' },
          { id: 'serviceType', title: '服务类型' },
          { id: 'trialDate', title: '试工日期' },
          { id: 'trialDuration', title: '试工时长(小时)' },
          { id: 'status', title: '状态' },
          { id: 'overallRating', title: '总体评价' },
          { id: 'cleanlinessRating', title: '清洁度评分' },
          { id: 'attitudeRating', title: '服务态度评分' },
          { id: 'punctualityRating', title: '守时评分' },
          { id: 'skillRating', title: '技能评分' },
          { id: 'comment', title: '评价内容' },
          { id: 'negativeTags', title: '负面标签' },
          { id: 'positiveTags', title: '正面标签' },
          { id: 'wouldRecommend', title: '是否推荐' },
          { id: 'returnVisitRequired', title: '是否需要回访' },
          { id: 'returnVisitSummary', title: '回访摘要' },
          { id: 'returnVisitDate', title: '回访日期' },
          { id: 'returnVisitPerson', title: '回访人' },
          { id: 'createdAt', title: '创建时间' }
        ]
      });

      const records = evaluations.map(e => ({
        ...e.toJSON(),
        negativeTags: e.negativeTags.join(', '),
        positiveTags: e.positiveTags.join(', ')
      }));

      await csvWriter.writeRecords(records);

      res.json({
        success: true,
        message: '导出成功',
        fileName,
        filePath,
        count: evaluations.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static getEnums(req, res) {
    res.json({
      success: true,
      data: {
        statuses: Evaluation.STATUS_ENUMS,
        ratings: Evaluation.RATING_ENUMS,
        serviceTypes: Evaluation.SERVICE_TYPES
      }
    });
  }
}

module.exports = EvaluationController;
