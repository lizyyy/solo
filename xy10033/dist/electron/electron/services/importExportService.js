"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.importFromExcel = importFromExcel;
exports.importFromCSV = importFromCSV;
exports.exportToExcel = exportToExcel;
exports.exportToCSV = exportToCSV;
exports.getImportTemplate = getImportTemplate;
const XLSX = __importStar(require("xlsx"));
const types_1 = require("../../shared/types");
const reorderService_1 = require("./reorderService");
const auditService_1 = require("./auditService");
const IMPORT_FIELDS = [
    '订单号', '客户姓名', '客户电话', '客户地址',
    '产品名称', '产品SKU', '数量', '补发原因', '备注'
];
const EXPORT_FIELDS = [
    '订单号', '客户姓名', '客户电话', '客户地址',
    '产品名称', '产品SKU', '数量', '补发原因', '备注',
    '状态', '处理人', '快递单号', '物流公司',
    '重试次数', '创建时间', '更新时间'
];
function importFromExcel(buffer, operator) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return importData(data, operator);
}
function importFromCSV(content, operator) {
    const data = content.split('\n').map(line => line.split(',').map(cell => cell.trim()));
    return importData(data, operator);
}
function importData(data, operator) {
    const result = {
        success: 0,
        failed: 0,
        errors: []
    };
    if (data.length < 2) {
        result.errors.push({ row: 1, message: '没有数据行' });
        return result;
    }
    const headers = data[0];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every(cell => cell === '')) {
            continue;
        }
        try {
            const orderData = parseImportRow(row, headers);
            (0, reorderService_1.createOrder)(orderData, operator);
            result.success++;
        }
        catch (error) {
            result.failed++;
            result.errors.push({
                row: i + 1,
                message: error.message || '导入失败'
            });
        }
    }
    (0, auditService_1.createAuditLog)({
        operationType: types_1.OperationType.IMPORT,
        targetType: 'order',
        targetId: null,
        userId: operator.id,
        userName: operator.name,
        detail: `导入订单: 成功 ${result.success} 条, 失败 ${result.failed} 条`,
        success: result.failed === 0,
        errorMessage: result.failed > 0 ? `有 ${result.failed} 条数据导入失败` : undefined
    });
    return result;
}
function parseImportRow(row, headers) {
    const headerMap = {};
    headers.forEach((header, index) => {
        headerMap[header] = index;
    });
    const getValue = (fieldName, required = false) => {
        const index = headerMap[fieldName];
        if (index === undefined) {
            if (required) {
                throw new Error(`缺少必需字段: ${fieldName}`);
            }
            return undefined;
        }
        const value = row[index];
        if (required && (value === undefined || value === '')) {
            throw new Error(`字段值不能为空: ${fieldName}`);
        }
        return value?.toString();
    };
    const quantityStr = getValue('数量', false) || '1';
    const quantity = parseInt(quantityStr, 10) || 1;
    return {
        orderNo: getValue('订单号', false) || '',
        customerName: getValue('客户姓名', true),
        customerPhone: getValue('客户电话', true),
        customerAddress: getValue('客户地址', false) || '',
        productName: getValue('产品名称', true),
        productSku: getValue('产品SKU', false) || '',
        quantity,
        reason: getValue('补发原因', true),
        description: getValue('备注', false) || '',
        assigneeId: null,
        assigneeName: null,
        trackingNo: null,
        shippingCompany: null
    };
}
function exportToExcel(orders) {
    const data = orders.map(order => orderToRow(order));
    const worksheet = XLSX.utils.aoa_to_sheet([EXPORT_FIELDS, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '补发订单');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
function exportToCSV(orders) {
    const data = orders.map(order => orderToRow(order));
    const rows = [EXPORT_FIELDS, ...data];
    return rows.map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
}
function orderToRow(order) {
    const statusLabels = {
        pending: '待处理',
        processing: '处理中',
        shipped: '已发货',
        delivered: '已送达',
        completed: '已完成',
        cancelled: '已取消',
        failed: '处理失败'
    };
    return [
        order.orderNo,
        order.customerName,
        order.customerPhone,
        order.customerAddress,
        order.productName,
        order.productSku,
        order.quantity,
        order.reason,
        order.description,
        statusLabels[order.status] || order.status,
        order.assigneeName,
        order.trackingNo,
        order.shippingCompany,
        order.retryCount,
        order.createdAt,
        order.updatedAt
    ];
}
function getImportTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([IMPORT_FIELDS]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '模板');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
