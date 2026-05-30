import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { DeliveryReport } from '../entities/DeliveryReport';
import { Track } from '../entities/Track';
import { PlatformSpec } from '../entities/PlatformSpec';
import { MasterFile } from '../entities/MasterFile';
import { CoverArt } from '../entities/CoverArt';
import { DeliveryStatus, EntityType, TrackStatus, FileStatus } from '../entities/enums';
import { AuditService } from './AuditService';
import { ValidationService } from './ValidationService';
import { VersionService } from './VersionService';
import { Parser } from 'json2csv';

export interface DeliveryReportCreateData {
  trackId: number;
  platformSpecId: number;
  masterFileId?: number;
  coverArtId?: number;
  notes?: string;
  estimatedRevenue?: number;
  createdBy?: string;
}

export interface DeliveryReportFull extends Omit<DeliveryReport, 'track' | 'platformSpec' | 'masterFile' | 'coverArt'> {
  track?: Track;
  platformSpec?: PlatformSpec;
  masterFile?: MasterFile;
  coverArt?: CoverArt;
}

export class DeliveryService {
  private deliveryReportRepository: Repository<DeliveryReport>;
  private trackRepository: Repository<Track>;
  private platformSpecRepository: Repository<PlatformSpec>;
  private auditService: AuditService;
  private validationService: ValidationService;
  private versionService: VersionService;

  constructor() {
    this.deliveryReportRepository = AppDataSource.getRepository(DeliveryReport);
    this.trackRepository = AppDataSource.getRepository(Track);
    this.platformSpecRepository = AppDataSource.getRepository(PlatformSpec);
    this.auditService = new AuditService();
    this.validationService = new ValidationService();
    this.versionService = new VersionService();
  }

  async createDeliveryReport(data: DeliveryReportCreateData): Promise<DeliveryReport> {
    const track = await this.trackRepository.findOne({ where: { id: data.trackId } });
    const spec = await this.platformSpecRepository.findOne({ where: { id: data.platformSpecId } });

    if (!track || !spec) {
      throw new Error('曲目或平台规格不存在');
    }

    const existing = await this.deliveryReportRepository.findOne({
      where: { trackId: data.trackId, platformSpecId: data.platformSpecId },
    });

    if (existing) {
      throw new Error('该曲目在该平台的交付报告已存在');
    }

    const report = new DeliveryReport();
    report.trackId = data.trackId;
    report.platformSpecId = data.platformSpecId;
    report.masterFileId = data.masterFileId;
    report.coverArtId = data.coverArtId;
    report.status = DeliveryStatus.PENDING;
    report.notes = data.notes;
    report.estimatedRevenue = data.estimatedRevenue;

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChange(
      EntityType.DELIVERY_REPORT,
      saved.id,
      'status',
      undefined,
      DeliveryStatus.PENDING,
      data.createdBy,
      '创建交付报告'
    );

    return saved;
  }

  async getDeliveryReport(id: number, withRelations: boolean = true): Promise<DeliveryReportFull | null> {
    const relations = withRelations
      ? ['track', 'platformSpec', 'masterFile', 'coverArt']
      : [];

    return this.deliveryReportRepository.findOne({
      where: { id },
      relations,
    }) as Promise<DeliveryReportFull | null>;
  }

  async getDeliveryReportsByTrack(trackId: number): Promise<DeliveryReportFull[]> {
    return this.deliveryReportRepository.find({
      where: { trackId },
      relations: ['track', 'platformSpec', 'masterFile', 'coverArt'],
      order: { createdAt: 'DESC' },
    }) as Promise<DeliveryReportFull[]>;
  }

  async getDeliveryReportsByPlatform(platformSpecId: number): Promise<DeliveryReportFull[]> {
    return this.deliveryReportRepository.find({
      where: { platformSpecId },
      relations: ['track', 'platformSpec', 'masterFile', 'coverArt'],
      order: { createdAt: 'DESC' },
    }) as Promise<DeliveryReportFull[]>;
  }

