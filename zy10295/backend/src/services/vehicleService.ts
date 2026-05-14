import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { Vehicle, Tire, VehicleAvailability } from '../types';
import tireService from './tireService';

export class VehicleService {
  getVehicleById(id: string): Vehicle | undefined {
    const db = getDb();
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle | undefined;
  }

  getVehicleByPlate(plateNumber: string): Vehicle | undefined {
    const db = getDb();
    return db.prepare('SELECT * FROM vehicles WHERE plate_number = ?').get(plateNumber) as Vehicle | undefined;
  }

  getAllVehicles(): Vehicle[] {
    const db = getDb();
    return db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all() as Vehicle[];
  }

  createVehicle(data: { plate_number: string; model: string; tire_count?: number }): Vehicle {
    const db = getDb();
    const existing = this.getVehicleByPlate(data.plate_number);
    if (existing) {
      throw new Error('车牌号已存在');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO vehicles (id, plate_number, model, tire_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(id, data.plate_number, data.model, data.tire_count || 6, now, now);

    return this.getVehicleById(id)!;
  }

  getVehicleTires(vehicleId: string): Tire[] {
    return tireService.getAllTires({ vehicle_id: vehicleId });
  }

  getVehicleAvailability(vehicleId: string): VehicleAvailability {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle) throw new Error('车辆不存在');

    const installedTires = this.getVehicleTires(vehicleId);
    const missingTireCount = vehicle.tire_count - installedTires.length;
    
    const issues: string[] = [];
    
    if (missingTireCount > 0) {
      issues.push(`缺少 ${missingTireCount} 个轮胎`);
    }

    const hasProblemTires = installedTires.some(t => 
      t.current_status !== 'installed'
    );
    if (hasProblemTires) {
      issues.push('存在状态异常的轮胎');
    }

    return {
      vehicle,
      installedTires,
      missingTireCount,
      isAvailable: missingTireCount === 0 && !hasProblemTires,
      issues,
    };
  }

  getAllVehiclesAvailability(): VehicleAvailability[] {
    const vehicles = this.getAllVehicles();
    return vehicles.map(v => {
      try {
        return this.getVehicleAvailability(v.id);
      } catch {
        return {
          vehicle: v,
          installedTires: [],
          missingTireCount: v.tire_count,
          isAvailable: false,
          issues: ['数据加载异常'],
        };
      }
    });
  }

  getAvailableVehicles(): VehicleAvailability[] {
    return this.getAllVehiclesAvailability().filter(v => v.isAvailable);
  }
}

export default new VehicleService();
