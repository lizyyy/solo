import { db } from '../database';
import { Plan, Hall, Booth, FlowZone, PowerZone } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  hall_data: string;
  booths_data: string;
  flow_zones_data: string;
  power_zones_data: string;
}

export const planRepository = {
  findAll(): Plan[] {
    const rows = db.prepare('SELECT * FROM plans ORDER BY updated_at DESC').all() as PlanRow[];
    return rows.map(row => this.rowToPlan(row));
  },

  findById(id: string): Plan | null {
    const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow | undefined;
    return row ? this.rowToPlan(row) : null;
  },

  create(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Plan {
    const id = uuidv4();
    const now = new Date();

    const stmt = db.prepare(`
      INSERT INTO plans (
        id, name, description, created_at, updated_at,
        hall_data, booths_data, flow_zones_data, power_zones_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      plan.name,
      plan.description || null,
      now.toISOString(),
      now.toISOString(),
      JSON.stringify(plan.hall),
      JSON.stringify(plan.booths),
      JSON.stringify(plan.flowZones),
      JSON.stringify(plan.powerZones)
    );

    return {
      id,
      ...plan,
      createdAt: now,
      updatedAt: now
    };
  },

  update(id: string, updates: Partial<Pick<Plan, 'name' | 'description' | 'hall' | 'booths' | 'flowZones' | 'powerZones'>>): Plan | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date();
    const updatesToApply: Partial<Plan> = { ...existing, ...updates, updatedAt: now };

    const setClauses: string[] = ['updated_at = ?'];
    const params: unknown[] = [now.toISOString()];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description);
    }
    if (updates.hall !== undefined) {
      setClauses.push('hall_data = ?');
      params.push(JSON.stringify(updates.hall));
    }
    if (updates.booths !== undefined) {
      setClauses.push('booths_data = ?');
      params.push(JSON.stringify(updates.booths));
    }
    if (updates.flowZones !== undefined) {
      setClauses.push('flow_zones_data = ?');
      params.push(JSON.stringify(updates.flowZones));
    }
    if (updates.powerZones !== undefined) {
      setClauses.push('power_zones_data = ?');
      params.push(JSON.stringify(updates.powerZones));
    }

    params.push(id);

    const stmt = db.prepare(`UPDATE plans SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findById(id);
  },

  delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM plans WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  rowToPlan(row: PlanRow): Plan {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      hall: JSON.parse(row.hall_data) as Hall,
      booths: JSON.parse(row.booths_data) as Booth[],
      flowZones: JSON.parse(row.flow_zones_data) as FlowZone[],
      powerZones: JSON.parse(row.power_zones_data) as PowerZone[]
    };
  }
};