  async getDeliveryReportsByStatus(status: DeliveryStatus): Promise<DeliveryReportFull[]> {
    return this.deliveryReportRepository.find({
      where: { status },
      relations: ['track', 'platformSpec', 'masterFile', 'coverArt'],
      order: { createdAt: 'DESC' },
    }) as Promise<DeliveryReportFull[]>;
  }

  async getAllDeliveryReports(): Promise<DeliveryReportFull[]> {
    return this.deliveryReportRepository.find({
      relations: ['track', 'platformSpec', 'masterFile', 'coverArt'],
      order: { createdAt: 'DESC' },
    }) as Promise<DeliveryReportFull[]>;
  }

  async validateDeliveryReport(
    reportId: number,
    validatedBy?: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
      relations: ['track', 'platformSpec'],
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    const oldStatus = report.status;
    report.status = DeliveryStatus.VALIDATING;
    await this.deliveryReportRepository.save(report);

    await this.auditService.logChange(
      EntityType.DELIVERY_REPORT,
      reportId,
      'status',
      oldStatus,
      DeliveryStatus.VALIDATING,
      validatedBy,
      '开始校验交付报告'
    );

    const masterErrors: string[] = [];
    const coverErrors: string[] = [];
    const metadataErrors: string[] = [];

    if (report.masterFileId) {
      const masterValidation = await this.validationService.validateMasterFileAgainstSpec(
        report.masterFileId,
        report.platformSpecId
      );
      masterErrors.push(...masterValidation.errors);
    } else {
      masterErrors.push('未关联母带文件');
    }

    if (report.coverArtId) {
      const coverValidation = await this.validationService.validateCoverArtAgainstSpec(
        report.coverArtId,
        report.platformSpecId
      );
      coverErrors.push(...coverValidation.errors);
    } else {
      coverErrors.push('未关联封面文件');
    }

    const metadataValidation = await this.validationService.validateTrackMetadata(
      report.trackId,
      report.platformSpecId
    );
    metadataErrors.push(...metadataValidation.errors);

    report.masterValidationErrors = masterErrors.length > 0 ? masterErrors : undefined;
    report.coverValidationErrors = coverErrors.length > 0 ? coverErrors : undefined;
    report.metadataValidationErrors = metadataErrors.length > 0 ? metadataErrors : undefined;

    if (masterErrors.length === 0 && coverErrors.length === 0 && metadataErrors.length === 0) {
      report.status = DeliveryStatus.APPROVED;
    } else {
      report.status = DeliveryStatus.REJECTED;
      report.rejectionReason = `校验失败：母带${masterErrors.length}项，封面${coverErrors.length}项，元数据${metadataErrors.length}项`;
    }

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChanges(
      EntityType.DELIVERY_REPORT,
      reportId,
      [
        { fieldName: 'status', oldValue: DeliveryStatus.VALIDATING, newValue: saved.status },
        { fieldName: 'masterValidationErrors', oldValue: undefined, newValue: JSON.stringify(saved.masterValidationErrors) },
        { fieldName: 'coverValidationErrors', oldValue: undefined, newValue: JSON.stringify(saved.coverValidationErrors) },
        { fieldName: 'metadataValidationErrors', oldValue: undefined, newValue: JSON.stringify(saved.metadataValidationErrors) },
        { fieldName: 'rejectionReason', oldValue: undefined, newValue: saved.rejectionReason },
      ],
      validatedBy,
      '完成交付报告校验'
    );

    return saved;
  }

