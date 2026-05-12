import chalk from 'chalk';
import Table from 'cli-table3';
import {
  Batch,
  BatchStatus,
  DefectLevel,
  InspectionRecord,
  ConcessionRequest,
  HistoryEntry,
  ActionType
} from '../types';
import { formatDefects, getDefectLevelLabel, calculateDefectScore } from '../engine/rules';

export const STATUS_COLORS: Record<BatchStatus, chalk.Chalk> = {
  CREATED: chalk.gray,
  INITIAL_INSPECTION: chalk.yellow,
  PENDING_REINSPECTION: chalk.yellowBright,
  REINSPECTION: chalk.magenta,
  PENDING_CONCESSION: chalk.cyan,
  CONCESSION_APPROVED: chalk.greenBright,
  PASSED: chalk.green,
  REJECTED: chalk.red,
  REWORK: chalk.magentaBright,
  CLOSED: chalk.gray.dim
};

export const STATUS_LABELS: Record<BatchStatus, string> = {
  CREATED: '已创建',
  INITIAL_INSPECTION: '初检中',
  PENDING_REINSPECTION: '待复检',
  REINSPECTION: '复检中',
  PENDING_CONCESSION: '待让步放行',
  CONCESSION_APPROVED: '让步放行通过',
  PASSED: '通过',
  REJECTED: '拒收',
  REWORK: '返工',
  CLOSED: '已关闭'
};

export const RISK_COLORS: Record<string, chalk.Chalk> = {
  NONE: chalk.green,
  LOW: chalk.yellow,
  MEDIUM: chalk.magenta,
  HIGH: chalk.red,
  CRITICAL: chalk.redBright.bold
};

export const RISK_LABELS: Record<string, string> = {
  NONE: '无',
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '严重'
};

export const ACTION_LABELS: Record<ActionType, string> = {
  INITIAL_INSPECT: '初检',
  REINSPECT: '复检',
  REQUEST_CONCESSION: '申请让步放行',
  APPROVE_CONCESSION: '批准让步放行',
  REJECT_CONCESSION: '拒绝让步放行',
  APPROVE_REWORK: '批准返工',
  MANUAL_CORRECTION: '人工修正',
  CLOSE_BATCH: '关闭批次'
};

export function formatStatus(status: BatchStatus): string {
  const color = STATUS_COLORS[status] || chalk.white;
  const label = STATUS_LABELS[status] || status;
  return color(`[${label}]`);
}

export function formatRisk(risk: string): string {
  const color = RISK_COLORS[risk] || chalk.white;
  const label = RISK_LABELS[risk] || risk;
  return color(`${label}风险`);
}

export function printBatchHeader(batch: Batch): void {
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold(`  批次信息: ${batch.batchNumber}`));
  console.log('='.repeat(80));
  
  console.log(`  产品: ${chalk.cyan(batch.productName)} (${batch.productCode})`);
  console.log(`  数量: ${chalk.cyan(batch.quantity.toString())} 件`);
  console.log(`  生产日期: ${chalk.cyan(batch.productionDate)}`);
  console.log(`  生产线: ${chalk.cyan(batch.productionLine)}`);
  console.log(`  当前状态: ${formatStatus(batch.status)}`);
  console.log(`  质量风险: ${formatRisk(batch.currentRisk)}`);
  console.log(`  创建时间: ${batch.createdAt}`);
  console.log(`  更新时间: ${batch.updatedAt}`);
}

export function printInspections(batch: Batch): void {
  if (batch.inspections.length === 0) {
    console.log(`\n  ${chalk.yellow('暂无检验记录')}`);
    return;
  }

  console.log('\n' + chalk.bold('  检验记录:'));
  console.log('  ' + '-'.repeat(75));

  batch.inspections.forEach((inspection, index) => {
    const isReinspection = index > 0;
    const type = isReinspection ? '复检' : '初检';
    const resultColor = inspection.result === 'PASS' ? chalk.green : chalk.red;
    
    console.log(`\n  ${chalk.bold(`[${type}]`)} 第 ${index + 1} 次检验`);
    console.log(`    检验员: ${inspection.inspector}`);
    console.log(`    时间: ${inspection.timestamp}`);
    console.log(`    抽样数: ${inspection.sampleCount} / 已检: ${inspection.inspectedCount}`);
    console.log(`    缺陷数: ${inspection.defectCount}`);
    console.log(`    缺陷详情: ${formatDefects(inspection.defects)}`);
    console.log(`    缺陷评分: ${chalk.yellow(calculateDefectScore(inspection.defects).toString())}`);
    console.log(`    结果: ${resultColor(inspection.result === 'PASS' ? '通过' : '不合格')}`);
    if (inspection.notes) {
      console.log(`    备注: ${inspection.notes}`);
    }
  });
}

