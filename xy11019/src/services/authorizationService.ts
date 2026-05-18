import { v4 as uuidv4 } from 'uuid';
import {
  PickupAuthorization,
  AuthorizationStatus,
  SubmissionSource
} from '../models/types';
import { dataStore } from '../data/store';
import { stateMachine } from './stateMachine';
import { businessRulesService } from './businessRules';

export interface CreateAuthorizationRequest {
  childId: string;
  childName: string;
  guardianId: string;
  guardianName: string;
  pickupType: string;
  relationType: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  daysOfWeek?: number[];
  specificDates?: string[];
  startTime?: string;
  endTime?: string;
  notes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  idVerificationRequired?: boolean;
  submittedBy: string;
  submissionSource: SubmissionSource;
}

export interface UpdateStatusRequest {
  id: string;
  newStatus: AuthorizationStatus;
  changedBy: string;
  reason: string;
  role: string;
}

export class AuthorizationService {
  createAuthorization(request: CreateAuthorizationRequest): PickupAuthorization {
    const now = new Date().toISOString();
    const authorization: PickupAuthorization = {
      id: uuidv4(),
      childId: request.childId,
      childName: request.childName,
      guardianId: request.guardianId,
      guardianName: request.guardianName,
      pickupType: request.pickupType as any,
      relationType: request.relationType as any,
      effectiveStartDate: request.effectiveStartDate,
      effectiveEndDate: request.effectiveEndDate,
      daysOfWeek: request.daysOfWeek,
      specificDates: request.specificDates,
      startTime: request.startTime,
      endTime: request.endTime,
      status: AuthorizationStatus.DRAFT,
      statusHistory: [],
      notes: request.notes,
      emergencyContactName: request.emergencyContactName,
      emergencyContactPhone: request.emergencyContactPhone,
      idVerificationRequired: request.idVerificationRequired ?? true,
      photoVerified: false,
      submissionSource: request.submissionSource,
      submittedAt: now,
      submittedBy: request.submittedBy,
      createdAt: now,
      updatedAt: now
    };

    const consistency = businessRulesService.checkConsistency(authorization);
    if (!consistency.isValid) {
      throw new Error(`授权数据验证失败: ${consistency.issues.map(i => i.message).join('; ')}`);
    }

    dataStore.addAuthorization(authorization);
    return authorization;
  }

  updateAuthorizationStatus(request: UpdateStatusRequest): PickupAuthorization {
    const authorization = dataStore.getAuthorizationById(request.id);
    if (!authorization) {
      throw new Error('授权记录不存在');
    }

    const validation = stateMachine.validateStatusTransition(
      authorization.status,
      request.newStatus,
      request.role
    );

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    if (request.newStatus === AuthorizationStatus.APPROVED) {
      const approvalCheck = businessRulesService.canApproveAuthorization(authorization);
      if (!approvalCheck.allowed) {
        throw new Error(`无法批准: ${approvalCheck.reasons.join('; ')}`);
      }
    }

    const statusRecord = stateMachine.createStatusChangeRecord(
      authorization.status,
      request.newStatus,
      request.changedBy,
      request.reason
    );

    const updatedAuthorization = dataStore.updateAuthorization(request.id, {
      status: request.newStatus,
      statusHistory: [...authorization.statusHistory, statusRecord],
      reviewedAt: request.newStatus !== AuthorizationStatus.DRAFT ? new Date().toISOString() : undefined,
      reviewedBy: request.newStatus !== AuthorizationStatus.DRAFT ? request.changedBy : undefined,
      reviewNotes: request.newStatus !== AuthorizationStatus.DRAFT ? request.reason : undefined
    });

    if (!updatedAuthorization) {
      throw new Error('更新授权状态失败');
    }

    return updatedAuthorization;
  }

  getAuthorizationConsistency(id: string) {
    const authorization = dataStore.getAuthorizationById(id);
    if (!authorization) {
      throw new Error('授权记录不存在');
    }
    return businessRulesService.checkConsistency(authorization);
  }

  validatePickup(guardianId: string, childId: string) {
    return businessRulesService.validateGuardianForPickup(guardianId, childId);
  }

  expireAuthorizationsForGuardian(guardianId: string): PickupAuthorization[] {
    const authorizations = dataStore.getAuthorizationsByGuardianId(guardianId);
    const today = new Date().toISOString().split('T')[0];
    
    return authorizations.map(auth => {
      if (auth.status === AuthorizationStatus.APPROVED && auth.effectiveEndDate < today) {
        return dataStore.updateAuthorization(auth.id, {
          status: AuthorizationStatus.EXPIRED,
          statusHistory: [...auth.statusHistory, stateMachine.createStatusChangeRecord(
            auth.status,
            AuthorizationStatus.EXPIRED,
            'system',
            '授权自动过期'
          )]
        });
      }
      return auth;
    }).filter((a): a is PickupAuthorization => a !== undefined);
  }
}

export const authorizationService = new AuthorizationService();
