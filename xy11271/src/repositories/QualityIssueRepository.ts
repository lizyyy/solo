import { AppDataSource } from "../config/database";
import { QualityIssue, IssueType, IssueStatus } from "../models/QualityIssue";
import { EntityManager, In } from "typeorm";

export class QualityIssueRepository {
  private repository = AppDataSource.getRepository(QualityIssue);

  async create(issue: Partial<QualityIssue>, manager?: EntityManager): Promise<QualityIssue> {
    const repo = manager ? manager.getRepository(QualityIssue) : this.repository;
    const entity = repo.create(issue);
    return repo.save(entity);
  }

  async bulkCreate(issues: Partial<QualityIssue>[], manager?: EntityManager): Promise<QualityIssue[]> {
    const repo = manager ? manager.getRepository(QualityIssue) : this.repository;
    const entities = repo.create(issues);
    return repo.save(entities, { chunk: 100 });
  }

  async findById(id: string): Promise<QualityIssue | null> {
    return this.repository.findOne({
      where: { id },
      relations: ["transcript", "review"],
    });
  }

  async findByTranscriptId(transcriptId: string): Promise<QualityIssue[]> {
    return this.repository.find({
      where: { transcriptId },
      order: { createdAt: "ASC" },
    });
  }

  async list(
    type?: IssueType,
    status?: IssueStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<QualityIssue[]> {
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    return this.repository.find({
      where,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
      relations: ["transcript"],
    });
  }

  async update(id: string, data: Partial<QualityIssue>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(QualityIssue) : this.repository;
    await repo.update(id, data);
  }

  async updateStatus(id: string, status: IssueStatus): Promise<void> {
    await this.repository.update(id, { status });
  }

  async count(type?: IssueType, status?: IssueStatus): Promise<number> {
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    return this.repository.count({ where });
  }

  async deleteByTranscriptId(transcriptId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(QualityIssue) : this.repository;
    await repo.delete({ transcriptId });
  }
}
