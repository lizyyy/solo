import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { RiderHandover, HandoverStatus, TemperatureBoxStatus } from '../types';
import { OperationLogService } from './OperationLogService';
import { TemperatureBoxService } from './TemperatureBoxService';

export class RiderHandoverService {
  static async createHandover(
    boxId: string,
    riderId: string,
    riderName: string,
    location: string,
    temperatureAtHandover: number,
    operatorId: string,
    operatorName: string,
    fromRiderId?: string,
    fromRiderName?: string
  ): Promise<RiderHandover> {
    const box = await TemperatureBoxService.getBox(boxId);
    if (!box) {
      throw new Error('温度箱不存在');
    }

    const handover: RiderHandover = {
      id: uuidv4(),
      boxId,
      riderId,
      riderName,
      fromRiderId,
      fromRiderName,
      status: HandoverStatus.PENDING,
      handoverTime: new Date().toISOString(),
      location,
      temperatureAtHandover
    };

    await db.run(
      `INSERT INTO rider_handovers (id, box_id, rider_id, rider_name, from_rider_id, from_rider_name, status, handover_time, location, temperature_at_handover)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        handover.id,
        handover.boxId,
        handover.riderId,
        handover.riderName,
        handover.fromRiderId || null,
        handover.fromRiderName || null,
        handover.status,
        handover.handoverTime,
        handover.location,
        handover.temperatureAtHandover
      ]
    );

    await OperationLogService.createLog(
      'create',
      'rider_handover',
      handover.id,
      operatorId,
      operatorName,
      null,
      handover,
      '创建骑手交接'
    );

    return handover;
  }

  static async confirmHandover(
    handoverId: string,
    operatorId: string,
    operatorName: string
  ): Promise<RiderHandover> {
    const handover = await this.getHandover(handoverId);
    if (!handover) {
      throw new Error('交接记录不存在');
    }

    if (handover.status !== HandoverStatus.PENDING) {
      throw new Error('该交接已处理');
    }

    const oldHandover = { ...handover };
    handover.status = HandoverStatus.CONFIRMED;
    handover.confirmedTime = new Date().toISOString();

    await db.run(
      `UPDATE rider_handovers SET status = ?, confirmed_time = ? WHERE id = ?`,
      [handover.status, handover.confirmedTime, handoverId]
    );

    await TemperatureBoxService.updateBoxStatus(
      handover.boxId,
      TemperatureBoxStatus.IN_TRANSIT,
      handover.temperatureAtHandover,
      operatorId,
      operatorName
    );

    await OperationLogService.createLog(
      'confirm',
      'rider_handover',
      handoverId,
      operatorId,
      operatorName,
      oldHandover,
      handover,
      '确认骑手交接'
    );

    return handover;
  }

  static async validateHandover(boxId: string): Promise<{ valid: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    const handovers = await this.getHandoversByBox(boxId);

    if (handovers.length === 0) {
      reasons.push('没有骑手交接记录');
      return { valid: false, reasons };
    }

    const lastHandover = handovers[handovers.length - 1];

    if (lastHandover.status !== HandoverStatus.CONFIRMED) {
      reasons.push('最后一次交接尚未确认');
    }

    if (lastHandover.temperatureAtHandover < -20 || lastHandover.temperatureAtHandover > 8) {
      reasons.push('交接时温度超出正常范围');
    }

    return { valid: reasons.length === 0, reasons };
  }

  static async getHandover(id: string): Promise<RiderHandover | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM rider_handovers WHERE id = ?`,
      [id]
    );
    return row ? this.mapRowToHandover(row) : undefined;
  }

  static async getHandoversByBox(boxId: string): Promise<RiderHandover[]> {
    const rows = await db.all<any>(
      `SELECT * FROM rider_handovers WHERE box_id = ? ORDER BY handover_time ASC`,
      [boxId]
    );
    return rows.map(row => this.mapRowToHandover(row));
  }

  private static mapRowToHandover(row: any): RiderHandover {
    return {
      id: row.id,
      boxId: row.box_id,
      riderId: row.rider_id,
      riderName: row.rider_name,
      fromRiderId: row.from_rider_id,
      fromRiderName: row.from_rider_name,
      status: row.status as HandoverStatus,
      handoverTime: row.handover_time,
      confirmedTime: row.confirmed_time,
      location: row.location,
      temperatureAtHandover: row.temperature_at_handover,
      notes: row.notes
    };
  }
}
