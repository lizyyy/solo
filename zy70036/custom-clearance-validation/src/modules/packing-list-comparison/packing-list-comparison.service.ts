import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceService } from '../version-management/invoice.service';
import { PackingListService } from '../version-management/packing-list.service';

export interface QuantityMismatch {
  hsCode: string;
  productName: string;
  invoiceQuantity: number;
  packingListQuantity: number;
  difference: number;
  percentage: number;
}

export interface ValueComparison {
  isConsistent: boolean;
  invoiceTotal: number;
  invoiceCurrency: string;
  invoiceItemCount: number;
  packingListTotalPackages: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  weightUnit: string;
  totalVolume: number;
  volumeUnit: string;
}

export interface PackingListComparisonResult {
  batchId: string;
  isConsistent: boolean;
  hasInvoice: boolean;
  hasPackingList: boolean;
  quantityComparison: {
    totalQuantityInvoice: number;
    totalQuantityPackingList: number;
    quantityDifference: number;
    quantityMismatches: QuantityMismatch[];
    invoiceOnlyHsCodes: string[];
    packingListOnlyHsCodes: string[];
  };
  valueComparison: ValueComparison;
  hsCodeComparison: {
    commonHsCodes: string[];
    invoiceOnlyHsCodes: string[];
    packingListOnlyHsCodes: string[];
  };
  summary: {
    totalMismatches: number;
    criticalMismatches: number;
    warnings: string[];
  };
}

@Injectable()
export class PackingListComparisonService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly packingListService: PackingListService,
  ) {}

  async compareBatch(batchId: string): Promise<PackingListComparisonResult> {
    const [invoice, packingList] = await Promise.all([
      this.invoiceService.findLatestByBatch(batchId),
      this.packingListService.findLatestByBatch(batchId),
    ]);

    if (!invoice && !packingList) {
      throw new NotFoundException(`批次 ${batchId} 没有发票和箱单`);
    }

    const result: PackingListComparisonResult = {
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
      const invoiceHsCodes = new Map<string, { quantity: number; productName: string }>();
      const packingListHsCodes = new Map<string, { quantity: number; productName: string }>();

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

      const quantityMismatches: QuantityMismatch[] = [];
      const commonHsCodes: string[] = [];
      const invoiceOnlyHsCodes: string[] = [];
      const packingListOnlyHsCodes: string[] = [];

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
        } else if (invoiceItem) {
          invoiceOnlyHsCodes.push(hsCode);
        } else if (packingListItem) {
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

      result.summary.criticalMismatches = quantityMismatches.filter(
        m => m.percentage > 5,
      ).length;

      const warnings: string[] = [];

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
}
