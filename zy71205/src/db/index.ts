import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type {
  ProcessBatch,
  BankTransaction,
  Voucher,
  Invoice,
  Contract,
  MatchRecord,
  SplitRecord,
  MergeRecord,
  ManualConfirmation,
  ImportConflict,
  DataSource,
} from '../types';
import { generateId } from '../utils';

interface VoucherCleaningDB extends DBSchema {
  batches: {
    key: string;
    value: ProcessBatch;
    indexes: { 'by-createdAt': number };
  };
  transactions: {
    key: string;
    value: BankTransaction;
    indexes: { 'by-batchId': string; 'by-transactionNo': string };
  };
  vouchers: {
    key: string;
    value: Voucher;
    indexes: { 'by-batchId': string; 'by-voucherNo': string };
  };
  invoices: {
    key: string;
    value: Invoice;
    indexes: { 'by-batchId': string; 'by-invoiceNo': string };
  };
  contracts: {
    key: string;
    value: Contract;
    indexes: { 'by-batchId': string; 'by-contractNo': string };
  };
  matchRecords: {
    key: string;
    value: MatchRecord;
    indexes: { 'by-batchId': string; 'by-status': string };
  };
  splitRecords: {
    key: string;
    value: SplitRecord;
    indexes: { 'by-originalTransactionId': string };
  };
  mergeRecords: {
    key: string;
    value: MergeRecord;
  };
  confirmations: {
    key: string;
    value: ManualConfirmation;
    indexes: { 'by-matchRecordId': string };
  };
  importConflicts: {
    key: string;
    value: ImportConflict;
    indexes: { 'by-batchId': string };
  };
  sources: {
    key: string;
    value: DataSource;
    indexes: { 'by-batchId': string; 'by-fileHash': string };
  };
}

const DB_NAME = 'voucher-cleaning-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<VoucherCleaningDB> | null = null;

export const initDB = async (): Promise<IDBPDatabase<VoucherCleaningDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VoucherCleaningDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const batchesStore = db.createObjectStore('batches', { keyPath: 'id' });
      batchesStore.createIndex('by-createdAt', 'createdAt');

      const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionsStore.createIndex('by-batchId', 'batchId');
      transactionsStore.createIndex('by-transactionNo', 'transactionNo');

      const vouchersStore = db.createObjectStore('vouchers', { keyPath: 'id' });
      vouchersStore.createIndex('by-batchId', 'batchId');
      vouchersStore.createIndex('by-voucherNo', 'voucherNo');

      const invoicesStore = db.createObjectStore('invoices', { keyPath: 'id' });
      invoicesStore.createIndex('by-batchId', 'batchId');
      invoicesStore.createIndex('by-invoiceNo', 'invoiceNo');

      const contractsStore = db.createObjectStore('contracts', { keyPath: 'id' });
      contractsStore.createIndex('by-batchId', 'batchId');
      contractsStore.createIndex('by-contractNo', 'contractNo');

      const matchRecordsStore = db.createObjectStore('matchRecords', { keyPath: 'id' });
      matchRecordsStore.createIndex('by-batchId', 'batchId');
      matchRecordsStore.createIndex('by-status', 'status');

      const splitRecordsStore = db.createObjectStore('splitRecords', { keyPath: 'id' });
      splitRecordsStore.createIndex('by-originalTransactionId', 'originalTransactionId');

      db.createObjectStore('mergeRecords', { keyPath: 'id' });

      const confirmationsStore = db.createObjectStore('confirmations', { keyPath: 'id' });
      confirmationsStore.createIndex('by-matchRecordId', 'matchRecordId');

      const importConflictsStore = db.createObjectStore('importConflicts', { keyPath: 'id' });
      importConflictsStore.createIndex('by-batchId', 'batchId');

      const sourcesStore = db.createObjectStore('sources', { keyPath: 'id' });
      sourcesStore.createIndex('by-batchId', 'batchId');
      sourcesStore.createIndex('by-fileHash', 'fileHash');
    },
  });

  return dbInstance;
};

export const closeDB = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

