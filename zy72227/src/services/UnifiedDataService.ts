import { dataStore } from '../store/DataStore';
import { PensionFundSwapRecord, UnifiedRecordView, BusinessRecordLine, CalculationTrace } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

export interface ExportLine {
  业务号: string;
  行ID: string;
  行类型: string;
  基金代码: string;
  基金名称: string;
  交易日期: string;
  币种: string;
  本金金额: number;
  手续费金额: number;
  合计金额: number;
  计算参数版本: string;
  计算取舍理由: string;
  计算时间: string;
  计算人: string;
  状态: string;
  邮件来源: string;
  清算批次号: string;
  是否拆分行: string;
  待处理角色: string;
}

export class UnifiedDataService {
  getPageView(recordId: string): UnifiedRecordView | undefined {
    return dataStore.getUnifiedView(recordId);
  }

  getApiResponse(recordId: string): UnifiedRecordView | undefined {
    return dataStore.getUnifiedView(recordId);
  }

  getExportLines(recordId: string): ExportLine[] | undefined {
    const view = dataStore.getUnifiedView(recordId);
    if (!view) return undefined;

    const { record } = view;
    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');
    const combinedLines = record.lines.filter(l => l.lineType === 'COMBINED');

    const exportLines: ExportLine[] = [];

    const maxPairs = Math.max(principalLines.length, feeLines.length, combinedLines.length);

    for (let i = 0; i < maxPairs; i++) {
      const principal = principalLines[i];
      const fee = feeLines[i];
      const combined = combinedLines[i];

      if (principal || fee) {
        const line = this.buildExportLine(
          record,
          view,
          principal,
          fee,
          i + 1
        );
        exportLines.push(line);
      }

      if (combined) {
        const line = this.buildExportLine(
          record,
          view,
          combined,
          undefined,
          i + 1
        );
        exportLines.push(line);
      }
    }

    return exportLines;
  }

  private buildExportLine(
    record: PensionFundSwapRecord,
    view: UnifiedRecordView,
    principalLine: BusinessRecordLine | undefined,
    feeLine: BusinessRecordLine | undefined,
    pairIndex: number
  ): ExportLine {
    const baseTrace: CalculationTrace = principalLine?.calculationTrace ||
      feeLine?.calculationTrace || {
        paramsVersion: 'N/A',
        decisionReason: 'N/A',
        calculatedAt: record.createdAt,
        calculatedBy: record.managerEmailImportedBy
      };

    const principalAmount = principalLine?.amount || 0;
    const feeAmount = feeLine?.amount || 0;
    const lineType = principalLine && feeLine ? '本金+手续费拆分' :
                     principalLine?.lineType === 'COMBINED' ? '合并' :
                     principalLine ? '仅本金' : '仅手续费';

    return {
      业务号: record.businessNo,
      行ID: `${principalLine?.id || 'N/A'}-${feeLine?.id || 'N/A'}`,
      行类型: lineType,
      基金代码: principalLine?.fundCode || feeLine?.fundCode || 'N/A',
      基金名称: principalLine?.fundName || feeLine?.fundName || 'N/A',
      交易日期: principalLine?.tradeDate || feeLine?.tradeDate || 'N/A',
      币种: principalLine?.currency || feeLine?.currency || 'CNY',
      本金金额: principalAmount,
      手续费金额: feeAmount,
      合计金额: principalAmount + feeAmount,
      计算参数版本: baseTrace.paramsVersion,
      计算取舍理由: baseTrace.decisionReason,
      计算时间: baseTrace.calculatedAt,
      计算人: baseTrace.calculatedBy,
      状态: record.status,
      邮件来源: record.managerEmailSource,
      清算批次号: record.settlementBatchNo || '未补录',
      是否拆分行: view.hasSplitLines ? '是' : '否',
      待处理角色: view.pendingActions.join(',') || '无'
    };
  }

  generateCsv(recordId: string): string | undefined {
    const exportLines = this.getExportLines(recordId);
    if (!exportLines) return undefined;

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: '业务号', title: '业务号' },
        { id: '行ID', title: '行ID' },
        { id: '行类型', title: '行类型' },
        { id: '基金代码', title: '基金代码' },
        { id: '基金名称', title: '基金名称' },
        { id: '交易日期', title: '交易日期' },
        { id: '币种', title: '币种' },
        { id: '本金金额', title: '本金金额' },
        { id: '手续费金额', title: '手续费金额' },
        { id: '合计金额', title: '合计金额' },
        { id: '计算参数版本', title: '计算参数版本' },
        { id: '计算取舍理由', title: '计算取舍理由' },
        { id: '计算时间', title: '计算时间' },
        { id: '计算人', title: '计算人' },
        { id: '状态', title: '状态' },
        { id: '邮件来源', title: '邮件来源' },
        { id: '清算批次号', title: '清算批次号' },
        { id: '是否拆分行', title: '是否拆分行' },
        { id: '待处理角色', title: '待处理角色' }
      ]
    });

    const header = csvStringifier.getHeaderString();
    const body = csvStringifier.stringifyRecords(exportLines as any);

    return header + '\n' + body;
  }

  verifyConsistency(recordId: string): {
    consistent: boolean;
    pageTotal: number;
    apiTotal: number;
    exportTotal: number;
    exportDetails: { principal: number; fee: number; total: number };
  } {
    const view = dataStore.getUnifiedView(recordId);
    if (!view) {
      return {
        consistent: false,
        pageTotal: 0,
        apiTotal: 0,
        exportTotal: 0,
        exportDetails: { principal: 0, fee: 0, total: 0 }
      };
    }

    const pageTotal = view.totalAmount;
    const apiTotal = view.totalAmount;

    const exportLines = this.getExportLines(recordId) || [];
    const exportPrincipal = exportLines.reduce((sum, l) => sum + l.本金金额, 0);
    const exportFee = exportLines.reduce((sum, l) => sum + l.手续费金额, 0);
    const exportTotal = exportPrincipal + exportFee;

    const consistent =
      Math.abs(pageTotal - apiTotal) < 0.01 &&
      Math.abs(pageTotal - exportTotal) < 0.01 &&
      Math.abs(view.totalPrincipal - exportPrincipal) < 0.01 &&
      Math.abs(view.totalFee - exportFee) < 0.01;

    return {
      consistent,
      pageTotal,
      apiTotal,
      exportTotal,
      exportDetails: {
        principal: exportPrincipal,
        fee: exportFee,
        total: exportTotal
      }
    };
  }

  getRawRecord(recordId: string): PensionFundSwapRecord | undefined {
    return dataStore.getRecord(recordId);
  }

  getAllRecords(): PensionFundSwapRecord[] {
    return dataStore.getAllRecords();
  }
}

export const unifiedDataService = new UnifiedDataService();
