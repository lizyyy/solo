import { BaseModel } from './BaseModel';
import { Medicine, InventoryBatch, DosageRule } from '../types';

export class MedicineModel extends BaseModel {
  protected tableName = 'medicines';

  create(data: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>): Medicine {
    const id = this.generateId();
    const now = Date.now();
    
    this.db.prepare(`
      INSERT INTO medicines (
        id, code, name, generic_name, category, unit, manufacturer,
        is_controlled, requires_prescription, min_dose, max_dose,
        dose_unit, dose_per_weight, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.code, data.name, data.genericName || null,
      data.category, data.unit, data.manufacturer,
      data.isControlled ? 1 : 0,
      data.requiresPrescription ? 1 : 0,
      data.minDose || null, data.maxDose || null,
      data.doseUnit || null, data.dosePerWeight || null,
      now, now
    );

    return { ...data, id, createdAt: now, updatedAt: now };
  }

  update(id: string, data: Partial<Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>>): boolean {
    const now = Date.now();
    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMapping: Record<string, string> = {
      code: 'code',
      name: 'name',
      genericName: 'generic_name',
      category: 'category',
      unit: 'unit',
      manufacturer: 'manufacturer',
      isControlled: 'is_controlled',
      requiresPrescription: 'requires_prescription',
      minDose: 'min_dose',
      maxDose: 'max_dose',
      doseUnit: 'dose_unit',
      dosePerWeight: 'dose_per_weight',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMapping[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = ?`);
        params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }

    params.push(id);
    const result = this.db.prepare(`
      UPDATE medicines SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...params);

    return result.changes > 0;
  }

  findByCode(code: string): Medicine | undefined {
    const row = this.db.prepare('SELECT * FROM medicines WHERE code = ?').get(code);
    return row ? this.mapRowToMedicine(row as any) : undefined;
  }

  search(keyword: string): Medicine[] {
    const rows = this.db.prepare(`
      SELECT * FROM medicines 
      WHERE name LIKE ? OR code LIKE ? OR generic_name LIKE ?
    `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    return (rows as any[]).map(this.mapRowToMedicine);
  }

  private mapRowToMedicine(row: any): Medicine {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      genericName: row.generic_name,
      category: row.category,
      unit: row.unit,
      manufacturer: row.manufacturer,
      isControlled: row.is_controlled === 1,
      requiresPrescription: row.requires_prescription === 1,
      minDose: row.min_dose,
      maxDose: row.max_dose,
      doseUnit: row.dose_unit,
      dosePerWeight: row.dose_per_weight,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const medicineModel = new MedicineModel();