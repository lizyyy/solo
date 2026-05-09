import { CardReplacementRequest } from '../types';

export interface ReplacementRepository {
  save(request: CardReplacementRequest): void;
  findById(id: string): CardReplacementRequest | undefined;
  findByUserId(userId: string): CardReplacementRequest[];
  findAll(): CardReplacementRequest[];
  exists(id: string): boolean;
}

export class InMemoryReplacementRepository implements ReplacementRepository {
  private storage: Map<string, CardReplacementRequest> = new Map();

  save(request: CardReplacementRequest): void {
    this.storage.set(request.id, request);
  }

  findById(id: string): CardReplacementRequest | undefined {
    return this.storage.get(id);
  }

  findByUserId(userId: string): CardReplacementRequest[] {
    return Array.from(this.storage.values()).filter((r) => r.userId === userId);
  }

  findAll(): CardReplacementRequest[] {
    return Array.from(this.storage.values());
  }

  exists(id: string): boolean {
    return this.storage.has(id);
  }
}

const globalRepository = new InMemoryReplacementRepository();

export const getRepository = (): ReplacementRepository => {
  return globalRepository;
};

export const resetRepository = (): void => {
  const repo = getRepository() as InMemoryReplacementRepository;
  repo['storage'].clear();
};
