import * as fs from 'fs';
import * as path from 'path';
import {
  CompanyHeader, Employee, Department, Invoice,
  ReimbursementForm, AuditRecord, InvoiceCheckReport, Correction
} from '../types';

const WORK_DIR = process.cwd();
const DATA_DIR = path.join(WORK_DIR, '.invoice-checker');

export interface DataStore {
  initialized: boolean;
  companyHeaders: CompanyHeader[];
  employees: Employee[];
  departments: Department[];
  invoices: Invoice[];
  reimbursements: ReimbursementForm[];
  auditRecords: AuditRecord[];
  checkReports: InvoiceCheckReport[];
  corrections: Correction[];
}

export const defaultStore: DataStore = {
  initialized: false,
  companyHeaders: [],
  employees: [],
  departments: [],
  invoices: [],
  reimbursements: [],
  auditRecords: [],
  checkReports: [],
  corrections: []
};

const getStorePath = () => path.join(DATA_DIR, 'data.json');

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function isInitialized(): boolean {
  return fs.existsSync(getStorePath());
}

export function loadStore(): DataStore {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return { ...defaultStore, initialized: false };
  }
  const content = fs.readFileSync(storePath, 'utf-8');
  return JSON.parse(content);
}

export function saveStore(store: DataStore): void {
  ensureDataDir();
  const storePath = getStorePath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function initializeStore(): DataStore {
  const store = { ...defaultStore, initialized: true };
  saveStore(store);
  return store;
}

export function getWorkDir(): string {
  return WORK_DIR;
}

export function getDataDir(): string {
  return DATA_DIR;
}
