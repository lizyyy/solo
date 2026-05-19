const WorkOrderModel = require('../models/workOrderModel');
const FuelRecordModel = require('../models/fuelRecordModel');
const RateConfigModel = require('../models/rateConfigModel');
const ErrorRecordModel = require('../models/errorRecordModel');
const BatchModel = require('../models/batchModel');
const OperationLogModel = require('../models/operationLogModel');
const { Parser } = require('json2csv');

const getAllBatches = (req, res) => {
  BatchModel.getAll((err, batches) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(batches);
  });
};

const getBatchById = (req, res) => {
  BatchModel.getById(req.params.id, (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    res.json(batch);
  });
};

const getWorkOrders = (req, res) => {
  if (req.query.batch_id) {
    WorkOrderModel.getByBatchId(req.query.batch_id, (err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(records);
    });
  } else {
    WorkOrderModel.getAll((err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(records);
    });
  }
};

const getFuelRecords = (req, res) => {
  if (req.query.batch_id) {
    FuelRecordModel.getByBatchId(req.query.batch_id, (err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(records);
    });
  } else {
    FuelRecordModel.getAll((err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(records);
    });
  }
};

const getRateConfigs = (req, res) => {
  RateConfigModel.getAll((err, records) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(records);
  });
};

const getErrorRecords = (req, res) => {
  if (req.query.batch_id) {
    ErrorRecordModel.getByBatchId(req.query.batch_id, (err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      const parsedRecords = records.map(r => ({
        ...r,
        original_data: JSON.parse(r.original_data),
        corrected_data: r.corrected_data ? JSON.parse(r.corrected_data) : null
      }));
      res.json(parsedRecords);
    });
  } else if (req.query.unfixed) {
    ErrorRecordModel.getUnfixed((err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      const parsedRecords = records.map(r => ({
        ...r,
        original_data: JSON.parse(r.original_data),
        corrected_data: r.corrected_data ? JSON.parse(r.corrected_data) : null
      }));
      res.json(parsedRecords);
    });
  } else {
    ErrorRecordModel.getAll((err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      const parsedRecords = records.map(r => ({
        ...r,
        original_data: JSON.parse(r.original_data),
        corrected_data: r.corrected_data ? JSON.parse(r.corrected_data) : null
      }));
      res.json(parsedRecords);
    });
  }
};

const updateWorkOrder = (req, res) => {
  WorkOrderModel.getById(req.params.id, (err, oldRecord) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRecord) return res.status(404).json({ error: '记录不存在' });

    WorkOrderModel.update(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ error: err.message });

      OperationLogModel.create({
        operation_type: 'update',
        batch_id: oldRecord.batch_id,
        record_id: req.params.id,
        record_type: 'work_order',
        old_data: oldRecord,
        new_data: req.body,
        operator: req.body.operator || 'system'
      }, () => {
        res.json({ message: '更新成功' });
      });
    });
  });
};

const approveWorkOrder = (req, res) => {
  WorkOrderModel.getById(req.params.id, (err, record) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!record) return res.status(404).json({ error: '记录不存在' });

    WorkOrderModel.updateStatus(req.params.id, 'approved', (err) => {
      if (err) return res.status(500).json({ error: err.message });

      OperationLogModel.create({
        operation_type: 'approve',
        batch_id: record.batch_id,
        record_id: req.params.id,
        record_type: 'work_order',
        old_data: record,
        new_data: { ...record, status: 'approved' },
        operator: req.body.operator || 'system'
      }, () => {
        res.json({ message: '复核通过' });
      });
    });
  });
};

const fixErrorRecord = (req, res) => {
  ErrorRecordModel.getById(req.params.id, (err, errorRecord) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!errorRecord) return res.status(404).json({ error: '错误记录不存在' });

    const correctedData = req.body.corrected_data;

    if (errorRecord.file_type === 'work_order') {
      WorkOrderModel.create({
        ...correctedData,
        batch_id: errorRecord.batch_id,
        row_number: errorRecord.row_number
      }, (err, recordId) => {
        if (err) return res.status(500).json({ error: err.message });

        ErrorRecordModel.markAsFixed(req.params.id, correctedData, () => {
          OperationLogModel.create({
            operation_type: 'fix_error',
            batch_id: errorRecord.batch_id,
            record_id: recordId,
            record_type: 'work_order',
            new_data: correctedData,
            operator: req.body.operator || 'system'
          }, () => {
            res.json({ message: '错误已修正并保存为正常记录' });
          });
        });
      });
    } else if (errorRecord.file_type === 'fuel_record') {
      FuelRecordModel.create({
        ...correctedData,
        batch_id: errorRecord.batch_id,
        row_number: errorRecord.row_number
      }, (err, recordId) => {
        if (err) return res.status(500).json({ error: err.message });

        ErrorRecordModel.markAsFixed(req.params.id, correctedData, () => {
          OperationLogModel.create({
            operation_type: 'fix_error',
            batch_id: errorRecord.batch_id,
            record_id: recordId,
            record_type: 'fuel_record',
            new_data: correctedData,
            operator: req.body.operator || 'system'
          }, () => {
            res.json({ message: '错误已修正并保存为正常记录' });
          });
        });
      });
    } else {
      res.status(400).json({ error: '不支持的记录类型' });
    }
  });
};

const exportWorkOrders = (req, res) => {
  WorkOrderModel.getAll((err, records) => {
    if (err) return res.status(500).json({ error: err.message });

    try {
      const parser = new Parser();
      const csv = parser.parse(records);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=work_orders.csv');
      res.send('\uFEFF' + csv);
    } catch (parseErr) {
      res.status(500).json({ error: '导出失败' });
    }
  });
};

const getOperationLogs = (req, res) => {
  if (req.query.batch_id) {
    OperationLogModel.getByBatchId(req.query.batch_id, (err, logs) => {
      if (err) return res.status(500).json({ error: err.message });
      const parsedLogs = logs.map(l => ({
        ...l,
        old_data: l.old_data ? JSON.parse(l.old_data) : null,
        new_data: l.new_data ? JSON.parse(l.new_data) : null
      }));
      res.json(parsedLogs);
    });
  } else {
    OperationLogModel.getAll((err, logs) => {
      if (err) return res.status(500).json({ error: err.message });
      const parsedLogs = logs.map(l => ({
        ...l,
        old_data: l.old_data ? JSON.parse(l.old_data) : null,
        new_data: l.new_data ? JSON.parse(l.new_data) : null
      }));
      res.json(parsedLogs);
    });
  }
};

module.exports = {
  getAllBatches,
  getBatchById,
  getWorkOrders,
  getFuelRecords,
  getRateConfigs,
  getErrorRecords,
  updateWorkOrder,
  approveWorkOrder,
  fixErrorRecord,
  exportWorkOrders,
  getOperationLogs
};