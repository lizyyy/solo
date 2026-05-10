import * as fs from 'fs';
import * as path from 'path';
import {
  AfterSalesReport,
  ReportSummary,
  Abnormality,
  DeliveryOrder,
  DamageCompensation,
  AbnormalityType,
  ResponsibleParty
} from '../types';
import { DataStore } from './dataStore';
import { AbnormalityChecker } from './abnormalityChecker';

export class ReportGenerator {
  private dataStore: DataStore;
  private abnormalityChecker: AbnormalityChecker;

  constructor(dataStore: DataStore) {
    this.dataStore = dataStore;
    this.abnormalityChecker = new AbnormalityChecker();
  }

  generateReport(): AfterSalesReport {
    const allOrders = this.dataStore.getAllOrders();
    const allCompensations = this.dataStore.getAllCompensations();
    
    const allAbnormalities: Abnormality[] = [];
    const abnormalOrderIds = new Set<string>();

    for (const order of allOrders) {
      const elevator = this.dataStore.getElevator(order.orderId);
      const installations = this.dataStore.getInstallations(order.orderId);
      const missingParts = this.dataStore.getMissingParts(order.orderId);
      const reschedules = this.dataStore.getReschedules(order.orderId);
      const compensations = this.dataStore.getCompensations(order.orderId);

      const checkResult = this.abnormalityChecker.checkAllAbnormalities(
        order,
        elevator,
        installations,
        missingParts,
        reschedules,
        compensations
      );

      if (checkResult.hasAbnormality) {
        abnormalOrderIds.add(order.orderId);
        allAbnormalities.push(...checkResult.abnormalities);
      }
    }

    const summary = this.generateSummary(
      allOrders,
      allAbnormalities,
      allCompensations,
      abnormalOrderIds
    );

    return {
      reportId: this.generateReportId(),
      generatedAt: new Date().toISOString(),
      summary,
      abnormalities: allAbnormalities,
      orders: allOrders,
      compensations: allCompensations
    };
  }

  private generateSummary(
    orders: DeliveryOrder[],
    abnormalities: Abnormality[],
    compensations: DamageCompensation[],
    abnormalOrderIds: Set<string>
  ): ReportSummary {
    const abnormalityBreakdown: Record<AbnormalityType, number> = {
      missing_parts: 0,
      elevator_conflict: 0,
      reschedule_conflict: 0,
      damage: 0,
      installation_issue: 0,
      late_delivery: 0,
      duplicate_compensation: 0
    };

    const partyResponsibility: Record<ResponsibleParty, number> = {
      customer: 0,
      supplier: 0,
      delivery_team: 0,
      installation_team: 0,
      manufacturer: 0,
      company: 0
    };

    for (const ab of abnormalities) {
      abnormalityBreakdown[ab.type]++;
      partyResponsibility[ab.responsibleParty]++;
    }

    const totalCompensation = compensations
      .filter(c => c.status !== 'rejected')
      .reduce((sum, c) => sum + c.compensationAmount, 0);

    return {
      totalOrders: orders.length,
      abnormalOrders: abnormalOrderIds.size,
      normalOrders: orders.length - abnormalOrderIds.size,
      totalCompensation,
      abnormalityBreakdown,
      partyResponsibility
    };
  }

  private generateReportId(): string {
    const timestamp = Date.now().toString(36);
    return `REPORT-${timestamp.toUpperCase()}`;
  }

