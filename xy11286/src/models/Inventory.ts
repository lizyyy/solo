import { BaseModel } from './BaseModel';
import { InventoryBatch, InventoryStatus } from '../types';

export class InventoryModel extends BaseModel {
  protected tableName = 'inventory_batches';

  create(data: Omit<InventoryBatch, 'id' | 'importedAt'>): InventoryBatch {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO inventory_batches (
        id, medicine_id, batch_number, quantity, unit, unit_price,
        manufacture_date, expiry_date, status, location, supplier, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.medicineId, data.batchNumber, data.quantity,
      data.unit, data.unitPrice, data.manufactureDate, data.expiryDate,
      data.status, data.location || null, data.supplier || null, now
    );

    return { ...data, id, importedAt: now };
  }

  updateQuantity(id: string, quantity: number): boolean {
    const result = this.db.prepare(`
      UPDATE inventory_batches SET quantity = ? WHERE id = ?
    `).run(quantity, id);
    return result.changes > 0;
  }

  updateStatus(id: string, status: InventoryStatus): boolean {
    const result = this.db.prepare(`
      UPDATE inventory_batches SET status = ? WHERE id = ?
    `).run(status, id);
    return result.changes > 0;
  }

  findByMedicineId(medicineId: string): InventoryBatch[] {
    const rows = this.db.prepare(`
      SELECT * FROM inventory_batches WHERE medicine_id = ? ORDER BY expiry_date ASC
    `).all(medicineId);
    return (rows as any[]).map(this.mapRowToInventory);
  }

  findByBatchNumber(medicineId: string, batchNumber: string): InventoryBatch | undefined {
    const row = this.db.prepare(`
      SELECT * FROM inventory_batches WHERE medicine_id = ? AND batch_number = ?
    `).get(medicineId, batchNumber);
    return row ? this.mapRowToInventory(row as any) : undefined;
  }

  findAvailableByMedicineId(medicineId: string): InventoryBatch[] {
    const rows = this.db.prepare(`
      SELECT * FROM inventory_batches 
      WHERE medicine_id = ? AND status = ? AND quantity > 0
      ORDER BY expiry_date ASC
    `).all(medicineId, InventoryStatus.IN_STOCK);
    return (rows as any[]).map(this.mapRowToInventory);
  }

  deductStock(batchId: string, quantity: number): boolean {
    const result = this.db.prepare(`
      UPDATE inventory_batches 
      SET quantity = quantity - ?
      WHERE id = ? AND quantity >= ?
    `).run(quantity, batchId, quantity);
    return result.changes > 0;
  }

  addStock(batchId: string, quantity: number): boolean {
    const result = this.db.prepare(`
      UPDATE inventory_batches 
      SET quantity = quantity + ?
      WHERE id = ?
    `).run(quantity, batchId);
    return result.changes > 0;
  }

  getTotalQuantity(medicineId: string): number {
    const result = this.db.prepare(`
      SELECT SUM(quantity) as total FROM inventory_batches 
      WHERE medicine_id = ? AND status = ?
    `).get(medicineId, InventoryStatus.IN_STOCK) as { total: number | null };
    return result.total || 0;
  }

  private mapRowToInventory(row: any): InventoryBatch {
    return {
      id: row.id,
      medicineId: row.medicine_id,
      batchNumber: row.batch_number,
      quantity: row.quantity,
      unit: row.unit,
      unitPrice: row.unit_price,
      manufactureDate: row.manufacture_date,
      expiryDate: row.expiry_date,
      status: row.status as InventoryStatus,
      location: row.location,
      supplier: row.supplier,
      importedAt: row.imported_at,
    };
  }
}

export const inventoryModel = new InventoryModel();