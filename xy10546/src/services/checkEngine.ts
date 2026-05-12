import { v4 as uuidv4 } from 'uuid';
import {
  Invoice, ReimbursementForm, CompanyHeader, CheckIssue,
  InvoiceCheckReport, CheckResult, Employee, Department
} from '../types';
import { loadStore, saveStore } from '../store/dataStore';
import { recordAudit } from './auditService';

function normalizeName(name: string): string {
  return name
    .replace(/[（(）)\s]/g, '')
    .replace(/股份有限公司|有限责任公司|有限公司|集团/gi, '')
    .toLowerCase();
}

function hammingDistance(s1: string, s2: string): number {
  const len = Math.min(s1.length, s2.length);
  let dist = Math.abs(s1.length - s2.length);
  for (let i = 0; i < len; i++) {
    if (s1[i] !== s2[i]) dist++;
  }
  return dist;
}

function findSimilarHeaders(
  invoiceHeader: string,
  companyHeaders: CompanyHeader[],
  threshold: number = 3
): CompanyHeader[] {
  const normalizedInvoice = normalizeName(invoiceHeader);
  return companyHeaders.filter(h => {
    if (h.status !== 'active') return false;
    if (h.name === invoiceHeader) return false;
    const normalizedCompany = normalizeName(h.name);
    return hammingDistance(normalizedInvoice, normalizedCompany) <= threshold;
  });
}

function checkDuplicateInvoice(
  invoice: Invoice,
  allInvoices: Invoice[]
): CheckIssue | null {
  const duplicates = allInvoices.filter(
    inv => inv.id !== invoice.id &&
      inv.invoiceNumber === invoice.invoiceNumber &&
      inv.invoiceCode === invoice.invoiceCode &&
      inv.status !== 'rejected'
  );
  
  if (duplicates.length === 0) return null;
  
  return {
    id: uuidv4(),
    type: 'duplicate_invoice',
    severity: 'error',
    title: '同一发票重复报销',
    description: `发票 ${invoice.invoiceNumber}(${invoice.invoiceCode}) 已被用于其他报销单报销`,
    suggestion: '请核实是否确实需要重复报销，如为误提交请撤销此发票',
    relatedEntities: duplicates.map(d => ({
      type: 'invoice' as const,
      id: d.id,
      name: `发票号: ${d.invoiceNumber} - 提交人: ${d.submitterName}`
    }))
  };
}

function checkHeaderMatch(
  invoice: Invoice,
  reimbursement: ReimbursementForm | null,
  employee: Employee | null,
  departments: Department[],
  companyHeaders: CompanyHeader[]
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  
  const expectedHeader = reimbursement?.expectedHeaderName || 
    (employee ? findExpectedHeader(employee, departments, companyHeaders) : null);
  const expectedTaxId = reimbursement?.expectedTaxId ||
    (employee ? findExpectedTaxId(employee, departments, companyHeaders) : null);
  
  if (expectedHeader && invoice.headerName !== expectedHeader) {
    const similar = findSimilarHeaders(invoice.headerName, companyHeaders);
    
    if (similar.length > 0) {
      issues.push({
        id: uuidv4(),
        type: 'similar_header',
        severity: 'warning',
        title: '抬头近似但可能主体不同',
        description: `发票抬头"${invoice.headerName}"与预期抬头"${expectedHeader}"近似但存在差异`,
        suggestion: `可能是开票错误，建议核实是否应为以下公司：${similar.map(s => s.name).join('、')}`,
        affectedFields: ['headerName'],
        relatedEntities: similar.map(s => ({
          type: 'company' as const,
          id: s.id,
          name: s.name
        }))
      });
    } else {
      issues.push({
        id: uuidv4(),
        type: 'header_mismatch',
        severity: 'error',
        title: '抬头不匹配',
        description: `发票抬头"${invoice.headerName}"与预期抬头"${expectedHeader}"不一致`,
        suggestion: '发票抬头错误，需重新开具正确抬头的发票',
        affectedFields: ['headerName']
      });
    }
  }
  
  if (expectedTaxId && invoice.taxId !== expectedTaxId) {
    issues.push({
      id: uuidv4(),
      type: 'tax_id_mismatch',
      severity: 'error',
      title: '税号不匹配',
      description: `发票税号"${invoice.taxId}"与预期税号"${expectedTaxId}"不一致`,
      suggestion: '税号错误，需重新开具正确税号的发票',
      affectedFields: ['taxId']
    });
  }
  
  if (expectedHeader) {
    const headerCompany = companyHeaders.find(h => h.name === expectedHeader);
    const invoiceCompany = companyHeaders.find(h => h.name === invoice.headerName);
    
    if (headerCompany && invoiceCompany && headerCompany.groupId !== invoiceCompany.groupId) {
      issues.push({
        id: uuidv4(),
        type: 'cross_company_header',
        severity: 'error',
        title: '跨集团公司抬头',
        description: `发票抬头"${invoice.headerName}"属于"${invoiceCompany.groupId}"集团，而报销所属部门应使用"${headerCompany.name}"（${headerCompany.groupId}集团）`,
        suggestion: '跨集团报销需要特殊审批流程，建议使用正确集团公司的发票',
        affectedFields: ['headerName'],
        relatedEntities: [
          { type: 'company', id: headerCompany.id, name: headerCompany.name },
          { type: 'company', id: invoiceCompany.id, name: invoiceCompany.name }
        ]
      });
    }
  }
  
  return issues;
}

