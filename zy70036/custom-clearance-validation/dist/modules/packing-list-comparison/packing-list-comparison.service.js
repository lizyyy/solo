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
exports.PackingListComparisonService = void 0;
const common_1 = require("@nestjs/common");
const invoice_service_1 = require("../version-management/invoice.service");
const packing_list_service_1 = require("../version-management/packing-list.service");
let PackingListComparisonService = class PackingListComparisonService {
    invoiceService;
    packingListService;
    constructor(invoiceService, packingListService) {
        this.invoiceService = invoiceService;
        this.packingListService = packingListService;
    }
    async compareBatch(batchId) {
        const [invoice, packingList] = await Promise.all([
            this.invoiceService.findLatestByBatch(batchId),
            this.packingListService.findLatestByBatch(batchId),
        ]);
        if (!invoice && !packingList) {
            throw new common_1.NotFoundException(`批次 ${batchId} 没有发票和箱单`);
        }
        const result = {
            batchId,
            isConsistent: true,
            hasInvoice: !!invoice,
            hasPackingList: !!packingList,
            quantityComparison: {
                totalQuantityInvoice: invoice?.totalQuantity ?? 0,
                totalQuantityPackingList: packingList?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0,
                quantityDifference: 0,
                quantityMismatches: [],
                invoiceOnlyHsCodes: [],
                packingListOnlyHsCodes: [],
            },
            valueComparison: {
                isConsistent: true,
                invoiceTotal: invoice?.totalAmount ?? 0,
                invoiceCurrency: invoice?.currency ?? '',
                invoiceItemCount: invoice?.itemCount ?? 0,
                packingListTotalPackages: packingList?.totalPackages ?? 0,
                totalGrossWeight: packingList?.totalGrossWeight ?? 0,
                totalNetWeight: packingList?.totalNetWeight ?? 0,
                weightUnit: packingList?.weightUnit ?? 'KG',
                totalVolume: packingList?.totalVolume ?? 0,
                volumeUnit: packingList?.volumeUnit ?? 'CBM',
            },
            hsCodeComparison: {
                commonHsCodes: [],
                invoiceOnlyHsCodes: [],
                packingListOnlyHsCodes: [],
            },
            summary: {
                totalMismatches: 0,
                criticalMismatches: 0,
                warnings: [],
            },
        };
        if (invoice && packingList) {
            const invoiceHsCodes = new Map();
            const packingListHsCodes = new Map();
            invoice.items?.forEach(item => {
                invoiceHsCodes.set(item.hsCode, {
                    quantity: item.quantity,
                    productName: item.productName,
                });
            });
            packingList.items?.forEach(item => {
                packingListHsCodes.set(item.hsCode, {
                    quantity: item.quantity,
                    productName: item.productName,
                });
            });
            const allHsCodes = new Set([
                ...invoiceHsCodes.keys(),
                ...packingListHsCodes.keys(),
            ]);
            const quantityMismatches = [];
            const commonHsCodes = [];
            const invoiceOnlyHsCodes = [];
            const packingListOnlyHsCodes = [];
            for (const hsCode of allHsCodes) {
                const invoiceItem = invoiceHsCodes.get(hsCode);
                const packingListItem = packingListHsCodes.get(hsCode);
                if (invoiceItem && packingListItem) {
                    commonHsCodes.push(hsCode);
                    const difference = Math.abs(invoiceItem.quantity - packingListItem.quantity);
                    if (difference > 0) {
                        const percentage = invoiceItem.quantity > 0
                            ? (difference / invoiceItem.quantity) * 100
                            : 100;
                        quantityMismatches.push({
                            hsCode,
                            productName: invoiceItem.productName,
                            invoiceQuantity: invoiceItem.quantity,
                            packingListQuantity: packingListItem.quantity,
                            difference,
                            percentage,
                        });
                    }
                }
                else if (invoiceItem) {
                    invoiceOnlyHsCodes.push(hsCode);
                }
                else if (packingListItem) {
                    packingListOnlyHsCodes.push(hsCode);
                }
            }
            result.quantityComparison.quantityMismatches = quantityMismatches;
            result.quantityComparison.invoiceOnlyHsCodes = invoiceOnlyHsCodes;
            result.quantityComparison.packingListOnlyHsCodes = packingListOnlyHsCodes;
            result.quantityComparison.quantityDifference =
                Math.abs(result.quantityComparison.totalQuantityInvoice - result.quantityComparison.totalQuantityPackingList);
            result.hsCodeComparison.commonHsCodes = commonHsCodes;
            result.hsCodeComparison.invoiceOnlyHsCodes = invoiceOnlyHsCodes;
            result.hsCodeComparison.packingListOnlyHsCodes = packingListOnlyHsCodes;
            result.summary.totalMismatches =
                quantityMismatches.length +
                    invoiceOnlyHsCodes.length +
                    packingListOnlyHsCodes.length;
            result.summary.criticalMismatches = quantityMismatches.filter(m => m.percentage > 5).length;
            const warnings = [];
            if (invoiceOnlyHsCodes.length > 0) {
                warnings.push(`发票独有HS编码 ${invoiceOnlyHsCodes.length} 个，箱单中缺失`);
            }
            if (packingListOnlyHsCodes.length > 0) {
                warnings.push(`箱单独有HS编码 ${packingListOnlyHsCodes.length} 个，发票中缺失`);
            }
            if (quantityMismatches.length > 0) {
                warnings.push(`发现 ${quantityMismatches.length} 个数量不一致的HS编码`);
            }
            if (result.quantityComparison.quantityDifference > 0) {
                warnings.push(`总数量差异: ${result.quantityComparison.quantityDifference}`);
            }
            result.summary.warnings = warnings;
            result.isConsistent = result.summary.totalMismatches === 0;
        }
        return result;
    }
};
exports.PackingListComparisonService = PackingListComparisonService;
exports.PackingListComparisonService = PackingListComparisonService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [invoice_service_1.InvoiceService,
        packing_list_service_1.PackingListService])
], PackingListComparisonService);
//# sourceMappingURL=packing-list-comparison.service.js.map