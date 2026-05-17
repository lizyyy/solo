const { Parser } = require('json2csv');
const appealService = require('../services/appealService');
const { getDbInstance } = require('../database');

const getDb = () => getDbInstance();

const createAppeal = async (req, res) => {
  try {
    const result = await appealService.createAppeal(getDb(), req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getAppeal = async (req, res) => {
  try {
    const { id, appeal_no } = req.params;
    let appeal;
    if (id) {
      appeal = await appealService.getAppealById(getDb(), id);
    } else if (appeal_no) {
      appeal = await appealService.getAppealByNo(getDb(), appeal_no);
    }
    
    if (!appeal) {
      return res.status(404).json({ success: false, error: '申诉记录不存在' });
    }
    res.json({ success: true, data: appeal });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const queryAppeals = async (req, res) => {
  try {
    const result = await appealService.queryAppeals(getDb(), req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { to_status, ...data } = req.body;
    const result = await appealService.updateStatus(getDb(), parseInt(id), to_status, data);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const createTempRestore = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await appealService.createTempRestore(getDb(), parseInt(id), req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const processConclusion = async (req, res) => {
  try {
    const { id } = req.params;
    const { conclusion, ...data } = req.body;
    const result = await appealService.processConclusion(getDb(), parseInt(id), conclusion, data);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const manualCorrect = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await appealService.manualCorrect(getDb(), parseInt(id), req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await appealService.getStatusHistory(getDb(), parseInt(id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getExceptions = async (req, res) => {
  try {
    const { appeal_id } = req.query;
    const result = await appealService.getExceptions(getDb(), appeal_id ? parseInt(appeal_id) : null);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getTempRestore = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await appealService.getTempRestore(getDb(), parseInt(id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const checkExpiredTempRestore = async (req, res) => {
  try {
    const result = await appealService.checkExpiredTempRestore(getDb());
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const resolveException = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await appealService.resolveException(getDb(), parseInt(id), req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const exportAppeals = async (req, res) => {
  try {
    const appeals = await appealService.queryAppeals(getDb(), req.query);
    
    const fields = [
      'appeal_no', 'employee_id', 'employee_name', 'data_scope',
      'revoke_reason', 'appeal_material', 'current_status',
      'conclusion', 'handler_name', 'created_at', 'updated_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(appeals);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appeals_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const db = getDb();
    const allAppeals = await appealService.queryAppeals(db);
    
    const stats = {
      total: allAppeals.length,
      status_distribution: {},
      temp_restore_active: 0,
      exceptions_total: 0,
      exceptions_unresolved: 0
    };
    
    for (const appeal of allAppeals) {
      stats.status_distribution[appeal.current_status] = 
        (stats.status_distribution[appeal.current_status] || 0) + 1;
      if (appeal.current_status === 'TEMP_RESTORED') {
        stats.temp_restore_active++;
      }
    }
    
    const exceptions = await appealService.getExceptions(db);
    stats.exceptions_total = exceptions.length;
    stats.exceptions_unresolved = exceptions.filter(e => e.is_resolved === 0).length;
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = {
  createAppeal,
  getAppeal,
  queryAppeals,
  updateStatus,
  createTempRestore,
  processConclusion,
  manualCorrect,
  getStatusHistory,
  getExceptions,
  getTempRestore,
  checkExpiredTempRestore,
  resolveException,
  exportAppeals,
  getStats
};
