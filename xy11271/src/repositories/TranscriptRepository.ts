import { AppDataSource } from "../config/database";
import { Transcript, TranscriptStatus } from "../models/Transcript";
import { In, EntityManager } from "typeorm";

export interface TranscriptFilter {
  callId?: string;
  status?: TranscriptStatus;
  hasIssues?: boolean;
  hasApology?: boolean;
  hasRefundPromise?: boolean;
  hasSensitiveWords?: boolean;
  batchId?: string;
}

export class TranscriptRepository {
  private repository = AppDataSource.getRepository(Transcript);

  async create(transcript: Partial<Transcript>, manager?: EntityManager): Promise<Transcript> {
    const repo = manager ? manager.getRepository(Transcript) : this.repository;
    const entity = repo.create(transcript);
    return repo.save(entity);
  }

  async bulkCreate(transcripts: Partial<Transcript>[], manager?: EntityManager): Promise<Transcript[]> {
    const repo = manager ? manager.getRepository(Transcript) : this.repository;
    const entities = repo.create(transcripts);
    return repo.save(entities, { chunk: 100 });
  }

  async findByCallId(callId: string): Promise<Transcript | null> {
    return this.repository.findOne({
      where: { callId },
      relations: ["issues", "callRecord"],
    });
  }

  async exists(callId: string): Promise<boolean> {
    const count = await this.repository.count({ where: { callId } });
    return count > 0;
  }

  async findById(id: string): Promise<Transcript | null> {
    return this.repository.findOne({
      where: { id },
      relations: ["issues", "callRecord"],
    });
  }

  async list(filter: TranscriptFilter = {}, limit: number = 100, offset: number = 0): Promise<Transcript[]> {
    const where: any = {};
    if (filter.callId) where.callId = filter.callId;
    if (filter.status) where.status = filter.status;
    if (filter.batchId) where.batchId = filter.batchId;
    if (filter.hasApology !== undefined) where.hasApology = filter.hasApology;
    if (filter.hasRefundPromise !== undefined) where.hasRefundPromise = filter.hasRefundPromise;
    if (filter.hasSensitiveWords !== undefined) where.hasSensitiveWords = filter.hasSensitiveWords;
    if (filter.hasIssues) where.issueCount = () => "> 0";

    return this.repository.find({
      where,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
      relations: ["issues", "callRecord"],
    });
  }

  async update(id: string, data: Partial<Transcript>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Transcript) : this.repository;
    await repo.update(id, data);
  }

  async updateByCallId(callId: string, data: Partial<Transcript>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Transcript) : this.repository;
    await repo.update({ callId }, data);
  }

  async count(filter: TranscriptFilter = {}): Promise<number> {
    const where: any = {};
    if (filter.callId) where.callId = filter.callId;
    if (filter.status) where.status = filter.status;
    if (filter.batchId) where.batchId = filter.batchId;
    if (filter.hasApology !== undefined) where.hasApology = filter.hasApology;
    if (filter.hasRefundPromise !== undefined) where.hasRefundPromise = filter.hasRefundPromise;
    if (filter.hasSensitiveWords !== undefined) where.hasSensitiveWords = filter.hasSensitiveWords;

    return this.repository.count({ where });
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await this.repository.delete({ batchId });
  }

  async getCallIdsByBatch(batchId: string): Promise<string[]> {
    const transcripts = await this.repository.find({
      where: { batchId },
      select: ["callId"],
    });
    return transcripts.map((t) => t.callId);
  }
}
