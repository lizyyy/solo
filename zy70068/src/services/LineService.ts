import { LineVersion, Stop } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { LineVersionNotFoundError } from '../models/errors';

export class LineService {
  createLineVersion(
    lineId: string,
    lineName: string,
    stops: Stop[],
    effectiveFrom: Date = new Date()
  ): LineVersion {
    const existingVersions = repository.findAllLineVersions(lineId);
    const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    if (existingVersions.length > 0 && existingVersions[0].effectiveTo === undefined) {
      existingVersions[0].effectiveTo = effectiveFrom;
      repository.saveLineVersion(existingVersions[0]);
    }

    const version: LineVersion = {
      id: repository.generateId(),
      lineId,
      lineName,
      version: nextVersion,
      stops: [...stops].sort((a, b) => a.order - b.order),
      effectiveFrom,
      createdAt: new Date(),
    };

    return repository.saveLineVersion(version);
  }

  getActiveLineVersion(lineId: string): LineVersion {
    const version = repository.findActiveLineVersion(lineId);
    if (!version) {
      throw new LineVersionNotFoundError(lineId);
    }
    return version;
  }

  getLineVersions(lineId: string): LineVersion[] {
    return repository.findAllLineVersions(lineId);
  }

  getStopById(lineId: string, stopId: string): Stop | undefined {
    const version = this.getActiveLineVersion(lineId);
    return version.stops.find((s) => s.id === stopId);
  }

  getStopName(lineId: string, stopId: string): string {
    const stop = this.getStopById(lineId, stopId);
    return stop?.name || stopId;
  }
}

export const lineService = new LineService();
