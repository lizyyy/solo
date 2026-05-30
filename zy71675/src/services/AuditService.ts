import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ModificationLog } from '../entities/ModificationLog';
import { EntityType } from '../entities/enums';

export class AuditService {
  private logRepository: Repository<ModificationLog>;

  constructor() {
    this.logRepository = AppDataSource.getRepository(ModificationLog);
  }

  async logChange(
    entityType: EntityType,
    entityId: number,
    fieldName: string,
    oldValue: any,
    newValue: any,
    modifiedBy?: string,
    reason?: string,
    extraMetadata?: Record<string, any>
  ): Promise<ModificationLog> {
    const log = new ModificationLog();
    log.entityType = entityType;
    log.entityId = entityId;
    log.fieldName = fieldName;
    log.oldValue = oldValue !== undefined && oldValue !== null ? String(oldValue) : undefined;
    log.newValue = newValue !== undefined && newValue !== null ? String(newValue) : undefined;
    log.modifiedBy = modifiedBy;
    log.reason = reason;
    log.extraMetadata = extraMetadata ? JSON.stringify(extraMetadata) : undefined;

    return this.logRepository.save(log);
  }

  async logChanges(
    entityType: EntityType,
    entityId: number,
    changes: Array<{
      fieldName: string;
      oldValue: any;
      newValue: any;
    }>,
    modifiedBy?: string,
    reason?: string
  ): Promise<ModificationLog[]> {
    const logs: ModificationLog[] = [];

    for (const change of changes) {
      if (change.oldValue !== change.newValue) {
        const log = await this.logChange(
          entityType,
          entityId,
          change.fieldName,
          change.oldValue,
          change.newValue,
          modifiedBy,
          reason
        );
        logs.push(log);
      }
    }

    return logs;
  }

  async getEntityHistory(
    entityType: EntityType,
    entityId: number
  ): Promise<ModificationLog[]> {
    return this.logRepository.find({
      where: { entityType, entityId },
      order: { modifiedAt: 'DESC' },
    });
  }

  async getTrackFullHistory(trackId: number): Promise<ModificationLog[]> {
    const logs = await this.logRepository
      .createQueryBuilder('log')
      .where(
        '(log.entityType = :trackType AND log.entityId = :trackId) OR ' +
        '(log.entityType = :masterType AND log.entityId IN ' +
        '(SELECT m.id FROM master_file m WHERE m.trackId = :trackId)) OR ' +
        '(log.entityType = :coverType AND log.entityId IN ' +
        '(SELECT c.id FROM cover_art c WHERE c.trackId = :trackId)) OR ' +
        '(log.entityType = :deliveryType AND log.entityId IN ' +
        '(SELECT d.id FROM delivery_report d WHERE d.trackId = :trackId))',
        {
          trackType: EntityType.TRACK,
          masterType: EntityType.MASTER_FILE,
          coverType: EntityType.COVER_ART,
          deliveryType: EntityType.DELIVERY_REPORT,
          trackId,
        }
      )
      .orderBy('log.modifiedAt', 'DESC')
      .getMany();

    return logs;
  }

  async getFieldHistory(
    entityType: EntityType,
    entityId: number,
    fieldName: string
  ): Promise<ModificationLog[]> {
    return this.logRepository.find({
      where: { entityType, entityId, fieldName },
      order: { modifiedAt: 'DESC' },
    });
  }

  async getChangesByUser(modifiedBy: string, limit: number = 100): Promise<ModificationLog[]> {
    return this.logRepository.find({
      where: { modifiedBy },
      order: { modifiedAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentChanges(limit: number = 50): Promise<ModificationLog[]> {
    return this.logRepository.find({
      order: { modifiedAt: 'DESC' },
      take: limit,
    });
  }

  async compareVersions(
    entityType: EntityType,
    entityId: number,
    fromDate: Date,
    toDate: Date
  ): Promise<{ field: string; from: string | undefined; to: string | undefined }[]> {
    const logs = await this.logRepository
      .createQueryBuilder('log')
      .where('log.entityType = :entityType', { entityType })
      .andWhere('log.entityId = :entityId', { entityId })
      .andWhere('log.modifiedAt BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .orderBy('log.modifiedAt', 'ASC')
      .getMany();

    const changes: Map<string, { from: string | undefined; to: string | undefined }> = new Map();

    for (const log of logs) {
      if (!changes.has(log.fieldName)) {
        changes.set(log.fieldName, { from: log.oldValue, to: log.newValue });
      } else {
        const existing = changes.get(log.fieldName)!;
        existing.to = log.newValue;
      }
    }

    return Array.from(changes.entries()).map(([field, values]) => ({
      field,
      from: values.from,
      to: values.to,
    }));
  }
}
