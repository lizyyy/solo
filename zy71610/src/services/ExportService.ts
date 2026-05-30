import { createObjectCsvStringifier } from 'csv-writer';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  SettlementApplication,
  SettlementStatement,
  ExportOptions,
} from '../types/models';

export class ExportService {
  private flattenApplication(
    app: SettlementApplication,
    options: ExportOptions,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      申请编号: app.applicationNo,
      合同编号: app.contractNo,
      申请人: app.applicant,
      申请日期: dayjs(app.applicationDate).format('YYYY-MM-DD HH:mm:ss'),
      状态: app.status,
      '剩余本金(最终)': app.remainingPrincipal.final,
      '剩余服务费(最终)': app.remainingServiceFee.final,
      '可退服务费(最终)': app.refundableServiceFee.final,
      '提前结清违约金(最终)': app.earlySettlementPenalty.final,
      '应还总额(最终)': app.totalPayableAmount.final,
      结清原因: app.settlementReason,
      备注: app.remark || '',
      异常数量: app.anomalies.filter((a) => !a.resolved).length,
      创建人: app.createdBy,
      创建时间: dayjs(app.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    };

    if (options.includeOriginal) {
      result['剩余本金(原始)'] = app.remainingPrincipal.original;
      result['剩余服务费(原始)'] = app.remainingServiceFee.original;
      result['可退服务费(原始)'] = app.refundableServiceFee.original;
      result['提前结清违约金(原始)'] = app.earlySettlementPenalty.original;
      result['应还总额(原始)'] = app.totalPayableAmount.original;
    }

    if (options.includeCorrection) {
      result['剩余本金(修正)'] = app.remainingPrincipal.corrected ?? '';
      result['剩余服务费(修正)'] = app.remainingServiceFee.corrected ?? '';
      result['可退服务费(修正)'] = app.refundableServiceFee.corrected ?? '';
      result['提前结清违约金(修正)'] = app.earlySettlementPenalty.corrected ?? '';
      result['应还总额(修正)'] = app.totalPayableAmount.corrected ?? '';
    }

    if (options.includeAnomalies) {
      const unresolvedAnomalies = app.anomalies.filter((a) => !a.resolved);
      result['异常类型'] = unresolvedAnomalies.map((a) => a.type).join('; ');
      result['异常详情'] = unresolvedAnomalies.map((a) => a.message).join('; ');
      result['异常严重程度'] = unresolvedAnomalies
        .map((a) => a.severity)
        .join('; ');
    }

    if (options.includeReasons) {
      result['试算理由'] = app.reasons.trialCalculation
        .map((r) => r.message)
        .join(' | ');
      result['费用冲回理由'] = app.reasons.feeReversal
        .map((r) => r.message)
        .join(' | ');
      result['流水核对理由'] = app.reasons.flowVerification
        .map((r) => r.message)
        .join(' | ');
      result['状态流转理由'] = app.reasons.stateTransition
        .map((r) => r.message)
        .join(' | ');
    }

    return result;
  }

  private flattenStatement(
    statement: SettlementStatement,
    options: ExportOptions,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      结清单号: statement.statementNo,
      申请编号: statement.applicationNo,
      合同编号: statement.contractNo,
      '剩余本金(最终)': statement.finalSnapshot.remainingPrincipal,
      '剩余服务费(最终)': statement.finalSnapshot.remainingServiceFee,
      '可退服务费(最终)': statement.finalSnapshot.refundableServiceFee,
      '提前结清违约金(最终)': statement.finalSnapshot.earlySettlementPenalty,
      '应还总额(最终)': statement.finalSnapshot.totalPayableAmount,
      结论: statement.finalSnapshot.conclusion,
      是否已导出: statement.isExported ? '是' : '否',
      导出时间: statement.exportedAt
        ? dayjs(statement.exportedAt).format('YYYY-MM-DD HH:mm:ss')
        : '',
      导出人: statement.exportedBy || '',
      创建人: statement.createdBy,
      创建时间: dayjs(statement.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    };

    if (options.includeOriginal) {
      result['剩余本金(原始)'] = statement.originalSnapshot.remainingPrincipal;
      result['剩余服务费(原始)'] = statement.originalSnapshot.remainingServiceFee;
      result['可退服务费(原始)'] = statement.originalSnapshot.refundableServiceFee;
      result['提前结清违约金(原始)'] = statement.originalSnapshot.earlySettlementPenalty;
      result['应还总额(原始)'] = statement.originalSnapshot.totalPayableAmount;
    }

    if (options.includeCorrection && statement.correctionSnapshot) {
      result['剩余本金(修正)'] = statement.correctionSnapshot.remainingPrincipal ?? '';
      result['剩余服务费(修正)'] = statement.correctionSnapshot.remainingServiceFee ?? '';
      result['可退服务费(修正)'] = statement.correctionSnapshot.refundableServiceFee ?? '';
      result['提前结清违约金(修正)'] = statement.correctionSnapshot.earlySettlementPenalty ?? '';
      result['应还总额(修正)'] = statement.correctionSnapshot.totalPayableAmount ?? '';
      result['修正备注'] = statement.correctionSnapshot.remark ?? '';
      result['修正人'] = statement.correctionSnapshot.correctedBy;
      result['修正时间'] = dayjs(statement.correctionSnapshot.correctedAt).format('YYYY-MM-DD HH:mm:ss');
    }

    if (options.includeAnomalies) {
      const unresolvedAnomalies = statement.anomalies.filter((a) => !a.resolved);
      result['异常类型'] = unresolvedAnomalies.map((a) => a.type).join('; ');
      result['异常详情'] = unresolvedAnomalies.map((a) => a.message).join('; ');
      result['异常严重程度'] = unresolvedAnomalies
        .map((a) => a.severity)
        .join('; ');
    }

    return result;
  }

