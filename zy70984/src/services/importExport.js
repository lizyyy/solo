const { parse } = require('csv-parse/sync');
const { Parser } = require('json2csv');
const PackageService = require('./packageService');
const BatchService = require('./batchService');
const db = require('../db/database');

class ImportService {
  static importPackagesFromCsv(csvBuffer, batchId, createdBy) {
    const records = parse(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const imported = [];
    const errors = [];

    for (const [index, row] of records.entries()) {
      try {
        const data = {
          batch_id: batchId,
          pick_up_code: row.pick_up_code || row['取件码'] || row.code,
          tracking_no: row.tracking_no || row['运单号'] || row.tracking || '',
          receiver_name: row.receiver_name || row['收件人'] || row.name,
          receiver_phone: row.receiver_phone || row['手机号'] || row.phone,
          receiver_address: row.receiver_address || row['地址'] || row.address || '',
          arrived_at: row.arrived_at || row['到件时间'] || new Date().toISOString()
        };

        if (!data.pick_up_code || !data.receiver_name || !data.receiver_phone) {
          throw new Error('缺少必填字段：取件码/收件人/手机号');
        }

        const existing = PackageService.getByPickUpCode(data.pick_up_code);
        if (existing) {
          errors.push({ row: index + 1, code: data.pick_up_code, error: '取件码已存在' });
          continue;
        }

        const pkg = PackageService.create(data);
        imported.push(pkg);
      } catch (e) {
        errors.push({ row: index + 1, error: e.message, data: row });
      }
    }

    db.prepare(`
      INSERT INTO audit_logs (batch_id, action, reason, operator, detail)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, 'import_csv', `导入${imported.length}个包裹`, createdBy || 'system', JSON.stringify({ imported: imported.length, errors: errors.length }));

    return { imported: imported.length, errors, imported_ids: imported.map(p => p.id) };
  }

  static importSmsFromJson(jsonData, createdBy) {
    const records = Array.isArray(jsonData) ? jsonData : [jsonData];
    const imported = [];
    const errors = [];

    for (const [index, record] of records.entries()) {
      try {
        const pickUpCode = record.pick_up_code || record.code;
        const phone = record.phone || record.receiver_phone;
        const content = record.content || record.message;
        const sentAt = record.sent_at || record.time;

        if (!pickUpCode || !phone) {
          throw new Error('缺少取件码或手机号');
        }

        const pkg = PackageService.getByPickUpCode(pickUpCode);
        if (!pkg) {
          errors.push({ row: index + 1, code: pickUpCode, error: '包裹不存在' });
          continue;
        }

        PackageService.addSmsRecord(pkg.id, phone, content, sentAt);
        imported.push({ package_id: pkg.id, pick_up_code: pickUpCode });
      } catch (e) {
        errors.push({ row: index + 1, error: e.message });
      }
    }

    return { imported: imported.length, errors };
  }
}

class ExportService {
  static exportToCsv(packages, rule) {
    const enriched = packages.map(p => PackageService.enrichWithDetails(p, rule));
    const fields = [
      { label: '取件码', value: 'pick_up_code' },
      { label: '运单号', value: 'tracking_no' },
      { label: '收件人', value: 'receiver_name' },
      { label: '联系电话', value: 'receiver_phone' },
      { label: '到件时间', value: 'arrived_at' },
      { label: '状态', value: 'status_text' },
      { label: '短信催取次数', value: 'sms_count' },
      { label: '超期说明', value: 'overdue_info.description' },
      { label: '催取说明', value: 'sms_info.description' },
      { label: '处理说明', value: 'decision_note' },
      { label: '退回原因', value: 'return_reason' },
      { label: '处理人', value: 'processed_by' },
      { label: '处理时间', value: 'processed_at' }
    ];

    const parser = new Parser({ fields, withBOM: true });
    return parser.parse(enriched);
  }
}

module.exports = { ImportService, ExportService };
