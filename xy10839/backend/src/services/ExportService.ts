import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { DataScopeModel } from '../models/DataScopeModel';
import { ExportTaskModel } from '../models/ExportTaskModel';
import { FileManifestModel } from '../models/FileManifestModel';
import { VerificationSummaryModel } from '../models/VerificationSummaryModel';
import { DownloadRecordModel } from '../models/DownloadRecordModel';
import { ExportCertificateModel } from '../models/ExportCertificateModel';
import { TenantModel } from '../models/TenantModel';
import type { ExportStatus, CreateTaskRequest, TaskResponse } from '../types';

const EXPIRE_DAYS = 7;
const DOWNLOAD_TOKEN_EXPIRE_HOURS = 24;

class ExportService {
  private processingTasks: Set<string> = new Set();

  async createTask(request: CreateTaskRequest): Promise<TaskResponse> {
    const tenant = TenantModel.findById(request.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    let scopeId = request.scopeId;
    if (!scopeId) {
      const scope = DataScopeModel.create({
        tenantId: request.tenantId,
        name: request.name,
        scopeType: request.dateRange ? 'incremental' : 'full',
        dateRange: request.dateRange,
        dataTypes: request.dataTypes,
        snapshotVersion: `v1.${Date.now()}`
      });
      scopeId = scope.id;
    }

    const existingTask = ExportTaskModel.findByTenantAndScope(
      request.tenantId,
      scopeId,
      ['pending', 'snapshot', 'packing', 'verifying'] as ExportStatus[]
    );
    if (existingTask) {
      return this.getTaskDetail(existingTask.id);
    }

    const expiredAt = Date.now() + EXPIRE_DAYS * 24 * 60 * 60 * 1000;
    const task = ExportTaskModel.create({
      tenantId: request.tenantId,
      scopeId,
      name: request.name,
      status: 'pending' as ExportStatus,
      createdBy: request.createdBy,
      expiredAt,
      maxRetries: 3
    });

    setImmediate(() => this.processTask(task.id));

    return this.getTaskDetail(task.id);
  }

  async processTask(taskId: string): Promise<void> {
    if (this.processingTasks.has(taskId)) return;
    this.processingTasks.add(taskId);

    try {
      const task = ExportTaskModel.findById(taskId);
      if (!task || task.status === 'completed' || task.status === 'failed') {
        this.processingTasks.delete(taskId);
        return;
      }

      ExportTaskModel.update(taskId, {
        status: 'snapshot' as ExportStatus,
        progress: 10,
        startedAt: Date.now()
      });
      await this.delay(800);

      ExportTaskModel.update(taskId, { status: 'packing' as ExportStatus, progress: 30 });
      await this.generateMockFiles(taskId);
      await this.delay(1000);

      ExportTaskModel.update(taskId, { progress: 50 });
      await this.delay(800);

      ExportTaskModel.update(taskId, { status: 'verifying' as ExportStatus, progress: 75 });
      await this.verifyFiles(taskId);
      await this.delay(500);

      const tenant = TenantModel.findById(task.tenantId);
      const files = FileManifestModel.findByTaskId(taskId);
      const verification = VerificationSummaryModel.findByTaskId(taskId);

      if (verification?.isValid) {
        ExportTaskModel.update(taskId, {
          status: 'completed' as ExportStatus,
          progress: 100,
          completedAt: Date.now()
        });

        ExportCertificateModel.create({
          taskId,
          issuedAt: Date.now(),
          issuer: 'Tenant Export System',
          metadata: {
            tenantName: tenant?.name || 'Unknown',
            exportTime: Date.now(),
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.fileSize, 0),
            checksum: verification.checksum
          }
        });
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      const task = ExportTaskModel.findById(taskId);
      if (task && task.retryCount < task.maxRetries) {
        ExportTaskModel.incrementRetry(taskId);
        ExportTaskModel.update(taskId, {
          status: 'pending' as ExportStatus,
          progress: 0
        });
        setImmediate(() => this.processTask(taskId));
      } else {
        ExportTaskModel.update(taskId, {
          status: 'failed' as ExportStatus,
          errorMessage: error.message,
          errorStack: error.stack,
          completedAt: Date.now()
        });
      }
    } finally {
      this.processingTasks.delete(taskId);
    }
  }

  private async generateMockFiles(taskId: string): Promise<void> {
    const mockFiles = [
      { fileName: 'users.csv', fileType: 'text/csv', fileSize: 1024000 },
      { fileName: 'orders.json', fileType: 'application/json', fileSize: 2048000 },
      { fileName: 'products.xml', fileType: 'application/xml', fileSize: 512000 },
      { fileName: 'activity_logs.ndjson', fileType: 'application/x-ndjson', fileSize: 5120000 },
      { fileName: 'metadata.json', fileType: 'application/json', fileSize: 25600 }
    ];

    const files = mockFiles.map(f => ({
      ...f,
      filePath: `/exports/${taskId}/${f.fileName}`,
      checksum: CryptoJS.MD5(f.fileName + Date.now()).toString(),
      status: 'packed' as const
    }));

    FileManifestModel.bulkCreate(taskId, files);
  }

  private async verifyFiles(taskId: string): Promise<void> {
    const files = FileManifestModel.findByTaskId(taskId);
    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
    const combinedChecksum = CryptoJS.SHA256(
      files.map(f => f.checksum).join('|')
    ).toString(CryptoJS.enc.Hex);

    VerificationSummaryModel.create({
      taskId,
      totalFiles: files.length,
      totalSize,
      checksum: combinedChecksum,
      algorithm: 'SHA256',
      metadata: { verifiedBy: 'system', verificationMode: 'full' },
      verifiedAt: Date.now(),
      isValid: true
    });

    for (const file of files) {
      FileManifestModel.update(file.id, { status: 'verified' });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getTaskList(tenantId?: string, status?: ExportStatus) {
    return ExportTaskModel.findAll(tenantId, status);
  }

  getTaskDetail(taskId: string): TaskResponse {
    const task = ExportTaskModel.findById(taskId);
    if (!task) throw new Error('Task not found');

    const scope = DataScopeModel.findById(task.scopeId);
    const tenant = TenantModel.findById(task.tenantId);
    const files = FileManifestModel.findByTaskId(taskId);
    const verification = VerificationSummaryModel.findByTaskId(taskId);

    return {
      task,
      scope: scope || undefined,
      tenant: tenant || undefined,
      files,
      verification: verification || undefined
    };
  }

  async retryTask(taskId: string): Promise<TaskResponse> {
    const task = ExportTaskModel.findById(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'failed') throw new Error('Only failed tasks can be retried');

    ExportTaskModel.update(taskId, {
      status: 'pending' as ExportStatus,
      progress: 0,
      errorMessage: undefined,
      errorStack: undefined
    });

    setImmediate(() => this.processTask(taskId));

    return this.getTaskDetail(taskId);
  }

  generateDownloadToken(taskId: string, userId: string, clientIp: string, userAgent: string): { token: string; expiresAt: number } {
    const task = ExportTaskModel.findById(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'completed') throw new Error('Only completed tasks can be downloaded');

    const token = uuidv4();
    const expiresAt = Date.now() + DOWNLOAD_TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;

    DownloadRecordModel.create({
      taskId,
      downloadToken: token,
      downloadedBy: userId,
      downloadedAt: Date.now(),
      clientIp,
      userAgent,
      expiresAt
    });

    return { token, expiresAt };
  }

  getCertificate(taskId: string) {
    const certificate = ExportCertificateModel.findByTaskId(taskId);
    if (!certificate) throw new Error('Certificate not found');
    return {
      ...certificate,
      isVerified: ExportCertificateModel.verify(certificate)
    };
  }

  getTenants() {
    return TenantModel.findAll();
  }
}

export default new ExportService();