export function printConcessions(batch: Batch): void {
  if (batch.concessionRequests.length === 0) {
    console.log(`\n  ${chalk.yellow('暂无让步放行记录')}`);
    return;
  }

  console.log('\n' + chalk.bold('  让步放行记录:'));
  console.log('  ' + '-'.repeat(75));

  batch.concessionRequests.forEach((concession, index) => {
    const statusColor = 
      concession.approvalStatus === 'APPROVED' ? chalk.green :
      concession.approvalStatus === 'REJECTED' ? chalk.red : chalk.yellow;
    
    console.log(`\n  ${chalk.bold(`[申请 ${index + 1}]`)}`);
    console.log(`    申请人: ${concession.requestedBy}`);
    console.log(`    申请时间: ${concession.requestedAt}`);
    console.log(`    原因: ${concession.reason}`);
    console.log(`    理由: ${concession.justification}`);
    console.log(`    风险等级: ${formatRisk(concession.riskLevel)}`);
    console.log(`    状态: ${statusColor(concession.approvalStatus === 'PENDING' ? '待审批' : 
      concession.approvalStatus === 'APPROVED' ? '已批准' : '已拒绝')}`);
    
    if (concession.approvedBy) {
      console.log(`    审批人: ${chalk.green(concession.approvedBy)}`);
      console.log(`    审批时间: ${concession.approvedAt}`);
      if (concession.approvalNotes) {
        console.log(`    审批意见: ${concession.approvalNotes}`);
      }
    }
  });
}

