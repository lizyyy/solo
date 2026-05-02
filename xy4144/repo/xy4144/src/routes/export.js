const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');

/**
 * 导出 API
 * 支持导出 Markdown、CSV、JSON 格式的排班审计包
 */

/**
 * 导出为 JSON 格式
 */
router.get('/json', (req, res) => {
  try {
    const { status, line_id, start_time_from, start_time_to, include_versions, include_audit } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    if (include_versions) options.include_versions = include_versions === 'true';
    if (include_audit) options.include_audit = include_audit === 'true';
    
    const result = exportService.exportToJSON(options);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=blockade-plans-${Date.now()}.json`);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出为 CSV 格式
 */
router.get('/csv', (req, res) => {
  try {
    const { status, line_id, start_time_from, start_time_to } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    
    const csvContent = exportService.exportToCSV(options);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=blockade-plans-${Date.now()}.csv`);
    
    res.send('\uFEFF' + csvContent); // BOM 支持中文
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出为 Markdown 格式
 */
router.get('/markdown', (req, res) => {
  try {
    const { status, line_id, start_time_from, start_time_to, include_references } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    if (include_references !== undefined) options.include_references = include_references === 'true';
    
    const markdownContent = exportService.exportToMarkdown(options);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=blockade-audit-report-${Date.now()}.md`);
    
    res.send(markdownContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出完整排班审计包（包含所有格式）
 */
router.get('/package', (req, res) => {
  try {
    const { status, line_id, start_time_from, start_time_to, include_versions, include_audit, include_references } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    if (include_versions) options.include_versions = include_versions === 'true';
    if (include_audit) options.include_audit = include_audit === 'true';
    if (include_references !== undefined) options.include_references = include_references === 'true';
    
    const packageData = exportService.exportAuditPackage(options);
    
    res.json({
      success: true,
      data: packageData,
      message: `排班审计包导出成功，包含 ${packageData.formats.json.summary.total_plans} 条计划`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 按状态分组导出统计
 */
router.get('/statistics', (req, res) => {
  try {
    const { line_id, start_time_from, start_time_to } = req.query;
    
    const options = {};
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    
    const jsonData = exportService.exportToJSON(options);
    
    const statistics = {
      export_time: jsonData.export_time,
      summary: jsonData.summary,
      status_breakdown: jsonData.summary.by_status,
      line_breakdown: jsonData.summary.by_line,
      plans: jsonData.plans.map(p => ({
        id: p.id,
        plan_number: p.plan_number,
        status: p.status,
        work_type: p.work_type,
        start_time: p.start_time,
        end_time: p.end_time,
        applicant_name: p.applicant_name
      }))
    };
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 预览导出内容（不下载）
 */
router.get('/preview', (req, res) => {
  try {
    const { format = 'json', status, line_id, start_time_from, start_time_to } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (line_id) options.line_id = line_id;
    if (start_time_from) options.start_time_from = start_time_from;
    if (start_time_to) options.start_time_to = start_time_to;
    
    let result;
    switch (format.toLowerCase()) {
      case 'csv':
        result = {
          format: 'csv',
          preview: exportService.exportToCSV(options).substring(0, 2000) + '...'
        };
        break;
      case 'markdown':
      case 'md':
        result = {
          format: 'markdown',
          preview: exportService.exportToMarkdown(options)
        };
        break;
      default:
        result = exportService.exportToJSON(options);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
