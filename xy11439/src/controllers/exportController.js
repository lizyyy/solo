const { getOrderCalendarList } = require('../models/orderCalendar');
const { getCleaningMessageList } = require('../models/cleaningMessage');
const { getMaintenanceNoteList } = require('../models/maintenanceNote');
const { detectConflicts } = require('../models/orderCalendar');
const { getFailedTasks } = require('../models/asyncTask');
const {
  exportOrdersToCsv,
  exportMessagesToCsv,
  exportMaintenanceToCsv,
  generateReport,
} = require('../utils/export');
const fs = require('fs');
const path = require('path');

async function exportOrders(req, res) {
  try {
    const orders = getOrderCalendarList(req.query);
    const result = await exportOrdersToCsv(orders, req.user.role);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

async function exportMessages(req, res) {
  try {
    const messages = getCleaningMessageList(req.query);
    const result = await exportMessagesToCsv(messages, req.user.role);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

async function exportMaintenance(req, res) {
  try {
    const notes = getMaintenanceNoteList(req.query);
    const result = await exportMaintenanceToCsv(notes, req.user.role);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function downloadFile(req, res) {
  try {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'exports', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    
    res.download(filePath);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getReport(req, res) {
  try {
    const orders = getOrderCalendarList({ limit: 1000 });
    const messages = getCleaningMessageList({ limit: 1000 });
    const maintenance = getMaintenanceNoteList({ limit: 1000 });
    const conflicts = detectConflicts();
    const failedTasks = getFailedTasks();

    const report = generateReport(orders, messages, maintenance, conflicts, failedTasks);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  exportOrders,
  exportMessages,
  exportMaintenance,
  downloadFile,
  getReport,
};
