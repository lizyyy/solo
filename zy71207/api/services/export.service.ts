import * as XLSX from 'xlsx';
import { AuditService } from './audit.service';
import { AuditRecord, AuditStatus } from '../../shared/types';

export class ExportService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  exportAuditToExcel(auditId: string): Buffer {
    const audit = this.auditService.getAuditById(auditId);
    if (!audit) {
      throw new Error(`Audit record ${auditId} not found`);
    }

    const chain = this.auditService.getAuditChain(auditId);

    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['产品费率审计报告'],
      [],
      ['基本信息'],
      ['审计ID', audit.id],
      ['客户ID', audit.customerId],
      ['客户名称', audit.customerName],
      ['产品ID', audit.productId],
      ['产品名称', audit.productName],
      ['审计时间', audit.auditTime],
      ['审计状态', this.getStatusText(audit.status)],
      [],
      ['费用明细'],
      ['应扣金额（元）', audit.expectedAmount.toFixed(2)],
      ['实扣金额（元）', audit.actualAmount.toFixed(2)],
      ['差异金额（元）', audit.diffAmount.toFixed(2)],
      [],
      ['问题原因'],
      ...audit.reasons.map(r => [r]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 30 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws1, '审计摘要');

    const chainData = [
      ['审计链路追溯'],
      [],
      ['节点', '状态', '说明', '详情'],
      ...chain.map(node => [
        this.getNodeTypeText(node.type),
        this.getNodeStatusText(node.status),
        node.message,
        JSON.stringify(node.data, null, 2),
      ]),
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(chainData);
    ws2['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 60 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws2, '审计链路');

    const detailData = [
      ['费用计算明细'],
      [],
      ['项目', '费率', '金额（元）'],
      ['持有份额', '', audit.actualAmount / (audit.expectedAmount / audit.expectedAmount || 1)],
      ['管理费', '', ''],
      ['服务费', '', ''],
      ['优惠折扣', '', ''],
      ['合计费率', '', ''],
      ['应扣金额', '', audit.expectedAmount.toFixed(2)],
      ['实扣金额', '', audit.actualAmount.toFixed(2)],
      ['差异', '', audit.diffAmount.toFixed(2)],
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(detailData);
    ws3['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, '费用明细');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  exportAuditsToExcel(auditIds?: string[], filters?: {
    status?: AuditStatus;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): Buffer {
    let audits: AuditRecord[];

    if (auditIds && auditIds.length > 0) {
      audits = auditIds
        .map(id => this.auditService.getAuditById(id))
        .filter((a): a is AuditRecord => a !== null);
    } else {
      audits = this.auditService.getAllAudits(filters);
    }

    const wb = XLSX.utils.book_new();

    const data = [
      ['产品费率审计批量报告'],
      [],
      ['审计ID', '客户名称', '产品名称', '审计时间', '状态', '应扣金额(元)', '实扣金额(元)', '差异(元)', '主要原因'],
      ...audits.map(a => [
        a.id,
        a.customerName,
        a.productName,
        a.auditTime,
        this.getStatusText(a.status),
        a.expectedAmount.toFixed(2),
        a.actualAmount.toFixed(2),
        a.diffAmount.toFixed(2),
        a.reasons[0] || '',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, '审计列表');

    const stats = this.auditService.getStats();
    const statsData = [
      ['统计汇总'],
      [],
      ['总记录数', stats.total],
      ['待审计', stats.pending],
      ['审计通过', stats.normal],
      ['存在异常', stats.abnormal],
      ['已处理', stats.resolved],
      ['异常涉及总金额(元)', stats.totalDiffAmount.toFixed(2)],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(statsData);
    ws2['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, '统计汇总');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      pending: '待审计',
      normal: '审计通过',
      abnormal: '存在异常',
      resolved: '已处理',
    };
    return map[status] || status;
  }

  private getNodeTypeText(type: string): string {
    const map: Record<string, string> = {
      contract: '产品合同',
      share: '客户份额',
      rate: '费率版本',
      promotion: '优惠期',
      charge: '扣费流水',
      audit: '审计结论',
    };
    return map[type] || type;
  }

  private getNodeStatusText(status: string): string {
    const map: Record<string, string> = {
      ok: '正常',
      warning: '警告',
      error: '异常',
    };
    return map[status] || status;
  }
}
