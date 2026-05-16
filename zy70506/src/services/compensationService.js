const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../database');

const STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  NEED_MANUAL_CONFIRM: 'NEED_MANUAL_CONFIRM',
  MANUAL_FIXED: 'MANUAL_FIXED',
  CANCELLED: 'CANCELLED'
};

const COMPENSATION_STATUS_TRANSITIONS = {
  [STATUS.PENDING]: [STATUS.PROCESSING, STATUS.CANCELLED],
  [STATUS.PROCESSING]: [STATUS.SUCCESS, STATUS.FAILED, STATUS.NEED_MANUAL_CONFIRM],
  [STATUS.FAILED]: [STATUS.PROCESSING, STATUS.NEED_MANUAL_CONFIRM, STATUS.CANCELLED],
  [STATUS.NEED_MANUAL_CONFIRM]: [STATUS.MANUAL_FIXED, STATUS.CANCELLED],
  [STATUS.SUCCESS]: [],
  [STATUS.MANUAL_FIXED]: [],
  [STATUS.CANCELLED]: []
};

class CompensationService {
  static async createCompensation(data) {
    const { approval_no, business_order_no, callback_event, compensation_action, raw_input, created_by, max_retry = 3 } = data;

    const existing = await getAsync(
      'SELECT * FROM compensation_records WHERE approval_no = ? AND callback_event = ?',
      [approval_no, callback_event]
    );

    if (existing) {
      throw {
        code: 'DUPLICATE_COMPENSATION',
        message: `该审批单 ${approval_no} 的 ${callback_event} 回调补偿已存在`,
        details: { existing_id: existing.id, status: existing.status }
      };
    }

    const id = uuidv4();
    await runAsync(
      `INSERT INTO compensation_records 
       (id, approval_no, business_order_no, callback_event, compensation_action, status, raw_input, created_by, max_retry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, approval_no, business_order_no, callback_event, compensation_action, STATUS.PENDING, JSON.stringify(raw_input), created_by, max_retry]
    );

    await this.addLog(id, 'CREATE', created_by, { data });
    return this.getCompensationById(id);
  }

  static async identifyGap(approvals) {
    const gaps = [];
    for (const approval of approvals) {
      const { approval_no, business_order_no, expected_events } = approval;
      
      for (const event of expected_events) {
        const record = await getAsync(
          'SELECT * FROM compensation_records WHERE approval_no = ? AND callback_event = ?',
          [approval_no, event]
        );
        
        if (!record) {
          gaps.push({
            approval_no,
            business_order_no,
            callback_event: event,
            gap_type: 'MISSING_CALLBACK'
          });
        }
      }
    }
    return gaps;
  }

  static async startCompensation(id, operator) {
    const record = await this.getCompensationById(id);
    if (!record) {
      throw { code: 'NOT_FOUND', message: '补偿记录不存在' };
    }

    if (record.status === STATUS.PROCESSING) {
      throw {
        code: 'COMPENSATION_IN_PROGRESS',
        message: '补偿正在进行中，禁止重复操作',
        details: { id, status: record.status }
      };
    }

    if (!COMPENSATION_STATUS_TRANSITIONS[record.status].includes(STATUS.PROCESSING)) {
      throw {
        code: 'INVALID_STATUS_TRANSITION',
        message: `当前状态 ${record.status} 无法开始补偿`,
        allowed_next: COMPENSATION_STATUS_TRANSITIONS[record.status]
      };
    }

    if (record.retry_count >= record.max_retry) {
      throw {
        code: 'MAX_RETRY_EXCEEDED',
        message: `已达最大重试次数 ${record.max_retry}，需要人工确认`,
        details: { retry_count: record.retry_count, max_retry: record.max_retry }
      };
    }

    await runAsync(
      'UPDATE compensation_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [STATUS.PROCESSING, id]
    );

    await this.addLog(id, 'START_PROCESSING', operator);
    return this.getCompensationById(id);
  }

  static async processCompensation(id, processing_evidence) {
    const record = await this.getCompensationById(id);
    if (!record) {
      throw { code: 'NOT_FOUND', message: '补偿记录不存在' };
    }

    if (record.status !== STATUS.PROCESSING) {
      throw {
        code: 'INVALID_STATUS',
        message: '只有PROCESSING状态才能执行补偿'
      };
    }

    const success = Math.random() > 0.3;
    const newRetryCount = record.retry_count + 1;

    if (success) {
      await runAsync(
        `UPDATE compensation_records 
         SET status = ?, retry_count = ?, processing_evidence = ?, final_conclusion = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [STATUS.SUCCESS, newRetryCount, JSON.stringify(processing_evidence), JSON.stringify({ result: 'success', timestamp: new Date().toISOString() }), id]
      );
      await this.addLog(id, 'COMPENSATION_SUCCESS', 'system', { evidence: processing_evidence });
    } else {
      const errorMessage = '回调超时，目标系统无响应';
      if (newRetryCount >= record.max_retry) {
        await runAsync(
          `UPDATE compensation_records 
           SET status = ?, retry_count = ?, error_message = ?, processing_evidence = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [STATUS.NEED_MANUAL_CONFIRM, newRetryCount, errorMessage, JSON.stringify(processing_evidence), id]
        );
        await this.addLog(id, 'NEED_MANUAL_CONFIRM', 'system', { error: errorMessage });
      } else {
        await runAsync(
          `UPDATE compensation_records 
           SET status = ?, retry_count = ?, error_message = ?, processing_evidence = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [STATUS.FAILED, newRetryCount, errorMessage, JSON.stringify(processing_evidence), id]
        );
        await this.addLog(id, 'COMPENSATION_FAILED', 'system', { error: errorMessage, retry_count: newRetryCount });
      }
    }

