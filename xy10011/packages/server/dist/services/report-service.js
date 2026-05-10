"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const bill_service_1 = require("./bill-service");
const group_service_1 = require("./group-service");
const event_store_1 = require("../event-store");
const database_1 = require("../database");
class ReportService {
    async generateReport(options) {
        switch (options.format) {
            case 'excel':
                return this.generateExcelReport(options);
            case 'pdf':
                return this.generatePDFReport(options);
            case 'markdown':
                return this.generateMarkdownReport(options);
            default:
                throw new Error(`Unsupported format: ${options.format}`);
        }
    }
    async generateExcelReport(options) {
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = 'Bill Split System';
        workbook.created = new Date();
        const data = await this.collectReportData(options);
        const summarySheet = workbook.addWorksheet('Summary');
        this.addSummarySheet(summarySheet, data);
        const billsSheet = workbook.addWorksheet('Bills');
        this.addBillsSheet(billsSheet, data.bills);
        if (options.includeAuditLog) {
            const auditSheet = workbook.addWorksheet('Audit Log');
            this.addAuditSheet(auditSheet, data.events);
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
    async generatePDFReport(options) {
        const doc = new pdfkit_1.default();
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => { });
        const data = await this.collectReportData(options);
        doc.fontSize(24).text('Bill Split Report', { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(16).text('Summary');
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`Group: ${data.group?.name || 'All Groups'}`);
        doc.text(`Date Range: ${this.formatDate(options.startDate)} - ${this.formatDate(options.endDate)}`);
        doc.text(`Total Bills: ${data.bills.length}`);
        doc.text(`Total Amount: ${this.calculateTotal(data.bills)} CNY`);
        if (data.group && options.includeDetails) {
            doc.moveDown(2);
            doc.fontSize(14).text('Balances');
            doc.moveDown();
            const balances = bill_service_1.billService.calculateBalances(data.group.id);
            balances.forEach((balance, userId) => {
                doc.text(`User ${userId}: ${balance > 0 ? '+' : ''}${balance.toFixed(2)} CNY`);
            });
        }
        doc.moveDown(2);
        doc.fontSize(14).text('Bills');
        doc.moveDown();
        data.bills.forEach((bill, index) => {
            doc.fontSize(12);
            doc.text(`${index + 1}. ${bill.title}`);
            doc.text(`   Amount: ${bill.amount} ${bill.currency}`);
            doc.text(`   Date: ${this.formatDate(bill.createdAt)}`);
            doc.moveDown(0.5);
        });
        if (options.includeAuditLog && data.events.length > 0) {
            doc.moveDown(2);
            doc.fontSize(14).text('Audit Log');
            doc.moveDown();
            data.events.slice(0, 50).forEach((event) => {
                doc.fontSize(10);
                doc.text(`${this.formatDate(event.timestamp)} - ${event.eventType}`);
                doc.text(`   By: ${event.userId}`);
                doc.moveDown(0.3);
            });
        }
        doc.end();
        return new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
        });
    }
    async generateMarkdownReport(options) {
        const data = await this.collectReportData(options);
        let md = '# Bill Split Report\n\n';
        md += `Generated on: ${new Date().toISOString()}\n\n`;
        md += '## Summary\n\n';
        md += `- **Group**: ${data.group?.name || 'All Groups'}\n`;
        md += `- **Date Range**: ${this.formatDate(options.startDate)} - ${this.formatDate(options.endDate)}\n`;
        md += `- **Total Bills**: ${data.bills.length}\n`;
        md += `- **Total Amount**: ${this.calculateTotal(data.bills)} CNY\n\n`;
        if (data.group && options.includeDetails) {
            md += '## Balances\n\n';
            const balances = bill_service_1.billService.calculateBalances(data.group.id);
            balances.forEach((balance, userId) => {
                md += `- **${userId}**: ${balance > 0 ? '+' : ''}${balance.toFixed(2)} CNY\n`;
            });
            md += '\n';
            const settlements = bill_service_1.billService.calculateSettlementSuggestions(balances);
            if (settlements.length > 0) {
                md += '### Settlement Suggestions\n\n';
                settlements.forEach((s) => {
                    md += `- ${s.from} → ${s.to}: ${s.amount.toFixed(2)} CNY\n`;
                });
                md += '\n';
            }
        }
        md += '## Bills\n\n';
        md += '| # | Title | Amount | Date |\n';
        md += '|---|-------|--------|------|\n';
        data.bills.forEach((bill, index) => {
            md += `| ${index + 1} | ${bill.title} | ${bill.amount} ${bill.currency} | ${this.formatDate(bill.createdAt)} |\n`;
        });
        md += '\n';
        if (options.includeDetails) {
            data.bills.forEach((bill) => {
                md += `### ${bill.title}\n\n`;
                md += `- **Description**: ${bill.description || 'N/A'}\n`;
                md += `- **Amount**: ${bill.amount} ${bill.currency}\n`;
                md += `- **Created by**: ${bill.createdBy}\n`;
                md += `- **Created at**: ${this.formatDate(bill.createdAt)}\n`;
                md += `- **Version**: ${bill.version}\n\n`;
                if (bill.tags && bill.tags.length > 0) {
                    md += `**Tags**: ${bill.tags.join(', ')}\n\n`;
                }
                md += '**Participants**:\n\n';
                bill.participants.forEach((p) => {
                    md += `- ${p.userId}: Paid ${p.paid}, Share ${p.share}`;
                    if (p.adjustedShare !== undefined) {
                        md += ` (Adjusted: ${p.adjustedShare})`;
                    }
                    md += '\n';
                });
                md += '\n';
            });
        }
        if (options.includeAuditLog && data.events.length > 0) {
            md += '## Audit Log\n\n';
            md += '| Timestamp | Event Type | User |\n';
            md += '|-----------|------------|------|\n';
            data.events.slice(0, 100).forEach((event) => {
                md += `| ${this.formatDate(event.timestamp)} | ${event.eventType} | ${event.userId} |\n`;
            });
        }
        return Buffer.from(md, 'utf-8');
    }
    async collectReportData(options) {
        const group = options.groupId ? group_service_1.groupService.getGroupById(options.groupId) : null;
        let bills = [];
        if (options.groupId) {
            bills = bill_service_1.billService.getBillsByGroup(options.groupId);
        }
        else {
            const db = (0, database_1.getDatabase)();
            const rows = db.prepare(`SELECT * FROM bills WHERE deleted = 0 ORDER BY created_at DESC`).all();
            bills = rows.map((row) => ({
                id: row.id,
                groupId: row.group_id,
                title: row.title,
                description: row.description || undefined,
                amount: row.amount,
                currency: row.currency,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                version: row.version,
                participants: JSON.parse(row.participants),
                tags: row.tags ? JSON.parse(row.tags) : undefined,
                deleted: row.deleted === 1,
            }));
        }
        if (options.startDate) {
            bills = bills.filter(b => b.createdAt >= options.startDate);
        }
        if (options.endDate) {
            bills = bills.filter(b => b.createdAt <= options.endDate);
        }
        let events = [];
        if (options.includeAuditLog) {
            if (options.startDate && options.endDate) {
                events = event_store_1.eventStore.getEventsByTimeRange(options.startDate, options.endDate);
            }
            else if (options.groupId) {
                events = event_store_1.eventStore.getEventsByAggregate(options.groupId);
            }
        }
        return { group, bills, events };
    }
    addSummarySheet(sheet, data) {
        sheet.columns = [
            { header: 'Item', key: 'item', width: 20 },
            { header: 'Value', key: 'value', width: 40 },
        ];
        sheet.addRow({ item: 'Report Generated', value: new Date().toISOString() });
        sheet.addRow({ item: 'Group', value: data.group?.name || 'All Groups' });
        sheet.addRow({ item: 'Total Bills', value: data.bills.length });
        sheet.addRow({ item: 'Total Amount', value: this.calculateTotal(data.bills) });
        sheet.getRow(1).font = { bold: true };
    }
    addBillsSheet(sheet, bills) {
        sheet.columns = [
            { header: '#', key: 'index', width: 5 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Currency', key: 'currency', width: 10 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Version', key: 'version', width: 10 },
        ];
        bills.forEach((bill, index) => {
            sheet.addRow({
                index: index + 1,
                title: bill.title,
                description: bill.description || '',
                amount: bill.amount,
                currency: bill.currency,
                createdAt: new Date(bill.createdAt).toISOString(),
                version: bill.version,
            });
        });
        sheet.getRow(1).font = { bold: true };
        sheet.getColumn('amount').numFmt = '#,##0.00';
    }
    addAuditSheet(sheet, events) {
        sheet.columns = [
            { header: 'Timestamp', key: 'timestamp', width: 20 },
            { header: 'Event Type', key: 'eventType', width: 20 },
            { header: 'User', key: 'userId', width: 40 },
            { header: 'Aggregate', key: 'aggregateId', width: 40 },
            { header: 'Version', key: 'version', width: 15 },
        ];
        events.forEach((event) => {
            sheet.addRow({
                timestamp: new Date(event.timestamp).toISOString(),
                eventType: event.eventType,
                userId: event.userId,
                aggregateId: event.aggregateId,
                version: `${event.previousVersion} → ${event.newVersion}`,
            });
        });
        sheet.getRow(1).font = { bold: true };
    }
    calculateTotal(bills) {
        return bills.reduce((sum, bill) => sum + bill.amount, 0);
    }
    formatDate(timestamp) {
        if (!timestamp)
            return 'N/A';
        return new Date(timestamp).toLocaleString();
    }
}
exports.reportService = new ReportService();
