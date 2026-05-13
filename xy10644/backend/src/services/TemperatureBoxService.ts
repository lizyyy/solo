import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { TemperatureBox, TemperatureBoxStatus } from '../types';
import { OperationLogService } from './OperationLogService';

export class TemperatureBoxService {
  static async createBox(
    boxCode: string,
    orderId: string,
    medicineName: string,
    minTemp: number,
    maxTemp: number,
    currentTemp: number,
    createdBy: string,
    operatorName: string
  ): Promise<TemperatureBox> {
    const existingBox = await db.get<any>(
      `SELECT * FROM temperature_boxes WHERE box_code = ?`,
      [boxCode]
    );

    if (existingBox) {
      throw new Error('温度箱编号已存在');
    }

    const box: TemperatureBox = {
      id: uuidv4(),
      boxCode,
      orderId,
      medicineName,
      minTemp,
      maxTemp,
      currentTemp,
      status: TemperatureBoxStatus.CREATED,
      createdAt: new Date().toISOString(),
      createdBy
    };

    await db.run(
      `INSERT INTO temperature_boxes (id, box_code, order_id, medicine_name, min_temp, max_temp, current_temp, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        box.id,
        box.boxCode,
        box.orderId,
        box.medicineName,
        box.minTemp,
        box.maxTemp,
        box.currentTemp,
        box.status,
        box.createdAt,
        box.createdBy
      ]
    );

    await OperationLogService.createLog(
      'create',
      'temperature_box',
      box.id,
      createdBy,
      operatorName,
      null,
      box,
      '创建温度箱'
    );

    return box;
  }

  static async getBox(id: string): Promise<TemperatureBox | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM temperature_boxes WHERE id = ?`,
      [id]
    );
    return row ? this.mapRowToBox(row) : undefined;
  }

  static async getBoxByCode(boxCode: string): Promise<TemperatureBox | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM temperature_boxes WHERE box_code = ?`,
      [boxCode]
    );
    return row ? this.mapRowToBox(row) : undefined;
  }

  static async updateBoxStatus(
    id: string,
    status: TemperatureBoxStatus,
    currentTemp: number,
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    const oldBox = await this.getBox(id);
    if (!oldBox) {
      throw new Error('温度箱不存在');
    }

    await db.run(
      `UPDATE temperature_boxes SET status = ?, current_temp = ? WHERE id = ?`,
      [status, currentTemp, id]
    );

    const newBox = await this.getBox(id);
    await OperationLogService.createLog(
      'update_status',
      'temperature_box',
      id,
      operatorId,
      operatorName,
      oldBox,
      newBox,
      `更新状态为: ${status}`
    );
  }

  static async getAllBoxes(): Promise<TemperatureBox[]> {
    const rows = await db.all<any>(`SELECT * FROM temperature_boxes ORDER BY created_at DESC`);
    return rows.map(row => this.mapRowToBox(row));
  }

  private static mapRowToBox(row: any): TemperatureBox {
    return {
      id: row.id,
      boxCode: row.box_code,
      orderId: row.order_id,
      medicineName: row.medicine_name,
      minTemp: row.min_temp,
      maxTemp: row.max_temp,
      currentTemp: row.current_temp,
      status: row.status as TemperatureBoxStatus,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }
}
