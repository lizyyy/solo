const { IdempotentRequest, STATUS } = require('../models/IdempotentRequest');
const { MediationRecord, ACTIONS } = require('../models/MediationRecord');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class IdempotentMediationService {
  static async createRequest(data) {
    const existing = await IdempotentRequest.findByRequestNo(data.request_no);
    if (existing) {
      return {
        success: false,
        code: 'DUPLICATE_REQUEST_NO',
        message: '请求号已存在',
        data: existing
      };
    }

    const activeRequests = await IdempotentRequest.findActiveInWindow(
      data.idempotent_key,
      data.business_type
    );

    const newFingerprint = IdempotentRequest.generateFingerprint(data.payload);

    for (const active of activeRequests) {
      if (active.payload_fingerprint === newFingerprint) {
        await MediationRecord.create({
          request_id: active.id,
          request_no: active.request_no,
          action: ACTIONS.HISTORY_REUSED,
          reason: '相同幂等键和载荷指纹，历史结果复用',
          before_status: active.status,
          after_status: active.status,
          original_input: data,
          processing_basis: `窗口匹配: 幂等键${data.idempotent_key}, 载荷指纹匹配`,
          final_conclusion: '复用历史请求结果'
        });

        return {
          success: true,
          code: 'HISTORY_REUSED',
          message: '相同幂等键和载荷，复用历史结果',
          data: active,
          isReuse: true
        };
      }

      if (active.payload_fingerprint !== newFingerprint) {
        await IdempotentRequest.updateStatus(active.id, STATUS.CONFLICT);
        await MediationRecord.create({
          request_id: active.id,
          request_no: active.request_no,
          action: ACTIONS.CONFLICT_DETECTED,
          reason: '相同幂等键但载荷不同，检测到冲突',
          before_status: active.status,
          after_status: STATUS.CONFLICT,
          original_input: data,
          processing_basis: `窗口匹配: 幂等键${data.idempotent_key}, 但载荷指纹不匹配`,
          final_conclusion: '标记为冲突状态，需要人工介入'
        });

        const newRequest = await IdempotentRequest.create(data);
        await MediationRecord.create({
          request_id: newRequest.id,
          request_no: newRequest.request_no,
          action: ACTIONS.CREATE,
          reason: '创建新请求（存在冲突但继续处理）',
          before_status: null,
          after_status: STATUS.PENDING,
          original_input: data,
          processing_basis: '用户选择继续处理冲突请求',
          final_conclusion: '新请求创建成功，状态为PENDING'
        });

        return {
          success: true,
          code: 'CONFLICT_CREATED',
          message: '检测到冲突，已创建新请求并标记原请求为冲突',
          data: newRequest,
          conflict: true
        };
      }
    }

    const newRequest = await IdempotentRequest.create(data);
    await MediationRecord.create({
      request_id: newRequest.id,
      request_no: newRequest.request_no,
      action: ACTIONS.CREATE,
      reason: '创建新请求',
      before_status: null,
      after_status: STATUS.PENDING,
      original_input: data,
      processing_basis: '无活跃窗口内的相同幂等键请求',
      final_conclusion: '新请求创建成功'
    });

    return {
      success: true,
      code: 'CREATED',
      message: '请求创建成功',
      data: newRequest
    };
  }

  static async getRequest(requestNo) {
    const request = await IdempotentRequest.findByRequestNo(requestNo);
    if (!request) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: '请求不存在'
      };
    }

    const records = await MediationRecord.findByRequestNo(requestNo);
    return {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: {
        request,
        mediation_records: records
      }
    };
  }

  static async updateStatus(requestNo, newStatus, result = null, operator = 'system') {
    const request = await IdempotentRequest.findByRequestNo(requestNo);
    if (!request) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: '请求不存在'
      };
    }

    const beforeStatus = request.status;
    await IdempotentRequest.updateStatus(request.id, newStatus, result);

    await MediationRecord.create({
      request_id: request.id,
      request_no: request.request_no,
      action: ACTIONS.STATUS_CHANGE,
      operator,
      reason: '状态推进',
      before_status: beforeStatus,
      after_status: newStatus,
      original_input: { newStatus, result },
      processing_basis: '业务系统状态更新',
      final_conclusion: `状态从 ${beforeStatus} 变更为 ${newStatus}`
    });

    return {
      success: true,
      code: 'STATUS_UPDATED',
      message: '状态更新成功',
      data: { before_status: beforeStatus, after_status: newStatus }
    };
  }

  static async handleException(requestNo, exceptionInfo, operator = 'system') {
    const request = await IdempotentRequest.findByRequestNo(requestNo);
    if (!request) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: '请求不存在'
      };
    }

    const beforeStatus = request.status;
    await IdempotentRequest.updateStatus(request.id, STATUS.FAILED, { error: exceptionInfo });

    await MediationRecord.create({
      request_id: request.id,
      request_no: request.request_no,
      action: ACTIONS.EXCEPTION_HANDLED,
      operator,
      reason: '异常处理',
      before_status: beforeStatus,
      after_status: STATUS.FAILED,
      original_input: exceptionInfo,
      processing_basis: '捕获到业务异常',
      final_conclusion: '异常处理完成，请求标记为失败'
    });

    return {
      success: true,
      code: 'EXCEPTION_HANDLED',
      message: '异常处理完成',
      data: { request_no: requestNo, status: STATUS.FAILED }
    };
  }

  static async manualCorrection(requestNo, correctionData, operator) {
    const request = await IdempotentRequest.findByRequestNo(requestNo);
    if (!request) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: '请求不存在'
      };
    }

    const beforeStatus = request.status;
    await IdempotentRequest.updateStatus(
      request.id,
      correctionData.status || STATUS.MANUAL_RESOLVED,
      correctionData.result
    );

    await MediationRecord.create({
      request_id: request.id,
      request_no: request.request_no,
      action: ACTIONS.MANUAL_CORRECTION,
      operator,
      reason: correctionData.reason,
      before_status: beforeStatus,
      after_status: correctionData.status || STATUS.MANUAL_RESOLVED,
      original_input: correctionData,
      processing_basis: correctionData.processing_basis || '人工介入处理',
      final_conclusion: correctionData.final_conclusion || '人工修正完成'
    });

    return {
      success: true,
      code: 'MANUAL_CORRECTED',
      message: '人工修正完成',
      data: {
        request_no: requestNo,
        before_status: beforeStatus,
        after_status: correctionData.status || STATUS.MANUAL_RESOLVED
      }
    };
  }

  static async listRequests(filters = {}, page = 1, pageSize = 20) {
    const result = await IdempotentRequest.list(filters, page, pageSize);
    return {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: result
    };
  }

  static async listMediationRecords(filters = {}, page = 1, pageSize = 20) {
    const result = await MediationRecord.list(filters, page, pageSize);
    return {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: result
    };
  }

  static async exportData(filters = {}, exportType = 'both') {
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = [];

    if (exportType === 'both' || exportType === 'requests') {
      const requests = await IdempotentRequest.getAllForExport(filters);
      const requestPath = path.join(exportDir, `requests_${timestamp}.csv`);

      const requestCsvWriter = createCsvWriter({
        path: requestPath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'request_no', title: '请求号' },
          { id: 'business_type', title: '业务类型' },
          { id: 'idempotent_key', title: '幂等键' },
          { id: 'time_window', title: '时间窗口(秒)' },
          { id: 'payload', title: '原始载荷' },
          { id: 'payload_fingerprint', title: '载荷指纹' },
          { id: 'status', title: '状态' },
          { id: 'result', title: '结果' },
          { id: 'created_at', title: '创建时间' },
          { id: 'expired_at', title: '过期时间' }
        ]
      });

      await requestCsvWriter.writeRecords(requests.map(r => ({
        ...r,
        payload: JSON.stringify(r.payload),
        result: r.result ? JSON.stringify(r.result) : ''
      })));

      files.push({ type: 'requests', path: requestPath });
    }

    if (exportType === 'both' || exportType === 'mediation') {
      const records = await MediationRecord.getAllForExport(filters);
      const mediationPath = path.join(exportDir, `mediation_${timestamp}.csv`);

      const mediationCsvWriter = createCsvWriter({
        path: mediationPath,
        header: [
          { id: 'id', title: '调停记录ID' },
          { id: 'request_id', title: '请求ID' },
          { id: 'request_no', title: '请求号' },
          { id: 'action', title: '操作类型' },
          { id: 'operator', title: '操作人' },
          { id: 'reason', title: '原因' },
          { id: 'before_status', title: '变更前状态' },
          { id: 'after_status', title: '变更后状态' },
          { id: 'original_input', title: '原始输入' },
          { id: 'processing_basis', title: '处理依据' },
          { id: 'final_conclusion', title: '最终结论' },
          { id: 'created_at', title: '创建时间' }
        ]
      });

      await mediationCsvWriter.writeRecords(records.map(r => ({
        ...r,
        original_input: r.original_input ? JSON.stringify(r.original_input) : ''
      })));

      files.push({ type: 'mediation', path: mediationPath });
    }

    return {
      success: true,
      code: 'EXPORT_SUCCESS',
      message: '导出成功',
      data: { files, timestamp }
    };
  }
}

module.exports = IdempotentMediationService;