export function printHistory(batch: Batch, limit?: number): void {
  if (batch.history.length === 0) {
    console.log(`\n  ${chalk.yellow('暂无历史记录')}`);
    return;
  }

  const history = limit ? batch.history.slice(-limit) : batch.history;

  console.log('\n' + chalk.bold('  历史轨迹:'));
  console.log('  ' + '-'.repeat(75));

  history.forEach((entry, index) => {
    const actionLabel = ACTION_LABELS[entry.actionType] || entry.actionType;
    const actionColor = 
      entry.actionType === 'MANUAL_CORRECTION' ? chalk.magentaBright :
      entry.actionType.includes('APPROVE') ? chalk.green :
      entry.actionType === 'CLOSE_BATCH' ? chalk.gray :
      chalk.cyan;

    console.log(`\n  ${chalk.bold(`#${index + 1}`)} ${actionColor(actionLabel)}`);
    console.log(`    操作者: ${entry.actor}`);
    console.log(`    时间: ${entry.timestamp}`);
    console.log(`    状态变更: ${formatStatus(entry.previousStatus)} → ${formatStatus(entry.newStatus)}`);
    if (entry.reason) {
      console.log(`    原因: ${entry.reason}`);
    }
    if (entry.differences && entry.differences.length > 0) {
      console.log(`    变更差异:`);
      entry.differences.forEach(diff => {
        console.log(`      - ${chalk.cyan(diff.field)}: ${chalk.red(diff.oldValue)} → ${chalk.green(diff.newValue)}`);
      });
    }
  });
}

export function printBatchSummary(batch: Batch): void {
  printBatchHeader(batch);
  printInspections(batch);
  printConcessions(batch);
  printHistory(batch);
  console.log('\n' + '='.repeat(80) + '\n');
}

export function printBatchList(batches: Batch[]): void {
  if (batches.length === 0) {
    console.log(chalk.yellow('\n  暂无批次数据\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('批次号'),
      chalk.bold('产品'),
      chalk.bold('数量'),
      chalk.bold('状态'),
      chalk.bold('风险'),
      chalk.bold('检验次数'),
      chalk.bold('让步放行'),
      chalk.bold('更新时间')
    ],
    colWidths: [22, 20, 10, 16, 10, 12, 12, 20]
  });

  batches.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  batches.forEach(batch => {
    const concessionsApproved = batch.concessionRequests.filter(
      c => c.approvalStatus === 'APPROVED'
    ).length;

    table.push([
      chalk.cyan(batch.batchNumber),
      batch.productName.length > 15 ? batch.productName.slice(0, 15) + '...' : batch.productName,
      batch.quantity.toString(),
      formatStatus(batch.status),
      formatRisk(batch.currentRisk),
      batch.inspections.length.toString(),
      concessionsApproved > 0 ? chalk.green(`✓ ${concessionsApproved}`) : chalk.gray('-'),
      new Date(batch.updatedAt).toLocaleString('zh-CN')
    ]);
  });

  console.log('\n' + table.toString() + '\n');
}

export function printReport(batches: Batch[]): void {
  const total = batches.length;
  const passed = batches.filter(b => b.status === 'PASSED' || b.status === 'CLOSED' && 
    b.history.some(h => h.newStatus === 'PASSED')).length;
  const failed = batches.filter(b => b.status === 'REJECTED').length;
  const rework = batches.filter(b => b.status === 'REWORK').length;
  const concessions = batches.filter(b => 
    b.concessionRequests.some(c => c.approvalStatus === 'APPROVED')
  ).length;
  const pending = batches.filter(b => 
    ['PENDING_REINSPECTION', 'PENDING_CONCESSION', 'REINSPECTION', 'INITIAL_INSPECTION'].includes(b.status)
  ).length;
  const highRisk = batches.filter(b => 
    ['HIGH', 'CRITICAL'].includes(b.currentRisk)
  ).length;

  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold('  质量检验汇总报告'));
  console.log('='.repeat(80));

  const summaryTable = new Table({
    head: [chalk.bold('指标'), chalk.bold('数量'), chalk.bold('占比')],
    colWidths: [30, 15, 15]
  });

  summaryTable.push(
    [chalk.cyan('总批次数'), total.toString(), '100%'],
    [chalk.green('通过批次'), passed.toString(), `${total > 0 ? Math.round(passed / total * 100) : 0}%`],
    [chalk.red('拒收批次'), failed.toString(), `${total > 0 ? Math.round(failed / total * 100) : 0}%`],
    [chalk.magenta('返工批次'), rework.toString(), `${total > 0 ? Math.round(rework / total * 100) : 0}%`],
    [chalk.greenBright('让步放行'), concessions.toString(), `${total > 0 ? Math.round(concessions / total * 100) : 0}%`],
    [chalk.yellow('待处理'), pending.toString(), `${total > 0 ? Math.round(pending / total * 100) : 0}%`],
    [chalk.redBright('高风险批次'), highRisk.toString(), `${total > 0 ? Math.round(highRisk / total * 100) : 0}%`]
  );

  console.log('\n' + summaryTable.toString());

  if (highRisk > 0) {
    console.log('\n' + chalk.bold.red('  ⚠ 高风险批次详情:'));
    batches.filter(b => ['HIGH', 'CRITICAL'].includes(b.currentRisk)).forEach(batch => {
      console.log(`    - ${chalk.cyan(batch.batchNumber)}: ${batch.productName} - ${formatRisk(batch.currentRisk)}`);
    });
  }

  if (pending > 0) {
    console.log('\n' + chalk.bold.yellow('  ⏳ 待处理批次详情:'));
    batches.filter(b => 
      ['PENDING_REINSPECTION', 'PENDING_CONCESSION', 'REINSPECTION', 'INITIAL_INSPECTION'].includes(b.status)
    ).forEach(batch => {
      console.log(`    - ${chalk.cyan(batch.batchNumber)}: ${batch.productName} - ${formatStatus(batch.status)}`);
    });
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

export function printError(message: string, errors?: string[]): void {
  console.log('\n' + chalk.red.bold('  ✖ 操作失败'));
  console.log(`  ${message}`);
  if (errors && errors.length > 0) {
    console.log('\n  错误详情:');
    errors.forEach(err => console.log(`    - ${chalk.red(err)}`));
  }
  console.log();
}

export function printSuccess(message: string, warnings?: string[]): void {
  console.log('\n' + chalk.green.bold('  ✓ 操作成功'));
  console.log(`  ${message}`);
  if (warnings && warnings.length > 0) {
    console.log('\n  警告信息:');
    warnings.forEach(warn => console.log(`    - ${chalk.yellow(warn)}`));
  }
  console.log();
}

export function printTitle(title: string): void {
  console.log('\n' + '─'.repeat(80));
  console.log(chalk.bold(`  ${title}`));
  console.log('─'.repeat(80) + '\n');
}
