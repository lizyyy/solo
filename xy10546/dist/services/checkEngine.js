"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInvoice = checkInvoice;
exports.checkAllInvoices = checkAllInvoices;
exports.getLatestCheckReport = getLatestCheckReport;
exports.getAllCheckReports = getAllCheckReports;
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
const auditService_1 = require("./auditService");
function normalizeName(name) {
    return name
        .replace(/[（(）)\s]/g, '')
        .replace(/股份有限公司|有限责任公司|有限公司|集团/gi, '')
        .toLowerCase();
}
function hammingDistance(s1, s2) {
    const len = Math.min(s1.length, s2.length);
    let dist = Math.abs(s1.length - s2.length);
    for (let i = 0; i < len; i++) {
        if (s1[i] !== s2[i])
            dist++;
    }
    return dist;
}
function findSimilarHeaders(invoiceHeader, companyHeaders, threshold = 3) {
    const normalizedInvoice = normalizeName(invoiceHeader);
    return companyHeaders.filter(h => {
        if (h.status !== 'active')
            return false;
        if (h.name === invoiceHeader)
            return false;
        const normalizedCompany = normalizeName(h.name);
        return hammingDistance(normalizedInvoice, normalizedCompany) <= threshold;
    });
}
function checkDuplicateInvoice(invoice, allInvoices) {
    const duplicates = allInvoices.filter(inv => inv.id !== invoice.id &&
        inv.invoiceNumber === invoice.invoiceNumber &&
        inv.invoiceCode === invoice.invoiceCode &&
        inv.status !== 'rejected');
    if (duplicates.length === 0)
        return null;
    return {
        id: (0, uuid_1.v4)(),
        type: 'duplicate_invoice',
        severity: 'error',
        title: '同一发票重复报销',
        description: `发票 ${invoice.invoiceNumber}(${invoice.invoiceCode}) 已被用于其他报销单报销`,
        suggestion: '请核实是否确实需要重复报销，如为误提交请撤销此发票',
        relatedEntities: duplicates.map(d => ({
            type: 'invoice',
            id: d.id,
            name: `发票号: ${d.invoiceNumber} - 提交人: ${d.submitterName}`
        }))
    };
}
function checkHeaderMatch(invoice, reimbursement, employee, departments, companyHeaders) {
    const issues = [];
    const expectedHeader = reimbursement?.expectedHeaderName ||
        (employee ? findExpectedHeader(employee, departments, companyHeaders) : null);
    const expectedTaxId = reimbursement?.expectedTaxId ||
        (employee ? findExpectedTaxId(employee, departments, companyHeaders) : null);
    if (expectedHeader && invoice.headerName !== expectedHeader) {
        const similar = findSimilarHeaders(invoice.headerName, companyHeaders);
        if (similar.length > 0) {
            issues.push({
                id: (0, uuid_1.v4)(),
                type: 'similar_header',
                severity: 'warning',
                title: '抬头近似但可能主体不同',
                description: `发票抬头"${invoice.headerName}"与预期抬头"${expectedHeader}"近似但存在差异`,
                suggestion: `可能是开票错误，建议核实是否应为以下公司：${similar.map(s => s.name).join('、')}`,
                affectedFields: ['headerName'],
                relatedEntities: similar.map(s => ({
                    type: 'company',
                    id: s.id,
                    name: s.name
                }))
            });
        }
        else {
            issues.push({
                id: (0, uuid_1.v4)(),
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
            id: (0, uuid_1.v4)(),
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
                id: (0, uuid_1.v4)(),
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
function checkAmountMatch(invoice, reimbursement, allReimbursements) {
    const issues = [];
    if (!reimbursement)
        return issues;
    if (invoice.totalAmount > reimbursement.totalAmount) {
        issues.push({
            id: (0, uuid_1.v4)(),
            type: 'amount_mismatch',
            severity: 'error',
            title: '发票金额大于报销金额',
            description: `发票金额 ¥${invoice.totalAmount.toFixed(2)} 大于报销单申请金额 ¥${reimbursement.totalAmount.toFixed(2)}`,
            suggestion: '请确认报销金额是否正确，发票金额不应大于报销金额',
            affectedFields: ['totalAmount']
        });
    }
    const otherReimbursements = allReimbursements.filter(r => r.id !== reimbursement.id &&
        r.invoiceIds.includes(invoice.id) &&
        r.status !== 'rejected');
    if (otherReimbursements.length > 0) {
        const totalClaimed = otherReimbursements.reduce((sum, r) => sum + r.totalAmount, 0);
        if (totalClaimed + reimbursement.totalAmount > invoice.totalAmount) {
            issues.push({
                id: (0, uuid_1.v4)(),
                type: 'amount_split',
                severity: 'warning',
                title: '金额拆分报销风险',
                description: `发票金额 ¥${invoice.totalAmount.toFixed(2)} 已被拆分到 ${otherReimbursements.length + 1} 个报销单中，累计金额可能超过发票总额`,
                suggestion: '金额拆分报销需核实业务真实性，请确认拆分是否合理',
                affectedFields: ['totalAmount'],
                relatedEntities: otherReimbursements.map(r => ({
                    type: 'reimbursement',
                    id: r.id,
                    name: `报销单: ${r.formNumber}`
                }))
            });
        }
    }
    return issues;
}
function findExpectedHeader(employee, departments, companyHeaders) {
    const department = departments.find(d => d.id === employee.departmentId);
    if (!department || department.allowedCompanyHeaders.length === 0)
        return null;
    const header = companyHeaders.find(h => h.id === department.allowedCompanyHeaders[0]);
    return header?.name || null;
}
function findExpectedTaxId(employee, departments, companyHeaders) {
    const department = departments.find(d => d.id === employee.departmentId);
    if (!department || department.allowedCompanyHeaders.length === 0)
        return null;
    const header = companyHeaders.find(h => h.id === department.allowedCompanyHeaders[0]);
    return header?.taxId || null;
}
function checkInvoice(invoiceId, operatorId = 'system', operatorName = '系统自动') {
    const store = (0, dataStore_1.loadStore)();
    const invoice = store.invoices.find(i => i.id === invoiceId);
    if (!invoice)
        return null;
    const reimbursement = store.reimbursements.find(r => r.invoiceIds.includes(invoiceId)) || null;
    const employee = store.employees.find(e => e.id === invoice.submitterId) || null;
    const issues = [];
    const duplicateIssue = checkDuplicateInvoice(invoice, store.invoices);
    if (duplicateIssue)
        issues.push(duplicateIssue);
    const headerIssues = checkHeaderMatch(invoice, reimbursement, employee, store.departments, store.companyHeaders);
    issues.push(...headerIssues);
    const amountIssues = checkAmountMatch(invoice, reimbursement, store.reimbursements);
    issues.push(...amountIssues);
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warnCount = issues.filter(i => i.severity === 'warning').length;
    const totalChecks = 4;
    const passCount = totalChecks - errorCount - warnCount;
    let result;
    if (errorCount === 0 && warnCount === 0) {
        result = 'auto_pass';
    }
    else if (errorCount > 0) {
        const hasCriticalError = issues.some(i => i.type === 'header_mismatch' || i.type === 'tax_id_mismatch');
        result = hasCriticalError ? 'needs_reissue' : 'manual_review';
    }
    else {
        result = 'correction_suggested';
    }
    const report = {
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
    const existingIndex = store.checkReports.findIndex(r => r.invoiceId === invoiceId);
    if (existingIndex >= 0) {
        store.checkReports[existingIndex] = report;
    }
    else {
        store.checkReports.push(report);
    }
    (0, dataStore_1.saveStore)(store);
    (0, auditService_1.recordAudit)('invoice', invoiceId, 'CHECK_PERFORMED', operatorId, operatorName, { reason: `执行发票审核检查，结果: ${result}` });
    return report;
}
function checkAllInvoices(operatorId = 'system', operatorName = '系统自动') {
    const store = (0, dataStore_1.loadStore)();
    const reports = [];
    for (const invoice of store.invoices) {
        const report = checkInvoice(invoice.id, operatorId, operatorName);
        if (report)
            reports.push(report);
    }
    return reports;
}
function getLatestCheckReport(invoiceId) {
    const store = (0, dataStore_1.loadStore)();
    return store.checkReports.find(r => r.invoiceId === invoiceId) || null;
}
function getAllCheckReports() {
    const store = (0, dataStore_1.loadStore)();
    return [...store.checkReports];
}
