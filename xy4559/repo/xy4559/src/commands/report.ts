import { getDb } from '../db';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportOptions {
  format?: 'markdown' | 'json' | 'both';
  output?: string;
  batch?: string;
  name?: string;
}

interface ReportData {
  generatedAt: string;
  batchInfo: {
    validationBatch?: string;
  };
  summary: {
    totalInventory: number;
    totalMaintenance: number;
    totalPacking: number;
    totalShows: number;
    totalVehicles: number;
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    pendingReviews: number;
    acceptedReviews: number;
    rejectedReviews: number;
    resolvedReviews: number;
  };
  inventory: any[];
  maintenance: any[];
  packing: any[];
  shows: any[];
  vehicles: any[];
  issues: any[];
}

export async function generateReport(options: ReportOptions): Promise<void> {
  const db = getDb();
  const format = options.format || 'both';
  const outputDir = options.output || process.cwd();
  const reportName = options.name || `puppet-checkout-report-${new Date().toISOString().slice(0, 10)}`;

  console.log('生成出箱交接报告...');
  console.log(`输出目录: ${outputDir}`);

  const data = collectReportData(db, options.batch);

  if (format === 'markdown' || format === 'both') {
    const mdContent = generateMarkdownReport(data);
    const mdPath = path.join(outputDir, `${reportName}.md`);
    fs.writeFileSync(mdPath, mdContent, 'utf-8');
    console.log(`✓ Markdown 出箱交接单已生成: ${mdPath}`);
  }

  if (format === 'json' || format === 'both') {
    const jsonContent = JSON.stringify(data, null, 2);
    const jsonPath = path.join(outputDir, `${reportName}-audit.json`);
    fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
    console.log(`✓ JSON 审计明细已生成: ${jsonPath}`);
  }

  console.log('\n报告生成完成！');
  console.log('');
  printSummary(data);
}

function collectReportData(db: any, batch?: string): ReportData {
  const inventory = db.prepare('SELECT * FROM inventory ORDER BY box_number, item_id').all();
  const maintenance = db.prepare('SELECT * FROM maintenance ORDER BY report_date DESC').all();
  const packing = db.prepare('SELECT * FROM packing_scans ORDER BY scan_time DESC').all();
  const shows = db.prepare('SELECT * FROM show_schedules ORDER BY show_date, show_time').all();
  const vehicles = db.prepare('SELECT * FROM vehicle_plans ORDER BY departure_time').all();

  let issuesQuery = `
    SELECT 
      vi.*,
      rc.conclusion,
      rc.decision,
      rc.reviewed_by,
      rc.reviewed_at,
      rc.notes
    FROM validation_issues vi
    LEFT JOIN review_conclusions rc ON vi.id = rc.validation_issue_id
  `;
  const params: string[] = [];

  if (batch) {
    issuesQuery += ' WHERE vi.validation_batch = ?';
    params.push(batch);
  }

  issuesQuery += ' ORDER BY vi.severity = "high" DESC, vi.severity = "medium" DESC, vi.created_at ASC';

  const issues = db.prepare(issuesQuery).all(...params);

  const pendingReviews = issues.filter((i: any) => !i.conclusion).length;
  const acceptedReviews = issues.filter((i: any) => i.decision === 'accept').length;
  const rejectedReviews = issues.filter((i: any) => i.decision === 'reject').length;
  const resolvedReviews = issues.filter((i: any) => i.decision === 'resolved').length;

  return {
    generatedAt: new Date().toISOString(),
    batchInfo: {
      validationBatch: batch
    },
    summary: {
      totalInventory: inventory.length,
      totalMaintenance: maintenance.length,
      totalPacking: packing.length,
      totalShows: shows.length,
      totalVehicles: vehicles.length,
      totalIssues: issues.length,
      highSeverity: issues.filter((i: any) => i.severity === 'high').length,
      mediumSeverity: issues.filter((i: any) => i.severity === 'medium').length,
      lowSeverity: issues.filter((i: any) => i.severity === 'low').length,
      pendingReviews,
      acceptedReviews,
      rejectedReviews,
      resolvedReviews
    },
    inventory,
    maintenance,
    packing,
    shows,
    vehicles,
    issues
  };
}