function checkAmountMatch(
  invoice: Invoice,
  reimbursement: ReimbursementForm | null,
  allReimbursements: ReimbursementForm[]
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  
  if (!reimbursement) return issues;
  
  if (invoice.totalAmount > reimbursement.totalAmount) {
    issues.push({
      id: uuidv4(),
      type: 'amount_mismatch',
      severity: 'error',
      title: '发票金额大于报销金额',
      description: `发票金额 ¥${invoice.totalAmount.toFixed(2)} 大于报销单申请金额 ¥${reimbursement.totalAmount.toFixed(2)}`,
      suggestion: '请确认报销金额是否正确，发票金额不应大于报销金额',
      affectedFields: ['totalAmount']
    });
  }
  
  const otherReimbursements = allReimbursements.filter(
    r => r.id !== reimbursement.id &&
      r.invoiceIds.includes(invoice.id) &&
      r.status !== 'rejected'
  );
  
  if (otherReimbursements.length > 0) {
    const totalClaimed = otherReimbursements.reduce((sum, r) => sum + r.totalAmount, 0);
    
    if (totalClaimed + reimbursement.totalAmount > invoice.totalAmount) {
      issues.push({
        id: uuidv4(),
        type: 'amount_split',
        severity: 'warning',
        title: '金额拆分报销风险',
        description: `发票金额 ¥${invoice.totalAmount.toFixed(2)} 已被拆分到 ${otherReimbursements.length + 1} 个报销单中，累计金额可能超过发票总额`,
        suggestion: '金额拆分报销需核实业务真实性，请确认拆分是否合理',
        affectedFields: ['totalAmount'],
        relatedEntities: otherReimbursements.map(r => ({
          type: 'reimbursement' as const,
          id: r.id,
          name: `报销单: ${r.formNumber}`
        }))
      });
    }
  }
  
  return issues;
}

function findExpectedHeader(
  employee: Employee,
  departments: Department[],
  companyHeaders: CompanyHeader[]
): string | null {
  const department = departments.find(d => d.id === employee.departmentId);
  if (!department || department.allowedCompanyHeaders.length === 0) return null;
  
  const header = companyHeaders.find(h => h.id === department.allowedCompanyHeaders[0]);
  return header?.name || null;
}

function findExpectedTaxId(
  employee: Employee,
  departments: Department[],
  companyHeaders: CompanyHeader[]
): string | null {
  const department = departments.find(d => d.id === employee.departmentId);
  if (!department || department.allowedCompanyHeaders.length === 0) return null;
  
  const header = companyHeaders.find(h => h.id === department.allowedCompanyHeaders[0]);
  return header?.taxId || null;
}

export function checkInvoice(
  invoiceId: string,
  operatorId: string = 'system',
  operatorName: string = '系统自动'
): InvoiceCheckReport | null {
  const store = loadStore();
  
  const invoice = store.invoices.find(i => i.id === invoiceId);
  if (!invoice) return null;
  
  const reimbursement = store.reimbursements.find(r => r.invoiceIds.includes(invoiceId)) || null;
  const employee = store.employees.find(e => e.id === invoice.submitterId) || null;
  
  const issues: CheckIssue[] = [];
  
  const duplicateIssue = checkDuplicateInvoice(invoice, store.invoices);
  if (duplicateIssue) issues.push(duplicateIssue);
  
  const headerIssues = checkHeaderMatch(
    invoice, reimbursement, employee, store.departments, store.companyHeaders
  );
  issues.push(...headerIssues);
  
  const amountIssues = checkAmountMatch(
    invoice, reimbursement, store.reimbursements
  );
  issues.push(...amountIssues);
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const totalChecks = 4;
  const passCount = totalChecks - errorCount - warnCount;
  
  let result: CheckResult;
  if (errorCount === 0 && warnCount === 0) {
    result = 'auto_pass';
  } else if (errorCount > 0) {
    const hasCriticalError = issues.some(i => 
      i.type === 'header_mismatch' || i.type === 'tax_id_mismatch'
    );
    result = hasCriticalError ? 'needs_reissue' : 'manual_review';
  } else {
    result = 'correction_suggested';
  }
  
  const report: InvoiceCheckReport = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    reimbursementId: reimbursement?.id,
    reimbursementNumber: reimbursement?.formNumber,
    result,
    issues,
    passCount,
    warnCount,
    errorCount,
    checkedAt: new Date().toISOString()
  };
  
  const existingIndex = store.checkReports.findIndex(
    r => r.invoiceId === invoiceId
  );
  
  if (existingIndex >= 0) {
    store.checkReports[existingIndex] = report;
  } else {
    store.checkReports.push(report);
  }
  
  saveStore(store);
  
  recordAudit(
    'invoice',
    invoiceId,
    'CHECK_PERFORMED',
    operatorId,
    operatorName,
    { reason: `执行发票审核检查，结果: ${result}` }
  );
  
  return report;
}

export function checkAllInvoices(
  operatorId: string = 'system',
  operatorName: string = '系统自动'
): InvoiceCheckReport[] {
  const store = loadStore();
  const reports: InvoiceCheckReport[] = [];
  
  for (const invoice of store.invoices) {
    const report = checkInvoice(invoice.id, operatorId, operatorName);
    if (report) reports.push(report);
  }
  
  return reports;
}

export function getLatestCheckReport(invoiceId: string): InvoiceCheckReport | null {
  const store = loadStore();
  return store.checkReports.find(r => r.invoiceId === invoiceId) || null;
}

export function getAllCheckReports(): InvoiceCheckReport[] {
  const store = loadStore();
  return [...store.checkReports];
}
