import {
  ImportBatch,
  ImportRecord,
  RecordStatus,
  BatchStatus
} from '../types';
import { store } from '../store/memoryStore';
import { referenceService } from './referenceService';

interface RevokeResult {
  batchId: string;
  totalProcessed: number;
  revoked: number;
  notRevocable: number;
  failed: number;
  alreadyRevoked: number;
  details: {
    email: string;
    status: 'revoked' | 'not_revocable' | 'failed' | 'already_revoked';
    message?: string;
  }[];
}

interface RevokeCompensation {
  userId: string;
  action: 'restore_roles' | 'delete_user' | 'skip';
  success: boolean;
  errorMessage?: string;
}

class RevokeService {
  private static instance: RevokeService;
  
  private processingBatches: Set<string> = new Set();
  private processingRecords: Set<string> = new Set();
  
  private constructor() {}
  
  static getInstance(): RevokeService {
    if (!RevokeService.instance) {
      RevokeService.instance = new RevokeService();
    }
    return RevokeService.instance;
  }
  
  canRevokeRecord(record: ImportRecord): { canRevoke: boolean; reason?: string } {
    if (record.status === RecordStatus.REVOKED) {
      return { canRevoke: true, reason: '已撤销，但再次撤销为幂等操作' };
    }
    
    if (record.status === RecordStatus.REVOKE_FAILED) {
      return { canRevoke: true, reason: '之前撤销失败，可重试' };
    }
    
    if (record.status === RecordStatus.NOT_REVOCABLE) {
      return { canRevoke: false, reason: '此记录标记为不可撤销' };
    }
    
    if (record.status === RecordStatus.SKIPPED || record.status === RecordStatus.FAILED) {
      return { canRevoke: true, reason: '记录未成功导入，撤销不会产生实际影响' };
    }
    
    if (record.isPreExisting) {
      if (record.status === RecordStatus.UPDATED) {
        return { canRevoke: true, reason: '对已存在用户的更新操作可回滚' };
      }
      if (record.status === RecordStatus.CREATED) {
        return { canRevoke: false, reason: '已存在用户标记为CREATED，逻辑矛盾' };
      }
    }
    
    if (record.status === RecordStatus.CREATED) {
      return { canRevoke: true, reason: '新创建的用户可以被删除' };
    }
    
    if (record.status === RecordStatus.UPDATED) {
      return { canRevoke: true, reason: '已更新的用户可以尝试恢复' };
    }
    
    return { canRevoke: false, reason: `不支持撤销状态: ${record.status}` };
  }
  
