const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const db = require('../models');
const { Op } = require('sequelize');
const config = require('../config');
const AuditService = require('./audit-service');
const DateUtils = require('../utils/date-utils');
const { BadRequestError, BusinessRuleError } = require('../utils/errors');
const { BLACKLIST_STATUS, EXEMPTION_STATUS, BLACKLIST_SOURCE_TYPE } = require('../core/constants');

class ExportService {
  static async createRequest(data, requestContext) {
    const maxRecords = config.export.maxRecordsPerExport || 10000;
    const format = data.format || 'csv';

    const exportRecord = await db.ExportRecord.create({
      type: data.type,
      format,
      requesterId: requestContext.userId,
      requesterName: requestContext.displayName,
      businessLineId: requestContext.businessLineId,
      filters: data.filters || {},
      status: 'processing',
      processingStartedAt: new Date(),
      expiresAt: DateUtils.addDays(new Date(), 7),
    });

    try {
      const result = await this.processExport(
        exportRecord,
        data.filters || {},
        requestContext
      );

      await exportRecord.update({
        status: 'completed',
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        filePath: result.filePath,
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        completedAt: new Date(),
      });

      await AuditService.recordExportAction(exportRecord, requestContext, {
        recordCount: result.recordCount,
        format,
      });

      return {
        id: exportRecord.id,
        code: exportRecord.code,
        status: 'completed',
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        downloadUrl: result.fileUrl,
        expiresAt: exportRecord.expiresAt,
      };
    } catch (error) {
      await exportRecord.update({
        status: 'failed',
        errorMessage: error.message,
      });

      throw error;
    }
  }

  static async processExport(exportRecord, filters, requestContext) {
    let data;
    let headers;

    switch (exportRecord.type) {
      case 'blacklist':
        ({ data, headers } = await this.getBlacklistData(filters, requestContext));
        break;
      case 'hit_records':
        ({ data, headers } = await this.getHitRecordsData(filters, requestContext));
        break;
      case 'audit_logs':
        ({ data, headers } = await this.getAuditLogsData(filters, requestContext));
        break;
      case 'risk_report':
        ({ data, headers } = await this.getRiskReportData(filters, requestContext));
        break;
      default:
        throw new BadRequestError(`不支持的导出类型: ${exportRecord.type}`);
    }

    if (data.length === 0) {
      throw new BusinessRuleError('没有符合条件的数据可供导出');
    }

    if (data.length > (config.export.maxRecordsPerExport || 10000)) {
      throw new BusinessRuleError(
        `导出数据量超出限制（最多${config.export.maxRecordsPerExport || 10000}条），请缩小筛选范围`
      );
    }

    const exportDir = this.ensureExportDirectory();
    const fileName = this.generateFileName(exportRecord);
    const filePath = path.join(exportDir, fileName);

    let fileSize = 0;

    if (exportRecord.format === 'csv') {
      fileSize = await this.writeCsv(filePath, headers, data);
    } else if (exportRecord.format === 'json') {
      fileSize = await this.writeJson(filePath, data);
    }

    return {
      recordCount: data.length,
      fileSize,
      filePath,
      fileName,
      fileUrl: `/api/exports/${exportRecord.code}/download`,
    };
  }

