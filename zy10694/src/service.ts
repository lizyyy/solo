import { db } from './database';
import { DeprecationExtension, ExtensionStatus, CreateExtensionRequest, SyncCheckResult, ExportFormat } from './types';

export class ExtensionService {
  async createExtension(request: CreateExtensionRequest): Promise<DeprecationExtension> {
    this.validateCreateRequest(request);
    return db.createExtension(request);
  }

  private validateCreateRequest(request: CreateExtensionRequest): void {
    if (!request.apiName || request.apiName.trim() === '') {
      throw new Error('API名称不能为空');
    }
    if (!request.apiPath || request.apiPath.trim() === '') {
      throw new Error('API路径不能为空');
    }
    if (!request.caller || request.caller.trim() === '') {
      throw new Error('调用方不能为空');
    }
    if (!request.originalDeprecationDate) {
      throw new Error('原废弃日期不能为空');
    }
    if (!request.extendedDeprecationDate) {
      throw new Error('延期废弃日期不能为空');
    }
    if (!request.reason || request.reason.trim() === '') {
      throw new Error('延期理由不能为空');
    }
    if (!request.contactPerson || request.contactPerson.trim() === '') {
      throw new Error('联系人不能为空');
    }
    if (!request.contactEmail || !this.isValidEmail(request.contactEmail)) {
      throw new Error('联系邮箱格式不正确');
    }

    const originalDate = new Date(request.originalDeprecationDate);
    const extendedDate = new Date(request.extendedDeprecationDate);

    if (isNaN(originalDate.getTime())) {
      throw new Error('原废弃日期格式不正确');
    }
    if (isNaN(extendedDate.getTime())) {
      throw new Error('延期废弃日期格式不正确');
    }
    if (extendedDate <= originalDate) {
      throw new Error('延期废弃日期必须晚于原废弃日期');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async approveExtension(id: string, approvedBy: string): Promise<DeprecationExtension> {
    const extension = await db.getExtensionById(id);
    if (!extension) {
      throw new Error('延期记录不存在');
    }
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new Error('只能审批待审批状态的延期记录');
    }

    const updated = await db.updateExtensionStatus(id, ExtensionStatus.APPROVED, approvedBy);
    if (!updated) {
      throw new Error('审批失败');
    }

    return updated;
  }

  async rejectExtension(id: string, approvedBy: string): Promise<DeprecationExtension> {
    const extension = await db.getExtensionById(id);
    if (!extension) {
      throw new Error('延期记录不存在');
    }
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new Error('只能拒绝待审批状态的延期记录');
    }

    const updated = await db.updateExtensionStatus(id, ExtensionStatus.REJECTED, approvedBy);
    if (!updated) {
      throw new Error('拒绝失败');
    }

    return updated;
  }

  async withdrawExtension(id: string): Promise<DeprecationExtension> {
    const extension = await db.getExtensionById(id);
    if (!extension) {
      throw new Error('延期记录不存在');
    }
    if (extension.status === ExtensionStatus.WITHDRAWN) {
      throw new Error('该记录已被撤回');
    }
    if (extension.status === ExtensionStatus.EXPIRED) {
      throw new Error('已过期的记录不能撤回');
    }

    const updated = await db.updateExtensionStatus(id, ExtensionStatus.WITHDRAWN);
    if (!updated) {
      throw new Error('撤回失败');
    }

    return updated;
  }

  async getExtension(id: string): Promise<DeprecationExtension | null> {
    return db.getExtensionById(id);
  }

  async listExtensions(filters?: {
    status?: ExtensionStatus;
    caller?: string;
    apiPath?: string;
  }): Promise<DeprecationExtension[]> {
    return db.getExtensions(filters);
  }

  async checkSyncStatus(apiPath: string, caller?: string): Promise<SyncCheckResult[]> {
    const filters: any = { apiPath, status: ExtensionStatus.APPROVED };
    if (caller) {
      filters.caller = caller;
    }

    const extensions = await db.getExtensions(filters);
    const results: SyncCheckResult[] = [];

    for (const ext of extensions) {
      const mockRule = await this.mockGetAlertRule(ext.apiPath, ext.caller);
      
      results.push({
        extensionId: ext.id,
        apiPath: ext.apiPath,
        caller: ext.caller,
        extendedDeprecationDate: ext.extendedDeprecationDate,
        syncStatus: ext.syncStatus === 'synced' && mockRule.exists && mockRule.dateMatches ? 'synced' : 'unsynced',
        ruleExists: mockRule.exists,
        ruleDateMatches: mockRule.dateMatches
      });
    }

    return results;
  }

  private async mockGetAlertRule(apiPath: string, caller: string): Promise<{ exists: boolean; dateMatches: boolean }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const exists = Math.random() > 0.3;
        const dateMatches = exists && Math.random() > 0.2;
        resolve({ exists, dateMatches });
      }, 50);
    });
  }

  async getExpiringExtensions(daysBefore: number = 7): Promise<DeprecationExtension[]> {
    return db.getExpiringExtensions(daysBefore);
  }

  async exportExtensions(format: ExportFormat, filters?: {
    status?: ExtensionStatus;
    caller?: string;
  }): Promise<string> {
    const extensions = await db.getExtensions(filters);

    if (format === 'json') {
      return JSON.stringify(extensions, null, 2);
    } else if (format === 'csv') {
      const headers = [
        'ID', 'API名称', 'API路径', '调用方', '原废弃日期',
        '延期废弃日期', '延期理由', '联系人', '联系邮箱',
        '状态', '创建时间', '更新时间', '审批人', '审批时间',
        '同步状态'
      ];

      const rows = extensions.map(ext => [
        ext.id,
        ext.apiName,
        ext.apiPath,
        ext.caller,
        ext.originalDeprecationDate,
        ext.extendedDeprecationDate,
        ext.reason,
        ext.contactPerson,
        ext.contactEmail,
        ext.status,
        ext.createdAt,
        ext.updatedAt,
        ext.approvedBy || '',
        ext.approvedAt || '',
        ext.syncStatus
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

      return [headers.join(','), ...rows].join('\n');
    }

    throw new Error('不支持的导出格式');
  }

  async updateSyncStatus(
    id: string,
    syncStatus: 'synced' | 'pending' | 'failed',
    syncMessage?: string
  ): Promise<DeprecationExtension> {
    const updated = await db.updateSyncStatus(id, syncStatus, syncMessage);
    if (!updated) {
      throw new Error('更新同步状态失败');
    }
    return updated;
  }

  async getUnsyncedExtensions(): Promise<DeprecationExtension[]> {
    return db.getUnsyncedExtensions();
  }
}

export const extensionService = new ExtensionService();
