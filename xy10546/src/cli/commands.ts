import Table from 'cli-table3';
import {
  isInitialized, initializeStore, loadStore, saveStore,
  getDataDir
} from '../store/dataStore';
import {
  importSampleData, importInvoices, importReimbursements,
  importCompanyHeaders, importDepartments, importEmployees,
  loadJsonFile
} from '../services/importService';
import {
  checkInvoice, checkAllInvoices, getLatestCheckReport, getAllCheckReports
} from '../services/checkEngine';
import { getAuditHistory, getAllAuditRecords } from '../services/auditService';
import {
  colors, printSuccess, printError, printWarning, printInfo,
  printSection, formatResult, formatSeverity, formatAmount,
  formatDate, createSummaryTable, createIssuesTable
} from './utils';
import { InvoiceCheckReport, Invoice } from '../types';

const SYSTEM_OPERATOR = { id: 'system', name: '系统管理员' };

export function cmdInit(sample: boolean = false): void {
  if (isInitialized()) {
    printWarning('项目已初始化，数据目录已存在');
    printInfo(`数据目录: ${getDataDir()}`);
    return;
  }
  
  initializeStore();
  printSuccess('项目初始化完成');
  
  if (sample) {
    cmdImportSample();
  }
}

export function cmdImportSample(): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  printInfo('正在导入样例数据...');
  
  const counts = importSampleData(SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
  
  console.log('\n' + colors.bold('导入完成:'));
  console.log(`  公司抬头: ${counts.headers} 条`);
  console.log(`  部门: ${counts.departments} 条`);
  console.log(`  员工: ${counts.employees} 条`);
  console.log(`  发票: ${counts.invoices} 条 (餐饮、差旅、采购)`);
  console.log(`  报销单: ${counts.reimbursements} 条`);
  
  printSuccess('样例数据导入完成');
  printInfo('样例数据包含多种场景：自动通过、抬头近似、税号错误、重复报销、跨集团、金额拆分');
}

