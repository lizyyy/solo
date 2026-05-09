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
exports.VersionManagementService = void 0;
const common_1 = require("@nestjs/common");
const invoice_service_1 = require("./invoice.service");
const packing_list_service_1 = require("./packing-list.service");
const hs_code_version_service_1 = require("./hs-code-version.service");
const hs_code_version_entity_1 = require("../../entities/hs-code-version.entity");
let VersionManagementService = class VersionManagementService {
    invoiceService;
    packingListService;
    hsCodeService;
    constructor(invoiceService, packingListService, hsCodeService) {
        this.invoiceService = invoiceService;
        this.packingListService = packingListService;
        this.hsCodeService = hsCodeService;
    }
    async getVersionConsistency(batchId) {
        const [invoice, packingList, invoiceHsCodeVersion, packingListHsCodeVersion,] = await Promise.all([
            this.invoiceService.findLatestByBatch(batchId),
            this.packingListService.findLatestByBatch(batchId),
            this.hsCodeService.findLatestVersionByBatchAndSource(batchId, hs_code_version_entity_1.HsCodeSource.INVOICE),
            this.hsCodeService.findLatestVersionByBatchAndSource(batchId, hs_code_version_entity_1.HsCodeSource.PACKING_LIST),
        ]);
        const invoiceVersion = invoice?.version ?? 0;
        const packingListVersion = packingList?.version ?? 0;
        const details = [
            { source: '发票', latestVersion: invoiceVersion },
            { source: '箱单', latestVersion: packingListVersion },
            { source: 'HS编码(发票来源)', latestVersion: invoiceHsCodeVersion },
            { source: 'HS编码(箱单来源)', latestVersion: packingListHsCodeVersion },
        ];
        const allVersions = [invoiceVersion, packingListVersion, invoiceHsCodeVersion, packingListHsCodeVersion].filter(v => v > 0);
        const maxVersion = allVersions.length > 0 ? Math.max(...allVersions) : 0;
        const minVersion = allVersions.length > 0 ? Math.min(...allVersions) : 0;
        const isConsistent = allVersions.length > 0 && maxVersion === minVersion;
        return {
            isConsistent,
            hsCodeVersions: Math.max(invoiceHsCodeVersion, packingListHsCodeVersion),
            invoiceVersions: invoiceVersion,
            packingListVersions: packingListVersion,
            details,
        };
    }
    async checkVersions(batchId) {
        const [invoice, packingList] = await Promise.all([
            this.invoiceService.findLatestByBatch(batchId),
            this.packingListService.findLatestByBatch(batchId),
        ]);
        const hsCodeSources = [hs_code_version_entity_1.HsCodeSource.INVOICE, hs_code_version_entity_1.HsCodeSource.PACKING_LIST];
        const hsCodeVersions = await Promise.all(hsCodeSources.map(source => this.hsCodeService.findLatestVersionByBatchAndSource(batchId, source)));
        const latestHsCodeVersion = Math.max(...hsCodeVersions);
        return {
            hasInvoice: !!invoice,
            hasPackingList: !!packingList,
            hasHsCodes: latestHsCodeVersion > 0,
            latestInvoiceVersion: invoice?.version ?? 0,
            latestPackingListVersion: packingList?.version ?? 0,
            latestHsCodeVersion,
        };
    }
};
exports.VersionManagementService = VersionManagementService;
exports.VersionManagementService = VersionManagementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [invoice_service_1.InvoiceService,
        packing_list_service_1.PackingListService,
        hs_code_version_service_1.HsCodeVersionService])
], VersionManagementService);
//# sourceMappingURL=version-management.service.js.map