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
const sequelize_1 = require("sequelize");
const Application_1 = __importStar(require("../models/Application"));
const ProcessingLog_1 = __importStar(require("../models/ProcessingLog"));
const CertificateService_1 = __importDefault(require("./CertificateService"));
const ScheduleService_1 = __importDefault(require("./ScheduleService"));
class ApplicationService {
    async getApplicationById(id) {
        return await Application_1.default.findByPk(id, {
            include: [
                { association: 'certificates' },
                { association: 'schedules' },
                { association: 'logs', order: [['operatedAt', 'DESC']] },
                { association: 'depositFlows', order: [['operatedAt', 'DESC']] },
            ],
        });
    }
    async listApplications(page = 1, pageSize = 20, filters) {
        const where = {};
        if (filters) {
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
        }
        const { count, rows } = await Application_1.default.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
            include: [{ association: 'batch', attributes: ['batchNo', 'name'] }],
        });
        return { total: count, list: rows, page, pageSize };
    }
    async addLog(applicationId, logType, reason, readableReason, operator, oldStatus, newStatus, metadata) {
        return await ProcessingLog_1.default.create({
            applicationId,
            logType,
            reason,
            readableReason,
            operator,
            operatedAt: new Date(),
            oldStatus,
            newStatus,
            metadata: metadata ? JSON.stringify(metadata) : null,
        });
    }
    async processApplication(applicationId, newStatus, operator, reason, options) {
        const application = await this.getApplicationById(applicationId);
        if (!application) {
            throw new Error('申请记录不存在');
        }
        const oldStatus = application.status;
        const issues = [];
        if (options?.autoCheckCertificate) {
            const certCheck = await CertificateService_1.default.checkCertificates(applicationId, operator);
            if (!certCheck.isValid) {
                issues.push(...certCheck.issues.map(i => i.readableIssue));
                for (const issue of certCheck.issues) {
                    await this.addLog(applicationId, ProcessingLog_1.LogType.CERTIFICATE_ISSUE, issue.issue, issue.readableIssue, operator, oldStatus, newStatus);
                }
            }
        }
        if (options?.autoCheckSchedule && options.venueName) {
            const scheduleCheck = await ScheduleService_1.default.checkConflict(options.venueName, application.stallLocation, application.startDate, application.endDate, applicationId);
            if (scheduleCheck.hasConflict) {
                issues.push(...scheduleCheck.conflicts.map(c => c.readableConflict));
                for (const conflict of scheduleCheck.conflicts) {
                    await this.addLog(applicationId, ProcessingLog_1.LogType.SCHEDULE_CONFLICT, conflict.conflictType, conflict.readableConflict, operator, oldStatus, newStatus);
                }
            }
        }
        if (issues.length > 0 && newStatus === Application_1.ApplicationStatus.APPROVED) {
            throw new Error(`存在问题无法通过审核：${issues.join('; ')}`);
        }
        const readableReason = this.getStatusChangeReadableReason(oldStatus, newStatus, reason, operator);
        await application.update({
            status: newStatus,
            processedAt: new Date(),
            processedBy: operator,
        });
        await this.addLog(applicationId, ProcessingLog_1.LogType.STATUS_CHANGE, reason, readableReason, operator, oldStatus, newStatus);
        if (newStatus === Application_1.ApplicationStatus.APPROVED && options?.venueName) {
            try {
                await ScheduleService_1.default.occupySchedule(applicationId, options.venueName, application.stallLocation, application.startDate, application.endDate);
            }
            catch (err) {
                await application.update({ status: oldStatus });
                throw err;
            }
        }
        if (oldStatus === Application_1.ApplicationStatus.APPROVED &&
            (newStatus === Application_1.ApplicationStatus.REJECTED || newStatus === Application_1.ApplicationStatus.RETURNED)) {
            await ScheduleService_1.default.releaseSchedule(applicationId);
        }
        return {
            application: await this.getApplicationById(applicationId),
            issues,
        };
    }
    getStatusChangeReadableReason(oldStatus, newStatus, reason, operator) {
        const statusMap = {
            [Application_1.ApplicationStatus.PENDING]: '待处理',
            [Application_1.ApplicationStatus.PROCESSING]: '处理中',
            [Application_1.ApplicationStatus.APPROVED]: '已通过',
            [Application_1.ApplicationStatus.REJECTED]: '已拒绝',
            [Application_1.ApplicationStatus.RETURNED]: '已退回',
        };
        const oldStatusName = statusMap[oldStatus] || oldStatus;
        const newStatusName = statusMap[newStatus] || newStatus;
        return `操作员【${operator}】将状态从【${oldStatusName}】变更为【${newStatusName}】，原因：${reason || '未说明'}`;
    }
    async returnForModify(applicationId, operator, reason) {
        return this.processApplication(applicationId, Application_1.ApplicationStatus.RETURNED, operator, reason);
    }
    async approveApplication(applicationId, operator, reason, venueName) {
        return this.processApplication(applicationId, Application_1.ApplicationStatus.APPROVED, operator, reason, {
            autoCheckCertificate: true,
            autoCheckSchedule: !!venueName,
            venueName,
        });
    }
    async rejectApplication(applicationId, operator, reason) {
        return this.processApplication(applicationId, Application_1.ApplicationStatus.REJECTED, operator, reason);
    }
    async getLogsByApplication(applicationId) {
        return await ProcessingLog_1.default.findAll({
            where: { applicationId },
            order: [['operatedAt', 'DESC']],
        });
    }
}
exports.default = new ApplicationService();
