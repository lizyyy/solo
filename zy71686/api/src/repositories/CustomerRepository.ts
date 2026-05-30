import { getDb } from '../db/index.js';
import type { Customer } from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class CustomerRepository {
  create(customer: Omit<Customer, 'createdAt' | 'updatedAt'> & Partial<Pick<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Customer {
    const db = getDb();
    const id = (customer as Customer).id || uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO customer (
        id, name, customer_type, credit_rating, industry,
        attributes, version, source_file, source_batch,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer.name,
      customer.customerType,
      customer.creditRating || '',
      customer.industry || '',
      JSON.stringify(customer.attributes || {}),
      customer.version,
      customer.sourceFile,
      customer.sourceBatch,
      now,
      now
    );
    
    return { ...customer, id, createdAt: now, updatedAt: now };
  }

  bulkCreate(customers: (Omit<Customer, 'createdAt' | 'updatedAt'> & Partial<Pick<Customer, 'id' | 'createdAt' | 'updatedAt'>>)[]): Customer[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO customer (
        id, name, customer_type, credit_rating, industry,
        attributes, version, source_file, source_batch,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result: Customer[] = [];
    
    const insertMany = db.transaction((items: any[]) => {
      for (const c of items) {
        const id = c.id || uuidv4();
        stmt.run(
          id,
          c.name,
          c.customerType,
          c.creditRating || '',
          c.industry || '',
          JSON.stringify(c.attributes || {}),
          c.version,
          c.sourceFile,
          c.sourceBatch,
          now,
          now
        );
        result.push({ ...c, id, createdAt: now, updatedAt: now });
      }
    });
    
    insertMany(customers);
    return result;
  }

  findById(id: string, version?: string): Customer | null {
    const db = getDb();
    let sql = 'SELECT * FROM customer WHERE id = ?';
    const params: any[] = [id];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    } else {
      sql += ' ORDER BY version DESC LIMIT 1';
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row ? this.mapToCustomer(row) : null;
  }

  findByName(name: string, version?: string): Customer | null {
    const db = getDb();
    let sql = 'SELECT * FROM customer WHERE name = ?';
    const params: any[] = [name];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    } else {
      sql += ' ORDER BY version DESC LIMIT 1';
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row ? this.mapToCustomer(row) : null;
  }

  list(version?: string, limit = 1000): Customer[] {
    const db = getDb();
    let sql = 'SELECT * FROM customer';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    sql += ' ORDER BY name LIMIT ?';
    params.push(limit);
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCustomer(row));
  }

  search(query: string, version?: string, limit = 50): Customer[] {
    const db = getDb();
    let sql = 'SELECT * FROM customer WHERE name LIKE ?';
    const params: any[] = [`%${query}%`];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    sql += ' ORDER BY name LIMIT ?';
    params.push(limit);
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCustomer(row));
  }

  count(version?: string): number {
    const db = getDb();
    let sql = 'SELECT COUNT(*) as count FROM customer';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row.count;
  }

  private mapToCustomer(row: any): Customer {
    return {
      id: row.id,
      name: row.name,
      customerType: row.customer_type,
      creditRating: row.credit_rating,
      industry: row.industry,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      version: row.version,
      sourceFile: row.source_file,
      sourceBatch: row.source_batch,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const customerRepository = new CustomerRepository();
