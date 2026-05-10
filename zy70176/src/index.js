const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const invoiceService = require('./invoiceService');
const redemptionService = require('./redemptionService');
const taxService = require('./taxService');
const reportService = require('./reportService');

class APIServer {
    constructor(port = 3000) {
        this.port = port;
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    handleRequest(req, res) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const query = parsedUrl.query;

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const data = body ? JSON.parse(body) : {};

            if (req.method === 'GET' && pathname === '/api/invoices') {
                this.handleGetInvoices(res, query);
            } else if (req.method === 'GET' && pathname === '/api/invoices/:id') {
                this.handleGetInvoice(res, pathname.split('/')[4]);
            } else if (req.method === 'GET' && pathname.startsWith('/api/invoices/') && pathname.endsWith('/relationship')) {
                const invoiceId = pathname.split('/')[4];
                this.handleGetInvoiceRelationship(res, invoiceId);
            } else if (req.method === 'POST' && pathname === '/api/invoices') {
                this.handleCreateInvoice(res, data);
            } else if (req.method === 'POST' && pathname === '/api/invoices/link') {
                this.handleLinkInvoices(res, data);
            } else if (req.method === 'GET' && pathname === '/api/redemptions') {
                this.handleGetRedemptions(res, query);
            } else if (req.method === 'GET' && pathname.startsWith('/api/redemptions/')) {
                this.handleGetRedemption(res, pathname.split('/')[4]);
            } else if (req.method === 'POST' && pathname === '/api/redemptions') {
                this.handleCreateRedemption(res, data);
            } else if (req.method === 'POST' && pathname.startsWith('/api/redemptions/') && pathname.endsWith('/approve')) {
                this.handleApproveRedemption(res, pathname.split('/')[4], data);
            } else if (req.method === 'POST' && pathname.startsWith('/api/redemptions/') && pathname.endsWith('/reject')) {
                this.handleRejectRedemption(res, pathname.split('/')[4], data);
            } else if (req.method === 'POST' && pathname.startsWith('/api/redemptions/') && pathname.endsWith('/cancel')) {
                this.handleCancelRedemption(res, pathname.split('/')[4], data);
            } else if (req.method === 'POST' && pathname.startsWith('/api/redemptions/') && pathname.endsWith('/retry')) {
                this.handleRetryRedemption(res, pathname.split('/')[4], data);
            } else if (req.method === 'POST' && pathname === '/api/queue/process') {
                this.handleProcessQueue(res);
            } else if (req.method === 'GET' && pathname === '/api/queue/status') {
                this.handleGetQueueStatus(res);
            } else if (req.method === 'GET' && pathname === '/api/tax/receipts') {
                this.handleGetTaxReceipts(res, query);
            } else if (req.method === 'GET' && pathname.startsWith('/api/tax/receipts/')) {
                this.handleGetTaxReceipt(res, pathname.split('/')[5]);
            } else if (req.method === 'GET' && pathname === '/api/reports/daily') {
                this.handleDailyReport(res, query);
            } else if (req.method === 'GET' && pathname.startsWith('/api/reports/invoices/') && pathname.endsWith('/relationship')) {
                const invoiceId = pathname.split('/')[5];
                this.handleInvoiceRelationshipReport(res, invoiceId);
            } else if (req.method === 'GET' && pathname === '/api/health') {
                this.handleHealth(res);
            } else {
                this.handleNotFound(res, pathname);
            }
        });
    }

    sendResponse(res, statusCode, data) {
        res.writeHead(statusCode);
        res.end(JSON.stringify(data, null, 2));
    }

    handleGetInvoices(res, query) {
        const result = invoiceService.getAllInvoices();
        this.sendResponse(res, 200, { success: true, data: result });
    }

    handleGetInvoice(res, invoiceId) {
        const invoice = invoiceService.getInvoice(invoiceId);
        if (!invoice) {
            this.sendResponse(res, 404, { success: false, message: '发票不存在' });
            return;
        }
        this.sendResponse(res, 200, { success: true, data: invoice });
    }

    handleGetInvoiceRelationship(res, invoiceId) {
        const result = invoiceService.getInvoiceRelationship(invoiceId);
        const statusCode = result.success ? 200 : 404;
        this.sendResponse(res, statusCode, result);
    }

    handleCreateInvoice(res, data) {
        const invoice = invoiceService.createInvoice(data);
        this.sendResponse(res, 201, { 
            success: true, 
            message: '发票创建成功', 
            data: invoice 
        });
    }

    handleLinkInvoices(res, data) {
        const result = invoiceService.linkInvoices(data.blueInvoiceId, data.redInvoiceId, data.originalInvoiceId);
        const statusCode = result.success ? 200 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleGetRedemptions(res, query) {
        const result = redemptionService.getAllRedemptions();
        this.sendResponse(res, 200, result);
    }

    handleGetRedemption(res, redemptionId) {
        const result = redemptionService.getRedemption(redemptionId);
        const statusCode = result.success ? 200 : 404;
        this.sendResponse(res, statusCode, result);
    }

    handleCreateRedemption(res, data) {
        const result = redemptionService.createRedemptionRequest(data);
        const statusCode = result.success ? 201 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleApproveRedemption(res, redemptionId, data) {
        const result = redemptionService.approveRedemption(redemptionId, data.approver);
        const statusCode = result.success ? 200 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleRejectRedemption(res, redemptionId, data) {
        const result = redemptionService.rejectRedemption(redemptionId, data.reason, data.approver);
        const statusCode = result.success ? 200 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleCancelRedemption(res, redemptionId, data) {
        const result = redemptionService.cancelRedemption(redemptionId, data.operator, data.reason);
        const statusCode = result.success ? 200 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleRetryRedemption(res, redemptionId, data) {
        const result = redemptionService.retryRedemption(redemptionId, data.operator);
        const statusCode = result.success ? 200 : 400;
        this.sendResponse(res, statusCode, result);
    }

    handleProcessQueue(res) {
        const result = redemptionService.processQueue();
        const statusCode = result.success ? 200 : 500;
        this.sendResponse(res, statusCode, result);
    }

    handleGetQueueStatus(res) {
        const result = redemptionService.getQueueStatus();
        this.sendResponse(res, 200, result);
    }

    handleGetTaxReceipts(res, query) {
        const result = taxService.getAllTaxReceipts();
        this.sendResponse(res, 200, result);
    }

    handleGetTaxReceipt(res, redemptionId) {
        const result = taxService.getTaxReceiptByRedemption(redemptionId);
        const statusCode = result.success ? 200 : 404;
        this.sendResponse(res, statusCode, result);
    }

    handleDailyReport(res, query) {
        const result = reportService.generateDailyReport(query.date);
        this.sendResponse(res, 200, result);
    }

    handleInvoiceRelationshipReport(res, invoiceId) {
        const result = reportService.generateInvoiceRelationshipReport(invoiceId);
        const statusCode = result.success ? 200 : 404;
        this.sendResponse(res, statusCode, result);
    }

    handleHealth(res) {
        this.sendResponse(res, 200, { 
            success: true, 
            status: '服务正常运行', 
            timestamp: new Date().toISOString() 
        });
    }

    handleNotFound(res, pathname) {
        this.sendResponse(res, 404, { 
            success: false, 
            message: '接口不存在', 
            path: pathname 
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`\n========================================`);
            console.log(`  发票红冲预约 API 服务已启动`);
            console.log(`  服务地址: http://localhost:${this.port}`);
            console.log(`========================================`);
            console.log(`\n可用接口:`);
            console.log(`  GET  /api/health - 健康检查`);
            console.log(`  GET  /api/invoices - 获取所有发票`);
            console.log(`  POST /api/invoices - 创建发票`);
            console.log(`  GET  /api/invoices/:id - 获取发票详情`);
            console.log(`  GET  /api/invoices/:id/relationship - 获取发票关系`);
            console.log(`  POST /api/invoices/link - 关联发票`);
            console.log(`  POST /api/redemptions - 创建红冲申请`);
            console.log(`  GET  /api/redemptions/:id - 获取红冲申请详情`);
            console.log(`  POST /api/redemptions/:id/approve - 审批通过`);
            console.log(`  POST /api/redemptions/:id/reject - 审批拒绝`);
            console.log(`  POST /api/redemptions/:id/cancel - 撤销申请`);
            console.log(`  POST /api/redemptions/:id/retry - 手动重试`);
            console.log(`  POST /api/queue/process - 处理队列`);
            console.log(`  GET  /api/queue/status - 队列状态`);
            console.log(`  GET  /api/tax/receipts - 税控回执列表`);
            console.log(`  GET  /api/tax/receipts/:redemptionId - 按红冲申请查回执`);
            console.log(`  GET  /api/reports/daily - 日报表`);
            console.log(`  GET  /api/reports/invoices/:id/relationship - 发票关系报表`);
            console.log(`\n`);
        });
    }
}

const PORT = process.env.PORT || 3000;
const server = new APIServer(PORT);
server.start();
