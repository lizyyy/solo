const moment = require('moment');
const {
  BatchDAO,
  BoxDAO,
  TemperatureRecordDAO,
  PhotoDAO,
  ReconciliationResultDAO,
  OperationHistoryDAO,
  ManualAdjustmentDAO,
  runInTransaction
} = require('../db/dao');

const DUPLICATE_STRATEGIES = {
  IGNORE: 'ignore',
  OVERWRITE: 'overwrite',
  APPEND: 'append',
  ERROR: 'error'
};

class BatchService {
  static async submitBatch(submitData, duplicateStrategy = DUPLICATE_STRATEGIES.ERROR, operator = 'system') {
    const { batch_no, driver_name, driver_phone, boxes, temperature_records, photos, remark } = submitData;

    const existingBatch = BatchDAO.findByBatchNo(batch_no);
    
    if (existingBatch) {
      OperationHistoryDAO.create({
        batch_id: existingBatch.id,
        operation_type: 'duplicate_submit',
        operation_subtype: duplicateStrategy,
        operator,
        before_data: { status: existingBatch.status },
        remark: `批次重复提交，策略: ${duplicateStrategy}`
      });

      switch (duplicateStrategy) {
        case DUPLICATE_STRATEGIES.IGNORE:
          return {
            success: true,
            action: 'ignored',
            message: '批次已存在，已忽略',
            batch_id: existingBatch.id,
            batch_no
          };
        case DUPLICATE_STRATEGIES.OVERWRITE:
          return this._overwriteBatch(existingBatch.id, submitData, operator);
        case DUPLICATE_STRATEGIES.APPEND:
          return this._appendBatch(existingBatch.id, submitData, operator);
        case DUPLICATE_STRATEGIES.ERROR:
        default:
          throw new Error(`批次 ${batch_no} 已存在，使用 duplicate_strategy 参数指定处理策略: ignore/overwrite/append`);
      }
    }

    return this._createNewBatch(submitData, operator);
  }

  static _createNewBatch(submitData, operator) {
    const batchId = runInTransaction(() => {
      const batchId = BatchDAO.create({
        batch_no: submitData.batch_no,
        driver_name: submitData.driver_name,
        driver_phone: submitData.driver_phone,
        submit_by: operator,
        status: 'submitted',
        remark: submitData.remark
      });

      this._saveBoxes(batchId, submitData.boxes || []);
      this._saveTemperatureRecords(batchId, submitData.temperature_records || []);
      this._savePhotos(batchId, submitData.photos || []);

      OperationHistoryDAO.create({
        batch_id: batchId,
        operation_type: 'submit',
        operation_subtype: 'new',
        operator,
        after_data: { batch_no: submitData.batch_no },
        remark: '新建批次提交'
      });

      return batchId;
    });

    const reconciliationResult = this.calculateReconciliation(batchId);

    return {
      success: true,
      action: 'created',
      message: '批次创建成功',
      batch_id: batchId,
      batch_no: submitData.batch_no,
      reconciliation: reconciliationResult
    };
  }

  static _overwriteBatch(batchId, submitData, operator) {
    const oldBatch = BatchDAO.findById(batchId);
    const oldBoxes = BoxDAO.findByBatchId(batchId);

    runInTransaction(() => {
      BoxDAO.deleteByBatchId(batchId);
      TemperatureRecordDAO.deleteByBatchId(batchId);
      PhotoDAO.deleteByBatchId(batchId);

      this._saveBoxes(batchId, submitData.boxes || []);
      this._saveTemperatureRecords(batchId, submitData.temperature_records || []);
      this._savePhotos(batchId, submitData.photos || []);

      BatchDAO.updateStatus(batchId, 'resubmitted');

      OperationHistoryDAO.create({
        batch_id: batchId,
        operation_type: 'overwrite',
        operator,
        before_data: { box_count: oldBoxes.length },
        after_data: { box_count: (submitData.boxes || []).length },
        remark: '覆盖提交'
      });
    });

    const reconciliationResult = this.calculateReconciliation(batchId);

    return {
      success: true,
      action: 'overwritten',
      message: '批次已覆盖更新',
      batch_id: batchId,
      batch_no: submitData.batch_no,
      reconciliation: reconciliationResult
    };
  }

  static _appendBatch(batchId, submitData, operator) {
    const existingBoxNos = new Set(BoxDAO.findByBatchId(batchId).map(b => b.box_no));
    const newBoxes = (submitData.boxes || []).filter(b => !existingBoxNos.has(b.box_no));

    runInTransaction(() => {
      this._saveBoxes(batchId, newBoxes);
      this._saveTemperatureRecords(batchId, submitData.temperature_records || []);
      this._savePhotos(batchId, submitData.photos || []);

      BatchDAO.updateStatus(batchId, 'appended');

      OperationHistoryDAO.create({
        batch_id: batchId,
        operation_type: 'append',
        operator,
        after_data: { appended_box_count: newBoxes.length },
        remark: '追加提交'
      });
    });

    const reconciliationResult = this.calculateReconciliation(batchId);

    return {
      success: true,
      action: 'appended',
      message: `追加 ${newBoxes.length} 个箱号`,
      batch_id: batchId,
      batch_no: submitData.batch_no,
      appended_boxes: newBoxes.map(b => b.box_no),
      reconciliation: reconciliationResult
    };
  }