  static async getBlacklistData(filters, requestContext) {
    const where = this.buildBlacklistWhere(filters, requestContext);

    const records = await db.Blacklist.findAll({
      where,
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['code', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const data = await Promise.all(
      records.map(async (r) => {
        const activeExemption = await this.getActiveExemption(r.id);
        const hitCount = await db.HitRecord.count({
          where: { blacklistId: r.id, isHit: true },
        });

        return {
          member_identifier: r.memberIdentifier,
          identifier_type: r.identifierType,
          member_name: r.memberName || '',
          status: this.translateBlacklistStatus(r.status),
          effective_status: r.status === 'active' && activeExemption ? 'exempted' : r.status,
          reason: r.reason || '',
          source_type: this.translateSourceType(r.sourceType),
          source_reference: r.sourceReference || '',
          business_line: r.businessLine?.name || '',
          is_shared: r.isShared ? '是' : '否',
          is_manually_corrected: r.isManuallyCorrected ? '是' : '否',
          manual_correction_reason: r.manualCorrectionReason || '',
          has_active_exemption: activeExemption ? '是' : '否',
          exemption_type: activeExemption?.type ? this.translateExemptionType(activeExemption.type) : '',
          exemption_expiry: activeExemption?.expiryDate ? DateUtils.format(activeExemption.expiryDate) : '',
          hit_count: hitCount,
          last_hit_at: r.lastHitAt ? DateUtils.format(r.lastHitAt) : '',
          created_at: DateUtils.format(r.createdAt),
          removed_at: r.removedAt ? DateUtils.format(r.removedAt) : '',
          removal_reason: r.removalReason || '',
        };
      })
    );

    const headers = [
      { id: 'member_identifier', title: '会员标识' },
      { id: 'identifier_type', title: '标识类型' },
      { id: 'member_name', title: '会员姓名' },
      { id: 'status', title: '原始状态' },
      { id: 'effective_status', title: '有效状态' },
      { id: 'reason', title: '原因' },
      { id: 'source_type', title: '来源类型' },
      { id: 'source_reference', title: '来源参考' },
      { id: 'business_line', title: '所属业务线' },
      { id: 'is_shared', title: '是否共享' },
      { id: 'is_manually_corrected', title: '是否人工修正' },
      { id: 'manual_correction_reason', title: '人工修正原因' },
      { id: 'has_active_exemption', title: '是否有有效豁免' },
      { id: 'exemption_type', title: '豁免类型' },
      { id: 'exemption_expiry', title: '豁免到期时间' },
      { id: 'hit_count', title: '命中次数' },
      { id: 'last_hit_at', title: '最后命中时间' },
      { id: 'created_at', title: '创建时间' },
      { id: 'removed_at', title: '移除时间' },
      { id: 'removal_reason', title: '移除原因' },
    ];

    return { data, headers };
  }

  static async getHitRecordsData(filters, requestContext) {
    const where = this.buildHitRecordsWhere(filters, requestContext);

    const records = await db.HitRecord.findAll({
      where,
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['code', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const data = records.map((r) => ({
      check_time: DateUtils.format(r.createdAt),
      member_identifier: r.memberIdentifier,
      identifier_type: r.identifierType,
      is_hit: r.isHit ? '是' : '否',
      blacklist_status: r.blacklistStatus || '',
      effective_status: r.effectiveStatus || '',
      hit_reason: r.hitReason || '',
      source_version: r.sourceVersion || '',
      business_line: r.businessLine?.name || '',
      requester: r.requesterName || '',
      request_context: r.requestContext || '',
      request_reference: r.requestReference || '',
      ip_address: r.ipAddress || '',
    }));

    const headers = [
      { id: 'check_time', title: '检查时间' },
      { id: 'member_identifier', title: '会员标识' },
      { id: 'identifier_type', title: '标识类型' },
      { id: 'is_hit', title: '是否命中' },
      { id: 'blacklist_status', title: '黑名单状态' },
      { id: 'effective_status', title: '有效状态' },
      { id: 'hit_reason', title: '命中原因' },
      { id: 'source_version', title: '检查版本' },
      { id: 'business_line', title: '请求业务线' },
      { id: 'requester', title: '请求人' },
      { id: 'request_context', title: '请求场景' },
      { id: 'request_reference', title: '请求参考' },
      { id: 'ip_address', title: 'IP地址' },
    ];

    return { data, headers };
  }

  static async getAuditLogsData(filters, requestContext) {
    const where = this.buildAuditLogsWhere(filters, requestContext);

    const records = await db.AuditLog.findAll({
      where,
      include: [
        {
          model: db.User,
          as: 'actor',
          attributes: ['username', 'displayName', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const data = records.map((r) => ({
      action_time: DateUtils.format(r.createdAt),
      action: this.translateAuditAction(r.action),
      entity_type: this.translateEntityType(r.entityType),
      actor: r.actor?.displayName || r.actorName || '',
      actor_role: this.translateRole(r.actorRole),
      business_line_id: r.businessLineId || '',
      metadata: r.metadata ? JSON.stringify(r.metadata) : '',
      ip_address: r.ipAddress || '',
    }));

    const headers = [
      { id: 'action_time', title: '操作时间' },
      { id: 'action', title: '操作类型' },
      { id: 'entity_type', title: '操作对象' },
      { id: 'actor', title: '操作人' },
      { id: 'actor_role', title: '操作人角色' },
      { id: 'business_line_id', title: '所属业务线' },
      { id: 'metadata', title: '操作详情' },
      { id: 'ip_address', title: 'IP地址' },
    ];

    return { data, headers };
  }

  static async getRiskReportData(filters, requestContext) {
    const where = this.buildBlacklistWhere(filters, requestContext);

    const blacklists = await db.Blacklist.findAll({
      where,
      include: [
        {
          model: db.Exemption,
          as: 'exemptions',
        },
      ],
      order: [['hitCount', 'DESC']],
      limit: 500,
    });

    const data = await Promise.all(
      blacklists.map(async (b) => {
        const approvedExemptions = b.exemptions?.filter(
          (e) => e.status === EXEMPTION_STATUS.APPROVED
        ) || [];

        const activeExemptions = approvedExemptions.filter(
          (e) => e.type === 'permanent' || new Date() < new Date(e.expiryDate)
        );

        const daysActive = b.createdAt
          ? DateUtils.diffInDays(new Date(), b.createdAt)
          : 0;

        const riskLevel = this.calculateRiskLevel(
          b.hitCount,
          activeExemptions.length,
          daysActive
        );

        return {
          member_identifier: b.memberIdentifier,
          member_name: b.memberName || '',
          status: this.translateBlacklistStatus(b.status),
          hit_count: b.hitCount,
          exemption_count: activeExemptions.length,
          days_active: daysActive,
          risk_level: this.translateRiskLevel(riskLevel),
          is_manually_corrected: b.isManuallyCorrected ? '是' : '否',
          reason: b.reason || '',
          source_type: this.translateSourceType(b.sourceType),
          last_hit_at: b.lastHitAt ? DateUtils.format(b.lastHitAt) : '',
          created_at: DateUtils.format(b.createdAt),
        };
      })
    );

    const headers = [
      { id: 'member_identifier', title: '会员标识' },
      { id: 'member_name', title: '会员姓名' },
      { id: 'status', title: '状态' },
      { id: 'hit_count', title: '命中次数' },
      { id: 'exemption_count', title: '豁免次数' },
      { id: 'days_active', title: '活跃天数' },
      { id: 'risk_level', title: '风险等级' },
      { id: 'is_manually_corrected', title: '是否人工修正' },
      { id: 'reason', title: '原因' },
      { id: 'source_type', title: '来源类型' },
      { id: 'last_hit_at', title: '最后命中时间' },
      { id: 'created_at', title: '加入时间' },
    ];

    return { data, headers };
  }

  static buildBlacklistWhere(filters, requestContext) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.isShared !== undefined) {
      where.isShared = filters.isShared;
    }

    if (filters.memberIdentifier) {
      where.memberIdentifier = {
        [Op.like]: `%${filters.memberIdentifier}%`,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    if (requestContext.role !== 'admin' && requestContext.businessLineId) {
      where[Op.or] = [
        { businessLineId: requestContext.businessLineId },
        { isShared: true },
      ];
    }

    return where;
  }

  static buildHitRecordsWhere(filters, requestContext) {
    const where = {};

    if (filters.isHit !== undefined) {
      where.isHit = filters.isHit;
    }

    if (filters.memberIdentifier) {
      where.memberIdentifier = {
        [Op.like]: `%${filters.memberIdentifier}%`,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    if (requestContext.role !== 'admin' && requestContext.businessLineId) {
      where.businessLineId = requestContext.businessLineId;
    }

    return where;
  }

  static buildAuditLogsWhere(filters, requestContext) {
    const where = {};

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    if (requestContext.role !== 'admin' && requestContext.businessLineId) {
      where.businessLineId = requestContext.businessLineId;
    }

    return where;
  }

  static async getActiveExemption(blacklistId) {
    const exemptions = await db.Exemption.findAll({
      where: {
        blacklistId,
        status: EXEMPTION_STATUS.APPROVED,
      },
    });

    return exemptions.find(
      (e) => e.type === 'permanent' || new Date() < new Date(e.expiryDate)
    );
  }

  static ensureExportDirectory() {
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  static generateFileName(exportRecord) {
    const typeNames = {
      blacklist: '黑名单数据',
      hit_records: '命中记录',
      audit_logs: '审计日志',
      risk_report: '风险报表',
    };

    const typeName = typeNames[exportRecord.type] || exportRecord.type;
    const timestamp = DateUtils.format(new Date(), 'YYYYMMDDHHmmss');
    const extension = exportRecord.format === 'csv' ? 'csv' : 'json';

    return `${typeName}_${exportRecord.code}_${timestamp}.${extension}`;
  }

  static async writeCsv(filePath, headers, data) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
      encoding: 'utf8',
    });

    await csvWriter.writeRecords(data);
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  static async writeJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  static async getDownloadInfo(code, requestContext) {
    const exportRecord = await db.ExportRecord.findOne({
      where: { code },
    });

    if (!exportRecord) {
      return null;
    }

    if (
      exportRecord.requesterId !== requestContext.userId &&
      requestContext.role !== 'admin'
    ) {
      if (
        exportRecord.businessLineId &&
        exportRecord.businessLineId !== requestContext.businessLineId
      ) {
        return null;
      }
    }

    if (exportRecord.expiresAt && new Date() > new Date(exportRecord.expiresAt)) {
      await exportRecord.update({ status: 'expired' });
      return null;
    }

    if (exportRecord.status !== 'completed') {
      return null;
    }

    return {
      filePath: exportRecord.filePath,
      fileName: exportRecord.fileName,
      recordCount: exportRecord.recordCount,
      fileSize: exportRecord.fileSize,
    };
  }

  static async listMyExports(requestContext, filters = {}, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const where = {
      requesterId: requestContext.userId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const { count, rows } = await db.ExportRecord.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
      page,
      limit,
    };
  }

  static translateBlacklistStatus(status) {
    const translations = {
      active: '有效',
      inactive: '已移除',
      exempted: '已豁免',
      manually_corrected: '已人工修正',
    };
    return translations[status] || status;
  }

  static translateSourceType(sourceType) {
    const translations = {
      manual: '手工录入',
      api_import: 'API导入',
      batch_upload: '批量上传',
      risk_detection: '风险检测',
      legacy_sync: '历史同步',
    };
    return translations[sourceType] || sourceType;
  }

  static translateExemptionType(type) {
    const translations = {
      temporary: '临时豁免',
      permanent: '永久豁免',
      emergency: '紧急豁免',
    };
    return translations[type] || type;
  }

  static translateAuditAction(action) {
    const translations = {
      add: '添加',
      remove: '移除',
      update: '更新',
      sync: '同步',
      hit: '命中',
      manual_correct: '人工修正',
      exemption_request: '申请豁免',
      exemption_approve: '审批豁免',
      exemption_reject: '拒绝豁免',
      exemption_expire: '豁免过期',
      exemption_revoke: '撤销豁免',
      version_publish: '发布版本',
      version_archive: '归档版本',
      export: '导出数据',
      login: '登录',
    };
    return translations[action] || action;
  }

  static translateEntityType(entityType) {
    const translations = {
      blacklist: '黑名单',
      exemption: '豁免',
      share_version: '共享版本',
      user: '用户',
      export: '导出',
    };
    return translations[entityType] || entityType;
  }

  static translateRole(role) {
    const translations = {
      admin: '管理员',
      operator: '操作员',
      approver: '审批员',
      viewer: '查看员',
    };
    return translations[role] || role;
  }

  static translateRiskLevel(level) {
    const translations = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '极高',
    };
    return translations[level] || level;
  }

  static calculateRiskLevel(hitCount, exemptionCount, daysActive) {
    let score = 0;
    if (hitCount > 10) score += 3;
    else if (hitCount > 5) score += 2;
    else if (hitCount > 0) score += 1;
    if (exemptionCount > 3) score += 2;
    else if (exemptionCount > 0) score += 1;
    if (daysActive > 90) score += 2;
    else if (daysActive > 30) score += 1;

    if (score >= 5) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  }
}

module.exports = ExportService;
