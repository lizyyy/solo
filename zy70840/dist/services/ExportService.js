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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const csv_writer_1 = require("csv-writer");
const sequelize_1 = require("sequelize");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Application_1 = __importStar(require("../models/Application"));
const ProcessingLog_1 = __importDefault(require("../models/ProcessingLog"));
const DepositFlow_1 = __importDefault(require("../models/DepositFlow"));
const dayjs_1 = __importDefault(require("dayjs"));
class ExportService {
    ensureExportDir() {
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        return exportDir;
    }
    async exportApplications(filters, includeDetails = false) {
        const where = {};
        if (filters.batchId) {
            where.batchId = filters.batchId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.merchantName) {
            where.merchantName = { [sequelize_1.Op.like]: `%${filters.merchantName}%` };
        }
        if (filters.stallLocation) {
            where.stallLocation = { [sequelize_1.Op.like]: `%${filters.stallLocation}%` };
        }
        if (filters.startDate && filters.endDate) {
            where.startDate = { [sequelize_1.Op.lte]: filters.endDate };
            where.endDate = { [sequelize_1.Op.gte]: filters.startDate };
        }
        if (filters.certificateVersion) {
            where.certificateVersion = { [sequelize_1.Op.like]: `%${filters.certificateVersion}%` };
        }
        const applications = await Application_1.default.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                { association: 'batch', attributes: ['batchNo', 'name'] },
                ...(includeDetails ? [
                    { association: 'certificates' },
                    { association: 'logs' },
                    { association: 'depositFlows' },
                ] : []),
            ],
        });
        const exportDir = this.ensureExportDir();
        const fileName = `applications_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.csv`;
        const filePath = path.join(exportDir, fileName);
        const statusMap = {
            [Application_1.ApplicationStatus.PENDING]: '待处理',
            [Application_1.ApplicationStatus.PROCESSING]: '处理中',
            [Application_1.ApplicationStatus.APPROVED]: '已通过',
            [Application_1.ApplicationStatus.REJECTED]: '已拒绝',
            [Application_1.ApplicationStatus.RETURNED]: '已退回',
        };
        const records = applications.map(app => {
            const appData = app;
            if (appData.logs) {
                appData.logs.sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
            }
            return {
                applicationNo: app.applicationNo,
                batchNo: appData.batch?.batchNo || '',
                merchantName: app.merchantName,
                contactPerson: app.contactPerson,
                contactPhone: app.contactPhone,
                stallType: app.stallType,
                stallLocation: app.stallLocation,
                startDate: (0, dayjs_1.default)(app.startDate).format('YYYY-MM-DD'),
                endDate: (0, dayjs_1.default)(app.endDate).format('YYYY-MM-DD'),
                depositAmount: app.depositAmount,
                status: statusMap[app.status] || app.status,
                certificateVersion: app.certificateVersion || '',
                processedBy: app.processedBy || '',
                processedAt: app.processedAt ? (0, dayjs_1.default)(app.processedAt).format('YYYY-MM-DD HH:mm:ss') : '',
                importedAt: (0, dayjs_1.default)(app.importedAt).format('YYYY-MM-DD HH:mm:ss'),
                ...(includeDetails ? {
                    issues: appData.logs
                        ?.filter((l) => l.logType !== 'status_change')
                        .map((l) => l.readableReason)
                        .join('; ') || '',
                    lastLog: appData.logs?.[0]?.readableReason || '',
                } : {}),
            };
        });
        const headers = [
            { id: 'applicationNo', title: '申请编号' },
            { id: 'batchNo', title: '批次编号' },
            { id: 'merchantName', title: '商户名称' },
            { id: 'contactPerson', title: '联系人' },
            { id: 'contactPhone', title: '联系电话' },
            { id: 'stallType', title: '摊位类型' },
            { id: 'stallLocation', title: '摊位位置' },
            { id: 'startDate', title: '开始日期' },
            { id: 'endDate', title: '结束日期' },
            { id: 'depositAmount', title: '押金余额' },
            { id: 'status', title: '状态' },
            { id: 'certificateVersion', title: '证照版本' },
            { id: 'processedBy', title: '处理人' },
            { id: 'processedAt', title: '处理时间' },
            { id: 'importedAt', title: '导入时间' },
            ...(includeDetails ? [
                { id: 'issues', title: '问题记录' },
                { id: 'lastLog', title: '最新处理记录' },
            ] : []),
        ];
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: headers,
            encoding: 'utf8',
        });
        await csvWriter.writeRecords(records);
        return {
            totalCount: applications.length,
            exportedCount: records.length,
            filePath,
            fileName,
        };
    }
    async exportLogs(applicationId, startDate, endDate) {
        const where = {};
        if (applicationId) {
            where.applicationId = applicationId;
        }
        if (startDate && endDate) {
            where.operatedAt = { [sequelize_1.Op.between]: [startDate, endDate] };
        }
        const logs = await ProcessingLog_1.default.findAll({
            where,
            order: [['operatedAt', 'DESC']],
            include: [{
                    model: Application_1.default,
                    as: 'application',
                    attributes: ['applicationNo', 'merchantName'],
                }],
        });
        const logTypeMap = {
            status_change: '状态变更',
            certificate_issue: '证照问题',
            schedule_conflict: '档期冲突',
            deposit_deduction: '押金扣减',
            remark: '备注',
            returned: '退回修改',
        };
        const records = logs.map(log => ({
            applicationNo: log.application?.applicationNo || '',
            merchantName: log.application?.merchantName || '',
            logType: logTypeMap[log.logType] || log.logType,
            reason: log.reason,
            readableReason: log.readableReason,
            operator: log.operator,
            operatedAt: (0, dayjs_1.default)(log.operatedAt).format('YYYY-MM-DD HH:mm:ss'),
            oldStatus: log.oldStatus || '',
            newStatus: log.newStatus || '',
        }));
        const exportDir = this.ensureExportDir();
        const fileName = `processing_logs_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.csv`;
        const filePath = path.join(exportDir, fileName);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: 'applicationNo', title: '申请编号' },
                { id: 'merchantName', title: '商户名称' },
                { id: 'logType', title: '日志类型' },
                { id: 'reason', title: '原因' },
                { id: 'readableReason', title: '详细说明' },
                { id: 'operator', title: '操作人' },
                { id: 'operatedAt', title: '操作时间' },
                { id: 'oldStatus', title: '原状态' },
                { id: 'newStatus', title: '新状态' },
            ],
            encoding: 'utf8',
        });
        await csvWriter.writeRecords(records);
        return {
            totalCount: logs.length,
            exportedCount: records.length,
            filePath,
            fileName,
        };
    }
    async exportDepositFlows(applicationId, startDate, endDate) {
        const where = {};
        if (applicationId) {
            where.applicationId = applicationId;
        }
        if (startDate && endDate) {
            where.operatedAt = { [sequelize_1.Op.between]: [startDate, endDate] };
        }
        const flows = await DepositFlow_1.default.findAll({
            where,
            order: [['operatedAt', 'DESC']],
            include: [{
                    model: Application_1.default,
                    as: 'application',
                    attributes: ['applicationNo', 'merchantName'],
                }],
        });
        const flowTypeMap = {
            collect: '收取',
            deduct: '扣减',
            refund: '退还',
        };
        const records = flows.map(flow => ({
            flowNo: flow.flowNo,
            applicationNo: flow.application?.applicationNo || '',
            merchantName: flow.application?.merchantName || '',
            flowType: flowTypeMap[flow.flowType] || flow.flowType,
            amount: flow.amount,
            reason: flow.reason,
            readableReason: flow.readableReason,
            operator: flow.operator,
            operatedAt: (0, dayjs_1.default)(flow.operatedAt).format('YYYY-MM-DD HH:mm:ss'),
            balanceBefore: flow.balanceBefore,
            balanceAfter: flow.balanceAfter,
        }));
        const exportDir = this.ensureExportDir();
        const fileName = `deposit_flows_${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}.csv`;
        const filePath = path.join(exportDir, fileName);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: 'flowNo', title: '流水编号' },
                { id: 'applicationNo', title: '申请编号' },
                { id: 'merchantName', title: '商户名称' },
                { id: 'flowType', title: '流水类型' },
                { id: 'amount', title: '金额' },
                { id: 'reason', title: '原因' },
                { id: 'readableReason', title: '详细说明' },
                { id: 'operator', title: '操作人' },
                { id: 'operatedAt', title: '操作时间' },
                { id: 'balanceBefore', title: '操作前余额' },
                { id: 'balanceAfter', title: '操作后余额' },
            ],
            encoding: 'utf8',
        });
        await csvWriter.writeRecords(records);
        return {
            totalCount: flows.length,
            exportedCount: records.length,
            filePath,
            fileName,
        };
    }
    getExportFilePath(fileName) {
        return path.join(this.ensureExportDir(), fileName);
    }
}
exports.default = new ExportService();
