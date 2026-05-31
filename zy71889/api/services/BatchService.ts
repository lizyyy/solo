import { BatchRepository } from '../repositories/BatchRepository.js';
import { SensorLogRepository } from '../repositories/SensorLogRepository.js';
import { ExperimentRecordRepository } from '../repositories/ExperimentRecordRepository.js';
import type { ExperimentBatch, CreateBatchRequest, TimelineEvent } from '../../shared/types.js';

export class BatchService {
  private batchRepo = new BatchRepository();
  private sensorLogRepo = new SensorLogRepository();
  private experimentRecordRepo = new ExperimentRecordRepository();

  getAllBatches(): ExperimentBatch[] {
    return this.batchRepo.findAll();
  }

  getBatchById(id: string): ExperimentBatch | null {
    return this.batchRepo.findById(id);
  }

  getBatchVersions(materialId: string, studentId: string): ExperimentBatch[] {
    return this.batchRepo.findByMaterialAndStudent(materialId, studentId);
  }

  createBatch(request: CreateBatchRequest): { batch: ExperimentBatch; isDuplicate: boolean; existingBatches: ExperimentBatch[] } {
    const existingBatches = this.batchRepo.findByMaterialAndStudent(
      request.materialId,
      request.studentId
    );

    const isDuplicate = existingBatches.length > 0;
    const version = existingBatches.length + 1;
    const parentBatchId = existingBatches.length > 0 ? existingBatches[existingBatches.length - 1].id : undefined;

    const status = request.sensorLogs && request.sensorLogs.length > 0 ? 'pending' : 'needs_review';

    const batch = this.batchRepo.create({
      materialId: request.materialId,
      studentId: request.studentId,
      studentName: request.studentName,
      status,
      version,
      parentBatchId,
    });

    if (request.sensorLogs) {
      for (const log of request.sensorLogs) {
        this.sensorLogRepo.create({
          batchId: batch.id,
          timestamp: log.timestamp,
          temperature: log.temperature,
          sphereDiameter: log.sphereDiameter,
          fallTime: log.fallTime,
          fallDistance: log.fallDistance,
          rawData: log.rawData,
        });
      }
    }

    if (request.experimentRecords) {
      for (const record of request.experimentRecords) {
        this.experimentRecordRepo.create({
          batchId: batch.id,
          timestamp: record.timestamp,
          type: record.type,
          content: record.content,
          author: record.author,
        });
      }
    }

    return { batch, isDuplicate, existingBatches };
  }

  updateBatchStatus(id: string, status: ExperimentBatch['status']): ExperimentBatch | null {
    return this.batchRepo.updateStatus(id, status);
  }

  getTimeline(batchId: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    const sensorLogs = this.sensorLogRepo.findByBatchId(batchId);
    for (const log of sensorLogs) {
      events.push({
        id: log.id,
        batchId: log.batchId,
        timestamp: log.timestamp,
        type: 'sensor_log',
        data: log,
      });
    }

    const records = this.experimentRecordRepo.findByBatchId(batchId);
    for (const record of records) {
      events.push({
        id: record.id,
        batchId: record.batchId,
        timestamp: record.timestamp,
        type: 'experiment_record',
        data: record,
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
