const Material = require('../models/Material');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');

exports.getTaskMaterials = async (req, res) => {
  try {
    const { taskId } = req.params;
    const materials = await Material.getByTaskId(taskId);

    const parsedMaterials = materials.map(m => ({
      ...m,
      raw_data: JSON.parse(m.raw_data),
      validation_errors: JSON.parse(m.validation_errors || '[]')
    }));

    res.json({
      success: true,
      data: parsedMaterials
    });
  } catch (error) {
    console.error('获取任务材料失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const material = await Material.getById(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: '材料不存在',
        message: `未找到 ID 为 ${materialId} 的材料`
      });
    }

    const parsedMaterial = {
      ...material,
      raw_data: JSON.parse(material.raw_data),
      validation_errors: JSON.parse(material.validation_errors || '[]')
    };

    const history = await AuditLog.getModificationHistory(materialId);

    res.json({
      success: true,
      data: parsedMaterial,
      modification_history: history
    });
  } catch (error) {
    console.error('获取材料失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { updates, operator_id, reason } = req.body;

    if (!updates || !operator_id) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'updates 和 operator_id 为必填项'
      });
    }

    const material = await Material.getById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '材料不存在',
        message: `未找到 ID 为 ${materialId} 的材料`
      });
    }

    const updatedMaterial = await Material.update(materialId, updates, operator_id, reason);

    const parsedMaterial = {
      ...updatedMaterial,
      raw_data: JSON.parse(updatedMaterial.raw_data),
      validation_errors: JSON.parse(updatedMaterial.validation_errors || '[]')
    };

    res.json({
      success: true,
      message: '材料更新成功',
      data: parsedMaterial
    });
  } catch (error) {
    console.error('更新材料失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.getValidationSummary = async (req, res) => {
  try {
    const { taskId } = req.params;
    const summary = await Material.getValidationSummary(taskId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取验证摘要失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};

exports.revalidateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { operator_id, reason } = req.body;

    if (!operator_id) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
        message: 'operator_id 为必填项'
      });
    }

    const material = await Material.getById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '材料不存在',
        message: `未找到 ID 为 ${materialId} 的材料`
      });
    }

    const rawData = JSON.parse(material.raw_data);
    const validation = Material.validate(rawData, material.material_index);

    const updates = {
      status: validation.isValid ? 'valid' : 'invalid',
      validation_errors: JSON.stringify(validation.errors)
    };

    await Material.update(materialId, updates, operator_id, reason || '重新验证材料');

    const updatedMaterial = await Material.getById(materialId);

    const task = await Task.getById(material.task_id);
    const validationSummary = await Material.getValidationSummary(material.task_id);
    
    if (validationSummary.invalid === 0 && task.status === 'failed') {
      await Task.updateStatus(task.id, 'processing');
      await AuditLog.create({
        taskId: task.id,
        materialId,
        operatorId: operator_id,
        action: 'auto_update_task_status',
        fieldName: 'status',
        oldValue: 'failed',
        newValue: 'processing',
        reason: '所有材料验证通过，自动恢复处理状态'
      });
    }

    res.json({
      success: true,
      message: validation.isValid ? '材料验证通过' : '材料仍存在验证错误',
      validation: validation,
      material_id: materialId
    });
  } catch (error) {
    console.error('重新验证材料失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误',
      message: error.message
    });
  }
};
