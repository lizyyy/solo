import NodeCache from 'node-cache';
import moment from 'moment';
import {
  whitelistModel,
  WhitelistRecord,
  WhitelistStatus,
  CreateWhitelistRequest,
  UpdateWhitelistRequest,
  ApproveWhitelistRequest,
  RateLimitRule
} from '../models/whitelist.model';

export class WhitelistValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhitelistValidationError';
  }
}

export class WhitelistService {
  private cache: NodeCache;
  private readonly CACHE_TTL = 300;

  constructor() {
    this.cache = new NodeCache({ stdTTL: this.CACHE_TTL, checkperiod: 60 });
  }

  validateCreateRequest(request: CreateWhitelistRequest): void {
    if (!request.tenantId?.trim()) {
      throw new WhitelistValidationError('租户ID不能为空');
    }
    if (!request.tenantName?.trim()) {
      throw new WhitelistValidationError('租户名称不能为空');
    }
    if (!request.apiGroupId?.trim()) {
      throw new WhitelistValidationError('接口组ID不能为空');
    }
    if (!request.apiGroupName?.trim()) {
      throw new WhitelistValidationError('接口组名称不能为空');
    }
    if (!request.rateLimitRule) {
      throw new WhitelistValidationError('限流规则不能为空');
    }
    this.validateRateLimitRule(request.rateLimitRule);
    if (!request.effectiveDate) {
      throw new WhitelistValidationError('生效日期不能为空');
    }
    if (!request.expiryDate) {
      throw new WhitelistValidationError('失效日期不能为空');
    }
    if (new Date(request.effectiveDate) >= new Date(request.expiryDate)) {
      throw new WhitelistValidationError('生效日期必须早于失效日期');
    }
    if (!request.applicant?.trim()) {
      throw new WhitelistValidationError('申请人不能为空');
    }
    if (!request.reason?.trim()) {
      throw new WhitelistValidationError('申请原因不能为空');
    }
  }

  validateRateLimitRule(rule: RateLimitRule): void {
    if (!rule.maxRequests || rule.maxRequests <= 0) {
      throw new WhitelistValidationError('限流请求数必须大于0');
    }
    if (!rule.unit) {
      throw new WhitelistValidationError('限流时间单位不能为空');
    }
  }

  validateStatusTransition(
    currentStatus: WhitelistStatus,
    targetStatus: WhitelistStatus
  ): boolean {
    const validTransitions: Record<WhitelistStatus, WhitelistStatus[]> = {
      [WhitelistStatus.PENDING_APPROVAL]: [
        WhitelistStatus.ACTIVE,
        WhitelistStatus.REJECTED,
        WhitelistStatus.REVOKED
      ],
      [WhitelistStatus.ACTIVE]: [
        WhitelistStatus.EXPIRING_SOON,
        WhitelistStatus.EXPIRED,
        WhitelistStatus.REVOKED
      ],
      [WhitelistStatus.EXPIRING_SOON]: [
        WhitelistStatus.EXPIRED,
        WhitelistStatus.REVOKED
      ],
      [WhitelistStatus.EXPIRED]: [],
      [WhitelistStatus.REVOKED]: [
        WhitelistStatus.PENDING_APPROVAL
      ],
      [WhitelistStatus.REJECTED]: [
        WhitelistStatus.PENDING_APPROVAL
      ]
    };

    return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
  }

  calculateStatus(record: WhitelistRecord): WhitelistStatus {
    const now = new Date();
    const effectiveDate = new Date(record.effectiveDate);
    const expiryDate = new Date(record.expiryDate);

    if (
      record.status === WhitelistStatus.REVOKED ||
      record.status === WhitelistStatus.REJECTED ||
      record.status === WhitelistStatus.PENDING_APPROVAL
    ) {
      return record.status;
    }

    if (now < effectiveDate) {
      return WhitelistStatus.PENDING_APPROVAL;
    }

    if (now > expiryDate) {
      return WhitelistStatus.EXPIRED;
    }

    const daysUntilExpiry = moment(expiryDate).diff(moment(now), 'days');
    if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
      return WhitelistStatus.EXPIRING_SOON;
    }

