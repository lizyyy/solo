const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getQuery, allQuery, runQuery } = require('../database');
const deductionService = require('../services/deductionService');

router.post('/purchase-orders', async (req, res) => {
  try {
    const { poNumber, supplierId, supplierName, totalAmount, taxRate = 0.13, items } = req.body;
    const poId = uuidv4();

    await runQuery(
      `INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, total_amount, tax_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [poId, poNumber, supplierId, supplierName, totalAmount, taxRate, 'active']
    );

    if (items && items.length > 0) {
      for (const item of items) {
        const itemId = uuidv4();
        await runQuery(
          `INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_price, tax_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, poId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate || taxRate]
        );
      }
    }

    const po = await getQuery('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
    res.json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/purchase-orders/:id', async (req, res) => {
  try {
    const po = await getQuery('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    if (!po) {
      return res.status(404).json({ success: false, error: '采购单不存在' });
    }
    const items = await allQuery('SELECT * FROM purchase_order_items WHERE po_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...po, items } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/receipts', async (req, res) => {
  try {
    const { receiptNumber, poId, supplierId, totalAmount, taxAmount, items } = req.body;
    const receiptId = uuidv4();

    await runQuery(
      `INSERT INTO receipts (id, receipt_number, po_id, supplier_id, total_amount, tax_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [receiptId, receiptNumber, poId, supplierId, totalAmount, taxAmount, 'confirmed']
    );

    if (items && items.length > 0) {
      for (const item of items) {
        const itemId = uuidv4();
        await runQuery(
          `INSERT INTO receipt_items (id, receipt_id, po_item_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, receiptId, item.poItemId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.taxAmount]
        );
      }
    }

    const receipt = await getQuery('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    res.json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/returns', async (req, res) => {
  try {
    const { returnNumber, poId, receiptId, supplierId, totalAmount, taxAmount, items } = req.body;
    const returnId = uuidv4();

    await runQuery(
      `INSERT INTO returns (id, return_number, po_id, receipt_id, supplier_id, total_amount, tax_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [returnId, returnNumber, poId, receiptId, supplierId, totalAmount, taxAmount, 'confirmed']
    );

    if (items && items.length > 0) {
      for (const item of items) {
        const itemId = uuidv4();
        await runQuery(
          `INSERT INTO return_items (id, return_id, receipt_item_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, returnId, item.receiptItemId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.taxAmount]
        );
      }
    }

    const returnRecord = await getQuery('SELECT * FROM returns WHERE id = ?', [returnId]);
    res.json({ success: true, data: returnRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const { invoiceNumber, supplierId, supplierName, poId, invoiceDate, totalAmount, taxAmount, taxRate } = req.body;
    const invoiceId = uuidv4();

    await runQuery(
      `INSERT INTO invoices (id, invoice_number, supplier_id, supplier_name, po_id, invoice_date, total_amount, tax_amount, tax_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, invoiceNumber, supplierId, supplierName, poId, invoiceDate, totalAmount, taxAmount, taxRate, 'pending']
    );

    const invoice = await getQuery('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.json({ success: true, data: invoice });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: '发票号重复，不能重复导入' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await getQuery('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!invoice) {
      return res.status(404).json({ success: false, error: '发票不存在' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/prepayments', async (req, res) => {
  try {
    const { prepaymentNumber, poId, supplierId, amount, paymentDate } = req.body;
    const prepaymentId = uuidv4();

    await runQuery(
      `INSERT INTO prepayments (id, prepayment_number, po_id, supplier_id, amount, status, payment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prepaymentId, prepaymentNumber, poId, supplierId, amount, 'active', paymentDate]
    );

    const prepayment = await getQuery('SELECT * FROM prepayments WHERE id = ?', [prepaymentId]);
    res.json({ success: true, data: prepayment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/deductions', async (req, res) => {
  try {
    const { invoiceId, poId, supplierId, amount, tax, operator } = req.body;
    
    const result = await deductionService.createDeduction(invoiceId, poId, supplierId, amount, tax, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/deductions/validate', async (req, res) => {
  try {
    const { invoiceId, poId, supplierId } = req.body;
    const result = await deductionService.validateInvoiceDeduction(invoiceId, poId, supplierId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deductions/invoice/:invoiceId/history', async (req, res) => {
  try {
    const history = await deductionService.getInvoiceDeductionHistory(req.params.invoiceId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deductions/differences', async (req, res) => {
  try {
    const { invoiceId, poId, supplierId } = req.query;
    const differences = await deductionService.getDeductionDifferences(invoiceId, poId, supplierId);
    res.json({ success: true, data: differences });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deductible/:poId/:supplierId', async (req, res) => {
  try {
    const result = await deductionService.calculateDeductibleAmount(req.params.poId, req.params.supplierId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/purchase-orders', async (req, res) => {
  try {
    const pos = await allQuery('SELECT * FROM purchase_orders ORDER BY created_at DESC');
    res.json({ success: true, data: pos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const invoices = await allQuery('SELECT * FROM invoices ORDER BY created_at DESC');
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deductions', async (req, res) => {
  try {
    const deductions = await allQuery('SELECT * FROM deductions ORDER BY created_at DESC');
    res.json({ success: true, data: deductions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
