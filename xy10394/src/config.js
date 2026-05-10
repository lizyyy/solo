import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

export const DATA_DIR = join(projectRoot, 'data');
export const SUPPLIERS_FILE = join(DATA_DIR, 'suppliers.json');
export const QUALIFICATIONS_FILE = join(DATA_DIR, 'qualifications.json');
export const PURCHASE_ORDERS_FILE = join(DATA_DIR, 'purchase_orders.json');

export const QUALIFICATION_TYPES = [
  '营业执照',
  '质检报告',
  '授权书',
  '保险',
  '其他'
];

export const RISK_LEVELS = {
  CRITICAL: { name: '严重', color: 'red', priority: 1 },
  HIGH: { name: '高', color: 'redBright', priority: 2 },
  MEDIUM: { name: '中', color: 'yellow', priority: 3 },
  LOW: { name: '低', color: 'cyan', priority: 4 },
  NORMAL: { name: '正常', color: 'green', priority: 5 }
};

export const DATE_FORMAT = 'yyyy-MM-dd';
export const WARNING_DAYS = 30;
