const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { all, get } = require('../db/connection');

async function exportBatchDetail(batchId, exportDir) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');

  const artifacts = await all(`
    SELECT ba.*, a.artifact_no, a.name, a.level, a.era, a.valuation as current_valuation
    FROM batch_artifacts ba
    JOIN artifacts a ON ba.artifact_id = a.id
    WHERE ba.batch_id = ?
    ORDER BY a.level, a.artifact_no
  `, [batchId]);

  const transports = await all(
    'SELECT * FROM transports WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  const insurance = await all(
    'SELECT * FROM insurance_policies WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  const exceptions = await all(`
    SELECT e.*, a.artifact_no, a.name as artifact_name
    FROM exceptions e
    LEFT JOIN artifacts a ON e.artifact_id = a.id
    WHERE e.batch_id = ?
    ORDER BY e.created_at DESC
  `, [batchId]);

  const auditLogs = await all(
    'SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `批次_${batch.batch_no}_${timestamp}`;

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const summaryPath = path.join(exportDir, `${filename}_概况.csv`);
  const summaryWriter = createObjectCsvWriter({
    path: summaryPath,
    header: [
      { id: 'field', title: '项目' },
      { id: 'value', title: '内容' }
    ]
  });

  const summary = [
    { field: '批次号', value: batch.batch_no },
    { field: '当前状态', value: batch.status },
    { field: '经办人', value: batch.handler || '-' },
    { field: '审核人', value: batch.reviewer || '-' },
    { field: '审核意见', value: batch.review_comment || '-' },
    { field: '创建时间', value: batch.created_at },
    { field: '最后更新', value: batch.updated_at },
    { field: '文物数量', value: artifacts.length },
    { field: '运输记录数', value: transports.length },
    { field: '保险单数', value: insurance.length },
    { field: '异常记录数', value: exceptions.length }
  ];

  await summaryWriter.writeRecords(summary);

  const artifactPath = path.join(exportDir, `${filename}_文物清单.csv`);
  const artifactWriter = createObjectCsvWriter({
    path: artifactPath,
    header: [
      { id: 'artifact_no', title: '文物编号' },
      { id: 'name', title: '名称' },
      { id: 'level', title: '等级' },
      { id: 'era', title: '年代' },
      { id: 'valuation_snapshot', title: '批次估值' },
      { id: 'current_valuation', title: '当前估值' },
      { id: 'processing_status', title: '处理状态' },
      { id: 'returned_reason', title: '退回原因' }
    ]
  });

  await artifactWriter.writeRecords(artifacts);

  const files = [
    { type: '概况', path: summaryPath, count: summary.length },
    { type: '文物清单', path: artifactPath, count: artifacts.length }
  ];

  if (transports.length > 0) {
    const transportPath = path.join(exportDir, `${filename}_运输记录.csv`);
    const transportWriter = createObjectCsvWriter({
      path: transportPath,
      header: [
        { id: 'transport_no', title: '运输单号' },
        { id: 'carrier', title: '承运方' },
        { id: 'departure_time', title: '发运时间' },
        { id: 'arrival_time', title: '到达时间' },
        { id: 'status', title: '状态' },
        { id: 'delay_reason', title: '延误原因' },
        { id: 'delay_duration_hours', title: '延误时长(小时)' }
      ]
    });
    await transportWriter.writeRecords(transports);
    files.push({ type: '运输记录', path: transportPath, count: transports.length });

    const boxes = await all(`
      SELECT tb.*, a.artifact_no, a.name as artifact_name, t.transport_no
      FROM transport_boxes tb
      JOIN transports t ON tb.transport_id = t.id
      JOIN artifacts a ON tb.artifact_id = a.id
      WHERE t.batch_id = ?
      ORDER BY tb.box_no
    `, [batchId]);

    const boxPath = path.join(exportDir, `${filename}_运输箱明细.csv`);
    const boxWriter = createObjectCsvWriter({
      path: boxPath,
      header: [
        { id: 'transport_no', title: '运输单号' },
        { id: 'box_no', title: '箱号' },
        { id: 'artifact_no', title: '文物编号' },
        { id: 'artifact_name', title: '文物名称' },
        { id: 'temperature', title: '温度(℃)' },
        { id: 'humidity', title: '湿度(%)' },
        { id: 'temp_anomaly', title: '温度异常' },
        { id: 'humidity_anomaly', title: '湿度异常' },
        { id: 'anomaly_detail', title: '异常说明' }
      ]
    });
    await boxWriter.writeRecords(boxes);
    files.push({ type: '运输箱明细', path: boxPath, count: boxes.length });
  }

  if (insurance.length > 0) {
    const insurancePath = path.join(exportDir, `${filename}_保险单.csv`);
    const insuranceWriter = createObjectCsvWriter({
      path: insurancePath,
      header: [
        { id: 'policy_no', title: '保单号' },
        { id: 'insurer', title: '承保方' },
        { id: 'insured_value', title: '保额' },
        { id: 'coverage_start', title: '保障开始' },
        { id: 'coverage_end', title: '保障结束' }
      ]
    });
    await insuranceWriter.writeRecords(insurance);
    files.push({ type: '保险单', path: insurancePath, count: insurance.length });
  }

  if (exceptions.length > 0) {
    const exceptionPath = path.join(exportDir, `${filename}_异常记录.csv`);
    const exceptionWriter = createObjectCsvWriter({
      path: exceptionPath,
      header: [
        { id: 'type', title: '异常类型' },
        { id: 'description', title: '描述' },
        { id: 'artifact_no', title: '关联文物' },
        { id: 'handler', title: '处理人' },
        { id: 'handled_at', title: '处理时间' },
        { id: 'resolved', title: '是否已解决' },
        { id: 'resolved_by', title: '解决人' },
        { id: 'resolved_at', title: '解决时间' },
        { id: 'resolution_note', title: '解决说明' }
      ]
    });
    const exceptionData = exceptions.map(e => ({
      ...e,
      resolved: e.resolved ? '是' : '否'
    }));
    await exceptionWriter.writeRecords(exceptionData);
    files.push({ type: '异常记录', path: exceptionPath, count: exceptions.length });
  }

  if (auditLogs.length > 0) {
    const auditPath = path.join(exportDir, `${filename}_操作日志.csv`);
    const auditWriter = createObjectCsvWriter({
      path: auditPath,
      header: [
        { id: 'action', title: '操作类型' },
        { id: 'detail', title: '操作详情' },
        { id: 'operator', title: '操作人' },
        { id: 'created_at', title: '操作时间' }
      ]
    });
    await auditWriter.writeRecords(auditLogs);
    files.push({ type: '操作日志', path: auditPath, count: auditLogs.length });
  }

  return {
    batch_no: batch.batch_no,
    status: batch.status,
    files,
    export_dir: exportDir
  };
}

async function exportArtifactsByLevel(level, exportDir) {
  const artifacts = await all(`
    SELECT a.*, COUNT(DISTINCT ba.batch_id) as batch_count,
      GROUP_CONCAT(DISTINCT b.batch_no) as batch_nos
    FROM artifacts a
    LEFT JOIN batch_artifacts ba ON a.id = ba.artifact_id
    LEFT JOIN batches b ON ba.batch_id = b.id
    WHERE a.level = ?
    GROUP BY a.id
    ORDER BY a.artifact_no
  `, [level]);

  if (artifacts.length === 0) {
    return { level, count: 0, message: `等级 ${level} 下暂无文物` };
  }

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `等级_${level}_文物_${timestamp}.csv`;
  const filePath = path.join(exportDir, filename);

  const writer = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'artifact_no', title: '文物编号' },
      { id: 'name', title: '名称' },
      { id: 'level', title: '等级' },
      { id: 'era', title: '年代' },
      { id: 'valuation', title: '估值' },
      { id: 'description', title: '描述' },
      { id: 'batch_count', title: '涉及批次数' },
      { id: 'batch_nos', title: '批次号列表' }
    ]
  });

  await writer.writeRecords(artifacts);

  return { level, count: artifacts.length, file_path: filePath };
}

async function exportBatchList(filters, pagination, exportDir) {
  const conditions = [];
  const params = [];

  if (filters.batchNo) {
    conditions.push('batch_no LIKE ?');
    params.push('%' + filters.batchNo + '%');
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT * FROM batches ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const batches = await all(sql, [...params, pagination.limit, pagination.offset]);

  const countSql = `SELECT COUNT(*) as total FROM batches ${where}`;
  const countResult = await get(countSql, params);

  if (batches.length === 0) {
    return { count: 0, total: countResult.total, message: '暂无符合条件的批次' };
  }

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `批次列表_${timestamp}.csv`;
  const filePath = path.join(exportDir, filename);

  const writer = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'batch_no', title: '批次号' },
      { id: 'status', title: '状态' },
      { id: 'handler', title: '经办人' },
      { id: 'reviewer', title: '审核人' },
      { id: 'review_comment', title: '审核意见' },
      { id: 'created_at', title: '创建时间' },
      { id: 'updated_at', title: '更新时间' }
    ]
  });

  await writer.writeRecords(batches);

  return { count: batches.length, total: countResult.total, file_path: filePath };
}

module.exports = { exportBatchDetail, exportArtifactsByLevel, exportBatchList };