  exportApplicationsToCsv(
    applications: SettlementApplication[],
    options: ExportOptions,
  ): string {
    const records = applications.map((app) => this.flattenApplication(app, options));

    if (records.length === 0) {
      return '';
    }

    const headers = Object.keys(records[0]).map((key) => ({
      id: key,
      title: key,
    }));

    const csvStringifier = createObjectCsvStringifier({
      header: headers,
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  exportApplicationsToExcel(
    applications: SettlementApplication[],
    options: ExportOptions,
  ): Buffer {
    const records = applications.map((app) => this.flattenApplication(app, options));
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '提前结清申请');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  exportStatementsToCsv(
    statements: SettlementStatement[],
    options: ExportOptions,
  ): string {
    const records = statements.map((s) => this.flattenStatement(s, options));

    if (records.length === 0) {
      return '';
    }

    const headers = Object.keys(records[0]).map((key) => ({
      id: key,
      title: key,
    }));

    const csvStringifier = createObjectCsvStringifier({
      header: headers,
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  exportStatementsToExcel(
    statements: SettlementStatement[],
    options: ExportOptions,
  ): Buffer {
    const records = statements.map((s) => this.flattenStatement(s, options));
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '结清单');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  exportDetailedApplication(
    application: SettlementApplication,
    statement?: SettlementStatement,
  ): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('消费分期提前结清详细报告');
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('【基本信息】');
    lines.push(`申请编号: ${application.applicationNo}`);
    lines.push(`合同编号: ${application.contractNo}`);
    lines.push(`申请人: ${application.applicant}`);
    lines.push(`申请日期: ${dayjs(application.applicationDate).format('YYYY-MM-DD HH:mm:ss')}`);
    lines.push(`当前状态: ${application.status}`);
    lines.push(`创建人: ${application.createdBy}`);
    lines.push('');

    lines.push('【金额明细 - 三段式对比】');
    lines.push(`剩余本金: 原始=${application.remainingPrincipal.original}元, 修正=${application.remainingPrincipal.corrected ?? '无'}, 最终=${application.remainingPrincipal.final}元`);
    lines.push(`剩余服务费: 原始=${application.remainingServiceFee.original}元, 修正=${application.remainingServiceFee.corrected ?? '无'}, 最终=${application.remainingServiceFee.final}元`);
    lines.push(`可退服务费: 原始=${application.refundableServiceFee.original}元, 修正=${application.refundableServiceFee.corrected ?? '无'}, 最终=${application.refundableServiceFee.final}元`);
    lines.push(`提前结清违约金: 原始=${application.earlySettlementPenalty.original}元, 修正=${application.earlySettlementPenalty.corrected ?? '无'}, 最终=${application.earlySettlementPenalty.final}元`);
    lines.push(`应还总额: 原始=${application.totalPayableAmount.original}元, 修正=${application.totalPayableAmount.corrected ?? '无'}, 最终=${application.totalPayableAmount.final}元`);
    lines.push('');

    lines.push('【异常标记】');
    if (application.anomalies.length > 0) {
      application.anomalies.forEach((a, i) => {
        lines.push(`  ${i + 1}. [${a.severity}] ${a.type}: ${a.message} (已解决: ${a.resolved ? '是' : '否'})`);
      });
    } else {
      lines.push('  无异常');
    }
    lines.push('');

    lines.push('【判断理由明细】');
    lines.push('');
    lines.push('■ 结清试算理由:');
    application.reasons.trialCalculation.forEach((r) => {
      lines.push(`  [${dayjs(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
    });
    lines.push('');
    lines.push('■ 费用冲回理由:');
    application.reasons.feeReversal.forEach((r) => {
      lines.push(`  [${dayjs(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
    });
    lines.push('');
    lines.push('■ 流水核对理由:');
    application.reasons.flowVerification.forEach((r) => {
      lines.push(`  [${dayjs(r.timestamp).format('HH:mm:ss')}] ${r.message}`);
    });
    lines.push('');
    lines.push('■ 状态流转理由:');
    application.reasons.stateTransition.forEach((r) => {
      lines.push(`  [${dayjs(r.timestamp).format('HH:mm:ss')}] ${r.message} (操作人: ${r.operator || '系统'})`);
    });
    lines.push('');

    if (application.remark) {
      lines.push('【备注】');
      lines.push(application.remark);
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push(`报告生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

export const exportService = new ExportService();
