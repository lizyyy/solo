const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const REDEMPTIONS_FILE = path.join(DATA_DIR, 'redemptions.json');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const TAX_RECEIPTS_FILE = path.join(DATA_DIR, 'taxReceipts.json');

class DataStore {
    constructor() {
        this.ensureDataDir();
    }

    ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        [INVOICES_FILE, REDEMPTIONS_FILE, QUEUE_FILE, TAX_RECEIPTS_FILE].forEach(file => {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify([], null, 2));
            }
        });
    }

    readFile(file) {
        const content = fs.readFileSync(file, 'utf-8');
        return JSON.parse(content);
    }

    writeFile(file, data) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    getInvoices() {
        return this.readFile(INVOICES_FILE);
    }

    getInvoiceById(invoiceId) {
        const invoices = this.readFile(INVOICES_FILE);
        return invoices.find(inv => inv.id === invoiceId);
    }

    getInvoiceByNumber(invoiceNumber) {
        const invoices = this.readFile(INVOICES_FILE);
        return invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    }

    addInvoice(invoice) {
        const invoices = this.readFile(INVOICES_FILE);
        invoices.push(invoice);
        this.writeFile(INVOICES_FILE, invoices);
        return invoice;
    }

    updateInvoice(invoice) {
        const invoices = this.readFile(INVOICES_FILE);
        const index = invoices.findIndex(inv => inv.id === invoice.id);
        if (index !== -1) {
            invoices[index] = invoice;
            this.writeFile(INVOICES_FILE, invoices);
            return invoice;
        }
        return null;
    }

    getRedemptions() {
        return this.readFile(REDEMPTIONS_FILE);
    }

    getRedemptionById(redemptionId) {
        const redemptions = this.readFile(REDEMPTIONS_FILE);
        return redemptions.find(red => red.id === redemptionId);
    }

    getRedemptionByOriginalInvoice(invoiceId) {
        const redemptions = this.readFile(REDEMPTIONS_FILE);
        return redemptions.filter(red => red.originalInvoiceId === invoiceId);
    }

    addRedemption(redemption) {
        const redemptions = this.readFile(REDEMPTIONS_FILE);
        redemptions.push(redemption);
        this.writeFile(REDEMPTIONS_FILE, redemptions);
        return redemption;
    }

    updateRedemption(redemption) {
        const redemptions = this.readFile(REDEMPTIONS_FILE);
        const index = redemptions.findIndex(red => red.id === redemption.id);
        if (index !== -1) {
            redemptions[index] = redemption;
            this.writeFile(REDEMPTIONS_FILE, redemptions);
            return redemption;
        }
        return null;
    }

    getQueue() {
        return this.readFile(QUEUE_FILE);
    }

    addQueueItem(item) {
        const queue = this.readFile(QUEUE_FILE);
        queue.push(item);
        this.writeFile(QUEUE_FILE, queue);
        return item;
    }

    updateQueueItem(item) {
        const queue = this.readFile(QUEUE_FILE);
        const index = queue.findIndex(q => q.id === item.id);
        if (index !== -1) {
            queue[index] = item;
            this.writeFile(QUEUE_FILE, queue);
            return item;
        }
        return null;
    }

    getQueueItemsByStatus(status) {
        const queue = this.readFile(QUEUE_FILE);
        return queue.filter(q => q.status === status);
    }

    getTaxReceipts() {
        return this.readFile(TAX_RECEIPTS_FILE);
    }

    getTaxReceiptByRedemptionId(redemptionId) {
        const receipts = this.readFile(TAX_RECEIPTS_FILE);
        return receipts.find(r => r.redemptionId === redemptionId);
    }

    addTaxReceipt(receipt) {
        const receipts = this.readFile(TAX_RECEIPTS_FILE);
        receipts.push(receipt);
        this.writeFile(TAX_RECEIPTS_FILE, receipts);
        return receipt;
    }
}

module.exports = new DataStore();
