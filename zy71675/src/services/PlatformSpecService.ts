import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { PlatformSpec } from '../entities/PlatformSpec';
import { EntityType } from '../entities/enums';
import { AuditService } from './AuditService';
import { Platform, AudioFormat, ImageFormat } from '../entities/enums';

export interface PlatformSpecCreateData {
  platform: Platform;
  name: string;
  description?: string;
  requiredAudioFormats?: AudioFormat[];
  minSampleRate?: number;
  maxSampleRate?: number;
  minBitDepth?: number;
  maxBitDepth?: number;
  minDuration?: number;
  maxDuration?: number;
  targetLoudnessIntegrated?: number;
  maxLoudnessIntegrated?: number;
  maxPeakLevel?: number;
  requiredImageFormats?: ImageFormat[];
  minCoverWidth?: number;
  maxCoverWidth?: number;
  minCoverHeight?: number;
  maxCoverHeight?: number;
  requireSquareCover?: boolean;
  minCoverDpi?: number;
  maxCoverFileSize?: number;
  allowTextOnCover?: boolean;
  requireIsrc?: boolean;
  requireUpc?: boolean;
  deliveryInstructions?: string;
  deliveryDeadline?: Date;
  platformFee?: number;
  metadataGuidelines?: string;
  version?: string;
  createdBy?: string;
}

export interface PlatformSpecUpdateData {
  name?: string;
  description?: string;
  requiredAudioFormats?: AudioFormat[];
  minSampleRate?: number;
  maxSampleRate?: number;
  minBitDepth?: number;
  maxBitDepth?: number;
  minDuration?: number;
  maxDuration?: number;
  targetLoudnessIntegrated?: number;
  maxLoudnessIntegrated?: number;
  maxPeakLevel?: number;
  requiredImageFormats?: ImageFormat[];
  minCoverWidth?: number;
  maxCoverWidth?: number;
  minCoverHeight?: number;
  maxCoverHeight?: number;
  requireSquareCover?: boolean;
  minCoverDpi?: number;
  maxCoverFileSize?: number;
  allowTextOnCover?: boolean;
  requireIsrc?: boolean;
  requireUpc?: boolean;
  deliveryInstructions?: string;
  deliveryDeadline?: Date;
  platformFee?: number;
  metadataGuidelines?: string;
  isActive?: boolean;
  version?: string;
}

export class PlatformSpecService {
  private platformSpecRepository: Repository<PlatformSpec>;
  private auditService: AuditService;

  constructor() {
    this.platformSpecRepository = AppDataSource.getRepository(PlatformSpec);
    this.auditService = new AuditService();
  }

  async createPlatformSpec(data: PlatformSpecCreateData): Promise<PlatformSpec> {
    const spec = new PlatformSpec();
    Object.assign(spec, data);

    const saved = await this.platformSpecRepository.save(spec);

    await this.auditService.logChange(
      EntityType.PLATFORM_SPEC,
      saved.id,
      'name',
      undefined,
      data.name,
      data.createdBy,
      '创建平台规格'
    );

    return saved;
  }

  async getPlatformSpec(id: number): Promise<PlatformSpec | null> {
    return this.platformSpecRepository.findOne({
      where: { id },
      relations: ['deliveryReports'],
    });
  }

  async getPlatformSpecByPlatform(platform: Platform): Promise<PlatformSpec | null> {
    return this.platformSpecRepository.findOne({
      where: { platform, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllPlatformSpecs(includeInactive: boolean = false): Promise<PlatformSpec[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.platformSpecRepository.find({
      where,
      order: { platform: 'ASC', createdAt: 'DESC' },
    });
  }

  async updatePlatformSpec(
    id: number,
    data: PlatformSpecUpdateData,
    modifiedBy?: string,
    reason?: string
  ): Promise<PlatformSpec> {
    const spec = await this.platformSpecRepository.findOne({ where: { id } });
    if (!spec) {
      throw new Error('平台规格不存在');
    }

    const changes: Array<{ fieldName: string; oldValue: any; newValue: any }> = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (spec as any)[key] !== value) {
        changes.push({
          fieldName: key,
          oldValue: (spec as any)[key],
          newValue: value,
        });
        (spec as any)[key] = value;
      }
    }

    const saved = await this.platformSpecRepository.save(spec);

    if (changes.length > 0) {
      await this.auditService.logChanges(
        EntityType.PLATFORM_SPEC,
        id,
        changes,
        modifiedBy,
        reason || '更新平台规格'
      );
    }

    return saved;
  }

  async deletePlatformSpec(id: number): Promise<void> {
    const spec = await this.platformSpecRepository.findOne({ where: { id } });
    if (!spec) {
      throw new Error('平台规格不存在');
    }

    await this.platformSpecRepository.remove(spec);
  }

  async deactivatePlatformSpec(id: number, modifiedBy?: string): Promise<PlatformSpec> {
    return this.updatePlatformSpec(
      id,
      { isActive: false },
      modifiedBy,
      '停用平台规格'
    );
  }

  async activatePlatformSpec(id: number, modifiedBy?: string): Promise<PlatformSpec> {
    return this.updatePlatformSpec(
      id,
      { isActive: true },
      modifiedBy,
      '启用平台规格'
    );
  }
}
