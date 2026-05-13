import db from '../connection';
import { Owner } from '../../types';
import { generateId } from '../../utils/validators';
import { NotFoundError, DuplicateError } from '../../utils/errors';

export class OwnerRepository {
  async create(owner: Omit<Owner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Owner> {
    const existing = await this.findByEmail(owner.email);
    if (existing) {
      throw new DuplicateError(`责任人邮箱已存在: ${owner.email}`);
    }
    
    const id = generateId();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO owners (id, name, email, department, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      owner.name,
      owner.email,
      owner.department || null,
      owner.phone || null,
      now,
      now
    ]);
    
    return this.findById(id);
  }

  async findById(id: string): Promise<Owner> {
    const result = await db.get(`SELECT * FROM owners WHERE id = ?`, [id]);
    if (!result) {
      throw new NotFoundError(`责任人不存在: ${id}`);
    }
    return this.mapToOwner(result);
  }

  async findByEmail(email: string): Promise<Owner | undefined> {
    const result = await db.get(`SELECT * FROM owners WHERE email = ?`, [email]);
    return result ? this.mapToOwner(result) : undefined;
  }

  async findAll(): Promise<Owner[]> {
    const results = await db.all(`SELECT * FROM owners ORDER BY name ASC`);
    return results.map(row => this.mapToOwner(row));
  }

  async findByDepartment(department: string): Promise<Owner[]> {
    const results = await db.all(
      `SELECT * FROM owners WHERE department = ? ORDER BY name ASC`,
      [department]
    );
    return results.map(row => this.mapToOwner(row));
  }

  async update(id: string, updates: Partial<Omit<Owner, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Owner> {
    const now = new Date().toISOString();
    const updatesArr: any[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      updatesArr.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      updatesArr.push('email = ?');
      values.push(updates.email);
    }
    if (updates.department !== undefined) {
      updatesArr.push('department = ?');
      values.push(updates.department);
    }
    if (updates.phone !== undefined) {
      updatesArr.push('phone = ?');
      values.push(updates.phone);
    }
    
    if (updatesArr.length === 0) {
      return this.findById(id);
    }
    
    updatesArr.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    await db.run(
      `UPDATE owners SET ${updatesArr.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const result = await db.run(`DELETE FROM owners WHERE id = ?`, [id]);
    if (result.changes === 0) {
      throw new NotFoundError(`责任人不存在: ${id}`);
    }
  }

  async findOrCreate(owner: Omit<Owner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Owner> {
    const existing = await this.findByEmail(owner.email);
    if (existing) {
      return existing;
    }
    return this.create(owner);
  }

  private mapToOwner(row: any): Owner {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department,
      phone: row.phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default new OwnerRepository();
