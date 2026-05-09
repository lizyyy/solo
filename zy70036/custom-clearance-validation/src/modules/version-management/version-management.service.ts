import { Injectable } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PackingListService } from './packing-list.service';
import { HsCodeVersionService } from './hs-code-version.service';
import { HsCodeSource } from '../../entities/hs-code-version.entity';

export interface VersionConsistencyInfo {
  isConsistent: boolean;
  hsCodeVersions: number;
  invoiceVersions: number;
  packingListVersions: number;
  details: {
    source: string;
    latestVersion: number;
  }[];
}

@Injectable()
export class VersionManagementService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly packingListService: PackingListService,
    private readonly hsCodeService: HsCodeVersionService,
  ) {}

  async getVersionConsistency(batchId: string): Promise<VersionConsistencyInfo> {
    const [
      invoice,
      packingList,
      invoiceHsCodeVersion,
      packingListHsCodeVersion,
    ] = await Promise.all([
      this.invoiceService.findLatestByBatch(batchId),
      this.packingListService.findLatestByBatch(batchId),
      this.hsCodeService.findLatestVersionByBatchAndSource(batchId, HsCodeSource.INVOICE),
      this.hsCodeService.findLatestVersionByBatchAndSource(batchId, HsCodeSource.PACKING_LIST),
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

  async checkVersions(batchId: string): Promise<{
    hasInvoice: boolean;
    hasPackingList: boolean;
    hasHsCodes: boolean;
    latestInvoiceVersion: number;
    latestPackingListVersion: number;
    latestHsCodeVersion: number;
  }> {
    const [invoice, packingList] = await Promise.all([
      this.invoiceService.findLatestByBatch(batchId),
      this.packingListService.findLatestByBatch(batchId),
    ]);

    const hsCodeSources = [HsCodeSource.INVOICE, HsCodeSource.PACKING_LIST];
    const hsCodeVersions = await Promise.all(
      hsCodeSources.map(source => this.hsCodeService.findLatestVersionByBatchAndSource(batchId, source)),
    );
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
}