  exportReportToJson(report: AfterSalesReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  exportReportToText(report: AfterSalesReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const text = this.formatReportAsText(report);
    fs.writeFileSync(outputPath, text);
  }

  formatReportAsText(report: AfterSalesReport): string {
    const lines: string[] = [];
    const separator = '='.repeat(80);
    const subSeparator = '-'.repeat(80);

    lines.push(separator);
    lines.push('家具送装异常售后复盘报告');
    lines.push(separator);
    lines.push('');
    lines.push(`报告编号: ${report.reportId}`);
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push(subSeparator);
    lines.push('一、订单汇总');
    lines.push(subSeparator);
    lines.push(`总订单数: ${report.summary.totalOrders}`);
    lines.push(`异常订单数: ${report.summary.abnormalOrders}`);
    lines.push(`正常订单数: ${report.summary.normalOrders}`);
    lines.push(`异常率: ${report.summary.totalOrders > 0 ? ((report.summary.abnormalOrders / report.summary.totalOrders) * 100).toFixed(2) : 0}%`);
    lines.push(`赔付总金额: ¥${report.summary.totalCompensation.toFixed(2)}`);
    lines.push('');

    lines.push(subSeparator);
    lines.push('二、异常类型分布');
    lines.push(subSeparator);
    const typeMapping: Record<AbnormalityType, string> = {
      missing_parts: '缺件未补齐',
      elevator_conflict: '电梯限制冲突',
      reschedule_conflict: '改期冲突',
      damage: '损坏赔付',
      installation_issue: '安装问题',
      late_delivery: '延迟配送',
      duplicate_compensation: '重复赔付'
    };
    
    for (const [type, count] of Object.entries(report.summary.abnormalityBreakdown)) {
      if (count > 0) {
        lines.push(`  ${typeMapping[type as AbnormalityType]}: ${count} 例`);
      }
    }
    lines.push('');

    lines.push(subSeparator);
    lines.push('三、责任方统计');
    lines.push(subSeparator);
    const partyMapping: Record<ResponsibleParty, string> = {
      customer: '客户',
      supplier: '供应商',
      delivery_team: '配送团队',
      installation_team: '安装团队',
      manufacturer: '制造商',
      company: '公司'
    };
    
    for (const [party, count] of Object.entries(report.summary.partyResponsibility)) {
      if (count > 0) {
        lines.push(`  ${partyMapping[party as ResponsibleParty]}: ${count} 例`);
      }
    }
    lines.push('');

    lines.push(subSeparator);
    lines.push('四、详细异常记录');
    lines.push(subSeparator);
    lines.push('');

    if (report.abnormalities.length === 0) {
      lines.push('  暂无异常记录');
    } else {
      for (const [index, ab] of report.abnormalities.entries()) {
        lines.push(`${index + 1}. 订单号: ${ab.orderId}`);
        lines.push(`   异常类型: ${typeMapping[ab.type]}`);
        lines.push(`   严重程度: ${ab.severity === 'high' ? '高' : ab.severity === 'medium' ? '中' : '低'}`);
        lines.push(`   异常原因: ${ab.description}`);
        lines.push(`   责任方: ${partyMapping[ab.responsibleParty]}`);
        lines.push(`   处理状态: ${this.formatStatus(ab.status)}`);
        if (ab.resolution) {
          lines.push(`   解决方案: ${ab.resolution}`);
        }
        lines.push('');
      }
    }

    lines.push(subSeparator);
    lines.push('五、赔付记录');
    lines.push(subSeparator);
    lines.push('');

    if (report.compensations.length === 0) {
      lines.push('  暂无赔付记录');
    } else {
      const damageTypeMapping: Record<string, string> = {
        product_damage: '产品损坏',
        installation_damage: '安装损坏',
        delivery_damage: '配送损坏',
        assembly_issue: '组装问题'
      };

      for (const comp of report.compensations) {
        lines.push(`订单号: ${comp.orderId}`);
        lines.push(`  商品ID: ${comp.itemId}`);
        lines.push(`  损坏类型: ${damageTypeMapping[comp.damageType]}`);
        lines.push(`  赔付金额: ¥${comp.compensationAmount.toFixed(2)}`);
        lines.push(`  责任方: ${partyMapping[comp.responsibleParty]}`);
        lines.push(`  描述: ${comp.description}`);
        lines.push(`  状态: ${this.formatCompensationStatus(comp.status)}`);
        lines.push('');
      }
    }

    lines.push(separator);
    lines.push('报告结束');
    lines.push(separator);

    return lines.join('\n');
  }

  private formatStatus(status: string): string {
    const mapping: Record<string, string> = {
      'open': '待处理',
      'in_progress': '处理中',
      'resolved': '已解决'
    };
    return mapping[status] || status;
  }

  private formatCompensationStatus(status: string): string {
    const mapping: Record<string, string> = {
      'pending': '待审批',
      'approved': '已批准',
      'paid': '已支付',
      'rejected': '已拒绝'
    };
    return mapping[status] || status;
  }

  printReport(report: AfterSalesReport): void {
    console.log(this.formatReportAsText(report));
  }
}
