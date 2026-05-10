"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Importer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
class Importer {
    static importFile(filePath, dataType) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        if (ext === '.json') {
            return this.importJSON(filePath, dataType);
        }
        else if (ext === '.csv') {
            return this.importCSV(filePath, dataType);
        }
        else {
            throw new Error(`不支持的文件格式: ${ext}，仅支持 .json 和 .csv`);
        }
    }
    static importJSON(filePath, dataType) {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        let data;
        try {
            data = JSON.parse(content);
        }
        catch (e) {
            throw new Error(`JSON 解析失败: ${e}`);
        }
        if (!Array.isArray(data)) {
            throw new Error('JSON 文件必须是数组格式');
        }
        const { result, errors } = this.transformData(data, dataType);
        return { data: result, errors };
    }
    static importCSV(filePath, dataType) {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        let records;
        try {
            records = (0, sync_1.parse)(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
        }
        catch (e) {
            throw new Error(`CSV 解析失败: ${e}`);
        }
        const { result, errors } = this.transformData(records, dataType);
        return { data: result, errors };
    }
    static transformData(records, dataType) {
        const result = [];
        const errors = [];
        records.forEach((record, index) => {
            const row = index + 2;
            try {
                let transformed;
                switch (dataType) {
                    case 'appointments':
                        transformed = this.transformAppointment(record);
                        break;
                    case 'batches':
                        transformed = this.transformBatch(record);
                        break;
                    case 'usage':
                        transformed = this.transformUsage(record);
                        break;
                    default:
                        throw new Error(`未知的数据类型: ${dataType}`);
                }
                result.push(transformed);
            }
            catch (e) {
                errors.push({
                    row,
                    message: e.message
                });
            }
        });
        return { result, errors };
    }
    static transformAppointment(record) {
        return {
            appointmentId: this.cleanString(record.appointmentId || record.appointment_id || record.预约号),
            patientName: this.cleanString(record.patientName || record.patient_name || record.患者姓名),
            patientId: this.cleanString(record.patientId || record.patient_id || record.患者ID),
            scheduledDate: this.cleanString(record.scheduledDate || record.scheduled_date || record.预约日期),
            scheduledTime: this.cleanString(record.scheduledTime || record.scheduled_time || record.预约时间),
            contrastAgent: this.cleanString(record.contrastAgent || record.contrast_agent || record.药剂名称),
            plannedDose: this.parseNumber(record.plannedDose || record.planned_dose || record.计划剂量),
            department: this.cleanString(record.department || record.科室),
            doctor: this.cleanString(record.doctor || record.医生)
        };
    }
    static transformBatch(record) {
        return {
            batchNumber: this.cleanString(record.batchNumber || record.batch_number || record.批号),
            contrastAgent: this.cleanString(record.contrastAgent || record.contrast_agent || record.药剂名称),
            totalVolume: this.parseNumber(record.totalVolume || record.total_volume || record.总量),
            expiryDate: this.cleanString(record.expiryDate || record.expiry_date || record.有效期),
            importDate: this.cleanString(record.importDate || record.import_date || record.入库日期),
            manufacturer: this.cleanString(record.manufacturer || record.生产厂家)
        };
    }
    static transformUsage(record) {
        return {
            appointmentId: this.cleanString(record.appointmentId || record.appointment_id || record.预约号),
            batchNumber: this.cleanString(record.batchNumber || record.batch_number || record.批号),
            openedAt: this.cleanString(record.openedAt || record.opened_at || record.开瓶时间),
            actualDose: this.parseNumber(record.actualDose || record.actual_dose || record.实际用量),
            isRefund: this.parseBoolean(record.isRefund || record.is_refund || record.是否退费),
            operator: this.cleanString(record.operator || record.操作人员),
            notes: this.cleanString(record.notes || record.备注)
        };
    }
    static cleanString(value) {
        if (value === null || value === undefined)
            return '';
        return String(value).trim();
    }
    static parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        const num = Number(value);
        if (isNaN(num)) {
            throw new Error(`无效的数字: ${value}`);
        }
        return num;
    }
    static parseBoolean(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value !== 0;
        if (typeof value === 'string') {
            const str = value.toLowerCase().trim();
            return str === 'true' || str === 'yes' || str === '1' || str === '是' || str === '退费';
        }
        return false;
    }
}
exports.Importer = Importer;
