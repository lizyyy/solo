import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Track } from '../entities/Track';
import { MasterFile } from '../entities/MasterFile';
import { CoverArt } from '../entities/CoverArt';
import { FileStatus, EntityType, AnomalyType, AnomalySeverity } from '../entities/enums';
import { AuditService } from './AuditService';
import { AnomalyService } from './AnomalyService';
import { AudioFormat, ImageFormat } from '../entities/enums';

export interface MasterFileUploadData {
  fileName: string;
  filePath: string;
  fileSize?: number;
  duration?: number;
  sampleRate?: number;
  bitDepth?: number;
  bitRate?: number;
  format: AudioFormat;
  channels?: number;
  checksum?: string;
  notes?: string;
  peakLevel?: number;
  loudnessIntegrated?: number;
  loudnessRange?: number;
  uploadedBy?: string;
}

export interface CoverArtUploadData {
  fileName: string;
  filePath: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format: ImageFormat;
  dpi?: number;
  colorProfile?: string;
  checksum?: string;
  notes?: string;
  hasExplicitContent?: boolean;
  hasTextOverlay?: boolean;
  uploadedBy?: string;
}

export class VersionService {
  private trackRepository: Repository<Track>;
  private masterFileRepository: Repository<MasterFile>;
  private coverArtRepository: Repository<CoverArt>;
  private auditService: AuditService;
  private anomalyService: AnomalyService;

  constructor() {
    this.trackRepository = AppDataSource.getRepository(Track);
    this.masterFileRepository = AppDataSource.getRepository(MasterFile);
    this.coverArtRepository = AppDataSource.getRepository(CoverArt);
    this.auditService = new AuditService();
    this.anomalyService = new AnomalyService();
  }

  async getNextMasterVersion(trackId: number): Promise<number> {
    const latest = await this.masterFileRepository
      .createQueryBuilder('master')
      .where('master.trackId = :trackId', { trackId })
      .orderBy('master.version', 'DESC')
      .getOne();

    return latest ? latest.version + 1 : 1;
  }

  async getNextCoverVersion(trackId: number): Promise<number> {
    const latest = await this.coverArtRepository
      .createQueryBuilder('cover')
      .where('cover.trackId = :trackId', { trackId })
      .orderBy('cover.version', 'DESC')
      .getOne();

    return latest ? latest.version + 1 : 1;
  }

  async uploadMasterFile(
    trackId: number,
    data: MasterFileUploadData
  ): Promise<MasterFile> {
    const track = await this.trackRepository.findOne({ where: { id: trackId } });
    if (!track) {
      throw new Error('曲目不存在');
    }

    const currentLatest = await this.masterFileRepository.findOne({
      where: { trackId, isLatest: true },
    });

    const nextVersion = await this.getNextMasterVersion(trackId);

    const masterFile = new MasterFile();
    masterFile.trackId = trackId;
    masterFile.version = nextVersion;
    masterFile.fileName = data.fileName;
    masterFile.filePath = data.filePath;
    masterFile.fileSize = data.fileSize;
    masterFile.duration = data.duration;
    masterFile.sampleRate = data.sampleRate;
    masterFile.bitDepth = data.bitDepth;
    masterFile.bitRate = data.bitRate;
    masterFile.format = data.format;
    masterFile.channels = data.channels;
    masterFile.checksum = data.checksum;
    masterFile.notes = data.notes;
    masterFile.status = FileStatus.PENDING_VALIDATION;
    masterFile.uploadedBy = data.uploadedBy;
    masterFile.isLatest = true;
    masterFile.peakLevel = data.peakLevel;
    masterFile.loudnessIntegrated = data.loudnessIntegrated;
    masterFile.loudnessRange = data.loudnessRange;

    if (currentLatest) {
      currentLatest.isLatest = false;
      currentLatest.status = FileStatus.SUPERSEDED;
      await this.masterFileRepository.save(currentLatest);

      await this.auditService.logChange(
        EntityType.MASTER_FILE,
        currentLatest.id,
        'status',
        currentLatest.status,
        FileStatus.SUPERSEDED,
        data.uploadedBy,
        `新版本 v${nextVersion} 上传，旧版本 v${currentLatest.version} 被取代`
      );

      await this.auditService.logChange(
        EntityType.MASTER_FILE,
        currentLatest.id,
        'isLatest',
        'true',
        'false',
        data.uploadedBy,
        `新版本 v${nextVersion} 上传`
      );

      await this.anomalyService.createAnomaly(
        trackId,
        AnomalyType.MASTER_VERSION_CONFLICT,
        AnomalySeverity.MEDIUM,
        `母带版本更新：v${currentLatest.version} → v${nextVersion}`,
        EntityType.MASTER_FILE,
        masterFile.id,
        {
          impactOnMoney: '版本变更可能影响已确认的交付计划，需要重新审核',
          impactOnTime: '新版本需要重新校验，可能延迟交付时间',
          impactOnRoster: '如果已有平台使用旧版本母带，需要确认是否需要替换',
          affectedFields: ['version', 'fileName', 'status', 'isLatest'],
          suggestedActions: [
            '确认新版本是否解决了旧版本的问题',
            '通知相关人员版本已更新',
            '检查是否有正在进行的交付使用了旧版本',
            '更新相关的交付报告引用',
          ],
          context: `旧版本ID: ${currentLatest.id}, 新版本ID: ${masterFile.id}`,
        }
      );
    }

    const saved = await this.masterFileRepository.save(masterFile);

    await this.auditService.logChange(
      EntityType.MASTER_FILE,
      saved.id,
      'version',
      undefined,
      nextVersion,
      data.uploadedBy,
      '上传新母带文件'
    );

    return saved;
  }