function generateMarkdownReport(data: ReportData): string {
  const md: string[] = [];

  md.push('# 巡演木偶剧团出箱交接单');
  md.push('');
  md.push(`**生成时间**: ${formatDateTime(data.generatedAt)}`);
  if (data.batchInfo.validationBatch) {
    md.push(`**验证批次**: ${data.batchInfo.validationBatch}`);
  }
  md.push('');
  md.push('---');
  md.push('');

  md.push('## 1. 数据汇总');
  md.push('');
  md.push('| 数据类型 | 数量 |');
  md.push('|----------|------|');
  md.push(`| 木偶道具清单 | ${data.summary.totalInventory} |`);
  md.push(`| 维修记录 | ${data.summary.totalMaintenance} |`);
  md.push(`| 装箱扫描记录 | ${data.summary.totalPacking} |`);
  md.push(`| 演出场次 | ${data.summary.totalShows} |`);
  md.push(`| 车辆计划 | ${data.summary.totalVehicles} |`);
  md.push('');

  md.push('## 2. 验证问题汇总');
  md.push('');
  md.push('| 风险等级 | 数量 | 状态 |');
  md.push('|----------|------|------|');
  md.push(`| 🔴 高风险 | ${data.summary.highSeverity} | 待审核: ${data.summary.pendingReviews} |`);
  md.push(`| 🟡 中风险 | ${data.summary.mediumSeverity} | 已接受: ${data.summary.acceptedReviews} |`);
  md.push(`| 🟢 低风险 | ${data.summary.lowSeverity} | 已拒绝: ${data.summary.rejectedReviews} |`);
  md.push(`| | | 已解决: ${data.summary.resolvedReviews} |`);
  md.push('');

  if (data.inventory.length > 0) {
    md.push('## 3. 木偶道具清单');
    md.push('');
    md.push('| 物品编号 | 物品名称 | 类型 | 箱号 | 状态 | 易损件 |');
    md.push('|----------|----------|------|------|------|--------|');
    for (const item of data.inventory) {
      const fragileIcon = item.is_fragile ? '⚠️ 是' : '否';
      const statusIcon = item.status === '正常' ? '✅ 正常' : 
                         item.status === '损坏' ? '❌ 损坏' :
                         item.status === '待修' ? '🔧 待修' : item.status;
      md.push(`| ${item.item_id} | ${item.item_name} | ${item.item_type} | ${item.box_number} | ${statusIcon} | ${fragileIcon} |`);
    }
    md.push('');
  }

  if (data.maintenance.length > 0) {
    md.push('## 4. 维修记录');
    md.push('');
    md.push('| 维修编号 | 物品编号 | 物品名称 | 问题描述 | 报修日期 | 维修状态 |');
    md.push('|----------|----------|----------|----------|----------|----------|');
    for (const m of data.maintenance) {
      const statusIcon = m.repair_status === '已修' || m.repair_status === 'completed' ? '✅ 已修' :
                         m.repair_status === '待修' ? '🔴 待修' :
                         m.repair_status === '维修中' ? '🟡 维修中' : m.repair_status;
      md.push(`| ${m.maintenance_id} | ${m.item_id} | ${m.item_name || '-'} | ${m.issue_description} | ${m.report_date} | ${statusIcon} |`);
    }
    md.push('');
  }

  if (data.packing.length > 0) {
    md.push('## 5. 装箱扫描记录');
    md.push('');
    md.push('| 扫描编号 | 物品编号 | 物品名称 | 箱号 | 扫描时间 | 扫描人 | 状态 |');
    md.push('|----------|----------|----------|------|----------|--------|------|');
    for (const p of data.packing) {
      const statusIcon = p.status === '已装箱' ? '✅ 已装箱' :
                         p.status === '待装箱' ? '⏳ 待装箱' : p.status;
      md.push(`| ${p.scan_id} | ${p.item_id} | ${p.item_name || '-'} | ${p.box_number} | ${p.scan_time} | ${p.scanner || '-'} | ${statusIcon} |`);
    }
    md.push('');
  }

  if (data.shows.length > 0) {
    md.push('## 6. 演出场次表');
    md.push('');
    md.push('| 场次编号 | 演出日期 | 时间 | 地点 | 剧目 | 所需道具 | 所需木偶 | 状态 |');
    md.push('|----------|----------|------|------|------|----------|----------|------|');
    for (const s of data.shows) {
      const statusIcon = s.status === '已准备' ? '✅ 已准备' :
                         s.status === '待准备' ? '⏳ 待准备' :
                         s.status === '已完成' ? '✔️ 已完成' : s.status;
      md.push(`| ${s.show_id} | ${s.show_date} | ${s.show_time || '-'} | ${s.venue} | ${s.play_title} | ${s.required_items || '-'} | ${s.required_puppets || '-'} | ${statusIcon} |`);
    }
    md.push('');
  }

  if (data.vehicles.length > 0) {
    md.push('## 7. 车辆计划');
    md.push('');
    md.push('| 计划编号 | 车辆编号 | 车型 | 司机 | 出发时间 | 到达时间 | 起点 | 终点 | 状态 |');
    md.push('|----------|----------|------|------|----------|----------|------|------|------|');
    for (const v of data.vehicles) {
      const statusIcon = v.status === '待出发' ? '⏳ 待出发' :
                         v.status === '已出发' ? '🚗 已出发' :
                         v.status === '已到达' ? '✅ 已到达' : v.status;
      md.push(`| ${v.plan_id} | ${v.vehicle_number} | ${v.vehicle_type || '-'} | ${v.driver_name || '-'} | ${v.departure_time} | ${v.arrival_time || '-'} | ${v.origin || '-'} | ${v.destination} | ${statusIcon} |`);
    }
    md.push('');
  }

  if (data.issues.length > 0) {
    md.push('## 8. 验证问题与审核结论');
    md.push('');

    const highIssues = data.issues.filter(i => i.severity === 'high');
    const mediumIssues = data.issues.filter(i => i.severity === 'medium');
    const lowIssues = data.issues.filter(i => i.severity === 'low');

    if (highIssues.length > 0) {
      md.push('### 8.1 高风险问题');
      md.push('');
      for (const issue of highIssues) {
        md.push(`#### 问题 #${issue.id}`);
        md.push('');
        md.push(`- **类型**: ${issue.issue_type}`);
        md.push(`- **描述**: ${issue.description}`);
        if (issue.related_item) md.push(`- **相关物品**: ${issue.related_item}`);
        if (issue.related_box) md.push(`- **相关箱号**: ${issue.related_box}`);
        if (issue.related_show) md.push(`- **相关演出**: ${issue.related_show}`);
        if (issue.related_vehicle) md.push(`- **相关车辆**: ${issue.related_vehicle}`);
        md.push(`- **发现时间**: ${formatDateTime(issue.created_at)}`);
        
        if (issue.conclusion) {
          const decisionText = issue.decision === 'accept' ? '✅ 接受/放行' :
                               issue.decision === 'reject' ? '❌ 拒绝/召回' :
                               issue.decision === 'resolved' ? '✔️ 已解决' : '⏳ 待确认';
          md.push('');
          md.push('**审核结论**:');
          md.push(`- **决策**: ${decisionText}`);
          md.push(`- **结论**: ${issue.conclusion}`);
          md.push(`- **审核人**: ${issue.reviewed_by}`);
          md.push(`- **审核时间**: ${formatDateTime(issue.reviewed_at)}`);
          if (issue.notes) md.push(`- **备注**: ${issue.notes}`);
        } else {
          md.push('');
          md.push('**状态**: ⏳ 待审核');
        }
        md.push('');
      }
    }

    if (mediumIssues.length > 0) {
      md.push('### 8.2 中风险问题');
      md.push('');
      for (const issue of mediumIssues) {
        md.push(`#### 问题 #${issue.id}`);
        md.push('');
        md.push(`- **类型**: ${issue.issue_type}`);
        md.push(`- **描述**: ${issue.description}`);
        md.push(`- **发现时间**: ${formatDateTime(issue.created_at)}`);
        
        if (issue.conclusion) {
          const decisionText = issue.decision === 'accept' ? '✅ 接受' :
                               issue.decision === 'reject' ? '❌ 拒绝' :
                               issue.decision === 'resolved' ? '✔️ 已解决' : '⏳ 待确认';
          md.push('');
          md.push('**审核结论**:');
          md.push(`- **决策**: ${decisionText}`);
          md.push(`- **结论**: ${issue.conclusion}`);
          md.push(`- **审核人**: ${issue.reviewed_by}`);
        } else {
          md.push('');
          md.push('**状态**: ⏳ 待审核');
        }
        md.push('');
      }
    }

    if (lowIssues.length > 0) {
      md.push('### 8.3 低风险问题');
      md.push('');
      md.push('| ID | 类型 | 描述 | 状态 |');
      md.push('|----|------|------|------|');
      for (const issue of lowIssues) {
        const status = issue.conclusion 
          ? `已审核 (${issue.decision})` 
          : '待审核';
        md.push(`| ${issue.id} | ${issue.issue_type} | ${issue.description} | ${status} |`);
      }
      md.push('');
    }
  }

  md.push('---');
  md.push('');
  md.push('## 9. 出箱交接签字');
  md.push('');
  md.push(`- **交接时间**: ${formatDateTime(data.generatedAt)}`);
  md.push('');
  md.push('| 角色 | 签字 | 日期 |');
  md.push('|------|------|------|');
  md.push('| 装箱负责人 | _______________ | ____________ |');
  md.push('| 道具管理员 | _______________ | ____________ |');
  md.push('| 剧团团长 | _______________ | ____________ |');
  md.push('| 接收人 | _______________ | ____________ |');
  md.push('');

  md.push('---');
  md.push('');
  md.push('> 此报告由 Puppet-Checkout 工具自动生成');
  md.push(`> 生成时间: ${formatDateTime(data.generatedAt)}`);

  return md.join('\n');
}

