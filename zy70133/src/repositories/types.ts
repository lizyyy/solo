import { UUID } from '../types';

export interface IRepository<T> {
  findAll(): Promise<T[]>;
  findById(id: UUID): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  delete(id: UUID): Promise<boolean>;
}

export interface IQueryableRepository<T> extends IRepository<T> {
  findByQuery(query: Partial<T>): Promise<T[]>;
  findOneByQuery(query: Partial<T>): Promise<T | undefined>;
}
