import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { GPSNode } from '../types';
import { OperationLogService } from './OperationLogService';
import { TemperatureBoxService } from './TemperatureBoxService';

export class GPSService {
  static async addNode(
    boxId: string,
    latitude: number,
    longitude: number,
    temperature: number,
    batteryLevel: number,
    operatorId: string,
    operatorName: string
  ): Promise<GPSNode> {
    const box = await TemperatureBoxService.getBox(boxId);
    if (!box) {
      throw new Error('温度箱不存在');
    }

    const node: GPSNode = {
      id: uuidv4(),
      boxId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      temperature,
      batteryLevel
    };

    await db.run(
      `INSERT INTO gps_nodes (id, box_id, latitude, longitude, timestamp, temperature, battery_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.boxId,
        node.latitude,
        node.longitude,
        node.timestamp,
        node.temperature,
        node.batteryLevel
      ]
    );

    await TemperatureBoxService.updateBoxStatus(
      boxId,
      box.status,
      temperature,
      operatorId,
      operatorName
    );

    await OperationLogService.createLog(
      'create',
      'gps_node',
      node.id,
      operatorId,
      operatorName,
      null,
      node,
      '添加GPS节点'
    );

    return node;
  }

  static async getNodesByBox(boxId: string): Promise<GPSNode[]> {
    const rows = await db.all<any>(
      `SELECT * FROM gps_nodes WHERE box_id = ? ORDER BY timestamp ASC`,
      [boxId]
    );
    return rows.map(row => this.mapRowToNode(row));
  }

  static async getLatestNode(boxId: string): Promise<GPSNode | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM gps_nodes WHERE box_id = ? ORDER BY timestamp DESC LIMIT 1`,
      [boxId]
    );
    return row ? this.mapRowToNode(row) : undefined;
  }

  static async validateTemperatureContinuity(boxId: string): Promise<{ valid: boolean; reasons: string[]; avgTemp: number; maxDeviation: number }> {
    const nodes = await this.getNodesByBox(boxId);
    const reasons: string[] = [];

    if (nodes.length === 0) {
      return { valid: false, reasons: ['没有GPS温度数据'], avgTemp: 0, maxDeviation: 0 };
    }

    const box = await TemperatureBoxService.getBox(boxId);
    if (!box) {
      return { valid: false, reasons: ['温度箱不存在'], avgTemp: 0, maxDeviation: 0 };
    }

    const temps = nodes.map(n => n.temperature);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const maxDeviation = Math.max(...temps.map(t => Math.abs(t - avgTemp)));

    const outOfRangeCount = temps.filter(t => t < box.minTemp || t > box.maxTemp).length;
    if (outOfRangeCount > temps.length * 0.1) {
      reasons.push(`超过10%的温度数据超出正常范围 [${box.minTemp}°C, ${box.maxTemp}°C]`);
    }

    if (maxDeviation > 5) {
      reasons.push(`温度波动过大，最大偏差 ${maxDeviation.toFixed(1)}°C`);
    }

    for (let i = 1; i < nodes.length; i++) {
      const t1 = new Date(nodes[i - 1].timestamp).getTime();
      const t2 = new Date(nodes[i].timestamp).getTime();
      if (t2 - t1 > 30 * 60 * 1000) {
        reasons.push('存在超过30分钟的数据中断');
        break;
      }
    }

    return { valid: reasons.length === 0, reasons, avgTemp, maxDeviation };
  }

  private static mapRowToNode(row: any): GPSNode {
    return {
      id: row.id,
      boxId: row.box_id,
      latitude: row.latitude,
      longitude: row.longitude,
      timestamp: row.timestamp,
      temperature: row.temperature,
      batteryLevel: row.battery_level
    };
  }
}
