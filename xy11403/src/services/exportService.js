const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const {
  BatchDAO,
  BoxDAO,
  TemperatureRecordDAO,
  PhotoDAO,
  ReconciliationResultDAO,
  OperationHistoryDAO
} = require('../db/dao');

const EXPORT_DIR = path.join(__dirname, '../../data/exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

class ExportService {
  static async exportBatchDetail(batchId) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');

    const exportTime = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `batch_${batch.batch_no}_${exportTime}`;

    const result = {
      export_time: new Date().toISOString(),
      batch_no: batch.batch_no,
      batch_info: batch,
      boxes: BoxDAO.findByBatchId(batchId),
      temperature_records: TemperatureRecordDAO.findByBatchId(batchId),
      photos: PhotoDAO.findByBatchId(batchId),
      reconciliation: ReconciliationResultDAO.findByBatchId(batchId),
      operation_history: OperationHistoryDAO.findByBatchId(batchId)
    };

    const jsonPath = path.join(EXPORT_DIR, `${fileName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    await this._exportBoxesToCsv(batchId, batch.batch_no, exportTime);
    await this._exportReconciliationToCsv(batchId, batch.batch_no, exportTime);
    await this._exportHistoryToCsv(batchId, batch.batch_no, exportTime);

    return {
      success: true,
      batch_no: batch.batch_no,
      export_files: {
        json: jsonPath,
        boxes_csv: path.join(EXPORT_DIR, `${fileName}_boxes.csv`),
        reconciliation_csv: path.join(EXPORT_DIR, `${fileName}_reconciliation.csv`),
        history_csv: path.join(EXPORT_DIR, `${fileName}_history.csv`)
      }
    };
  }

  static async _exportBoxesToCsv(batchId, batchNo, exportTime) {
    const boxes = BoxDAO.findByBatchId(batchId);
    const csvWriter = createCsvWriter({
      path: path.join(EXPORT_DIR, `batch_${batchNo}_${exportTime}_boxes.csv`),
      header: [
        { id: 'box_no', title: '箱号' },
        { id: 'original_box_no', title: '原始箱号' },
        { id: 'wms_expected_qty', title: 'WMS预期数量' },
        { id: 'actual_qty', title: '实际数量' },
        { id: 'receive_time', title: '签收时间' },
        { id: 'is_renamed', title: '是否改名' },
        { id: 'is_cross_day', title: '是否跨日' },
        { id: 'temperature_abnormal', title: '温度异常' },
        { id: 'compensation_amount', title: '赔付金额' },
        { id: 'status', title: '状态' },
        { id: 'remark', title: '备注' }
      ]
    });
    await csvWriter.writeRecords(boxes);
  }

  static async _exportReconciliationToCsv(batchId, batchNo, exportTime) {
    const reconciliation = ReconciliationResultDAO.findByBatchId(batchId);
    if (!reconciliation) return;

    const csvWriter = createCsvWriter({
      path: path.join(EXPORT_DIR, `batch_${batchNo}_${exportTime}_reconciliation.csv`),
      header: [
        { id: 'total_boxes', title: '总箱数' },
        { id: 'normal_boxes', title: '正常箱数' },
        { id: 'renamed_boxes', title: '改名箱数' },
        { id: 'cross_day_boxes', title: '跨日箱数' },
        { id: 'temperature_abnormal_boxes', title: '温度异常箱数' },
        { id: 'total_compensation', title: '总赔付金额' },
        { id: 'calculated_at', title: '计算时间' }
      ]
    });
    await csvWriter.writeRecords([reconciliation]);
  }

  static async _exportHistoryToCsv(batchId, batchNo, exportTime) {
    const history = OperationHistoryDAO.findByBatchId(batchId);
    const csvWriter = createCsvWriter({
      path: path.join(EXPORT_DIR, `batch_${batchNo}_${exportTime}_history.csv`),
      header: [
        { id: 'created_at', title: '操作时间' },
        { id: 'operation_type', title: '操作类型' },
        { id: 'operation_subtype', title: '操作子类型' },
        { id: 'operator', title: '操作人' },
        { id: 'before_data', title: '变更前' },
        { id: 'after_data', title: '变更后' },
        { id: 'remark', title: '备注' }
      ]
    });
    await csvWriter.writeRecords(history.map(h => ({
      ...h,
      before_data: JSON.stringify(h.before_data || ''),
      after_data: JSON.stringify(h.after_data || '')
    })));
  }

  static getExportList() {
    if (!fs.existsSync(EXPORT_DIR)) return [];
    return fs.readdirSync(EXPORT_DIR).map(file => ({
      file_name: file,
      full_path: path.join(EXPORT_DIR, file),
      size: fs.statSync(path.join(EXPORT_DIR, file)).size,
      mtime: fs.statSync(path.join(EXPORT_DIR, file)).mtime
    })).sort((a, b) => b.mtime - a.mtime);
  }

  static getRawDataForReplay(batchId) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');

    return {
      batch: {
        batch_no: batch.batch_no,
        driver_name: batch.driver_name,
        driver_phone: batch.driver_phone,
        submit_by: batch.submit_by,
        remark: batch.remark
      },
      boxes: BoxDAO.findByBatchId(batchId).map(b => ({
        box_no: b.box_no,
        original_box_no: b.original_box_no,
        wms_expected_qty: b.wms_expected_qty,
        actual_qty: b.actual_qty,
        receive_time: b.receive_time,
        remark: b.remark
      })),
      temperature_records: TemperatureRecordDAO.findByBatchId(batchId).map(t => ({
        box_no: t.box_no,
        record_time: t.record_time,
        temperature: t.temperature,
        humidity: t.humidity
      })),
      photos: PhotoDAO.findByBatchId(batchId).map(p => ({
        photo_type: p.photo_type,
        file_name: p.file_name,
        file_path: p.file_path,
        file_size: p.file_size,
        remark: p.remark
      }))
    };
  }
}

class HistoryService {
  static getOperationHistory(batchId, limit = 100) {
    return OperationHistoryDAO.findByBatchId(batchId, limit);
  }

  static getAllHistory(limit = 200) {
    return OperationHistoryDAO.listAll(limit);
  }

  static getHistorySummary(batchId) {
    const history = OperationHistoryDAO.findByBatchId(batchId, 200);
    const summary = {};

    history.forEach(h => {
      const key = h.operation_type;
      if (!summary[key]) {
        summary[key] = { count: 0, last_time: null, operators: new Set() };
      }
      summary[key].count++;
      summary[key].last_time = h.created_at;
      summary[key].operators.add(h.operator);
    });

    return Object.entries(summary).map(([type, data]) => ({
      operation_type: type,
      count: data.count,
      last_time: data.last_time,
      operators: Array.from(data.operators)
    }));
  }
}

module.exports = { ExportService, HistoryService };
