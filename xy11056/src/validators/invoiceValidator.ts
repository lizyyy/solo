import { RepairFundInvoice, ValidationError } from '../types';
import { ERROR_RULES, ERROR_MESSAGES } from '../constants/errorRules';

export class InvoiceValidator {
  static validateCreate(invoice: Partial<RepairFundInvoice>): ValidationError[] {
    const errors: ValidationError[] = [];

    const requiredFields: (keyof RepairFundInvoice)[] = [
      'invoiceNo', 'communityName', 'ownerName', 'houseNumber',
      'repairItem', 'paymentAmount', 'invoiceAmount', 'invoiceDate',
      'handler', 'reviewer', 'status'
    ];

    requiredFields.forEach(field => {
      if (invoice[field] === undefined || invoice[field] === null || invoice[field] === '') {
        errors.push({
          field,
          message: `${ERROR_MESSAGES[ERROR_RULES.REQUIRED_FIELD_MISSING]}: ${field}`,
          rule: ERROR_RULES.REQUIRED_FIELD_MISSING
        });
      }
    });

    if (invoice.paymentAmount !== undefined) {
      if (typeof invoice.paymentAmount !== 'number' || invoice.paymentAmount <= 0) {
        errors.push({
          field: 'paymentAmount',
          message: `${ERROR_MESSAGES[ERROR_RULES.INVALID_AMOUNT]}: paymentAmount`,
          rule: ERROR_RULES.INVALID_AMOUNT
        });
      }
    }

    if (invoice.invoiceAmount !== undefined) {
      if (typeof invoice.invoiceAmount !== 'number' || invoice.invoiceAmount <= 0) {
        errors.push({
          field: 'invoiceAmount',
          message: `${ERROR_MESSAGES[ERROR_RULES.INVALID_AMOUNT]}: invoiceAmount`,
          rule: ERROR_RULES.INVALID_AMOUNT
        });
      }
    }

    if (invoice.paymentAmount !== undefined && invoice.invoiceAmount !== undefined &&
        typeof invoice.paymentAmount === 'number' && typeof invoice.invoiceAmount === 'number') {
      if (Math.abs(invoice.paymentAmount - invoice.invoiceAmount) > 0.01) {
        errors.push({
          field: 'paymentAmount,invoiceAmount',
          message: ERROR_MESSAGES[ERROR_RULES.PAYMENT_INVOICE_AMOUNT_MISMATCH],
          rule: ERROR_RULES.PAYMENT_INVOICE_AMOUNT_MISMATCH
        });
      }
    }

    if (invoice.invoiceDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(invoice.invoiceDate)) {
        errors.push({
          field: 'invoiceDate',
          message: ERROR_MESSAGES[ERROR_RULES.INVALID_DATE],
          rule: ERROR_RULES.INVALID_DATE
        });
      }
    }

    if (invoice.status) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(invoice.status)) {
        errors.push({
          field: 'status',
          message: ERROR_MESSAGES[ERROR_RULES.INVALID_STATUS],
          rule: ERROR_RULES.INVALID_STATUS
        });
      }
    }

    return errors;
  }

  static validateUpdate(invoice: Partial<RepairFundInvoice>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (invoice.paymentAmount !== undefined) {
      if (typeof invoice.paymentAmount !== 'number' || invoice.paymentAmount <= 0) {
        errors.push({
          field: 'paymentAmount',
          message: `${ERROR_MESSAGES[ERROR_RULES.INVALID_AMOUNT]}: paymentAmount`,
          rule: ERROR_RULES.INVALID_AMOUNT
        });
      }
    }

    if (invoice.invoiceAmount !== undefined) {
      if (typeof invoice.invoiceAmount !== 'number' || invoice.invoiceAmount <= 0) {
        errors.push({
          field: 'invoiceAmount',
          message: `${ERROR_MESSAGES[ERROR_RULES.INVALID_AMOUNT]}: invoiceAmount`,
          rule: ERROR_RULES.INVALID_AMOUNT
        });
      }
    }

    if (invoice.paymentAmount !== undefined && invoice.invoiceAmount !== undefined) {
      if (Math.abs(invoice.paymentAmount - invoice.invoiceAmount) > 0.01) {
        errors.push({
          field: 'paymentAmount,invoiceAmount',
          message: ERROR_MESSAGES[ERROR_RULES.PAYMENT_INVOICE_AMOUNT_MISMATCH],
          rule: ERROR_RULES.PAYMENT_INVOICE_AMOUNT_MISMATCH
        });
      }
    }

    if (invoice.invoiceDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(invoice.invoiceDate)) {
        errors.push({
          field: 'invoiceDate',
          message: ERROR_MESSAGES[ERROR_RULES.INVALID_DATE],
          rule: ERROR_RULES.INVALID_DATE
        });
      }
    }

    if (invoice.status) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(invoice.status)) {
        errors.push({
          field: 'status',
          message: ERROR_MESSAGES[ERROR_RULES.INVALID_STATUS],
          rule: ERROR_RULES.INVALID_STATUS
        });
      }
    }

    return errors;
  }

  static validateSummaryConsistency(
    currentInvoices: RepairFundInvoice[],
    newInvoice: RepairFundInvoice,
    expectedSummary: number
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const currentTotal = currentInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
    const newTotal = currentTotal + newInvoice.invoiceAmount;

    if (Math.abs(newTotal - expectedSummary) > 0.01) {
      errors.push({
        field: 'summary',
        message: `${ERROR_MESSAGES[ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY]}: 预期 ${expectedSummary}，实际 ${newTotal}`,
        rule: ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY
      });
    }

    return errors;
  }
}
