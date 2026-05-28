import fs from 'fs';
import path from 'path';
import type {
  AccountSubject,
  CashVoucher,
  ReceiptImage,
  ParseResult,
  SubjectMapping,
  CustomerNote,
  Revision,
  BalanceRecord,
  CollationReport,
  ReportItem,
} from '../../shared/types';

export interface Database {
  accountSubject: AccountSubject[];
  cashVoucher: CashVoucher[];
  receiptImage: ReceiptImage[];
  parseResult: ParseResult[];
  subjectMapping: SubjectMapping[];
  customerNote: CustomerNote[];
  revision: Revision[];
  balanceRecord: BalanceRecord[];
  collationReport: CollationReport[];
  reportItem: ReportItem[];
  exportLog: {
    id: string;
    reportId: string | null;
    voucherId: string | null;
    exportType: string;
    fileName: string;
    filePath: string;
    exportedBy: string;
    exportedAt: string;
  }[];
}

const dataDir = path.join(process.cwd(), 'data');
const uploadDir = path.join(process.cwd(), 'uploads');
const dbPath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const defaultSubjects: AccountSubject[] = [
  { id: 'sub_001', code: '1001', name: '库存现金', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_002', code: '1002', name: '银行存款', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_003', code: '1122', name: '应收账款', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_004', code: '1221', name: '其他应收款', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_005', code: '1403', name: '原材料', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_006', code: '1601', name: '固定资产', category: 'asset', direction: 'debit', isSystem: true },
  { id: 'sub_007', code: '2202', name: '应付账款', category: 'liability', direction: 'credit', isSystem: true },
  { id: 'sub_008', code: '2203', name: '预收账款', category: 'liability', direction: 'credit', isSystem: true },
  { id: 'sub_009', code: '2211', name: '应付职工薪酬', category: 'liability', direction: 'credit', isSystem: true },
  { id: 'sub_010', code: '2221', name: '应交税费', category: 'liability', direction: 'credit', isSystem: true },
  { id: 'sub_011', code: '4001', name: '实收资本', category: 'equity', direction: 'credit', isSystem: true },
  { id: 'sub_012', code: '6001', name: '主营业务收入', category: 'revenue', direction: 'credit', isSystem: true },
  { id: 'sub_013', code: '6051', name: '其他业务收入', category: 'revenue', direction: 'credit', isSystem: true },
  { id: 'sub_014', code: '6401', name: '主营业务成本', category: 'expense', direction: 'debit', isSystem: true },
  { id: 'sub_015', code: '6601', name: '销售费用', category: 'expense', direction: 'debit', isSystem: true },
  { id: 'sub_016', code: '6602', name: '管理费用', category: 'expense', direction: 'debit', isSystem: true },
  { id: 'sub_017', code: '6603', name: '财务费用', category: 'expense', direction: 'debit', isSystem: true },
];

const defaultDatabase: Database = {
  accountSubject: defaultSubjects,
  cashVoucher: [],
  receiptImage: [],
  parseResult: [],
  subjectMapping: [],
  customerNote: [],
  revision: [],
  balanceRecord: [],
  collationReport: [],
  reportItem: [],
  exportLog: [],
};

function loadDatabase(): Database {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading database, using default:', e);
      return JSON.parse(JSON.stringify(defaultDatabase));
    }
  }
  return JSON.parse(JSON.stringify(defaultDatabase));
}

export let db: Database = loadDatabase();

export function saveDatabase(): void {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

export function initDatabase(): void {
  if (!fs.existsSync(dbPath)) {
    saveDatabase();
    console.log('Database initialized successfully');
  } else {
    console.log('Database loaded successfully');
  }
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default db;
