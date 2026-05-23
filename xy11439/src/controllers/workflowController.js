const { submitRecord, rejectRecord, confirmRecord, auditRecord } = require('../utils/workflow');
const { getOrderCalendarById, updateOrderCalendar } = require('../models/orderCalendar');
const { getCleaningMessageById, updateCleaningMessage } = require('../models/cleaningMessage');
const { getMaintenanceNoteById, updateMaintenanceNote } = require('../models/maintenanceNote');
const config = require('../config');

const tableModels = {
  order_calendars: {
    getById: getOrderCalendarById,
    update: updateOrderCalendar,
  },
  cleaning_messages: {
    getById: getCleaningMessageById,
    update: updateCleaningMessage,
  },
  maintenance_notes: {
    getById: getMaintenanceNoteById,
    update: updateMaintenanceNote,
  },
};

function submit(req, res) {
  try {
    const { table_name, record_id, remark } = req.body;
    const model = tableModels[table_name];
    
    if (!model) {
      return res.status(400).json({ success: false, error: '无效的表名' });
    }

    const record = model.getById(record_id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    submitRecord(table_name, record_id, record.workflow_status, req.user, remark);
    model.update(record_id, { workflow_status: config.workflow.SUBMITTED }, req.user, remark || '提交审核');

    res.json({ success: true, message: '提交成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function reject(req, res) {
  try {
    const { table_name, record_id, remark } = req.body;
    const model = tableModels[table_name];
    
    if (!model) {
      return res.status(400).json({ success: false, error: '无效的表名' });
    }

    const record = model.getById(record_id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    rejectRecord(table_name, record_id, record.workflow_status, req.user, remark);
    model.update(record_id, { workflow_status: config.workflow.REJECTED }, req.user, remark || '驳回');

    res.json({ success: true, message: '驳回成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function confirm(req, res) {
  try {
    const { table_name, record_id, remark } = req.body;
    const model = tableModels[table_name];
    
    if (!model) {
      return res.status(400).json({ success: false, error: '无效的表名' });
    }

    const record = model.getById(record_id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    confirmRecord(table_name, record_id, record.workflow_status, req.user, remark);
    model.update(record_id, { workflow_status: config.workflow.CONFIRMED }, req.user, remark || '二次确认');

    res.json({ success: true, message: '确认成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function audit(req, res) {
  try {
    const { table_name, record_id, remark } = req.body;
    const model = tableModels[table_name];
    
    if (!model) {
      return res.status(400).json({ success: false, error: '无效的表名' });
    }

    const record = model.getById(record_id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    auditRecord(table_name, record_id, record.workflow_status, req.user, remark);
    model.update(record_id, { workflow_status: config.workflow.AUDITED }, req.user, remark || '审计通过');

    res.json({ success: true, message: '审计成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  submit,
  reject,
  confirm,
  audit,
};
