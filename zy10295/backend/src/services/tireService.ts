import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { TireStatus, EventType, Tire, TireEvent, TireLifecycleDetail } from '../types';

const STATUS_TRANSITIONS: Record<TireStatus, TireStatus[]> = {
  in_stock: ['installed', 'inspecting', 'scrapped'],
  installed: ['removed'],
  removed: ['inspecting', 'scrapped'],
  inspecting: ['inspection_passed', 'inspection_failed'],
  inspection_passed: ['in_stock', 'retreading', 'installed'],
  inspection_failed: ['retreading', 'scrapped'],
  retreading: ['retread_completed'],
  retread_completed: ['in_stock', 'inspecting', 'installed'],
  scrapped: [],
};

export class TireService {
  private validateTransition(currentStatus: TireStatus, nextStatus: TireStatus): boolean {
    return STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
  }

  getTireById(id: string): Tire | undefined {
    return db.prepare('SELECT * FROM tires WHERE id = ?').get(id) as Tire | undefined;
  }

  getTireBySerial(serialNumber: string): Tire | undefined {
    return db.prepare('SELECT * FROM tires WHERE serial_number = ?').get(serialNumber) as Tire | undefined;
  }

  getAllTires(filters?: { status?: TireStatus; vehicle_id?: string }): Tire[] {
    let query = 'SELECT * FROM tires WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.status) {
      query += ' AND current_status = ?';
      params.push(filters.status);
    }
    if (filters?.vehicle_id) {
      query += ' AND current_vehicle_id = ?';
      params.push(filters.vehicle_id);
    }
    
    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params) as Tire[];
  }

  createTire(data: { serial_number: string; brand: string; model: string; size: string }): Tire {
    const existing = this.getTireBySerial(data.serial_number);
    if (existing) {
      throw new Error('轮胎胎号已存在');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO tires (id, serial_number, brand, model, size, current_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'in_stock', ?, ?)
    `).run(id, data.serial_number, data.brand, data.model, data.size, now, now);

    return this.getTireById(id)!;
  }

  private createEvent(data: Omit<TireEvent, 'id' | 'created_at'>): string {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO tire_events (id, tire_id, event_type, vehicle_id, reason, inspection_result, inspection_notes, cost, cost_notes, performed_by, performed_at, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.tire_id, data.event_type, data.vehicle_id, data.reason,
      data.inspection_result, data.inspection_notes, data.cost, data.cost_notes,
      data.performed_by, data.performed_at, data.notes, now
    );

    if (data.cost && data.cost > 0) {
      const costId = uuidv4();
      db.prepare(`
        INSERT INTO tire_costs (id, tire_id, event_id, cost_type, amount, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(costId, data.tire_id, id, data.event_type, data.cost, data.cost_notes, now);
    }

    return id;
  }

  private updateTireStatus(tireId: string, status: TireStatus, vehicleId?: string | null) {
    const now = new Date().toISOString();
    let query = 'UPDATE tires SET current_status = ?, updated_at = ?';
    const params: any[] = [status, now];
    
    if (vehicleId !== undefined) {
      query += ', current_vehicle_id = ?';
      params.push(vehicleId);
    }
    
    query += ' WHERE id = ?';
    params.push(tireId);
    
    db.prepare(query).run(...params);
  }

  installTire(tireId: string, vehicleId: string, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');
    
    if (tire.current_status === 'scrapped') {
      throw new Error('已报废的轮胎不能装车');
    }

    if (tire.current_status === 'inspection_failed') {
      throw new Error('检测未通过的轮胎不能装车，请先翻新或报废');
    }

    if (!this.validateTransition(tire.current_status, 'installed')) {
      throw new Error(`不能从 ${tire.current_status} 状态直接装车`);
    }

    const vehicleTires = this.getAllTires({ vehicle_id: vehicleId });
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId) as any;
    if (vehicle && vehicleTires.length >= vehicle.tire_count) {
      throw new Error('该车辆轮胎数量已满');
    }

    this.createEvent({
      tire_id: tireId,
      event_type: 'install',
      vehicle_id: vehicleId,
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      reason: null,
      inspection_result: null,
      inspection_notes: null,
      cost: null,
      cost_notes: null,
    });

    this.updateTireStatus(tireId, 'installed', vehicleId);

    return this.getTireById(tireId)!;
  }

  removeTire(tireId: string, reason: string, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    if (tire.current_status !== 'installed') {
      throw new Error('只有已装车的轮胎才能拆下');
    }

    this.createEvent({
      tire_id: tireId,
      event_type: 'remove',
      vehicle_id: tire.current_vehicle_id,
      reason,
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      inspection_result: null,
      inspection_notes: null,
      cost: null,
      cost_notes: null,
    });

    this.updateTireStatus(tireId, 'removed', null);

    return this.getTireById(tireId)!;
  }

  inspectTire(tireId: string, result: 'passed' | 'failed', inspectionNotes: string, cost?: number, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    if (tire.current_status === 'scrapped') {
      throw new Error('已报废的轮胎不能检测');
    }

    const nextStatus = result === 'passed' ? 'inspection_passed' : 'inspection_failed';

    this.createEvent({
      tire_id: tireId,
      event_type: 'inspect',
      vehicle_id: tire.current_vehicle_id,
      inspection_result: result,
      inspection_notes: inspectionNotes,
      cost: cost || null,
      cost_notes: cost ? '检测费用' : null,
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      reason: null,
    });

    this.updateTireStatus(tireId, nextStatus as TireStatus);

    return this.getTireById(tireId)!;
  }

  sendToRetread(tireId: string, cost: number, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    if (tire.current_status === 'scrapped') {
      throw new Error('已报废的轮胎不能翻新');
    }

    if (!['inspection_passed', 'inspection_failed', 'in_stock'].includes(tire.current_status)) {
      throw new Error('当前状态不能送去翻新');
    }

    this.createEvent({
      tire_id: tireId,
      event_type: 'send_retread',
      vehicle_id: null,
      cost,
      cost_notes: '翻新费用',
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      reason: null,
      inspection_result: null,
      inspection_notes: null,
    });

    this.updateTireStatus(tireId, 'retreading');

    return this.getTireById(tireId)!;
  }

  completeRetread(tireId: string, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    if (tire.current_status !== 'retreading') {
      throw new Error('只有正在翻新中的轮胎才能完成翻新');
    }

    this.createEvent({
      tire_id: tireId,
      event_type: 'complete_retread',
      vehicle_id: null,
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      reason: null,
      inspection_result: null,
      inspection_notes: null,
      cost: null,
      cost_notes: null,
    });

    this.updateTireStatus(tireId, 'retread_completed');

    return this.getTireById(tireId)!;
  }

  scrapTire(tireId: string, reason: string, performedBy?: string, notes?: string): Tire {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    if (tire.current_status === 'scrapped') {
      throw new Error('该轮胎已报废');
    }

    this.createEvent({
      tire_id: tireId,
      event_type: 'scrap',
      vehicle_id: tire.current_vehicle_id,
      reason,
      performed_by: performedBy || null,
      performed_at: new Date().toISOString(),
      notes: notes || null,
      inspection_result: null,
      inspection_notes: null,
      cost: null,
      cost_notes: null,
    });

    this.updateTireStatus(tireId, 'scrapped', null);

    return this.getTireById(tireId)!;
  }

  getTireLifecycle(tireId: string): TireLifecycleDetail {
    const tire = this.getTireById(tireId);
    if (!tire) throw new Error('轮胎不存在');

    const events = db.prepare('SELECT * FROM tire_events WHERE tire_id = ? ORDER BY performed_at DESC').all(tireId) as TireEvent[];
    
    const costs = db.prepare(`
      SELECT cost_type as type, SUM(amount) as amount
      FROM tire_costs
      WHERE tire_id = ?
      GROUP BY cost_type
    `).all(tireId) as { type: string; amount: number }[];

    const totalCost = costs.reduce((sum, c) => sum + c.amount, 0);

    return {
      tire,
      events,
      totalCost,
      costBreakdown: costs,
    };
  }

  getTireEvents(tireId: string): TireEvent[] {
    return db.prepare('SELECT * FROM tire_events WHERE tire_id = ? ORDER BY performed_at DESC').all(tireId) as TireEvent[];
  }
}

export default new TireService();