  static _saveBoxes(batchId, boxes) {
    boxes.forEach(box => {
      const receiveDate = box.receive_time ? moment(box.receive_time).format('YYYY-MM-DD') : null;
      const isCrossDay = this._checkCrossDay(box.receive_time);
      
      BoxDAO.create({
        batch_id: batchId,
        box_no: box.box_no,
        original_box_no: box.original_box_no || box.box_no,
        wms_expected_qty: box.wms_expected_qty,
        actual_qty: box.actual_qty,
        receive_time: box.receive_time,
        receive_date: receiveDate,
        is_renamed: box.box_no !== (box.original_box_no || box.box_no),
        is_cross_day: isCrossDay,
        remark: box.remark
      });
    });
  }

  static _saveTemperatureRecords(batchId, records) {
    records.forEach(record => {
      const isAbnormal = record.temperature < 2 || record.temperature > 8;
      TemperatureRecordDAO.create({
        batch_id: batchId,
        box_no: record.box_no,
        record_time: record.record_time,
        temperature: record.temperature,
        humidity: record.humidity,
        is_abnormal: isAbnormal
      });
    });
  }

  static _savePhotos(batchId, photos) {
    photos.forEach(photo => {
      PhotoDAO.create({
        batch_id: batchId,
        photo_type: photo.photo_type,
        file_name: photo.file_name,
        file_path: photo.file_path,
        file_size: photo.file_size,
        remark: photo.remark
      });
    });
  }

  static _checkCrossDay(receiveTime) {
    if (!receiveTime) return false;
    const receive = moment(receiveTime);
    const dayEnd = receive.clone().hour(23).minute(59).second(59);
    return false;
  }

  static calculateReconciliation(batchId) {
    const boxes = BoxDAO.findByBatchId(batchId);
    const tempRecords = TemperatureRecordDAO.findByBatchId(batchId);

    const tempAbnormalBoxes = new Set();
    tempRecords.forEach(r => {
      if (r.is_abnormal) tempAbnormalBoxes.add(r.box_no);
    });

    let totalCompensation = 0;
    const boxResults = boxes.map(box => {
      let compensation = 0;
      let isTempAbnormal = tempAbnormalBoxes.has(box.box_no);

      if (box.is_renamed) compensation += 50;
      if (box.is_cross_day) compensation += 100;
      if (isTempAbnormal) compensation += 200;
      if (box.wms_expected_qty > box.actual_qty) {
        compensation += (box.wms_expected_qty - box.actual_qty) * 10;
      }

      totalCompensation += compensation;

      BoxDAO.update(box.id, {
        compensation_amount: compensation,
        temperature_abnormal: isTempAbnormal ? 1 : 0,
        status: compensation > 0 ? 'abnormal' : 'normal'
      });

      return {
        box_no: box.box_no,
        is_renamed: box.is_renamed,
        is_cross_day: box.is_cross_day,
        temperature_abnormal: isTempAbnormal,
        compensation
      };
    });

    const result = {
      batch_id: batchId,
      total_boxes: boxes.length,
      normal_boxes: boxes.filter(b => !b.is_renamed && !b.is_cross_day && !tempAbnormalBoxes.has(b.box_no)).length,
      renamed_boxes: boxes.filter(b => b.is_renamed).length,
      cross_day_boxes: boxes.filter(b => b.is_cross_day).length,
      temperature_abnormal_boxes: tempAbnormalBoxes.size,
      total_compensation: totalCompensation,
      status: 'calculated'
    };

    ReconciliationResultDAO.create(result);

    OperationHistoryDAO.create({
      batch_id: batchId,
      operation_type: 'reconciliation',
      operation_subtype: 'calculate',
      after_data: { total_compensation: totalCompensation },
      remark: '对账计算完成'
    });

    return { ...result, box_results: boxResults };
  }

  static withdrawBatch(batchId, operator, reason) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    if (batch.frozen) throw new Error('批次已冻结，无法撤回');

    BatchDAO.updateStatus(batchId, 'withdrawn');

    OperationHistoryDAO.create({
      batch_id: batchId,
      operation_type: 'withdraw',
      operator,
      before_data: { status: batch.status },
      after_data: { status: 'withdrawn' },
      remark: reason || '撤回批次'
    });

    return { success: true, message: '批次已撤回' };
  }

  static resubmitAfterWithdraw(batchNo, submitData, operator) {
    const existingBatch = BatchDAO.findByBatchNo(batchNo);
    
    if (!existingBatch) {
      return this._createNewBatch(submitData, operator);
    }

    if (existingBatch.status !== 'withdrawn') {
      throw new Error('批次状态不是已撤回，无法重新提交');
    }

    return this._overwriteBatch(existingBatch.id, submitData, operator);
  }

  static getBatchDetail(batchId) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) return null;

    const boxes = BoxDAO.findByBatchId(batchId);
    const temperatureRecords = TemperatureRecordDAO.findByBatchId(batchId);
    const photos = PhotoDAO.findByBatchId(batchId);
    const reconciliation = ReconciliationResultDAO.findByBatchId(batchId);
    const history = OperationHistoryDAO.findByBatchId(batchId);
    const adjustments = ManualAdjustmentDAO.findByBatchId(batchId);

    return {
      batch,
      boxes,
      temperature_records: temperatureRecords,
      photos,
      reconciliation,
      operation_history: history,
      manual_adjustments: adjustments
    };
  }

  static getAllBatches() {
    return BatchDAO.list();
  }
}

module.exports = { BatchService, DUPLICATE_STRATEGIES };
