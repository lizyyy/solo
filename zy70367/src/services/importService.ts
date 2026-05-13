import { v4 as uuidv4 } from 'uuid';
import {
  User,
  ImportBatch,
  ImportRecord,
  PrecheckWarning,
  PrecheckWarningType,
  BatchStatus,
  RecordStatus,
  MappingConfig
} from '../types';
import { store } from '../store/memoryStore';
import { referenceService } from './referenceService';

interface ImportUserInput {
  email: string;
  name: string;
  departmentName?: string;
  roleNames: string[];
}

interface BatchCreateInput {
  name: string;
  creatorId: string;
  users: ImportUserInput[];
}

interface PrecheckResult {
  batchId: string;
  warnings: PrecheckWarning[];
  perUserWarnings: Map<string, PrecheckWarning[]>;
}

class ImportService {
  private static instance: ImportService;
  
  private constructor() {}
  
  static getInstance(): ImportService {
    if (!ImportService.instance) {
      ImportService.instance = new ImportService();
    }
    return ImportService.instance;
  }
  
  createBatch(input: BatchCreateInput, mappingConfig?: MappingConfig): ImportBatch {
    const now = Date.now();
    
    const batch: ImportBatch = {
      id: `batch-${uuidv4()}`,
      name: input.name,
      status: BatchStatus.CREATED,
      creatorId: input.creatorId,
      createdAt: now,
      updatedAt: now,
      totalRecords: input.users.length,
      successCount: 0,
      failCount: 0,
      revokeCount: 0,
      precheckWarnings: []
    };
    
    const createdBatch = store.createBatch(batch);
    
    const seenEmails = new Set<string>();
    
    input.users.forEach(userInput => {
      const email = userInput.email.toLowerCase();
      const isDuplicateInBatch = seenEmails.has(email);
      seenEmails.add(email);
      
      const existingUser = store.findUserByEmail(email);
      const isPreExisting = !!existingUser;
      
      let departmentId: string | undefined;
      if (userInput.departmentName) {
        const dept = referenceService.findDepartmentByName(userInput.departmentName);
        if (dept) {
          departmentId = dept.id;
        }
      }
      
      const roleIds: string[] = [];
      userInput.roleNames.forEach(roleName => {
        const role = referenceService.findRoleByName(roleName);
        if (role) {
          roleIds.push(role.id);
        }
      });
      
      const precheckWarnings: PrecheckWarning[] = [];
      
      if (isDuplicateInBatch) {
        precheckWarnings.push({
          type: PrecheckWarningType.DUPLICATE_EMAIL,
          message: `批次内存在重复邮箱: ${userInput.email}`,
          detail: { email: userInput.email }
        });
      }
      
      if (isPreExisting) {
        precheckWarnings.push({
          type: PrecheckWarningType.USER_EXISTS,
          message: `用户已存在，将执行更新操作: ${userInput.email}`,
          detail: { email: userInput.email, existingUserId: existingUser?.id }
        });
      }
      
      if (userInput.departmentName && !departmentId) {
        precheckWarnings.push({
          type: PrecheckWarningType.DEPARTMENT_NOT_FOUND,
          message: `部门不存在: ${userInput.departmentName}`,
          detail: { departmentName: userInput.departmentName }
        });
      }
      
      userInput.roleNames.forEach(roleName => {
        const role = referenceService.findRoleByName(roleName);
        if (!role) {
          precheckWarnings.push({
            type: PrecheckWarningType.ROLE_NOT_FOUND,
            message: `角色不存在: ${roleName}`,
            detail: { roleName }
          });
        }
      });
      
      const record: ImportRecord = {
        id: `rec-${uuidv4()}`,
        batchId: createdBatch.id,
        email: userInput.email,
        name: userInput.name,
        departmentId,
        roleIds,
        originalRoleIds: existingUser?.roleIds,
        status: RecordStatus.PENDING,
        isPreExisting,
        precheckWarnings,
        createdAt: now,
        updatedAt: now
      };
      
      store.createRecord(record);
    });
    
    return createdBatch;
  }
  
