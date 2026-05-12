"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmdInit = cmdInit;
exports.cmdImportSample = cmdImportSample;
exports.cmdImport = cmdImport;
exports.cmdCheck = cmdCheck;
exports.cmdDetail = cmdDetail;
exports.cmdReport = cmdReport;
exports.cmdStatus = cmdStatus;
exports.cmdList = cmdList;
const cli_table3_1 = __importDefault(require("cli-table3"));
const dataStore_1 = require("../store/dataStore");
const importService_1 = require("../services/importService");
const checkEngine_1 = require("../services/checkEngine");
const auditService_1 = require("../services/auditService");
const utils_1 = require("./utils");
const SYSTEM_OPERATOR = { id: 'system', name: '系统管理员' };
function cmdInit(sample = false) {
    if ((0, dataStore_1.isInitialized)()) {
        (0, utils_1.printWarning)('项目已初始化，数据目录已存在');
        (0, utils_1.printInfo)(`数据目录: ${(0, dataStore_1.getDataDir)()}`);
        return;
    }
    (0, dataStore_1.initializeStore)();
    (0, utils_1.printSuccess)('项目初始化完成');
    if (sample) {
        cmdImportSample();
    }
}
function cmdImportSample() {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    (0, utils_1.printInfo)('正在导入样例数据...');
    const counts = (0, importService_1.importSampleData)(SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
    console.log('\n' + utils_1.colors.bold('导入完成:'));
    console.log(`  公司抬头: ${counts.headers} 条`);
    console.log(`  部门: ${counts.departments} 条`);
    console.log(`  员工: ${counts.employees} 条`);
    console.log(`  发票: ${counts.invoices} 条 (餐饮、差旅、采购)`);
    console.log(`  报销单: ${counts.reimbursements} 条`);
    (0, utils_1.printSuccess)('样例数据导入完成');
    (0, utils_1.printInfo)('样例数据包含多种场景：自动通过、抬头近似、税号错误、重复报销、跨集团、金额拆分');
}
function cmdImport(type, filePath) {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    try {
        let count = 0;
        switch (type) {
            case 'invoices': {
                const data = (0, importService_1.loadJsonFile)(filePath);
                count = (0, importService_1.importInvoices)(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
                break;
            }
            case 'reimbursements': {
                const data = (0, importService_1.loadJsonFile)(filePath);
                count = (0, importService_1.importReimbursements)(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
                break;
            }
            case 'headers': {
                const data = (0, importService_1.loadJsonFile)(filePath);
                count = (0, importService_1.importCompanyHeaders)(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
                break;
            }
            case 'departments': {
                const data = (0, importService_1.loadJsonFile)(filePath);
                count = (0, importService_1.importDepartments)(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
                break;
            }
            case 'employees': {
                const data = (0, importService_1.loadJsonFile)(filePath);
                count = (0, importService_1.importEmployees)(data, SYSTEM_OPERATOR.id, SYSTEM_OPERATOR.name);
                break;
            }
        }
        (0, utils_1.printSuccess)(`成功导入 ${count} 条 ${type} 数据`);
    }
    catch (err) {
        (0, utils_1.printError)(`导入失败: ${err.message}`);
    }
}
function cmdCheck(invoiceId) {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    const store = (0, dataStore_1.loadStore)();
    if (store.invoices.length === 0) {
        (0, utils_1.printError)('没有发票数据，请先执行 import 命令导入数据');
        return;
    }
    let reports = [];
    if (invoiceId) {
        const report = (0, checkEngine_1.checkInvoice)(invoiceId);
        if (!report) {
            (0, utils_1.printError)(`未找到发票: ${invoiceId}`);
            return;
        }
        reports = [report];
    }
    else {
        (0, utils_1.printInfo)('正在检查所有发票...');
        reports = (0, checkEngine_1.checkAllInvoices)();
    }
    const table = (0, utils_1.createSummaryTable)(reports);
    (0, utils_1.printSection)('检查结果汇总', table.toString());
    const passCount = reports.filter(r => r.result === 'auto_pass').length;
    const reissueCount = reports.filter(r => r.result === 'needs_reissue').length;
    const reviewCount = reports.filter(r => r.result === 'manual_review').length;
    const correctionCount = reports.filter(r => r.result === 'correction_suggested').length;
    console.log('\n' + utils_1.colors.bold('结果统计:'));
    console.log(`  ${utils_1.colors.success('✓ 自动通过')}: ${passCount}`);
    console.log(`  ${utils_1.colors.error('✗ 需补开')}: ${reissueCount}`);
    console.log(`  ${utils_1.colors.warning('⚠ 人工复核')}: ${reviewCount}`);
    console.log(`  ${utils_1.colors.info('ℹ 纠错建议')}: ${correctionCount}`);
    console.log(`  ${utils_1.colors.muted('总计')}: ${reports.length}`);
    if (reports.length > 0 && reports.some(r => r.errorCount > 0 || r.warnCount > 0)) {
        (0, utils_1.printInfo)('使用 detail 命令查看具体发票的详细问题和建议');
    }
}
function cmdDetail(id, showHistory = false) {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    const store = (0, dataStore_1.loadStore)();
    const invoice = store.invoices.find(i => i.id === id || i.invoiceNumber === id);
    if (!invoice) {
        (0, utils_1.printError)(`未找到发票: ${id}`);
        return;
    }
    const reimbursement = store.reimbursements.find(r => r.invoiceIds.includes(invoice.id));
    const report = (0, checkEngine_1.getLatestCheckReport)(invoice.id);
    const typeMap = {
        food: '餐饮',
        travel: '差旅',
        purchase: '采购',
        other: '其他'
    };
    const invTable = new cli_table3_1.default({
        head: [utils_1.colors.bold('项目'), utils_1.colors.bold('内容')],
        colWidths: [18, 55]
    });
    invTable.push(['发票号', invoice.invoiceNumber], ['发票代码', invoice.invoiceCode], ['发票类型', typeMap[invoice.invoiceType] || invoice.invoiceType], ['开票日期', invoice.invoiceDate], ['抬头名称', invoice.headerName], ['税号', invoice.taxId], ['金额(不含税)', (0, utils_1.formatAmount)(invoice.amount)], ['税额', (0, utils_1.formatAmount)(invoice.taxAmount)], ['总金额', (0, utils_1.formatAmount)(invoice.totalAmount)], ['销售方', invoice.sellerName], ['提交人', invoice.submitterName], ['当前状态', invoice.status.toUpperCase()], ['最后更新', (0, utils_1.formatDate)(invoice.updatedAt)]);
    (0, utils_1.printSection)('发票详情', invTable.toString());
    if (reimbursement) {
        const reimTable = new cli_table3_1.default({
            head: [utils_1.colors.bold('项目'), utils_1.colors.bold('内容')],
            colWidths: [18, 55]
        });
        reimTable.push(['报销单号', reimbursement.formNumber], ['申请人', reimbursement.applicantName], ['部门', reimbursement.departmentName], ['预期抬头', reimbursement.expectedHeaderName], ['预期税号', reimbursement.expectedTaxId], ['申请金额', (0, utils_1.formatAmount)(reimbursement.totalAmount)], ['描述', reimbursement.description], ['状态', reimbursement.status.toUpperCase()]);
        (0, utils_1.printSection)('关联报销单', reimTable.toString());
    }
    if (report) {
        (0, utils_1.printSection)('审核结果', `  最终判定: ${(0, utils_1.formatResult)(report.result)}`);
        if (report.issues.length > 0) {
            const issuesTable = (0, utils_1.createIssuesTable)(report.issues);
            (0, utils_1.printSection)('发现的问题', issuesTable.toString());
            const relatedIssues = report.issues.filter(i => i.relatedEntities && i.relatedEntities.length > 0);
            if (relatedIssues.length > 0) {
                console.log('\n' + utils_1.colors.bold('关联实体:'));
                for (const issue of relatedIssues) {
                    console.log(`  - ${issue.title}:`);
                    for (const entity of issue.relatedEntities) {
                        console.log(`    ${entity.type === 'invoice' ? '📄' : entity.type === 'reimbursement' ? '📋' : '🏢'} ${entity.name}`);
                    }
                }
            }
        }
        else {
            (0, utils_1.printSuccess)('未发现问题，所有检查项通过');
        }
    }
    else {
        (0, utils_1.printWarning)('该发票尚未执行检查，请先执行 check 命令');
    }
    if (showHistory) {
        const history = (0, auditService_1.getAuditHistory)('invoice', invoice.id);
        if (history.length > 0) {
            const histTable = new cli_table3_1.default({
                head: [
                    utils_1.colors.bold('时间'),
                    utils_1.colors.bold('操作'),
                    utils_1.colors.bold('操作者'),
                    utils_1.colors.bold('差异字段'),
                    utils_1.colors.bold('原因')
                ],
                colWidths: [20, 22, 12, 20, 30]
            });
            for (const record of history) {
                const diffFields = record.diff ? record.diff.map(d => d.field).join(', ') : '-';
                histTable.push([
                    (0, utils_1.formatDate)(record.timestamp),
                    record.action,
                    record.operatorName,
                    diffFields,
                    record.reason || '-'
                ]);
                if (record.diff && record.diff.length > 0) {
                    for (const d of record.diff) {
                        console.log(`    ↳ ${d.field}: "${utils_1.colors.muted(String(d.before))}" → "${utils_1.colors.highlight(String(d.after))}"`);
                    }
                }
            }
            (0, utils_1.printSection)('操作历史记录', histTable.toString());
        }
        else {
            (0, utils_1.printInfo)('暂无操作历史记录');
        }
    }
}
function cmdReport(filter) {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    const reports = (0, checkEngine_1.getAllCheckReports)();
    if (reports.length === 0) {
        (0, utils_1.printWarning)('暂无检查报告，请先执行 check 命令');
        return;
    }
    let filteredReports = reports;
    if (filter) {
        const validFilters = ['auto_pass', 'needs_reissue', 'manual_review', 'correction_suggested'];
        if (validFilters.includes(filter)) {
            filteredReports = reports.filter(r => r.result === filter);
            (0, utils_1.printInfo)(`筛选结果: ${(0, utils_1.formatResult)(filter)}`);
        }
    }
    const summaryTable = (0, utils_1.createSummaryTable)(filteredReports);
    (0, utils_1.printSection)('检查报告汇总', summaryTable.toString());
    const totalByType = {
        auto_pass: 0, needs_reissue: 0, manual_review: 0, correction_suggested: 0
    };
    for (const r of filteredReports) {
        totalByType[r.result]++;
    }
    const summary = new cli_table3_1.default({
        head: [utils_1.colors.bold('结果类型'), utils_1.colors.bold('数量'), utils_1.colors.bold('占比')]
    });
    const total = filteredReports.length;
    const typeLabels = {
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
    (0, utils_1.printSection)('结果分类统计', summary.toString());
    const allIssues = filteredReports.flatMap(r => r.issues);
    if (allIssues.length > 0) {
        const issueByType = {};
        for (const issue of allIssues) {
            issueByType[issue.type] = (issueByType[issue.type] || 0) + 1;
        }
        const typeNameMap = {
            duplicate_invoice: '重复报销',
            header_mismatch: '抬头不匹配',
            similar_header: '抬头近似',
            cross_company_header: '跨集团抬头',
            amount_mismatch: '金额不匹配',
            amount_split: '金额拆分',
            tax_id_mismatch: '税号不匹配',
            other: '其他'
        };
        const issueTable = new cli_table3_1.default({
            head: [utils_1.colors.bold('问题类型'), utils_1.colors.bold('出现次数')]
        });
        for (const [type, count] of Object.entries(issueByType)) {
            issueTable.push([typeNameMap[type] || type, String(count)]);
        }
        (0, utils_1.printSection)('问题类型分布', issueTable.toString());
    }
    const audits = (0, auditService_1.getAllAuditRecords)();
    if (audits.length > 0) {
        const recent = audits.slice(0, 5);
        const auditTable = new cli_table3_1.default({
            head: [
                utils_1.colors.bold('时间'),
                utils_1.colors.bold('类型'),
                utils_1.colors.bold('操作'),
                utils_1.colors.bold('操作者')
            ],
            colWidths: [20, 14, 22, 14]
        });
        for (const a of recent) {
            auditTable.push([
                (0, utils_1.formatDate)(a.timestamp),
                a.targetType,
                a.action,
                a.operatorName
            ]);
        }
        (0, utils_1.printSection)('最近操作记录', auditTable.toString());
    }
}
function cmdStatus() {
    const store = (0, dataStore_1.loadStore)();
    console.log('\n' + utils_1.colors.bold('=== 系统状态 ==='));
    console.log(`数据目录: ${(0, dataStore_1.getDataDir)()}`);
    console.log(`已初始化: ${store.initialized ? utils_1.colors.success('是') : utils_1.colors.error('否')}`);
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
function cmdList(type) {
    if (!(0, dataStore_1.isInitialized)()) {
        (0, utils_1.printError)('项目未初始化，请先执行 init 命令');
        return;
    }
    const store = (0, dataStore_1.loadStore)();
    if (type === 'invoices') {
        if (store.invoices.length === 0) {
            (0, utils_1.printWarning)('暂无发票数据');
            return;
        }
        const table = new cli_table3_1.default({
            head: [
                utils_1.colors.bold('ID'),
                utils_1.colors.bold('发票号'),
                utils_1.colors.bold('抬头'),
                utils_1.colors.bold('金额'),
                utils_1.colors.bold('类型'),
                utils_1.colors.bold('状态')
            ],
            colWidths: [10, 16, 30, 12, 8, 14]
        });
        for (const inv of store.invoices) {
            table.push([
                inv.id.substring(0, 8),
                inv.invoiceNumber,
                inv.headerName.substring(0, 28),
                (0, utils_1.formatAmount)(inv.totalAmount),
                inv.invoiceType,
                inv.status
            ]);
        }
        (0, utils_1.printSection)('发票列表', table.toString());
    }
    else if (type === 'reimbursements') {
        if (store.reimbursements.length === 0) {
            (0, utils_1.printWarning)('暂无报销单数据');
            return;
        }
        const table = new cli_table3_1.default({
            head: [
                utils_1.colors.bold('ID'),
                utils_1.colors.bold('单号'),
                utils_1.colors.bold('申请人'),
                utils_1.colors.bold('预期抬头'),
                utils_1.colors.bold('金额'),
                utils_1.colors.bold('状态')
            ],
            colWidths: [10, 14, 10, 30, 12, 14]
        });
        for (const reim of store.reimbursements) {
            table.push([
                reim.id.substring(0, 8),
                reim.formNumber,
                reim.applicantName,
                reim.expectedHeaderName.substring(0, 28),
                (0, utils_1.formatAmount)(reim.totalAmount),
                reim.status
            ]);
        }
        (0, utils_1.printSection)('报销单列表', table.toString());
    }
    else if (type === 'headers') {
        if (store.companyHeaders.length === 0) {
            (0, utils_1.printWarning)('暂无公司抬头数据');
            return;
        }
        const table = new cli_table3_1.default({
            head: [
                utils_1.colors.bold('ID'),
                utils_1.colors.bold('公司名称'),
                utils_1.colors.bold('税号'),
                utils_1.colors.bold('集团'),
                utils_1.colors.bold('状态')
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
        (0, utils_1.printSection)('公司抬头库', table.toString());
    }
}