export const dbOperations = {
  batches: {
    async create(name: string): Promise<ProcessBatch> {
      const db = await initDB();
      const now = Date.now();
      const batch: ProcessBatch = {
        id: generateId(),
        name,
        status: 'importing',
        sources: [],
        statistics: {
          totalTransactions: 0,
          totalVouchers: 0,
          totalInvoices: 0,
          totalContracts: 0,
          matchedCount: 0,
          pendingCount: 0,
          unmatchedCount: 0,
          conflictCount: 0,
          confirmedCount: 0,
        },
        createdAt: now,
        updatedAt: now,
      };
      await db.add('batches', batch);
      return batch;
    },

    async getAll(): Promise<ProcessBatch[]> {
      const db = await initDB();
      return db.getAllFromIndex('batches', 'by-createdAt');
    },

    async get(id: string): Promise<ProcessBatch | undefined> {
      const db = await initDB();
      return db.get('batches', id);
    },

    async update(batch: ProcessBatch): Promise<void> {
      const db = await initDB();
      batch.updatedAt = Date.now();
      await db.put('batches', batch);
    },

    async delete(id: string): Promise<void> {
      const db = await initDB();
      const tx = db.transaction(
        ['batches', 'transactions', 'vouchers', 'invoices', 'contracts', 'matchRecords', 'sources', 'importConflicts'],
        'readwrite'
      );
      
      await tx.objectStore('batches').delete(id);
      await tx.objectStore('transactions').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('transactions').delete(k)))
      );
      await tx.objectStore('vouchers').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('vouchers').delete(k)))
      );
      await tx.objectStore('invoices').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('invoices').delete(k)))
      );
      await tx.objectStore('contracts').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('contracts').delete(k)))
      );
      await tx.objectStore('matchRecords').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('matchRecords').delete(k)))
      );
      await tx.objectStore('sources').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('sources').delete(k)))
      );
      await tx.objectStore('importConflicts').index('by-batchId').getAllKeys(id).then(keys => 
        Promise.all(keys.map(k => tx.objectStore('importConflicts').delete(k)))
      );
      
      await tx.done;
    },
  },

  sources: {
    async add(source: DataSource): Promise<void> {
      const db = await initDB();
      await db.add('sources', source);
    },

    async getByHash(fileHash: string): Promise<DataSource | undefined> {
      const db = await initDB();
      return db.getFromIndex('sources', 'by-fileHash', fileHash);
    },

    async getByBatch(batchId: string): Promise<DataSource[]> {
      const db = await initDB();
      return db.getAllFromIndex('sources', 'by-batchId', batchId);
    },
  },

  transactions: {
    async addMany(transactions: BankTransaction[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('transactions', 'readwrite');
      await Promise.all(transactions.map(t => tx.store.add(t)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<BankTransaction[]> {
      const db = await initDB();
      return db.getAllFromIndex('transactions', 'by-batchId', batchId);
    },

    async update(transaction: BankTransaction): Promise<void> {
      const db = await initDB();
      transaction.updatedAt = Date.now();
      await db.put('transactions', transaction);
    },

    async updateMany(transactions: BankTransaction[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('transactions', 'readwrite');
      await Promise.all(transactions.map(t => {
        t.updatedAt = Date.now();
        return tx.store.put(t);
      }));
      await tx.done;
    },
  },

  vouchers: {
    async addMany(vouchers: Voucher[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('vouchers', 'readwrite');
      await Promise.all(vouchers.map(v => tx.store.add(v)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<Voucher[]> {
      const db = await initDB();
      return db.getAllFromIndex('vouchers', 'by-batchId', batchId);
    },

    async update(voucher: Voucher): Promise<void> {
      const db = await initDB();
      voucher.updatedAt = Date.now();
      await db.put('vouchers', voucher);
    },

    async updateMany(vouchers: Voucher[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('vouchers', 'readwrite');
      await Promise.all(vouchers.map(v => {
        v.updatedAt = Date.now();
        return tx.store.put(v);
      }));
      await tx.done;
    },
  },

  invoices: {
    async addMany(invoices: Invoice[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('invoices', 'readwrite');
      await Promise.all(invoices.map(i => tx.store.add(i)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<Invoice[]> {
      const db = await initDB();
      return db.getAllFromIndex('invoices', 'by-batchId', batchId);
    },
  },

  contracts: {
    async addMany(contracts: Contract[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('contracts', 'readwrite');
      await Promise.all(contracts.map(c => tx.store.add(c)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<Contract[]> {
      const db = await initDB();
      return db.getAllFromIndex('contracts', 'by-batchId', batchId);
    },
  },

  matchRecords: {
    async addMany(records: MatchRecord[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('matchRecords', 'readwrite');
      await Promise.all(records.map(r => tx.store.add(r)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<MatchRecord[]> {
      const db = await initDB();
      return db.getAllFromIndex('matchRecords', 'by-batchId', batchId);
    },

    async getByStatus(status: string): Promise<MatchRecord[]> {
      const db = await initDB();
      return db.getAllFromIndex('matchRecords', 'by-status', status);
    },

    async update(record: MatchRecord): Promise<void> {
      const db = await initDB();
      record.updatedAt = Date.now();
      await db.put('matchRecords', record);
    },

    async delete(id: string): Promise<void> {
      const db = await initDB();
      await db.delete('matchRecords', id);
    },

    async clearBatch(batchId: string): Promise<void> {
      const db = await initDB();
      const keys = await db.getAllKeysFromIndex('matchRecords', 'by-batchId', batchId);
      const tx = db.transaction('matchRecords', 'readwrite');
      await Promise.all(keys.map(k => tx.store.delete(k)));
      await tx.done;
    },
  },

  splitRecords: {
    async add(record: SplitRecord): Promise<void> {
      const db = await initDB();
      await db.add('splitRecords', record);
    },

    async getByOriginalId(transactionId: string): Promise<SplitRecord | undefined> {
      const db = await initDB();
      return db.getFromIndex('splitRecords', 'by-originalTransactionId', transactionId);
    },
  },

  mergeRecords: {
    async add(record: MergeRecord): Promise<void> {
      const db = await initDB();
      await db.add('mergeRecords', record);
    },
  },

  confirmations: {
    async add(confirmation: ManualConfirmation): Promise<void> {
      const db = await initDB();
      await db.add('confirmations', confirmation);
    },

    async getByMatchId(matchRecordId: string): Promise<ManualConfirmation[]> {
      const db = await initDB();
      return db.getAllFromIndex('confirmations', 'by-matchRecordId', matchRecordId);
    },
  },

  importConflicts: {
    async addMany(conflicts: ImportConflict[]): Promise<void> {
      const db = await initDB();
      const tx = db.transaction('importConflicts', 'readwrite');
      await Promise.all(conflicts.map(c => tx.store.add(c)));
      await tx.done;
    },

    async getByBatch(batchId: string): Promise<ImportConflict[]> {
      const db = await initDB();
      return db.getAllFromIndex('importConflicts', 'by-batchId', batchId);
    },

    async delete(id: string): Promise<void> {
      const db = await initDB();
      await db.delete('importConflicts', id);
    },
  },
};
