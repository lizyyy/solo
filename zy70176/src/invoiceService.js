const store = require('./dataStore');

class InvoiceService {
    createInvoice(data) {
        const invoice = {
            id: this.generateId('INV'),
            invoiceNumber: data.invoiceNumber || this.generateInvoiceNumber(),
            invoiceType: data.invoiceType,
            amount: data.amount,
            taxAmount: data.taxAmount,
            totalAmount: data.totalAmount,
            customerName: data.customerName,
            status: '正常',
            createdAt: new Date().toISOString(),
            relatedInvoices: [],
            isOriginal: data.isOriginal !== false,
            originalInvoiceId: data.originalInvoiceId || null,
            redemptionStatus: '未红冲'
        };
        return store.addInvoice(invoice);
    }

    getInvoice(invoiceId) {
        return store.getInvoiceById(invoiceId);
    }

    getInvoiceByNumber(invoiceNumber) {
        return store.getInvoiceByNumber(invoiceNumber);
    }

    getAllInvoices() {
        return store.getInvoices();
    }

    getInvoiceRelationship(invoiceId) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            return { success: false, message: '发票不存在' };
        }

        const allInvoices = store.getInvoices();
        const relationship = {
            currentInvoice: invoice,
            originalInvoice: null,
            relatedBlueInvoices: [],
            relatedRedInvoices: []
        };

        if (invoice.originalInvoiceId) {
            relationship.originalInvoice = allInvoices.find(inv => inv.id === invoice.originalInvoiceId);
        }

        allInvoices.forEach(inv => {
            if (inv.originalInvoiceId === invoiceId || invoice.originalInvoiceId === inv.id) {
                if (inv.invoiceType === '蓝票' && inv.id !== invoiceId) {
                    relationship.relatedBlueInvoices.push(inv);
                }
                if (inv.invoiceType === '红票' && inv.id !== invoiceId) {
                    relationship.relatedRedInvoices.push(inv);
                }
            }
        });

        return { success: true, data: relationship };
    }

    updateInvoice(invoice) {
        return store.updateInvoice(invoice);
    }

    linkInvoices(blueInvoiceId, redInvoiceId, originalInvoiceId) {
        const blueInv = this.getInvoice(blueInvoiceId);
        const redInv = this.getInvoice(redInvoiceId);

        if (!blueInv || !redInv) {
            return { success: false, message: '发票不存在' };
        }

        if (blueInv.invoiceType !== '蓝票') {
            return { success: false, message: '蓝票类型不正确' };
        }

        if (redInv.invoiceType !== '红票') {
            return { success: false, message: '红票类型不正确' };
        }

        if (!blueInv.relatedInvoices.includes(redInvoiceId)) {
            blueInv.relatedInvoices.push(redInvoiceId);
        }
        if (!redInv.relatedInvoices.includes(blueInvoiceId)) {
            redInv.relatedInvoices.push(blueInvoiceId);
        }

        if (originalInvoiceId) {
            blueInv.originalInvoiceId = originalInvoiceId;
            redInv.originalInvoiceId = originalInvoiceId;
        }

        this.updateInvoice(blueInv);
        this.updateInvoice(redInv);

        return { success: true, message: '发票关系已建立' };
    }

    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    generateInvoiceNumber() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randomLetter = letters[Math.floor(Math.random() * 26)];
        const randomNum = Math.floor(10000000 + Math.random() * 90000000);
        return `${randomLetter}${randomNum}`;
    }
}

module.exports = new InvoiceService();
