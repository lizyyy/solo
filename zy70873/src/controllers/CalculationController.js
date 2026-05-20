const FileParserService = require('../services/FileParserService');
const SubsidyCalculatorService = require('../services/SubsidyCalculatorService');
const batchService = require('../services/BatchService');

class CalculationController {
  static async calculate(req, res) {
    try {
      const files = req.files || [];
      
      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请上传至少一个文件'
        });
      }

      const parsedData = await FileParserService.parseUploadedFiles(files);

      if (parsedData.errors.length > 0 && parsedData.showtimes.length === 0) {
        return res.status(400).json({
          success: false,
          message: '文件解析失败',
          errors: parsedData.errors
        });
      }

      const { showtimes, boxOffices, contractRules } = parsedData;

      if (showtimes.length === 0) {
        return res.status(400).json({
          success: false,
          message: '未找到有效的场次数据，请检查CSV文件格式'
        });
      }

      const duplicateCheck = batchService.checkDuplicate(showtimes, boxOffices, contractRules);
      if (duplicateCheck.isDuplicate) {
        return res.status(409).json({
          success: false,
          message: duplicateCheck.message,
          duplicateInfo: {
            batchId: duplicateCheck.existingBatch.batchId,
            processedAt: duplicateCheck.existingBatch.processedAt,
            resultId: duplicateCheck.existingBatch.resultId
          }
        });
      }

      const batchId = batchService.generateBatchId(files);
      
      showtimes.forEach(s => s.batchId = batchId);
      boxOffices.forEach(b => b.batchId = batchId);
      contractRules.forEach(r => r.batchId = batchId);

      const calculator = new SubsidyCalculatorService();
      const result = calculator.calculate(showtimes, boxOffices, contractRules, batchId);

      batchService.registerBatch(batchId, showtimes, boxOffices, contractRules, result);
      batchService.saveBatchResult(batchId, result);

      for (const file of files) {
        FileParserService.deleteFile(file.path);
      }

      res.json({
        success: true,
        batchId: batchId,
        resultId: result.id,
        summary: result.summary,
        warnings: parsedData.errors,
        counts: {
          showtimes: showtimes.length,
          boxOffices: boxOffices.length,
          contractRules: contractRules.length
        },
        result: result.toJSON()
      });
    } catch (error) {
      console.error('核算失败:', error);
      res.status(500).json({
        success: false,
        message: '核算处理失败',
        error: error.message
      });
    }
  }

  static getBatchResult(req, res) {
    try {
      const { batchId } = req.params;
      const result = batchService.loadBatchResult(batchId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: '未找到该批次的核算结果'
        });
      }

      res.json({
        success: true,
        batchId: batchId,
        result: result
      });
    } catch (error) {
      console.error('获取批次结果失败:', error);
      res.status(500).json({
        success: false,
        message: '获取批次结果失败',
        error: error.message
      });
    }
  }

  static getBatchSummary(req, res) {
    try {
      const { batchId } = req.params;
      const batch = batchService.getBatch(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '未找到该批次记录'
        });
      }

      res.json({
        success: true,
        batch: batch
      });
    } catch (error) {
      console.error('获取批次摘要失败:', error);
      res.status(500).json({
        success: false,
        message: '获取批次摘要失败',
        error: error.message
      });
    }
  }

  static getAllBatches(req, res) {
    try {
      const batches = batchService.getAllBatches();
      res.json({
        success: true,
        total: batches.length,
        batches: batches
      });
    } catch (error) {
      console.error('获取批次列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取批次列表失败',
        error: error.message
      });
    }
  }

  static getTraceItem(req, res) {
    try {
      const { batchId, traceId } = req.params;
      const item = batchService.getTraceItem(batchId, traceId);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: '未找到该追踪记录'
        });
      }

      res.json({
        success: true,
        batchId: batchId,
        traceId: traceId,
        item: item
      });
    } catch (error) {
      console.error('获取追踪记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取追踪记录失败',
        error: error.message
      });
    }
  }

  static getResultByStatus(req, res) {
    try {
      const { batchId, status } = req.params;
      const result = batchService.loadBatchResult(batchId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: '未找到该批次的核算结果'
        });
      }

      let items = [];
      switch (status.toLowerCase()) {
        case 'normal':
          items = result.normalItems || [];
          break;
        case 'pending':
          items = result.pendingItems || [];
          break;
        case 'failed':
          items = result.failedItems || [];
          break;
        default:
          return res.status(400).json({
            success: false,
            message: '无效的状态类型，可选值: normal, pending, failed'
          });
      }

      res.json({
        success: true,
        batchId: batchId,
        status: status,
        count: items.length,
        items: items
      });
    } catch (error) {
      console.error('获取分类结果失败:', error);
      res.status(500).json({
        success: false,
        message: '获取分类结果失败',
        error: error.message
      });
    }
  }
}

module.exports = CalculationController;
