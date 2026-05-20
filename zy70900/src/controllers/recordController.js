const recordService = require('../services/recordService');
const exportService = require('../services/exportService');

async function processRecord(req, res) {
  try {
    const { id } = req.params;
    const { operator, reason, remark } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人不能为空'
      });
    }

    const result = await recordService.processRecord(id, operator, reason, remark);

    res.json({
      success: true,
      data: result,
      message: result.hasException ? '记录已放行（存在异常，已记录异常信息）' : '记录已放行'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '处理失败: ' + error.message
    });
  }
}

async function returnRecord(req, res) {
  try {
    const { id } = req.params;
    const { operator, reason, remark } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人不能为空'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '退回原因不能为空'
      });
    }

    const result = await recordService.returnRecord(id, operator, reason, remark);

    res.json({
      success: true,
      data: result,
      message: '记录已退回'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '退回失败: ' + error.message
    });
  }
}

async function requestSupplement(req, res) {
  try {
    const { id } = req.params;
    const { operator, reason, remark } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人不能为空'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '补材料原因不能为空'
      });
    }

    const result = await recordService.requestSupplement(id, operator, reason, remark);

    res.json({
      success: true,
      data: result,
      message: '已要求补材料'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '操作失败: ' + error.message
    });
  }
}

async function queryRecords(req, res) {
  try {
    const filters = {
      cableCarNo: req.query.cableCarNo,
      inspectionItem: req.query.inspectionItem,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit
    };

    const records = await recordService.queryRecords(filters);

    res.json({
      success: true,
      data: records,
      count: records.length,
      message: '查询成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败: ' + error.message
    });
  }
}

async function getRecordDetail(req, res) {
  try {
    const { id } = req.params;

    const record = await recordService.getRecordById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    const trace = await recordService.getRecordTrace(id);
    const exceptions = await recordService.getExceptions(id);

    res.json({
      success: true,
      data: {
        record,
        trace,
        exceptions
      },
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取失败: ' + error.message
    });
  }
}

async function getRecordTrace(req, res) {
  try {
    const { id } = req.params;

    const trace = await recordService.getRecordTrace(id);

    res.json({
      success: true,
      data: trace,
      count: trace.length,
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取失败: ' + error.message
    });
  }
}

async function getOperatorLogs(req, res) {
  try {
    const { operator } = req.params;
    const limit = req.query.limit || 100;

    const logs = await recordService.getOperationLogByOperator(operator, limit);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
      message: '查询成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败: ' + error.message
    });
  }
}

async function exportRecords(req, res) {
  try {
    const filters = {
      cableCarNo: req.query.cableCarNo,
      inspectionItem: req.query.inspectionItem,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await exportService.exportToCSV(filters);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inspection_records_${Date.now()}.csv"`);
    
    res.send('\uFEFF' + result.csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
}

async function exportRecordDetail(req, res) {
  try {
    const { id } = req.params;

    const result = await exportService.exportRecordDetail(id);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="record_${id}_detail.txt"`);
    
    res.send(result.content);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
}

async function exportOperatorLogs(req, res) {
  try {
    const { operator } = req.params;

    const result = await exportService.exportOperationLogsByOperator(operator);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="operator_${operator}_logs.csv"`);
    
    res.send('\uFEFF' + result.csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
}

module.exports = {
  processRecord,
  returnRecord,
  requestSupplement,
  queryRecords,
  getRecordDetail,
  getRecordTrace,
  getOperatorLogs,
  exportRecords,
  exportRecordDetail,
  exportOperatorLogs
};
