import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Certificate } from '../entities/certificate.entity';
import { CertificateDuplicate } from '../entities/certificate-duplicate.entity';
import {
  CertificateStatus,
  CertificateSource,
  FlowAction,
  ReviewStatus,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  PaginatedResult,
  EntityType,
} from '../../../common/types';
import {
  CertificateNotFoundException,
  DuplicateCertificateException,
  InvalidStatusTransitionException,
  CertificateAlreadyVoidedException,
} from '../../../common/exceptions';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateCertificateDto, UpdateCertificateDto, ManualCorrectionDto, CertificateQueryDto } from '../dto/certificate.dto';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    @InjectRepository(CertificateDuplicate)
    private readonly duplicateRepository: Repository<CertificateDuplicate>,
    private readonly dataSource: DataSource,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private readonly VALID_STATUS_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
    [CertificateStatus.ISSUED]: [
      CertificateStatus.BATCH_BOUND,
      CertificateStatus.VOIDED,
      CertificateStatus.DUPLICATE_DETECTED,
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.BATCH_BOUND]: [
      CertificateStatus.IN_TRANSPORT,
      CertificateStatus.ISSUED,
      CertificateStatus.VOIDED,
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.IN_TRANSPORT]: [
      CertificateStatus.TRANSPORT_VERIFIED,
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.TRANSPORT_VERIFIED]: [
      CertificateStatus.MARKET_ACCEPTED,
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.MARKET_ACCEPTED]: [
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.VOIDED]: [
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.MANUALLY_CORRECTED]: [
      CertificateStatus.MANUALLY_CORRECTED,
    ],
    [CertificateStatus.DUPLICATE_DETECTED]: [
      CertificateStatus.ISSUED,
      CertificateStatus.VOIDED,
      CertificateStatus.MANUALLY_CORRECTED,
    ],
  };

  async create(
    dto: CreateCertificateDto,
    user: UserContext,
  ): Promise<ProcessingResult<Certificate>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingCerts = await this.certificateRepository.find({
        where: { certificateNumber: dto.certificateNumber },
      });

      const certificate = queryRunner.manager.create(Certificate, {
        ...dto,
        issuerId: user.userId,
        issuerName: user.userName,
        lastOperatorId: user.userId,
        lastOperatorName: user.userName,
      });

      if (existingCerts.length > 0) {
        certificate.status = CertificateStatus.DUPLICATE_DETECTED;
        certificate.hasDuplicate = true;
      }

      const savedCert = await queryRunner.manager.save(Certificate, certificate);

      await this.flowHistoryService.recordAction({
        certificateNumber: savedCert.certificateNumber,
        certificateId: savedCert.id,
        action: FlowAction.CERTIFICATE_ISSUED,
        description: `检疫证号 ${savedCert.certificateNumber} 已录入，来源：${dto.source}`,
        previousStatus: null,
        newStatus: savedCert.status,
        user,
        snapshot: {
          certificateNumber: savedCert.certificateNumber,
          source: savedCert.source,
          animalType: savedCert.animalType,
          animalQuantity: savedCert.animalQuantity,
        },
      });

      if (existingCerts.length > 0) {
        for (const existing of existingCerts) {
          await this.createDuplicateRecord(savedCert, existing, user, queryRunner);
        }

        await queryRunner.commitTransaction();

        const reviewTask = await this.createReviewTaskForDuplicate(savedCert, existingCerts.length + 1, user);

        return {
          success: true,
          data: savedCert,
          needsReview: true,
          reviewReason: 'DUPLICATE_CERTIFICATE_NUMBER',
          reviewPriority: ReviewPriority.HIGH,
          message: `检疫证录入成功，但检测到证号 [${savedCert.certificateNumber}] 已存在 ${existingCerts.length} 条记录，需要人工复核`,
          warnings: [
            `检测到证号重复，共 ${existingCerts.length + 1} 条记录`,
            '已自动创建人工复核任务',
          ],
        };
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        data: savedCert,
        needsReview: false,
        message: '检疫证录入成功',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('创建检疫证失败', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createDuplicateRecord(
    newCert: Certificate,
    existingCert: Certificate,
    user: UserContext,
    queryRunner?: any,
  ): Promise<CertificateDuplicate> {
    const conflictDetails = {
      newCertificate: {
        id: newCert.id,
        source: newCert.source,
        farmName: newCert.farmName,
        slaughterhouseName: newCert.slaughterhouseName,
        animalType: newCert.animalType,
        animalQuantity: newCert.animalQuantity,
        createdBy: newCert.issuerName,
        createdAt: newCert.createdAt,
      },
      existingCertificate: {
        id: existingCert.id,
        status: existingCert.status,
        source: existingCert.source,
        farmName: existingCert.farmName,
        slaughterhouseName: existingCert.slaughterhouseName,
        animalType: existingCert.animalType,
        animalQuantity: existingCert.animalQuantity,
        createdBy: existingCert.issuerName,
        createdAt: existingCert.createdAt,
      },
      differences: this.compareCertificates(newCert, existingCert),
    };

    const duplicate = (queryRunner?.manager || this.duplicateRepository).create(CertificateDuplicate, {
      certificateNumber: newCert.certificateNumber,
      certificateId: newCert.id,
      conflictingCertificateId: existingCert.id,
      status: ReviewStatus.PENDING,
      priority: ReviewPriority.HIGH,
      conflictReason: 'DUPLICATE_CERTIFICATE_NUMBER',
      conflictDetails,
      isPrimary: false,
    });

    return (queryRunner?.manager || this.duplicateRepository).save(CertificateDuplicate, duplicate);
  }

  private compareCertificates(cert1: Certificate, cert2: Certificate): Record<string, any> {
    const differences: Record<string, any> = {};
    const fields = ['source', 'farmName', 'slaughterhouseName', 'animalType', 'animalQuantity', 'totalWeight', 'slaughterDate', 'inspectionDate'];

    for (const field of fields) {
      if (String(cert1[field]) !== String(cert2[field])) {
        differences[field] = {
          value1: cert1[field],
          value2: cert2[field],
        };
      }
    }

    return differences;
  }

  private async createReviewTaskForDuplicate(
    certificate: Certificate,
    duplicateCount: number,
    user: UserContext,
  ) {
    return {
      taskNumber: `REV-${Date.now()}`,
      certificateNumber: certificate.certificateNumber,
      certificateId: certificate.id,
      reasonCode: 'DUPLICATE_CERTIFICATE_NUMBER',
      reasonDescription: `证号 ${certificate.certificateNumber} 检测到 ${duplicateCount} 条重复记录，需要人工确认哪条是有效的`,
      priority: ReviewPriority.HIGH,
      status: ReviewStatus.PENDING,
      createdBy: user.userId,
      createdByName: user.userName,
    };
  }

  async findByNumber(certificateNumber: string): Promise<Certificate[]> {
    return this.certificateRepository.find({
      where: { certificateNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Certificate> {
    const cert = await this.certificateRepository.findOne({ where: { id } });
    if (!cert) {
      throw new CertificateNotFoundException(id);
    }
    return cert;
  }

  async getCertificateDetail(certificateNumber: string): Promise<ProcessingResult<{
    certificate: Certificate;
    duplicates: Certificate[];
    flowHistory: any;
    hasDuplicate: boolean;
    needsManualReview: boolean;
  }>> {
    const certs = await this.findByNumber(certificateNumber);

    if (certs.length === 0) {
      throw new CertificateNotFoundException(certificateNumber);
    }

    const primaryCert = certs[0];
    const flowHistory = await this.flowHistoryService.getCertificateFullTimeline(certificateNumber);

    const pendingDuplicates = await this.duplicateRepository.find({
      where: {
        certificateNumber,
        status: ReviewStatus.PENDING,
      },
    });

    return {
      success: true,
      data: {
        certificate: primaryCert,
        duplicates: certs.slice(1),
        flowHistory,
        hasDuplicate: certs.length > 1,
        needsManualReview: pendingDuplicates.length > 0,
      },
      needsReview: certs.length > 1 && pendingDuplicates.length > 0,
      message: certs.length > 1
        ? `查询成功，检测到 ${certs.length} 条重复记录，${pendingDuplicates.length} 条待复核`
        : '查询成功',
    };
  }

  async query(
    query: CertificateQueryDto,
  ): Promise<PaginatedResult<Certificate>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.certificateRepository.createQueryBuilder('cert');

    if (query.certificateNumber) {
      qb.andWhere('cert.certificateNumber LIKE :certNumber', {
        certNumber: `%${query.certificateNumber}%`,
      });
    }

    if (query.status?.length) {
      qb.andWhere('cert.status IN (:...status)', { status: query.status });
    }

    if (query.source?.length) {
      qb.andWhere('cert.source IN (:...source)', { source: query.source });
    }

    if (query.farmName) {
      qb.andWhere('cert.farmName LIKE :farmName', { farmName: `%${query.farmName}%` });
    }

    if (query.slaughterhouseName) {
      qb.andWhere('cert.slaughterhouseName LIKE :slaughterhouseName', {
        slaughterhouseName: `%${query.slaughterhouseName}%`,
      });
    }

    if (query.animalType) {
      qb.andWhere('cert.animalType = :animalType', { animalType: query.animalType });
    }

    if (query.hasDuplicate !== undefined) {
      qb.andWhere('cert.hasDuplicate = :hasDuplicate', { hasDuplicate: query.hasDuplicate });
    }

    if (query.hasManualCorrection !== undefined) {
      qb.andWhere('cert.hasManualCorrection = :hasManualCorrection', {
        hasManualCorrection: query.hasManualCorrection,
      });
    }

    if (query.startDate) {
      qb.andWhere('cert.createdAt >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      qb.andWhere('cert.createdAt <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await qb
      .orderBy('cert.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateStatus(
    certificateId: string,
    newStatus: CertificateStatus,
    user: UserContext,
    options?: {
      reason?: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
      action?: FlowAction;
      actionDescription?: string;
      isManualCorrection?: boolean;
    },
  ): Promise<ProcessingResult<Certificate>> {
    const certificate = await this.findById(certificateId);

    if (certificate.status === CertificateStatus.VOIDED && newStatus !== CertificateStatus.MANUALLY_CORRECTED) {
      throw new CertificateAlreadyVoidedException(certificate.certificateNumber);
    }

    if (!this.VALID_STATUS_TRANSITIONS[certificate.status]?.includes(newStatus)) {
      throw new InvalidStatusTransitionException(
        certificate.status,
        newStatus,
        `不允许从 ${certificate.status} 转换到 ${newStatus}`,
      );
    }

    const oldStatus = certificate.status;
    certificate.status = newStatus;
    certificate.lastOperatorId = user.userId;
    certificate.lastOperatorName = user.userName;

    if (options?.isManualCorrection) {
      certificate.hasManualCorrection = true;
    }

    const savedCert = await this.certificateRepository.save(certificate);

    await this.flowHistoryService.recordAction({
      certificateNumber: savedCert.certificateNumber,
      certificateId: savedCert.id,
      action: options?.action || FlowAction.MANUAL_CORRECTION,
      description: options?.actionDescription || `状态变更: ${oldStatus} -> ${newStatus}`,
      previousStatus: oldStatus,
      newStatus: newStatus,
      user,
      relatedEntityId: options?.relatedEntityId,
      relatedEntityType: options?.relatedEntityType,
      isManualCorrection: options?.isManualCorrection || false,
      correctionReason: options?.reason,
    });

    await this.auditLogService.log({
      entityType: EntityType.CERTIFICATE,
      entityId: certificateId,
      entityNumber: certificate.certificateNumber,
      action: 'STATUS_UPDATE',
      description: `状态变更: ${oldStatus} -> ${newStatus}`,
      user,
      beforeData: { status: oldStatus },
      afterData: { status: newStatus },
      remarks: options?.reason,
    });

    return {
      success: true,
      data: savedCert,
      needsReview: false,
      message: '状态更新成功',
    };
  }

  async manualCorrection(
    certificateId: string,
    dto: ManualCorrectionDto,
    user: UserContext,
  ): Promise<ProcessingResult<Certificate>> {
    const certificate = await this.findById(certificateId);
    const beforeData = { ...certificate };

    const changes: Record<string, any> = {};

    if (dto.status && dto.status !== certificate.status) {
      if (!this.VALID_STATUS_TRANSITIONS[certificate.status]?.includes(dto.status as CertificateStatus)) {
        if (!dto.skipDuplicateCheck) {
          throw new InvalidStatusTransitionException(
            certificate.status,
            dto.status,
            '人工修正状态需要确认，请设置 skipDuplicateCheck=true',
          );
        }
      }
      changes['status'] = { from: certificate.status, to: dto.status };
      certificate.status = dto.status as CertificateStatus;
    }

    if (dto.fields) {
      for (const [key, value] of Object.entries(dto.fields)) {
        if (certificate[key] !== undefined) {
          changes[key] = { from: certificate[key], to: value };
          certificate[key] = value;
        }
      }
    }

    certificate.hasManualCorrection = true;
    certificate.lastOperatorId = user.userId;
    certificate.lastOperatorName = user.userName;

    const savedCert = await this.certificateRepository.save(certificate);

    await this.flowHistoryService.recordAction({
      certificateNumber: savedCert.certificateNumber,
      certificateId: savedCert.id,
      action: FlowAction.MANUAL_CORRECTION,
      description: `人工修正: ${dto.reason}`,
      previousStatus: beforeData.status,
      newStatus: savedCert.status,
      user,
      changes,
      snapshot: beforeData,
      isManualCorrection: true,
      correctionReason: dto.reason,
    });

    await this.auditLogService.log({
      entityType: EntityType.CERTIFICATE,
      entityId: certificateId,
      entityNumber: certificate.certificateNumber,
      action: 'MANUAL_CORRECTION',
      description: `人工修正: ${dto.reason}`,
      user,
      beforeData,
      afterData: { ...savedCert },
      remarks: dto.reason,
    });

    return {
      success: true,
      data: savedCert,
      needsReview: false,
      message: '人工修正已记录，历史数据已保存，后续统计将基于修正后的状态',
      warnings: [
        '已记录人工修正操作',
        '所有历史记录已保留，可追溯原始状态',
        '后续统计将使用当前修正后的状态',
      ],
    };
  }

  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    duplicates: number;
    manuallyCorrected: number;
  }> {
    const [total, statusStats, sourceStats, duplicates, manualCorrected] = await Promise.all([
      this.certificateRepository.count(),
      this.certificateRepository
        .createQueryBuilder('cert')
        .select('cert.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('cert.status')
        .getRawMany(),
      this.certificateRepository
        .createQueryBuilder('cert')
        .select('cert.source', 'source')
        .addSelect('COUNT(*)', 'count')
        .groupBy('cert.source')
        .getRawMany(),
      this.certificateRepository.count({ where: { hasDuplicate: true } }),
      this.certificateRepository.count({ where: { hasManualCorrection: true } }),
    ]);

    return {
      total,
      byStatus: statusStats.reduce((acc, item) => ({ ...acc, [item.status]: Number(item.count) }), {}),
      bySource: sourceStats.reduce((acc, item) => ({ ...acc, [item.source]: Number(item.count) }), {}),
      duplicates,
      manuallyCorrected: manualCorrected,
    };
  }
}