  private executeRevokeForRecord(record: ImportRecord, batchId: string): {
    status: 'revoked' | 'not_revocable' | 'failed' | 'already_revoked';
    message?: string;
    compensations: RevokeCompensation[];
  } {
    const now = Date.now();
    const compensations: RevokeCompensation[] = [];
    
    if (record.status === RecordStatus.REVOKED) {
      return { status: 'already_revoked', message: '已撤销，幂等处理', compensations };
    }
    
    if (record.status === RecordStatus.PENDING || record.status === RecordStatus.REVOKING) {
      return { status: 'failed', message: '记录处于处理中状态', compensations };
    }
    
    if (record.status === RecordStatus.SKIPPED || record.status === RecordStatus.FAILED) {
      record.status = RecordStatus.REVOKED;
      record.updatedAt = now;
      store.updateRecord(record);
      return { status: 'revoked', message: '记录未成功导入，无实际影响', compensations };
    }
    
    if (record.isPreExisting && record.status === RecordStatus.CREATED) {
      record.status = RecordStatus.NOT_REVOCABLE;
      record.revokeErrorMessage = '导入前已存在的用户不能被删除';
      record.updatedAt = now;
      store.updateRecord(record);
      return { status: 'not_revocable', message: '导入前已存在的用户不能被删除', compensations };
    }
    
    if (record.isPreExisting && record.status === RecordStatus.UPDATED) {
      const user = store.findUserByEmail(record.email);
      if (user) {
        const originalRoleIds = store.getUserOriginalRoleIds(user.id);
        if (originalRoleIds) {
          user.roleIds = originalRoleIds;
          user.updatedAt = now;
          store.updateUser(user);
          
          compensations.push({
            userId: user.id,
            action: 'restore_roles',
            success: true
          });
          
          record.status = RecordStatus.REVOKED;
          record.updatedAt = now;
          store.updateRecord(record);
          return { status: 'revoked', message: '已恢复原角色', compensations };
        } else {
          record.status = RecordStatus.REVOKE_FAILED;
          record.revokeErrorMessage = '无法找到原角色信息进行补偿';
          record.updatedAt = now;
          store.updateRecord(record);
          
          compensations.push({
            userId: user.id,
            action: 'restore_roles',
            success: false,
            errorMessage: '无法找到原角色信息'
          });
          
          return { status: 'failed', message: '无法找到原角色信息进行补偿', compensations };
        }
      } else {
        record.status = RecordStatus.REVOKE_FAILED;
        record.revokeErrorMessage = '用户不存在，无法恢复';
        record.updatedAt = now;
        store.updateRecord(record);
        return { status: 'failed', message: '用户不存在，无法恢复', compensations };
      }
    }
    
    if (!record.isPreExisting && record.status === RecordStatus.CREATED) {
      const user = store.findUserByEmail(record.email);
      if (user) {
        const deleted = store.deleteUser(user.id);
        if (deleted) {
          record.status = RecordStatus.REVOKED;
          record.updatedAt = now;
          store.updateRecord(record);
          
          compensations.push({
            userId: user.id,
            action: 'delete_user',
            success: true
          });
          
          return { status: 'revoked', message: '新创建的用户已删除', compensations };
        } else {
          record.status = RecordStatus.REVOKE_FAILED;
          record.revokeErrorMessage = '删除用户失败';
          record.updatedAt = now;
          store.updateRecord(record);
          
          compensations.push({
            userId: user.id,
            action: 'delete_user',
            success: false,
            errorMessage: '删除用户失败'
          });
          
          return { status: 'failed', message: '删除用户失败', compensations };
        }
      } else {
        record.status = RecordStatus.REVOKED;
        record.updatedAt = now;
        store.updateRecord(record);
        return { status: 'already_revoked', message: '用户已不存在', compensations };
      }
    }
    
    record.status = RecordStatus.REVOKE_FAILED;
    record.revokeErrorMessage = `不支持撤销状态: ${record.status}`;
    record.updatedAt = now;
    store.updateRecord(record);
    return { status: 'failed', message: `不支持撤销状态: ${record.status}`, compensations };
  }
  
