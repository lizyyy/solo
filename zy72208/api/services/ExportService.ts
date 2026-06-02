import * as XLSX from 'xlsx';
import singleSourceService from './SingleSourceService.js';
import fingerprintService from './FingerprintService.js';
import batchRepository from '../repositories/BatchRepository.js';
import type { SettlementDetail } from '../../shared/types.js';

export class ExportService {
  async exportToXLSX(batchId: string): Promise<{ buffer: Buffer; fingerprint: string }> {
    const details = await singleSourceService.getDetailsForExport(batchId);
    const batch = batchRepository.findById(batchId);
    const fingerprint = fingerprintService.generateDetailsFingerprint(details);

    const exportData = details.map(d => ({
      '原始行号': d.originalLineNo,
      '保单号': d.policyNo,
      '产品名称': d.productName,
      '佣金金额': d.commissionAmount,
      '币种(原始)': d.currencyRaw,
      '币种(归一化)': d.currency,
      '港币人民币同列': d.hasMixedCurrency ? '是' : '否',
      '税费率': d.taxRate,
      '税费率备注': d.taxRateRemark,
      '阶梯等级': d.tierLevel,
      '阶梯费率': d.tierRate,
      '净佣金': d.netAmount,
      '状态': this.mapStatusToChinese(d.status),
      '当前处理人': d.currentHandler,
      '数据指纹': d.dataFingerprint.slice(0, 16) + '...'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 25 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
      { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '结算明细');

    const summarySheet = XLSX.utils.json_to_sheet([
      { '项目': '批次号', '值': batch?.batchNo },
      { '项目': '导入日期', '值': batch?.importDate },
      { '项目': '导入操作人', '值': batch?.importOperator },
      { '项目': '风控操作人', '值': batch?.riskOperator },
      { '项目': '审计操作人', '值': batch?.auditOperator },
      { '项目': '总记录数', '值': batch?.totalRecords },
      { '项目': '异常记录数', '值': batch?.exceptionRecords },
      { '项目': '状态', '值': this.mapBatchStatusToChinese(batch?.status || '') },
      { '项目': '数据指纹', '值': fingerprint }
    ]);
    summarySheet['!cols'] = [{ wch: 15 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, '批次摘要');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: Buffer.from(buffer), fingerprint };
  }

  async exportToCSV(batchId: string): Promise<{ content: string; fingerprint: string }> {
    const details = await singleSourceService.getDetailsForExport(batchId);
    const fingerprint = fingerprintService.generateDetailsFingerprint(details);

    const headers = [
      '原始行号', '保单号', '产品名称', '佣金金额', '币种(原始)',
      '币种(归一化)', '港币人民币同列', '税费率', '税费率备注',
      '阶梯等级', '阶梯费率', '净佣金', '状态', '当前处理人'
    ];

    const rows = details.map(d => [
      d.originalLineNo,
      d.policyNo,
      d.productName,
      d.commissionAmount,
      d.currencyRaw,
      d.currency,
      d.hasMixedCurrency ? '是' : '否',
      d.taxRate || '',
      d.taxRateRemark || '',
      d.tierLevel,
      d.tierRate,
      d.netAmount,
      this.mapStatusToChinese(d.status),
      d.currentHandler || ''
    ].map(v => `"${v}"`).join(','));

    const content = [headers.join(','), ...rows].join('\n');
    return { content, fingerprint };
  }

  generateReplayCommand(batchId: string): { command: string; description: string; expectedOutput: string } {
    const timestamp = new Date().toISOString();
    const batch = batchRepository.findById(batchId);
    const batchNo = batch?.batchNo || batchId;

    const command = `# ============================================
# 保险佣金阶梯结算 - 可重跑命令
# 批次号: ${batchNo}
# 生成时间: ${timestamp}
# 说明: 执行以下命令可完整重现本次结算过程
# ============================================

# 1. 重置到导入前状态
npm run settlement:reset -- --batch=${batchNo}

# 2. 重新导入除权日截图数据
npm run settlement:import -- --batch=${batchNo} --source=./data/${batchNo}_raw.json

# 3. 执行自检1: 重复导入检测
npm run settlement:self-check -- --batch=${batchNo} --type=DUPLICATE_IMPORT

# 4. 执行自检2: 港币人民币同列检测
npm run settlement:self-check -- --batch=${batchNo} --type=MIXED_CURRENCY

# 5. 重放风控补录操作
npm run settlement:replay-actions -- --batch=${batchNo} --step=risk_control

# 6. 执行自检3: 补录后重算校验
npm run settlement:self-check -- --batch=${batchNo} --type=RECALC_AFTER_SUPPLEMENT

# 7. 重放审计更新操作
npm run settlement:replay-actions -- --batch=${batchNo} --step=audit

# 8. 执行自检4: 导出一致性校验
npm run settlement:self-check -- --batch=${batchNo} --type=EXPORT_CONSISTENCY

# 9. 生成最终结果并比对
npm run settlement:finalize -- --batch=${batchNo} --verify

# 10. 导出复盘报告
npm run settlement:export-report -- --batch=${batchNo} --format=xlsx
`;

    return {
      command,
      description: `该命令集可完整重现批次 ${batchNo} 的全部结算流程，包括数据导入、风控补录、审计更新、四步自检和最终导出。每一步都有独立的校验机制，确保结果可复现。`,
      expectedOutput: `预期输出:\n- 步骤1: 数据库重置完成\n- 步骤2: 导入成功，生成 ${batch?.totalRecords || 'N'} 条明细\n- 步骤3-4: 自检报告，显示通过/异常数量\n- 步骤5: 重放风控操作，更新税费率和币种状态\n- 步骤6: 重算校验通过\n- 步骤7: 重放审计操作，更新明细状态\n- 步骤8: 一致性校验通过，指纹匹配\n- 步骤9-10: 生成最终报告和导出文件`
    };
  }

  private mapStatusToChinese(status: string): string {
    const map: Record<string, string> = {
      'PENDING': '待处理',
      'EXCEPTION': '异常',
      'PENDING_REVIEW': '待复核',
      'REVIEWED': '已复核',
      'APPROVED': '已通过'
    };
    return map[status] || status;
  }

  private mapBatchStatusToChinese(status: string): string {
    const map: Record<string, string> = {
      'DRAFT': '草稿',
      'IMPORTED': '已导入',
      'RISK_REVIEWED': '风控已复核',
      'AUDITED': '审计已更新',
      'COMPLETED': '已完成'
    };
    return map[status] || status;
  }
}

export default new ExportService();
