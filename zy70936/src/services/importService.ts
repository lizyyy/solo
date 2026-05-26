import * as fs from 'fs';
import csvParser from 'csv-parser';
import { getDb } from '../database';
import { generateId } from '../utils/id';
import { ImportResult, Customer, Medicine, FollowUpRule } from '../types';

export async function importCustomersFromJson(filePath: string, operator: string): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [], batchId: generateId('cust_batch') };

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const customers = Array.isArray(data) ? data : data.customers;

    if (!Array.isArray(customers)) {
      result.errors.push('无效的顾客档案JSON格式');
      return result;
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO customers (id, name, id_card, phone, tags, address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((customers: any[]) => {
      for (const customer of customers) {
        try {
          const customerId = customer.id || generateId('cust');
          insertStmt.run(
            customerId,
            customer.name,
            customer.idCard || customer.id_card,
            customer.phone,
            JSON.stringify(customer.tags || []),
            customer.address || '',
            Date.now()
          );
          result.success++;
        } catch (err: any) {
          result.failed++;
          result.errors.push(`顾客 ${customer.name || '未知'} 导入失败: ${err.message}`);
        }
      }
    });

    tx(customers);
  } catch (err: any) {
    result.errors.push(`解析文件失败: ${err.message}`);
  }

  return result;
}

export async function importPurchaseRecordsFromCsv(
  filePath: string,
  operator: string
): Promise<ImportResult> {
  const db = getDb();
  const batchId = generateId('batch');
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [], batchId };

  const insertBatch = db.prepare(`
    INSERT INTO batches (id, source_file, record_count, status, created_at, created_by)
    VALUES (?, ?, ?, 'processing', ?, ?)
  `);
  insertBatch.run(batchId, filePath, 0, Date.now(), operator);

  const insertRecord = db.prepare(`
    INSERT INTO purchase_records (id, batch_id, customer_id, medicine_id, quantity, purchase_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  const records: any[] = [];

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row: any) => records.push(row))
      .on('end', () => {
        const tx = db.transaction(() => {
          for (const row of records) {
            try {
              const recordId = generateId('rec');
              const purchaseDate = row.purchaseDate
                ? new Date(row.purchaseDate).getTime()
                : Date.now();

              if (!row.customerId || !row.medicineId) {
                result.failed++;
                result.warnings.push(`记录 ${recordId} 缺少必要字段，已跳过`);
                continue;
              }

              insertRecord.run(
                recordId,
                batchId,
                row.customerId,
                row.medicineId,
                parseInt(row.quantity || '1', 10),
                purchaseDate,
                row.notes || ''
              );
              result.success++;
            } catch (err: any) {
              result.failed++;
              result.errors.push(`记录导入失败: ${err.message}`);
            }
          }
        });

        try {
          tx();
          db.prepare('UPDATE batches SET record_count = ?, status = ? WHERE id = ?').run(
            result.success,
            result.failed > 0 ? 'failed' : 'completed',
            batchId
          );
        } catch (err: any) {
          result.errors.push(`事务执行失败: ${err.message}`);
        }

        resolve(result);
      })
      .on('error', (err: any) => {
        result.errors.push(`读取CSV文件失败: ${err.message}`);
        resolve(result);
      });
  });
}

export async function importMedicinesFromJson(filePath: string, operator: string): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [], batchId: generateId('med_batch') };

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const medicines = Array.isArray(data) ? data : data.medicines;

    if (!Array.isArray(medicines)) {
      result.errors.push('无效的药品JSON格式');
      return result;
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO medicines (id, name, category, is_controlled, contraindications, min_interval_days, max_dosage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((medicines: any[]) => {
      for (const med of medicines) {
        try {
          const medId = med.id || generateId('med');
          insertStmt.run(
            medId,
            med.name,
            med.category,
            med.isControlled ? 1 : 0,
            JSON.stringify(med.contraindications || []),
            med.minIntervalDays || 0,
            med.maxDosage || 0
          );
          result.success++;
        } catch (err: any) {
          result.failed++;
          result.errors.push(`药品 ${med.name || '未知'} 导入失败: ${err.message}`);
        }
      }
    });

    tx(medicines);
  } catch (err: any) {
    result.errors.push(`解析文件失败: ${err.message}`);
  }

  return result;
}

export async function importFollowUpRulesFromJson(
  filePath: string,
  operator: string
): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { success: 0, failed: 0, errors: [], warnings: [], batchId: generateId('rule_batch') };

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const rules = Array.isArray(data) ? data : data.rules;

    if (!Array.isArray(rules)) {
      result.errors.push('无效的随访规则JSON格式');
      return result;
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO follow_up_rules (id, medicine_category, days_after_purchase, required_checks, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((rules: any[]) => {
      for (const rule of rules) {
        try {
          const ruleId = rule.id || generateId('rule');
          insertStmt.run(
            ruleId,
            rule.medicineCategory,
            rule.daysAfterPurchase,
            JSON.stringify(rule.requiredChecks || []),
            rule.description || ''
          );
          result.success++;
        } catch (err: any) {
          result.failed++;
          result.errors.push(`规则导入失败: ${err.message}`);
        }
      }
    });

    tx(rules);
  } catch (err: any) {
    result.errors.push(`解析文件失败: ${err.message}`);
  }

  return result;
}
