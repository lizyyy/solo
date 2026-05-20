const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res) => {
  try {
    const { task_id, material_id, operator_id, action, page = 1, page_size = 20 } = req.query;

    const filters = {
      taskId: task_id,
      materialId: material_id,
      operatorId: operator_id,
      action
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await AuditLog.list(filters, parseInt(page), parseInt(page_size));

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getTaskAuditLogs = async (req, res) => {
  try {
    const { taskId } = req.params;
    const logs = await AuditLog.getByTaskId(taskId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取任务审计日志失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getMaterialAuditLogs = async (req, res) => {
  try {
    const { materialId } = req.params;
    const logs = await AuditLog.getByMaterialId(materialId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取材料审计日志失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getMaterialModificationHistory = async (req, res) => {
  try {
    const { materialId } = req.params;
    const history = await AuditLog.getModificationHistory(materialId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取材料修改历史失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};