  async uploadCoverArt(
    trackId: number,
    data: CoverArtUploadData
  ): Promise<CoverArt> {
    const track = await this.trackRepository.findOne({ where: { id: trackId } });
    if (!track) {
      throw new Error('曲目不存在');
    }

    const currentLatest = await this.coverArtRepository.findOne({
      where: { trackId, isLatest: true },
    });

    const nextVersion = await this.getNextCoverVersion(trackId);

    const coverArt = new CoverArt();
    coverArt.trackId = trackId;
    coverArt.version = nextVersion;
    coverArt.fileName = data.fileName;
    coverArt.filePath = data.filePath;
    coverArt.fileSize = data.fileSize;
    coverArt.width = data.width;
    coverArt.height = data.height;
    coverArt.format = data.format;
    coverArt.dpi = data.dpi;
    coverArt.colorProfile = data.colorProfile;
    coverArt.checksum = data.checksum;
    coverArt.notes = data.notes;
    coverArt.status = FileStatus.PENDING_VALIDATION;
    coverArt.uploadedBy = data.uploadedBy;
    coverArt.isLatest = true;
    coverArt.hasExplicitContent = data.hasExplicitContent || false;
    coverArt.hasTextOverlay = data.hasTextOverlay || false;

    if (currentLatest) {
      currentLatest.isLatest = false;
      currentLatest.status = FileStatus.SUPERSEDED;
      await this.coverArtRepository.save(currentLatest);

      await this.auditService.logChange(
        EntityType.COVER_ART,
        currentLatest.id,
        'status',
        currentLatest.status,
        FileStatus.SUPERSEDED,
        data.uploadedBy,
        `新版本 v${nextVersion} 上传，旧版本 v${currentLatest.version} 被取代`
      );

      await this.auditService.logChange(
        EntityType.COVER_ART,
        currentLatest.id,
        'isLatest',
        'true',
        'false',
        data.uploadedBy,
        `新版本 v${nextVersion} 上传`
      );

      await this.anomalyService.createAnomaly(
        trackId,
        AnomalyType.COVER_OVERWRITE,
        AnomalySeverity.MEDIUM,
        `封面版本更新：v${currentLatest.version} → v${nextVersion}`,
        EntityType.COVER_ART,
        coverArt.id,
        {
          impactOnMoney: '封面覆盖可能影响已确认的交付计划，需要重新审核',
          impactOnTime: '新版本需要重新校验，可能延迟交付时间',
          impactOnRoster: '如果已有平台使用旧版本封面，需要确认是否需要替换',
          affectedFields: ['version', 'fileName', 'status', 'isLatest'],
          suggestedActions: [
            '确认新版本封面是否符合所有平台要求',
            '通知设计师和相关人员版本已更新',
            '检查是否有正在进行的交付使用了旧版本封面',
            '更新相关的交付报告引用',
          ],
          context: `旧版本ID: ${currentLatest.id}, 新版本ID: ${coverArt.id}`,
        }
      );
    }

    const saved = await this.coverArtRepository.save(coverArt);

    await this.auditService.logChange(
      EntityType.COVER_ART,
      saved.id,
      'version',
      undefined,
      nextVersion,
      data.uploadedBy,
      '上传新封面文件'
    );

    return saved;
  }

  async getMasterFileHistory(trackId: number): Promise<MasterFile[]> {
    return this.masterFileRepository.find({
      where: { trackId },
      order: { version: 'DESC' },
    });
  }

  async getCoverArtHistory(trackId: number): Promise<CoverArt[]> {
    return this.coverArtRepository.find({
      where: { trackId },
      order: { version: 'DESC' },
    });
  }

  async getLatestMasterFile(trackId: number): Promise<MasterFile | null> {
    return this.masterFileRepository.findOne({
      where: { trackId, isLatest: true },
    });
  }

  async getLatestCoverArt(trackId: number): Promise<CoverArt | null> {
    return this.coverArtRepository.findOne({
      where: { trackId, isLatest: true },
    });
  }

  async getMasterFileVersion(trackId: number, version: number): Promise<MasterFile | null> {
    return this.masterFileRepository.findOne({
      where: { trackId, version },
    });
  }

