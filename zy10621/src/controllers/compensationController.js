const compensationService = require('../services/compensationService');
const { exportToCsv } = require('../services/importExportService');

async function createRecord(req, res) {
  try {
    const result = await compensationService.createRecord(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: result.errors
      });
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function getRecords(req, res) {
  try {
    const result = await compensationService.getRecords(req.query);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function getRecord(req, res) {
  try {
    const record = await compensationService.getRecordDetail(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function getHistory(req, res) {
  try {
    const history = await compensationService.getRecordHistory(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function requestRelease(req, res) {
  try {
    const result = await compensationService.requestRelease(
      req.params.id,
      req.body,
      req.body.changedBy
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function approveRelease(req, res) {
  try {
    const result = await compensationService.approveRelease(
      req.params.id,
      req.body.approvedBy
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function startCompensation(req, res) {
  try {
    const result = await compensationService.startCompensation(
      req.params.id,
      req.body.compensationAmount,
      req.body.approvedBy
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function completeCompensation(req, res) {
  try {
    const result = await compensationService.completeCompensation(
      req.params.id,
      req.body.approvedBy
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function rejectRecord(req, res) {
  try {
    const result = await compensationService.rejectRecord(
      req.params.id,
      req.body.reason,
      req.body.rejectedBy
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function checkConflicts(req, res) {
  try {
    const { roomId, startTime, endTime } = req.query;
    const result = await compensationService.checkConflicts(
      parseInt(roomId),
      new Date(startTime),
      new Date(endTime),
      req.query.excludeRecordId ? parseInt(req.query.excludeRecordId) : null
    );
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function exportRecords(req, res) {
  try {
    const filePath = req.body.filePath || `./export_${Date.now()}.csv`;
    const result = await exportToCsv(filePath, req.query);
    res.json({
      success: true,
      message: `导出成功，共导出 ${result.count} 条记录`,
      filePath: result.filePath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  createRecord,
  getRecords,
  getRecord,
  getHistory,
  requestRelease,
  approveRelease,
  startCompensation,
  completeCompensation,
  rejectRecord,
  checkConflicts,
  exportRecords
};
