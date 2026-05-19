import { AppDataSource } from "../config/database";
import { CallRecord } from "../models/CallRecord";
import { EntityManager } from "typeorm";

export class CallRecordRepository {
  private repository = AppDataSource.getRepository(CallRecord);

  async create(record: Partial<CallRecord>, manager?: EntityManager): Promise<CallRecord> {
    const repo = manager ? manager.getRepository(CallRecord) : this.repository;
    const entity = repo.create(record);
    return repo.save(entity);
  }

  async bulkCreate(records: Partial<CallRecord>[], manager?: EntityManager): Promise<CallRecord[]> {
    const repo = manager ? manager.getRepository(CallRecord) : this.repository;
    const entities = repo.create(records);
    return repo.save(entities, { chunk: 100 });
  }

  async findByCallId(callId: string): Promise<CallRecord | null> {
    return this.repository.findOne({
      where: { callId },
      relations: ["transcript"],
    });
  }

  async exists(callId: string): Promise<boolean> {
    const count = await this.repository.count({ where: { callId } });
    return count > 0;
  }

  async list(limit: number = 100, offset: number = 0): Promise<CallRecord[]> {
    return this.repository.find({
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
      relations: ["transcript"],
    });
  }

  async update(callId: string, data: Partial<CallRecord>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(CallRecord) : this.repository;
    await repo.update({ callId }, data);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await this.repository.delete({ batchId });
  }
}
