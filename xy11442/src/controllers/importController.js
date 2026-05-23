const ImportService = require('../services/importService');
const logger = require('../config/logger');

class ImportController {
  static async uploadImport(req, res) {
    try {
      const { fileType, importedBy } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: '请上传文件' });
      }

      if (!fileType) {
        return res.status(400).json({ error: '请指定文件类型' });
      }

      const validTypes = ['delivery_note', 'weighing_record', 'basket_return'];
      if (!validTypes.includes(fileType)) {
        return res.status(400).json({ 
          error: '无效的文件类型', 
          validTypes 
        });
      }

      const { filePath, originalFileName } = ImportService.saveUploadedFile(file);
      
      const result = await ImportService.importFile(
        filePath, 
        originalFileName, 
        fileType, 
        importedBy
      );

      res.json({
        success: true,
        data: {
          batchId: result.batchId,
          isDuplicate: result.isDuplicate,
          message: result.message,
          successRows: result.successRows,
          failedRows: result.failedRows,
          totalRows: result.totalRows,
        },
      });
    } catch (error) {
      logger.error('导入失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getBatch(req, res) {
    try {
      const { batchId } = req.params;
      const batch = await ImportService.getBatchById(batchId);
      
      if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
      }

      res.json({ success: true, data: batch });
    } catch (error) {
      logger.error('获取批次失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listBatches(req, res) {
    try {
      const result = await ImportService.listBatches(req.query);
      res.json({
        success: true,
        data: {
          list: result.rows,
          total: result.count,
          page: parseInt(req.query.page) || 1,
          pageSize: parseInt(req.query.pageSize) || 20,
        },
      });
    } catch (error) {
      logger.error('获取批次列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ImportController;
