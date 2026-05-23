const renewalDao = require('../daos/renewalDao');
const renewalService = require('../services/renewalService');
const exportService = require('../services/exportService');

class RenewalController {
  async createPositionRequirement(req, res) {
    try {
      const reqResult = await renewalDao.createPositionRequirement(req.body);
      res.status(201).json({ success: true, data: reqResult });
    } catch (error) {
      await renewalService.saveProcessingException('createPositionRequirement', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getPositionRequirements(req, res) {
    try {
      const position = req.query.position;
      if (!position) {
        return res.status(400).json({ success: false, error: '请提供岗位参数' });
      }
      const requirements = await renewalDao.findPositionRequirements(position);
      res.json({ success: true, data: requirements });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async generateRenewalChecklist(req, res) {
    try {
      const { checklist_date } = req.body;
      if (!checklist_date) {
        return res.status(400).json({ success: false, error: '请提供检查日期' });
      }
      const checklists = await renewalService.generateRenewalChecklist(checklist_date);
      res.status(201).json({
        success: true,
        total: checklists.length,
        data: checklists,
        message: `成功生成 ${checklists.length} 条续期检查记录`
      });
    } catch (error) {
      await renewalService.saveProcessingException('generateRenewalChecklist', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getRenewalChecklists(req, res) {
    try {
      const checklists = await renewalDao.findRenewalChecklists(req.query);
      res.json({
        success: true,
        total: checklists.length,
        data: checklists
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateChecklistStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const changes = await renewalDao.updateRenewalChecklist(id, { status });
      if (changes === 0) {
        return res.status(404).json({ success: false, error: '检查记录不存在' });
      }
      res.json({ success: true, message: '状态已更新' });
    } catch (error) {
      await renewalService.saveProcessingException('updateChecklistStatus', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getProcessingExceptions(req, res) {
    try {
      const status = req.query.status;
      const exceptions = await renewalDao.findProcessingExceptions(status);
      res.json({
        success: true,
        total: exceptions.length,
        data: exceptions
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createManualCorrection(req, res) {
    try {
      const correction = await renewalService.manualCorrection(
        req.body.target_type,
        req.body.target_id,
        req.body.field_name,
        req.body.old_value,
        req.body.new_value,
        req.body.reason,
        req.body.operator
      );
      res.status(201).json({ success: true, data: correction });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getManualCorrections(req, res) {
    try {
      const corrections = await renewalDao.findManualCorrections(
        req.query.target_type,
        req.query.target_id
      );
      res.json({
        success: true,
        total: corrections.length,
        data: corrections
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportChecklistCSV(req, res) {
    try {
      const checklist_date = req.body.checklist_date;
      const result = await exportService.exportRenewalChecklistToCSV(checklist_date);
      res.json({
        success: true,
        message: `导出成功，共 ${result.recordCount} 条记录`,
        filename: result.filename,
        path: result.filePath
      });
    } catch (error) {
      await renewalService.saveProcessingException('exportChecklistCSV', req.body, error, { failed: true });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportChecklistJSON(req, res) {
    try {
      const checklist_date = req.body.checklist_date;
      const result = await exportService.exportRenewalChecklistToJSON(checklist_date);
      res.json({
        success: true,
        message: `导出成功，共 ${result.recordCount} 条记录`,
        filename: result.filename,
        path: result.filePath
      });
    } catch (error) {
      await renewalService.saveProcessingException('exportChecklistJSON', req.body, error, { failed: true });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getExportedFiles(req, res) {
    try {
      const files = exportService.getExportedFiles();
      res.json({
        success: true,
        total: files.length,
        data: files
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async triggerBadData(req, res) {
    try {
      const badData = { invalid_field: '这是坏数据测试' };
      await renewalService.createEmployeeCertificate(badData);
    } catch (error) {
      await renewalService.saveProcessingException('badDataTest', req.body, error, { 
        note: '这是故意触发的异常路径测试',
        success: false 
      });
      res.json({
        success: true,
        message: '异常路径已触发，原始输入和处理结果已保存到数据库',
        error_captured: error.message
      });
    }
  }
}

module.exports = new RenewalController();
