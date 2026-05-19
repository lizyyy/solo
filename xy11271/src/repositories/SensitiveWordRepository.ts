import { AppDataSource } from "../config/database";
import { SensitiveWord, WordCategory } from "../models/SensitiveWord";
import { EntityManager } from "typeorm";

export class SensitiveWordRepository {
  private repository = AppDataSource.getRepository(SensitiveWord);

  async create(word: Partial<SensitiveWord>, manager?: EntityManager): Promise<SensitiveWord> {
    const repo = manager ? manager.getRepository(SensitiveWord) : this.repository;
    const entity = repo.create(word);
    return repo.save(entity);
  }

  async bulkCreate(words: Partial<SensitiveWord>[], manager?: EntityManager): Promise<SensitiveWord[]> {
    const repo = manager ? manager.getRepository(SensitiveWord) : this.repository;
    const entities = repo.create(words);
    return repo.save(entities, { chunk: 100 });
  }

  async findByWord(word: string): Promise<SensitiveWord | null> {
    return this.repository.findOne({ where: { word } });
  }

  async exists(word: string): Promise<boolean> {
    const count = await this.repository.count({ where: { word } });
    return count > 0;
  }

  async getActiveWords(): Promise<SensitiveWord[]> {
    return this.repository.find({ where: { isActive: true } });
  }

  async list(category?: WordCategory, limit: number = 200, offset: number = 0): Promise<SensitiveWord[]> {
    const where: any = {};
    if (category) where.category = category;

    return this.repository.find({
      where,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async update(id: string, data: Partial<SensitiveWord>, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(SensitiveWord) : this.repository;
    await repo.update(id, data);
  }

  async count(category?: WordCategory): Promise<number> {
    const where: any = {};
    if (category) where.category = category;
    return this.repository.count({ where });
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await this.repository.delete({ batchId });
  }
}
