const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const { ErrorCode, AppError } = require('../utils/errors');
const { ApprovalStatus, ApprovalAction, QuotaActionType } = require('../utils/constants');
const QuotaModel = require('../models/QuotaModel');
const ApprovalRecordModel = require('../models/ApprovalRecordModel');
const QuotaOperationModel = require('../models/QuotaOperationModel');
const AuditLogModel = require('../models/AuditLogModel');

class QuotaService {
  static _hashStringToInt32(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash | 0;
  }

  static _getRequestIdLockKeys(requestId) {
    const seed1 = this._hashStringToInt32('quota_approval:' + requestId);
    const seed2 = this._hashStringToInt32(requestId + ':v1');
    return [seed1, seed2];
  }

  static async _acquireRequestIdLock(requestId, client) {
    const [key1, key2] = this._getRequestIdLockKeys(requestId);
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [key1, key2]
    );
  }

  static async _findExistingApprovalRecord(requestId, client) {
    return await ApprovalRecordModel.findByRequestId(requestId, client);
  }

  static async applyQuota(data, reqInfo = {}) {
    const validation = this._validateApplyData(data);
    if (!validation.valid) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '参数验证失败', validation.errors);
    }

    const { quotaCode, applyAmount, applicant, reason, requestId } = validation.value;

    try {
      return await db.transaction(async (client) => {
        await this._acquireRequestIdLock(requestId, client);

        const existingRecord = await this._findExistingApprovalRecord(requestId, client);
        if (existingRecord) {
          logger.info(`检测到重复请求，requestId=${requestId}，直接返回已有记录`);
          return this._buildApplyResponse(existingRecord);
        }

        const quota = await QuotaModel.findByCode(quotaCode, client);
        if (!quota) {
          throw new AppError(ErrorCode.QUOTA_NOT_FOUND, `限额 ${quotaCode} 不存在`);
        }

        this._validateQuotaAvailability(quota, applyAmount);

        const updatedQuota = await QuotaModel.updateOccupiedAmount(
          quota.id, 
          applyAmount, 
          quota.version,
          client
        );
        if (!updatedQuota) {
          const latestQuota = await QuotaModel.findByCode(quotaCode, client);
          const latestAvailable = parseFloat(latestQuota?.available_amount || 0);
          if (latestAvailable < applyAmount) {
            throw new AppError(
              ErrorCode.QUOTA_INSUFFICIENT,
              `限额不足，可用: ${latestAvailable}，申请: ${applyAmount}`
            );
          }
          throw new AppError(ErrorCode.CONCURRENT_CONFLICT, '并发冲突，限额更新失败，请重试');
        }

        const approvalTimeoutSeconds = parseInt(process.env.APPROVAL_TIMEOUT_SECONDS) || 3600;
        const expiredAt = new Date(Date.now() + approvalTimeoutSeconds * 1000);

        let approvalRecord;
        try {
          approvalRecord = await ApprovalRecordModel.create({
            requestId,
            quotaId: quota.id,
            quotaCode: quota.quota_code,
            applyAmount,
            applicant,
            reason,
            expiredAt,
          }, client);
        } catch (insertError) {
          if (insertError.code === '23505') {
            logger.info(`检测到唯一键冲突，requestId=${requestId}，查询已有记录`);
            const existingAfterConflict = await this._findExistingApprovalRecord(requestId, client);
            if (existingAfterConflict) {
              return this._buildApplyResponse(existingAfterConflict);
            }
          }
          throw insertError;
        }

        await QuotaOperationModel.create({
          quotaId: quota.id,
          quotaCode: quota.quota_code,
          approvalRecordId: approvalRecord.id,
          requestId,
          operationType: QuotaActionType.OCCUPY,
          amount: applyAmount,
          operator: applicant,
          description: `审批申请占用限额，申请金额: ${applyAmount}`,
        }, client);

        await AuditLogModel.create({
          auditType: 'QUOTA_OPERATION',
          entityType: 'APPROVAL',
          entityId: requestId,
          action: ApprovalAction.SUBMIT,
          beforeData: null,
          afterData: {
            quotaCode,
            applyAmount,
            applicant,
            reason,
            status: ApprovalStatus.PENDING,
          },
          operator: applicant,
          ipAddress: reqInfo.ip,
          userAgent: reqInfo.userAgent,
        }, client);

        logger.info(`成功创建审批申请，requestId=${requestId}, quotaCode=${quotaCode}, amount=${applyAmount}`);

        return this._buildApplyResponse(approvalRecord, updatedQuota);
      });
    } catch (outerError) {
      if (outerError.code === '23505' || outerError.name === 'UniqueViolationError') {
        logger.info(`外层捕获唯一键冲突，requestId=${requestId}，查询已有记录`);
        const existingRecord = await ApprovalRecordModel.findByRequestId(requestId);
        if (existingRecord) {
          return this._buildApplyResponse(existingRecord);
        }
      }
      throw outerError;
    }
  }

  static async approveApproval(requestId, approver, comments, reqInfo = {}) {
    if (!requestId) {
      throw new AppError(ErrorCode.MISSING_REQUIRED_FIELD, '缺少 requestId');
    }

    return await db.transaction(async (client) => {
      await this._acquireRequestIdLock(requestId, client);

      const approvalRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
      if (!approvalRecord) {
        throw new AppError(ErrorCode.APPROVAL_NOT_FOUND, `审批记录 ${requestId} 不存在`);
      }

      if (approvalRecord.status !== ApprovalStatus.PENDING) {
        if (approvalRecord.status === ApprovalStatus.APPROVED) {
          logger.info(`检测到重复审批通过请求，requestId=${requestId}，直接返回`);
          return this._buildApprovalResponse(approvalRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_NOT_PENDING, `审批状态为 ${approvalRecord.status}，无法审批`);
      }

      const quota = await QuotaModel.findById(approvalRecord.quota_id, client);
      if (!quota) {
        throw new AppError(ErrorCode.QUOTA_NOT_FOUND, '关联的限额不存在');
      }

      const updatedQuota = await QuotaModel.deductFromOccupied(
        quota.id,
        parseFloat(approvalRecord.apply_amount),
        quota.version,
        client
      );
      if (!updatedQuota) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.APPROVED) {
          logger.info(`检测到并发审批通过，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.CONCURRENT_CONFLICT, '并发冲突，限额更新失败，请重试');
      }

      const updatedRecord = await ApprovalRecordModel.updateStatus(
        approvalRecord.id,
        ApprovalStatus.APPROVED,
        approver,
        comments,
        client
      );

      if (!updatedRecord) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.APPROVED) {
          logger.info(`检测到并发审批通过，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_ALREADY_PROCESSED, '审批已被处理');
      }

      await QuotaOperationModel.create({
        quotaId: quota.id,
        quotaCode: quota.quota_code,
        approvalRecordId: approvalRecord.id,
        requestId,
        operationType: QuotaActionType.DEDUCT,
        amount: approvalRecord.apply_amount,
        operator: approver,
        description: `审批通过，从占用中扣除限额，金额: ${approvalRecord.apply_amount}`,
      }, client);

      await AuditLogModel.create({
        auditType: 'APPROVAL_OPERATION',
        entityType: 'APPROVAL',
        entityId: requestId,
        action: ApprovalAction.APPROVE,
        beforeData: { status: ApprovalStatus.PENDING },
        afterData: { status: ApprovalStatus.APPROVED, approver, comments },
        operator: approver,
        ipAddress: reqInfo.ip,
        userAgent: reqInfo.userAgent,
      }, client);

      logger.info(`审批通过，requestId=${requestId}, amount=${approvalRecord.apply_amount}`);

      return this._buildApprovalResponse(updatedRecord, updatedQuota);
    });
  }

  static async rejectApproval(requestId, approver, comments, reqInfo = {}) {
    if (!requestId) {
      throw new AppError(ErrorCode.MISSING_REQUIRED_FIELD, '缺少 requestId');
    }

    return await db.transaction(async (client) => {
      await this._acquireRequestIdLock(requestId, client);

      const approvalRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
      if (!approvalRecord) {
        throw new AppError(ErrorCode.APPROVAL_NOT_FOUND, `审批记录 ${requestId} 不存在`);
      }

      if (approvalRecord.status !== ApprovalStatus.PENDING) {
        if (approvalRecord.status === ApprovalStatus.REJECTED) {
          logger.info(`检测到重复驳回请求，requestId=${requestId}，直接返回`);
          return this._buildApprovalResponse(approvalRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_NOT_PENDING, `审批状态为 ${approvalRecord.status}，无法驳回`);
      }

      const quota = await QuotaModel.findById(approvalRecord.quota_id, client);
      if (!quota) {
        throw new AppError(ErrorCode.QUOTA_NOT_FOUND, '关联的限额不存在');
      }

      const applyAmount = parseFloat(approvalRecord.apply_amount);
      const updatedQuota = await QuotaModel.releaseOccupiedAmount(
        quota.id, 
        applyAmount,
        quota.version,
        client
      );
      if (!updatedQuota) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.REJECTED) {
          logger.info(`检测到并发驳回，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.CONCURRENT_CONFLICT, '并发冲突，限额更新失败，请重试');
      }

      const updatedRecord = await ApprovalRecordModel.updateStatus(
        approvalRecord.id,
        ApprovalStatus.REJECTED,
        approver,
        comments,
        client
      );

      if (!updatedRecord) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.REJECTED) {
          logger.info(`检测到并发驳回，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_ALREADY_PROCESSED, '审批已被处理');
      }

      await QuotaOperationModel.create({
        quotaId: quota.id,
        quotaCode: quota.quota_code,
        approvalRecordId: approvalRecord.id,
        requestId,
        operationType: QuotaActionType.RELEASE,
        amount: applyAmount,
        operator: approver,
        description: `审批驳回，释放占用限额，金额: ${applyAmount}`,
      }, client);

      await AuditLogModel.create({
        auditType: 'APPROVAL_OPERATION',
        entityType: 'APPROVAL',
        entityId: requestId,
        action: ApprovalAction.REJECT,
        beforeData: { status: ApprovalStatus.PENDING },
        afterData: { status: ApprovalStatus.REJECTED, approver, comments },
        operator: approver,
        ipAddress: reqInfo.ip,
        userAgent: reqInfo.userAgent,
      }, client);

      logger.info(`审批驳回，requestId=${requestId}, 已释放金额: ${applyAmount}`);

      return this._buildApprovalResponse(updatedRecord, updatedQuota);
    });
  }

  static async cancelApproval(requestId, operator, comments, reqInfo = {}) {
    if (!requestId) {
      throw new AppError(ErrorCode.MISSING_REQUIRED_FIELD, '缺少 requestId');
    }

    return await db.transaction(async (client) => {
      await this._acquireRequestIdLock(requestId, client);

      const approvalRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
      if (!approvalRecord) {
        throw new AppError(ErrorCode.APPROVAL_NOT_FOUND, `审批记录 ${requestId} 不存在`);
      }

      if (approvalRecord.status !== ApprovalStatus.PENDING) {
        if (approvalRecord.status === ApprovalStatus.CANCELED) {
          logger.info(`检测到重复撤回请求，requestId=${requestId}，直接返回`);
          return this._buildApprovalResponse(approvalRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_NOT_PENDING, `审批状态为 ${approvalRecord.status}，无法撤回`);
      }

      const quota = await QuotaModel.findById(approvalRecord.quota_id, client);
      if (!quota) {
        throw new AppError(ErrorCode.QUOTA_NOT_FOUND, '关联的限额不存在');
      }

      const applyAmount = parseFloat(approvalRecord.apply_amount);
      const updatedQuota = await QuotaModel.releaseOccupiedAmount(
        quota.id, 
        applyAmount,
        quota.version,
        client
      );
      if (!updatedQuota) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.CANCELED) {
          logger.info(`检测到并发撤回，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.CONCURRENT_CONFLICT, '并发冲突，限额更新失败，请重试');
      }

      const updatedRecord = await ApprovalRecordModel.updateStatus(
        approvalRecord.id,
        ApprovalStatus.CANCELED,
        operator,
        comments,
        client
      );

      if (!updatedRecord) {
        const latestRecord = await ApprovalRecordModel.findByRequestId(requestId, client);
        if (latestRecord && latestRecord.status === ApprovalStatus.CANCELED) {
          logger.info(`检测到并发撤回，requestId=${requestId}，返回已有结果`);
          return this._buildApprovalResponse(latestRecord);
        }
        throw new AppError(ErrorCode.APPROVAL_ALREADY_PROCESSED, '审批已被处理');
      }

      await QuotaOperationModel.create({
        quotaId: quota.id,
        quotaCode: quota.quota_code,
        approvalRecordId: approvalRecord.id,
        requestId,
        operationType: QuotaActionType.RELEASE,
        amount: applyAmount,
        operator,
        description: `审批撤回，释放占用限额，金额: ${applyAmount}`,
      }, client);

      await AuditLogModel.create({
        auditType: 'APPROVAL_OPERATION',
        entityType: 'APPROVAL',
        entityId: requestId,
        action: ApprovalAction.CANCEL,
        beforeData: { status: ApprovalStatus.PENDING },
        afterData: { status: ApprovalStatus.CANCELED, operator, comments },
        operator,
        ipAddress: reqInfo.ip,
        userAgent: reqInfo.userAgent,
      }, client);

      logger.info(`审批撤回，requestId=${requestId}, 已释放金额: ${applyAmount}`);

      return this._buildApprovalResponse(updatedRecord, updatedQuota);
    });
  }

  static async getApprovalStatus(requestId) {
    if (!requestId) {
      throw new AppError(ErrorCode.MISSING_REQUIRED_FIELD, '缺少 requestId');
    }

    const approvalRecord = await ApprovalRecordModel.findByRequestId(requestId);
    if (!approvalRecord) {
      throw new AppError(ErrorCode.APPROVAL_NOT_FOUND, `审批记录 ${requestId} 不存在`);
    }

    return this._buildStatusResponse(approvalRecord);
  }

  static _validateApplyData(data) {
    const schema = Joi.object({
      quotaCode: Joi.string().required().max(64),
      applyAmount: Joi.number().positive().precision(2).required(),
      applicant: Joi.string().required().max(128),
      reason: Joi.string().optional().max(1000),
      requestId: Joi.string().optional().max(64),
    });

    const { error, value } = schema.validate(data);
    if (error) {
      return {
        valid: false,
        errors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      };
    }

    value.requestId = value.requestId || uuidv4();
    return { valid: true, value };
  }

  static _validateQuotaAvailability(quota, applyAmount) {
    if (!quota.is_active) {
      throw new AppError(ErrorCode.QUOTA_DISABLED, `限额 ${quota.quota_code} 已禁用`);
    }

    if (quota.effective_end_date && new Date() > new Date(quota.effective_end_date)) {
      throw new AppError(ErrorCode.QUOTA_EXPIRED, `限额 ${quota.quota_code} 已过期`);
    }

    const available = parseFloat(quota.available_amount);
    if (available < applyAmount) {
      throw new AppError(
        ErrorCode.QUOTA_INSUFFICIENT,
        `限额不足，可用: ${available}，申请: ${applyAmount}`
      );
    }
  }

  static _buildApplyResponse(record, quota = null) {
    return {
      requestId: record.request_id,
      approvalId: record.id,
      quotaCode: record.quota_code,
      applyAmount: parseFloat(record.apply_amount),
      status: record.status,
      applicant: record.applicant,
      expiredAt: record.expired_at,
      createdAt: record.created_at,
      quotaSnapshot: quota ? {
        total: parseFloat(quota.total_amount),
        used: parseFloat(quota.used_amount),
        occupied: parseFloat(quota.occupied_amount),
        available: parseFloat(quota.available_amount),
      } : null,
    };
  }

  static _buildApprovalResponse(record, quota = null) {
    return {
      requestId: record.request_id,
      approvalId: record.id,
      quotaCode: record.quota_code,
      applyAmount: parseFloat(record.apply_amount),
      status: record.status,
      approver: record.approver,
      approvalComments: record.approval_comments,
      updatedAt: record.updated_at,
      quotaSnapshot: quota ? {
        total: parseFloat(quota.total_amount),
        used: parseFloat(quota.used_amount),
        occupied: parseFloat(quota.occupied_amount),
        available: parseFloat(quota.available_amount),
      } : null,
    };
  }

  static _buildStatusResponse(record) {
    return {
      requestId: record.request_id,
      approvalId: record.id,
      quotaCode: record.quota_code,
      applyAmount: parseFloat(record.apply_amount),
      status: record.status,
      applicant: record.applicant,
      reason: record.reason,
      approver: record.approver,
      approvalComments: record.approval_comments,
      expiredAt: record.expired_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

module.exports = QuotaService;
