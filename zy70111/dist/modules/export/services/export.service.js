"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ExcelJS = require("exceljs");
const date_fns_1 = require("date-fns");
const export_task_entity_1 = require("../entities/export-task.entity");
const certificate_entity_1 = require("../../certificate/entities/certificate.entity");
const certificate_duplicate_entity_1 = require("../../certificate/entities/certificate-duplicate.entity");
const flow_history_entity_1 = require("../../history/entities/flow-history.entity");
const review_task_entity_1 = require("../../review/entities/review-task.entity");
const types_1 = require("../../../common/types");
const audit_log_service_1 = require("../../history/services/audit-log.service");
let ExportService = ExportService_1 = class ExportService {
    constructor(exportRepository, certificateRepository, duplicateRepository, flowHistoryRepository, reviewRepository, dataSource, auditLogService) {
        this.exportRepository = exportRepository;
        this.certificateRepository = certificateRepository;
        this.duplicateRepository = duplicateRepository;
        this.flowHistoryRepository = flowHistoryRepository;
        this.reviewRepository = reviewRepository;
        this.dataSource = dataSource;
        this.auditLogService = auditLogService;
        this.logger = new common_1.Logger(ExportService_1.name);
    }
    async createTask(dto, user) {
        const task = this.exportRepository.create({
            taskNumber: `EXP-${Date.now()}`,
            exportType: dto.exportType,
            exportName: dto.exportName,
            status: types_1.ExportStatus.PENDING,
            filters: {
                startDate: dto.startDate,
                endDate: dto.endDate,
                ...dto.filters,
            },
            contentDescription: this.getExportDescription(dto.exportType),
            createdBy: user.userId,
            createdByName: user.userName,
        });
        const savedTask = await this.exportRepository.save(task);
        this.processExportTask(savedTask.id, user).catch((error) => {
            this.logger.error('导出任务处理失败', error);
        });
        await this.auditLogService.log({
            entityType: types_1.EntityType.CERTIFICATE,
            entityId: savedTask.id,
            entityNumber: savedTask.taskNumber,
            action: 'EXPORT',
            description: `请求导出: ${dto.exportName} (${dto.exportType})`,
            user,
            requestData: dto,
        });
        return {
            success: true,
            data: savedTask,
            needsReview: false,
            message: '导出任务已创建，正在处理中',
        };
    }
    getExportDescription(type) {
        const descriptions = {
            [types_1.ExportType.DAILY_REPORT]: '日常运营报告，包含检疫证流转概览、批次统计、市场验收情况',
            [types_1.ExportType.DUPLICATE_ANALYSIS]: '证号重复分析报告，包含所有重复证号详情、冲突对比、处理状态',
            [types_1.ExportType.FLOW_HISTORY]: '完整流转历史，包含每张证的状态变更时间线、操作人、操作详情',
            [types_1.ExportType.REVIEW_SUMMARY]: '人工复核汇总，包含待处理、已处理、按原因分类的统计',
            [types_1.ExportType.COMPLIANCE_CHECK]: '合规检查报告，包含超期证、异常流转、人工修正等需关注事项',
        };
        return descriptions[type];
    }
    async processExportTask(taskId, user) {
        const task = await this.exportRepository.findOne({ where: { id: taskId } });
        if (!task)
            return;
        task.status = types_1.ExportStatus.PROCESSING;
        await this.exportRepository.save(task);
        try {
            let data;
            let fileName;
            switch (task.exportType) {
                case types_1.ExportType.DUPLICATE_ANALYSIS:
                    data = await this.generateDuplicateAnalysis(task.filters);
                    fileName = `证号重复分析_${(0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
                    break;
                case types_1.ExportType.FLOW_HISTORY:
                    data = await this.generateFlowHistory(task.filters);
                    fileName = `流转历史_${(0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
                    break;
                case types_1.ExportType.REVIEW_SUMMARY:
                    data = await this.generateReviewSummary(task.filters);
                    fileName = `复核汇总_${(0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
                    break;
                case types_1.ExportType.COMPLIANCE_CHECK:
                    data = await this.generateComplianceCheck(task.filters);
                    fileName = `合规检查_${(0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
                    break;
                default:
                    data = await this.generateDailyReport(task.filters);
                    fileName = `日常报告_${(0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss')}.xlsx`;
            }
            const workbook = await this.createExcelFile(data, task.exportType);
            const filePath = `/tmp/exports/${fileName}`;
            await workbook.xlsx.writeFile(filePath);
            task.status = types_1.ExportStatus.COMPLETED;
            task.fileName = fileName;
            task.filePath = filePath;
            task.recordCount = data.length;
            task.completedAt = new Date();
            await this.exportRepository.save(task);
        }
        catch (error) {
            this.logger.error('导出任务失败', error);
            task.status = types_1.ExportStatus.FAILED;
            task.errorMessage = error.message;
            await this.exportRepository.save(task);
        }
    }
    async generateDuplicateAnalysis(filters) {
        const duplicates = await this.duplicateRepository.find({
            relations: ['certificate'],
            order: { createdAt: 'DESC' },
        });
        return duplicates.map((dup, index) => ({
            序号: index + 1,
            证号: dup.certificateNumber,
            本记录ID: dup.certificateId,
            冲突记录ID: dup.conflictingCertificateId,
            处理状态: this.translateStatus(dup.status),
            优先级: this.translatePriority(dup.priority),
            冲突原因: dup.conflictReason,
            本证来源: dup.certificate?.source,
            本证养殖场: dup.certificate?.farmName,
            本证屠宰场: dup.certificate?.slaughterhouseName,
            本证动物种类: dup.certificate?.animalType,
            本证数量: dup.certificate?.animalQuantity,
            本证状态: this.translateCertStatus(dup.certificate?.status),
            是否人工修正: dup.certificate?.hasManualCorrection ? '是' : '否',
            开证人: dup.certificate?.issuerName,
            录入时间: dup.certificate?.createdAt ? (0, date_fns_1.format)(dup.certificate.createdAt, 'yyyy-MM-dd HH:mm:ss') : '',
            检测时间: (0, date_fns_1.format)(dup.createdAt, 'yyyy-MM-dd HH:mm:ss'),
            处理人: dup.resolvedByName || '',
            处理时间: dup.resolvedAt ? (0, date_fns_1.format)(dup.resolvedAt, 'yyyy-MM-dd HH:mm:ss') : '',
            处理方案: dup.resolution || '',
            冲突详情: JSON.stringify(dup.conflictDetails),
        }));
    }
    async generateFlowHistory(filters) {
        const histories = await this.flowHistoryRepository.find({
            order: { certificateNumber: 'ASC', createdAt: 'ASC' },
        });
        return histories.map((hist, index) => ({
            序号: index + 1,
            证号: hist.certificateNumber,
            操作类型: this.translateAction(hist.action),
            操作描述: hist.description,
            操作前状态: this.translateCertStatus(hist.previousStatus),
            操作后状态: this.translateCertStatus(hist.newStatus),
            操作人: hist.operatorName,
            操作人ID: hist.operatorId,
            来源系统: hist.sourceSystem,
            是否人工修正: hist.isManualCorrection ? '是' : '否',
            人工修正说明: hist.correctionReason || '',
            关联业务ID: hist.relatedEntityId || '',
            关联业务类型: hist.relatedEntityType || '',
            变更详情: hist.changes || '',
            原始快照: hist.snapshot || '',
            操作时间: (0, date_fns_1.format)(hist.createdAt, 'yyyy-MM-dd HH:mm:ss'),
        }));
    }
    async generateReviewSummary(filters) {
        const tasks = await this.reviewRepository.find({
            order: { priority: 'DESC', createdAt: 'DESC' },
        });
        return tasks.map((task, index) => ({
            序号: index + 1,
            任务编号: task.taskNumber,
            关联证号: task.certificateNumber || '',
            关联批次: task.batchNumber || '',
            关联运输号: task.transportNumber || '',
            状态: this.translateStatus(task.status),
            优先级: this.translatePriority(task.priority),
            原因代码: task.reasonCode,
            原因描述: task.reasonDescription,
            上下文数据: JSON.stringify(task.contextData),
            复核结论: task.conclusion || '',
            处理措施: JSON.stringify(task.resolutionActions),
            处理人: task.assigneeName || '',
            分配时间: task.assignedAt ? (0, date_fns_1.format)(task.assignedAt, 'yyyy-MM-dd HH:mm:ss') : '',
            处理时间: task.resolvedAt ? (0, date_fns_1.format)(task.resolvedAt, 'yyyy-MM-dd HH:mm:ss') : '',
            备注: task.remarks || '',
            创建人: task.createdByName,
            创建时间: (0, date_fns_1.format)(task.createdAt, 'yyyy-MM-dd HH:mm:ss'),
        }));
    }
    async generateComplianceCheck(filters) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const certificates = await this.certificateRepository.find({
            where: [
                { hasDuplicate: true },
                { hasManualCorrection: true },
                { status: types_1.CertificateStatus.DUPLICATE_DETECTED },
            ],
            order: { createdAt: 'DESC' },
        });
        const results = [];
        let index = 1;
        for (const cert of certificates) {
            const issues = [];
            if (cert.hasDuplicate)
                issues.push('证号重复');
            if (cert.hasManualCorrection)
                issues.push('已人工修正');
            if (cert.status === types_1.CertificateStatus.DUPLICATE_DETECTED)
                issues.push('待处理的重复证号');
            if (cert.inspectionDate && new Date(cert.inspectionDate) < sevenDaysAgo) {
                const certDate = new Date(cert.inspectionDate);
                const diffDays = Math.floor((now.getTime() - certDate.getTime()) / (1000 * 60 * 60 * 24));
                issues.push(`检疫证已超期${diffDays}天`);
            }
            results.push({
                序号: index++,
                证号: cert.certificateNumber,
                状态: this.translateCertStatus(cert.status),
                来源: cert.source,
                养殖场: cert.farmName,
                屠宰场: cert.slaughterhouseName,
                动物种类: cert.animalType,
                数量: cert.animalQuantity,
                检疫日期: cert.inspectionDate ? (0, date_fns_1.format)(new Date(cert.inspectionDate), 'yyyy-MM-dd') : '',
                存在问题: issues.join('; '),
                问题数量: issues.length,
                是否有重复: cert.hasDuplicate ? '是' : '否',
                是否人工修正: cert.hasManualCorrection ? '是' : '否',
                开证人: cert.issuerName,
                录入时间: (0, date_fns_1.format)(cert.createdAt, 'yyyy-MM-dd HH:mm:ss'),
                最后操作人: cert.lastOperatorName || '',
                最后操作时间: cert.updatedAt ? (0, date_fns_1.format)(cert.updatedAt, 'yyyy-MM-dd HH:mm:ss') : '',
                批次号: cert.batchNumber || '',
                原始证ID: cert.originalCertificateId || '',
                重开证ID: cert.reissuedCertificateId || '',
            });
        }
        return results;
    }
    async generateDailyReport(filters) {
        const certificates = await this.certificateRepository.find({
            order: { createdAt: 'DESC' },
        });
        return certificates.map((cert, index) => ({
            序号: index + 1,
            证号: cert.certificateNumber,
            状态: this.translateCertStatus(cert.status),
            来源: this.translateSource(cert.source),
            养殖场: cert.farmName,
            屠宰场: cert.slaughterhouseName,
            动物种类: cert.animalType,
            数量: cert.animalQuantity,
            重量: cert.totalWeight || '',
            出栏日期: cert.slaughterDate ? (0, date_fns_1.format)(new Date(cert.slaughterDate), 'yyyy-MM-dd') : '',
            检疫日期: cert.inspectionDate ? (0, date_fns_1.format)(new Date(cert.inspectionDate), 'yyyy-MM-dd') : '',
            检疫人员: cert.inspectorName,
            开证人: cert.issuerName,
            批次号: cert.batchNumber || '',
            是否重复: cert.hasDuplicate ? '是' : '否',
            是否人工修正: cert.hasManualCorrection ? '是' : '否',
            录入时间: (0, date_fns_1.format)(cert.createdAt, 'yyyy-MM-dd HH:mm:ss'),
            最后操作人: cert.lastOperatorName || '',
            最后操作时间: cert.updatedAt ? (0, date_fns_1.format)(cert.updatedAt, 'yyyy-MM-dd HH:mm:ss') : '',
            备注: cert.remarks || '',
        }));
    }
    translateStatus(status) {
        const map = {
            pending: '待处理',
            approved: '已通过',
            rejected: '已拒绝',
            resolved: '已处理',
        };
        return map[status] || status;
    }
    translatePriority(priority) {
        const map = {
            high: '高',
            medium: '中',
            low: '低',
        };
        return map[priority] || priority;
    }
    translateCertStatus(status) {
        if (!status)
            return '';
        const map = {
            issued: '已开具',
            batch_bound: '已绑定批次',
            in_transport: '运输中',
            transport_verified: '运输已核销',
            market_accepted: '市场已验收',
            voided: '已作废',
            manually_corrected: '已人工修正',
            duplicate_detected: '检测到重复',
        };
        return map[status] || status;
    }
    translateAction(action) {
        const map = {
            certificate_issued: '开具检疫证',
            batch_bound: '绑定批次',
            batch_unbound: '解绑批次',
            transport_started: '开始运输',
            transport_verified: '运输核销',
            transport_rejected: '运输驳回',
            market_accepted: '市场验收通过',
            market_rejected: '市场验收驳回',
            certificate_voided: '作废检疫证',
            certificate_reissued: '重开检疫证',
            duplicate_detected: '检测到重复',
            manual_correction: '人工修正',
            review_created: '创建复核',
            review_resolved: '复核完成',
            export_requested: '请求导出',
            export_completed: '导出完成',
        };
        return map[action] || action;
    }
    translateSource(source) {
        const map = {
            farm: '养殖场',
            slaughterhouse: '屠宰场',
            transport: '运输端',
            market: '市场端',
        };
        return map[source] || source;
    }
    async createExcelFile(data, exportType) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = '屠宰检疫证流转系统';
        workbook.created = new Date();
        let worksheet;
        switch (exportType) {
            case types_1.ExportType.DUPLICATE_ANALYSIS:
                worksheet = workbook.addWorksheet('证号重复分析');
                break;
            case types_1.ExportType.FLOW_HISTORY:
                worksheet = workbook.addWorksheet('流转历史');
                break;
            case types_1.ExportType.REVIEW_SUMMARY:
                worksheet = workbook.addWorksheet('复核汇总');
                break;
            case types_1.ExportType.COMPLIANCE_CHECK:
                worksheet = workbook.addWorksheet('合规检查');
                break;
            default:
                worksheet = workbook.addWorksheet('日常报告');
        }
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            worksheet.columns = headers.map((header) => ({
                header,
                key: header,
                width: Math.max(15, header.length * 2),
            }));
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' },
            };
            data.forEach((row) => {
                worksheet.addRow(row);
            });
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: headers.length },
            };
        }
        const summarySheet = workbook.addWorksheet('导出说明');
        summarySheet.getRow(1).values = ['屠宰检疫证流转系统 - 导出报告说明'];
        summarySheet.getRow(1).font = { bold: true, size: 14 };
        summarySheet.getRow(3).values = ['导出时间:', (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss')];
        summarySheet.getRow(4).values = ['导出类型:', this.getExportDescription(exportType)];
        summarySheet.getRow(5).values = ['数据条数:', data.length];
        summarySheet.getRow(7).values = ['使用说明:'];
        summarySheet.getRow(8).values = ['1. 本报告数据来自系统实时数据，如需历史数据请使用流转历史导出'];
        summarySheet.getRow(9).values = ['2. 证号重复问题请结合纸质证和人工复核记录综合判断'];
        summarySheet.getRow(10).values = ['3. 有标记"已人工修正"的记录请查看详细历史了解变更原因'];
        summarySheet.getRow(11).values = ['4. 如需追溯完整历史，可通过证号查询详细流转时间线'];
        return workbook;
    }
    async findById(id) {
        const task = await this.exportRepository.findOne({ where: { id } });
        if (!task) {
            throw new Error('导出任务不存在');
        }
        return task;
    }
    async query(query) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const qb = this.exportRepository.createQueryBuilder('task');
        if (query.exportType?.length) {
            qb.andWhere('task.exportType IN (:...types)', { types: query.exportType });
        }
        if (query.status?.length) {
            qb.andWhere('task.status IN (:...status)', { status: query.status });
        }
        const [items, total] = await qb
            .orderBy('task.createdAt', 'DESC')
            .skip(skip)
            .take(pageSize)
            .getManyAndCount();
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = ExportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(export_task_entity_1.ExportTask)),
    __param(1, (0, typeorm_1.InjectRepository)(certificate_entity_1.Certificate)),
    __param(2, (0, typeorm_1.InjectRepository)(certificate_duplicate_entity_1.CertificateDuplicate)),
    __param(3, (0, typeorm_1.InjectRepository)(flow_history_entity_1.FlowHistory)),
    __param(4, (0, typeorm_1.InjectRepository)(review_task_entity_1.ReviewTask)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        audit_log_service_1.AuditLogService])
], ExportService);
//# sourceMappingURL=export.service.js.map