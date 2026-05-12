"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCompanyHeaders = importCompanyHeaders;
exports.importDepartments = importDepartments;
exports.importEmployees = importEmployees;
exports.importInvoices = importInvoices;
exports.importReimbursements = importReimbursements;
exports.importSampleData = importSampleData;
exports.loadJsonFile = loadJsonFile;
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
const auditService_1 = require("./auditService");
const sampleData_1 = require("../data/sampleData");
function importCompanyHeaders(headers, operatorId, operatorName) {
    const store = (0, dataStore_1.loadStore)();
    let count = 0;
    for (const header of headers) {
        const existingIndex = store.companyHeaders.findIndex(h => h.id === header.id || (h.name === header.name && h.taxId === header.taxId));
        if (existingIndex >= 0) {
            const existing = store.companyHeaders[existingIndex];
            const diff = (0, auditService_1.computeDiff)(existing, header, ['name', 'taxId', 'groupId', 'companyType', 'allowedDepartments', 'status']);
            if (diff.length > 0) {
                (0, auditService_1.recordAudit)('invoice', header.id, 'COMPANY_HEADER_UPDATED', operatorId, operatorName, { beforeState: existing, afterState: header, diff });
                store.companyHeaders[existingIndex] = { ...existing, ...header, id: existing.id };
                count++;
            }
        }
        else {
            const newHeader = { ...header, id: header.id || (0, uuid_1.v4)() };
            store.companyHeaders.push(newHeader);
            (0, auditService_1.recordAudit)('invoice', newHeader.id, 'COMPANY_HEADER_CREATED', operatorId, operatorName, { afterState: newHeader });
            count++;
        }
    }
    (0, dataStore_1.saveStore)(store);
    return count;
}
function importDepartments(departments, operatorId, operatorName) {
    const store = (0, dataStore_1.loadStore)();
    let count = 0;
    for (const dept of departments) {
        const existingIndex = store.departments.findIndex(d => d.id === dept.id);
        if (existingIndex >= 0) {
            const existing = store.departments[existingIndex];
            const diff = (0, auditService_1.computeDiff)(existing, dept, ['name', 'manager', 'allowedCompanyHeaders']);
            if (diff.length > 0) {
                store.departments[existingIndex] = { ...existing, ...dept };
                count++;
            }
        }
        else {
            store.departments.push({ ...dept, id: dept.id || (0, uuid_1.v4)() });
            count++;
        }
    }
    (0, dataStore_1.saveStore)(store);
    return count;
}
function importEmployees(employees, operatorId, operatorName) {
    const store = (0, dataStore_1.loadStore)();
    let count = 0;
    for (const emp of employees) {
        const existingIndex = store.employees.findIndex(e => e.id === emp.id || e.employeeId === emp.employeeId);
        if (existingIndex >= 0) {
            const existing = store.employees[existingIndex];
            const diff = (0, auditService_1.computeDiff)(existing, emp, ['name', 'departmentId', 'departmentName', 'email']);
            if (diff.length > 0) {
                store.employees[existingIndex] = { ...existing, ...emp, id: existing.id };
                count++;
            }
        }
        else {
            store.employees.push({ ...emp, id: emp.id || (0, uuid_1.v4)() });
            count++;
        }
    }
    (0, dataStore_1.saveStore)(store);
    return count;
}
function importInvoices(invoices, operatorId, operatorName) {
    const store = (0, dataStore_1.loadStore)();
    let count = 0;
    for (const inv of invoices) {
        const existingIndex = store.invoices.findIndex(i => i.id === inv.id ||
            (i.invoiceNumber === inv.invoiceNumber && i.invoiceCode === inv.invoiceCode));
        if (existingIndex >= 0) {
            const existing = store.invoices[existingIndex];
            const diff = (0, auditService_1.computeDiff)(existing, inv, ['headerName', 'taxId', 'amount', 'taxAmount', 'totalAmount', 'status']);
            if (diff.length > 0) {
                (0, auditService_1.recordAudit)('invoice', existing.id, 'INVOICE_UPDATED', operatorId, operatorName, { beforeState: existing, afterState: inv, diff });
                store.invoices[existingIndex] = {
                    ...existing,
                    ...inv,
                    id: existing.id,
                    updatedAt: new Date().toISOString()
                };
                count++;
            }
        }
        else {
            const newInvoice = {
                ...inv,
                id: inv.id || (0, uuid_1.v4)(),
                status: inv.status || 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.invoices.push(newInvoice);
            (0, auditService_1.recordAudit)('invoice', newInvoice.id, 'INVOICE_CREATED', operatorId, operatorName, { afterState: newInvoice });
            count++;
        }
    }
    (0, dataStore_1.saveStore)(store);
    return count;
}
function importReimbursements(reimbursements, operatorId, operatorName) {
    const store = (0, dataStore_1.loadStore)();
    let count = 0;
    for (const reim of reimbursements) {
        const existingIndex = store.reimbursements.findIndex(r => r.id === reim.id || r.formNumber === reim.formNumber);
        if (existingIndex >= 0) {
            const existing = store.reimbursements[existingIndex];
            const diff = (0, auditService_1.computeDiff)(existing, reim, ['expectedHeaderName', 'expectedTaxId', 'totalAmount', 'invoiceIds', 'status']);
            if (diff.length > 0) {
                (0, auditService_1.recordAudit)('reimbursement', existing.id, 'REIMBURSEMENT_UPDATED', operatorId, operatorName, { beforeState: existing, afterState: reim, diff });
                store.reimbursements[existingIndex] = {
                    ...existing,
                    ...reim,
                    id: existing.id,
                    updatedAt: new Date().toISOString()
                };
                count++;
            }
        }
        else {
            const newReim = {
                ...reim,
                id: reim.id || (0, uuid_1.v4)(),
                status: reim.status || 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.reimbursements.push(newReim);
            (0, auditService_1.recordAudit)('reimbursement', newReim.id, 'REIMBURSEMENT_CREATED', operatorId, operatorName, { afterState: newReim });
            count++;
        }
    }
    (0, dataStore_1.saveStore)(store);
    return count;
}
function importSampleData(operatorId, operatorName) {
    const linkedData = (0, sampleData_1.getLinkedSampleData)();
    return {
        headers: importCompanyHeaders(sampleData_1.sampleCompanyHeaders, operatorId, operatorName),
        departments: importDepartments(sampleData_1.sampleDepartments, operatorId, operatorName),
        employees: importEmployees(sampleData_1.sampleEmployees, operatorId, operatorName),
        invoices: importInvoices(linkedData.invoices, operatorId, operatorName),
        reimbursements: importReimbursements(linkedData.reimbursements, operatorId, operatorName)
    };
}
function loadJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
}
