import {
  PickupAuthorization,
  Guardian,
  PickupType,
  RelationType,
  AuthorizationStatus,
  ConsistencyCheckResult,
  ConsistencyIssue
} from '../models/types';
import { dataStore } from '../data/store';

export class BusinessRulesService {
  checkBlacklistConflict(authorization: PickupAuthorization): ConsistencyIssue | null {
    const guardian = dataStore.getGuardianById(authorization.guardianId);
    if (!guardian) return null;

    if (guardian.isBlacklisted) {
      const blacklistEntry = dataStore.getBlacklistByGuardianId(guardian.id);
      return {
        type: 'blacklist_conflict',
        severity: 'error',
        message: `接送人 ${guardian.name} 已被列入黑名单: ${blacklistEntry?.reason || '未提供原因'}`,
        affectedAuthorizationId: authorization.id,
        details: {
          guardianId: guardian.id,
          blacklistReason: blacklistEntry?.reason,
          blacklistedAt: blacklistEntry?.reportedAt
        }
      };
    }
    return null;
  }

  checkTemporaryGrandparentPickup(authorization: PickupAuthorization): ConsistencyIssue | null {
    const isGrandparent = [RelationType.GRANDFATHER, RelationType.GRANDMOTHER].includes(authorization.relationType);
    const isTemporary = authorization.pickupType === PickupType.TEMPORARY;

    if (isGrandparent && isTemporary) {
      const startDate = new Date(authorization.effectiveStartDate);
      const endDate = new Date(authorization.effectiveEndDate);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 7) {
        return {
          type: 'overlapping_authorization',
          severity: 'warning',
          message: '祖辈临时接送授权建议有效期不超过7天，请确认是否需要常规授权',
          affectedAuthorizationId: authorization.id,
          details: { daysDiff, recommendedMaxDays: 7 }
        };
      }
    }
    return null;
  }

  checkOverlappingAuthorizations(authorization: PickupAuthorization): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const existingAuthorizations = dataStore.getAuthorizationsByChildId(authorization.childId)
      .filter(a => a.id !== authorization.id && a.status === AuthorizationStatus.APPROVED);

    const newStart = new Date(authorization.effectiveStartDate);
    const newEnd = new Date(authorization.effectiveEndDate);

    for (const existing of existingAuthorizations) {
      const existingStart = new Date(existing.effectiveStartDate);
      const existingEnd = new Date(existing.effectiveEndDate);

      if (!(newEnd < existingStart || newStart > existingEnd)) {
        issues.push({
          type: 'overlapping_authorization',
          severity: 'warning',
          message: `与现有授权重叠: ${existing.guardianName} (${existing.effectiveStartDate} 至 ${existing.effectiveEndDate})`,
          affectedAuthorizationId: existing.id,
          details: {
            overlappingWith: existing.id,
            overlappingGuardian: existing.guardianName,
            existingPeriod: `${existing.effectiveStartDate} - ${existing.effectiveEndDate}`
          }
        });
      }
    }
    return issues;
  }

  checkDateValidity(authorization: PickupAuthorization): ConsistencyIssue | null {
    const startDate = new Date(authorization.effectiveStartDate);
    const endDate = new Date(authorization.effectiveEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < startDate) {
      return {
        type: 'invalid_dates',
        severity: 'error',
        message: '结束日期不能早于开始日期',
        affectedAuthorizationId: authorization.id
      };
    }

    if (authorization.status === AuthorizationStatus.APPROVED && endDate < today) {
      return {
        type: 'expired',
        severity: 'warning',
        message: '授权已过期，请续期或重新申请',
        affectedAuthorizationId: authorization.id
      };
    }

    return null;
  }

  checkRequiredFields(authorization: PickupAuthorization): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const requiredFields: Array<keyof PickupAuthorization> = [
      'childId',
      'childName',
      'guardianId',
      'guardianName',
      'pickupType',
      'relationType',
      'effectiveStartDate',
      'effectiveEndDate',
      'submittedBy',
      'submissionSource'
    ];

    for (const field of requiredFields) {
      if (!authorization[field]) {
        issues.push({
          type: 'missing_fields',
          severity: 'error',
          message: `缺少必填字段: ${field}`,
          affectedAuthorizationId: authorization.id
        });
      }
    }

    return issues;
  }

  checkConsistency(authorization: PickupAuthorization): ConsistencyCheckResult {
    const issues: ConsistencyIssue[] = [];

    issues.push(...this.checkRequiredFields(authorization));

    const dateIssue = this.checkDateValidity(authorization);
    if (dateIssue) issues.push(dateIssue);

    const blacklistIssue = this.checkBlacklistConflict(authorization);
    if (blacklistIssue) issues.push(blacklistIssue);

    issues.push(...this.checkOverlappingAuthorizations(authorization));

    const grandparentIssue = this.checkTemporaryGrandparentPickup(authorization);
    if (grandparentIssue) issues.push(grandparentIssue);

    return {
      isValid: issues.every(i => i.severity !== 'error'),
      issues
    };
  }

  canApproveAuthorization(authorization: PickupAuthorization): { allowed: boolean; reasons: string[] } {
    const consistency = this.checkConsistency(authorization);
    const errors = consistency.issues.filter(i => i.severity === 'error');
    
    return {
      allowed: errors.length === 0 && authorization.status === AuthorizationStatus.PENDING_REVIEW,
      reasons: errors.map(e => e.message)
    };
  }

  validateGuardianForPickup(guardianId: string, childId: string): { valid: boolean; message?: string } {
    const guardian = dataStore.getGuardianById(guardianId);
    if (!guardian) {
      return { valid: false, message: '接送人不存在' };
    }

    if (guardian.isBlacklisted) {
      return { valid: false, message: `接送人已被列入黑名单: ${guardian.blacklistReason}` };
    }

    const activeAuthorization = dataStore.getAuthorizationsByChildId(childId).find(
      a => a.guardianId === guardianId && 
           a.status === AuthorizationStatus.APPROVED &&
           new Date(a.effectiveStartDate) <= new Date() &&
           new Date(a.effectiveEndDate) >= new Date()
    );

    if (!activeAuthorization) {
      return { valid: false, message: '该接送人对此儿童无有效接送授权' };
    }

    return { valid: true };
  }
}

export const businessRulesService = new BusinessRulesService();
