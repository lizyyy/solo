"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardizeRow = standardizeRow;
exports.validateStandardizedData = validateStandardizedData;
const moment_1 = __importDefault(require("moment"));
const fieldAliases = {
    orderNumber: ['工单号', '工单编号', '订单号', 'order_number', 'orderNo', 'order_id', '工单ID'],
    residentName: ['住户姓名', '业主姓名', '姓名', 'resident_name', 'residentName', 'name'],
    roomNumber: ['房间号', '房号', '门牌', 'room_number', 'roomNo', 'room'],
    phoneNumber: ['联系电话', '电话', '手机号', 'phone_number', 'phone', 'mobile'],
    repairType: ['维修类型', '报修类型', '类型', 'repair_type', 'type'],
    description: ['问题描述', '描述', '报修内容', 'description', 'content'],
    reportTime: ['报修时间', '上报时间', '提交时间', 'report_time', 'submitTime', 'time'],
    technicianName: ['维修师傅', '维修人员', '师傅姓名', 'technician_name', 'technician'],
    arrivalTime: ['到达时间', '上门时间', 'arrival_time'],
    completionTime: ['完成时间', '完工时间', 'completion_time', 'finishTime'],
    repairResult: ['维修结果', '处理结果', 'repair_result', 'result'],
    materialName: ['材料名称', '物料名称', 'material_name', 'material'],
    materialQuantity: ['数量', '领用数量', 'material_quantity', 'quantity'],
    materialUnit: ['单位', 'material_unit', 'unit'],
    supervisorNote: ['主管批注', '批注', '备注', 'supervisor_note', 'note'],
};
function findField(fields, targetField) {
    const aliases = fieldAliases[targetField] || [];
    for (const [key, value] of Object.entries(fields)) {
        const normalizedKey = key.toLowerCase().replace(/[\s_]+/g, '');
        if (key === targetField || aliases.some(a => a.toLowerCase() === normalizedKey || normalizedKey.includes(a.toLowerCase().replace(/[\s_]+/g, '')))) {
            return value;
        }
    }
    return undefined;
}
function normalizePhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}
function normalizeTime(timeStr) {
    if (!timeStr)
        return undefined;
    const formats = [
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD HH:mm',
        'YYYY/MM/DD HH:mm:ss',
        'YYYY/MM/DD HH:mm',
        'YYYY年MM月DD日 HH:mm',
        'YYYY-MM-DD',
        'YYYY/MM/DD',
    ];
    for (const format of formats) {
        const m = (0, moment_1.default)(timeStr, format, true);
        if (m.isValid()) {
            return m.toISOString();
        }
    }
    return undefined;
}
function normalizeNumber(numStr) {
    if (!numStr)
        return undefined;
    const num = parseFloat(numStr);
    return isNaN(num) ? undefined : num;
}
function standardizeRow(row, sourceType) {
    const errors = [];
    const data = {};
    let confidence = 1.0;
    const orderNumber = findField(row.fields, 'orderNumber');
    if (!orderNumber) {
        errors.push({ field: 'orderNumber', code: 'MISSING_REQUIRED', message: '缺少工单号' });
        confidence -= 0.3;
    }
    else {
        data.orderNumber = orderNumber.trim();
    }
    switch (sourceType) {
        case 'resident_report':
            data.residentName = findField(row.fields, 'residentName');
            data.roomNumber = findField(row.fields, 'roomNumber');
            const phone = findField(row.fields, 'phoneNumber');
            if (phone) {
                data.phoneNumber = normalizePhone(phone);
            }
            data.repairType = findField(row.fields, 'repairType');
            data.description = findField(row.fields, 'description');
            data.reportTime = normalizeTime(findField(row.fields, 'reportTime') || '');
            break;
        case 'technician_receipt':
            data.technicianName = findField(row.fields, 'technicianName');
            data.arrivalTime = normalizeTime(findField(row.fields, 'arrivalTime') || '');
            data.completionTime = normalizeTime(findField(row.fields, 'completionTime') || '');
            data.repairResult = findField(row.fields, 'repairResult');
            break;
        case 'material_usage':
            data.materialName = findField(row.fields, 'materialName');
            const qty = findField(row.fields, 'materialQuantity');
            if (qty) {
                data.materialQuantity = normalizeNumber(qty);
            }
            data.materialUnit = findField(row.fields, 'materialUnit');
            break;
        case 'supervisor_note':
            data.supervisorNote = findField(row.fields, 'supervisorNote');
            break;
    }
    const allEmpty = Object.values(data).every(v => v === undefined || v === '');
    if (allEmpty && !orderNumber) {
        errors.push({ field: 'all', code: 'NO_DATA', message: '未识别到有效数据' });
        confidence = 0;
    }
    return {
        success: errors.filter(e => e.code === 'MISSING_REQUIRED').length === 0,
        data,
        errors,
        confidence: Math.max(0, confidence),
    };
}
function validateStandardizedData(data, sourceType) {
    const errors = [];
    if (data.phoneNumber) {
        if (!/^1[3-9]\d{9}$/.test(data.phoneNumber)) {
            errors.push({ field: 'phoneNumber', code: 'INVALID_PHONE', message: '手机号格式不正确', severity: 'warning' });
        }
    }
    if (data.roomNumber) {
        if (!/^\d+[-_]?\d+/.test(data.roomNumber) && data.roomNumber.length < 2) {
            errors.push({ field: 'roomNumber', code: 'INVALID_ROOM', message: '房间号格式可能不正确', severity: 'warning' });
        }
    }
    if (data.materialQuantity !== undefined) {
        if (data.materialQuantity < 0) {
            errors.push({ field: 'materialQuantity', code: 'NEGATIVE_QUANTITY', message: '材料数量不能为负数', severity: 'error' });
        }
    }
    return errors;
}
//# sourceMappingURL=standardizer.js.map