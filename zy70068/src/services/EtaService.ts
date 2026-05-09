import { StopEta, EtaSource } from '../models/types';
import { repository } from '../repositories/MemoryRepository';

export interface CreateEtaRequest {
  lineId: string;
  stopId: string;
  estimatedArrival: Date;
  source: EtaSource;
  detourEventId?: string;
  ttlMinutes?: number;
}

export class EtaService {
  private readonly DEFAULT_TTL_MINUTES = 30;
  private readonly MIN_UPDATE_INTERVAL_MINUTES = 2;

  createEta(request: CreateEtaRequest): StopEta | null {
    const existingLatest = repository.findLatestEta(request.stopId, request.lineId);
    
    if (existingLatest) {
      const timeDiff = request.estimatedArrival.getTime() - existingLatest.estimatedArrival.getTime();
      const diffMinutes = Math.abs(timeDiff) / (1000 * 60);
      
      if (diffMinutes < this.MIN_UPDATE_INTERVAL_MINUTES) {
        return null;
      }
    }

    const now = new Date();
    const ttlMinutes = request.ttlMinutes ?? this.DEFAULT_TTL_MINUTES;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const eta: StopEta = {
      id: repository.generateId(),
      stopId: request.stopId,
      lineId: request.lineId,
      detourEventId: request.detourEventId,
      estimatedArrival: request.estimatedArrival,
      source: request.source,
      createdAt: now,
      expiresAt,
    };

    return repository.saveStopEta(eta);
  }

  recordActualArrival(lineId: string, stopId: string, actualTime?: Date): StopEta | null {
    const latestEta = repository.findLatestEta(stopId, lineId);
    if (!latestEta) {
      return null;
    }

    latestEta.actualArrival = actualTime ?? new Date();
    return repository.saveStopEta(latestEta);
  }

  getLatestEta(lineId: string, stopId: string): StopEta | undefined {
    return repository.findLatestEta(stopId, lineId);
  }

  getEtasByDetour(detourEventId: string): StopEta[] {
    return repository.findEtasByDetour(detourEventId);
  }

  calculateDelay(eta: StopEta): number {
    if (!eta.actualArrival) {
      const now = new Date();
      const delay = now.getTime() - eta.estimatedArrival.getTime();
      return Math.max(0, delay / (1000 * 60));
    }
    const delay = eta.actualArrival.getTime() - eta.estimatedArrival.getTime();
    return Math.max(0, delay / (1000 * 60));
  }
}

export const etaService = new EtaService();
