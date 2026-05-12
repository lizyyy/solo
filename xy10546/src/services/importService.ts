import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  CompanyHeader, Employee, Department, Invoice, ReimbursementForm
} from '../types';
import { loadStore, saveStore } from '../store/dataStore';
import { recordAudit, computeDiff } from './auditService';
import {
  sampleCompanyHeaders, sampleDepartments, sampleEmployees,
  getLinkedSampleData
} from '../data/sampleData';

export function importCompanyHeaders(headers: CompanyHeader[], operatorId: string, operatorName: string): number {
  const store = loadStore();
  let count = 0;
  
  for (const header of headers) {
    const existingIndex = store.companyHeaders.findIndex(h => h.id === header.id || (h.name === header.name && h.taxId === header.taxId));
    
    if (existingIndex >= 0) {
      const existing = store.companyHeaders[existingIndex];
      const diff = computeDiff(
        existing as any,
        header as any,
        ['name', 'taxId', 'groupId', 'companyType', 'allowedDepartments', 'status']
      );
      
      if (diff.length > 0) {
        recordAudit(
          'invoice',
          header.id,
          'COMPANY_HEADER_UPDATED',
          operatorId,
          operatorName,
          { beforeState: existing, afterState: header, diff }
        );
        store.companyHeaders[existingIndex] = { ...existing, ...header, id: existing.id };
        count++;
      }
    } else {
      const newHeader = { ...header, id: header.id || uuidv4() };
      store.companyHeaders.push(newHeader);
      recordAudit(
        'invoice',
        newHeader.id,
        'COMPANY_HEADER_CREATED',
        operatorId,
        operatorName,
        { afterState: newHeader }
      );
      count++;
    }
  }
  
  saveStore(store);
  return count;
}

export function importDepartments(departments: Department[], operatorId: string, operatorName: string): number {
  const store = loadStore();
  let count = 0;
  
  for (const dept of departments) {
    const existingIndex = store.departments.findIndex(d => d.id === dept.id);
    
    if (existingIndex >= 0) {
      const existing = store.departments[existingIndex];
      const diff = computeDiff(
        existing as any,
        dept as any,
        ['name', 'manager', 'allowedCompanyHeaders']
      );
      
      if (diff.length > 0) {
        store.departments[existingIndex] = { ...existing, ...dept };
        count++;
      }
    } else {
      store.departments.push({ ...dept, id: dept.id || uuidv4() });
      count++;
    }
  }
  
  saveStore(store);
  return count;
}

export function importEmployees(employees: Employee[], operatorId: string, operatorName: string): number {
  const store = loadStore();
  let count = 0;
  
  for (const emp of employees) {
    const existingIndex = store.employees.findIndex(
      e => e.id === emp.id || e.employeeId === emp.employeeId
    );
    
    if (existingIndex >= 0) {
      const existing = store.employees[existingIndex];
      const diff = computeDiff(
        existing as any,
        emp as any,
        ['name', 'departmentId', 'departmentName', 'email']
      );
      
      if (diff.length > 0) {
        store.employees[existingIndex] = { ...existing, ...emp, id: existing.id };
        count++;
      }
    } else {
      store.employees.push({ ...emp, id: emp.id || uuidv4() });
      count++;
    }
  }
  
  saveStore(store);
  return count;
}

export function importInvoices(invoices: Invoice[], operatorId: string, operatorName: string): number {
  const store = loadStore();
  let count = 0;
  
  for (const inv of invoices) {
    const existingIndex = store.invoices.findIndex(
      i => i.id === inv.id || 
        (i.invoiceNumber === inv.invoiceNumber && i.invoiceCode === inv.invoiceCode)
    );
    
    if (existingIndex >= 0) {
      const existing = store.invoices[existingIndex];
      const diff = computeDiff(
        existing as any,
        inv as any,
        ['headerName', 'taxId', 'amount', 'taxAmount', 'totalAmount', 'status']
      );
      
      if (diff.length > 0) {
        recordAudit(
          'invoice',
          existing.id,
          'INVOICE_UPDATED',
          operatorId,
          operatorName,
          { beforeState: existing, afterState: inv, diff }
        );
        store.invoices[existingIndex] = { 
          ...existing, 
          ...inv, 
          id: existing.id,
          updatedAt: new Date().toISOString()
        };
        count++;
      }
    } else {
      const newInvoice: Invoice = {
        ...inv,
        id: inv.id || uuidv4(),
        status: inv.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.invoices.push(newInvoice);
      recordAudit(
        'invoice',
        newInvoice.id,
        'INVOICE_CREATED',
        operatorId,
        operatorName,
        { afterState: newInvoice }
      );
      count++;
    }
  }
  
  saveStore(store);
  return count;
}

export function importReimbursements(reimbursements: ReimbursementForm[], operatorId: string, operatorName: string): number {
  const store = loadStore();
  let count = 0;
  
  for (const reim of reimbursements) {
    const existingIndex = store.reimbursements.findIndex(
      r => r.id === reim.id || r.formNumber === reim.formNumber
    );
    
    if (existingIndex >= 0) {
      const existing = store.reimbursements[existingIndex];
      const diff = computeDiff(
        existing as any,
        reim as any,
        ['expectedHeaderName', 'expectedTaxId', 'totalAmount', 'invoiceIds', 'status']
      );
      
      if (diff.length > 0) {
        recordAudit(
          'reimbursement',
          existing.id,
          'REIMBURSEMENT_UPDATED',
          operatorId,
          operatorName,
          { beforeState: existing, afterState: reim, diff }
        );
        store.reimbursements[existingIndex] = {
          ...existing,
          ...reim,
          id: existing.id,
          updatedAt: new Date().toISOString()
        };
        count++;
      }
    } else {
      const newReim: ReimbursementForm = {
        ...reim,
        id: reim.id || uuidv4(),
        status: reim.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.reimbursements.push(newReim);
      recordAudit(
        'reimbursement',
        newReim.id,
        'REIMBURSEMENT_CREATED',
        operatorId,
        operatorName,
        { afterState: newReim }
      );
      count++;
    }
  }
  
  saveStore(store);
  return count;
}

export function importSampleData(operatorId: string, operatorName: string): {
  headers: number;
  departments: number;
  employees: number;
  invoices: number;
  reimbursements: number;
} {
  const linkedData = getLinkedSampleData();
  
  return {
    headers: importCompanyHeaders(sampleCompanyHeaders, operatorId, operatorName),
    departments: importDepartments(sampleDepartments, operatorId, operatorName),
    employees: importEmployees(sampleEmployees, operatorId, operatorName),
    invoices: importInvoices(linkedData.invoices, operatorId, operatorName),
    reimbursements: importReimbursements(linkedData.reimbursements, operatorId, operatorName)
  };
}

export function loadJsonFile<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}