export function cmdImport(
  type: 'invoices' | 'reimbursements' | 'headers' | 'departments' | 'employees',
  filePath: string
): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  try {
    let count = 0;
    
    switch (type) {
      case 'invoices': {
        const data = loadJsonFile<any>(filePath);
        count = importInvoices(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
        break;
      }
      case 'reimbursements': {
        const data = loadJsonFile<any>(filePath);
        count = importReimbursements(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
        break;
      }
      case 'headers': {
        const data = loadJsonFile<any>(filePath);
        count = importCompanyHeaders(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
        break;
      }
      case 'departments': {
        const data = loadJsonFile<any>(filePath);
        count = importDepartments(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
        break;
      }
      case 'employees': {
        const data = loadJsonFile<any>(filePath);
        count = importEmployees(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
        break;
      }
    }
    
    printSuccess(`成功导入 ${count} 条 ${type} 数据`);
  } catch (err: any) {
    printError(`导入失败: ${err.message}`);
  }
}

export function cmdCheck(invoiceId?: string): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  const store = loadStore();
  
  if (store.invoices.length === 0) {
    printError('没有发票数据，请先执行 import 命令导入数据');
    return;
  }
  
  let reports: InvoiceCheckReport[] = [];
  
  if (invoiceId) {
    const report = checkInvoice(invoiceId);
    if (!report) {
      printError(`未找到发票: ${invoiceId}`);
      return;
    }
    reports = [report];
  } else {
    printInfo('正在检查所有发票...');
    reports = checkAllInvoices();
  }
  
  const table = createSummaryTable(reports);
  printSection('检查结果汇总', table.toString());
  
  const passCount = reports.filter(r => r.result === 'auto_pass').length;
  const reissueCount = reports.filter(r => r.result === 'needs_reissue').length;
  const reviewCount = reports.filter(r => r.result === 'manual_review').length;
  const correctionCount = reports.filter(r => r.result === 'correction_suggested').length;
  
  console.log('\n' + colors.bold('结果统计:'));
  console.log(`  ${colors.success('✓ 自动通过')}: ${passCount}`);
  console.log(`  ${colors.error('✗ 需补开')}: ${reissueCount}`);
  console.log(`  ${colors.warning('⚠ 人工复核')}: ${reviewCount}`);
  console.log(`  ${colors.info('ℹ 纠错建议')}: ${correctionCount}`);
  console.log(`  ${colors.muted('总计')}: ${reports.length}`);
  
  if (reports.length > 0 && reports.some(r => r.errorCount > 0 || r.warnCount > 0)) {
    printInfo('使用 detail 命令查看具体发票的详细问题和建议');
  }
}

export function cmdDetail(id: string, showHistory: boolean = false): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  const store = loadStore();
  
  const invoice = store.invoices.find(
    i => i.id === id || i.invoiceNumber === id
  );
  
  if (!invoice) {
    printError(`未找到发票: ${id}`);
    return;
  }
  
  const reimbursement = store.reimbursements.find(r => r.invoiceIds.includes(invoice.id));
  const report = getLatestCheckReport(invoice.id);
  
  const typeMap: Record<string, string> = {
    food: '餐饮',
    travel: '差旅',
    purchase: '采购',
    other: '其他'
  };
  
  const invTable = new Table({
    head: [colors.bold('项目'), colors.bold('内容')],
    colWidths: [18, 55]
  });
  
  invTable.push(
    ['发票号', invoice.invoiceNumber],
    ['发票代码', invoice.invoiceCode],
    ['发票类型', typeMap[invoice.invoiceType] || invoice.invoiceType],
    ['开票日期', invoice.invoiceDate],
    ['抬头名称', invoice.headerName],
    ['税号', invoice.taxId],
    ['金额(不含税)', formatAmount(invoice.amount)],
    ['税额', formatAmount(invoice.taxAmount)],
    ['总金额', formatAmount(invoice.totalAmount)],
    ['销售方', invoice.sellerName],
    ['提交人', invoice.submitterName],
    ['当前状态', invoice.status.toUpperCase()],
    ['最后更新', formatDate(invoice.updatedAt)]
  );
  
  printSection('发票详情', invTable.toString());
  
  if (reimbursement) {
    const reimTable = new Table({
      head: [colors.bold('项目'), colors.bold('内容')],
      colWidths: [18, 55]
    });
    
    reimTable.push(
      ['报销单号', reimbursement.formNumber],
      ['申请人', reimbursement.applicantName],
      ['部门', reimbursement.departmentName],
      ['预期抬头', reimbursement.expectedHeaderName],
      ['预期税号', reimbursement.expectedTaxId],
      ['申请金额', formatAmount(reimbursement.totalAmount)],
      ['描述', reimbursement.description],
      ['状态', reimbursement.status.toUpperCase()]
    );
    
    printSection('关联报销单', reimTable.toString());
  }
  
  if (report) {
    printSection('审核结果', `  最终判定: ${formatResult(report.result)}`);
    
    if (report.issues.length > 0) {
      const issuesTable = createIssuesTable(report.issues);
      printSection('发现的问题', issuesTable.toString());
      
      const relatedIssues = report.issues.filter(i => i.relatedEntities && i.relatedEntities.length > 0);
      if (relatedIssues.length > 0) {
        console.log('\n' + colors.bold('关联实体:'));
        for (const issue of relatedIssues) {
          console.log(`  - ${issue.title}:`);
          for (const entity of issue.relatedEntities!) {
            console.log(`    ${entity.type === 'invoice' ? '📄' : entity.type === 'reimbursement' ? '📋' : '🏢'} ${entity.name}`);
          }
        }
      }
    } else {
      printSuccess('未发现问题，所有检查项通过');
    }
  } else {
    printWarning('该发票尚未执行检查，请先执行 check 命令');
  }
  
  if (showHistory) {
    const history = getAuditHistory('invoice', invoice.id);
    
    if (history.length > 0) {
      const histTable = new Table({
        head: [
          colors.bold('时间'),
          colors.bold('操作'),
          colors.bold('操作者'),
          colors.bold('差异字段'),
          colors.bold('原因')
        ],
        colWidths: [20, 22, 12, 20, 30]
      });
      
      for (const record of history) {
        const diffFields = record.diff ? record.diff.map(d => d.field).join(', ') : '-';
        histTable.push([
          formatDate(record.timestamp),
          record.action,
          record.operatorName,
          diffFields,
          record.reason || '-'
        ]);
        
        if (record.diff && record.diff.length > 0) {
          for (const d of record.diff) {
            console.log(`    ↳ ${d.field}: "${colors.muted(String(d.before))}" → "${colors.highlight(String(d.after))}"`);
          }
        }
      }
      
      printSection('操作历史记录', histTable.toString());
    } else {
      printInfo('暂无操作历史记录');
    }
  }
}

export function cmdReport(filter?: string): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  const reports = getAllCheckReports();
  
  if (reports.length === 0) {
    printWarning('暂无检查报告，请先执行 check 命令');
    return;
  }
  
  let filteredReports = reports;
  if (filter) {
    const validFilters = ['auto_pass', 'needs_reissue', 'manual_review', 'correction_suggested'];
    if (validFilters.includes(filter)) {
      filteredReports = reports.filter(r => r.result === filter);
      printInfo(`筛选结果: ${formatResult(filter as any)}`);
    }
  }
  
  const summaryTable = createSummaryTable(filteredReports);
  printSection('检查报告汇总', summaryTable.toString());
  
  const totalByType: Record<string, number> = {
    auto_pass: 0, needs_reissue: 0, manual_review: 0, correction_suggested: 0
  };
  
  for (const r of filteredReports) {
    totalByType[r.result]++;
  }
  
  const summary = new Table({
    head: [colors.bold('结果类型'), colors.bold('数量'), colors.bold('占比')]
  });
  
  const total = filteredReports.length;
  const typeLabels: Record<string, string> = {
    auto_pass: '自动通过',
    needs_reissue: '需补开',
    manual_review: '人工复核',
    correction_suggested: '纠错建议'
  };
  
  for (const [type, count] of Object.entries(totalByType)) {
    if (count > 0) {
      summary.push([
        typeLabels[type],
        String(count),
        `${((count / total) * 100).toFixed(1)}%`
      ]);
    }
  }
  
  printSection('结果分类统计', summary.toString());
  
  const allIssues = filteredReports.flatMap(r => r.issues);
  if (allIssues.length > 0) {
    const issueByType: Record<string, number> = {};
    for (const issue of allIssues) {
      issueByType[issue.type] = (issueByType[issue.type] || 0) + 1;
    }
    
    const typeNameMap: Record<string, string> = {
      duplicate_invoice: '重复报销',
      header_mismatch: '抬头不匹配',
      similar_header: '抬头近似',
      cross_company_header: '跨集团抬头',
      amount_mismatch: '金额不匹配',
      amount_split: '金额拆分',
      tax_id_mismatch: '税号不匹配',
      other: '其他'
    };
    
    const issueTable = new Table({
      head: [colors.bold('问题类型'), colors.bold('出现次数')]
    });
    
    for (const [type, count] of Object.entries(issueByType)) {
      issueTable.push([typeNameMap[type] || type, String(count)]);
    }
    
    printSection('问题类型分布', issueTable.toString());
  }
  
  const audits = getAllAuditRecords();
  if (audits.length > 0) {
    const recent = audits.slice(0, 5);
    const auditTable = new Table({
      head: [
        colors.bold('时间'),
        colors.bold('类型'),
        colors.bold('操作'),
        colors.bold('操作者')
      ],
      colWidths: [20, 14, 22, 14]
    });
    
    for (const a of recent) {
      auditTable.push([
        formatDate(a.timestamp),
        a.targetType,
        a.action,
        a.operatorName
      ]);
    }
    
    printSection('最近操作记录', auditTable.toString());
  }
}

export function cmdStatus(): void {
  const store = loadStore();
  
  console.log('\n' + colors.bold('=== 系统状态 ==='));
  console.log(`数据目录: ${getDataDir()}`);
  console.log(`已初始化: ${store.initialized ? colors.success('是') : colors.error('否')}`);
  
  if (store.initialized) {
    console.log(`\n数据统计:`);
    console.log(`  公司抬头: ${store.companyHeaders.length} 条`);
    console.log(`  部门: ${store.departments.length} 条`);
    console.log(`  员工: ${store.employees.length} 条`);
    console.log(`  发票: ${store.invoices.length} 条`);
    console.log(`  报销单: ${store.reimbursements.length} 条`);
    console.log(`  检查报告: ${store.checkReports.length} 份`);
    console.log(`  审计记录: ${store.auditRecords.length} 条`);
  }
}

export function cmdList(type: 'invoices' | 'reimbursements' | 'headers'): void {
  if (!isInitialized()) {
    printError('项目未初始化，请先执行 init 命令');
    return;
  }
  
  const store = loadStore();
  
  if (type === 'invoices') {
    if (store.invoices.length === 0) {
      printWarning('暂无发票数据');
      return;
    }
    
    const table = new Table({
      head: [
        colors.bold('ID'),
        colors.bold('发票号'),
        colors.bold('抬头'),
        colors.bold('金额'),
        colors.bold('类型'),
        colors.bold('状态')
      ],
      colWidths: [10, 16, 30, 12, 8, 14]
    });
    
    for (const inv of store.invoices) {
      table.push([
        inv.id.substring(0, 8),
        inv.invoiceNumber,
        inv.headerName.substring(0, 28),
        formatAmount(inv.totalAmount),
        inv.invoiceType,
        inv.status
      ]);
    }
    
    printSection('发票列表', table.toString());
  } else if (type === 'reimbursements') {
    if (store.reimbursements.length === 0) {
      printWarning('暂无报销单数据');
      return;
    }
    
    const table = new Table({
      head: [
        colors.bold('ID'),
        colors.bold('单号'),
        colors.bold('申请人'),
        colors.bold('预期抬头'),
        colors.bold('金额'),
        colors.bold('状态')
      ],
      colWidths: [10, 14, 10, 30, 12, 14]
    });
    
    for (const reim of store.reimbursements) {
      table.push([
        reim.id.substring(0, 8),
        reim.formNumber,
        reim.applicantName,
        reim.expectedHeaderName.substring(0, 28),
        formatAmount(reim.totalAmount),
        reim.status
      ]);
    }
    
    printSection('报销单列表', table.toString());
  } else if (type === 'headers') {
    if (store.companyHeaders.length === 0) {
      printWarning('暂无公司抬头数据');
      return;
    }
    
    const table = new Table({
      head: [
        colors.bold('ID'),
        colors.bold('公司名称'),
        colors.bold('税号'),
        colors.bold('集团'),
        colors.bold('状态')
      ],
      colWidths: [10, 36, 22, 14, 10]
    });
    
    for (const h of store.companyHeaders) {
      table.push([
        h.id,
        h.name.substring(0, 34),
        h.taxId,
        h.groupId,
        h.status
      ]);
    }
    
    printSection('公司抬头库', table.toString());
  }
}
