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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingComponentService = void 0;
const common_1 = require("@nestjs/common");
const invoice_service_1 = require("../version-management/invoice.service");
const packing_list_service_1 = require("../version-management/packing-list.service");
const hs_code_version_service_1 = require("../version-management/hs-code-version.service");
const compliance_task_entity_1 = require("../../entities/compliance-task.entity");
let MissingComponentService = class MissingComponentService {
    invoiceService;
    packingListService;
    hsCodeService;
    constructor(invoiceService, packingListService, hsCodeService) {
        this.invoiceService = invoiceService;
        this.packingListService = packingListService;
        this.hsCodeService = hsCodeService;
    }
    getPriorityOrder(priority) {
        const order = {
            [compliance_task_entity_1.TaskPriority.LOW]: 1,
            [compliance_task_entity_1.TaskPriority.MEDIUM]: 2,
            [compliance_task_entity_1.TaskPriority.HIGH]: 3,
            [compliance_task_entity_1.TaskPriority.CRITICAL]: 4,
        };
        return order[priority] || 0;
    }
    maxPriority(a, b) {
        return this.getPriorityOrder(a) >= this.getPriorityOrder(b) ? a : b;
    }
    async detectMissingComponents(batchId) {
        const [invoice, packingList, hsCodes] = await Promise.all([
            this.invoiceService.findLatestByBatch(batchId),
            this.packingListService.findLatestByBatch(batchId),
            this.hsCodeService.findActiveByBatch(batchId),
        ]);
        const result = {
            batchId,
            isBlocked: false,
            hasCriticalMissing: false,
            totalMissingCount: 0,
            criticalMissingCount: 0,
            documentLevelMissing: {
                missingInvoice: !invoice,
                missingPackingList: !packingList,
                missingHsCodes: hsCodes.length === 0,
            },
            itemLevelMissing: [],
            blockingIssues: [],
            warnings: [],
        };
        const blockingIssues = [];
        const warnings = [];
        const itemLevelMissing = [];
        if (!invoice) {
            blockingIssues.push('缺少发票');
        }
        if (!packingList) {
            blockingIssues.push('缺少箱单');
        }
        if (hsCodes.length === 0) {
            warnings.push('缺少HS编码');
        }
        if (invoice) {
            invoice.items?.forEach((item, index) => {
                const issues = [];
                let priority = compliance_task_entity_1.TaskPriority.LOW;
                if (!item.hsCode || item.hsCode.trim() === '') {
                    issues.push('缺少HS编码');
                    priority = compliance_task_entity_1.TaskPriority.HIGH;
                }
                if (!item.productName || item.productName.trim() === '') {
                    issues.push('缺少商品名称');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.MEDIUM);
                }
                if (!item.quantity || item.quantity <= 0) {
                    issues.push('缺少或无效数量');
                    priority = compliance_task_entity_1.TaskPriority.CRITICAL;
                }
                if (!item.unit || item.unit.trim() === '') {
                    issues.push('缺少计量单位');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.MEDIUM);
                }
                if (!item.unitPrice || item.unitPrice <= 0) {
                    issues.push('缺少或无效单价');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.HIGH);
                }
                if (!item.totalAmount || item.totalAmount <= 0) {
                    issues.push('缺少或无效金额');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.HIGH);
                }
                if (issues.length > 0) {
                    itemLevelMissing.push({
                        componentType: compliance_task_entity_1.MissingComponentType.INVOICE,
                        lineNumber: item.lineNumber || index + 1,
                        hsCode: item.hsCode,
                        productName: item.productName,
                        issue: issues.join('; '),
                        priority,
                    });
                }
            });
        }
        if (packingList) {
            packingList.items?.forEach((item, index) => {
                const issues = [];
                let priority = compliance_task_entity_1.TaskPriority.LOW;
                if (!item.hsCode || item.hsCode.trim() === '') {
                    issues.push('缺少HS编码');
                    priority = compliance_task_entity_1.TaskPriority.HIGH;
                }
                if (!item.productName || item.productName.trim() === '') {
                    issues.push('缺少商品名称');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.MEDIUM);
                }
                if (!item.quantity || item.quantity <= 0) {
                    issues.push('缺少或无效数量');
                    priority = compliance_task_entity_1.TaskPriority.CRITICAL;
                }
                if (!item.grossWeight || item.grossWeight <= 0) {
                    issues.push('缺少毛重');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.MEDIUM);
                }
                if (!item.netWeight || item.netWeight <= 0) {
                    issues.push('缺少净重');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.MEDIUM);
                }
                if (item.netWeight && item.grossWeight && item.netWeight > item.grossWeight) {
                    issues.push('净重不能大于毛重');
                    priority = this.maxPriority(priority, compliance_task_entity_1.TaskPriority.HIGH);
                }
                if (issues.length > 0) {
                    itemLevelMissing.push({
                        componentType: compliance_task_entity_1.MissingComponentType.PACKING_LIST,
                        lineNumber: item.lineNumber || index + 1,
                        hsCode: item.hsCode,
                        productName: item.productName,
                        issue: issues.join('; '),
                        priority,
                    });
                }
            });
        }
        result.itemLevelMissing = itemLevelMissing;
        result.totalMissingCount = itemLevelMissing.length;
        result.criticalMissingCount = itemLevelMissing.filter(m => m.priority === compliance_task_entity_1.TaskPriority.CRITICAL || m.priority === compliance_task_entity_1.TaskPriority.HIGH).length;
        result.hasCriticalMissing = result.criticalMissingCount > 0;
        result.isBlocked = blockingIssues.length > 0 || result.hasCriticalMissing;
        result.blockingIssues = blockingIssues;
        result.warnings = warnings;
        return result;
    }
};
exports.MissingComponentService = MissingComponentService;
exports.MissingComponentService = MissingComponentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [invoice_service_1.InvoiceService,
        packing_list_service_1.PackingListService,
        hs_code_version_service_1.HsCodeVersionService])
], MissingComponentService);
//# sourceMappingURL=missing-component.service.js.map