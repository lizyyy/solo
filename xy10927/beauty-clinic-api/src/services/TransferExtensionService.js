const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');

class TransferExtensionService {
  async createTransferRequest(packageId, fromStoreId, toStoreId, requestNote, operator) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(`
      INSERT INTO store_transfer_requests 
      (id, package_id, from_store_id, to_store_id, status, request_note, operator, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, packageId, fromStoreId, toStoreId, 'pending', requestNote, operator, now, now]);

    return this.getTransferRequestById(id);
  }

  async getTransferRequestById(id) {
    return get('SELECT * FROM store_transfer_requests WHERE id = ?', [id]);
  }

  async getAllTransferRequests(filters = {}) {
    let sql = 'SELECT * FROM store_transfer_requests WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.package_id) {
      sql += ' AND package_id = ?';
      params.push(filters.package_id);
    }

    sql += ' ORDER BY created_at DESC';
    return all(sql, params);
  }

  async approveTransferRequest(requestId, approvalNote, operator) {
    const request = await this.getTransferRequestById(requestId);
    if (!request) throw new Error('转店申请不存在');
    if (request.status !== 'pending') throw new Error('当前状态不允许审批');

    const now = new Date().toISOString();

    await run(`
      UPDATE store_transfer_requests 
      SET status = 'approved', approval_note = ?, operator = ?, updated_at = ?
      WHERE id = ?
    `, [approvalNote, operator, now, requestId]);

    await run(`
      UPDATE treatment_packages 
      SET current_store_id = ?, updated_at = ?
      WHERE id = ?
    `, [request.to_store_id, now, request.package_id]);

    return this.getTransferRequestById(requestId);
  }

  async rejectTransferRequest(requestId, approvalNote, operator) {
    const request = await this.getTransferRequestById(requestId);
    if (!request) throw new Error('转店申请不存在');
    if (request.status !== 'pending') throw new Error('当前状态不允许审批');

    const now = new Date().toISOString();

    await run(`
      UPDATE store_transfer_requests 
      SET status = 'rejected', approval_note = ?, operator = ?, updated_at = ?
      WHERE id = ?
    `, [approvalNote, operator, now, requestId]);

    return this.getTransferRequestById(requestId);
  }

  async createExtensionRequest(packageId, newExpireDate, reason, operator) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const pkg = await get('SELECT * FROM treatment_packages WHERE id = ?', [packageId]);
    if (!pkg) throw new Error('套餐不存在');

    await run(`
      INSERT INTO extension_requests 
      (id, package_id, original_expire_date, new_expire_date, reason, status, operator, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, packageId, pkg.expire_date, newExpireDate, reason, 'pending', operator, now, now]);

    return this.getExtensionRequestById(id);
  }

  async getExtensionRequestById(id) {
    return get('SELECT * FROM extension_requests WHERE id = ?', [id]);
  }

  async getAllExtensionRequests(filters = {}) {
    let sql = 'SELECT * FROM extension_requests WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.package_id) {
      sql += ' AND package_id = ?';
      params.push(filters.package_id);
    }

    sql += ' ORDER BY created_at DESC';
    return all(sql, params);
  }

  async approveExtensionRequest(requestId, approvalNote, operator) {
    const request = await this.getExtensionRequestById(requestId);
    if (!request) throw new Error('延期申请不存在');
    if (request.status !== 'pending') throw new Error('当前状态不允许审批');

    const now = new Date().toISOString();

    await run(`
      UPDATE extension_requests 
      SET status = 'approved', approval_note = ?, operator = ?, updated_at = ?
      WHERE id = ?
    `, [approvalNote, operator, now, requestId]);

    await run(`
      UPDATE treatment_packages 
      SET expire_date = ?, updated_at = ?
      WHERE id = ?
    `, [request.new_expire_date, now, request.package_id]);

    return this.getExtensionRequestById(requestId);
  }

  async rejectExtensionRequest(requestId, approvalNote, operator) {
    const request = await this.getExtensionRequestById(requestId);
    if (!request) throw new Error('延期申请不存在');
    if (request.status !== 'pending') throw new Error('当前状态不允许审批');

    const now = new Date().toISOString();

    await run(`
      UPDATE extension_requests 
      SET status = 'rejected', approval_note = ?, operator = ?, updated_at = ?
      WHERE id = ?
    `, [approvalNote, operator, now, requestId]);

    return this.getExtensionRequestById(requestId);
  }

  async compensateExtensionRequest(requestId, approvalNote, operator) {
    const request = await this.getExtensionRequestById(requestId);
    if (!request) throw new Error('延期申请不存在');
    if (request.status !== 'rejected') throw new Error('只有已驳回的申请才能补偿');

    const now = new Date().toISOString();

    await run(`
      UPDATE extension_requests 
      SET status = 'compensated', approval_note = ?, operator = ?, updated_at = ?
      WHERE id = ?
    `, [approvalNote, operator, now, requestId]);

    return this.getExtensionRequestById(requestId);
  }
}

module.exports = new TransferExtensionService();
