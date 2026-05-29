import db from '../db';
import { Vendor } from '../../shared/types';
import { BaseRepository } from './BaseRepository';

export class VendorRepository extends BaseRepository<Vendor> {
  constructor() {
    super('vendors');
  }

  create(vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Vendor {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO vendors (id, name, category, power_requirement, contact, note, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      vendor.name,
      vendor.category,
      vendor.powerRequirement,
      vendor.contact,
      vendor.note,
      vendor.source,
      now,
      now
    );
    return this.findById(id)!;
  }

  update(
    id: string,
    vendor: Partial<Omit<Vendor, 'id' | 'createdAt'>>
  ): Vendor | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    const snakeVendor = this.toSnakeCase(vendor);
    for (const [key, value] of Object.entries(snakeVendor)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(
      `UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);

    return this.findById(id);
  }

  findByCategory(category: string): Vendor[] {
    const rows = db
      .prepare(`SELECT * FROM vendors WHERE category = ?`)
      .all(category);
    return rows.map((row) => this.toCamelCase(row));
  }

  search(name: string): Vendor[] {
    const rows = db
      .prepare(`SELECT * FROM vendors WHERE name LIKE ?`)
      .all(`%${name}%`);
    return rows.map((row) => this.toCamelCase(row));
  }

  bulkCreate(
    vendors: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Vendor[] {
    const result: Vendor[] = [];
    const insert = db.prepare(
      `INSERT INTO vendors (id, name, category, power_requirement, contact, note, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction((vendorList) => {
      for (const vendor of vendorList) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        insert.run(
          id,
          vendor.name,
          vendor.category,
          vendor.powerRequirement,
          vendor.contact,
          vendor.note,
          vendor.source,
          now,
          now
        );
        result.push(this.findById(id)!);
      }
    });

    transaction(vendors);
    return result;
  }
}
