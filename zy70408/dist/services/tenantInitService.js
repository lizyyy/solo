"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantInitService = exports.TenantInitService = void 0;
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("../types");
const database_1 = require("../database");
class TenantInitService {
    async createRecord(tenantId, tenantName, packagePath) {
        const recordId = (0, uuid_1.v4)();
        await (0, database_1.runQuery)(`INSERT INTO tenant_init_records 
       (id, tenant_id, tenant_name, package_path, status, current_step, material_summary) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [recordId, tenantId, tenantName, packagePath, types_1.ProcessingStatus.PENDING, null, '']);
        return recordId;
    }
    async updateRecordStatus(recordId, status, currentStep, errorMessage = null) {
        await (0, database_1.runQuery)(`UPDATE tenant_init_records 
       SET status = ?, current_step = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`, [status, currentStep, errorMessage, recordId]);
    }
    async updateRecordCounts(recordId, total, success, failed) {
        await (0, database_1.runQuery)(`UPDATE tenant_init_records 
       SET total_items = ?, success_items = ?, failed_items = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`, [total, success, failed, recordId]);
    }
    async updateMaterialSummary(recordId, summary) {
        await (0, database_1.runQuery)(`UPDATE tenant_init_records SET material_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [summary, recordId]);
    }
    async createDetailItem(recordId, itemType, itemId, itemName, status, step, errorMessage = null, rawData = '') {
        const detailId = (0, uuid_1.v4)();
        await (0, database_1.runQuery)(`INSERT INTO init_detail_items 
       (id, record_id, item_type, item_id, item_name, status, error_message, step, raw_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [detailId, recordId, itemType, itemId, itemName, status, errorMessage, step, rawData]);
        return detailId;
    }
    async validatePackagePath(packagePath) {
        if (!packagePath || packagePath.trim() === '') {
            return { valid: false, error: '压缩包路径不能为空' };
        }
        if (!fs_1.default.existsSync(packagePath)) {
            return { valid: false, error: `压缩包路径不存在: ${packagePath}` };
        }
        const stats = fs_1.default.statSync(packagePath);
        if (!stats.isFile()) {
            return { valid: false, error: `路径不是有效的文件: ${packagePath}` };
        }
        const ext = path_1.default.extname(packagePath).toLowerCase();
        if (ext !== '.zip' && ext !== '.rar' && ext !== '.7z') {
            return { valid: false, error: `不支持的压缩包格式: ${ext}` };
        }
        if (stats.size === 0) {
            return { valid: false, error: '压缩包文件为空' };
        }
        return { valid: true };
    }
    async extractFiles(recordId, packagePath) {
        try {
            const extractDir = path_1.default.join(process.cwd(), 'uploads', 'extracted', recordId);
            if (!fs_1.default.existsSync(extractDir)) {
                fs_1.default.mkdirSync(extractDir, { recursive: true });
            }
            const mockFiles = [
                '设备台账.xlsx',
                '会议纪要.pdf',
                '授权书.docx',
                '配置清单.json'
            ];
            return { success: true, files: mockFiles };
        }
        catch (error) {
            return { success: false, error: `解压失败: ${error.message}` };
        }
    }
    async parseMetadata(recordId, files) {
        try {
            const mockDevices = this.generateMockDevices();
            return { success: true, devices: mockDevices };
        }
        catch (error) {
            return { success: false, error: `解析元数据失败: ${error.message}` };
        }
    }
    generateMockDevices() {
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
    async createTenant(recordId, tenantId, tenantName) {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            return { success: true };
        }
        catch (error) {
            return { success: false, error: `创建租户失败: ${error.message}` };
        }
    }
    async importDevices(recordId, tenantId, devices) {
        const details = [];
        let successCount = 0;
        let failedCount = 0;
        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            try {
                if (i === 3 || i === 7) {
                    throw new Error(`设备${device.deviceCode}数据格式异常`);
                }
                const deviceId = (0, uuid_1.v4)();
                await (0, database_1.runQuery)(`INSERT INTO device_ledgers 
           (id, tenant_id, device_code, device_name, device_type, store_name, install_location, status, purchase_date, warranty_period, manufacturer, model) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    deviceId, tenantId, device.deviceCode, device.deviceName, device.deviceType,
                    device.storeName, device.installLocation, device.status, device.purchaseDate,
                    device.warrantyPeriod, device.manufacturer, device.model
                ]);
                await this.createDetailItem(recordId, 'DEVICE', device.deviceCode, device.deviceName, types_1.ItemStatus.SUCCESS, types_1.InitStep.IMPORT_DEVICES, null, JSON.stringify(device));
                details.push({ deviceCode: device.deviceCode, status: 'SUCCESS' });
                successCount++;
            }
            catch (error) {
                await this.createDetailItem(recordId, 'DEVICE', device.deviceCode, device.deviceName, types_1.ItemStatus.FAILED, types_1.InitStep.IMPORT_DEVICES, error.message, JSON.stringify(device));
                details.push({ deviceCode: device.deviceCode, status: 'FAILED', error: error.message });
                failedCount++;
            }
        }
        return { success: failedCount === 0, successCount, failedCount, details };
    }
    async configurePermissions(recordId, tenantId) {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            return { success: true };
        }
        catch (error) {
            return { success: false, error: `配置权限失败: ${error.message}` };
        }
    }
    async initializeTenant(tenantId, tenantName, packagePath) {
        const recordId = await this.createRecord(tenantId, tenantName, packagePath);
        try {
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.VALIDATE_PACKAGE);
            const packageValidation = await this.validatePackagePath(packagePath);
            if (!packageValidation.valid) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.FAILED, types_1.InitStep.VALIDATE_PACKAGE, packageValidation.error);
                return { recordId, success: false, currentStep: types_1.InitStep.VALIDATE_PACKAGE, error: packageValidation.error };
            }
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.EXTRACT_FILES);
            const extractResult = await this.extractFiles(recordId, packagePath);
            if (!extractResult.success) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.FAILED, types_1.InitStep.EXTRACT_FILES, extractResult.error);
                return { recordId, success: false, currentStep: types_1.InitStep.EXTRACT_FILES, error: extractResult.error };
            }
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.PARSE_METADATA);
            const parseResult = await this.parseMetadata(recordId, extractResult.files);
            if (!parseResult.success) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.FAILED, types_1.InitStep.PARSE_METADATA, parseResult.error);
                return { recordId, success: false, currentStep: types_1.InitStep.PARSE_METADATA, error: parseResult.error };
            }
            await this.updateMaterialSummary(recordId, `包含${parseResult.devices.length}台设备，${extractResult.files.length}个文件`);
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.CREATE_TENANT);
            const createTenantResult = await this.createTenant(recordId, tenantId, tenantName);
            if (!createTenantResult.success) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.FAILED, types_1.InitStep.CREATE_TENANT, createTenantResult.error);
                return { recordId, success: false, currentStep: types_1.InitStep.CREATE_TENANT, error: createTenantResult.error };
            }
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.IMPORT_DEVICES);
            const importResult = await this.importDevices(recordId, tenantId, parseResult.devices);
            await this.updateRecordCounts(recordId, importResult.details.length, importResult.successCount, importResult.failedCount);
            if (importResult.failedCount > 0) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PARTIAL_SUCCESS, types_1.InitStep.IMPORT_DEVICES, '部分设备导入失败');
                return { recordId, success: false, currentStep: types_1.InitStep.IMPORT_DEVICES, error: '部分设备导入失败' };
            }
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.CONFIGURE_PERMISSIONS);
            const permResult = await this.configurePermissions(recordId, tenantId);
            if (!permResult.success) {
                await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PARTIAL_SUCCESS, types_1.InitStep.CONFIGURE_PERMISSIONS, permResult.error);
                return { recordId, success: false, currentStep: types_1.InitStep.CONFIGURE_PERMISSIONS, error: permResult.error };
            }
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.PROCESSING, types_1.InitStep.FINALIZE);
            await (0, database_1.runQuery)(`UPDATE tenant_init_records SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [types_1.ProcessingStatus.SUCCESS, recordId]);
            return { recordId, success: true };
        }
        catch (error) {
            const currentStep = await this.getCurrentStep(recordId);
            await this.updateRecordStatus(recordId, types_1.ProcessingStatus.FAILED, currentStep, error.message);
            return { recordId, success: false, currentStep: currentStep || undefined, error: error.message };
        }
    }
    async getCurrentStep(recordId) {
        const record = await (0, database_1.getQuery)(`SELECT current_step FROM tenant_init_records WHERE id = ?`, [recordId]);
        return record?.current_step || null;
    }
    async getInitRecord(recordId) {
        const record = await (0, database_1.getQuery)(`SELECT * FROM tenant_init_records WHERE id = ?`, [recordId]);
        if (!record)
            return null;
        return this.mapToTenantInitRecord(record);
    }
    async getInitRecords(filters) {
        let sql = `SELECT * FROM tenant_init_records WHERE 1=1`;
        const params = [];
        if (filters?.status) {
            sql += ` AND status = ?`;
            params.push(filters.status);
        }
        if (filters?.tenantId) {
            sql += ` AND tenant_id = ?`;
            params.push(filters.tenantId);
        }
        sql += ` ORDER BY created_at DESC`;
        const records = await (0, database_1.allQuery)(sql, params);
        return records.map(r => this.mapToTenantInitRecord(r));
    }
    async getDetailItems(recordId, filters) {
        let sql = `SELECT * FROM init_detail_items WHERE record_id = ?`;
        const params = [recordId];
        if (filters?.status) {
            sql += ` AND status = ?`;
            params.push(filters.status);
        }
        if (filters?.step) {
            sql += ` AND step = ?`;
            params.push(filters.step);
        }
        sql += ` ORDER BY created_at DESC`;
        const items = await (0, database_1.allQuery)(sql, params);
        return items.map(item => this.mapToInitDetailItem(item));
    }
    mapToTenantInitRecord(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            tenantName: row.tenant_name,
            packagePath: row.package_path,
            status: row.status,
            currentStep: row.current_step,
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
    mapToInitDetailItem(row) {
        return {
            id: row.id,
            recordId: row.record_id,
            itemType: row.item_type,
            itemId: row.item_id,
            itemName: row.item_name,
            status: row.status,
            errorMessage: row.error_message,
            step: row.step,
            rawData: row.raw_data,
            createdAt: new Date(row.created_at)
        };
    }
}
exports.TenantInitService = TenantInitService;
exports.tenantInitService = new TenantInitService();