  async getCoverArtVersion(trackId: number, version: number): Promise<CoverArt | null> {
    return this.coverArtRepository.findOne({
      where: { trackId, version },
    });
  }

  async revertMasterToVersion(trackId: number, version: number, revertedBy?: string): Promise<MasterFile> {
    const targetVersion = await this.getMasterFileVersion(trackId, version);
    if (!targetVersion) {
      throw new Error('指定的母带版本不存在');
    }

    const currentLatest = await this.getLatestMasterFile(trackId);

    const newVersionData: MasterFileUploadData = {
      fileName: targetVersion.fileName.replace(/\.[^.]+$/, `_v${version}_restore.$&`),
      filePath: targetVersion.filePath,
      fileSize: targetVersion.fileSize,
      duration: targetVersion.duration,
      sampleRate: targetVersion.sampleRate,
      bitDepth: targetVersion.bitDepth,
      bitRate: targetVersion.bitRate,
      format: targetVersion.format,
      channels: targetVersion.channels,
      checksum: targetVersion.checksum,
      notes: `恢复自版本 v${version}${targetVersion.notes ? ` | ${targetVersion.notes}` : ''}`,
      peakLevel: targetVersion.peakLevel,
      loudnessIntegrated: targetVersion.loudnessIntegrated,
      loudnessRange: targetVersion.loudnessRange,
      uploadedBy: revertedBy,
    };

    const restored = await this.uploadMasterFile(trackId, newVersionData);

    await this.auditService.logChange(
      EntityType.TRACK,
      trackId,
      'latestMasterFile',
      currentLatest?.id,
      restored.id,
      revertedBy,
      `恢复母带到版本 v${version}`
    );

    return restored;
  }

  async revertCoverToVersion(trackId: number, version: number, revertedBy?: string): Promise<CoverArt> {
    const targetVersion = await this.getCoverArtVersion(trackId, version);
    if (!targetVersion) {
      throw new Error('指定的封面版本不存在');
    }

    const currentLatest = await this.getLatestCoverArt(trackId);

    const newVersionData: CoverArtUploadData = {
      fileName: targetVersion.fileName.replace(/\.[^.]+$/, `_v${version}_restore.$&`),
      filePath: targetVersion.filePath,
      fileSize: targetVersion.fileSize,
      width: targetVersion.width,
      height: targetVersion.height,
      format: targetVersion.format,
      dpi: targetVersion.dpi,
      colorProfile: targetVersion.colorProfile,
      checksum: targetVersion.checksum,
      notes: `恢复自版本 v${version}${targetVersion.notes ? ` | ${targetVersion.notes}` : ''}`,
      hasExplicitContent: targetVersion.hasExplicitContent,
      hasTextOverlay: targetVersion.hasTextOverlay,
      uploadedBy: revertedBy,
    };

    const restored = await this.uploadCoverArt(trackId, newVersionData);

    await this.auditService.logChange(
      EntityType.TRACK,
      trackId,
      'latestCoverArt',
      currentLatest?.id,
      restored.id,
      revertedBy,
      `恢复封面到版本 v${version}`
    );

    return restored;
  }

  async compareMasterVersions(
    trackId: number,
    versionA: number,
    versionB: number
  ): Promise<{ field: string; versionA: any; versionB: any }[]> {
    const a = await this.getMasterFileVersion(trackId, versionA);
    const b = await this.getMasterFileVersion(trackId, versionB);

    if (!a || !b) {
      throw new Error('指定的母带版本不存在');
    }

    const compareFields: (keyof MasterFile)[] = [
      'fileName', 'fileSize', 'duration', 'sampleRate', 'bitDepth',
      'bitRate', 'format', 'channels', 'checksum', 'peakLevel',
      'loudnessIntegrated', 'loudnessRange', 'status'
    ];

    const differences: { field: string; versionA: any; versionB: any }[] = [];

    for (const field of compareFields) {
      if (a[field] !== b[field]) {
        differences.push({
          field,
          versionA: a[field],
          versionB: b[field],
        });
      }
    }

    return differences;
  }

  async compareCoverVersions(
    trackId: number,
    versionA: number,
    versionB: number
  ): Promise<{ field: string; versionA: any; versionB: any }[]> {
    const a = await this.getCoverArtVersion(trackId, versionA);
    const b = await this.getCoverArtVersion(trackId, versionB);

    if (!a || !b) {
      throw new Error('指定的封面版本不存在');
    }

    const compareFields: (keyof CoverArt)[] = [
      'fileName', 'fileSize', 'width', 'height', 'format',
      'dpi', 'colorProfile', 'checksum', 'hasExplicitContent',
      'hasTextOverlay', 'status'
    ];

    const differences: { field: string; versionA: any; versionB: any }[] = [];

    for (const field of compareFields) {
      if (a[field] !== b[field]) {
        differences.push({
          field,
          versionA: a[field],
          versionB: b[field],
        });
      }
    }

    return differences;
  }
}
