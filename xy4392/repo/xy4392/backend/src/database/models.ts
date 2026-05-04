import db from './db';
import { 
  LightingPlan, 
  PlacedLight, 
  Actor, 
  Camera, 
  ScheduleItem, 
  RiskItem,
  Vec3,
  StudioDimensions 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export const planModel = {
  create: (data: Omit<LightingPlan, 'id' | 'createdAt' | 'updatedAt'>): LightingPlan => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO lighting_plans (id, name, description, width, depth, height, total_power, max_power_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.description || '',
      data.studioDimensions.width,
      data.studioDimensions.depth,
      data.studioDimensions.height,
      data.totalPower || 0,
      data.maxPowerLimit || 5000,
      now,
      now
    );
    return planModel.getById(id)!;
  },

  getById: (id: string): LightingPlan | null => {
    const row = db.prepare('SELECT * FROM lighting_plans WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      studioDimensions: {
        width: row.width,
        depth: row.depth,
        height: row.height
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalPower: row.total_power,
      maxPowerLimit: row.max_power_limit
    };
  },

  getAll: (): LightingPlan[] => {
    const rows = db.prepare('SELECT * FROM lighting_plans ORDER BY updated_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      studioDimensions: {
        width: row.width,
        depth: row.depth,
        height: row.height
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalPower: row.total_power,
      maxPowerLimit: row.max_power_limit
    }));
  },

  update: (id: string, data: Partial<Omit<LightingPlan, 'id' | 'createdAt'>>): LightingPlan | null => {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.studioDimensions !== undefined) {
      updates.push('width = ?', 'depth = ?', 'height = ?');
      values.push(data.studioDimensions.width, data.studioDimensions.depth, data.studioDimensions.height);
    }
    if (data.totalPower !== undefined) {
      updates.push('total_power = ?');
      values.push(data.totalPower);
    }
    if (data.maxPowerLimit !== undefined) {
      updates.push('max_power_limit = ?');
      values.push(data.maxPowerLimit);
    }
    if (data.updatedAt !== undefined) {
      values[0] = data.updatedAt;
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE lighting_plans SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;
    return planModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM lighting_plans WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

export const lightModel = {
  create: (planId: string, data: Omit<PlacedLight, 'id'>): PlacedLight => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO placed_lights (
        id, plan_id, name, type, power, color_temp, dmx_channel, is_high_temp,
        position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
        intensity, color, stand_height, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, planId,
      data.name, data.type, data.power, data.colorTemp, data.dmxChannel, data.isHighTemp ? 1 : 0,
      data.position.x, data.position.y, data.position.z,
      data.rotation.x, data.rotation.y, data.rotation.z,
      data.intensity, data.color, data.standHeight, data.notes || '',
      now, now
    );
    return lightModel.getById(id)!;
  },

  getById: (id: string): PlacedLight | null => {
    const row = db.prepare('SELECT * FROM placed_lights WHERE id = ?').get(id) as any;
    if (!row) return null;
    return mapLightRow(row);
  },

  getByPlan: (planId: string): PlacedLight[] => {
    const rows = db.prepare('SELECT * FROM placed_lights WHERE plan_id = ? ORDER BY name').all(planId) as any[];
    return rows.map(mapLightRow);
  },

  update: (id: string, data: Partial<Omit<PlacedLight, 'id' | 'planId'>>): PlacedLight | null => {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    const lightFields: Record<string, keyof PlacedLight | ((d: any) => any)> = {
      name: 'name',
      type: 'type',
      power: 'power',
      color_temp: 'colorTemp',
      dmx_channel: 'dmxChannel',
      is_high_temp: (d: any) => d.isHighTemp ? 1 : 0,
      position_x: (d: any) => d.position?.x,
      position_y: (d: any) => d.position?.y,
      position_z: (d: any) => d.position?.z,
      rotation_x: (d: any) => d.rotation?.x,
      rotation_y: (d: any) => d.rotation?.y,
      rotation_z: (d: any) => d.rotation?.z,
      intensity: 'intensity',
      color: 'color',
      stand_height: 'standHeight',
      notes: 'notes'
    };

    for (const [dbField, dataField] of Object.entries(lightFields)) {
      let value: any;
      if (typeof dataField === 'function') {
        if (dbField.startsWith('position_') && 'position' in data && data.position) {
          const coord = dbField.split('_')[1];
          value = (data.position as any)[coord];
        } else if (dbField.startsWith('rotation_') && 'rotation' in data && data.rotation) {
          const coord = dbField.split('_')[1];
          value = (data.rotation as any)[coord];
        } else if (dbField === 'is_high_temp' && 'isHighTemp' in data) {
          value = data.isHighTemp ? 1 : 0;
        } else {
          continue;
        }
      } else {
        if (!(dataField in data)) continue;
        value = (data as any)[dataField];
      }
      if (value !== undefined) {
        updates.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE placed_lights SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;
    return lightModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM placed_lights WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteByPlan: (planId: string): boolean => {
    const stmt = db.prepare('DELETE FROM placed_lights WHERE plan_id = ?');
    const result = stmt.run(planId);
    return result.changes > 0;
  }
};

function mapLightRow(row: any): PlacedLight {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    power: row.power,
    colorTemp: row.color_temp,
    dmxChannel: row.dmx_channel,
    isHighTemp: row.is_high_temp === 1,
    position: { x: row.position_x, y: row.position_y, z: row.position_z },
    rotation: { x: row.rotation_x, y: row.rotation_y, z: row.rotation_z },
    intensity: row.intensity,
    color: row.color,
    standHeight: row.stand_height,
    notes: row.notes
  };
}

export const actorModel = {
  create: (planId: string, data: Omit<Actor, 'id'>): Actor => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO actors (id, plan_id, name, position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, walk_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, planId, data.name,
      data.position.x, data.position.y, data.position.z,
      data.rotation.x, data.rotation.y, data.rotation.z,
      data.walkPath ? JSON.stringify(data.walkPath) : null,
      now, now
    );
    return actorModel.getById(id)!;
  },

  getById: (id: string): Actor | null => {
    const row = db.prepare('SELECT * FROM actors WHERE id = ?').get(id) as any;
    if (!row) return null;
    return mapActorRow(row);
  },

  getByPlan: (planId: string): Actor[] => {
    const rows = db.prepare('SELECT * FROM actors WHERE plan_id = ? ORDER BY name').all(planId) as any[];
    return rows.map(mapActorRow);
  },

  update: (id: string, data: Partial<Omit<Actor, 'id'>>): Actor | null => {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.position !== undefined) {
      updates.push('position_x = ?', 'position_y = ?', 'position_z = ?');
      values.push(data.position.x, data.position.y, data.position.z);
    }
    if (data.rotation !== undefined) {
      updates.push('rotation_x = ?', 'rotation_y = ?', 'rotation_z = ?');
      values.push(data.rotation.x, data.rotation.y, data.rotation.z);
    }
    if (data.walkPath !== undefined) {
      updates.push('walk_path = ?');
      values.push(data.walkPath ? JSON.stringify(data.walkPath) : null);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE actors SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;
    return actorModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM actors WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteByPlan: (planId: string): boolean => {
    const stmt = db.prepare('DELETE FROM actors WHERE plan_id = ?');
    const result = stmt.run(planId);
    return result.changes > 0;
  }
};

function mapActorRow(row: any): Actor {
  return {
    id: row.id,
    name: row.name,
    position: { x: row.position_x, y: row.position_y, z: row.position_z },
    rotation: { x: row.rotation_x, y: row.rotation_y, z: row.rotation_z },
    walkPath: row.walk_path ? JSON.parse(row.walk_path) : undefined
  };
}

export const cameraModel = {
  create: (planId: string, data: Omit<Camera, 'id'>): Camera => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO cameras (id, plan_id, name, position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, lens, fov, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, planId, data.name,
      data.position.x, data.position.y, data.position.z,
      data.rotation.x, data.rotation.y, data.rotation.z,
      data.lens, data.fov,
      now, now
    );
    return cameraModel.getById(id)!;
  },

  getById: (id: string): Camera | null => {
    const row = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id) as any;
    if (!row) return null;
    return mapCameraRow(row);
  },

  getByPlan: (planId: string): Camera[] => {
    const rows = db.prepare('SELECT * FROM cameras WHERE plan_id = ? ORDER BY name').all(planId) as any[];
    return rows.map(mapCameraRow);
  },

  update: (id: string, data: Partial<Omit<Camera, 'id'>>): Camera | null => {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.position !== undefined) {
      updates.push('position_x = ?', 'position_y = ?', 'position_z = ?');
      values.push(data.position.x, data.position.y, data.position.z);
    }
    if (data.rotation !== undefined) {
      updates.push('rotation_x = ?', 'rotation_y = ?', 'rotation_z = ?');
      values.push(data.rotation.x, data.rotation.y, data.rotation.z);
    }
    if (data.lens !== undefined) {
      updates.push('lens = ?');
      values.push(data.lens);
    }
    if (data.fov !== undefined) {
      updates.push('fov = ?');
      values.push(data.fov);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE cameras SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;
    return cameraModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM cameras WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteByPlan: (planId: string): boolean => {
    const stmt = db.prepare('DELETE FROM cameras WHERE plan_id = ?');
    const result = stmt.run(planId);
    return result.changes > 0;
  }
};

function mapCameraRow(row: any): Camera {
  return {
    id: row.id,
    name: row.name,
    position: { x: row.position_x, y: row.position_y, z: row.position_z },
    rotation: { x: row.rotation_x, y: row.rotation_y, z: row.rotation_z },
    lens: row.lens,
    fov: row.fov
  };
}

export const scheduleModel = {
  create: (planId: string, data: Omit<ScheduleItem, 'id'>): ScheduleItem => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO schedule_items (
        id, plan_id, scene_id, scene_name, start_time, end_time, date,
        light_ids, camera_ids, actor_ids, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, planId,
      data.sceneId, data.sceneName, data.startTime, data.endTime, data.date,
      JSON.stringify(data.lightIds), JSON.stringify(data.cameraIds), JSON.stringify(data.actorIds),
      data.notes || '',
      now, now
    );
    return scheduleModel.getById(id)!;
  },

  getById: (id: string): ScheduleItem | null => {
    const row = db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(id) as any;
    if (!row) return null;
    return mapScheduleRow(row);
  },

  getByPlan: (planId: string): ScheduleItem[] => {
    const rows = db.prepare('SELECT * FROM schedule_items WHERE plan_id = ? ORDER BY date, start_time').all(planId) as any[];
    return rows.map(mapScheduleRow);
  },

  update: (id: string, data: Partial<Omit<ScheduleItem, 'id'>>): ScheduleItem | null => {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (data.sceneId !== undefined) {
      updates.push('scene_id = ?');
      values.push(data.sceneId);
    }
    if (data.sceneName !== undefined) {
      updates.push('scene_name = ?');
      values.push(data.sceneName);
    }
    if (data.startTime !== undefined) {
      updates.push('start_time = ?');
      values.push(data.startTime);
    }
    if (data.endTime !== undefined) {
      updates.push('end_time = ?');
      values.push(data.endTime);
    }
    if (data.date !== undefined) {
      updates.push('date = ?');
      values.push(data.date);
    }
    if (data.lightIds !== undefined) {
      updates.push('light_ids = ?');
      values.push(JSON.stringify(data.lightIds));
    }
    if (data.cameraIds !== undefined) {
      updates.push('camera_ids = ?');
      values.push(JSON.stringify(data.cameraIds));
    }
    if (data.actorIds !== undefined) {
      updates.push('actor_ids = ?');
      values.push(JSON.stringify(data.actorIds));
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE schedule_items SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    if (result.changes === 0) return null;
    return scheduleModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM schedule_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteByPlan: (planId: string): boolean => {
    const stmt = db.prepare('DELETE FROM schedule_items WHERE plan_id = ?');
    const result = stmt.run(planId);
    return result.changes > 0;
  }
};

function mapScheduleRow(row: any): ScheduleItem {
  return {
    id: row.id,
    sceneId: row.scene_id,
    sceneName: row.scene_name,
    startTime: row.start_time,
    endTime: row.end_time,
    date: row.date,
    lightIds: JSON.parse(row.light_ids || '[]'),
    cameraIds: JSON.parse(row.camera_ids || '[]'),
    actorIds: JSON.parse(row.actor_ids || '[]'),
    notes: row.notes
  };
}

export const riskModel = {
  create: (planId: string, data: Omit<RiskItem, 'id' | 'planId' | 'createdAt'>): RiskItem => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO risk_items (
        id, plan_id, type, severity, title, description, affected_items,
        is_overridden, override_reason, override_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, planId,
      data.type, data.severity, data.title, data.description || '',
      JSON.stringify(data.affectedItems || []),
      data.isOverridden ? 1 : 0,
      data.overrideReason || '',
      data.overrideBy || '',
      now
    );
    return riskModel.getById(id)!;
  },

  getById: (id: string): RiskItem | null => {
    const row = db.prepare('SELECT * FROM risk_items WHERE id = ?').get(id) as any;
    if (!row) return null;
    return mapRiskRow(row);
  },

  getByPlan: (planId: string, includeOverridden: boolean = false): RiskItem[] => {
    let query = 'SELECT * FROM risk_items WHERE plan_id = ?';
    const params: any[] = [planId];
    if (!includeOverridden) {
      query += ' AND is_overridden = 0';
    }
    query += ' ORDER BY CASE severity WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END';
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(mapRiskRow);
  },

  updateOverride: (id: string, isOverridden: boolean, reason: string, overrideBy: string): RiskItem | null => {
    const stmt = db.prepare(`
      UPDATE risk_items SET is_overridden = ?, override_reason = ?, override_by = ?
      WHERE id = ?
    `);
    const result = stmt.run(isOverridden ? 1 : 0, reason, overrideBy, id);
    if (result.changes === 0) return null;
    return riskModel.getById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM risk_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteByPlan: (planId: string): boolean => {
    const stmt = db.prepare('DELETE FROM risk_items WHERE plan_id = ?');
    const result = stmt.run(planId);
    return result.changes > 0;
  }
};

function mapRiskRow(row: any): RiskItem {
  return {
    id: row.id,
    planId: row.plan_id,
    type: row.type as RiskItem['type'],
    severity: row.severity as RiskItem['severity'],
    title: row.title,
    description: row.description,
    affectedItems: JSON.parse(row.affected_items || '[]'),
    isOverridden: row.is_overridden === 1,
    overrideReason: row.override_reason,
    overrideBy: row.override_by,
    createdAt: row.created_at
  };
}
