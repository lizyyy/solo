const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('./database');

const REQUEST_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    MODIFIED: 'MODIFIED'
};

const LABEL_STATUS = {
    ACTIVE: 'ACTIVE',
    DAMAGED: 'DAMAGED',
    REPRINTED: 'REPRINTED'
};

const auditLog = async (requestId, action, operatorId, details = {}) => {
    const id = uuidv4();
    const timestamp = Date.now();
    await runQuery(
        'INSERT INTO audit_logs (id, request_id, action, operator_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [id, requestId, action, operatorId, JSON.stringify(details), timestamp]
    );
};

const checkBatchLock = async (batchNumber, counterCode) => {
    const now = Date.now();
    const lock = await getQuery(
        `SELECT * FROM batch_locks 
         WHERE batch_number = ? AND counter_code = ? 
         AND (expires_at IS NULL OR expires_at > ?)`,
        [batchNumber, counterCode, now]
    );
    return lock;
};

const checkPermission = (operatorId, permission) => {
    const permissions = {
        'user1': ['REQUEST_REPRINT', 'CANCEL_OWN'],
        'user2': ['REQUEST_REPRINT', 'CANCEL_OWN', 'APPROVE_REQUESTS'],
        'admin': ['REQUEST_REPRINT', 'CANCEL_OWN', 'APPROVE_REQUESTS', 'MODIFY_REQUESTS', 'AUDIT']
    };
    return permissions[operatorId]?.includes(permission) || false;
};

