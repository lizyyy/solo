import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { MasterFile } from '../entities/MasterFile';
import { CoverArt } from '../entities/CoverArt';
import { PlatformSpec } from '../entities/PlatformSpec';
import { Track } from '../entities/Track';
import { FileStatus, EntityType, AnomalyType, AnomalySeverity } from '../entities/enums';
import { AnomalyService } from './AnomalyService';
import { AuditService } from './AuditService';

export class ValidationService {
  private masterFileRepository: Repository<MasterFile>;
  private coverArtRepository: Repository<CoverArt>;
  private platformSpecRepository: Repository<PlatformSpec>;
  private trackRepository: Repository<Track>;
  private anomalyService: AnomalyService;
  private auditService: AuditService;

  constructor() {
    this.masterFileRepository = AppDataSource.getRepository(MasterFile);
    this.coverArtRepository = AppDataSource.getRepository(CoverArt);
    this.platformSpecRepository = AppDataSource.getRepository(PlatformSpec);
    this.trackRepository = AppDataSource.getRepository(Track);
    this.anomalyService = new AnomalyService();
    this.auditService = new AuditService();
  }

  async validateMasterFileAgainstSpec(
    masterFileId: number,
    platformSpecId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const masterFile = await this.masterFileRepository.findOne({
      where: { id: masterFileId },
      relations: ['track'],
    });

    const spec = await this.platformSpecRepository.findOne({
      where: { id: platformSpecId },
    });

    if (!masterFile || !spec) {
      return { valid: false, errors: ['母带文件或平台规格不存在'] };
    }

    const errors: string[] = [];

    if (spec.requiredAudioFormats && spec.requiredAudioFormats.length > 0) {
      if (!spec.requiredAudioFormats.includes(masterFile.format)) {
        errors.push(
          `音频格式不匹配：要求 ${spec.requiredAudioFormats.join('/')}，实际 ${masterFile.format}`
        );
      }
    }

    if (spec.minSampleRate && masterFile.sampleRate) {
      if (masterFile.sampleRate < spec.minSampleRate) {
        errors.push(
          `采样率过低：要求最低 ${spec.minSampleRate} Hz，实际 ${masterFile.sampleRate} Hz`
        );
      }
    }

    if (spec.maxSampleRate && masterFile.sampleRate) {
      if (masterFile.sampleRate > spec.maxSampleRate) {
        errors.push(
          `采样率过高：要求最高 ${spec.maxSampleRate} Hz，实际 ${masterFile.sampleRate} Hz`
        );
      }
    }

    if (spec.minBitDepth && masterFile.bitDepth) {
      if (masterFile.bitDepth < spec.minBitDepth) {
        errors.push(
          `比特深度过低：要求最低 ${spec.minBitDepth} bit，实际 ${masterFile.bitDepth} bit`
        );
      }
    }

    if (spec.maxBitDepth && masterFile.bitDepth) {
      if (masterFile.bitDepth > spec.maxBitDepth) {
        errors.push(
          `比特深度过高：要求最高 ${spec.maxBitDepth} bit，实际 ${masterFile.bitDepth} bit`
        );
      }
    }

    if (spec.minDuration && masterFile.duration) {
      if (masterFile.duration < spec.minDuration) {
        errors.push(
          `时长过短：要求最低 ${spec.minDuration} 秒，实际 ${masterFile.duration} 秒`
        );
      }
    }

    if (spec.maxDuration && masterFile.duration) {
      if (masterFile.duration > spec.maxDuration) {
        errors.push(
          `时长过长：要求最高 ${spec.maxDuration} 秒，实际 ${masterFile.duration} 秒`
        );
      }
    }

    if (spec.targetLoudnessIntegrated !== undefined && masterFile.loudnessIntegrated !== undefined) {
      const tolerance = 1.0;
      if (Math.abs(masterFile.loudnessIntegrated - spec.targetLoudnessIntegrated) > tolerance) {
        errors.push(
          `响度偏离目标：要求 ${spec.targetLoudnessIntegrated} LUFS，实际 ${masterFile.loudnessIntegrated} LUFS`
        );
      }
    }

    if (spec.maxLoudnessIntegrated !== undefined && masterFile.loudnessIntegrated !== undefined) {
      if (masterFile.loudnessIntegrated > spec.maxLoudnessIntegrated) {
        errors.push(
          `响度过高：要求最高 ${spec.maxLoudnessIntegrated} LUFS，实际 ${masterFile.loudnessIntegrated} LUFS`
        );
      }
    }

    if (spec.maxPeakLevel !== undefined && masterFile.peakLevel !== undefined) {
      if (masterFile.peakLevel > spec.maxPeakLevel) {
        errors.push(
          `峰值电平过高：要求最高 ${spec.maxPeakLevel} dBFS，实际 ${masterFile.peakLevel} dBFS`
        );
      }
    }

    if (errors.length > 0) {
      await this.anomalyService.createAnomaly(
        masterFile.trackId,
        AnomalyType.SPEC_MISMATCH,
        AnomalySeverity.HIGH,
        `母带规格不符（${spec.name}）：${errors.join('; ')}`,
        EntityType.MASTER_FILE,
        masterFile.id,
        {
          impactOnMoney: '规格不符可能导致平台审核不通过，延迟上线，影响版税收入',
          impactOnTime: '需要重新制作母带，可能影响发行时间',
          impactOnRoster: '延期发行可能影响厂牌发行排期和艺人曝光机会',
          affectedFields: ['format', 'sampleRate', 'bitDepth', 'loudnessIntegrated', 'peakLevel'],
          suggestedActions: [
            '联系母带工程师重新处理',
            '调整母带参数以符合平台规格',
            '与平台沟通是否有豁免空间',
          ],
        }
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateCoverArtAgainstSpec(
    coverArtId: number,
    platformSpecId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const coverArt = await this.coverArtRepository.findOne({
      where: { id: coverArtId },
      relations: ['track'],
    });

    const spec = await this.platformSpecRepository.findOne({
      where: { id: platformSpecId },
    });

    if (!coverArt || !spec) {
      return { valid: false, errors: ['封面文件或平台规格不存在'] };
    }

    const errors: string[] = [];

    if (spec.requiredImageFormats && spec.requiredImageFormats.length > 0) {
      if (!spec.requiredImageFormats.includes(coverArt.format)) {
        errors.push(
          `图片格式不匹配：要求 ${spec.requiredImageFormats.join('/')}，实际 ${coverArt.format}`
        );
      }
    }

    if (spec.minCoverWidth && coverArt.width) {
      if (coverArt.width < spec.minCoverWidth) {
        errors.push(
          `封面宽度不足：要求最低 ${spec.minCoverWidth}px，实际 ${coverArt.width}px`
        );
      }
    }

    if (spec.maxCoverWidth && coverArt.width) {
      if (coverArt.width > spec.maxCoverWidth) {
        errors.push(
          `封面宽度过大：要求最高 ${spec.maxCoverWidth}px，实际 ${coverArt.width}px`
        );
      }
    }

    if (spec.minCoverHeight && coverArt.height) {
      if (coverArt.height < spec.minCoverHeight) {
        errors.push(
          `封面高度不足：要求最低 ${spec.minCoverHeight}px，实际 ${coverArt.height}px`
        );
      }
    }

    if (spec.maxCoverHeight && coverArt.height) {
      if (coverArt.height > spec.maxCoverHeight) {
        errors.push(
          `封面高度过大：要求最高 ${spec.maxCoverHeight}px，实际 ${coverArt.height}px`
        );
      }
    }

    if (spec.requireSquareCover && coverArt.width && coverArt.height) {
      if (coverArt.width !== coverArt.height) {
        errors.push(
          `封面必须为正方形：实际 ${coverArt.width}x${coverArt.height}px`
        );
      }
    }

    if (spec.minCoverDpi && coverArt.dpi) {
      if (coverArt.dpi < spec.minCoverDpi) {
        errors.push(
          `封面分辨率不足：要求最低 ${spec.minCoverDpi} DPI，实际 ${coverArt.dpi} DPI`
        );
      }
    }

    if (spec.maxCoverFileSize && coverArt.fileSize) {
      if (coverArt.fileSize > spec.maxCoverFileSize) {
        errors.push(
          `封面文件过大：要求最高 ${(spec.maxCoverFileSize / 1024 / 1024).toFixed(2)}MB，实际 ${(coverArt.fileSize / 1024 / 1024).toFixed(2)}MB`
        );
      }
    }

    if (!spec.allowTextOnCover && coverArt.hasTextOverlay) {
      errors.push('封面不允许包含文字叠加');
    }

    if (errors.length > 0) {
      await this.anomalyService.createAnomaly(
        coverArt.trackId,
        AnomalyType.SPEC_MISMATCH,
        AnomalySeverity.HIGH,
        `封面规格不符（${spec.name}）：${errors.join('; ')}`,
        EntityType.COVER_ART,
        coverArt.id,
        {
          impactOnMoney: '封面规格不符可能导致平台审核不通过，延迟上线，影响版税收入',
          impactOnTime: '需要重新设计封面，可能影响发行时间',
          impactOnRoster: '延期发行可能影响厂牌发行排期和艺人曝光机会',
          affectedFields: ['format', 'width', 'height', 'dpi', 'hasTextOverlay'],
          suggestedActions: [
            '联系设计师重新调整封面',
            '导出符合平台规格的封面文件',
            '检查封面是否有不允许的文字元素',
          ],
        }
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateTrackMetadata(
    trackId: number,
    platformSpecId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const track = await this.trackRepository.findOne({
      where: { id: trackId },
    });

    const spec = await this.platformSpecRepository.findOne({
      where: { id: platformSpecId },
    });

    if (!track || !spec) {
      return { valid: false, errors: ['曲目或平台规格不存在'] };
    }

    const errors: string[] = [];

    if (spec.requireIsrc && !track.isrc) {
      errors.push('缺少 ISRC 编码');
    }

    if (spec.requireUpc && !track.upc) {
      errors.push('缺少 UPC 编码');
    }

    if (!track.title || track.title.trim().length === 0) {
      errors.push('缺少曲目名称');
    }

    if (!track.artist || track.artist.trim().length === 0) {
      errors.push('缺少艺人名称');
    }

    if (errors.length > 0) {
      await this.anomalyService.createAnomaly(
        track.id,
        AnomalyType.MISSING_METADATA,
        AnomalySeverity.MEDIUM,
        `元数据缺失（${spec.name}）：${errors.join('; ')}`,
        EntityType.TRACK,
        track.id,
        {
          impactOnMoney: '元数据缺失可能导致平台审核不通过，影响版税分配',
          impactOnTime: '需要补充缺失信息，可能延迟发行',
          impactOnRoster: '可能影响发行计划和艺人曝光',
          affectedFields: ['isrc', 'upc', 'title', 'artist'],
          suggestedActions: [
            '向版权管理部门申请 ISRC/UPC',
            '确认并填写完整的曲目信息',
            '核对艺人合同中的署名方式',
          ],
        }
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateMasterFile(masterFileId: number, validatedBy?: string): Promise<MasterFile> {
    const masterFile = await this.masterFileRepository.findOne({
      where: { id: masterFileId },
    });

    if (!masterFile) {
      throw new Error('母带文件不存在');
    }

    const errors: string[] = [];

    if (!masterFile.sampleRate) {
      errors.push('缺少采样率信息');
    }

    if (!masterFile.bitDepth) {
      errors.push('缺少比特深度信息');
    }

    if (!masterFile.duration) {
      errors.push('缺少时长信息');
    }

    if (!masterFile.checksum) {
      errors.push('缺少文件校验和');
    }

    const oldStatus = masterFile.status;
    const oldErrors = masterFile.validationErrors;

    if (errors.length === 0) {
      masterFile.status = FileStatus.VALID;
      masterFile.validationErrors = undefined;
    } else {
      masterFile.status = FileStatus.INVALID;
      masterFile.validationErrors = errors;
    }

    masterFile.validatedBy = validatedBy;
    masterFile.validatedAt = new Date();

    const saved = await this.masterFileRepository.save(masterFile);

    await this.auditService.logChanges(
      EntityType.MASTER_FILE,
      masterFileId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: saved.status },
        { fieldName: 'validationErrors', oldValue: JSON.stringify(oldErrors), newValue: JSON.stringify(saved.validationErrors) },
        { fieldName: 'validatedBy', oldValue: undefined, newValue: validatedBy },
        { fieldName: 'validatedAt', oldValue: undefined, newValue: saved.validatedAt?.toISOString() },
      ],
      validatedBy,
      '母带文件校验'
    );

    return saved;
  }

  async validateCoverArt(coverArtId: number, validatedBy?: string): Promise<CoverArt> {
    const coverArt = await this.coverArtRepository.findOne({
      where: { id: coverArtId },
    });

    if (!coverArt) {
      throw new Error('封面文件不存在');
    }

    const errors: string[] = [];

    if (!coverArt.width || !coverArt.height) {
      errors.push('缺少封面尺寸信息');
    }

    if (!coverArt.checksum) {
      errors.push('缺少文件校验和');
    }

    const oldStatus = coverArt.status;
    const oldErrors = coverArt.validationErrors;

    if (errors.length === 0) {
      coverArt.status = FileStatus.VALID;
      coverArt.validationErrors = undefined;
    } else {
      coverArt.status = FileStatus.INVALID;
      coverArt.validationErrors = errors;
    }

    coverArt.validatedBy = validatedBy;
    coverArt.validatedAt = new Date();

    const saved = await this.coverArtRepository.save(coverArt);

    await this.auditService.logChanges(
      EntityType.COVER_ART,
      coverArtId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: saved.status },
        { fieldName: 'validationErrors', oldValue: JSON.stringify(oldErrors), newValue: JSON.stringify(saved.validationErrors) },
        { fieldName: 'validatedBy', oldValue: undefined, newValue: validatedBy },
        { fieldName: 'validatedAt', oldValue: undefined, newValue: saved.validatedAt?.toISOString() },
      ],
      validatedBy,
      '封面文件校验'
    );

    return saved;
  }

  async checkDeadlineRisk(platformSpecId: number): Promise<boolean> {
    const spec = await this.platformSpecRepository.findOne({
      where: { id: platformSpecId },
    });

    if (!spec || !spec.deliveryDeadline) {
      return false;
    }

    const now = new Date();
    const deadline = new Date(spec.deliveryDeadline);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilDeadline <= 7;
  }
}
