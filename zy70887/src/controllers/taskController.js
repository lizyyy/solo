const Task = require('../models/Task');
const Material = require('../models/Material');
const AuditLog = require('../models/AuditLog');
const Permission = require('../models/Permission');

exports.submitTask = async (req, res) => {
  try {
    const { submitter_id, stamp_type, materials } = req.body;

    if (!submitter_id || !stamp_type || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'submitter_id, stamp_type 和 materials 数组为必填项'
      });
    }

    const permissionCheck = await Permission.canPerformStampAction(submitter_id, stamp_type);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: '权限不足',
        message: permissionCheck.reason
      });
    }

    const batchHash = Task.generateBatchHash(materials);
    const existingTask = await Task.findByBatchHash(batchHash);

    if (existingTask) {
      const fullTrace = await Task.getFullTrace(existingTask.id);
      return res.status(200).json({
        success: true,
        is_duplicate: true,
        message: '检测到重复提交，返回已存在的任务',
        data: fullTrace
      });
    }

    const task = await Task.create(submitter_id, stamp_type, materials, batchHash);
    await Material.bulkCreate(task.id, materials);

    await AuditLog.create({
      taskId: task.id,
      operatorId: submitter_id,
      action: 'create_task',
      reason: '提交新的盖章任务'
    });

    const validationSummary = await Material.getValidationSummary(task.id);

    if (validationSummary.invalid > 0) {
      await Task.updateStatus(task.id, 'failed', validationSummary.errors);
    } else {
      await Task.updateStatus(task.id, 'processing');
    }

    const fullTrace = await Task.getFullTrace(task.id);

    res.status(201).json({
      success: true,
      is_duplicate: false,
      message: validationSummary.invalid > 0 ? '任务提交成功，但存在验证错误' : '任务提交成功',
      validation: validationSummary,
      data: fullTrace
    });
  } catch (error) {
    console.error('提交任务失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const fullTrace = await Task.getFullTrace(taskId);

    if (!fullTrace) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
        message: `未找到 ID 为 ${taskId} 的任务`
      });
    }

    res.json({
      success: true,
      data: fullTrace
    });
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.listTasks = async (req, res) => {
  try {
    const { status, stamp_type, submitter_id, page = 1, page_size = 20 } = req.query;

    const filters = {
      status,
      stampType: stamp_type,
      submitterId: submitter_id
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await Task.list(filters, parseInt(page), parseInt(page_size));

    res.json({
      success: true,
      data: result.tasks,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, operator_id, reason } = req.body;

    if (!status || !operator_id) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'status 和 operator_id 为必填项'
      });
    }

    const validStatuses = ['pending', 'processing', 'failed', 'manual_confirm', 'exported'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值',
        message: `状态必须是以下值之一: ${validStatuses.join(', ')}`
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

    if (status === 'exported') {
      const hasExportPermission = await Permission.checkPermission(operator_id, 'export');
      if (!hasExportPermission) {
        return res.status(403).json({
          success: false,
          error: '权限不足',
          message: '没有导出权限'
        });
      }
      await Task.markAsExported(taskId);
    } else {
      await Task.updateStatus(taskId, status);
    }

    await AuditLog.create({
      taskId,
      operatorId: operator_id,
      action: 'update_task_status',
      fieldName: 'status',
      oldValue: task.status,
      newValue: status,
      reason
    });

    const updatedTask = await Task.getFullTrace(taskId);

    res.json({
      success: true,
      message: '任务状态更新成功',
      data: updatedTask
    });
  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.sendToCourier = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { operator_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'operator_id 为必填项'
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

    const courierCheck = await Permission.canSendToCourier(operator_id, task.stamp_type);
    if (!courierCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: '越权申请',
        message: courierCheck.reason
      });
    }

    if (task.status !== 'exported') {
      return res.status(400).json({
        success: false,
        error: '状态错误',
        message: '只有已导出的任务才能进入快递寄送环节'
      });
    }

    await AuditLog.create({
      taskId,
      operatorId: operator_id,
      action: 'send_to_courier',
      reason: '任务进入快递寄送环节'
    });

    res.json({
      success: true,
      message: '任务已进入快递寄送环节',
      task_no: task.task_no
    });
  } catch (error) {
    console.error('发送到快递失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};