const createWeighingRecord = async (recordData) => {
    const { sku_code, sku_name, weight, unit_price, batch_number, counter_code, operator_id } = recordData;
    const total_price = weight * unit_price;
    const id = uuidv4();
    const created_at = Date.now();
    
    await runQuery(
        `INSERT INTO weighing_records 
         (id, sku_code, sku_name, weight, unit_price, total_price, batch_number, counter_code, operator_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, sku_code, sku_name, weight, unit_price, total_price, batch_number, counter_code, operator_id, created_at]
    );
    
    const labelId = uuidv4();
    await runQuery(
        `INSERT INTO label_versions 
         (id, weighing_record_id, version_number, print_time, operator_id, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [labelId, id, 1, created_at, operator_id, LABEL_STATUS.ACTIVE]
    );
    
    return {
        id,
        sku_code,
        sku_name,
        weight,
        unit_price,
        total_price,
        batch_number,
        counter_code,
        label_version: 1
    };
};

const getWeighingRecord = async (id) => {
    const record = await getQuery('SELECT * FROM weighing_records WHERE id = ?', [id]);
    if (!record) return null;
    
    const labels = await allQuery(
        'SELECT * FROM label_versions WHERE weighing_record_id = ? ORDER BY version_number DESC',
        [id]
    );
    
    return {
        ...record,
        label_versions: labels
    };
};

const createReprintRequest = async (requestData) => {
    const { weighing_record_id, reason, requester_id, requested_version } = requestData;
    
    const record = await getQuery('SELECT * FROM weighing_records WHERE id = ?', [weighing_record_id]);
    if (!record) {
        throw new Error('称重记录不存在');
    }
    
    const lock = await checkBatchLock(record.batch_number, record.counter_code);
    if (lock) {
        throw new Error(`批次 ${record.batch_number} 已被锁定，请联系管理员`);
    }
    
    const existingPending = await getQuery(
        `SELECT * FROM reprint_requests 
         WHERE weighing_record_id = ? AND status IN (?, ?)`,
        [weighing_record_id, REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED]
    );
    
    if (existingPending) {
        throw new Error('已有待处理或已批准的重打申请，请勿重复提交');
    }
    
    const labels = await allQuery(
        'SELECT * FROM label_versions WHERE weighing_record_id = ? ORDER BY version_number DESC',
        [weighing_record_id]
    );
    
    const currentVersion = labels.length > 0 ? labels[0].version_number : 0;
    const targetVersion = requested_version || currentVersion;
    
    if (targetVersion > currentVersion || targetVersion < 1) {
        throw new Error(`请求的版本 ${targetVersion} 无效，当前最高版本为 ${currentVersion}`);
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await runQuery(
        `INSERT INTO reprint_requests 
         (id, weighing_record_id, reason, current_version, requested_version, status, requester_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, weighing_record_id, reason, currentVersion, targetVersion, REQUEST_STATUS.PENDING, requester_id, now, now]
    );
    
    await auditLog(id, 'CREATE', requester_id, {
        weighing_record_id,
        reason,
        current_version: currentVersion,
        requested_version: targetVersion
    });
    
    return {
        id,
        weighing_record_id,
        reason,
        current_version: currentVersion,
        requested_version: targetVersion,
        status: REQUEST_STATUS.PENDING,
        requester_id,
        created_at: now
    };
};

const getReprintRequest = async (id) => {
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [id]);
    if (!request) return null;
    
    const record = await getQuery('SELECT * FROM weighing_records WHERE id = ?', [request.weighing_record_id]);
    const labels = await allQuery(
        'SELECT * FROM label_versions WHERE weighing_record_id = ? ORDER BY version_number DESC',
        [request.weighing_record_id]
    );
    const audits = await allQuery(
        'SELECT * FROM audit_logs WHERE request_id = ? ORDER BY timestamp DESC',
        [id]
    );
    
    return {
        ...request,
        weighing_record: record,
        label_versions: labels,
        audit_logs: audits
    };
};

const approveRequest = async (requestId, approverId) => {
    if (!checkPermission(approverId, 'APPROVE_REQUESTS')) {
        throw new Error('权限不足：无法审批该请求');
    }
    
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [requestId]);
    if (!request) {
        throw new Error('申请不存在');
    }
    
    if (request.status !== REQUEST_STATUS.PENDING) {
        throw new Error(`只能审批待处理的申请，当前状态：${request.status}`);
    }
    
    const now = Date.now();
    await runQuery(
        `UPDATE reprint_requests 
         SET status = ?, approver_id = ?, updated_at = ? 
         WHERE id = ?`,
        [REQUEST_STATUS.APPROVED, approverId, now, requestId]
    );
    
    await auditLog(requestId, 'APPROVE', approverId, {
        previous_status: REQUEST_STATUS.PENDING,
        new_status: REQUEST_STATUS.APPROVED
    });
    
    return {
        ...request,
        status: REQUEST_STATUS.APPROVED,
        approver_id: approverId,
        updated_at: now
    };
};

const rejectRequest = async (requestId, approverId, reason) => {
    if (!checkPermission(approverId, 'APPROVE_REQUESTS')) {
        throw new Error('权限不足：无法审批该请求');
    }
    
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [requestId]);
    if (!request) {
        throw new Error('申请不存在');
    }
    
    if (request.status !== REQUEST_STATUS.PENDING) {
        throw new Error(`只能审批待处理的申请，当前状态：${request.status}`);
    }
    
    const now = Date.now();
    await runQuery(
        `UPDATE reprint_requests 
         SET status = ?, approver_id = ?, updated_at = ? 
         WHERE id = ?`,
        [REQUEST_STATUS.REJECTED, approverId, now, requestId]
    );
    
    await auditLog(requestId, 'REJECT', approverId, {
        previous_status: REQUEST_STATUS.PENDING,
        new_status: REQUEST_STATUS.REJECTED,
        reason
    });
    
    return {
        ...request,
        status: REQUEST_STATUS.REJECTED,
        approver_id: approverId,
        updated_at: now
    };
};

const cancelRequest = async (requestId, operatorId) => {
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [requestId]);
    if (!request) {
        throw new Error('申请不存在');
    }
    
    if (request.requester_id !== operatorId && !checkPermission(operatorId, 'MODIFY_REQUESTS')) {
        throw new Error('只能取消自己提交的申请，或拥有管理员权限');
    }
    
    if (request.status !== REQUEST_STATUS.PENDING) {
        throw new Error(`只能取消待处理的申请，当前状态：${request.status}`);
    }
    
    const now = Date.now();
    await runQuery(
        `UPDATE reprint_requests 
         SET status = ?, updated_at = ? 
         WHERE id = ?`,
        [REQUEST_STATUS.CANCELLED, now, requestId]
    );
    
    await auditLog(requestId, 'CANCEL', operatorId, {
        previous_status: REQUEST_STATUS.PENDING,
        new_status: REQUEST_STATUS.CANCELLED
    });
    
    return {
        ...request,
        status: REQUEST_STATUS.CANCELLED,
        updated_at: now
    };
};

const executeReprint = async (requestId, operatorId) => {
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [requestId]);
    if (!request) {
        throw new Error('申请不存在');
    }
    
    if (request.status !== REQUEST_STATUS.APPROVED) {
        throw new Error(`只能执行已批准的申请，当前状态：${request.status}`);
    }
    
    const record = await getQuery('SELECT * FROM weighing_records WHERE id = ?', [request.weighing_record_id]);
    const labels = await allQuery(
        'SELECT * FROM label_versions WHERE weighing_record_id = ? ORDER BY version_number DESC',
        [request.weighing_record_id]
    );
    
    const currentVersion = labels.length > 0 ? labels[0].version_number : 0;
    const newVersion = currentVersion + 1;
    
    const targetLabel = labels.find(l => l.version_number === request.requested_version);
    if (!targetLabel) {
        throw new Error(`找不到版本 ${request.requested_version} 的标签数据`);
    }
    
    const labelId = uuidv4();
    const now = Date.now();
    
    await runQuery(
        `INSERT INTO label_versions 
         (id, weighing_record_id, version_number, print_time, operator_id, status, printed_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [labelId, request.weighing_record_id, newVersion, now, operatorId, LABEL_STATUS.ACTIVE, JSON.stringify({
            weight: record.weight,
            unit_price: record.unit_price,
            total_price: record.total_price,
            batch_number: record.batch_number,
            original_version: request.requested_version
        })]
    );
    
    await runQuery(
        `UPDATE reprint_requests 
         SET status = ?, updated_at = ? 
         WHERE id = ?`,
        [REQUEST_STATUS.COMPLETED, now, requestId]
    );
    
    await auditLog(requestId, 'EXECUTE', operatorId, {
        previous_status: REQUEST_STATUS.APPROVED,
        new_status: REQUEST_STATUS.COMPLETED,
        new_version: newVersion,
        original_data: {
            weight: record.weight,
            unit_price: record.unit_price,
            total_price: record.total_price,
            batch_number: record.batch_number
        }
    });
    
    return {
        ...request,
        status: REQUEST_STATUS.COMPLETED,
        updated_at: now,
        new_label_version: {
            version_number: newVersion,
            print_time: now,
            printed_data: {
                weight: record.weight,
                unit_price: record.unit_price,
                total_price: record.total_price,
                batch_number: record.batch_number,
                original_version: request.requested_version
            }
        }
    };
};

const modifyRequest = async (requestId, operatorId, modifications) => {
    if (!checkPermission(operatorId, 'MODIFY_REQUESTS')) {
        throw new Error('权限不足：无法修改申请');
    }
    
    const request = await getQuery('SELECT * FROM reprint_requests WHERE id = ?', [requestId]);
    if (!request) {
        throw new Error('申请不存在');
    }
    
    if (request.status !== REQUEST_STATUS.PENDING) {
        throw new Error(`只能修改待处理的申请，当前状态：${request.status}`);
    }
    
    const { reason, requested_version } = modifications;
    const updates = [];
    const params = [];
    
    if (reason) {
        updates.push('reason = ?');
        params.push(reason);
    }
    
    if (requested_version !== undefined) {
        const labels = await allQuery(
            'SELECT * FROM label_versions WHERE weighing_record_id = ? ORDER BY version_number DESC',
            [request.weighing_record_id]
        );
        const currentVersion = labels.length > 0 ? labels[0].version_number : 0;
        
        if (requested_version > currentVersion || requested_version < 1) {
            throw new Error(`请求的版本 ${requested_version} 无效，当前最高版本为 ${currentVersion}`);
        }
        
        updates.push('requested_version = ?');
        params.push(requested_version);
    }
    
    if (updates.length === 0) {
        return request;
    }
    
    const now = Date.now();
    updates.push('status = ?, updated_at = ?');
    params.push(REQUEST_STATUS.MODIFIED, now, requestId);
    
    await runQuery(
        `UPDATE reprint_requests SET ${updates.join(', ')} WHERE id = ?`,
        params
    );
    
    await auditLog(requestId, 'MODIFY', operatorId, {
        modifications,
        previous_status: REQUEST_STATUS.PENDING,
        new_status: REQUEST_STATUS.MODIFIED
    });
    
    return {
        ...request,
        ...modifications,
        status: REQUEST_STATUS.MODIFIED,
        updated_at: now
    };
};

const lockBatch = async (batchNumber, counterCode, operatorId, reason, expiresAt) => {
    if (!checkPermission(operatorId, 'MODIFY_REQUESTS')) {
        throw new Error('权限不足：无法锁定批次');
    }
    
    const lockId = uuidv4();
    const now = Date.now();
    
    try {
        await runQuery(
            `INSERT INTO batch_locks 
             (id, batch_number, counter_code, locked_by, reason, locked_at, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lockId, batchNumber, counterCode, operatorId, reason, now, expiresAt]
        );
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            throw new Error(`批次 ${batchNumber} 已被锁定`);
        }
        throw err;
    }
    
    await auditLog(null, 'LOCK_BATCH', operatorId, {
        batch_number: batchNumber,
        counter_code: counterCode,
        reason,
        expires_at: expiresAt
    });
    
    return {
        id: lockId,
        batch_number: batchNumber,
        counter_code: counterCode,
        locked_by: operatorId,
        reason,
        locked_at: now,
        expires_at: expiresAt
    };
};

const unlockBatch = async (batchNumber, counterCode, operatorId) => {
    if (!checkPermission(operatorId, 'MODIFY_REQUESTS')) {
        throw new Error('权限不足：无法解锁批次');
    }
    
    const result = await runQuery(
        'DELETE FROM batch_locks WHERE batch_number = ? AND counter_code = ?',
        [batchNumber, counterCode]
    );
    
    if (result.changes === 0) {
        throw new Error(`批次 ${batchNumber} 未被锁定`);
    }
    
    await auditLog(null, 'UNLOCK_BATCH', operatorId, {
        batch_number: batchNumber,
        counter_code: counterCode
    });
    
    return {
        batch_number: batchNumber,
        counter_code: counterCode,
        unlocked: true
    };
};

const getSummary = async (filters = {}) => {
    const { counter_code, status, start_date, end_date } = filters;
    
    let requestsQuery = 'SELECT * FROM reprint_requests WHERE 1=1';
    let recordsQuery = 'SELECT COUNT(*) as count FROM weighing_records WHERE 1=1';
    let labelsQuery = 'SELECT COUNT(*) as count FROM label_versions WHERE 1=1';
    let params = [];
    let recordParams = [];
    let labelParams = [];
    
    if (counter_code) {
        requestsQuery += ' AND weighing_record_id IN (SELECT id FROM weighing_records WHERE counter_code = ?)';
        recordsQuery += ' AND counter_code = ?';
        params.push(counter_code);
        recordParams.push(counter_code);
    }
    
    if (status) {
        requestsQuery += ' AND status = ?';
        params.push(status);
    }
    
    if (start_date) {
        requestsQuery += ' AND created_at >= ?';
        recordsQuery += ' AND created_at >= ?';
        labelsQuery += ' AND print_time >= ?';
        params.push(start_date);
        recordParams.push(start_date);
        labelParams.push(start_date);
    }
    
    if (end_date) {
        requestsQuery += ' AND created_at <= ?';
        recordsQuery += ' AND created_at <= ?';
        labelsQuery += ' AND print_time <= ?';
        params.push(end_date);
        recordParams.push(end_date);
        labelParams.push(end_date);
    }
    
    requestsQuery += ' ORDER BY created_at DESC';
    
    const requests = await allQuery(requestsQuery, params);
    const recordsCount = await getQuery(recordsQuery, recordParams);
    const labelsCount = await getQuery(labelsQuery, labelParams);
    
    const statusCounts = {};
    const enrichedRequests = await Promise.all(requests.map(async req => {
        statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
        
        const record = await getQuery('SELECT * FROM weighing_records WHERE id = ?', [req.weighing_record_id]);
        return {
            ...req,
            weighing_record: record ? {
                id: record.id,
                sku_code: record.sku_code,
                sku_name: record.sku_name,
                weight: record.weight,
                total_price: record.total_price,
                batch_number: record.batch_number
            } : null
        };
    }));
    
    return {
        statistics: {
            total_requests: requests.length,
            status_counts: statusCounts,
            total_records: recordsCount.count,
            total_labels: labelsCount.count
        },
        requests: enrichedRequests
    };
};

const getAuditLogs = async (filters = {}) => {
    const { request_id, operator_id, start_date, end_date, action } = filters;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    let params = [];
    
    if (request_id) {
        query += ' AND request_id = ?';
        params.push(request_id);
    }
    
    if (operator_id) {
        query += ' AND operator_id = ?';
        params.push(operator_id);
    }
    
    if (action) {
        query += ' AND action = ?';
        params.push(action);
    }
    
    if (start_date) {
        query += ' AND timestamp >= ?';
        params.push(start_date);
    }
    
    if (end_date) {
        query += ' AND timestamp <= ?';
        params.push(end_date);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    return await allQuery(query, params);
};

module.exports = {
    REQUEST_STATUS,
    LABEL_STATUS,
    createWeighingRecord,
    getWeighingRecord,
    createReprintRequest,
    getReprintRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    executeReprint,
    modifyRequest,
    lockBatch,
    unlockBatch,
    getSummary,
    getAuditLogs,
    checkPermission
};
