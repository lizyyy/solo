const store = require('./dataStore');
const invoiceService = require('./invoiceService');

class TaxService {
    processRedemption(redemption) {
        const originalInvoice = invoiceService.getInvoice(redemption.originalInvoiceId);
        if (!originalInvoice) {
            return { success: false, message: '原发票不存在' };
        }

        const processingResult = this.simulateTaxProcessing(redemption);
        if (!processingResult.success) {
            return processingResult;
        }

        const redInvoice = invoiceService.createInvoice({
            invoiceType: '红票',
            amount: -originalInvoice.amount,
            taxAmount: -originalInvoice.taxAmount,
            totalAmount: -originalInvoice.totalAmount,
            customerName: originalInvoice.customerName,
            isOriginal: false,
            originalInvoiceId: originalInvoice.id
        });

        const taxReceipt = {
            id: this.generateId('TAX'),
            redemptionId: redemption.id,
            originalInvoiceId: originalInvoice.id,
            redInvoiceId: redInvoice.id,
            receiptNumber: this.generateReceiptNumber(),
            status: '成功',
            processedAt: new Date().toISOString(),
            taxAuthority: '模拟税局系统',
            responseCode: '0000',
            responseMessage: '红冲成功'
        };
        store.addTaxReceipt(taxReceipt);

        return {
            success: true,
            data: {
                redInvoiceId: redInvoice.id,
                redInvoiceNumber: redInvoice.invoiceNumber,
                taxReceiptId: taxReceipt.id,
                taxReceiptNumber: taxReceipt.receiptNumber
            }
        };
    }

    simulateTaxProcessing(redemption) {
        const failureChance = Math.random();
        
        if (failureChance < 0.1) {
            return { success: false, message: '税控系统连接超时，请稍后重试' };
        }
        
        if (failureChance < 0.15) {
            return { success: false, message: '税控系统返回：发票状态校验失败，请检查原发票信息' };
        }
        
        if (failureChance < 0.2) {
            return { success: false, message: '税控系统返回：红冲金额超过原发票金额，请调整红冲金额' };
        }

        return { success: true };
    }

    getTaxReceiptByRedemption(redemptionId) {
        const receipt = store.getTaxReceiptByRedemptionId(redemptionId);
        if (!receipt) {
            return { success: false, message: '税控回执不存在' };
        }
        return { success: true, data: receipt };
    }

    getAllTaxReceipts() {
        return { success: true, data: store.getTaxReceipts() };
    }

    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    generateReceiptNumber() {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        return `TAX-${datePart}-${randomNum}`;
    }
}

module.exports = new TaxService();
