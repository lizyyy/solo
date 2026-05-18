import { Request, Response } from 'express';
import { Parser } from 'json2csv';
import { db } from '../database';
import { InvoiceValidator } from '../validators/invoiceValidator';
import { RepairFundInvoice, ApiResponse, ImportResult } from '../types';
import { ERROR_RULES, ERROR_MESSAGES } from '../constants/errorRules';

export class InvoiceController {
  getAll(req: Request, res: Response<ApiResponse<RepairFundInvoice[]>>) {
    try {
      const invoices = db.findAll();
      res.json({ success: true, data: invoices });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  getById(req: Request, res: Response<ApiResponse<RepairFundInvoice>>) {
    try {
      const id = parseInt(req.params.id);
      const invoice = db.findById(id);
      
      if (!invoice) {
        res.status(404).json({ success: false, message: '票据记录不存在' });
        return;
      }
      
      res.json({ success: true, data: invoice });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  create(req: Request, res: Response<ApiResponse<RepairFundInvoice>>) {
    try {
      const invoiceData = req.body as Partial<RepairFundInvoice>;
      
      const validationErrors = InvoiceValidator.validateCreate(invoiceData);
      if (validationErrors.length > 0) {
        res.status(400).json({ success: false, errors: validationErrors });
        return;
      }

      const existing = db.findByInvoiceNo(invoiceData.invoiceNo!);
      if (existing) {
        res.status(409).json({
          success: false,
          errors: [{
            field: 'invoiceNo',
            message: ERROR_MESSAGES[ERROR_RULES.DUPLICATE_INVOICE_NO],
            rule: ERROR_RULES.DUPLICATE_INVOICE_NO
          }]
        });
        return;
      }

      const created = db.create(invoiceData as Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'>);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  update(req: Request, res: Response<ApiResponse<RepairFundInvoice>>) {
    try {
      const id = parseInt(req.params.id);
      const invoiceData = req.body as Partial<RepairFundInvoice>;
      
      const existing = db.findById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: '票据记录不存在' });
        return;
      }

      if (invoiceData.invoiceNo && invoiceData.invoiceNo !== existing.invoiceNo) {
        const duplicate = db.findByInvoiceNo(invoiceData.invoiceNo);
        if (duplicate) {
          res.status(409).json({
            success: false,
            errors: [{
              field: 'invoiceNo',
              message: ERROR_MESSAGES[ERROR_RULES.DUPLICATE_INVOICE_NO],
              rule: ERROR_RULES.DUPLICATE_INVOICE_NO
            }]
          });
          return;
        }
      }

      const validationErrors = InvoiceValidator.validateUpdate(invoiceData);
      if (validationErrors.length > 0) {
        res.status(400).json({ success: false, errors: validationErrors });
        return;
      }

      const updated = db.update(id, invoiceData);
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  delete(req: Request, res: Response<ApiResponse>) {
    try {
      const id = parseInt(req.params.id);
      const deleted = db.delete(id);
      
      if (!deleted) {
        res.status(404).json({ success: false, message: '票据记录不存在' });
        return;
      }
      
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  exportCSV(req: Request, res: Response) {
    try {
      const invoices = db.findAll();
      
      const fields = [
        'id', 'invoiceNo', 'communityName', 'ownerName', 'houseNumber',
        'repairItem', 'paymentAmount', 'invoiceAmount', 'invoiceDate',
        'handler', 'reviewer', 'status', 'remark', 'createdAt', 'updatedAt'
      ];
      
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(invoices);
      
      res.header('Content-Type', 'text/csv');
      res.attachment('repair_fund_invoices.csv');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  importCSV(req: Request, res: Response<ApiResponse<ImportResult>>) {
    try {
      const { data, expectedSummary } = req.body as { data: Partial<RepairFundInvoice>[]; expectedSummary?: number };
      
      const result: ImportResult = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowErrors = InvoiceValidator.validateCreate(row);
        
        if (row.invoiceNo) {
          const existing = db.findByInvoiceNo(row.invoiceNo);
          if (existing) {
            rowErrors.push({
              field: 'invoiceNo',
              message: ERROR_MESSAGES[ERROR_RULES.DUPLICATE_INVOICE_NO],
              rule: ERROR_RULES.DUPLICATE_INVOICE_NO
            });
          }
        }

        if (rowErrors.length > 0) {
          result.failed++;
          result.errors.push({ row: i + 1, errors: rowErrors });
        } else {
          try {
            db.create(row as Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'>);
            result.success++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              row: i + 1,
              errors: [{
                field: 'system',
                message: (error as Error).message,
                rule: 'SYSTEM_ERROR'
              }]
            });
          }
        }
      }

      if (expectedSummary !== undefined) {
        const allInvoices = db.findAll();
        const actualSummary = allInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
        
        if (Math.abs(actualSummary - expectedSummary) > 0.01) {
          result.errors.push({
            row: 0,
            errors: [{
              field: 'summary',
              message: `${ERROR_MESSAGES[ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY]}: 预期 ${expectedSummary}，实际 ${actualSummary}`,
              rule: ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY
            }]
          });
        }
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  validateSummary(req: Request, res: Response<ApiResponse>) {
    try {
      const { expectedSummary } = req.body as { expectedSummary: number };
      const allInvoices = db.findAll();
      const actualSummary = allInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);

      if (Math.abs(actualSummary - expectedSummary) > 0.01) {
        res.status(400).json({
          success: false,
          errors: [{
            field: 'summary',
            message: `${ERROR_MESSAGES[ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY]}: 预期 ${expectedSummary}，实际 ${actualSummary}`,
            rule: ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY
          }]
        });
        return;
      }

      res.json({ success: true, message: '汇总金额一致', data: { expectedSummary, actualSummary } });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export const invoiceController = new InvoiceController();