    return WhitelistStatus.ACTIVE;
  }

  checkDuplicate(tenantId: string, apiGroupId: string, excludeId?: string): boolean {
    const existing = whitelistModel
      .findByTenantAndApiGroup(tenantId, apiGroupId)
      .filter(
        r =>
          r.id !== excludeId &&
          (r.status === WhitelistStatus.PENDING_APPROVAL ||
            r.status === WhitelistStatus.ACTIVE ||
            r.status === WhitelistStatus.EXPIRING_SOON)
      );
    return existing.length > 0;
  }

  create(request: CreateWhitelistRequest): WhitelistRecord {
    this.validateCreateRequest(request);

    if (this.checkDuplicate(request.tenantId, request.apiGroupId)) {
      throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
    }

    return whitelistModel.create(request);
  }

  findById(id: string): WhitelistRecord | undefined {
    return whitelistModel.findById(id);
  }

  findAll(filters?: {
    tenantId?: string;
    apiGroupId?: string;
    status?: WhitelistStatus;
  }): WhitelistRecord[] {
    return whitelistModel.findAll(filters);
  }

  getHistories(recordId: string) {
    return whitelistModel.getHistories(recordId);
  }

  approve(id: string, request: ApproveWhitelistRequest): WhitelistRecord {
    const record = whitelistModel.findById(id);
    if (!record) {
      throw new WhitelistValidationError('白名单记录不存在');
    }

    if (!this.validateStatusTransition(record.status, WhitelistStatus.ACTIVE)) {
      throw new WhitelistValidationError(
        `当前状态${record.status}不允许执行审批操作`
      );
    }

    const result = whitelistModel.approve(id, request.approver, request.remark);
    if (result) {
      this.updateCache(result);
    }
    return result!;
  }

  reject(id: string, approver: string, remark?: string): WhitelistRecord {
    const record = whitelistModel.findById(id);
    if (!record) {
      throw new WhitelistValidationError('白名单记录不存在');
    }

    if (!this.validateStatusTransition(record.status, WhitelistStatus.REJECTED)) {
      throw new WhitelistValidationError(
        `当前状态${record.status}不允许执行拒绝操作`
      );
    }

    return whitelistModel.reject(id, approver, remark)!;
  }

  revoke(id: string, operator: string, remark?: string): WhitelistRecord {
    const record = whitelistModel.findById(id);
    if (!record) {
      throw new WhitelistValidationError('白名单记录不存在');
    }

    if (!this.validateStatusTransition(record.status, WhitelistStatus.REVOKED)) {
      throw new WhitelistValidationError(
        `当前状态${record.status}不允许执行撤回操作`
      );
    }

    const result = whitelistModel.revoke(id, operator, remark);
    if (result) {
      this.clearCache(result.tenantId, result.apiGroupId);
    }
    return result!;
  }

  resubmit(id: string, operator: string): WhitelistRecord {
    const record = whitelistModel.findById(id);
    if (!record) {
      throw new WhitelistValidationError('白名单记录不存在');
    }

    if (
      record.status !== WhitelistStatus.REVOKED &&
      record.status !== WhitelistStatus.REJECTED
    ) {
      throw new WhitelistValidationError('只有已撤回或已拒绝的记录才能重新提交');
    }

    if (this.checkDuplicate(record.tenantId, record.apiGroupId, id)) {
      throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
    }

    return whitelistModel.updateStatus(
      id,
      WhitelistStatus.PENDING_APPROVAL,
      operator,
      '重新提交申请'
    )!;
  }

  update(
    id: string,
    updates: UpdateWhitelistRequest,
    operator: string
  ): WhitelistRecord {
    const record = whitelistModel.findById(id);
    if (!record) {
      throw new WhitelistValidationError('白名单记录不存在');
    }

    if (record.status !== WhitelistStatus.PENDING_APPROVAL) {
      throw new WhitelistValidationError('只有待审批状态的记录才能修改');
    }

    if (updates.rateLimitRule) {
      this.validateRateLimitRule(updates.rateLimitRule);
    }

    if (updates.effectiveDate && updates.expiryDate) {
      if (new Date(updates.effectiveDate) >= new Date(updates.expiryDate)) {
        throw new WhitelistValidationError('生效日期必须早于失效日期');
      }
    }

    const result = whitelistModel.update(id, updates, operator);
    return result!;
  }

  checkWhitelist(tenantId: string, apiGroupId: string): {
    allowed: boolean;
    rule?: RateLimitRule;
  } {
    const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
    const cached = this.cache.get<{ allowed: boolean; rule?: RateLimitRule }>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const records = whitelistModel
      .findByTenantAndApiGroup(tenantId, apiGroupId)
      .filter(r => {
        const status = this.calculateStatus(r);
        return status === WhitelistStatus.ACTIVE || status === WhitelistStatus.EXPIRING_SOON;
      });

    const result =
      records.length > 0
        ? { allowed: true, rule: records[0].rateLimitRule }
        : { allowed: false };

    this.cache.set(cacheKey, result);
    return result;
  }

  forceExpireCache(tenantId: string, apiGroupId: string): void {
    const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
    this.cache.del(cacheKey);
  }

  private updateCache(record: WhitelistRecord): void {
    const cacheKey = `whitelist:${record.tenantId}:${record.apiGroupId}`;
    this.cache.set(cacheKey, {
      allowed: true,
      rule: record.rateLimitRule
    });
  }

  private clearCache(tenantId: string, apiGroupId: string): void {
    const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
    this.cache.del(cacheKey);
  }

  bulkImport(requests: CreateWhitelistRequest[]): {
    success: WhitelistRecord[];
    failed: { row: number; error: string; data: CreateWhitelistRequest }[];
  } {
    const success: WhitelistRecord[] = [];
    const failed: { row: number; error: string; data: CreateWhitelistRequest }[] = [];

    requests.forEach((data, index) => {
      try {
        this.validateCreateRequest(data);
        if (this.checkDuplicate(data.tenantId, data.apiGroupId)) {
          throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
        }
        const record = whitelistModel.create(data);
        success.push(record);
      } catch (error) {
        failed.push({
          row: index + 1,
          error: error instanceof Error ? error.message : '未知错误',
          data
        });
      }
    });

    return { success, failed };
  }

  export(): WhitelistRecord[] {
    return whitelistModel.export().map(record => ({
      ...record,
      status: this.calculateStatus(record)
    }));
  }

  refreshStatuses(): void {
    const records = whitelistModel.findAll();
    records.forEach(record => {
      const newStatus = this.calculateStatus(record);
      if (newStatus !== record.status) {
        whitelistModel.updateStatus(
          record.id,
          newStatus,
          'system',
          '系统自动更新状态'
        );
        if (newStatus === WhitelistStatus.EXPIRED) {
          this.clearCache(record.tenantId, record.apiGroupId);
        }
      }
    });
  }

  clearAll(): void {
    whitelistModel.clear();
    this.cache.flushAll();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}

export const whitelistService = new WhitelistService();
