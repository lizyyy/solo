import { Parser } from 'json2csv';
import { PreparationLedger, UserRole, PreparationStatus } from '../types';
import { SecurityService } from './security';

export class ExportService {
  private static ledgerFields = [
    { label: '请求ID', value: 'requestId' },
    { label: '车架号', value: 'vin' },
    { label: '车牌号', value: 'plateNumber' },
    { label: '品牌', value: 'brand' },
    { label: '型号', value: 'model' },
    { label: '当前状态', value: 'currentStatus' },
    { label: '检测总成本', value: 'totalInspectionCost' },
    { label: '维修总成本', value: 'totalRepairCost' },
    { label: '照片数量', value: 'photoCount' },
    { label: '责任人', value: 'responsiblePerson' },
    { label: '最后更新时间', value: (row: any) => new Date(row.lastUpdated).toISOString() }
  ];

  static exportLedgersToCSV(ledgers: PreparationLedger[], role: UserRole): string {
    const maskedLedgers = ledgers.map(l => SecurityService.maskLedger(l, role));
    const parser = new Parser({ fields: this.ledgerFields });
    return parser.parse(maskedLedgers);
  }

  static exportLedgersToJSON(ledgers: PreparationLedger[], role: UserRole): string {
    const maskedLedgers = ledgers.map(l => SecurityService.maskLedger(l, role));
    return JSON.stringify(maskedLedgers, null, 2);
  }

  static generateSummaryReport(ledgers: PreparationLedger[]): {
    totalRecords: number;
    byStatus: Record<PreparationStatus, number>;
    totalInspectionCost: number;
    totalRepairCost: number;
    avgInspectionCost: number;
    avgRepairCost: number;
    totalPhotos: number;
  } {
    const byStatus = {} as Record<PreparationStatus, number>;
    Object.values(PreparationStatus).forEach(s => { byStatus[s as PreparationStatus] = 0; });

    let totalInspectionCost = 0;
    let totalRepairCost = 0;
    let totalPhotos = 0;

    for (const ledger of ledgers) {
      byStatus[ledger.currentStatus] = (byStatus[ledger.currentStatus] || 0) + 1;
      totalInspectionCost += ledger.totalInspectionCost;
      totalRepairCost += ledger.totalRepairCost;
      totalPhotos += ledger.photoCount;
    }

    return {
      totalRecords: ledgers.length,
      byStatus,
      totalInspectionCost,
      totalRepairCost,
      avgInspectionCost: ledgers.length > 0 ? totalInspectionCost / ledgers.length : 0,
      avgRepairCost: ledgers.length > 0 ? totalRepairCost / ledgers.length : 0,
      totalPhotos
    };
  }

  static exportSummaryToCSV(summary: ReturnType<typeof ExportService.generateSummaryReport>): string {
    const rows = [
      { '指标': '台账总数', '数值': summary.totalRecords },
      { '指标': '草稿状态', '数值': summary.byStatus.draft },
      { '指标': '已提交', '数值': summary.byStatus.submitted },
      { '指标': '已驳回', '数值': summary.byStatus.rejected },
      { '指标': '二次确认', '数值': summary.byStatus.second_confirm },
      { '指标': '只读审计', '数值': summary.byStatus.audit_only },
      { '指标': '检测总成本', '数值': summary.totalInspectionCost },
      { '指标': '维修总成本', '数值': summary.totalRepairCost },
      { '指标': '平均检测成本', '数值': summary.avgInspectionCost.toFixed(2) },
      { '指标': '平均维修成本', '数值': summary.avgRepairCost.toFixed(2) },
      { '指标': '照片总数', '数值': summary.totalPhotos }
    ];

    const parser = new Parser({ fields: ['指标', '数值'] });
    return parser.parse(rows);
  }
}

export default ExportService;
