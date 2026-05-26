const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { run, all, get } = require('../db/connection');
const auditService = require('./auditService');

async function importArtifactsFromCsv(filePath, operator) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  if (records.length === 0) {
    throw new Error('CSV 文件为空');
  }

  const requiredFields = ['文物编号', '名称', '等级', '估值'];
  for (const field of requiredFields) {
    if (!records[0].hasOwnProperty(field)) {
      throw new Error(`CSV 缺少必填列: ${field}`);
    }
  }

  let imported = 0;
  let updated = 0;
  let errors = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const artifactNo = record['文物编号'].trim();
      const name = record['名称'].trim();
      const level = record['等级'].trim();
      const valuation = parseFloat(record['估值']);

      if (!artifactNo || !name || !level || isNaN(valuation)) {
        throw new Error(`第 ${i + 2} 行数据不完整`);
      }

      const existing = await get('SELECT id FROM artifacts WHERE artifact_no = ?', [artifactNo]);

      if (existing) {
        await run(
          'UPDATE artifacts SET name = ?, level = ?, valuation = ?, description = ?, updated_at = datetime(\'now\', \'localtime\') WHERE artifact_no = ?',
          [name, level, valuation, record['描述'] || '', artifactNo]
        );
        updated++;
        await auditService.logAudit('更新文物', `更新文物信息: ${artifactNo}`, operator, null, existing.id);
      } else {
        const result = await run(
          'INSERT INTO artifacts (artifact_no, name, level, era, valuation, description) VALUES (?, ?, ?, ?, ?, ?)',
          [artifactNo, name, level, record['年代'] || '', valuation, record['描述'] || '']
        );
        imported++;
        await auditService.logAudit('新增文物', `新增文物: ${artifactNo}`, operator, null, result.lastId);
      }
    } catch (e) {
      errors.push({ line: i + 2, error: e.message });
    }
  }

  return { imported, updated, errors, total: imported + updated };
}

async function importTransportFromJson(filePath, operator) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.batchNo) {
    throw new Error('运输 JSON 缺少 batchNo 字段');
  }

  const batch = await get('SELECT id FROM batches WHERE batch_no = ?', [data.batchNo]);
  if (!batch) {
    throw new Error(`批次不存在: ${data.batchNo}`);
  }

  const transports = Array.isArray(data.transports) ? data.transports : [data];
  let imported = 0;
  let errors = [];

  for (let i = 0; i < transports.length; i++) {
    const t = transports[i];
    try {
      if (!t.transportNo) {
        throw new Error(`第 ${i + 1} 条运输记录缺少 transportNo`);
      }

      const existing = await get('SELECT id FROM transports WHERE transport_no = ?', [t.transportNo]);
      if (existing) {
        throw new Error(`运输单号已存在: ${t.transportNo}`);
      }

      const result = await run(
        'INSERT INTO transports (batch_id, transport_no, carrier, departure_time, arrival_time, status, delay_reason, delay_duration_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [batch.id, t.transportNo, t.carrier || '', t.departureTime || null, t.arrivalTime || null, t.status || '待发运', t.delayReason || null, t.delayDurationHours || null]
      );

      if (t.boxes && Array.isArray(t.boxes)) {
        for (const box of t.boxes) {
          const artifact = await get('SELECT id FROM artifacts WHERE artifact_no = ?', [box.artifactNo || '']);
          if (artifact) {
            await run(
              'INSERT INTO transport_boxes (transport_id, box_no, artifact_id, temperature, humidity, temp_anomaly, humidity_anomaly, anomaly_detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [result.lastId, box.boxNo || '', artifact.id, box.temperature || null, box.humidity || null, box.tempAnomaly ? 1 : 0, box.humidityAnomaly ? 1 : 0, box.anomalyDetail || '']
            );
          }
        }
      }

      imported++;
      await auditService.logAudit('导入运输记录', `导入运输单: ${t.transportNo}`, operator, batch.id);
    } catch (e) {
      errors.push({ index: i + 1, error: e.message });
    }
  }

  return { imported, errors };
}

async function importInsuranceFromJson(filePath, operator) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.batchNo) {
    throw new Error('保险 JSON 缺少 batchNo 字段');
  }

  const batch = await get('SELECT id FROM batches WHERE batch_no = ?', [data.batchNo]);
  if (!batch) {
    throw new Error(`批次不存在: ${data.batchNo}`);
  }

  const policies = Array.isArray(data.policies) ? data.policies : [data];
  let imported = 0;
  let errors = [];

  for (let i = 0; i < policies.length; i++) {
    const p = policies[i];
    try {
      if (!p.policyNo) {
        throw new Error(`第 ${i + 1} 条保险记录缺少 policyNo`);
      }
      if (!p.insuredValue || isNaN(parseFloat(p.insuredValue))) {
        throw new Error(`第 ${i + 1} 条保险记录缺少有效的 insuredValue`);
      }

      const existing = await get('SELECT id FROM insurance_policies WHERE policy_no = ?', [p.policyNo]);
      if (existing) {
        throw new Error(`保险单号已存在: ${p.policyNo}`);
      }

      await run(
        'INSERT INTO insurance_policies (batch_id, policy_no, insurer, insured_value, coverage_start, coverage_end) VALUES (?, ?, ?, ?, ?, ?)',
        [batch.id, p.policyNo, p.insurer || '', parseFloat(p.insuredValue), p.coverageStart || null, p.coverageEnd || null]
      );

      imported++;
      await auditService.logAudit('导入保险记录', `导入保险单: ${p.policyNo}`, operator, batch.id);
    } catch (e) {
      errors.push({ index: i + 1, error: e.message });
    }
  }

  return { imported, errors };
}

module.exports = { importArtifactsFromCsv, importTransportFromJson, importInsuranceFromJson };
