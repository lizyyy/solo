import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
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
const EXPORT_BASE_DIR = path.join(process.cwd(), 'data', 'exports');

if (!fs.existsSync(EXPORT_BASE_DIR)) {
  fs.mkdirSync(EXPORT_BASE_DIR, { recursive: true });
}

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
      await this.generateRealFiles(taskId);
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

        await this.createZipPackage(taskId, files);
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

  private async generateRealFiles(taskId: string): Promise<void> {
    const taskDir = path.join(EXPORT_BASE_DIR, taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    const mockFiles = [
      {
        fileName: 'users.csv',
        fileType: 'text/csv',
        content: 'id,name,email,created_at\n1,张三,zhangsan@demo.com,2024-01-01\n2,李四,lisi@demo.com,2024-01-02\n3,王五,wangwu@demo.com,2024-01-03\n'
      },
      {
        fileName: 'orders.json',
        fileType: 'application/json',
        content: JSON.stringify([
          { id: 'ORD001', userId: 1, amount: 999.99, status: 'completed', items: [{ name: '产品A', quantity: 2 }] },
          { id: 'ORD002', userId: 2, amount: 1999.99, status: 'pending', items: [{ name: '产品B', quantity: 1 }] }
        ], null, 2)
      },
      {
        fileName: 'products.xml',
        fileType: 'application/xml',
        content: '<?xml version="1.0" encoding="UTF-8"?>\n<products>\n  <product id="P001">\n    <name>企业版套餐</name>\n    <price>9999</price>\n    <stock>100</stock>\n  </product>\n  <product id="P002">\n    <name>专业版套餐</name>\n    <price>4999</price>\n    <stock>500</stock>\n  </product>\n</products>\n'
      },
      {
        fileName: 'activity_logs.ndjson',
        fileType: 'application/x-ndjson',
        content: '{"timestamp":"2024-01-01T10:00:00Z","userId":1,"action":"login","ip":"192.168.1.1"}\n{"timestamp":"2024-01-01T10:05:00Z","userId":1,"action":"view_page","page":"/dashboard"}\n{"timestamp":"2024-01-01T10:10:00Z","userId":2,"action":"login","ip":"192.168.1.2"}\n'
      },
      {
        fileName: 'metadata.json',
        fileType: 'application/json',
        content: JSON.stringify({
          taskId,
          exportVersion: '1.0.0',
          exportTime: new Date().toISOString(),
          dataSources: ['users', 'orders', 'products', 'activity_logs'],
          schemaVersion: 'v2024.1'
        }, null, 2)
      }
    ];

    const files = mockFiles.map(f => {
      const filePath = path.join(taskDir, f.fileName);
      fs.writeFileSync(filePath, f.content, 'utf8');
      const fileSize = fs.statSync(filePath).size;
      const checksum = CryptoJS.MD5(f.content).toString();
      return {
        fileName: f.fileName,
        filePath: `/exports/${taskId}/${f.fileName}`,
        fileSize,
        fileType: f.fileType,
        checksum,
        status: 'packed' as const
      };
    });

    FileManifestModel.bulkCreate(taskId, files);
  }

  private async createZipPackage(taskId: string, files: { fileName: string }[]): Promise<void> {
    const taskDir = path.join(EXPORT_BASE_DIR, taskId);
    const zipPath = path.join(taskDir, `export-${taskId}.zip`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      for (const file of files) {
        const filePath = path.join(taskDir, file.fileName);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file.fileName });
        }
      }

      archive.finalize();
    });
  }

  private async verifyFiles(taskId: string): Promise<void> {
    const files = FileManifestModel.findByTaskId(taskId);
    const taskDir = path.join(EXPORT_BASE_DIR, taskId);

    for (const file of files) {
      const filePath = path.join(taskDir, file.fileName);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const actualChecksum = CryptoJS.MD5(content).toString();
        if (actualChecksum !== file.checksum) {
          throw new Error(`File ${file.fileName} checksum mismatch`);
        }
      }
    }

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
    const certificate = ExportCertificateModel.findByTaskId(taskId);

    return {
      task,
      scope: scope || undefined,
      tenant: tenant || undefined,
      files,
      verification: verification || undefined,
      certificate: certificate || undefined
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

  validateDownloadToken(token: string): { taskId: string; valid: boolean } {
    const record = DownloadRecordModel.findByToken(token);
    if (!record) return { taskId: '', valid: false };
    if (Date.now() > record.expiresAt) return { taskId: record.taskId, valid: false };
    return { taskId: record.taskId, valid: true };
  }

  getDownloadFilePath(taskId: string): string {
    const zipPath = path.join(EXPORT_BASE_DIR, taskId, `export-${taskId}.zip`);
    if (!fs.existsSync(zipPath)) {
      throw new Error('Download file not found');
    }
    return zipPath;
  }

  getCertificate(taskId: string) {
    const certificate = ExportCertificateModel.findByTaskId(taskId);
    if (!certificate) throw new Error('Certificate not found');
    return certificate;
  }

  getTenants() {
    return TenantModel.findAll();
  }
}

export default new ExportService();