  revokeBatch(batchId: string, force?: boolean): RevokeResult {
    if (this.processingBatches.has(batchId)) {
      return {
        batchId,
        totalProcessed: 0,
        revoked: 0,
        notRevocable: 0,
        failed: 0,
        alreadyRevoked: 0,
        details: []
      };
    }
    
    const batch = store.findBatchById(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    const allowedStatuses = [
      BatchStatus.COMPLETED,
      BatchStatus.PARTIALLY_COMPLETED,
      BatchStatus.FAILED,
      BatchStatus.PARTIALLY_REVOKED,
      BatchStatus.REVOKED
    ];
    
    if (!allowedStatuses.includes(batch.status) && !force) {
      throw new Error(`批次状态 ${batch.status} 不允许撤销`);
    }
    
    if (batch.status === BatchStatus.REVOKED && !force) {
      return this.getIdempotentRevokeResult(batchId, '批次已完全撤销');
    }
    
    this.processingBatches.add(batchId);
    
    try {
      batch.status = BatchStatus.REVOKING;
      batch.updatedAt = Date.now();
      store.updateBatch(batch);
      
      const records = store.getRecordsByBatchId(batchId);
      const details: RevokeResult['details'] = [];
      
      let revoked = 0;
      let notRevocable = 0;
      let failed = 0;
      let alreadyRevoked = 0;
      
      records.forEach(record => {
        const result = this.executeRevokeForRecord(record, batchId);
        
        details.push({
          email: record.email,
          status: result.status,
          message: result.message
        });
        
        switch (result.status) {
          case 'revoked':
            revoked++;
            break;
          case 'not_revocable':
            notRevocable++;
            break;
          case 'failed':
            failed++;
            break;
          case 'already_revoked':
            alreadyRevoked++;
            revoked++;
            break;
        }
      });
      
      const stats = store.getBatchStats(batchId);
      batch.revokeCount = stats.revoked;
      
      if (failed > 0) {
        batch.status = BatchStatus.PARTIALLY_REVOKED;
      } else {
        batch.status = BatchStatus.REVOKED;
      }
      
      batch.updatedAt = Date.now();
      store.updateBatch(batch);
      
      return {
        batchId,
        totalProcessed: records.length,
        revoked,
        notRevocable,
        failed,
        alreadyRevoked,
        details
      };
    } finally {
      this.processingBatches.delete(batchId);
    }
  }
  
  revokeSingleUser(batchId: string, email: string): RevokeResult {
    const batch = store.findBatchById(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    const record = store.findRecordByBatchAndEmail(batchId, email);
    if (!record) {
      throw new Error(`在批次 ${batchId} 中未找到邮箱为 ${email} 的记录`);
    }
    
    const recordKey = `${batchId}-${email.toLowerCase()}`;
    if (this.processingRecords.has(recordKey)) {
      return {
        batchId,
        totalProcessed: 0,
        revoked: 0,
        notRevocable: 0,
        failed: 0,
        alreadyRevoked: 0,
        details: []
      };
    }
    
    if (record.status === RecordStatus.REVOKED) {
      return this.getIdempotentRevokeResult(batchId, '该用户已撤销');
    }
    
    this.processingRecords.add(recordKey);
    
    try {
      const result = this.executeRevokeForRecord(record, batchId);
      
      const stats = store.getBatchStats(batchId);
      batch.revokeCount = stats.revoked;
      
      const allRecords = store.getRecordsByBatchId(batchId);
      const allRevoked = allRecords.every(r => 
        r.status === RecordStatus.REVOKED || 
        r.status === RecordStatus.NOT_REVOCABLE ||
        r.status === RecordStatus.SKIPPED ||
        r.status === RecordStatus.FAILED
      );
      const hasFailures = allRecords.some(r => r.status === RecordStatus.REVOKE_FAILED);
      
      if (hasFailures) {
        batch.status = BatchStatus.PARTIALLY_REVOKED;
      } else if (allRevoked) {
        batch.status = BatchStatus.REVOKED;
      }
      
      batch.updatedAt = Date.now();
      store.updateBatch(batch);
      
      return {
        batchId,
        totalProcessed: 1,
        revoked: result.status === 'revoked' || result.status === 'already_revoked' ? 1 : 0,
        notRevocable: result.status === 'not_revocable' ? 1 : 0,
        failed: result.status === 'failed' ? 1 : 0,
        alreadyRevoked: result.status === 'already_revoked' ? 1 : 0,
        details: [{
          email: record.email,
          status: result.status,
          message: result.message
        }]
      };
    } finally {
      this.processingRecords.delete(recordKey);
    }
  }
  
  private getIdempotentRevokeResult(batchId: string, message: string): RevokeResult {
    const records = store.getRecordsByBatchId(batchId);
    const details = records.map(r => ({
      email: r.email,
      status: r.status === RecordStatus.REVOKED ? 'already_revoked' as const : 
              r.status === RecordStatus.NOT_REVOCABLE ? 'not_revocable' as const : 'failed' as const,
      message: message
    }));
    
    return {
      batchId,
      totalProcessed: records.length,
      revoked: records.filter(r => r.status === RecordStatus.REVOKED).length,
      notRevocable: records.filter(r => r.status === RecordStatus.NOT_REVOCABLE).length,
      failed: records.filter(r => r.status === RecordStatus.REVOKE_FAILED).length,
      alreadyRevoked: records.filter(r => r.status === RecordStatus.REVOKED).length,
      details
    };
  }
}

export const revokeService = RevokeService.getInstance();
