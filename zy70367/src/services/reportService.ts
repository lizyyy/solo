import {
  ImportBatch,
  ImportRecord,
  BatchReport,
  BatchStatus,
  RecordStatus,
  User,
  PrecheckWarning
} from '../types';
import { store } from '../store/memoryStore';

interface UserWithRevokeInfo extends User {
  sourceBatchId?: string;
  sourceBatchName?: string;
  revokeStatus?: string;
  revokeErrorMessage?: string;
  isPreExistingInBatch?: boolean;
  importStatus?: string;
}

class ReportService {
  private static instance: ReportService;
  
  private constructor() {}
  
  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }
  
  generateBatchReport(batchId: string): BatchReport {
    const batch = store.findBatchById(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    const records = store.getRecordsByBatchId(batchId);
    const stats = store.getBatchStats(batchId);
    
    const reportRecords = records.map(record => {
      const canBeRevoked = this.canBeRevoked(record);
      
      return {
        email: record.email,
        name: record.name,
        status: record.status,
        isPreExisting: record.isPreExisting,
        canBeRevoked,
        errorMessage: record.errorMessage,
        revokeErrorMessage: record.revokeErrorMessage
      };
    });
    
    return {
      batchId: batch.id,
      batchName: batch.name,
      status: batch.status,
      summary: {
        total: stats.total,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        failed: stats.failed,
        revoked: stats.revoked,
        notRevocable: stats.notRevocable,
        revokeFailed: stats.revokeFailed
      },
      records: reportRecords,
      warnings: batch.precheckWarnings
    };
  }
  
  canBeRevoked(record: ImportRecord): boolean {
    if (record.status === RecordStatus.REVOKED) {
      return true;
    }
    
    if (record.status === RecordStatus.NOT_REVOCABLE) {
      return false;
    }
    
    if (record.isPreExisting && record.status === RecordStatus.CREATED) {
      return false;
    }
    
    if (record.status === RecordStatus.SKIPPED || record.status === RecordStatus.FAILED) {
      return true;
    }
    
    if (record.status === RecordStatus.CREATED || record.status === RecordStatus.UPDATED) {
      return true;
    }
    
    if (record.status === RecordStatus.REVOKE_FAILED) {
      return true;
    }
    
    return false;
  }
  
  getUsersWithBatchSource(): UserWithRevokeInfo[] {
    const users = store.getAllUsers();
    const batches = new Map(store.getAllBatches().map(b => [b.id, b]));
    
    const usersWithInfo: UserWithRevokeInfo[] = [];
    
    users.forEach(user => {
      const userInfo: UserWithRevokeInfo = {
        ...user,
        sourceBatchId: user.sourceBatchId
      };
      
      if (user.sourceBatchId) {
        const batch = batches.get(user.sourceBatchId);
        if (batch) {
          userInfo.sourceBatchName = batch.name;
          
          const record = store.findRecordByBatchAndEmail(user.sourceBatchId, user.email);
          if (record) {
            userInfo.isPreExistingInBatch = record.isPreExisting;
            userInfo.importStatus = record.status;
            
            if (record.status === RecordStatus.REVOKED || 
                record.status === RecordStatus.REVOKE_FAILED ||
                record.status === RecordStatus.NOT_REVOCABLE) {
              userInfo.revokeStatus = record.status;
              userInfo.revokeErrorMessage = record.revokeErrorMessage;
            }
          }
        }
      }
      
      usersWithInfo.push(userInfo);
    });
    
    return usersWithInfo;
  }
  
  getUserDetailWithBatchInfo(email: string): UserWithRevokeInfo | null {
    const user = store.findUserByEmail(email);
    if (!user) {
      return null;
    }
    
    const userInfo: UserWithRevokeInfo = {
      ...user,
      sourceBatchId: user.sourceBatchId
    };
    
    if (user.sourceBatchId) {
      const batch = store.findBatchById(user.sourceBatchId);
      if (batch) {
        userInfo.sourceBatchName = batch.name;
        
        const record = store.findRecordByBatchAndEmail(user.sourceBatchId, email);
        if (record) {
          userInfo.isPreExistingInBatch = record.isPreExisting;
          userInfo.importStatus = record.status;
          userInfo.revokeStatus = record.status;
          userInfo.revokeErrorMessage = record.revokeErrorMessage;
        }
      }
    }
    
    return userInfo;
  }
  
  getReimportContext(batchId: string): {
    originalRecords: any[];
    previousMappings: {
      roleMappings: Record<string, string>;
      departmentMappings: Record<string, string>;
    };
    errors: {
      email: string;
      type: 'role_error' | 'department_error' | 'other';
      message: string;
      detail: any;
    }[];
    preExistingUsers: string[];
  } {
    const records = store.getRecordsByBatchId(batchId);
    const batch = store.findBatchById(batchId);
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    const errors: ReturnType<typeof this.getReimportContext>['errors'] = [];
    const preExistingUsers: string[] = [];
    
    records.forEach(record => {
      if (record.isPreExisting) {
        preExistingUsers.push(record.email);
      }
      
      record.precheckWarnings.forEach(warning => {
        if (warning.type === 'role_not_found') {
          errors.push({
            email: record.email,
            type: 'role_error',
            message: warning.message,
            detail: warning.detail
          });
        }
        if (warning.type === 'department_not_found') {
          errors.push({
            email: record.email,
            type: 'department_error',
            message: warning.message,
            detail: warning.detail
          });
        }
      });
      
      if (record.errorMessage) {
        errors.push({
          email: record.email,
          type: 'other',
          message: record.errorMessage,
          detail: null
        });
      }
    });
    
    return {
      originalRecords: records.map(r => ({
        email: r.email,
        name: r.name,
        departmentId: r.departmentId,
        roleIds: r.roleIds,
        status: r.status,
        isPreExisting: r.isPreExisting
      })),
      previousMappings: {
        roleMappings: {},
        departmentMappings: {}
      },
      errors,
      preExistingUsers
    };
  }
}

export const reportService = ReportService.getInstance();