  precheckBatch(batchId: string): PrecheckResult {
    const batch = store.findBatchById(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    batch.status = BatchStatus.PRECHECKING;
    batch.updatedAt = Date.now();
    store.updateBatch(batch);
    
    const records = store.getRecordsByBatchId(batchId);
    const perUserWarnings = new Map<string, PrecheckWarning[]>();
    const allWarnings: PrecheckWarning[] = [];
    
    records.forEach(record => {
      perUserWarnings.set(record.email, record.precheckWarnings);
      allWarnings.push(...record.precheckWarnings);
    });
    
    batch.status = BatchStatus.PRECHECKED;
    batch.precheckWarnings = allWarnings;
    batch.updatedAt = Date.now();
    store.updateBatch(batch);
    
    return {
      batchId,
      warnings: allWarnings,
      perUserWarnings
    };
  }
  
  confirmImport(batchId: string): { batch: ImportBatch; results: ImportRecord[] } {
    const batch = store.findBatchById(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }
    
    if (batch.status === BatchStatus.COMPLETED || batch.status === BatchStatus.PARTIALLY_COMPLETED) {
      return { batch, results: store.getRecordsByBatchId(batchId) };
    }
    
    batch.status = BatchStatus.IMPORTING;
    batch.updatedAt = Date.now();
    store.updateBatch(batch);
    
    const records = store.getRecordsByBatchId(batchId);
    const now = Date.now();
    
    let successCount = 0;
    let failCount = 0;
    
    const results: ImportRecord[] = [];
    
    records.forEach(record => {
      try {
        if (record.precheckWarnings.some(w => w.type === PrecheckWarningType.DUPLICATE_EMAIL)) {
          record.status = RecordStatus.SKIPPED;
          record.errorMessage = '批次内重复邮箱，跳过导入';
          record.updatedAt = now;
          store.updateRecord(record);
          results.push(record);
          return;
        }
        
        let user = store.findUserByEmail(record.email);
        const wasExisting = !!user;
        
        if (user) {
          store.setUserOriginalRoleIds(user.id, [...user.roleIds]);
          
          if (record.departmentId) {
            user.departmentId = record.departmentId;
          }
          if (record.roleIds.length > 0) {
            user.roleIds = record.roleIds;
          }
          user.updatedAt = now;
          if (!user.sourceBatchId) {
            user.sourceBatchId = batchId;
          }
          user = store.updateUser(user);
          
          record.status = RecordStatus.UPDATED;
          record.updatedAt = now;
          store.updateRecord(record);
          successCount++;
        } else {
          const newUser: User = {
            id: `u-${uuidv4()}`,
            email: record.email,
            name: record.name,
            departmentId: record.departmentId,
            roleIds: record.roleIds,
            createdAt: now,
            updatedAt: now,
            sourceBatchId: batchId,
            originalUser: false
          };
          
          store.createUser(newUser);
          store.setUserOriginalRoleIds(newUser.id, []);
          
          record.status = RecordStatus.CREATED;
          record.updatedAt = now;
          store.updateRecord(record);
          successCount++;
        }
        
        results.push(record);
      } catch (error: any) {
        record.status = RecordStatus.FAILED;
        record.errorMessage = error?.message || '导入失败';
        record.updatedAt = now;
        store.updateRecord(record);
        failCount++;
        results.push(record);
      }
    });
    
    batch.successCount = successCount;
    batch.failCount = failCount;
    batch.totalRecords = records.length;
    
    if (failCount === 0) {
      batch.status = BatchStatus.COMPLETED;
    } else if (successCount > 0) {
      batch.status = BatchStatus.PARTIALLY_COMPLETED;
    } else {
      batch.status = BatchStatus.FAILED;
    }
    
    batch.updatedAt = now;
    store.updateBatch(batch);
    
    return { batch, results };
  }
  
  getBatch(batchId: string): ImportBatch | undefined {
    return store.findBatchById(batchId);
  }
  
  getBatchRecords(batchId: string): ImportRecord[] {
    return store.getRecordsByBatchId(batchId);
  }
  
  getAllBatches(): ImportBatch[] {
    return store.getAllBatches();
  }
}

export const importService = ImportService.getInstance();