  async approveDeliveryReport(
    reportId: number,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    const oldStatus = report.status;

    report.status = DeliveryStatus.APPROVED;
    report.approvedBy = approvedBy;
    report.approvedAt = new Date();
    report.approvalNotes = approvalNotes;
    report.rejectionReason = undefined;

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChanges(
      EntityType.DELIVERY_REPORT,
      reportId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: DeliveryStatus.APPROVED },
        { fieldName: 'approvedBy', oldValue: undefined, newValue: approvedBy },
        { fieldName: 'approvedAt', oldValue: undefined, newValue: saved.approvedAt?.toISOString() },
        { fieldName: 'approvalNotes', oldValue: undefined, newValue: approvalNotes },
        { fieldName: 'rejectionReason', oldValue: report.rejectionReason, newValue: undefined },
      ],
      approvedBy,
      '人工批准交付报告'
    );

    await this.updateTrackStatus(saved.trackId, approvedBy);

    return saved;
  }

  async rejectDeliveryReport(
    reportId: number,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    const oldStatus = report.status;

    report.status = DeliveryStatus.REJECTED;
    report.rejectedBy = rejectedBy;
    report.rejectedAt = new Date();
    report.rejectionReason = rejectionReason;

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChanges(
      EntityType.DELIVERY_REPORT,
      reportId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: DeliveryStatus.REJECTED },
        { fieldName: 'rejectedBy', oldValue: undefined, newValue: rejectedBy },
        { fieldName: 'rejectedAt', oldValue: undefined, newValue: saved.rejectedAt?.toISOString() },
        { fieldName: 'rejectionReason', oldValue: report.rejectionReason, newValue: rejectionReason },
      ],
      rejectedBy,
      '人工驳回交付报告'
    );

    return saved;
  }

  async markAsDelivered(
    reportId: number,
    deliveredBy: string,
    deliveryBatchId?: string,
    externalReferenceId?: string,
    deliveryLog?: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    if (report.status !== DeliveryStatus.APPROVED) {
      throw new Error('只有已批准的报告才能标记为已交付');
    }

    const oldStatus = report.status;

    report.status = DeliveryStatus.DELIVERED;
    report.deliveredBy = deliveredBy;
    report.deliveredAt = new Date();
    report.deliveryBatchId = deliveryBatchId;
    report.externalReferenceId = externalReferenceId;
    report.deliveryLog = deliveryLog;

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChanges(
      EntityType.DELIVERY_REPORT,
      reportId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: DeliveryStatus.DELIVERED },
        { fieldName: 'deliveredBy', oldValue: undefined, newValue: deliveredBy },
        { fieldName: 'deliveredAt', oldValue: undefined, newValue: saved.deliveredAt?.toISOString() },
        { fieldName: 'deliveryBatchId', oldValue: undefined, newValue: deliveryBatchId },
        { fieldName: 'externalReferenceId', oldValue: undefined, newValue: externalReferenceId },
      ],
      deliveredBy,
      '标记为已交付'
    );

    await this.updateTrackStatus(saved.trackId, deliveredBy);

    return saved;
  }

  async acknowledgeDelivery(
    reportId: number,
    acknowledgedBy: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    if (report.status !== DeliveryStatus.DELIVERED) {
      throw new Error('只有已交付的报告才能确认收到');
    }

    const oldStatus = report.status;

    report.status = DeliveryStatus.ACKNOWLEDGED;
    report.acknowledgedBy = acknowledgedBy;
    report.acknowledgedAt = new Date();

    const saved = await this.deliveryReportRepository.save(report);

    await this.auditService.logChanges(
      EntityType.DELIVERY_REPORT,
      reportId,
      [
        { fieldName: 'status', oldValue: oldStatus, newValue: DeliveryStatus.ACKNOWLEDGED },
        { fieldName: 'acknowledgedBy', oldValue: undefined, newValue: acknowledgedBy },
        { fieldName: 'acknowledgedAt', oldValue: undefined, newValue: saved.acknowledgedAt?.toISOString() },
      ],
      acknowledgedBy,
      '确认收到交付'
    );

    await this.updateTrackStatus(saved.trackId, acknowledgedBy);

    return saved;
  }

  async updateDeliveryReportFiles(
    reportId: number,
    masterFileId?: number,
    coverArtId?: number,
    updatedBy?: string
  ): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    const changes: Array<{ fieldName: string; oldValue: any; newValue: any }> = [];

    if (masterFileId !== undefined && report.masterFileId !== masterFileId) {
      changes.push({
        fieldName: 'masterFileId',
        oldValue: report.masterFileId,
        newValue: masterFileId,
      });
      report.masterFileId = masterFileId;
    }

    if (coverArtId !== undefined && report.coverArtId !== coverArtId) {
      changes.push({
        fieldName: 'coverArtId',
        oldValue: report.coverArtId,
        newValue: coverArtId,
      });
      report.coverArtId = coverArtId;
    }

    if (changes.length > 0) {
      report.status = DeliveryStatus.PENDING;
      changes.push({
        fieldName: 'status',
        oldValue: report.status,
        newValue: DeliveryStatus.PENDING,
      });
    }

    const saved = await this.deliveryReportRepository.save(report);

    if (changes.length > 0) {
      await this.auditService.logChanges(
        EntityType.DELIVERY_REPORT,
        reportId,
        changes,
        updatedBy,
        '更新交付报告关联文件'
      );
    }

    return saved;
  }

  private async updateTrackStatus(trackId: number, modifiedBy?: string): Promise<void> {
    const reports = await this.deliveryReportRepository.find({
      where: { trackId },
    });

    if (reports.length === 0) return;

    const track = await this.trackRepository.findOne({ where: { id: trackId } });
    if (!track) return;

    const allDelivered = reports.every(r => r.status === DeliveryStatus.DELIVERED || r.status === DeliveryStatus.ACKNOWLEDGED);
    const anyRejected = reports.some(r => r.status === DeliveryStatus.REJECTED);
    const anyApproved = reports.some(r => r.status === DeliveryStatus.APPROVED);
    const anyPending = reports.some(r => r.status === DeliveryStatus.PENDING || r.status === DeliveryStatus.VALIDATING);

    let newStatus: TrackStatus | null = null;

    if (allDelivered) {
      newStatus = TrackStatus.DELIVERED;
    } else if (anyRejected) {
      newStatus = TrackStatus.REJECTED;
    } else if (anyApproved) {
      newStatus = TrackStatus.APPROVED;
    } else if (anyPending) {
      newStatus = TrackStatus.PENDING_REVIEW;
    }

    if (newStatus && track.status !== newStatus) {
      const oldStatus = track.status;
      track.status = newStatus;
      await this.trackRepository.save(track);

      await this.auditService.logChange(
        EntityType.TRACK,
        trackId,
        'status',
        oldStatus,
        newStatus,
        modifiedBy,
        '关联交付报告状态变更导致曲目状态更新'
      );
    }
  }

  async autoUseLatestFiles(reportId: number, updatedBy?: string): Promise<DeliveryReport> {
    const report = await this.deliveryReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error('交付报告不存在');
    }

    const latestMaster = await this.versionService.getLatestMasterFile(report.trackId);
    const latestCover = await this.versionService.getLatestCoverArt(report.trackId);

    return this.updateDeliveryReportFiles(
      reportId,
      latestMaster?.id,
      latestCover?.id,
      updatedBy
    );
  }

  async exportDeliveryReportToCSV(reportId: number): Promise<string> {
    const report = await this.getDeliveryReport(reportId, true);
    if (!report) {
      throw new Error('交付报告不存在');
    }

    const data = {
      曲目名称: report.track?.title || '',
      艺人: report.track?.artist || '',
      专辑: report.track?.album || '',
      ISRC: report.track?.isrc || '',
      UPC: report.track?.upc || '',
      平台: report.platformSpec?.name || '',
      状态: this.getStatusText(report.status),
      预计收入: report.estimatedRevenue || '',
      母带版本: report.masterFile?.version || '',
      母带文件名: report.masterFile?.fileName || '',
      母带格式: report.masterFile?.format || '',
      母带采样率: report.masterFile?.sampleRate || '',
      母带比特深度: report.masterFile?.bitDepth || '',
      母带响度: report.masterFile?.loudnessIntegrated || '',
      封面版本: report.coverArt?.version || '',
      封面文件名: report.coverArt?.fileName || '',
      封面尺寸: report.coverArt?.width && report.coverArt?.height
        ? `${report.coverArt.width}x${report.coverArt.height}`
        : '',
      封面格式: report.coverArt?.format || '',
      母带校验错误: report.masterValidationErrors?.join('; ') || '',
      封面校验错误: report.coverValidationErrors?.join('; ') || '',
      元数据校验错误: report.metadataValidationErrors?.join('; ') || '',
      驳回原因: report.rejectionReason || '',
      批准人: report.approvedBy || '',
      批准时间: report.approvedAt?.toISOString() || '',
      交付人: report.deliveredBy || '',
      交付时间: report.deliveredAt?.toISOString() || '',
      确认人: report.acknowledgedBy || '',
      确认时间: report.acknowledgedAt?.toISOString() || '',
      外部参考ID: report.externalReferenceId || '',
      备注: report.notes || '',
      创建时间: report.createdAt.toISOString(),
      更新时间: report.updatedAt.toISOString(),
    };

    const parser = new Parser();
    return parser.parse(data);
  }

  async exportAllDeliveryReportsToCSV(status?: DeliveryStatus): Promise<string> {
    let reports: DeliveryReportFull[];

    if (status) {
      reports = await this.getDeliveryReportsByStatus(status);
    } else {
      reports = await this.getAllDeliveryReports();
    }

    const data = reports.map(report => ({
      报告ID: report.id,
      曲目名称: report.track?.title || '',
      艺人: report.track?.artist || '',
      专辑: report.track?.album || '',
      ISRC: report.track?.isrc || '',
      平台: report.platformSpec?.name || '',
      状态: this.getStatusText(report.status),
      预计收入: report.estimatedRevenue || '',
      母带版本: report.masterFile?.version || '',
      封面版本: report.coverArt?.version || '',
      驳回原因: report.rejectionReason || '',
      批准人: report.approvedBy || '',
      批准时间: report.approvedAt?.toISOString() || '',
      交付人: report.deliveredBy || '',
      交付时间: report.deliveredAt?.toISOString() || '',
      创建时间: report.createdAt.toISOString(),
    }));

    const parser = new Parser();
    return parser.parse(data);
  }

  async getDeliveryTrace(trackId: number): Promise<{
    track: Track | null;
    masterFiles: MasterFile[];
    coverArts: CoverArt[];
    deliveryReports: DeliveryReportFull[];
    statusChanges: Array<{ status: string; timestamp: Date; user?: string; reason?: string }>;
  }> {
    const track = await this.trackRepository.findOne({ where: { id: trackId } });
    const masterFiles = await this.versionService.getMasterFileHistory(trackId);
    const coverArts = await this.versionService.getCoverArtHistory(trackId);
    const deliveryReports = await this.getDeliveryReportsByTrack(trackId);
    const auditLogs = await this.auditService.getTrackFullHistory(trackId);

    const statusChanges = auditLogs
      .filter(log => log.fieldName === 'status')
      .map(log => ({
        status: log.newValue || '',
        timestamp: log.modifiedAt,
        user: log.modifiedBy,
        reason: log.reason,
      }));

    return {
      track,
      masterFiles,
      coverArts,
      deliveryReports,
      statusChanges,
    };
  }

  private getStatusText(status: DeliveryStatus): string {
    const statusMap: Record<DeliveryStatus, string> = {
      [DeliveryStatus.PENDING]: '待处理',
      [DeliveryStatus.VALIDATING]: '校验中',
      [DeliveryStatus.APPROVED]: '已批准',
      [DeliveryStatus.REJECTED]: '已驳回',
      [DeliveryStatus.DELIVERED]: '已交付',
      [DeliveryStatus.ACKNOWLEDGED]: '已确认',
    };
    return statusMap[status] || status;
  }
}
