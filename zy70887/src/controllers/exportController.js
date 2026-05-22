const ExportReport = require('../models/ExportReport');
const Task = require('../models/Task');
const Permission = require('../models/Permission');

exports.exportTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { exporter_id } = req.body;

    if (!exporter_id) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'exporter_id 为必填项'
      });
    }

    const hasExportPermission = await Permission.checkPermission(exporter_id, 'export');
    if (!hasExportPermission) {
      return res.status(403).json({
        success: false,
        error: '权限不足',
        message: '没有导出权限'
      });
    }

    const task = await Task.getById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        message: `未找到 ID 为 ${taskId} 的任务`
      });
    }

    if (task.status === 'exported') {
      const existingReport = await ExportReport.getByTaskId(taskId);
      return res.status(200).json({
        success: true,
        is_already_exported: true,
        message: '任务已导出，返回已有报告',
        data: existingReport
      });
    }

    const validStatuses = ['processing', 'manual_confirm'];
    if (!validStatuses.includes(task.status)) {
      return res.status(400).json({
        success: false,
        error: '状态错误',
        message: `只有处理中或人工确认状态的任务才能导出，当前状态: ${task.status}`
      });
    }

    const report = await ExportReport.create(taskId, exporter_id);

    res.status(201).json({
      success: true,
      is_already_exported: false,
      message: '任务报告导出成功',
      data: report
    });
  } catch (error) {
    console.error('导出任务报告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getReportByTaskId = async (req, res) => {
  try {
    const { taskId } = req.params;
    const report = await ExportReport.getByTaskId(taskId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在',
        message: `未找到任务 ID 为 ${taskId} 的导出报告`
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('获取导出报告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getReportByReportNo = async (req, res) => {
  try {
    const { reportNo } = req.params;
    const report = await ExportReport.getByReportNo(reportNo);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在',
        message: `未找到报告编号为 ${reportNo} 的导出报告`
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('获取导出报告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getReportFullTrace = async (req, res) => {
  try {
    const { reportId } = req.params;
    const trace = await ExportReport.getFullTrace(reportId);

    if (!trace) {
      return res.status(404).json({
        success: false,
        error: '报告不存在',
        message: `未找到 ID 为 ${reportId} 的导出报告`
      });
    }

    res.json({
      success: true,
      data: trace
    });
  } catch (error) {
    console.error('获取报告完整追溯失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.listReports = async (req, res) => {
  try {
    const { stamp_type, exporter_id, page = 1, page_size = 20 } = req.query;

    const filters = {
      stamp_type,
      exporter_id
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await ExportReport.list(filters, parseInt(page), parseInt(page_size));

    res.json({
      success: true,
      data: result.reports,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取导出报告列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};
