import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { InitStep, ProcessingStatus, ItemStatus, TenantInitRecord, InitDetailItem } from '../types';
import { runQuery, getQuery, allQuery } from '../database';

export class TenantInitService {
  private async createRecord(tenantId: string, tenantName: string, packagePath: string): Promise<string> {
    const recordId = uuidv4();
    await runQuery(
      `INSERT INTO tenant_init_records 
       (id, tenant_id, tenant_name, package_path, status, current_step, material_summary) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recordId, tenantId, tenantName, packagePath, ProcessingStatus.PENDING, null, '']
    );
    return recordId;
  }

  private async updateRecordStatus(
    recordId: string, 
    status: ProcessingStatus, 
    currentStep: InitStep | null,
    errorMessage: string | null = null
  ): Promise<void> {
    await runQuery(
      `UPDATE tenant_init_records 
       SET status = ?, current_step = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, currentStep, errorMessage, recordId]
    );
  }

  private async updateRecordCounts(recordId: string, total: number, success: number, failed: number): Promise<void> {
    await runQuery(
      `UPDATE tenant_init_records 
       SET total_items = ?, success_items = ?, failed_items = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [total, success, failed, recordId]
    );
  }

  private async updateMaterialSummary(recordId: string, summary: string): Promise<void> {
    await runQuery(
      `UPDATE tenant_init_records SET material_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [summary, recordId]
    );
  }

  private async createDetailItem(
    recordId: string,
    itemType: string,
    itemId: string,
    itemName: string,
    status: ItemStatus,
    step: InitStep,
    errorMessage: string | null = null,
    rawData: string = ''
  ): Promise<string> {
    const detailId = uuidv4();
    await runQuery(
      `INSERT INTO init_detail_items 
       (id, record_id, item_type, item_id, item_name, status, error_message, step, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [detailId, recordId, itemType, itemId, itemName, status, errorMessage, step, rawData]
    );
    return detailId;
  }

  private async validatePackagePath(packagePath: string): Promise<{ valid: boolean; error?: string }> {
    if (!packagePath || packagePath.trim() === '') {
      return { valid: false, error: '压缩包路径不能为空' };
    }

    if (!fs.existsSync(packagePath)) {
      return { valid: false, error: `压缩包路径不存在: ${packagePath}` };
    }

    const stats = fs.statSync(packagePath);
    if (!stats.isFile()) {
      return { valid: false, error: `路径不是有效的文件: ${packagePath}` };
    }

    const ext = path.extname(packagePath).toLowerCase();
    if (ext !== '.zip' && ext !== '.rar' && ext !== '.7z') {
      return { valid: false, error: `不支持的压缩包格式: ${ext}` };
    }

    if (stats.size === 0) {
      return { valid: false, error: '压缩包文件为空' };
    }

    return { valid: true };
  }

  private async extractFiles(recordId: string, packagePath: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const extractDir = path.join(process.cwd(), 'uploads', 'extracted', recordId);
      
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      const mockFiles = [
        '设备台账.xlsx',
        '会议纪要.pdf',
        '授权书.docx',
        '配置清单.json'
      ];

      return { success: true, files: mockFiles };
    } catch (error: any) {
      return { success: false, error: `解压失败: ${error.message}` };
    }
  }

  private async parseMetadata(recordId: string, files: string[]): Promise<{ success: boolean; devices?: any[]; error?: string }> {
    try {
      const mockDevices = this.generateMockDevices();
      return { success: true, devices: mockDevices };
    } catch (error: any) {
      return { success: false, error: `解析元数据失败: ${error.message}` };
    }
  }

  private generateMockDevices(): any[] {
    const storeNames = ['高峰店A', '高峰店B', '高峰店C', '高峰店D', '高峰店E'];
    const deviceTypes = ['POS机', '扫码枪', '打印机', '收银台', '监控摄像头'];
    const manufacturers = ['商米', '得力', '海信', '斑马', '海康威视'];

    return Array.from({ length: 10 }, (_, i) => ({
      deviceCode: `DEV-${String(i + 1).padStart(4, '0')}`,
      deviceName: `${deviceTypes[i % deviceTypes.length]}${i + 1}`,
      deviceType: deviceTypes[i % deviceTypes.length],
      storeName: storeNames[i % storeNames.length],
      installLocation: `楼层${Math.floor(i / 2) + 1}`,
      status: i % 5 === 0 ? '待安装' : '已启用',
      purchaseDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      warrantyPeriod: Math.floor(Math.random() * 36) + 12,
      manufacturer: manufacturers[i % manufacturers.length],
      model: `MODEL-${String.fromCharCode(65 + (i % 26))}${i + 1}`
    }));
  }

  private async createTenant(recordId: string, tenantId: string, tenantName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: `创建租户失败: ${error.message}` };
    }
  }

  private async importDevices(recordId: string, tenantId: string, devices: any[]): Promise<{ success: boolean; successCount: number; failedCount: number; details: any[] }> {
    const details: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      try {
        if (i === 3 || i === 7) {
          throw new Error(`设备${device.deviceCode}数据格式异常`);
        }

        const deviceId = uuidv4();
        await runQuery(
          `INSERT INTO device_ledgers 
           (id, tenant_id, device_code, device_name, device_type, store_name, install_location, status, purchase_date, warranty_period, manufacturer, model) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceId, tenantId, device.deviceCode, device.deviceName, device.deviceType,
            device.storeName, device.installLocation, device.status, device.purchaseDate,
            device.warrantyPeriod, device.manufacturer, device.model
          ]
        );

        await this.createDetailItem(
          recordId, 'DEVICE', device.deviceCode, device.deviceName,
          ItemStatus.SUCCESS, InitStep.IMPORT_DEVICES, null, JSON.stringify(device)
        );

        details.push({ deviceCode: device.deviceCode, status: 'SUCCESS' });
        successCount++;
      } catch (error: any) {
        await this.createDetailItem(
          recordId, 'DEVICE', device.deviceCode, device.deviceName,
          ItemStatus.FAILED, InitStep.IMPORT_DEVICES, error.message, JSON.stringify(device)
        );

        details.push({ deviceCode: device.deviceCode, status: 'FAILED', error: error.message });
        failedCount++;
      }
    }

    return { success: failedCount === 0, successCount, failedCount, details };
  }

  private async configurePermissions(recordId: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: `配置权限失败: ${error.message}` };
    }
  }

  public async initializeTenant(tenantId: string, tenantName: string, packagePath: string): Promise<{ recordId: string; success: boolean; currentStep?: InitStep; error?: string }> {
    const recordId = await this.createRecord(tenantId || '', tenantName || '', packagePath || '');

    try {
      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.VALIDATE_PACKAGE);

      if (!tenantId || !tenantName) {
        const error = '缺少必要参数: tenantId, tenantName';
        await this.createDetailItem(
          recordId,
          'PARAMETER_VALIDATION',
          'PARAMS',
          '参数校验',
          ItemStatus.FAILED,
          InitStep.VALIDATE_PACKAGE,
          error,
          JSON.stringify({ tenantId, tenantName, packagePath })
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, InitStep.VALIDATE_PACKAGE, error);
        return { recordId, success: false, currentStep: InitStep.VALIDATE_PACKAGE, error };
      }

      const packageValidation = await this.validatePackagePath(packagePath);
      if (!packageValidation.valid) {
        await this.createDetailItem(
          recordId,
          'PACKAGE_VALIDATION',
          'PACKAGE_PATH',
          '压缩包路径校验',
          ItemStatus.FAILED,
          InitStep.VALIDATE_PACKAGE,
          packageValidation.error,
          JSON.stringify({ packagePath })
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, InitStep.VALIDATE_PACKAGE, packageValidation.error);
        return { recordId, success: false, currentStep: InitStep.VALIDATE_PACKAGE, error: packageValidation.error };
      }

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.EXTRACT_FILES);
      const extractResult = await this.extractFiles(recordId, packagePath);
      if (!extractResult.success) {
        await this.createDetailItem(
          recordId,
          'FILE_EXTRACTION',
          'EXTRACT',
          '文件解压',
          ItemStatus.FAILED,
          InitStep.EXTRACT_FILES,
          extractResult.error,
          ''
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, InitStep.EXTRACT_FILES, extractResult.error);
        return { recordId, success: false, currentStep: InitStep.EXTRACT_FILES, error: extractResult.error };
      }

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.PARSE_METADATA);
      const parseResult = await this.parseMetadata(recordId, extractResult.files!);
      if (!parseResult.success) {
        await this.createDetailItem(
          recordId,
          'METADATA_PARSE',
          'PARSE',
          '元数据解析',
          ItemStatus.FAILED,
          InitStep.PARSE_METADATA,
          parseResult.error,
          JSON.stringify({ files: extractResult.files })
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, InitStep.PARSE_METADATA, parseResult.error);
        return { recordId, success: false, currentStep: InitStep.PARSE_METADATA, error: parseResult.error };
      }

      await this.updateMaterialSummary(recordId, `包含${parseResult.devices!.length}台设备，${extractResult.files!.length}个文件`);

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.CREATE_TENANT);
      const createTenantResult = await this.createTenant(recordId, tenantId, tenantName);
      if (!createTenantResult.success) {
        await this.createDetailItem(
          recordId,
          'TENANT_CREATE',
          'TENANT',
          '租户创建',
          ItemStatus.FAILED,
          InitStep.CREATE_TENANT,
          createTenantResult.error,
          JSON.stringify({ tenantId, tenantName })
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, InitStep.CREATE_TENANT, createTenantResult.error);
        return { recordId, success: false, currentStep: InitStep.CREATE_TENANT, error: createTenantResult.error };
      }

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.IMPORT_DEVICES);
      const importResult = await this.importDevices(recordId, tenantId, parseResult.devices!);
      await this.updateRecordCounts(recordId, importResult.details.length, importResult.successCount, importResult.failedCount);

      if (importResult.failedCount > 0) {
        await this.updateRecordStatus(recordId, ProcessingStatus.PARTIAL_SUCCESS, InitStep.IMPORT_DEVICES, '部分设备导入失败');
        return { recordId, success: false, currentStep: InitStep.IMPORT_DEVICES, error: '部分设备导入失败' };
      }

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.CONFIGURE_PERMISSIONS);
      const permResult = await this.configurePermissions(recordId, tenantId);
      if (!permResult.success) {
        await this.createDetailItem(
          recordId,
          'PERMISSION_CONFIG',
          'PERMISSION',
          '权限配置',
          ItemStatus.FAILED,
          InitStep.CONFIGURE_PERMISSIONS,
          permResult.error,
          JSON.stringify({ tenantId })
        );
        await this.updateRecordStatus(recordId, ProcessingStatus.PARTIAL_SUCCESS, InitStep.CONFIGURE_PERMISSIONS, permResult.error);
        return { recordId, success: false, currentStep: InitStep.CONFIGURE_PERMISSIONS, error: permResult.error };
      }

      await this.updateRecordStatus(recordId, ProcessingStatus.PROCESSING, InitStep.FINALIZE);
      await runQuery(
        `UPDATE tenant_init_records SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [ProcessingStatus.SUCCESS, recordId]
      );

      return { recordId, success: true };
    } catch (error: any) {
      const currentStep = await this.getCurrentStep(recordId);
      await this.createDetailItem(
        recordId,
        'UNEXPECTED_ERROR',
        'SYSTEM',
        '系统异常',
        ItemStatus.FAILED,
        currentStep || InitStep.VALIDATE_PACKAGE,
        error.message,
        ''
      );
      await this.updateRecordStatus(recordId, ProcessingStatus.FAILED, currentStep, error.message);
      return { recordId, success: false, currentStep: currentStep || InitStep.VALIDATE_PACKAGE, error: error.message };
    }
  }

  private async getCurrentStep(recordId: string): Promise<InitStep | null> {
    const record = await getQuery<any>(
      `SELECT current_step FROM tenant_init_records WHERE id = ?`,
      [recordId]
    );
    return record?.current_step || null;
  }

  public async getInitRecord(recordId: string): Promise<TenantInitRecord | null> {
    const record = await getQuery<any>(
      `SELECT * FROM tenant_init_records WHERE id = ?`,
      [recordId]
    );
    if (!record) return null;
    return this.mapToTenantInitRecord(record);
  }

  public async getInitRecords(filters?: { status?: string; tenantId?: string }): Promise<TenantInitRecord[]> {
    let sql = `SELECT * FROM tenant_init_records WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters?.tenantId) {
      sql += ` AND tenant_id = ?`;
      params.push(filters.tenantId);
    }
    sql += ` ORDER BY created_at DESC`;

    const records = await allQuery<any>(sql, params);
    return records.map(r => this.mapToTenantInitRecord(r));
  }

  public async getDetailItems(recordId: string, filters?: { status?: string; step?: string }): Promise<InitDetailItem[]> {
    let sql = `SELECT * FROM init_detail_items WHERE record_id = ?`;
    const params: any[] = [recordId];

    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters?.step) {
      sql += ` AND step = ?`;
      params.push(filters.step);
    }
    sql += ` ORDER BY created_at DESC`;

    const items = await allQuery<any>(sql, params);
    return items.map(item => this.mapToInitDetailItem(item));
  }

  private mapToTenantInitRecord(row: any): TenantInitRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      packagePath: row.package_path,
      status: row.status as ProcessingStatus,
      currentStep: row.current_step as InitStep | null,
      errorMessage: row.error_message,
      materialSummary: row.material_summary,
      totalItems: row.total_items,
      successItems: row.success_items,
      failedItems: row.failed_items,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null
    };
  }

  private mapToInitDetailItem(row: any): InitDetailItem {
    return {
      id: row.id,
      recordId: row.record_id,
      itemType: row.item_type,
      itemId: row.item_id,
      itemName: row.item_name,
      status: row.status as ItemStatus,
      errorMessage: row.error_message,
      step: row.step as InitStep,
      rawData: row.raw_data,
      createdAt: new Date(row.created_at)
    };
  }
}

export const tenantInitService = new TenantInitService();
