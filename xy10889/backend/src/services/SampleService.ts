import { Sample, SampleStatus, Transfer, ResponsibilityLink, ExceptionType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { runInsert, runQuery, runGet } from '../database';
import { StateMachineService } from './StateMachineService';
import { TemperatureService } from './TemperatureService';
import { ExceptionService } from './ExceptionService';

export class SampleService {
  static async createSample(data: Omit<Sample, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Sample> {
    const existing = await runGet('SELECT id FROM samples WHERE barcode = ?', [data.barcode]);
    if (existing) {
      throw new Error(`条码 ${data.barcode} 已存在`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const sample: Sample = {
      ...data,
      id,
      status: SampleStatus.CREATED,
      createdAt: now,
      updatedAt: now
    };

    await runInsert(
      `INSERT INTO samples (id, barcode, status, type, collectionPoint, destinationLab, currentLocation, createdAt, updatedAt, currentHandler, batchId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sample.barcode, sample.status, sample.type, sample.collectionPoint, sample.destinationLab, sample.currentLocation, sample.createdAt, sample.updatedAt, sample.currentHandler, sample.batchId || null]
    );

    await this.addResponsibilityLink({
      sampleId: id,
      handler: sample.currentHandler,
      role: '创建人',
      startTime: now,
      location: sample.collectionPoint,
      action: '创建样本'
    });

    return sample;
  }

  static async getSampleById(id: string): Promise<Sample | null> {
    return runGet('SELECT * FROM samples WHERE id = ?', [id]);
  }

  static async getSampleByBarcode(barcode: string): Promise<Sample | null> {
    return runGet('SELECT * FROM samples WHERE barcode = ?', [barcode]);
  }

  static async getAllSamples(filters?: { status?: SampleStatus; batchId?: string }): Promise<Sample[]> {
    let sql = 'SELECT * FROM samples WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.batchId) {
      sql += ' AND batchId = ?';
      params.push(filters.batchId);
    }
    sql += ' ORDER BY createdAt DESC';

    return runQuery(sql, params);
  }

  static async updateSampleStatus(sampleId: string, newStatus: SampleStatus, handler: string, notes?: string): Promise<Sample> {
    const sample = await this.getSampleById(sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    const validation = StateMachineService.validateTransition(sample.status, newStatus);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const now = new Date().toISOString();
    await runInsert('UPDATE samples SET status = ?, updatedAt = ?, currentHandler = ? WHERE id = ?', [newStatus, now, handler, sampleId]);

    await this.addResponsibilityLink({
      sampleId,
      handler,
      role: '状态更新人',
      startTime: now,
      location: sample.currentLocation,
      action: `状态变更: ${sample.status} -> ${newStatus}${notes ? ` (${notes})` : ''}`
    });

    return { ...sample, status: newStatus, updatedAt: now, currentHandler: handler };
  }

  static async transferSample(transferData: Omit<Transfer, 'id' | 'status'> & { temperature?: number }): Promise<Transfer> {
    const sample = await this.getSampleById(transferData.sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    if (transferData.temperature !== undefined) {
      const tempValidation = TemperatureService.validateTemperature(transferData.temperature);
      if (!tempValidation.valid) {
        await TemperatureService.addTemperatureRecord({
          sampleId: transferData.sampleId,
          temperature: transferData.temperature,
          recordTime: transferData.transferTime,
          location: transferData.fromLocation,
          recordedBy: transferData.fromHandler
        });
        await ExceptionService.reportException({
          sampleId: transferData.sampleId,
          type: ExceptionType.TEMPERATURE_EXCEEDED,
          description: `交接时温度超标: ${transferData.temperature}°C，${tempValidation.message}`,
          reportedBy: transferData.fromHandler
        });
      }
    }

    const id = uuidv4();
    const transfer: Transfer = {
      ...transferData,
      id,
      status: 'CONFIRMED'
    };

    await runInsert(
      `INSERT INTO transfers (id, sampleId, fromHandler, toHandler, fromLocation, toLocation, transferTime, temperature, humidity, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, transfer.sampleId, transfer.fromHandler, transfer.toHandler, transfer.fromLocation, transfer.toLocation, transfer.transferTime, transfer.temperature || null, transfer.humidity || null, transfer.notes || null, transfer.status]
    );

    const now = new Date().toISOString();
    await runInsert('UPDATE samples SET currentLocation = ?, currentHandler = ?, updatedAt = ? WHERE id = ?', [transferData.toLocation, transferData.toHandler, now, transferData.sampleId]);

    await this.addResponsibilityLink({
      sampleId: transferData.sampleId,
      handler: transferData.fromHandler,
      role: '交出人',
      startTime: transferData.transferTime,
      location: transferData.fromLocation,
      action: `交接给 ${transferData.toHandler}`
    });

    await this.addResponsibilityLink({
      sampleId: transferData.sampleId,
      handler: transferData.toHandler,
      role: '接收人',
      startTime: transferData.transferTime,
      location: transferData.toLocation,
      action: `接收自 ${transferData.fromHandler}`
    });

    return transfer;
  }

  static async getTransferHistory(sampleId: string): Promise<Transfer[]> {
    return runQuery('SELECT * FROM transfers WHERE sampleId = ? ORDER BY transferTime DESC', [sampleId]);
  }

  static async addResponsibilityLink(data: Omit<ResponsibilityLink, 'id'>): Promise<ResponsibilityLink> {
    const id = uuidv4();
    const link: ResponsibilityLink = {
      ...data,
      id
    };

    await runInsert(
      `INSERT INTO responsibilityLinks (id, sampleId, handler, role, startTime, endTime, location, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, link.sampleId, link.handler, link.role, link.startTime, link.endTime || null, link.location, link.action]
    );

    return link;
  }

  static async getResponsibilityChain(sampleId: string): Promise<ResponsibilityLink[]> {
    return runQuery('SELECT * FROM responsibilityLinks WHERE sampleId = ? ORDER BY startTime', [sampleId]);
  }

  static async getStatistics() {
    const totalSamples = await runGet('SELECT COUNT(*) as count FROM samples');
    const statusCounts = await runQuery('SELECT status, COUNT(*) as count FROM samples GROUP BY status');
    
    return {
      total: totalSamples.count,
      byStatus: statusCounts.reduce((acc: any, row: any) => {
        acc[row.status] = row.count;
        return acc;
      }, {})
    };
  }
}
