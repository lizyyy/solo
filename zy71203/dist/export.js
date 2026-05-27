"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSVExport = generateCSVExport;
exports.generateJSONExport = generateJSONExport;
exports.generateExportFilename = generateExportFilename;
const csv_writer_1 = require("csv-writer");
const currency_1 = require("./currency");
function generateCSVExport(data) {
    const { invoice, payments, receipts, profitReport } = data;
    const invoiceRecords = [
        {
            项目: '发票号码',
            内容: invoice.invoiceNumber,
        },
        {
            项目: '发票日期',
            内容: invoice.invoiceDate,
        },
        {
            项目: '发票金额',
            内容: (0, currency_1.formatCurrency)(invoice.invoiceAmount, invoice.invoiceCurrency),
        },
        {
            项目: '发票币种',
            内容: invoice.invoiceCurrency,
        },
        {
            项目: '贴现利率',
            内容: `${invoice.discountRate}%`,
        },
        {
            项目: '贴现日期',
            内容: invoice.discountDate,
        },
        {
            项目: '贴现天数',
            内容: `${invoice.discountDays}天`,
        },
        {
            项目: '当前状态',
            内容: invoice.discountStatus,
        },
        {
            项目: '已贴现金额',
            内容: (0, currency_1.formatCurrency)(invoice.totalDiscountedAmount, invoice.invoiceCurrency),
        },
        {
            项目: '剩余未贴现金额',
            内容: (0, currency_1.formatCurrency)(invoice.remainingUndiscountedAmount, invoice.invoiceCurrency),
        },
        {
            项目: '发票兑人民币汇率',
            内容: invoice.exchangeRateToCNY
                ? `${invoice.exchangeRateToCNY.rate} (${invoice.exchangeRateToCNY.rateDate})`
                : '未提供',
        },
        {
            项目: '回款兑人民币汇率',
            内容: invoice.exchangeRatePaymentToCNY
                ? `${invoice.exchangeRatePaymentToCNY.rate} (${invoice.exchangeRatePaymentToCNY.rateDate})`
                : '未提供',
        },
        {
            项目: '缺少字段',
            内容: invoice.missingFields.length > 0 ? invoice.missingFields.join(', ') : '无',
        },
    ];
    const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
        header: [
            { id: '项目', title: '项目' },
            { id: '内容', title: '内容' },
        ],
    });
    let csv = '\uFEFF';
    csv += '=== 发票贴现基本信息 ===\n';
    csv += csvStringifier.getHeaderString();
    csv += csvStringifier.stringifyRecords(invoiceRecords);
    if (invoice.partialDiscountDetails.length > 0) {
        csv += '\n=== 部分贴现明细 ===\n';
        const partialCsvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: '贴现日期', title: '贴现日期' },
                { id: '贴现金额', title: '贴现金额' },
                { id: '贴现利率', title: '贴现利率' },
                { id: '利息金额', title: '利息金额' },
                { id: '利息币种', title: '利息币种' },
            ],
        });
        csv += partialCsvStringifier.getHeaderString();
        csv += partialCsvStringifier.stringifyRecords(invoice.partialDiscountDetails.map(d => ({
            贴现日期: d.discountDate,
            贴现金额: (0, currency_1.formatCurrency)(d.discountAmount, invoice.invoiceCurrency),
            贴现利率: `${d.discountRate}%`,
            利息金额: (0, currency_1.formatCurrency)(d.interestAmount, d.interestCurrency),
            利息币种: d.interestCurrency,
        })));
    }
    if (payments.length > 0) {
        csv += '\n=== 回款流水 ===\n';
        const paymentCsvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: '回款日期', title: '回款日期' },
                { id: '回款金额', title: '回款金额' },
                { id: '回款币种', title: '回款币种' },
                { id: '是否匹配', title: '是否匹配' },
                { id: '已匹配金额', title: '已匹配金额' },
                { id: '银行回执ID', title: '银行回执ID' },
            ],
        });
        csv += paymentCsvStringifier.getHeaderString();
        csv += paymentCsvStringifier.stringifyRecords(payments.map(p => ({
            回款日期: p.paymentDate,
            回款金额: (0, currency_1.formatCurrency)(p.paymentAmount, p.paymentCurrency),
            回款币种: p.paymentCurrency,
            是否匹配: p.matched ? '是' : '否',
            已匹配金额: (0, currency_1.formatCurrency)(p.matchedAmount, p.paymentCurrency),
            银行回执ID: p.bankReceiptId || '无',
        })));
    }
    if (receipts.length > 0) {
        csv += '\n=== 银行回执 ===\n';
        const receiptCsvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: '回执号码', title: '回执号码' },
                { id: '回执日期', title: '回执日期' },
                { id: '金额', title: '金额' },
                { id: '币种', title: '币种' },
                { id: '是否重复', title: '是否重复' },
                { id: '导入时间', title: '导入时间' },
            ],
        });
        csv += receiptCsvStringifier.getHeaderString();
        csv += receiptCsvStringifier.stringifyRecords(receipts.map(r => ({
            回执号码: r.receiptNumber,
            回执日期: r.receiptDate,
            金额: (0, currency_1.formatCurrency)(r.amount, r.currency),
            币种: r.currency,
            是否重复: r.isDuplicate ? '是' : '否',
            导入时间: r.importedAt,
        })));
    }
    if (profitReport) {
        csv += '\n=== 收益报告 ===\n';
        const reportCsvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: '项目', title: '项目' },
                { id: '金额(CNY)', title: '金额(CNY)' },
            ],
        });
        csv += reportCsvStringifier.getHeaderString();
        csv += reportCsvStringifier.stringifyRecords([
            { 项目: '发票金额(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.invoiceAmountCNY, 'CNY') },
            { 项目: '累计回款(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.totalPaymentReceivedCNY, 'CNY') },
            { 项目: '贴现利息(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.totalDiscountInterestCNY, 'CNY') },
            { 项目: '银行手续费(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.bankFeesCNY, 'CNY') },
            { 项目: '汇兑损益(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.exchangeGainLossCNY, 'CNY') },
            { 项目: '净利润(CNY)', '金额(CNY)': (0, currency_1.formatCurrency)(profitReport.netProfitCNY, 'CNY') },
        ]);
    }
    if (invoice.revisionHistory.length > 0) {
        csv += '\n=== 修改历史 ===\n';
        const revisionCsvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: '修改日期', title: '修改日期' },
                { id: '修改字段', title: '修改字段' },
                { id: '原值', title: '原值' },
                { id: '新值', title: '新值' },
                { id: '修改原因', title: '修改原因' },
                { id: '操作人', title: '操作人' },
            ],
        });
        csv += revisionCsvStringifier.getHeaderString();
        csv += revisionCsvStringifier.stringifyRecords(invoice.revisionHistory.map(r => ({
            修改日期: r.revisionDate,
            修改字段: r.fieldName,
            原值: String(r.oldValue),
            新值: String(r.newValue),
            修改原因: r.reason,
            操作人: r.operator,
        })));
    }
    csv += `\n=== 导出时间 ===\n`;
    csv += `项目,内容\n`;
    csv += `导出时间,${new Date().toLocaleString('zh-CN')}\n`;
    return csv;
}
function generateJSONExport(data) {
    return JSON.stringify({
        exportTime: new Date().toISOString(),
        exportVersion: '1.0',
        ...data,
    }, null, 2);
}
function generateExportFilename(invoiceNumber, format) {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `invoice_discount_${safeInvoiceNumber}_${dateStr}.${format}`;
}