    return this.getCompensationById(id);
  }

  static async manualFix(id, data) {
    const { handled_by, final_conclusion, raw_input_override } = data;
    const record = await this.getCompensationById(id);
    
    if (!record) {
      throw { code: 'NOT_FOUND', message: '补偿记录不存在' };
    }

    if (record.status !== STATUS.NEED_MANUAL_CONFIRM) {
      throw {
        code: 'INVALID_STATUS',
        message: '只有 NEED_MANUAL_CONFIRM 状态才能进行人工修正',
        current_status: record.status
      };
    }

    await runAsync(
      `UPDATE compensation_records 
       SET status = ?, handled_by = ?, final_conclusion = ?, raw_input = COALESCE(?, raw_input), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [STATUS.MANUAL_FIXED, handled_by, JSON.stringify(final_conclusion), raw_input_override ? JSON.stringify(raw_input_override) : null, id]
    );

    await this.addLog(id, 'MANUAL_FIX', handled_by, { final_conclusion });
    return this.getCompensationById(id);
  }

  static async cancelCompensation(id, operator, reason) {
    const record = await this.getCompensationById(id);
    if (!record) {
      throw { code: 'NOT_FOUND', message: '补偿记录不存在' };
    }

    if (![STATUS.PENDING, STATUS.FAILED, STATUS.NEED_MANUAL_CONFIRM].includes(record.status)) {
      throw {
        code: 'INVALID_STATUS',
        message: '当前状态不允许取消'
      };
    }

    await runAsync(
      `UPDATE compensation_records 
       SET status = ?, final_conclusion = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [STATUS.CANCELLED, JSON.stringify({ reason, cancelled_by: operator, cancelled_at: new Date().toISOString() }), id]
    );

    await this.addLog(id, 'CANCEL', operator, { reason });
    return this.getCompensationById(id);
  }

  static async getCompensationById(id) {
    const record = await getAsync('SELECT * FROM compensation_records WHERE id = ?', [id]);
    if (record) {
      return this.parseRecord(record);
    }
    return null;
  }

  static async queryCompensations(params = {}) {
    const { status, approval_no, business_order_no, page = 1, page_size = 20 } = params;
    
    let whereClauses = [];
    let queryParams = [];

    if (status) {
      whereClauses.push('status = ?');
      queryParams.push(status);
    }
    if (approval_no) {
      whereClauses.push('approval_no = ?');
      queryParams.push(approval_no);
    }
    if (business_order_no) {
      whereClauses.push('business_order_no = ?');
      queryParams.push(business_order_no);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * page_size;

    const records = await allAsync(
      `SELECT * FROM compensation_records ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, page_size, offset]
    );

    const countResult = await getAsync(
      `SELECT COUNT(*) as total FROM compensation_records ${whereSql}`,
      queryParams
    );

    return {
      list: records.map(r => this.parseRecord(r)),
      pagination: {
        page: parseInt(page),
        page_size: parseInt(page_size),
        total: countResult.total
      }
    };
  }

  static async exportCompensations(params = {}) {
    const result = await this.queryCompensations({ ...params, page_size: 10000 });
    return result.list;
  }

  static async addLog(record_id, action, operator, details = {}) {
    const id = uuidv4();
    await runAsync(
      'INSERT INTO compensation_logs (id, record_id, action, operator, details) VALUES (?, ?, ?, ?, ?)',
      [id, record_id, action, operator, JSON.stringify(details)]
    );
  }

  static async getLogs(record_id) {
    const logs = await allAsync('SELECT * FROM compensation_logs WHERE record_id = ? ORDER BY created_at DESC', [record_id]);
    return logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }));
  }

  static parseRecord(record) {
    return {
      ...record,
      raw_input: record.raw_input ? JSON.parse(record.raw_input) : null,
      processing_evidence: record.processing_evidence ? JSON.parse(record.processing_evidence) : null,
      final_conclusion: record.final_conclusion ? JSON.parse(record.final_conclusion) : null
    };
  }

  static get STATUS() {
    return STATUS;
  }
}

module.exports = CompensationService;