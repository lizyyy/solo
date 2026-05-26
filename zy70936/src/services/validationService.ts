import { getDb } from '../database';
import { differenceInDays } from 'date-fns';
import { ValidationResult } from '../types';

export function validatePurchaseRecord(
  customerId: string,
  medicineId: string,
  purchaseDate: number,
  quantity: number
): ValidationResult {
  const db = getDb();
  const errors: string[] = [];
  const warnings: string[] = [];

  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId) as any;
  if (!medicine) {
    errors.push(`药品ID ${medicineId} 不存在`);
    return { valid: false, errors, warnings };
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  if (!customer) {
    errors.push(`顾客ID ${customerId} 不存在`);
    return { valid: false, errors, warnings };
  }

  const intervalResult = checkPurchaseInterval(customerId, medicineId, purchaseDate, medicine.min_interval_days);
  warnings.push(...intervalResult.warnings);

  const contraindicationResult = checkContraindications(customer, medicine);
  errors.push(...contraindicationResult.errors);
  warnings.push(...contraindicationResult.warnings);

  const dosageResult = checkDosageLimit(customerId, medicineId, quantity, medicine.max_dosage);
  errors.push(...dosageResult.errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function checkPurchaseInterval(
  customerId: string,
  medicineId: string,
  currentPurchaseDate: number,
  minIntervalDays: number
): ValidationResult {
  const db = getDb();
  const warnings: string[] = [];

  if (minIntervalDays > 0) {
    const lastPurchase = db.prepare(`
      SELECT purchase_date FROM purchase_records
      WHERE customer_id = ? AND medicine_id = ? AND status != 'rejected'
      ORDER BY purchase_date DESC LIMIT 1
    `).get(customerId, medicineId) as any;

    if (lastPurchase) {
      const daysSinceLastPurchase = differenceInDays(currentPurchaseDate, lastPurchase.purchase_date);
      if (daysSinceLastPurchase < minIntervalDays) {
        warnings.push(
          `间隔提醒：该顾客上次购买此药品仅 ${daysSinceLastPurchase} 天前，` +
          `建议最小间隔为 ${minIntervalDays} 天。`
        );
      }
    }
  }

  return { valid: true, errors: [], warnings };
}

function checkContraindications(customer: any, medicine: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const customerTags = JSON.parse(customer.tags || '[]');
  const contraindications = JSON.parse(medicine.contraindications || '[]');

  for (const contraindication of contraindications) {
    if (customerTags.includes(contraindication)) {
      errors.push(
        `禁忌药警告：顾客标签"${contraindication}"与药品"${medicine.name}"的禁忌症冲突，` +
        `请确认是否继续。`
      );
    }
  }

  if (medicine.is_controlled && !customerTags.includes('approved_for_controlled')) {
    warnings.push(
      `管制药品提醒："${medicine.name}"为管制药品，请确认顾客是否有相关资质。`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function checkDosageLimit(
  customerId: string,
  medicineId: string,
  currentQuantity: number,
  maxDosage: number
): ValidationResult {
  const db = getDb();
  const errors: string[] = [];

  if (maxDosage > 0) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentPurchases = db.prepare(`
      SELECT SUM(quantity) as total FROM purchase_records
      WHERE customer_id = ? AND medicine_id = ? AND purchase_date >= ? AND status != 'rejected'
    `).get(customerId, medicineId, thirtyDaysAgo) as any;

    const totalQuantity = (recentPurchases?.total || 0) + currentQuantity;
    if (totalQuantity > maxDosage) {
      errors.push(
        `剂量超限：该顾客30天内已购买此药品 ${recentPurchases?.total || 0} 单位，` +
        `本次购买 ${currentQuantity} 单位后总计 ${totalQuantity} 单位，` +
        `超过最大限制 ${maxDosage} 单位。`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