function formatDateTime(isoString: string): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function printSummary(data: ReportData): void {
  console.log('='.repeat(60));
  console.log('报告摘要');
  console.log('='.repeat(60));
  console.log('');
  console.log('【数据统计】');
  console.log(`  木偶道具: ${data.summary.totalInventory} 项`);
  console.log(`  维修记录: ${data.summary.totalMaintenance} 条`);
  console.log(`  装箱记录: ${data.summary.totalPacking} 条`);
  console.log(`  演出场次: ${data.summary.totalShows} 场`);
  console.log(`  车辆计划: ${data.summary.totalVehicles} 条`);
  console.log('');
  console.log('【风险评估】');
  console.log(`  高风险问题: ${data.summary.highSeverity} 个`);
  console.log(`  中风险问题: ${data.summary.mediumSeverity} 个`);
  console.log(`  低风险问题: ${data.summary.lowSeverity} 个`);
  console.log('');
  console.log('【审核状态】');
  console.log(`  待审核: ${data.summary.pendingReviews} 个`);
  console.log(`  已接受: ${data.summary.acceptedReviews} 个`);
  console.log(`  已拒绝: ${data.summary.rejectedReviews} 个`);
  console.log(`  已解决: ${data.summary.resolvedReviews} 个`);
  console.log('');
  console.log('='.repeat(60));
}
