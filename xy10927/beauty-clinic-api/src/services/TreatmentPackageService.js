const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');
const { validateCustomerExists, validateStoreExists, validatePackageStoreMatch } = require('../utils/validation');

class TreatmentPackageService {
  async createPackage(data) {
    await validateCustomerExists(data.customer_id);
    await validateStoreExists(data.store_id);

    const id = uuidv4();
    const now = new Date().toISOString();
    const remainingCount = data.total_count;
    
    await run(`
      INSERT INTO treatment_packages 
      (id, customer_id, name, total_count, used_count, remaining_count, 
       gift_count, used_gift_count, purchase_date, expire_date, original_store_id, current_store_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.customer_id, data.name, data.total_count, 0, remainingCount,
      0, 0, data.purchase_date, data.expire_date, data.store_id, data.store_id, 'active', now, now
    ]);

    return this.getPackageById(id);
  }

  async getPackageById(id) {
    return get('SELECT * FROM treatment_packages WHERE id = ?', [id]);
  }

  async getPackagesByCustomer(customerId) {
    return all('SELECT * FROM treatment_packages WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
  }

  async getAllPackages(filters = {}) {
    let sql = 'SELECT * FROM treatment_packages WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.store_id) {
      sql += ' AND current_store_id = ?';
      params.push(filters.store_id);
    }

    sql += ' ORDER BY created_at DESC';
    return all(sql, params);
  }

  async splitPackage(packageId, splitCount, splitGiftCount, operator) {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('套餐不存在');
    if (pkg.remaining_count < splitCount) throw new Error('剩余次数不足');
    if (pkg.gift_count < splitGiftCount) throw new Error('赠送次数不足');

    const now = new Date().toISOString();

    const childPackageId = uuidv4();
    await run(`
      INSERT INTO treatment_packages 
      (id, customer_id, name, total_count, used_count, remaining_count,
       gift_count, used_gift_count, purchase_date, expire_date, original_store_id, current_store_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      childPackageId, pkg.customer_id, pkg.name + '(拆分)', splitCount, 0, splitCount,
      splitGiftCount, 0, pkg.purchase_date, pkg.expire_date, pkg.original_store_id, pkg.current_store_id, 'active', now, now
    ]);

    await run(`
      UPDATE treatment_packages 
      SET total_count = total_count - ?, remaining_count = remaining_count - ?,
          gift_count = gift_count - ?, updated_at = ?
      WHERE id = ?
    `, [splitCount, splitCount, splitGiftCount, now, packageId]);

    await run(`
      INSERT INTO package_split_records (id, parent_package_id, child_package_id, split_count, split_gift_count, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), packageId, childPackageId, splitCount, splitGiftCount, operator, now]);

    return {
      parentPackage: await this.getPackageById(packageId),
      childPackage: await this.getPackageById(childPackageId)
    };
  }

  async addGift(packageId, giftCount, reason, operator) {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('套餐不存在');

    const now = new Date().toISOString();

    await run(`
      UPDATE treatment_packages 
      SET gift_count = gift_count + ?, updated_at = ?
      WHERE id = ?
    `, [giftCount, now, packageId]);

    await run(`
      INSERT INTO gift_records (id, package_id, gift_count, reason, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuidv4(), packageId, giftCount, reason, operator, now]);

    return this.getPackageById(packageId);
  }

  async verify(packageId, storeId, count, useGiftCount = 0, operator, remark = '') {
    await validateStoreExists(storeId);
    await validatePackageStoreMatch(packageId, storeId);

    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('套餐不存在');
    if (pkg.status !== 'active') throw new Error('套餐状态异常');
    if (count <= 0) throw new Error('核销次数必须大于0');
    if (useGiftCount < 0) throw new Error('使用赠送次数不能为负数');
    if (useGiftCount > count) throw new Error('使用赠送次数不能大于总核销次数');

    const usePaidCount = count - useGiftCount;
    if (useGiftCount > 0 && pkg.gift_count < useGiftCount) throw new Error('赠送次数不足');
    if (usePaidCount > 0 && pkg.remaining_count < usePaidCount) throw new Error('剩余购买次数不足');

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    let updateSql = 'UPDATE treatment_packages SET updated_at = ?';
    const updateParams = [now];

    if (usePaidCount > 0) {
      updateSql += ', used_count = used_count + ?, remaining_count = remaining_count - ?';
      updateParams.push(usePaidCount, usePaidCount);
    }
    if (useGiftCount > 0) {
      updateSql += ', used_gift_count = used_gift_count + ?, gift_count = gift_count - ?';
      updateParams.push(useGiftCount, useGiftCount);
    }
    updateSql += ' WHERE id = ?';
    updateParams.push(packageId);

    await run(updateSql, updateParams);

    const verifyId = uuidv4();
    await run(`
      INSERT INTO verification_records 
      (id, package_id, store_id, customer_id, verify_count, use_gift_count, use_paid_count, verify_date, operator, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [verifyId, packageId, storeId, pkg.customer_id, count, useGiftCount, usePaidCount, today, operator, remark, now]);

    return get('SELECT * FROM verification_records WHERE id = ?', [verifyId]);
  }

  async getGiftRecords(packageId) {
    return all('SELECT * FROM gift_records WHERE package_id = ? ORDER BY created_at DESC', [packageId]);
  }

  async getVerificationRecords(packageId) {
    return all('SELECT * FROM verification_records WHERE package_id = ? ORDER BY created_at DESC', [packageId]);
  }

  async manualCorrect(packageId, beforeData, afterData, reason, operator) {
    const now = new Date().toISOString();
    const correctionId = uuidv4();
    const pkg = await this.getPackageById(packageId);

    const finalAfterData = {
      total_count: afterData.total_count !== undefined ? afterData.total_count : pkg.total_count,
      remaining_count: afterData.remaining_count !== undefined ? afterData.remaining_count : pkg.remaining_count,
      gift_count: afterData.gift_count !== undefined ? afterData.gift_count : pkg.gift_count,
      status: afterData.status !== undefined ? afterData.status : pkg.status
    };

    const finalBeforeData = {
      total_count: beforeData.total_count !== undefined ? beforeData.total_count : pkg.total_count,
      remaining_count: beforeData.remaining_count !== undefined ? beforeData.remaining_count : pkg.remaining_count,
      gift_count: beforeData.gift_count !== undefined ? beforeData.gift_count : pkg.gift_count,
      status: beforeData.status !== undefined ? beforeData.status : pkg.status
    };

    await run(`
      INSERT INTO manual_corrections 
      (id, target_type, target_id, before_data, after_data, reason, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [correctionId, 'treatment_package', packageId, JSON.stringify(finalBeforeData), JSON.stringify(finalAfterData), reason, operator, now]);

    await run(`
      UPDATE treatment_packages 
      SET total_count = ?, remaining_count = ?, gift_count = ?, status = ?, updated_at = ?
      WHERE id = ?
    `, [finalAfterData.total_count, finalAfterData.remaining_count, finalAfterData.gift_count, finalAfterData.status, now, packageId]);

    return get('SELECT * FROM manual_corrections WHERE id = ?', [correctionId]);
  }
}

module.exports = new TreatmentPackageService();
