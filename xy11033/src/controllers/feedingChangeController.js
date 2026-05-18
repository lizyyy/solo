const feedingChangeService = require('../services/feedingChangeService');
const stateMachine = require('../services/stateMachine');
const businessRules = require('../services/businessRules');
const { getAllValidTransitions } = require('../services/stateMachine');

async function createFeedingChange(req, res) {
  try {
    const result = await feedingChangeService.createFeedingChange(req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: result.recordType === 'abnormal' ? '变更创建成功，检测到异常' : '变更创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}

async function getFeedingChange(req, res) {
  try {
    const change = await feedingChangeService.getFeedingChangeById(req.params.id);
    if (!change) {
      return res.status(404).json({
        success: false,
        error: '未找到变更记录'
      });
    }
    res.json({ success: true, data: change });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function listFeedingChanges(req, res) {
  try {
    const changes = await feedingChangeService.getFeedingChanges(req.query);
    res.json({ success: true, data: changes, count: changes.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function getNormalRecords(req, res) {
  try {
    const records = await feedingChangeService.getNormalRecords();
    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function getAbnormalRecords(req, res) {
  try {
    const records = await feedingChangeService.getAbnormalRecords();
    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function performAction(req, res) {
  try {
    const { id } = req.params;
    const { action, operator, comment } = req.body;

    if (!action || !operator) {
      return res.status(400).json({
        success: false,
        error: 'action 和 operator 为必填参数'
      });
    }

    const result = await stateMachine.transitionStatus(id, action, operator, comment);
    res.json({
      success: true,
      data: result,
      message: `状态变更成功: ${result.fromStatus} → ${result.toStatus}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}

function getStatusTransitions(req, res) {
  try {
    const transitions = getAllValidTransitions();
    res.json({ success: true, data: transitions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function checkCanPerformAction(req, res) {
  try {
    const { id, action } = req.params;
    const change = await feedingChangeService.getFeedingChangeById(id);
    
    if (!change) {
      return res.status(404).json({
        success: false,
        error: '未找到变更记录'
      });
    }

    const result = stateMachine.canPerformAction(change.status, action);
    res.json({ success: true, data: { ...result, currentStatus: change.status } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function getStatusLogs(req, res) {
  try {
    const logs = await feedingChangeService.getStatusLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function checkInventoryConflict(req, res) {
  try {
    const { brand, type, amount } = req.query;
    const result = await businessRules.checkInventoryConflict(brand, type, parseFloat(amount) || 1);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

async function checkReportConsistency(req, res) {
  try {
    const { foster_order_id, report_date, expected_brand, expected_type } = req.query;
    const result = await businessRules.checkDailyReportConsistency(
      foster_order_id,
      report_date,
      expected_brand,
      expected_type
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

module.exports = {
  createFeedingChange,
  getFeedingChange,
  listFeedingChanges,
  getNormalRecords,
  getAbnormalRecords,
  performAction,
  getStatusTransitions,
  checkCanPerformAction,
  getStatusLogs,
  checkInventoryConflict,
  checkReportConsistency
};
