const express = require('express');
const router = express.Router();
const RectificationModel = require('../models/rectification');
const { v4: uuidv4 } = require('uuid');

router.post('/import', async (req, res) => {
  const model = new RectificationModel();
  
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: '导入数据不能为空，请提供有效的整改项数组',
        suggestion: '请检查请求体格式，确保包含items字段且为非空数组'
      });
    }

    const batchId = uuidv4();
    const results = await model.importItems(batchId, items);

    res.json({
      success: true,
      batchId,
      summary: {
        total: items.length,
        success: results.success.length,
        errors: results.errors.length,
        conflicts: results.conflicts.length
      },
      data: {
        success: results.success.map(item => ({
          row: item.row,
          itemId: item.itemId,
          storeName: item.data.store_name,
          problemCategory: item.data.problem_category,
          problemDescription: item.data.problem_description.substring(0, 30) + '...',
          deadline: item.data.deadline
        })),
        errors: results.errors.map(err => ({
          row: err.row,
          originalData: err.originalData,
          errorDetails: err.errors.map(e => ({
            field: e.field,
            reason: e.reason,
            suggestion: e.suggestion
          }))
        })),
        conflicts: results.conflicts.map(conf => ({
          row: conf.row,
          itemId: conf.itemId,
          conflictType: conf.conflictType,
          conflictDetail: conf.conflictDetail,
          suggestion: conf.suggestion,
          originalData: conf.originalData
        }))
      }
    });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({
      success: false,
      error: '导入处理失败',
      detail: error.message
    });
  } finally {
    await model.close();
  }
});

router.get('/import-errors/:batchId', async (req, res) => {
  const model = new RectificationModel();
  
  try {
    const { batchId } = req.params;
    const errors = await model.getImportErrors(batchId);

    res.json({
      success: true,
      batchId,
      total: errors.length,
      data: errors.map(err => ({
        errorId: err.error_id,
        rowNumber: err.row_number,
        originalData: JSON.parse(err.original_data),
        errorReason: err.error_reason,
        suggestion: err.suggestion,
        errorType: err.error_type,
        resolved: err.resolved === 1
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await model.close();
  }
});

router.post('/resolve-conflict', async (req, res) => {
  const model = new RectificationModel();
  
  try {
    const { itemId, operatorId, operatorName, remark } = req.body;

    if (!itemId || !operatorId || !operatorName || !remark) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
        required: ['itemId', 'operatorId', 'operatorName', 'remark']
      });
    }

    const result = await model.resolveConflict(itemId, operatorId, operatorName, remark);

    res.json({
      success: true,
      message: '冲突已人工确认解决，可以继续推进整改流程',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  } finally {
    await model.close();
  }
});

router.post('/update-status', async (req, res) => {
  const model = new RectificationModel();
  
  try {
    const { itemId, newStatus, operatorId, operatorName, remark } = req.body;

    if (!itemId || !newStatus || !operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
        required: ['itemId', 'newStatus', 'operatorId', 'operatorName']
      });
    }

    const validStatuses = ['pending', 'rectifying', 'submitted', 'approved', 'rejected', 'closed'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `无效的状态值: ${newStatus}`,
        validStatuses
      });
    }

    const result = await model.updateStatusWithRemark(
      itemId, newStatus, operatorId, operatorName, remark || '状态变更'
    );

    res.json({
      success: true,
      message: `状态已从${result.previousStatus}更新为${result.newStatus}`,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      suggestion: '请检查状态流转是否符合规则'
    });
  } finally {
    await model.close();
  }
});

router.get('/item/:itemId', async (req, res) => {
  const model = new RectificationModel();
  
  try {
    const { itemId } = req.params;
    const item = await model.getItemDetails(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: '整改项不存在'
      });
    }

    res.json({
      success: true,
      data: {
        itemId: item.item_id,
        inspectionId: item.inspection_id,
        storeInfo: {
          storeId: item.store_id,
          storeName: item.store_name
        },
        problem: {
          category: item.problem_category,
          type: item.problem_type,
          description: item.problem_description,
          location: item.problem_location,
          photoUrl: item.photo_url
        },
        requirement: item.requirement,
        deadline: item.deadline,
        responsiblePerson: item.responsible_person,
        status: item.status,
        isConflict: item.is_conflict === 1,
        conflictType: item.conflict_type,
        remarks: item.remarks.map(r => ({
          operator: r.operator_name,
          operation: r.operation_type,
          remark: r.remark,
          statusChange: r.previous_status ? `${r.previous_status} → ${r.new_status}` : null,
          time: r.created_at
        })),
        rectificationRecords: item.records.map(r => ({
          date: r.rectify_date,
          description: r.rectify_description,
          person: r.rectify_person,
          status: r.status,
          auditor: r.auditor_name,
          auditRemark: r.audit_remark
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await model.close();
  }
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: '便利店加盟督导巡店整改API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;