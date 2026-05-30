import { getDb } from '../db/index.js';
import type { GuaranteeContract, CounterGuarantee } from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class GuaranteeRepository {
  createContract(contract: Omit<GuaranteeContract, 'createdAt' | 'updatedAt'> & Partial<Pick<GuaranteeContract, 'id' | 'createdAt' | 'updatedAt'>>): GuaranteeContract {
    const db = getDb();
    const id = (contract as GuaranteeContract).id || uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO guarantee_contract (
        id, guarantor_id, guaranteed_id, amount, currency,
        start_date, end_date, contract_number, is_counter_guarantee,
        counter_guarantee_id, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      contract.guarantorId,
      contract.guaranteedId,
      contract.amount,
      contract.currency || 'CNY',
      contract.startDate || null,
      contract.endDate || null,
      contract.contractNumber || '',
      contract.isCounterGuarantee ? 1 : 0,
      contract.counterGuaranteeId || null,
      JSON.stringify(contract.attributes || {}),
      contract.version,
      contract.sourceFile,
      contract.sourceRow,
      contract.sourceBatch,
      now,
      now
    );
    
    return { ...contract, id, createdAt: now, updatedAt: now };
  }

  bulkCreateContracts(contracts: (Omit<GuaranteeContract, 'createdAt' | 'updatedAt'> & Partial<Pick<GuaranteeContract, 'id' | 'createdAt' | 'updatedAt'>>)[]): GuaranteeContract[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO guarantee_contract (
        id, guarantor_id, guaranteed_id, amount, currency,
        start_date, end_date, contract_number, is_counter_guarantee,
        counter_guarantee_id, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result: GuaranteeContract[] = [];
    
    const insertMany = db.transaction((items: any[]) => {
      for (const c of items) {
        const id = c.id || uuidv4();
        stmt.run(
          id,
          c.guarantorId,
          c.guaranteedId,
          c.amount,
          c.currency || 'CNY',
          c.startDate || null,
          c.endDate || null,
          c.contractNumber || '',
          c.isCounterGuarantee ? 1 : 0,
          c.counterGuaranteeId || null,
          JSON.stringify(c.attributes || {}),
          c.version,
          c.sourceFile,
          c.sourceRow,
          c.sourceBatch,
          now,
          now
        );
        result.push({ ...c, id, createdAt: now, updatedAt: now });
      }
    });
    
    insertMany(contracts);
    return result;
  }

  findContractById(id: string, version?: string): GuaranteeContract | null {
    const db = getDb();
    let sql = 'SELECT * FROM guarantee_contract WHERE id = ?';
    const params: any[] = [id];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row ? this.mapToContract(row) : null;
  }

  findContractsByGuarantor(guarantorId: string, version?: string): GuaranteeContract[] {
    const db = getDb();
    let sql = 'SELECT * FROM guarantee_contract WHERE guarantor_id = ?';
    const params: any[] = [guarantorId];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToContract(row));
  }

  findContractsByGuaranteed(guaranteedId: string, version?: string): GuaranteeContract[] {
    const db = getDb();
    let sql = 'SELECT * FROM guarantee_contract WHERE guaranteed_id = ?';
    const params: any[] = [guaranteedId];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToContract(row));
  }

  findAllContracts(version?: string): GuaranteeContract[] {
    const db = getDb();
    let sql = 'SELECT * FROM guarantee_contract';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToContract(row));
  }

  countContracts(version?: string): number {
    const db = getDb();
    let sql = 'SELECT COUNT(*) as count FROM guarantee_contract';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row.count;
  }

  createCounterGuarantee(cg: Omit<CounterGuarantee, 'createdAt' | 'updatedAt'> & Partial<Pick<CounterGuarantee, 'id' | 'createdAt' | 'updatedAt'>>): CounterGuarantee {
    const db = getDb();
    const id = (cg as CounterGuarantee).id || uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO counter_guarantee (
        id, guarantee_id, provider_id, type, amount,
        coverage_ratio, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cg.guaranteeId,
      cg.providerId,
      cg.type,
      cg.amount,
      cg.coverageRatio,
      JSON.stringify(cg.attributes || {}),
      cg.version,
      cg.sourceFile,
      cg.sourceRow,
      cg.sourceBatch,
      now,
      now
    );
    
    return { ...cg, id, createdAt: now, updatedAt: now };
  }

  bulkCreateCounterGuarantees(cgs: (Omit<CounterGuarantee, 'createdAt' | 'updatedAt'> & Partial<Pick<CounterGuarantee, 'id' | 'createdAt' | 'updatedAt'>>)[]): CounterGuarantee[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO counter_guarantee (
        id, guarantee_id, provider_id, type, amount,
        coverage_ratio, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result: CounterGuarantee[] = [];
    
    const insertMany = db.transaction((items: any[]) => {
      for (const c of items) {
        const id = c.id || uuidv4();
        stmt.run(
          id,
          c.guaranteeId,
          c.providerId,
          c.type,
          c.amount,
          c.coverageRatio,
          JSON.stringify(c.attributes || {}),
          c.version,
          c.sourceFile,
          c.sourceRow,
          c.sourceBatch,
          now,
          now
        );
        result.push({ ...c, id, createdAt: now, updatedAt: now });
      }
    });
    
    insertMany(cgs);
    return result;
  }

  findCounterGuaranteesByGuarantee(guaranteeId: string, version?: string): CounterGuarantee[] {
    const db = getDb();
    let sql = 'SELECT * FROM counter_guarantee WHERE guarantee_id = ?';
    const params: any[] = [guaranteeId];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCounterGuarantee(row));
  }

  findAllCounterGuarantees(version?: string): CounterGuarantee[] {
    const db = getDb();
    let sql = 'SELECT * FROM counter_guarantee';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCounterGuarantee(row));
  }

  findDuplicateContracts(version?: string): GuaranteeContract[][] {
    const db = getDb();
    let sql = `
      SELECT guarantor_id, guaranteed_id, contract_number, GROUP_CONCAT(id) as ids
      FROM guarantee_contract
      WHERE contract_number IS NOT NULL AND contract_number != ''
    `;
    
    if (version) {
      sql += ' AND version = ?';
    }
    
    sql += ' GROUP BY guarantor_id, guaranteed_id, contract_number HAVING COUNT(*) > 1';
    
    const params = version ? [version] : [];
    const rows = db.prepare(sql).all(...params) as any[];
    
    const duplicates: GuaranteeContract[][] = [];
    for (const row of rows) {
      const ids = row.ids.split(',');
      const group: GuaranteeContract[] = [];
      for (const id of ids) {
        const contract = this.findContractById(id, version);
        if (contract) {
          group.push(contract);
        }
      }
      if (group.length > 1) {
        duplicates.push(group);
      }
    }
    
    return duplicates;
  }

  private mapToContract(row: any): GuaranteeContract {
    return {
      id: row.id,
      guarantorId: row.guarantor_id,
      guaranteedId: row.guaranteed_id,
      amount: row.amount,
      currency: row.currency,
      startDate: row.start_date,
      endDate: row.end_date,
      contractNumber: row.contract_number,
      isCounterGuarantee: row.is_counter_guarantee === 1,
      counterGuaranteeId: row.counter_guarantee_id,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      version: row.version,
      sourceFile: row.source_file,
      sourceRow: row.source_row,
      sourceBatch: row.source_batch,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToCounterGuarantee(row: any): CounterGuarantee {
    return {
      id: row.id,
      guaranteeId: row.guarantee_id,
      providerId: row.provider_id,
      type: row.type,
      amount: row.amount,
      coverageRatio: row.coverage_ratio,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      version: row.version,
      sourceFile: row.source_file,
      sourceRow: row.source_row,
      sourceBatch: row.source_batch,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const guaranteeRepository = new GuaranteeRepository();
