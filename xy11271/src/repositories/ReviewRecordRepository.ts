import { AppDataSource } from "../config/database";
import { ReviewRecord, ReviewStatus, ReviewResult } from "../models/ReviewRecord";
import { EntityManager } from "typeorm";

export class ReviewRecordRepository {
  private repository = AppDataSource.getRepository(ReviewRecord);

  async create(record: Partial<ReviewRecord>, manager?: EntityManager): Promise<ReviewRecord> {
    const repo = manager ? manager.getRepository(ReviewRecord) : this.repository;
    const entity = repo.create(record);
    return repo.save(entity);
  }

  async findById(id: string): Promise<ReviewRecord | null> {
    return this.repository.findOne({
      where: { id },
      relations: ["transcript", "issues"],
    });
  }

  async findByTranscriptId(transcriptId: string): Promise<ReviewRecord[]> {
    return this.repository.find({
      where: { transcriptId },
      order: { createdAt: "DESC" },
    });
  }

  async list(
    status?: ReviewStatus,
    result?: ReviewResult,
    limit: number = 100,
    offset: number = 0
  ): Promise<ReviewRecord[]> {
    const where: any = {};
    if (status) where.status = status;
    if (result) where.result = result;

    return this.repository.find({
      where,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
      relations: ["transcript"],
    });
  }

  async update(id: string, data: Partial<ReviewRecord>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(ReviewRecord) : this.repository;
    await repo.update(id, data);
  }

  async count(status?: ReviewStatus, result?: ReviewResult): Promise<number> {
    const where: any = {};
    if (status) where.status = status;
    if (result) where.result = result;
    return this.repository.count({ where });
  }
}
