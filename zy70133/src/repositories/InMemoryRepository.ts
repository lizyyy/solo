import { UUID } from '../types';
import { IQueryableRepository } from './types';

export class InMemoryRepository<T extends { id: UUID }> implements IQueryableRepository<T> {
  protected entities: Map<UUID, T> = new Map();

  async findAll(): Promise<T[]> {
    return Array.from(this.entities.values());
  }

  async findById(id: UUID): Promise<T | undefined> {
    return this.entities.get(id);
  }

  async findByQuery(query: Partial<T>): Promise<T[]> {
    const results: T[] = [];
    for (const entity of this.entities.values()) {
      if (this.matchesQuery(entity, query)) {
        results.push(entity);
      }
    }
    return results;
  }

  async findOneByQuery(query: Partial<T>): Promise<T | undefined> {
    for (const entity of this.entities.values()) {
      if (this.matchesQuery(entity, query)) {
        return entity;
      }
    }
    return undefined;
  }

  async save(entity: T): Promise<T> {
    this.entities.set(entity.id, { ...entity });
    return this.entities.get(entity.id)!;
  }

  async delete(id: UUID): Promise<boolean> {
    return this.entities.delete(id);
  }

  private matchesQuery(entity: T, query: Partial<T>): boolean {
    for (const key in query) {
      if (query[key] !== undefined) {
        if (entity[key] !== query[key]) {
          return false;
        }
      }
    }
    return true;
  }
}
