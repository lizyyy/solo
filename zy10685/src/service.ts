import { TicketBatch, VerificationStatus, VerificationRequest, VerificationRecord, ConflictResponse, ImportResult, ImportRowError } from './types';
import { store } from './store';

export class VerificationService {
  calculateStatus(remainingQuantity: number, totalQuantity: number): VerificationStatus {
    if (remainingQuantity < 0) {
      return VerificationStatus.ABNORMAL;
    }
    if (remainingQuantity === 0) {
      return VerificationStatus.COMPLETED;
    }
    if (remainingQuantity === totalQuantity) {
      return VerificationStatus.PENDING;
    }
    return VerificationStatus.PARTIAL;
  }

  canVerify(batch: TicketBatch, quantity: number): { valid: boolean; message?: string } {
    const now = new Date();
    
    if (batch.validFrom > now) {
      return { valid: false, message: '票批次尚未生效' };
    }
    if (batch.validTo < now) {
      return { valid: false, message: '票批次已过期' };
    }
    if (batch.status === VerificationStatus.COMPLETED) {
      return { valid: false, message: '票批次已完成核销' };
    }
    if (batch.status === VerificationStatus.ABNORMAL) {
      return { valid: false, message: '票批次状态异常，需先处理' };
    }
    if (quantity <= 0) {
      return { valid: false, message: '核销数量必须大于0' };
    }
    if (quantity > batch.remainingQuantity) {
      return { valid: false, message: `核销数量超出剩余数量，剩余: ${batch.remainingQuantity}` };
    }
    
    return { valid: true };
  }

  async verify(request: VerificationRequest): Promise<{
    success: boolean;
    data?: { batch: TicketBatch; record: VerificationRecord };
    error?: ConflictResponse | { message: string };
  }> {
    const lockAcquired = await store.acquireLock(request.batchId);
    
    if (!lockAcquired) {
      return {
        success: false,
        error: {
          success: false,
          errorCode: 'CONCURRENT_CONFLICT',
          message: '该票批次正在被其他操作处理，请稍候重试',
          requiredDocuments: [
            '团体票核销授权书（加盖公章）',
            '核销人员工作证明',
            '现场照片（包含核销点标识）',
            '冲突情况书面说明'
          ],
          nextSteps: [
            '1. 暂停当前核销操作',
            '2. 收集上述所需材料',
            '3. 联系票务管理员：400-XXX-XXXX',
            '4. 提交材料进行人工审核',
            '5. 审核通过后可继续核销'
          ]
        } as ConflictResponse
      };
    }

    try {
      const batch = store.getTicketBatch(request.batchId);
      if (!batch) {
        return { success: false, error: { message: '票批次不存在' } };
      }

      const validation = this.canVerify(batch, request.quantity);
      if (!validation.valid) {
        return { success: false, error: { message: validation.message! } };
      }

      const point = store.getVerificationPoint(request.verificationPointId);
      if (!point) {
        return { success: false, error: { message: '核销点不存在' } };
      }

      const beforeQuantity = batch.remainingQuantity;
      const statusBefore = batch.status;

      const newRemaining = batch.remainingQuantity - request.quantity;
      const newVerified = batch.verifiedQuantity + request.quantity;
      const statusAfter = this.calculateStatus(newRemaining, batch.totalQuantity);

      const updatedBatch: TicketBatch = {
        ...batch,
        remainingQuantity: newRemaining,
        verifiedQuantity: newVerified,
        status: statusAfter,
        updatedAt: new Date(),
        version: batch.version + 1
      };
      store.updateTicketBatch(updatedBatch);

      const record = store.createVerificationRecord({
        batchId: batch.id,
        batchNo: batch.batchNo,
        teamId: batch.teamId,
        teamName: batch.teamName,
        verificationPointId: point.id,
        verificationPointName: point.name,
        operatorName: request.operatorName,
        quantity: request.quantity,
        beforeQuantity,
        afterQuantity: newRemaining,
        statusBefore,
        statusAfter,
        remark: request.remark,
        isImported: false,
        importSource: ''
      });

      return {
        success: true,
        data: { batch: updatedBatch, record }
      };
    } finally {
      store.releaseLock(request.batchId);
    }
  }

  validateImportRow(row: Record<string, any>, rowNumber: number): ImportRowError | null {
    const errors: string[] = [];

    if (!row['票批次号'] || typeof row['票批次号'] !== 'string') {
      errors.push('票批次号不能为空');
    }
    if (!row['核销点名称'] || typeof row['核销点名称'] !== 'string') {
      errors.push('核销点名称不能为空');
    }
    if (!row['核销数量'] || isNaN(Number(row['核销数量'])) || Number(row['核销数量']) <= 0) {
      errors.push('核销数量必须为大于0的数字');
    }
    if (!row['操作人姓名'] || typeof row['操作人姓名'] !== 'string') {
      errors.push('操作人姓名不能为空');
    }

    if (errors.length > 0) {
      return { rowNumber, data: row, errors };
    }
    return null;
  }

  async processImport(rows: Record<string, any>[]): Promise<ImportResult> {
    const result: ImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      const validationError = this.validateImportRow(row, rowNumber);
      if (validationError) {
        result.errorCount++;
        result.errors.push(validationError);
        continue;
      }

      const batches = store.getAllTicketBatches().filter(b => b.batchNo === row['票批次号']);
      if (batches.length === 0) {
        result.errorCount++;
        result.errors.push({ rowNumber, data: row, errors: ['票批次号不存在'] });
        continue;
      }

      const points = store.getAllVerificationPoints().filter(p => p.name === row['核销点名称']);
      if (points.length === 0) {
        result.errorCount++;
        result.errors.push({ rowNumber, data: row, errors: ['核销点名称不存在'] });
        continue;
      }

      const verifyResult = await this.verify({
        batchId: batches[0].id,
        verificationPointId: points[0].id,
        quantity: Number(row['核销数量']),
        operatorName: row['操作人姓名'],
        remark: row['备注'] || ''
      });

      if (verifyResult.success) {
        result.successCount++;
      } else {
        result.errorCount++;
        result.errors.push({
          rowNumber,
          data: row,
          errors: [(verifyResult.error as any).message || '核销失败']
        });
      }
    }

    return result;
  }

  getExportFields(): { label: string; value: keyof TicketBatch }[] {
    return [
      { label: '票批次号', value: 'batchNo' },
      { label: '团队名称', value: 'teamName' },
      { label: '总数量', value: 'totalQuantity' },
      { label: '剩余数量', value: 'remainingQuantity' },
      { label: '已核销数量', value: 'verifiedQuantity' },
      { label: '状态', value: 'status' },
      { label: '生效日期', value: 'validFrom' },
      { label: '失效日期', value: 'validTo' },
      { label: '备注', value: 'remark' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];
  }

  getRecordExportFields(): { label: string; value: keyof VerificationRecord }[] {
    return [
      { label: '票批次号', value: 'batchNo' },
      { label: '团队名称', value: 'teamName' },
      { label: '核销点名称', value: 'verificationPointName' },
      { label: '操作人', value: 'operatorName' },
      { label: '核销数量', value: 'quantity' },
      { label: '核销前剩余', value: 'beforeQuantity' },
      { label: '核销后剩余', value: 'afterQuantity' },
      { label: '核销前状态', value: 'statusBefore' },
      { label: '核销后状态', value: 'statusAfter' },
      { label: '是否导入', value: 'isImported' },
      { label: '备注', value: 'remark' },
      { label: '核销时间', value: 'createdAt' }
    ];
  }
}

export const verificationService = new VerificationService();
